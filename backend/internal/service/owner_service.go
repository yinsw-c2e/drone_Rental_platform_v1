package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type OwnerService struct {
	userRepo         *repository.UserRepo
	droneRepo        *repository.DroneRepo
	pilotRepo        *repository.PilotRepo
	roleProfileRepo  *repository.RoleProfileRepo
	ownerDomainRepo  *repository.OwnerDomainRepo
	demandDomainRepo *repository.DemandDomainRepo
	orderService     *OrderService
	matchingService  *MatchingService
	eventService     *EventService
}

type RecommendedDemandQuery struct {
	ServiceType string
	Region      string
	CargoScene  string
	MinWeightKG float64
	MaxWeightKG float64
	StartFrom   *time.Time
	StartTo     *time.Time
	Sort        string
}

type RecommendedDemandMetric struct {
	DistanceKM            *float64
	ServiceRangeKM        *float64
	ServiceCoverageStatus string
	EstimatedArrivalMin   *int
	MatchedSupplyID       int64
	MatchedDroneID        int64
	MatchedSupplyTitle    string
}

func (q RecommendedDemandQuery) IsZero() bool {
	serviceType := strings.TrimSpace(q.ServiceType)
	return (serviceType == "" || serviceType == defaultDemandServiceType) &&
		strings.TrimSpace(q.Region) == "" &&
		strings.TrimSpace(q.CargoScene) == "" &&
		q.MinWeightKG <= 0 &&
		q.MaxWeightKG <= 0 &&
		q.StartFrom == nil &&
		q.StartTo == nil &&
		strings.TrimSpace(q.Sort) == ""
}

func (q RecommendedDemandQuery) repoQuery() repository.RecommendedDemandQuery {
	return repository.RecommendedDemandQuery{
		ServiceType: strings.TrimSpace(q.ServiceType),
		Region:      strings.TrimSpace(q.Region),
		CargoScene:  strings.TrimSpace(q.CargoScene),
		MinWeightKG: q.MinWeightKG,
		MaxWeightKG: q.MaxWeightKG,
		StartFrom:   q.StartFrom,
		StartTo:     q.StartTo,
		Sort:        strings.TrimSpace(q.Sort),
	}
}

type OwnerProfileInput struct {
	ServiceCity  string `json:"service_city"`
	ContactPhone string `json:"contact_phone"`
	Intro        string `json:"intro"`
}

type OwnerWorkbenchSummary struct {
	RecommendedDemandCount                int64 `json:"recommended_demand_count"`
	PendingQuoteCount                     int64 `json:"pending_quote_count"`
	PendingProviderConfirmationOrderCount int64 `json:"pending_provider_confirmation_order_count"`
	PendingDispatchOrderCount             int64 `json:"pending_dispatch_order_count"`
	DraftSupplyCount                      int64 `json:"draft_supply_count"`
}

type OwnerWorkbenchDemandItem struct {
	ID                  int64      `json:"id"`
	DemandNo            string     `json:"demand_no"`
	Title               string     `json:"title"`
	Status              string     `json:"status"`
	ServiceAddressText  string     `json:"service_address_text"`
	ScheduledStartAt    *time.Time `json:"scheduled_start_at,omitempty"`
	ScheduledEndAt      *time.Time `json:"scheduled_end_at,omitempty"`
	BudgetMin           int64      `json:"budget_min"`
	BudgetMax           int64      `json:"budget_max"`
	QuoteCount          int64      `json:"quote_count"`
	CandidatePilotCount int64      `json:"candidate_pilot_count"`
}

