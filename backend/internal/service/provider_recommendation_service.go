package service

import (
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"

	"gorm.io/gorm"
)

type ProviderRecommendationService struct {
	repo *repository.ProviderRecommendationRepo
}

func NewProviderRecommendationService(repo *repository.ProviderRecommendationRepo) *ProviderRecommendationService {
	return &ProviderRecommendationService{repo: repo}
}

type ProviderRecommendationQuery struct {
	ClientUserID    int64
	DemandID        int64
	OriginLatitude  float64
	OriginLongitude float64
	CargoScene      string
	CargoWeightKG   float64
	Keyword         string
}

type ProviderRecommendation struct {
	ProviderUserID            int64     `json:"provider_user_id"`
	ProviderName              string    `json:"provider_name"`
	AvatarURL                 string    `json:"avatar_url"`
	ServiceCity               string    `json:"service_city"`
	Intro                     string    `json:"intro"`
	DroneID                   int64     `json:"drone_id"`
	DroneLabel                string    `json:"drone_label"`
	DroneCount                int       `json:"drone_count"`
	MaxPayloadKG              float64   `json:"max_payload_kg"`
	ServiceRadiusKM           float64   `json:"service_radius_km"`
	DistanceKM                *float64  `json:"distance_km,omitempty"`
	MatchedScenes             []string  `json:"matched_scenes"`
	Rating                    *float64  `json:"rating,omitempty"`
	RatingCount               int       `json:"rating_count"`
	CompletedOrders30D        int       `json:"completed_orders_30d"`
	AverageResponseSeconds    int       `json:"average_response_seconds"`
	HasPreviousCooperation    bool      `json:"has_previous_cooperation"`
	Score                     int       `json:"score"`
	ScoreReasons              []string  `json:"score_reasons"`
	LastRecommendationInputAt time.Time `json:"last_recommendation_input_at"`
	InvitationID              int64     `json:"invitation_id,omitempty"`
	InvitationStatus          string    `json:"invitation_status,omitempty"`
}

type ProviderInviteInput struct {
	ProviderUserID int64  `json:"provider_user_id"`
	Message        string `json:"message"`
}

