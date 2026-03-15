package service

import (
	"encoding/json"
	"math"
	"sort"
	"strings"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type MatchingService struct {
	matchingRepo     *repository.MatchingRepo
	demandRepo       *repository.DemandRepo
	droneRepo        *repository.DroneRepo
	clientRepo       *repository.ClientRepo
	ownerDomainRepo  *repository.OwnerDomainRepo
	demandDomainRepo *repository.DemandDomainRepo
	logger           *zap.Logger
}

func NewMatchingService(
	matchingRepo *repository.MatchingRepo,
	demandRepo *repository.DemandRepo,
	droneRepo *repository.DroneRepo,
	clientRepo *repository.ClientRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	logger *zap.Logger,
) *MatchingService {
	return &MatchingService{
		matchingRepo:     matchingRepo,
		demandRepo:       demandRepo,
		droneRepo:        droneRepo,
		clientRepo:       clientRepo,
		ownerDomainRepo:  ownerDomainRepo,
		demandDomainRepo: demandDomainRepo,
		logger:           logger,
	}
}

type DemandRecommendation struct {
	Demand              model.Demand           `json:"demand"`
	RecommendScore      int                    `json:"recommend_score"`
	RiskLevel           string                 `json:"risk_level"`
	RiskSummary         map[string]interface{} `json:"risk_summary"`
	RecommendedSupplyID int64                  `json:"recommended_supply_id"`
	ScoreBreakdown      map[string]interface{} `json:"score_breakdown"`
}

// MatchRentalDemand finds matching drone offers for a rental demand
func (s *MatchingService) MatchRentalDemand(demandID int64, radiusKM float64) ([]model.MatchingRecord, error) {
	demand, err := s.demandRepo.GetDemandByID(demandID)
	if err != nil {
		return nil, err
	}

	if radiusKM <= 0 {
		radiusKM = 50
	}

	// Find available offers nearby
	offers, err := s.matchingRepo.FindAvailableOffers(demand.Latitude, demand.Longitude, radiusKM, demand.DemandType)
	if err != nil {
		return nil, err
	}

	// Clear old matching records
	if err := s.matchingRepo.DeleteByDemand(demandID, "rental_demand"); err != nil {
		return nil, err
	}

	var records []model.MatchingRecord
	for _, offer := range offers {
		score, reason := s.calculateOfferScore(demand, &offer)
		if score < 10 {
			continue
		}
		reasonJSON, _ := json.Marshal(reason)
		records = append(records, model.MatchingRecord{
			DemandID:    demandID,
			DemandType:  "rental_demand",
			SupplyID:    offer.ID,
			SupplyType:  "rental_offer",
			MatchScore:  score,
			MatchReason: model.JSON(reasonJSON),
			Status:      "recommended",
		})
	}

	// Also match directly against drones
	drones, err := s.matchingRepo.FindAvailableDrones(demand.Latitude, demand.Longitude, radiusKM)
	if err == nil {
		for _, drone := range drones {
			score, reason := s.calculateDroneScore(demand, &drone)
			if score < 10 {
				continue
			}
			reasonJSON, _ := json.Marshal(reason)
			records = append(records, model.MatchingRecord{
				DemandID:    demandID,
				DemandType:  "rental_demand",
				SupplyID:    drone.ID,
				SupplyType:  "drone",
				MatchScore:  score,
				MatchReason: model.JSON(reasonJSON),
				Status:      "recommended",
			})
		}
	}

	// Sort by score and take top N
	sortByScore(records)
	if len(records) > 10 {
		records = records[:10]
	}

	if err := s.matchingRepo.BatchCreate(records); err != nil {
		return nil, err
	}
	s.writeMatchingLog("rental_demand", demandID, "recommend_owner", records, radiusKM)

	return records, nil
}

// MatchCargoDemand finds matching drones for a cargo demand
func (s *MatchingService) MatchCargoDemand(demandID int64, radiusKM float64) ([]model.MatchingRecord, error) {
	cargo, err := s.demandRepo.GetCargoByID(demandID)
	if err != nil {
		return nil, err
	}

	if radiusKM <= 0 {
		radiusKM = 50
	}

	drones, err := s.matchingRepo.FindAvailableDrones(cargo.PickupLatitude, cargo.PickupLongitude, radiusKM)
	if err != nil {
		return nil, err
	}

	if err := s.matchingRepo.DeleteByDemand(demandID, "cargo_demand"); err != nil {
		return nil, err
	}

	var records []model.MatchingRecord
	for _, drone := range drones {
		score, reason := s.calculateCargoScore(cargo, &drone)
		if score < 10 {
			continue
		}
		reasonJSON, _ := json.Marshal(reason)
		records = append(records, model.MatchingRecord{
			DemandID:    demandID,
			DemandType:  "cargo_demand",
			SupplyID:    drone.ID,
			SupplyType:  "drone",
			MatchScore:  score,
			MatchReason: model.JSON(reasonJSON),
			Status:      "recommended",
		})
	}

	sortByScore(records)
	if len(records) > 10 {
		records = records[:10]
	}

	if err := s.matchingRepo.BatchCreate(records); err != nil {
		return nil, err
	}
	s.writeMatchingLog("cargo_demand", demandID, "recommend_owner", records, radiusKM)

	return records, nil
}

func (s *MatchingService) GetMatches(demandID int64, demandType string) ([]model.MatchingRecord, error) {
	return s.matchingRepo.GetByDemand(demandID, demandType)
}

func (s *MatchingService) MarkViewed(matchID int64) error {
	return s.matchingRepo.UpdateStatus(matchID, "viewed")
}

func (s *MatchingService) RecommendDemandsForOwner(ownerUserID int64, page, pageSize int) ([]model.Demand, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, nil
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	demands, err := s.demandDomainRepo.ListOpenDemands(200)
	if err != nil {
		return nil, 0, err
	}
	if len(demands) == 0 {
		return []model.Demand{}, 0, nil
	}

	supplies, err := s.ownerDomainRepo.ListActiveSuppliesByOwner(ownerUserID)
	if err != nil {
		return nil, 0, err
	}

	scored := make([]DemandRecommendation, 0, len(demands))
	for _, demand := range demands {
		score, supplyID, breakdown := s.scoreDemandForOwner(ownerUserID, &demand, supplies)
		if score <= 0 {
			continue
		}
		riskLevel, riskSummary := s.buildDemandRiskSummary(&demand)
		scored = append(scored, DemandRecommendation{
			Demand:              demand,
			RecommendScore:      score,
			RiskLevel:           riskLevel,
			RiskSummary:         riskSummary,
			RecommendedSupplyID: supplyID,
			ScoreBreakdown:      breakdown,
		})
	}

	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].RecommendScore == scored[j].RecommendScore {
			return scored[i].Demand.CreatedAt.After(scored[j].Demand.CreatedAt)
		}
		return scored[i].RecommendScore > scored[j].RecommendScore
	})

	total := len(scored)
	start := (page - 1) * pageSize
	if start >= total {
		return []model.Demand{}, int64(total), nil
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	selected := make([]model.Demand, 0, end-start)
	for _, item := range scored[start:end] {
		selected = append(selected, item.Demand)
		s.writeDemandDomainLog(item.Demand.ID, "system", "recommend_owner", map[string]interface{}{
			"owner_user_id":          ownerUserID,
			"demand_id":              item.Demand.ID,
			"demand_no":              item.Demand.DemandNo,
			"recommend_score":        item.RecommendScore,
			"recommended_supply_id":  item.RecommendedSupplyID,
			"risk_level":             item.RiskLevel,
			"risk_summary":           item.RiskSummary,
			"score_breakdown":        item.ScoreBreakdown,
			"candidate_pilot_opened": item.Demand.AllowsPilotCandidate,
		})
	}

	return selected, int64(total), nil
}