type OwnerWorkbenchOrderItem struct {
	ID             int64     `json:"id"`
	OrderNo        string    `json:"order_no"`
	Title          string    `json:"title"`
	Status         string    `json:"status"`
	OrderSource    string    `json:"order_source"`
	ServiceAddress string    `json:"service_address"`
	DestAddress    string    `json:"dest_address"`
	TotalAmount    int64     `json:"total_amount"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type OwnerWorkbenchSupplyItem struct {
	ID                    int64     `json:"id"`
	SupplyNo              string    `json:"supply_no"`
	Title                 string    `json:"title"`
	Status                string    `json:"status"`
	DroneID               int64     `json:"drone_id"`
	BasePriceAmount       int64     `json:"base_price_amount"`
	PricingUnit           string    `json:"pricing_unit"`
	UpdatedAt             time.Time `json:"updated_at"`
	DroneBrand            string    `json:"drone_brand,omitempty"`
	DroneModel            string    `json:"drone_model,omitempty"`
	CertificationStatus   string    `json:"certification_status,omitempty"`
	UOMVerified           string    `json:"uom_verified,omitempty"`
	InsuranceVerified     string    `json:"insurance_verified,omitempty"`
	AirworthinessVerified string    `json:"airworthiness_verified,omitempty"`
}

type OwnerWorkbenchView struct {
	Summary                           OwnerWorkbenchSummary      `json:"summary"`
	RecommendedDemands                []OwnerWorkbenchDemandItem `json:"recommended_demands"`
	PendingProviderConfirmationOrders []OwnerWorkbenchOrderItem  `json:"pending_provider_confirmation_orders"`
	PendingDispatchOrders             []OwnerWorkbenchOrderItem  `json:"pending_dispatch_orders"`
	DraftSupplies                     []OwnerWorkbenchSupplyItem `json:"draft_supplies"`
}

func (s *OwnerService) SetMatchingService(matchingService *MatchingService) {
	s.matchingService = matchingService
}

func (s *OwnerService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

func (s *OwnerService) SetOrderService(orderService *OrderService) {
	s.orderService = orderService
}

type OwnerSupplyInput struct {
	DroneID            int64           `json:"drone_id"`
	Title              string          `json:"title"`
	Description        string          `json:"description"`
	ServiceTypes       []string        `json:"service_types"`
	CargoScenes        []string        `json:"cargo_scenes"`
	ServiceArea        json.RawMessage `json:"service_area_snapshot"`
	BasePriceAmount    int64           `json:"base_price_amount"`
	PricingUnit        string          `json:"pricing_unit"`
	PricingRule        json.RawMessage `json:"pricing_rule"`
	AvailableTimeSlots json.RawMessage `json:"available_time_slots"`
	AcceptsDirectOrder *bool           `json:"accepts_direct_order"`
	Status             string          `json:"status"`
}

type CreateQuoteInput struct {
	DroneID       int64  `json:"drone_id"`
	PriceAmount   int64  `json:"price_amount"`
	ExecutionPlan string `json:"execution_plan"`
}

const defaultBindingExpiryWindow = 24 * time.Hour

func NewOwnerService(
	userRepo *repository.UserRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	roleProfileRepo *repository.RoleProfileRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	demandDomainRepo *repository.DemandDomainRepo,
) *OwnerService {
	return &OwnerService{
		userRepo:         userRepo,
		droneRepo:        droneRepo,
		pilotRepo:        pilotRepo,
		roleProfileRepo:  roleProfileRepo,
		ownerDomainRepo:  ownerDomainRepo,
		demandDomainRepo: demandDomainRepo,
	}
}

func (s *OwnerService) providerRoleSummary(userID int64) (ProviderRoleSummary, error) {
	if s.userRepo == nil {
		return ProviderRoleSummary{}, errors.New("用户仓储未初始化")
	}
	if _, err := s.userRepo.GetByID(userID); err != nil {
		return ProviderRoleSummary{}, err
	}

	assetStatus := providerStatusNone
	executorStatus := providerStatusNone
	executorOnline := false

	if s.roleProfileRepo != nil {
		if ownerProfile, err := s.roleProfileRepo.GetOwnerProfileByUserID(userID); err == nil {
			assetStatus = combineProviderCapabilityStatus(assetStatus, ownerProfileStatus(ownerProfile))
		} else if err != nil && !isOptionalProviderLookupError(err) {
			return ProviderRoleSummary{}, err
		}

		if pilotProfile, err := s.roleProfileRepo.GetPilotProfileByUserID(userID); err == nil {
			executorStatus = combineProviderCapabilityStatus(executorStatus, statusFromVerification(pilotProfile.VerificationStatus))
		} else if err != nil && !isOptionalProviderLookupError(err) {
			return ProviderRoleSummary{}, err
		}
	}

	if s.droneRepo != nil {
		if total, err := s.droneRepo.CountByOwner(userID); err != nil {
			return ProviderRoleSummary{}, err
		} else if total > 0 {
			assetStatus = combineProviderCapabilityStatus(assetStatus, providerStatusPendingReview)
		}

		if total, err := s.droneRepo.CountMarketplaceEligibleByOwner(userID); err != nil {
			return ProviderRoleSummary{}, err
		} else if total > 0 {
			assetStatus = providerStatusApproved
		}
	}

	if s.pilotRepo != nil {
		pilot, err := s.pilotRepo.GetByUserID(userID)
		if err == nil && pilot != nil {
			executorStatus = combineProviderCapabilityStatus(executorStatus, statusFromVerification(pilot.VerificationStatus))
			executorOnline = strings.EqualFold(strings.TrimSpace(pilot.AvailabilityStatus), "online")
		} else if err != nil && !isOptionalProviderLookupError(err) {
			return ProviderRoleSummary{}, err
		}
	}

	return buildProviderRoleSummary(assetStatus, executorStatus, executorOnline), nil
}

func isOptionalProviderLookupError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "no such table")
}

func (s *OwnerService) ensureProviderQuoteAccess(userID int64) error {
	provider, err := s.providerRoleSummary(userID)
	if err != nil {
		return err
	}
	if !provider.CanQuote {
		return errors.New("无权进入服务商接单工作台，请先完成设备能力审核")
	}
	return nil
}

func (s *OwnerService) ensureProviderDispatchAccess(userID int64) error {
	provider, err := s.providerRoleSummary(userID)
	if err != nil {
		return err
	}
	if !provider.CanArrangeDispatch {
		return errors.New("无权管理协作执行人员，请先完成设备能力审核")
	}
	return nil
}

func (s *OwnerService) GetProfile(userID int64) (*model.OwnerProfile, error) {
	return s.ensureOwnerProfile(userID)
}

func (s *OwnerService) UpdateProfile(userID int64, input *OwnerProfileInput) (*model.OwnerProfile, error) {
	profile, err := s.ensureOwnerProfile(userID)
	if err != nil {
		return nil, err
	}
	if s.roleProfileRepo == nil || s.roleProfileRepo.DB() == nil {
		return nil, errors.New("服务商档案仓储未初始化")
	}

	if err := s.roleProfileRepo.DB().Model(&model.OwnerProfile{}).Where("id = ?", profile.ID).Updates(map[string]interface{}{
		"service_city":  strings.TrimSpace(input.ServiceCity),
		"contact_phone": strings.TrimSpace(input.ContactPhone),
		"intro":         strings.TrimSpace(input.Intro),
	}).Error; err != nil {
		return nil, err
	}
	return s.roleProfileRepo.GetOwnerProfileByUserID(userID)
}

func (s *OwnerService) ListMyDrones(ownerUserID int64, page, pageSize int) ([]model.Drone, int64, error) {
	return s.droneRepo.ListByOwner(ownerUserID, page, pageSize)
}

func (s *OwnerService) AdminListSupplies(page, pageSize int, filters map[string]interface{}) ([]model.OwnerSupply, int64, error) {
	if s.ownerDomainRepo == nil {
		return nil, 0, errors.New("服务商供给仓储未初始化")
	}
	return s.ownerDomainRepo.AdminListSupplies(page, pageSize, filters)
}

func (s *OwnerService) AdminGetSupply(id int64) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("服务商供给仓储未初始化")
	}
	return s.ownerDomainRepo.GetMarketplaceSupplyByID(id)
}

func (s *OwnerService) GetOwnedDrone(ownerUserID, droneID int64) (*model.Drone, error) {
	drone, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return nil, errors.New("无人机不存在")
	}
	if drone.OwnerID != ownerUserID {
		return nil, errors.New("无权查看该无人机")
	}
	return drone, nil
}

func (s *OwnerService) CreateSupply(ownerUserID int64, input *OwnerSupplyInput) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil || s.droneRepo == nil {
		return nil, errors.New("服务商供给依赖未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, err
	}
	if input == nil {
		return nil, errors.New("供给参数不能为空")
	}
	if _, err := s.ensureOwnerProfile(ownerUserID); err != nil {
		return nil, err
	}

	drone, err := s.GetOwnedDrone(ownerUserID, input.DroneID)
	if err != nil {
		return nil, err
	}
	supply, err := s.buildOwnerSupply(ownerUserID, drone, input)
	if err != nil {
		return nil, err
	}
	if err := s.ownerDomainRepo.CreateSupply(supply); err != nil {
		return nil, err
	}
	return supply, nil
}

func (s *OwnerService) ListMySupplies(ownerUserID int64, status string, page, pageSize int) ([]model.OwnerSupply, int64, error) {
	if s.ownerDomainRepo == nil {
		return nil, 0, errors.New("服务商供给仓储未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.ownerDomainRepo.ListSuppliesByOwner(ownerUserID, status, page, pageSize)
}

func (s *OwnerService) GetSupply(ownerUserID, supplyID int64) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("服务商供给仓储未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, err
	}
	supply, err := s.ownerDomainRepo.GetSupplyByIDAndOwner(supplyID, ownerUserID)
	if err != nil {
		return nil, errors.New("供给不存在")
	}
	return supply, nil
}

func (s *OwnerService) UpdateSupply(ownerUserID, supplyID int64, input *OwnerSupplyInput) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil || s.droneRepo == nil {
		return nil, errors.New("服务商供给依赖未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, err
	}
	if input == nil {
		return nil, errors.New("供给参数不能为空")
	}

	existing, err := s.ownerDomainRepo.GetSupplyByIDAndOwner(supplyID, ownerUserID)
	if err != nil {
		return nil, errors.New("供给不存在")
	}

	droneID := input.DroneID
	if droneID == 0 {
		droneID = existing.DroneID
	}
	drone, err := s.GetOwnedDrone(ownerUserID, droneID)
	if err != nil {
		return nil, err
	}

	normalizedInput := *input
	if strings.TrimSpace(normalizedInput.Status) == "" {
		normalizedInput.Status = existing.Status
	}

	supply, err := s.buildOwnerSupply(ownerUserID, drone, &normalizedInput)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{
		"drone_id":              supply.DroneID,
		"title":                 supply.Title,
		"description":           supply.Description,
		"service_types":         supply.ServiceTypes,
		"cargo_scenes":          supply.CargoScenes,
		"service_area_snapshot": supply.ServiceAreaSnapshot,
		"mtow_kg":               supply.MTOWKG,
		"max_payload_kg":        supply.MaxPayloadKG,
		"max_range_km":          supply.MaxRangeKM,
		"base_price_amount":     supply.BasePriceAmount,
		"pricing_unit":          supply.PricingUnit,
		"pricing_rule":          supply.PricingRule,
		"available_time_slots":  supply.AvailableTimeSlots,
		"accepts_direct_order":  supply.AcceptsDirectOrder,
		"status":                supply.Status,
		"updated_at":            time.Now(),
	}

	if err := s.ownerDomainRepo.UpdateSupplyFields(existing.ID, updates); err != nil {
		return nil, err
	}
	return s.ownerDomainRepo.GetSupplyByIDAndOwner(existing.ID, ownerUserID)
}

func (s *OwnerService) UpdateSupplyStatus(ownerUserID, supplyID int64, status string) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("服务商供给仓储未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, err
	}
	valid := map[string]bool{"draft": true, "active": true, "paused": true, "closed": true}
	if !valid[status] {
		return nil, errors.New("无效的供给状态")
	}

	supply, err := s.ownerDomainRepo.GetSupplyByIDAndOwner(supplyID, ownerUserID)
	if err != nil {
		return nil, errors.New("供给不存在")
	}
	if status == "active" {
		drone, err := s.droneRepo.GetByID(supply.DroneID)
		if err != nil {
			return nil, errors.New("关联无人机不存在")
		}
		if err := validateDroneForActiveSupply(drone); err != nil {
			return nil, err
		}
	}

	if err := s.ownerDomainRepo.UpdateSupplyFields(supplyID, map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}); err != nil {
		return nil, err
	}
	return s.ownerDomainRepo.GetSupplyByIDAndOwner(supplyID, ownerUserID)
}

func (s *OwnerService) ListRecommendedDemands(ownerUserID int64, page, pageSize int, query RecommendedDemandQuery) ([]model.Demand, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, errors.New("需求域仓储未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if s.matchingService != nil && query.IsZero() {
		return s.matchingService.RecommendDemandsForOwner(ownerUserID, page, pageSize)
	}
	if strings.TrimSpace(query.Sort) == "distance" {
		return s.listRecommendedDemandsByDistance(ownerUserID, page, pageSize, query)
	}
	return s.demandDomainRepo.ListRecommendedDemands(query.repoQuery(), page, pageSize)
}

func (s *OwnerService) listRecommendedDemandsByDistance(ownerUserID int64, page, pageSize int, query RecommendedDemandQuery) ([]model.Demand, int64, error) {
	scanSize := page * pageSize
	if scanSize < 200 {
		scanSize = 200
	}
	if scanSize > 1000 {
		scanSize = 1000
	}

	repoQuery := query
	repoQuery.Sort = "latest"
	demands, total, err := s.demandDomainRepo.ListRecommendedDemands(repoQuery.repoQuery(), 1, scanSize)
	if err != nil {
		return nil, 0, err
	}
	if total > int64(scanSize) && total <= 1000 {
		demands, total, err = s.demandDomainRepo.ListRecommendedDemands(repoQuery.repoQuery(), 1, int(total))
		if err != nil {
			return nil, 0, err
		}
	}

	metrics, err := s.GetRecommendedDemandMetrics(ownerUserID, demands)
	if err != nil {
		return nil, 0, err
	}
	filtered := make([]model.Demand, 0, len(demands))
	for i := range demands {
		metric, ok := metrics[demands[i].ID]
		if !ok || metric.DistanceKM == nil || metric.ServiceCoverageStatus != "in_range" {
			continue
		}
		filtered = append(filtered, demands[i])
	}
	demands = filtered
	total = int64(len(demands))
	sort.SliceStable(demands, func(i, j int) bool {
		left, leftOK := recommendedMetricDistance(metrics[demands[i].ID])
		right, rightOK := recommendedMetricDistance(metrics[demands[j].ID])
		if leftOK != rightOK {
			return leftOK
		}
		if leftOK && math.Abs(left-right) > 0.001 {
			return left < right
		}
		return demands[i].CreatedAt.After(demands[j].CreatedAt)
	})

	start := (page - 1) * pageSize
	if start >= len(demands) {
		return []model.Demand{}, total, nil
	}
	end := start + pageSize
	if end > len(demands) {
		end = len(demands)
	}
	return demands[start:end], total, nil
}

func recommendedMetricDistance(metric RecommendedDemandMetric) (float64, bool) {
	if metric.DistanceKM == nil || *metric.DistanceKM <= 0 {
		return 0, false
	}
	return *metric.DistanceKM, true
}

func (s *OwnerService) GetRecommendedDemandMetrics(ownerUserID int64, demands []model.Demand) (map[int64]RecommendedDemandMetric, error) {
	result := make(map[int64]RecommendedDemandMetric, len(demands))
	if len(demands) == 0 || s.ownerDomainRepo == nil {
		return result, nil
	}
	anchors, err := s.recommendedDemandAnchors(ownerUserID)
	if err != nil {
		return nil, err
	}
	if len(anchors) == 0 {
		return result, nil
	}

	for i := range demands {
		demandPoint, ok := ownerDemandPoint(&demands[i])
		if !ok {
			continue
		}
		var best RecommendedDemandMetric
		for j := range anchors {
			anchor := anchors[j]
			distance := ownerHaversineKM(demandPoint.lat, demandPoint.lng, anchor.point.lat, anchor.point.lng)
			if distance <= 0 {
				continue
			}
			serviceRange, hasRange := anchor.rangeKM, anchor.hasRange
			coverageStatus := ownerCoverageStatus(distance, serviceRange, hasRange)
			if shouldReplaceRecommendedMetric(best, distance, coverageStatus) {
				value := math.Round(distance*10) / 10
				best = RecommendedDemandMetric{
					DistanceKM:            &value,
					ServiceCoverageStatus: coverageStatus,
					MatchedSupplyID:       anchor.supplyID,
					MatchedSupplyTitle:    anchor.title,
				}
				if coverageStatus != "out_of_range" && anchor.drone != nil {
					if minutes, ok := ownerEstimatedArrivalMinutes(distance, anchor.drone); ok {
						best.EstimatedArrivalMin = &minutes
					}
				}
				if hasRange {
					rangeValue := math.Round(serviceRange*10) / 10
					best.ServiceRangeKM = &rangeValue
				}
				best.MatchedDroneID = anchor.droneID
			}
		}
		if best.DistanceKM != nil {
			result[demands[i].ID] = best
		}
	}
	return result, nil
}

type recommendedDemandAnchor struct {
	point    ownerGeoPoint
	rangeKM  float64
	hasRange bool
	supplyID int64
	droneID  int64
	title    string
	drone    *model.Drone
}

func (s *OwnerService) recommendedDemandAnchors(ownerUserID int64) ([]recommendedDemandAnchor, error) {
	supplies, err := s.ownerDomainRepo.ListActiveSuppliesByOwner(ownerUserID)
	if err != nil {
		return nil, err
	}
	anchors := make([]recommendedDemandAnchor, 0, len(supplies))
	for i := range supplies {
		point, ok := ownerSupplyPoint(&supplies[i])
		if !ok {
			continue
		}
		rangeKM, hasRange := ownerSupplyRangeKM(&supplies[i])
		anchor := recommendedDemandAnchor{
			point:    point,
			rangeKM:  rangeKM,
			hasRange: hasRange,
			supplyID: supplies[i].ID,
			title:    supplies[i].Title,
		}
		if supplies[i].Drone != nil {
			anchor.droneID = supplies[i].Drone.ID
			anchor.drone = supplies[i].Drone
		}
		anchors = append(anchors, anchor)
	}
	if len(anchors) > 0 || s.droneRepo == nil {
		return anchors, nil
	}

	drones, _, err := s.droneRepo.ListByOwner(ownerUserID, 1, 100)
	if err != nil {
		return nil, err
	}
	for i := range drones {
		if !drones[i].EligibleForMarketplace() || !ownerValidCoordinate(drones[i].Latitude, drones[i].Longitude) {
			continue
		}
		rangeKM := drones[i].MaxDistance
		title := strings.TrimSpace(strings.Join([]string{drones[i].Brand, drones[i].Model}, " "))
		anchors = append(anchors, recommendedDemandAnchor{
			point:    ownerGeoPoint{lat: drones[i].Latitude, lng: drones[i].Longitude},
			rangeKM:  rangeKM,
			hasRange: rangeKM > 0,
			droneID:  drones[i].ID,
			title:    title,
			drone:    &drones[i],
		})
	}
	return anchors, nil
}

func (s *OwnerService) ListLatestQuotesByDemandIDsAndOwner(demandIDs []int64, ownerUserID int64) (map[int64]*model.DemandQuote, error) {
	if s.demandDomainRepo == nil || len(demandIDs) == 0 || ownerUserID == 0 {
		return map[int64]*model.DemandQuote{}, nil
	}
	return s.demandDomainRepo.ListLatestQuotesByDemandIDsAndOwner(demandIDs, ownerUserID)
}

func shouldReplaceRecommendedMetric(current RecommendedDemandMetric, candidateDistance float64, candidateCoverage string) bool {
	if current.DistanceKM == nil {
		return true
	}
	currentPriority := ownerCoveragePriority(current.ServiceCoverageStatus)
	candidatePriority := ownerCoveragePriority(candidateCoverage)
	if candidatePriority != currentPriority {
		return candidatePriority < currentPriority
	}
	return candidateDistance < *current.DistanceKM
}

func ownerCoveragePriority(status string) int {
	switch status {
	case "in_range":
		return 0
	case "unknown":
		return 1
	case "out_of_range":
		return 2
	default:
		return 3
	}
}

func ownerCoverageStatus(distanceKM, serviceRangeKM float64, hasRange bool) string {
	if !hasRange || serviceRangeKM <= 0 {
		return "unknown"
	}
	if distanceKM <= serviceRangeKM {
		return "in_range"
	}
	return "out_of_range"
}

func ownerSupplyRangeKM(supply *model.OwnerSupply) (float64, bool) {
	if supply == nil {
		return 0, false
	}
	values := make([]float64, 0, 2)
	if supply.MaxRangeKM > 0 {
		values = append(values, supply.MaxRangeKM)
	}
	if supply.Drone != nil && supply.Drone.MaxDistance > 0 {
		values = append(values, supply.Drone.MaxDistance)
	}
	if len(values) == 0 {
		return 0, false
	}
	min := values[0]
	for _, value := range values[1:] {
		if value < min {
			min = value
		}
	}
	return min, true
}

func ownerEstimatedArrivalMinutes(distanceKM float64, drone *model.Drone) (int, bool) {
	if distanceKM <= 0 || drone == nil || drone.MaxDistance <= 0 || drone.MaxFlightTime <= 0 {
		return 0, false
	}
	minutes := int(math.Ceil(distanceKM / drone.MaxDistance * float64(drone.MaxFlightTime)))
	if minutes <= 0 {
		minutes = 1
	}
	return minutes, true
}

type ownerGeoPoint struct {
	lat float64
	lng float64
}

func ownerDemandPoint(demand *model.Demand) (ownerGeoPoint, bool) {
	if demand == nil {
		return ownerGeoPoint{}, false
	}
	for _, raw := range []model.JSON{
		demand.DepartureAddressSnapshot,
		demand.ServiceAddressSnapshot,
		demand.DestinationAddressSnapshot,
	} {
		if point, ok := ownerJSONPoint(raw); ok {
			return point, true
		}
	}
	return ownerGeoPoint{}, false
}

func ownerSupplyPoint(supply *model.OwnerSupply) (ownerGeoPoint, bool) {
	if supply == nil {
		return ownerGeoPoint{}, false
	}
	if supply.Drone != nil && ownerValidCoordinate(supply.Drone.Latitude, supply.Drone.Longitude) {
		return ownerGeoPoint{lat: supply.Drone.Latitude, lng: supply.Drone.Longitude}, true
	}
	return ownerJSONPoint(supply.ServiceAreaSnapshot)
}

func ownerJSONPoint(raw model.JSON) (ownerGeoPoint, bool) {
	if len(raw) == 0 {
		return ownerGeoPoint{}, false
	}
	var payload struct {
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
		Lat       *float64 `json:"lat"`
		Lng       *float64 `json:"lng"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ownerGeoPoint{}, false
	}
	lat := payload.Latitude
	if lat == nil {
		lat = payload.Lat
	}
	lng := payload.Longitude
	if lng == nil {
		lng = payload.Lng
	}
	if lat == nil || lng == nil || !ownerValidCoordinate(*lat, *lng) {
		return ownerGeoPoint{}, false
	}
	return ownerGeoPoint{lat: *lat, lng: *lng}, true
}