type ProviderInviteResult struct {
	ID             int64     `json:"id"`
	DemandID       int64     `json:"demand_id"`
	ClientUserID   int64     `json:"client_user_id"`
	ProviderUserID int64     `json:"provider_user_id"`
	Status         string    `json:"status"`
	Message        string    `json:"message"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (s *ProviderRecommendationService) InviteProvider(clientUserID, demandID int64, input ProviderInviteInput) (*ProviderInviteResult, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("服务商推荐服务未初始化")
	}
	if clientUserID <= 0 {
		return nil, errors.New("客户用户不能为空")
	}
	if demandID <= 0 {
		return nil, errors.New("需求不能为空")
	}
	if input.ProviderUserID <= 0 {
		return nil, errors.New("服务商不能为空")
	}

	db := s.repo.DB()
	if db == nil {
		return nil, errors.New("服务商推荐数据库未初始化")
	}

	var result *model.DemandProviderInvitation
	err := db.Transaction(func(tx *gorm.DB) error {
		repo := repository.NewProviderRecommendationRepo(tx)
		demand, err := repo.LockDemandByID(demandID)
		if err != nil {
			return errors.New("需求不存在")
		}
		if demand.ClientUserID != clientUserID {
			return errors.New("无权邀请服务商处理该需求")
		}
		if !canInviteProviderForDemand(demand) {
			return errors.New("当前需求状态不允许邀请服务商")
		}

		canInvite, err := repo.ProviderCanReceiveInvitation(input.ProviderUserID)
		if err != nil {
			return err
		}
		if !canInvite {
			return errors.New("服务商暂不满足邀请报价条件")
		}

		existing, err := repo.GetDemandProviderInvitation(demandID, input.ProviderUserID)
		if err == nil && existing != nil {
			if isInactiveProviderInvitationStatus(existing.Status) {
				if err := repo.UpdateDemandProviderInvitationFields(existing.ID, map[string]interface{}{
					"client_user_id": clientUserID,
					"status":         model.DemandProviderInvitationStatusPendingQuote,
					"message":        strings.TrimSpace(input.Message),
					"updated_at":     time.Now(),
				}); err != nil {
					return err
				}
				reopened, err := repo.GetDemandProviderInvitationByID(existing.ID)
				if err != nil {
					return err
				}
				result = reopened
				return nil
			}
			result = existing
			return nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		invitation := &model.DemandProviderInvitation{
			DemandID:       demand.ID,
			ClientUserID:   clientUserID,
			ProviderUserID: input.ProviderUserID,
			Status:         model.DemandProviderInvitationStatusPendingQuote,
			Message:        strings.TrimSpace(input.Message),
		}
		if err := repo.CreateDemandProviderInvitation(invitation); err != nil {
			return err
		}
		result = invitation
		return nil
	})
	if err != nil {
		return nil, err
	}
	return buildProviderInviteResult(result), nil
}

func (s *ProviderRecommendationService) MarkInvitationQuoted(demandID, providerUserID int64) error {
	if s == nil || s.repo == nil {
		return errors.New("服务商推荐服务未初始化")
	}
	return s.repo.MarkInvitationQuoted(demandID, providerUserID)
}

func (s *ProviderRecommendationService) ListRecommendations(query ProviderRecommendationQuery, page int, pageSize int) ([]ProviderRecommendation, int64, error) {
	candidates, err := s.repo.ListProviderCandidates(query.ClientUserID, time.Now().AddDate(0, 0, -30))
	if err != nil {
		return nil, 0, err
	}

	hasOrigin := recommendationValidCoordinate(query.OriginLatitude, query.OriginLongitude)
	invitationsByProvider := map[int64]model.DemandProviderInvitation{}
	if query.DemandID > 0 {
		invitationsByProvider, err = s.repo.ListDemandProviderInvitations(query.DemandID)
		if err != nil {
			return nil, 0, err
		}
	}
	results := make([]ProviderRecommendation, 0, len(candidates))
	for _, candidate := range candidates {
		recommendation, ok := s.buildRecommendation(candidate, query, hasOrigin)
		if !ok {
			continue
		}
		if invitation, ok := invitationsByProvider[recommendation.ProviderUserID]; ok {
			recommendation.InvitationID = invitation.ID
			recommendation.InvitationStatus = invitation.Status
		}
		if query.Keyword != "" && !matchesProviderKeyword(recommendation, candidate, query.Keyword) {
			continue
		}
		results = append(results, recommendation)
	}

	sort.SliceStable(results, func(i, j int) bool {
		if results[i].Score != results[j].Score {
			return results[i].Score > results[j].Score
		}
		if distanceLess(results[i].DistanceKM, results[j].DistanceKM) {
			return true
		}
		if distanceLess(results[j].DistanceKM, results[i].DistanceKM) {
			return false
		}
		if !results[i].LastRecommendationInputAt.Equal(results[j].LastRecommendationInputAt) {
			return results[i].LastRecommendationInputAt.After(results[j].LastRecommendationInputAt)
		}
		return results[i].ProviderUserID < results[j].ProviderUserID
	})

	total := int64(len(results))
	page, pageSize = normalizeRecommendationPagination(page, pageSize)
	start := (page - 1) * pageSize
	if start >= len(results) {
		return []ProviderRecommendation{}, total, nil
	}
	end := start + pageSize
	if end > len(results) {
		end = len(results)
	}
	return results[start:end], total, nil
}

func canInviteProviderForDemand(demand *model.Demand) bool {
	if demand == nil {
		return false
	}
	if demand.ExpiresAt != nil && demand.ExpiresAt.Before(time.Now()) {
		return false
	}
	switch strings.TrimSpace(demand.Status) {
	case "", "draft", "published", "quoting":
		return true
	default:
		return false
	}
}

func isInactiveProviderInvitationStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case model.DemandProviderInvitationStatusDeclined, model.DemandProviderInvitationStatusExpired:
		return true
	default:
		return false
	}
}

func buildProviderInviteResult(invitation *model.DemandProviderInvitation) *ProviderInviteResult {
	if invitation == nil {
		return nil
	}
	return &ProviderInviteResult{
		ID:             invitation.ID,
		DemandID:       invitation.DemandID,
		ClientUserID:   invitation.ClientUserID,
		ProviderUserID: invitation.ProviderUserID,
		Status:         invitation.Status,
		Message:        invitation.Message,
		CreatedAt:      invitation.CreatedAt,
		UpdatedAt:      invitation.UpdatedAt,
	}
}

func (s *ProviderRecommendationService) buildRecommendation(candidate repository.ProviderRecommendationCandidate, query ProviderRecommendationQuery, hasOrigin bool) (ProviderRecommendation, bool) {
	bestDrone, distanceKM, radiusKM, ok := bestEligibleDrone(candidate, query, hasOrigin)
	if !ok {
		return ProviderRecommendation{}, false
	}

	candidateScenes := providerScenes(candidate.Supplies)
	matchedScenes, sceneOK := matchScenes(strings.TrimSpace(query.CargoScene), candidateScenes)
	if !sceneOK {
		return ProviderRecommendation{}, false
	}

	rating := (*float64)(nil)
	if candidate.RatingCount > 0 {
		value := math.Round(candidate.Rating*10) / 10
		rating = &value
	}
	score, reasons := scoreProvider(candidate, bestDrone, query, distanceKM, radiusKM, matchedScenes)
	name := strings.TrimSpace(candidate.User.Nickname)
	if name == "" {
		name = candidate.User.Phone
	}

	return ProviderRecommendation{
		ProviderUserID:            candidate.User.ID,
		ProviderName:              name,
		AvatarURL:                 candidate.User.AvatarURL,
		ServiceCity:               candidate.OwnerProfile.ServiceCity,
		Intro:                     candidate.OwnerProfile.Intro,
		DroneID:                   bestDrone.ID,
		DroneLabel:                strings.TrimSpace(bestDrone.Brand + " " + bestDrone.Model),
		DroneCount:                eligibleDroneCount(candidate.Drones),
		MaxPayloadKG:              bestDrone.EffectivePayloadKG(),
		ServiceRadiusKM:           radiusKM,
		DistanceKM:                distanceKM,
		MatchedScenes:             matchedScenes,
		Rating:                    rating,
		RatingCount:               candidate.RatingCount,
		CompletedOrders30D:        candidate.CompletedOrders30D,
		AverageResponseSeconds:    candidate.AverageResponseSeconds,
		HasPreviousCooperation:    candidate.HasPreviousCooperation,
		Score:                     score,
		ScoreReasons:              reasons,
		LastRecommendationInputAt: candidate.LastActivityAt,
	}, true
}

func bestEligibleDrone(candidate repository.ProviderRecommendationCandidate, query ProviderRecommendationQuery, hasOrigin bool) (model.Drone, *float64, float64, bool) {
	var best model.Drone
	var bestDistance *float64
	bestRadius := 0.0
	bestRank := math.Inf(-1)

	for _, drone := range candidate.Drones {
		drone := drone
		if !drone.EligibleForMarketplace() {
			continue
		}
		payload := drone.EffectivePayloadKG()
		if query.CargoWeightKG > 0 && payload < query.CargoWeightKG {
			continue
		}

		radius := serviceRadiusForDrone(candidate.Supplies, drone)
		var distance *float64
		if hasOrigin {
			if !recommendationValidCoordinate(drone.Latitude, drone.Longitude) || radius <= 0 {
				continue
			}
			value := recommendationHaversineKM(query.OriginLatitude, query.OriginLongitude, drone.Latitude, drone.Longitude)
			if value > radius {
				continue
			}
			distance = &value
		}

		rank := payload
		if distance != nil {
			rank += math.Max(0, radius-*distance)
		}
		if rank > bestRank {
			best = drone
			bestDistance = distance
			bestRadius = radius
			bestRank = rank
		}
	}
	if best.ID == 0 {
		return model.Drone{}, nil, 0, false
	}
	return best, bestDistance, bestRadius, true
}

func serviceRadiusForDrone(supplies []model.OwnerSupply, drone model.Drone) float64 {
	radius := 0.0
	for _, supply := range supplies {
		if supply.DroneID != 0 && supply.DroneID != drone.ID {
			continue
		}
		if supply.MaxRangeKM > radius {
			radius = supply.MaxRangeKM
		}
	}
	if radius <= 0 {
		radius = drone.MaxDistance
	}
	return radius
}

func providerScenes(supplies []model.OwnerSupply) []string {
	seen := map[string]struct{}{}
	scenes := make([]string, 0)
	for _, supply := range supplies {
		for _, scene := range jsonStringArray(supply.CargoScenes) {
			scene = strings.TrimSpace(scene)
			if scene == "" {
				continue
			}
			if _, exists := seen[scene]; exists {
				continue
			}
			seen[scene] = struct{}{}
			scenes = append(scenes, scene)
		}
	}
	sort.Strings(scenes)
	return scenes
}

func matchScenes(cargoScene string, scenes []string) ([]string, bool) {
	if cargoScene == "" {
		return scenes, true
	}
	if len(scenes) == 0 {
		return []string{}, true
	}
	matched := make([]string, 0, 1)
	for _, scene := range scenes {
		if scene == cargoScene || scene == "other_heavy_lift" {
			matched = append(matched, scene)
		}
	}
	return matched, len(matched) > 0
}

func scoreProvider(candidate repository.ProviderRecommendationCandidate, drone model.Drone, query ProviderRecommendationQuery, distanceKM *float64, radiusKM float64, matchedScenes []string) (int, []string) {
	score := 0
	reasons := make([]string, 0, 6)

	if distanceKM != nil && radiusKM > 0 {
		distanceScore := int(math.Round(30 * math.Max(0, 1-(*distanceKM/radiusKM))))
		score += distanceScore
		reasons = append(reasons, "距离在服务半径内")
	}
	if strings.TrimSpace(query.CargoScene) != "" && len(matchedScenes) > 0 {
		score += 20
		reasons = append(reasons, "匹配作业场景")
	}
	if query.CargoWeightKG > 0 {
		ratio := drone.EffectivePayloadKG() / query.CargoWeightKG
		payloadScore := int(math.Round(math.Min(20, math.Max(10, 10+(ratio-1)*10))))
		score += payloadScore
		reasons = append(reasons, "认证无人机载重覆盖")
	} else {
		score += 10
		reasons = append(reasons, "认证无人机可用")
	}
	if candidate.RatingCount > 0 {
		score += int(math.Round(candidate.Rating / 5 * 15))
		reasons = append(reasons, "已有客户评分")
	}
	if candidate.CompletedOrders30D > 0 {
		score += minInt(candidate.CompletedOrders30D*2, 10)
		reasons = append(reasons, "近30天有完单")
	}
	if candidate.ResponseSampleCount > 0 {
		switch {
		case candidate.AverageResponseSeconds <= 15*60:
			score += 10
		case candidate.AverageResponseSeconds <= 30*60:
			score += 7
		case candidate.AverageResponseSeconds <= 60*60:
			score += 5
		default:
			score += 2
		}
		reasons = append(reasons, "历史响应速度可参考")
	}
	if candidate.HasPreviousCooperation {
		score += 8
		reasons = append(reasons, "曾与客户合作")
	}
	return score, reasons
}

func eligibleDroneCount(drones []model.Drone) int {
	count := 0
	for _, drone := range drones {
		drone := drone
		if drone.EligibleForMarketplace() {
			count++
		}
	}
	return count
}

func jsonStringArray(raw model.JSON) []string {
	if len(raw) == 0 {
		return nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil
	}
	return values
}

func matchesProviderKeyword(recommendation ProviderRecommendation, candidate repository.ProviderRecommendationCandidate, keyword string) bool {
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	if keyword == "" {
		return true
	}
	fields := []string{
		recommendation.ProviderName,
		recommendation.ServiceCity,
		candidate.User.Phone,
		candidate.OwnerProfile.ContactPhone,
	}
	for _, field := range fields {
		if strings.Contains(strings.ToLower(field), keyword) {
			return true
		}
	}
	return false
}

func recommendationValidCoordinate(lat float64, lng float64) bool {
	if lat == 0 && lng == 0 {
		return false
	}
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

func recommendationHaversineKM(lat1 float64, lng1 float64, lat2 float64, lng2 float64) float64 {
	const earthRadiusKM = 6371.0
	toRadians := func(degrees float64) float64 {
		return degrees * math.Pi / 180
	}
	dLat := toRadians(lat2 - lat1)
	dLng := toRadians(lng2 - lng1)
	rLat1 := toRadians(lat1)
	rLat2 := toRadians(lat2)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rLat1)*math.Cos(rLat2)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return earthRadiusKM * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func normalizeRecommendationPagination(page int, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func distanceLess(a *float64, b *float64) bool {
	if a == nil && b == nil {
		return false
	}
	if a == nil {
		return false
	}
	if b == nil {
		return true
	}
	return *a < *b
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}