func (s *MatchingService) SyncDemandQuoteRanking(demandID int64, actorType string, actorUserID int64) error {
	if s.demandDomainRepo == nil || demandID == 0 {
		return nil
	}

	demand, err := s.demandDomainRepo.GetDemandByID(demandID)
	if err != nil {
		return err
	}
	quotes, err := s.demandDomainRepo.ListDemandQuotes(demandID)
	if err != nil {
		return err
	}

	type rankedQuote struct {
		ID          int64
		OwnerUserID int64
		DroneID     int64
		PriceAmount int64
		Status      string
	}

	ranked := make([]rankedQuote, 0, len(quotes))
	for _, quote := range quotes {
		ranked = append(ranked, rankedQuote{
			ID:          quote.ID,
			OwnerUserID: quote.OwnerUserID,
			DroneID:     quote.DroneID,
			PriceAmount: quote.PriceAmount,
			Status:      quote.Status,
		})
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		if quoteStatusPriority(ranked[i].Status) == quoteStatusPriority(ranked[j].Status) {
			if ranked[i].PriceAmount == ranked[j].PriceAmount {
				return ranked[i].ID < ranked[j].ID
			}
			return ranked[i].PriceAmount < ranked[j].PriceAmount
		}
		return quoteStatusPriority(ranked[i].Status) < quoteStatusPriority(ranked[j].Status)
	})

	items := make([]map[string]interface{}, 0, len(ranked))
	for index, quote := range ranked {
		items = append(items, map[string]interface{}{
			"rank":          index + 1,
			"quote_id":      quote.ID,
			"owner_user_id": quote.OwnerUserID,
			"drone_id":      quote.DroneID,
			"price_amount":  quote.PriceAmount,
			"status":        quote.Status,
		})
	}

	s.writeDemandDomainLog(demand.ID, actorType, "quote_rank", map[string]interface{}{
		"actor_user_id":  actorUserID,
		"demand_status":  demand.Status,
		"quote_count":    len(quotes),
		"selected_quote": demand.SelectedQuoteID,
		"quotes":         items,
	})
	return nil
}