func ownerValidCoordinate(lat, lng float64) bool {
	if lat == 0 && lng == 0 {
		return false
	}
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

func ownerHaversineKM(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusKM = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusKM * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func (s *OwnerService) GetWorkbench(ownerUserID int64) (*OwnerWorkbenchView, error) {
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, err
	}
	if _, err := s.ensureOwnerProfile(ownerUserID); err != nil {
		return nil, err
	}
	if s.orderService == nil {
		return nil, errors.New("订单服务未初始化")
	}

	recommendedDemands, recommendedTotal, err := s.ListRecommendedDemands(ownerUserID, 1, 5, RecommendedDemandQuery{})
	if err != nil {
		return nil, err
	}
	demandIDs := make([]int64, 0, len(recommendedDemands))
	for i := range recommendedDemands {
		demandIDs = append(demandIDs, recommendedDemands[i].ID)
	}
	demandStats, err := s.GetDemandStats(demandIDs)
	if err != nil {
		return nil, err
	}

	_, pendingQuoteTotal, err := s.ListMyQuotes(ownerUserID, "submitted", 1, 1)
	if err != nil {
		return nil, err
	}

	pendingProviderOrders, pendingProviderTotal, err := s.orderService.ListOrders(ownerUserID, "owner", "pending_provider_confirmation", 1, 5)
	if err != nil {
		return nil, err
	}
	pendingDispatchOrders, pendingDispatchTotal, err := s.orderService.ListOrders(ownerUserID, "owner", "pending_dispatch", 1, 5)
	if err != nil {
		return nil, err
	}

	draftSupplies, draftSupplyTotal, err := s.ListMySupplies(ownerUserID, "draft", 1, 5)
	if err != nil {
		return nil, err
	}

	view := &OwnerWorkbenchView{
		Summary: OwnerWorkbenchSummary{
			RecommendedDemandCount:                recommendedTotal,
			PendingQuoteCount:                     pendingQuoteTotal,
			PendingProviderConfirmationOrderCount: pendingProviderTotal,
			PendingDispatchOrderCount:             pendingDispatchTotal,
			DraftSupplyCount:                      draftSupplyTotal,
		},
		RecommendedDemands:                make([]OwnerWorkbenchDemandItem, 0, len(recommendedDemands)),
		PendingProviderConfirmationOrders: make([]OwnerWorkbenchOrderItem, 0, len(pendingProviderOrders)),
		PendingDispatchOrders:             make([]OwnerWorkbenchOrderItem, 0, len(pendingDispatchOrders)),
		DraftSupplies:                     make([]OwnerWorkbenchSupplyItem, 0, len(draftSupplies)),
	}

	for i := range recommendedDemands {
		item := recommendedDemands[i]
		stats := demandStats[item.ID]
		view.RecommendedDemands = append(view.RecommendedDemands, OwnerWorkbenchDemandItem{
			ID:                  item.ID,
			DemandNo:            item.DemandNo,
			Title:               item.Title,
			Status:              item.Status,
			ServiceAddressText:  homeDemandAddressText(&item),
			ScheduledStartAt:    item.ScheduledStartAt,
			ScheduledEndAt:      item.ScheduledEndAt,
			BudgetMin:           item.BudgetMin,
			BudgetMax:           item.BudgetMax,
			QuoteCount:          stats.QuoteCount,
			CandidatePilotCount: stats.CandidatePilotCount,
		})
	}

	for i := range pendingProviderOrders {
		view.PendingProviderConfirmationOrders = append(view.PendingProviderConfirmationOrders, buildOwnerWorkbenchOrderItem(&pendingProviderOrders[i]))
	}
	for i := range pendingDispatchOrders {
		view.PendingDispatchOrders = append(view.PendingDispatchOrders, buildOwnerWorkbenchOrderItem(&pendingDispatchOrders[i]))
	}
	for i := range draftSupplies {
		view.DraftSupplies = append(view.DraftSupplies, buildOwnerWorkbenchSupplyItem(&draftSupplies[i]))
	}

	return view, nil
}

func (s *OwnerService) GetDemandStats(demandIDs []int64) (map[int64]DemandStats, error) {
	result := make(map[int64]DemandStats)
	if s.demandDomainRepo == nil || len(demandIDs) == 0 {
		return result, nil
	}

	quoteCounts, err := s.demandDomainRepo.CountQuotesByDemandIDs(demandIDs)
	if err != nil {
		return nil, err
	}
	candidateCounts, err := s.demandDomainRepo.CountActiveCandidatesByDemandIDs(demandIDs)
	if err != nil {
		return nil, err
	}

	for _, demandID := range demandIDs {
		result[demandID] = DemandStats{
			QuoteCount:          quoteCounts[demandID],
			CandidatePilotCount: candidateCounts[demandID],
		}
	}
	return result, nil
}

func (s *OwnerService) CreateDemandQuote(ownerUserID, demandID int64, input *CreateQuoteInput) (*model.DemandQuote, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}
	if input == nil {
		return nil, errors.New("报价参数不能为空")
	}
	if input.PriceAmount <= 0 {
		return nil, errors.New("报价金额无效")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, err
	}
	if _, err := s.ensureOwnerProfile(ownerUserID); err != nil {
		return nil, err
	}

	drone, err := s.GetOwnedDrone(ownerUserID, input.DroneID)
	if err != nil {
		return nil, err
	}
	if err := validateDroneForQuote(drone); err != nil {
		return nil, err
	}

	db := s.demandDomainRepo.DB()
	if db == nil {
		return nil, errors.New("需求域数据库未初始化")
	}

	var result *model.DemandQuote
	err = db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandDomainRepo(tx)
		demand, err := demandRepo.LockDemandByID(demandID)
		if err != nil {
			return errors.New("需求不存在")
		}
		if demand.Status != "published" && demand.Status != "quoting" {
			return errors.New("当前需求不允许报价")
		}
		if demand.ExpiresAt != nil && demand.ExpiresAt.Before(time.Now()) {
			return errors.New("需求已过期")
		}

		existing, err := demandRepo.GetQuoteByDemandAndOwner(demandID, ownerUserID)
		if err == nil && existing != nil {
			if existing.Status == "selected" {
				return errors.New("该报价已被客户选中，不能重复修改")
			}
			if existing.Status == "submitted" {
				if err := demandRepo.UpdateDemandQuoteFields(existing.ID, map[string]interface{}{
					"drone_id":         input.DroneID,
					"price_amount":     input.PriceAmount,
					"execution_plan":   strings.TrimSpace(input.ExecutionPlan),
					"pricing_snapshot": s.buildQuotePricingSnapshot(drone, input.PriceAmount),
					"status":           "submitted",
					"updated_at":       time.Now(),
				}); err != nil {
					return err
				}
				if demand.Status == "published" {
					if err := demandRepo.UpdateDemandFields(demand.ID, map[string]interface{}{
						"status":     "quoting",
						"updated_at": time.Now(),
					}); err != nil {
						return err
					}
				}
				updated, err := demandRepo.GetDemandQuoteByID(existing.ID)
				if err != nil {
					return err
				}
				result = updated
				return nil
			}
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		quote := &model.DemandQuote{
			QuoteNo:         demandRepo.GenerateQuoteNo(),
			DemandID:        demand.ID,
			OwnerUserID:     ownerUserID,
			DroneID:         input.DroneID,
			PriceAmount:     input.PriceAmount,
			PricingSnapshot: s.buildQuotePricingSnapshot(drone, input.PriceAmount),
			ExecutionPlan:   strings.TrimSpace(input.ExecutionPlan),
			Status:          "submitted",
		}
		if err := demandRepo.CreateDemandQuote(quote); err != nil {
			return err
		}
		if demand.Status == "published" {
			if err := demandRepo.UpdateDemandFields(demand.ID, map[string]interface{}{
				"status":     "quoting",
				"updated_at": time.Now(),
			}); err != nil {
				return err
			}
		}
		result = quote
		return nil
	})
	if err != nil {
		return nil, err
	}

	if s.matchingService != nil && result != nil {
		_ = s.matchingService.SyncDemandQuoteRanking(demandID, "owner", ownerUserID)
	}
	if s.eventService != nil && result != nil {
		demand, err := s.demandDomainRepo.GetDemandByID(demandID)
		if err == nil {
			s.eventService.NotifyDemandQuoteSubmitted(demand, result)
		}
	}

	return result, nil
}

