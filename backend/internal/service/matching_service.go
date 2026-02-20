package service

import (
	"encoding/json"
	"math"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type MatchingService struct {
	matchingRepo *repository.MatchingRepo
	demandRepo   *repository.DemandRepo
	droneRepo    *repository.DroneRepo
	logger       *zap.Logger
}

func NewMatchingService(matchingRepo *repository.MatchingRepo, demandRepo *repository.DemandRepo, droneRepo *repository.DroneRepo, logger *zap.Logger) *MatchingService {
	return &MatchingService{matchingRepo: matchingRepo, demandRepo: demandRepo, droneRepo: droneRepo, logger: logger}
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
	s.matchingRepo.DeleteByDemand(demandID, "rental_demand")

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

	s.matchingRepo.DeleteByDemand(demandID, "cargo_demand")

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

	return records, nil
}

func (s *MatchingService) GetMatches(demandID int64, demandType string) ([]model.MatchingRecord, error) {
	return s.matchingRepo.GetByDemand(demandID, demandType)
}

func (s *MatchingService) MarkViewed(matchID int64) error {
	return s.matchingRepo.UpdateStatus(matchID, "viewed")
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