func (s *MatchingService) SyncDemandCandidatePool(demandID int64, actorType string, actorUserID int64) error {
	if s.demandDomainRepo == nil || demandID == 0 {
		return nil
	}

	demand, err := s.demandDomainRepo.GetDemandByID(demandID)
	if err != nil {
		return err
	}
	candidates, err := s.demandDomainRepo.ListDemandCandidates(demandID, nil)
	if err != nil {
		return err
	}

	items := make([]map[string]interface{}, 0, len(candidates))
	activeCount := 0
	for _, candidate := range candidates {
		if candidate.Status == "active" {
			activeCount++
		}
		items = append(items, map[string]interface{}{
			"candidate_id":  candidate.ID,
			"pilot_user_id": candidate.PilotUserID,
			"status":        candidate.Status,
			"created_at":    candidate.CreatedAt,
			"updated_at":    candidate.UpdatedAt,
		})
	}

	s.writeDemandDomainLog(demand.ID, actorType, "candidate_rank", map[string]interface{}{
		"actor_user_id":          actorUserID,
		"demand_status":          demand.Status,
		"allows_pilot_candidate": demand.AllowsPilotCandidate,
		"candidate_count":        len(candidates),
		"active_candidate_count": activeCount,
		"candidates":             items,
	})
	return nil
}

type MatchReason struct {
	Distance    float64 `json:"distance"`
	DistScore   int     `json:"dist_score"`
	PriceScore  int     `json:"price_score"`
	LoadScore   int     `json:"load_score"`
	RatingScore int     `json:"rating_score"`
}

func (s *MatchingService) calculateOfferScore(demand *model.RentalDemand, offer *model.RentalOffer) (int, MatchReason) {
	reason := MatchReason{}

	// Distance score (30%)
	dist := haversine(demand.Latitude, demand.Longitude, offer.Latitude, offer.Longitude)
	reason.Distance = dist
	reason.DistScore = int(math.Max(0, 30*(1-dist/50)))

	// Price score (20%)
	if demand.BudgetMax > 0 && offer.Price <= demand.BudgetMax && offer.Price >= demand.BudgetMin {
		mid := (demand.BudgetMin + demand.BudgetMax) / 2
		diff := math.Abs(float64(offer.Price - mid))
		maxDiff := float64(demand.BudgetMax-demand.BudgetMin) / 2
		if maxDiff > 0 {
			reason.PriceScore = int(20 * (1 - diff/maxDiff))
		} else {
			reason.PriceScore = 20
		}
	}

	// Rating score (5%)
	if offer.Drone != nil {
		reason.RatingScore = int(offer.Drone.Rating)
	}

	total := reason.DistScore + reason.PriceScore + reason.RatingScore
	// Normalize to 0-100
	if total > 100 {
		total = 100
	}
	return total, reason
}

func (s *MatchingService) calculateDroneScore(demand *model.RentalDemand, drone *model.Drone) (int, MatchReason) {
	reason := MatchReason{}

	dist := haversine(demand.Latitude, demand.Longitude, drone.Latitude, drone.Longitude)
	reason.Distance = dist
	reason.DistScore = int(math.Max(0, 30*(1-dist/50)))

	// Load score (10%)
	if demand.RequiredLoad > 0 && drone.MaxLoad >= demand.RequiredLoad {
		reason.LoadScore = 10
	}

	// Price score (20%)
	if demand.BudgetMax > 0 && drone.DailyPrice <= demand.BudgetMax {
		reason.PriceScore = 20
	}

	// Rating (5%)
	reason.RatingScore = int(drone.Rating)

	total := reason.DistScore + reason.LoadScore + reason.PriceScore + reason.RatingScore
	if total > 100 {
		total = 100
	}
	return total, reason
}