func (s *OwnerService) ListMyQuotes(ownerUserID int64, status string, page, pageSize int) ([]model.DemandQuote, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, errors.New("需求域仓储未初始化")
	}
	if err := s.ensureProviderQuoteAccess(ownerUserID); err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.demandDomainRepo.ListQuotesByOwner(ownerUserID, status, page, pageSize)
}

func (s *OwnerService) ListPilotBindings(ownerUserID int64, status string, page, pageSize int) ([]model.OwnerPilotBinding, int64, error) {
	if s.ownerDomainRepo == nil {
		return nil, 0, errors.New("绑定仓储未初始化")
	}
	if err := s.ensureProviderDispatchAccess(ownerUserID); err != nil {
		return nil, 0, err
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.ownerDomainRepo.ListBindingsByOwner(ownerUserID, status, page, pageSize)
}

func (s *OwnerService) InvitePilotBinding(ownerUserID, pilotUserID int64, isPriority bool, note string) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
	}
	if err := s.ensureProviderDispatchAccess(ownerUserID); err != nil {
		return nil, err
	}
	if ownerUserID == pilotUserID {
		return nil, errors.New("不能邀请自己成为绑定执行人员")
	}
	if _, err := s.ensureOwnerProfile(ownerUserID); err != nil {
		return nil, err
	}
	if _, err := s.userRepo.GetByID(pilotUserID); err != nil {
		return nil, errors.New("执行人员用户不存在")
	}
	if _, err := s.pilotRepo.GetByUserID(pilotUserID); err != nil {
		return nil, errors.New("对方尚未完成执行人员认证")
	}

	latest, err := s.ownerDomainRepo.GetLatestBindableRecord(ownerUserID, pilotUserID)
	if err == nil && latest != nil {
		switch latest.Status {
		case "active", "paused":
			return nil, errors.New("该执行人员已存在合作关系，请直接调整绑定状态")
		case "pending_confirmation":
			return nil, errors.New("已存在待确认绑定关系")
		}
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	binding := &model.OwnerPilotBinding{
		OwnerUserID: ownerUserID,
		PilotUserID: pilotUserID,
		InitiatedBy: "owner",
		Status:      "pending_confirmation",
		IsPriority:  isPriority,
		Note:        strings.TrimSpace(note),
	}
	if err := s.ownerDomainRepo.CreateBinding(binding); err != nil {
		return nil, err
	}
	if s.eventService != nil {
		s.eventService.NotifyBindingInvitation(binding)
	}
	return binding, nil
}

func (s *OwnerService) ConfirmPilotBinding(ownerUserID, bindingID int64) (*model.OwnerPilotBinding, error) {
	if err := s.ensureProviderDispatchAccess(ownerUserID); err != nil {
		return nil, err
	}
	return s.handlePendingPilotBinding(ownerUserID, bindingID, true)
}

func (s *OwnerService) RejectPilotBinding(ownerUserID, bindingID int64) (*model.OwnerPilotBinding, error) {
	if err := s.ensureProviderDispatchAccess(ownerUserID); err != nil {
		return nil, err
	}
	return s.handlePendingPilotBinding(ownerUserID, bindingID, false)
}

func (s *OwnerService) UpdatePilotBindingStatus(ownerUserID, bindingID int64, status string) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
	}
	if err := s.ensureProviderDispatchAccess(ownerUserID); err != nil {
		return nil, err
	}
	valid := map[string]bool{"active": true, "paused": true, "dissolved": true}
	if !valid[status] {
		return nil, errors.New("无效的绑定状态")
	}

	binding, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, errors.New("绑定关系不存在")
	}
	if binding.OwnerUserID != ownerUserID {
		return nil, errors.New("无权操作该绑定关系")
	}

	switch status {
	case "active":
		if binding.Status != "paused" {
			return nil, errors.New("仅暂停中的绑定可恢复为 active")
		}
		now := time.Now()
		if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, map[string]interface{}{
			"status":       "active",
			"confirmed_at": &now,
			"updated_at":   now,
		}); err != nil {
			return nil, err
		}
	case "paused":
		if binding.Status != "active" {
			return nil, errors.New("仅 active 绑定可暂停")
		}
		if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, map[string]interface{}{
			"status":     "paused",
			"updated_at": time.Now(),
		}); err != nil {
			return nil, err
		}
	case "dissolved":
		if binding.Status != "active" && binding.Status != "paused" {
			return nil, errors.New("当前绑定状态不能解除")
		}
		now := time.Now()
		if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, map[string]interface{}{
			"status":       "dissolved",
			"dissolved_at": &now,
			"updated_at":   now,
		}); err != nil {
			return nil, err
		}
	}
	updated, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, err
	}
	if s.eventService != nil {
		s.eventService.NotifyBindingStatus(updated)
	}
	return updated, nil
}