func (s *MatchingService) calculateCargoScore(cargo *model.CargoDemand, drone *model.Drone) (int, MatchReason) {
	reason := MatchReason{}

	dist := haversine(cargo.PickupLatitude, cargo.PickupLongitude, drone.Latitude, drone.Longitude)
	reason.Distance = dist
	reason.DistScore = int(math.Max(0, 40*(1-dist/50)))

	if drone.MaxLoad >= cargo.CargoWeight {
		reason.LoadScore = 30
	} else if drone.MaxLoad >= cargo.CargoWeight*0.8 {
		reason.LoadScore = 15
	}

	deliveryDist := haversine(cargo.PickupLatitude, cargo.PickupLongitude, cargo.DeliveryLatitude, cargo.DeliveryLongitude)
	if drone.MaxDistance >= deliveryDist {
		reason.PriceScore = 20
	}

	reason.RatingScore = int(drone.Rating)

	total := reason.DistScore + reason.LoadScore + reason.PriceScore + reason.RatingScore
	if total > 100 {
		total = 100
	}
	return total, reason
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in km
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func sortByScore(records []model.MatchingRecord) {
	for i := 0; i < len(records); i++ {
		for j := i + 1; j < len(records); j++ {
			if records[j].MatchScore > records[i].MatchScore {
				records[i], records[j] = records[j], records[i]
			}
		}
	}
}

func (s *MatchingService) scoreDemandForOwner(ownerUserID int64, demand *model.Demand, supplies []model.OwnerSupply) (int, int64, map[string]interface{}) {
	if demand == nil {
		return 0, 0, map[string]interface{}{}
	}

	demandCity := firstNonEmpty(extractAddressCity(demand.ServiceAddressSnapshot), extractAddressCity(demand.DepartureAddressSnapshot))
	bestScore := 0
	var bestSupplyID int64
	bestBreakdown := map[string]interface{}{
		"cargo_scene_score": 0,
		"city_score":        0,
		"capacity_score":    0,
		"budget_score":      0,
	}

	if len(supplies) == 0 {
		drones, _, err := s.droneRepo.ListByOwner(ownerUserID, 1, 50)
		if err != nil {
			return 0, 0, bestBreakdown
		}
		for _, drone := range drones {
			if !drone.EligibleForMarketplace() {
				continue
			}
			score, breakdown := s.scoreDemandAgainstDrone(demand, &drone, demandCity)
			if score > bestScore {
				bestScore = score
				bestBreakdown = breakdown
			}
		}
		return bestScore, 0, bestBreakdown
	}

	for _, supply := range supplies {
		if supply.Drone == nil || !supply.Drone.EligibleForMarketplace() {
			continue
		}
		score, breakdown := s.scoreDemandAgainstSupply(demand, &supply, demandCity)
		if score > bestScore {
			bestScore = score
			bestSupplyID = supply.ID
			bestBreakdown = breakdown
		}
	}

	return bestScore, bestSupplyID, bestBreakdown
}

func (s *MatchingService) scoreDemandAgainstSupply(demand *model.Demand, supply *model.OwnerSupply, demandCity string) (int, map[string]interface{}) {
	score := 0
	breakdown := map[string]interface{}{
		"cargo_scene_score": 0,
		"city_score":        0,
		"capacity_score":    0,
		"budget_score":      0,
	}

	if supply == nil || supply.Drone == nil || demand == nil {
		return score, breakdown
	}

	if cargoSceneMatched(demand.CargoScene, supply.CargoScenes) {
		breakdown["cargo_scene_score"] = 35
		score += 35
	}

	if demandCity != "" && strings.EqualFold(strings.TrimSpace(supply.Drone.City), demandCity) {
		breakdown["city_score"] = 25
		score += 25
	}

	if demand.CargoWeightKG <= 0 || supply.Drone.EffectivePayloadKG() >= demand.CargoWeightKG {
		breakdown["capacity_score"] = 25
		score += 25
	} else if supply.Drone.EffectivePayloadKG() >= demand.CargoWeightKG*0.8 {
		breakdown["capacity_score"] = 12
		score += 12
	}

	if demand.BudgetMax == 0 || supply.BasePriceAmount == 0 || supply.BasePriceAmount <= demand.BudgetMax {
		breakdown["budget_score"] = 15
		score += 15
	}

	return score, breakdown
}

func (s *MatchingService) scoreDemandAgainstDrone(demand *model.Demand, drone *model.Drone, demandCity string) (int, map[string]interface{}) {
	score := 0
	breakdown := map[string]interface{}{
		"cargo_scene_score": 10,
		"city_score":        0,
		"capacity_score":    0,
		"budget_score":      0,
	}

	if demand == nil || drone == nil {
		return score, breakdown
	}

	score += 10
	if demandCity != "" && strings.EqualFold(strings.TrimSpace(drone.City), demandCity) {
		breakdown["city_score"] = 25
		score += 25
	}
	if demand.CargoWeightKG <= 0 || drone.EffectivePayloadKG() >= demand.CargoWeightKG {
		breakdown["capacity_score"] = 40
		score += 40
	} else if drone.EffectivePayloadKG() >= demand.CargoWeightKG*0.8 {
		breakdown["capacity_score"] = 20
		score += 20
	}
	if demand.BudgetMax == 0 || drone.DailyPrice == 0 || drone.DailyPrice <= demand.BudgetMax {
		breakdown["budget_score"] = 25
		score += 25
	}
	return score, breakdown
}

func (s *MatchingService) buildDemandRiskSummary(demand *model.Demand) (string, map[string]interface{}) {
	summary := map[string]interface{}{
		"client_user_id":        0,
		"client_type":           "unknown",
		"verification_status":   "unknown",
		"enterprise_verified":   "unknown",
		"platform_credit_score": 0,
		"status":                "unknown",
	}
	if demand == nil || s.clientRepo == nil {
		return "unknown", summary
	}

	client, err := s.clientRepo.GetByUserID(demand.ClientUserID)
	if err != nil || client == nil {
		summary["client_user_id"] = demand.ClientUserID
		return "medium", summary
	}

	summary["client_user_id"] = client.UserID
	summary["client_type"] = client.ClientType
	summary["verification_status"] = client.VerificationStatus
	summary["enterprise_verified"] = client.EnterpriseVerified
	summary["platform_credit_score"] = client.PlatformCreditScore
	summary["status"] = client.Status

	riskLevel := "medium"
	if client.Status != "active" || client.PlatformCreditScore < 400 {
		riskLevel = "high"
	} else if client.PlatformCreditScore >= 650 &&
		(client.VerificationStatus == "verified" || client.EnterpriseVerified == "verified") {
		riskLevel = "low"
	}
	return riskLevel, summary
}

func (s *MatchingService) writeDemandDomainLog(demandID int64, actorType, actionType string, snapshot map[string]interface{}) {
	if s.demandDomainRepo == nil {
		return
	}
	if actorType == "" {
		actorType = "system"
	}

	log := &model.MatchingLog{
		DemandID:       demandID,
		ActorType:      actorType,
		ActionType:     actionType,
		ResultSnapshot: mustMarshalMatchingJSON(snapshot),
	}
	if err := s.demandDomainRepo.CreateMatchingLog(log); err != nil && s.logger != nil {
		s.logger.Warn("write demand domain matching log failed", zap.Int64("demand_id", demandID), zap.String("action_type", actionType), zap.Error(err))
	}
}

func mustMarshalMatchingJSON(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}

func extractAddressCity(raw model.JSON) string {
	if len(raw) == 0 {
		return ""
	}
	var payload struct {
		City string `json:"city"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	if payload.City != "" {
		return strings.TrimSpace(payload.City)
	}
	return ""
}

func cargoSceneMatched(scene string, raw model.JSON) bool {
	scene = strings.TrimSpace(scene)
	if scene == "" {
		return true
	}
	var scenes []string
	if err := json.Unmarshal(raw, &scenes); err != nil {
		return false
	}
	for _, item := range scenes {
		if strings.TrimSpace(item) == scene || strings.TrimSpace(item) == "other_heavy_lift" {
			return true
		}
	}
	return false
}

func quoteStatusPriority(status string) int {
	switch status {
	case "selected":
		return 0
	case "submitted":
		return 1
	case "withdrawn":
		return 2
	case "rejected":
		return 3
	case "expired":
		return 4
	default:
		return 9
	}
}

func (s *MatchingService) writeMatchingLog(legacyDemandType string, legacyDemandID int64, actionType string, records []model.MatchingRecord, radiusKM float64) {
	if s.demandDomainRepo == nil {
		return
	}

	demandID, err := s.demandDomainRepo.ResolveDemandIDByLegacy(legacyDemandType, legacyDemandID)
	if err != nil || demandID == 0 {
		return
	}

	log := &model.MatchingLog{
		DemandID:       demandID,
		ActorType:      "system",
		ActionType:     actionType,
		ResultSnapshot: repository.BuildMatchingLogSnapshot(records, radiusKM, legacyDemandType, legacyDemandID),
	}
	if err := s.demandDomainRepo.CreateMatchingLog(log); err != nil && s.logger != nil {
		s.logger.Warn("write matching log failed", zap.Int64("legacy_demand_id", legacyDemandID), zap.Error(err))
	}
}