func (s *OwnerService) ExpirePendingBindings(limit int) (int, error) {
	if s.ownerDomainRepo == nil {
		return 0, errors.New("绑定仓储未初始化")
	}

	db := s.ownerDomainRepo.DB()
	if db == nil {
		return 0, errors.New("绑定仓储未初始化")
	}

	cutoff := time.Now().Add(-defaultBindingExpiryWindow)
	var expired []model.OwnerPilotBinding
	err := db.Transaction(func(tx *gorm.DB) error {
		repo := repository.NewOwnerDomainRepo(tx)
		items, err := repo.ListExpiredPendingBindings(cutoff, limit)
		if err != nil {
			return err
		}
		if len(items) == 0 {
			expired = nil
			return nil
		}

		now := time.Now()
		for i := range items {
			if err := repo.UpdateBindingFields(items[i].ID, map[string]interface{}{
				"status":     "expired",
				"updated_at": now,
			}); err != nil {
				return err
			}
			items[i].Status = "expired"
			items[i].UpdatedAt = now
		}
		expired = items
		return nil
	})
	if err != nil {
		return 0, err
	}

	if s.eventService != nil {
		for i := range expired {
			s.eventService.NotifyBindingStatus(&expired[i])
		}
	}
	return len(expired), nil
}

func (s *OwnerService) ensureOwnerProfile(userID int64) (*model.OwnerProfile, error) {
	if s.roleProfileRepo == nil {
		return nil, errors.New("服务商档案仓储未初始化")
	}

	profile, err := s.roleProfileRepo.GetOwnerProfileByUserID(userID)
	if err == nil && profile != nil {
		return profile, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("用户不存在")
	}

	serviceCity := ""
	if s.droneRepo != nil {
		drones, _, _ := s.droneRepo.ListByOwner(userID, 1, 1)
		if len(drones) > 0 {
			serviceCity = drones[0].City
		}
	}

	if err := s.roleProfileRepo.EnsureOwnerProfile(&model.OwnerProfile{
		UserID:             userID,
		VerificationStatus: "pending",
		Status:             "active",
		ServiceCity:        serviceCity,
		ContactPhone:       user.Phone,
	}); err != nil {
		return nil, err
	}
	return s.roleProfileRepo.GetOwnerProfileByUserID(userID)
}

func (s *OwnerService) buildOwnerSupply(ownerUserID int64, drone *model.Drone, input *OwnerSupplyInput) (*model.OwnerSupply, error) {
	if drone == nil {
		return nil, errors.New("无人机不存在")
	}
	if drone.OwnerID != ownerUserID {
		return nil, errors.New("无权使用该无人机创建供给")
	}

	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "draft"
	}
	validStatuses := map[string]bool{
		"draft":  true,
		"active": true,
		"paused": true,
		"closed": true,
	}
	if !validStatuses[status] {
		return nil, errors.New("无效的供给状态")
	}
	if status == "active" {
		if err := validateDroneForActiveSupply(drone); err != nil {
			return nil, err
		}
	}

	acceptsDirectOrder := true
	if input.AcceptsDirectOrder != nil {
		acceptsDirectOrder = *input.AcceptsDirectOrder
	}

	supply := &model.OwnerSupply{
		SupplyNo:            generateSupplyNo(),
		OwnerUserID:         ownerUserID,
		DroneID:             drone.ID,
		Title:               strings.TrimSpace(input.Title),
		Description:         strings.TrimSpace(input.Description),
		ServiceTypes:        mustOwnerJSON([]string{defaultDemandServiceType}),
		CargoScenes:         mustOwnerJSON(normalizeCargoScenes(input.CargoScenes)),
		ServiceAreaSnapshot: normalizeRawJSON(input.ServiceArea),
		MTOWKG:              drone.MTOWKG,
		MaxPayloadKG:        drone.EffectivePayloadKG(),
		MaxRangeKM:          drone.MaxDistance,
		BasePriceAmount:     input.BasePriceAmount,
		PricingUnit:         normalizePricingUnit(input.PricingUnit),
		PricingRule:         normalizeRawJSON(input.PricingRule),
		AvailableTimeSlots:  normalizeRawJSON(input.AvailableTimeSlots),
		AcceptsDirectOrder:  acceptsDirectOrder,
		Status:              status,
	}
	if supply.Title == "" {
		supply.Title = strings.TrimSpace(drone.Brand + " " + drone.Model + " 重载吊运服务")
	}
	if supply.BasePriceAmount < 0 {
		return nil, errors.New("基础价格不能为负数")
	}
	return supply, nil
}

func (s *OwnerService) handlePendingPilotBinding(ownerUserID, bindingID int64, approve bool) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
	}
	binding, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, errors.New("绑定关系不存在")
	}
	if binding.OwnerUserID != ownerUserID {
		return nil, errors.New("无权操作该绑定关系")
	}
	if binding.InitiatedBy != "pilot" || binding.Status != "pending_confirmation" {
		return nil, errors.New("当前绑定关系不允许该操作")
	}

	now := time.Now()
	updates := map[string]interface{}{"updated_at": now}
	if approve {
		updates["status"] = "active"
		updates["confirmed_at"] = &now
	} else {
		updates["status"] = "rejected"
	}
	if err := s.ownerDomainRepo.UpdateBindingFields(binding.ID, updates); err != nil {
		return nil, err
	}
	updated, err := s.ownerDomainRepo.GetBindingByID(bindingID)
	if err != nil {
		return nil, err
	}
	if s.eventService != nil {
		s.eventService.NotifyBindingStatus(updated)
	}
	return updated, nil
}

func (s *OwnerService) buildQuotePricingSnapshot(drone *model.Drone, priceAmount int64) model.JSON {
	return mustOwnerJSON(map[string]interface{}{
		"price_amount":   priceAmount,
		"drone_id":       drone.ID,
		"mtow_kg":        drone.MTOWKG,
		"max_payload_kg": drone.EffectivePayloadKG(),
		"max_range_km":   drone.MaxDistance,
		"generated_at":   time.Now(),
	})
}

func validateDroneForActiveSupply(drone *model.Drone) error {
	if !drone.EligibleForMarketplace() {
		return errors.New("该无人机未满足主市场重载准入与资质要求，不能创建或激活供给")
	}
	return nil
}

func validateDroneForQuote(drone *model.Drone) error {
	if !drone.EligibleForMarketplace() {
		return errors.New("该无人机未满足报价所需的重载准入与资质要求")
	}
	return nil
}

func normalizeCargoScenes(scenes []string) []string {
	if len(scenes) == 0 {
		return []string{"other_heavy_lift"}
	}
	normalized := make([]string, 0, len(scenes))
	for _, scene := range scenes {
		scene = strings.TrimSpace(scene)
		if scene != "" {
			normalized = append(normalized, scene)
		}
	}
	if len(normalized) == 0 {
		return []string{"other_heavy_lift"}
	}
	return normalized
}

func normalizePricingUnit(value string) string {
	value = strings.TrimSpace(value)
	switch value {
	case "", "per_trip", "per_km", "per_hour", "per_kg":
		if value == "" {
			return "per_trip"
		}
		return value
	default:
		return "per_trip"
	}
}

func normalizeRawJSON(value json.RawMessage) model.JSON {
	if len(value) == 0 {
		return model.JSON([]byte("null"))
	}
	return model.JSON(value)
}

func mustOwnerJSON(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}

func generateSupplyNo() string {
	return fmt.Sprintf("SP%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
}

func buildOwnerWorkbenchOrderItem(order *model.Order) OwnerWorkbenchOrderItem {
	if order == nil {
		return OwnerWorkbenchOrderItem{}
	}
	return OwnerWorkbenchOrderItem{
		ID:             order.ID,
		OrderNo:        order.OrderNo,
		Title:          order.Title,
		Status:         order.Status,
		OrderSource:    order.OrderSource,
		ServiceAddress: order.ServiceAddress,
		DestAddress:    order.DestAddress,
		TotalAmount:    order.TotalAmount,
		CreatedAt:      order.CreatedAt,
		UpdatedAt:      order.UpdatedAt,
	}
}

func buildOwnerWorkbenchSupplyItem(supply *model.OwnerSupply) OwnerWorkbenchSupplyItem {
	if supply == nil {
		return OwnerWorkbenchSupplyItem{}
	}
	item := OwnerWorkbenchSupplyItem{
		ID:              supply.ID,
		SupplyNo:        supply.SupplyNo,
		Title:           supply.Title,
		Status:          supply.Status,
		DroneID:         supply.DroneID,
		BasePriceAmount: supply.BasePriceAmount,
		PricingUnit:     supply.PricingUnit,
		UpdatedAt:       supply.UpdatedAt,
	}
	if supply.Drone != nil {
		item.DroneBrand = supply.Drone.Brand
		item.DroneModel = supply.Drone.Model
		item.CertificationStatus = supply.Drone.CertificationStatus
		item.UOMVerified = supply.Drone.UOMVerified
		item.InsuranceVerified = supply.Drone.InsuranceVerified
		item.AirworthinessVerified = supply.Drone.AirworthinessVerified
	}
	return item
}
