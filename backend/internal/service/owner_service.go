package service

import (
	"encoding/json"
	"errors"
	"fmt"
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

func (s *OwnerService) GetProfile(userID int64) (*model.OwnerProfile, error) {
	return s.ensureOwnerProfile(userID)
}

func (s *OwnerService) UpdateProfile(userID int64, input *OwnerProfileInput) (*model.OwnerProfile, error) {
	profile, err := s.ensureOwnerProfile(userID)
	if err != nil {
		return nil, err
	}
	if s.roleProfileRepo == nil || s.roleProfileRepo.DB() == nil {
		return nil, errors.New("机主档案仓储未初始化")
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
		return nil, 0, errors.New("机主供给仓储未初始化")
	}
	return s.ownerDomainRepo.AdminListSupplies(page, pageSize, filters)
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
		return nil, errors.New("机主供给依赖未初始化")
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
		return nil, 0, errors.New("机主供给仓储未初始化")
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
		return nil, errors.New("机主供给仓储未初始化")
	}
	supply, err := s.ownerDomainRepo.GetSupplyByIDAndOwner(supplyID, ownerUserID)
	if err != nil {
		return nil, errors.New("供给不存在")
	}
	return supply, nil
}

func (s *OwnerService) UpdateSupply(ownerUserID, supplyID int64, input *OwnerSupplyInput) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil || s.droneRepo == nil {
		return nil, errors.New("机主供给依赖未初始化")
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
		return nil, errors.New("机主供给仓储未初始化")
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

func (s *OwnerService) ListRecommendedDemands(ownerUserID int64, page, pageSize int) ([]model.Demand, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, errors.New("需求域仓储未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if s.matchingService != nil {
		return s.matchingService.RecommendDemandsForOwner(ownerUserID, page, pageSize)
	}
	return s.demandDomainRepo.ListRecommendedDemands(page, pageSize)
}

func (s *OwnerService) GetWorkbench(ownerUserID int64) (*OwnerWorkbenchView, error) {
	if _, err := s.ensureOwnerProfile(ownerUserID); err != nil {
		return nil, err
	}
	if s.orderService == nil {
		return nil, errors.New("订单服务未初始化")
	}

	recommendedDemands, recommendedTotal, err := s.ListRecommendedDemands(ownerUserID, 1, 5)
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
		demand, err := demandRepo.GetDemandByID(demandID)
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
	if ownerUserID == pilotUserID {
		return nil, errors.New("不能邀请自己成为绑定飞手")
	}
	if _, err := s.ensureOwnerProfile(ownerUserID); err != nil {
		return nil, err
	}
	if _, err := s.userRepo.GetByID(pilotUserID); err != nil {
		return nil, errors.New("飞手用户不存在")
	}
	if _, err := s.pilotRepo.GetByUserID(pilotUserID); err != nil {
		return nil, errors.New("对方尚未注册飞手身份")
	}

	latest, err := s.ownerDomainRepo.GetLatestBindableRecord(ownerUserID, pilotUserID)
	if err == nil && latest != nil {
		switch latest.Status {
		case "active", "paused":
			return nil, errors.New("该飞手已存在合作关系，请直接调整绑定状态")
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
	return s.handlePendingPilotBinding(ownerUserID, bindingID, true)
}

func (s *OwnerService) RejectPilotBinding(ownerUserID, bindingID int64) (*model.OwnerPilotBinding, error) {
	return s.handlePendingPilotBinding(ownerUserID, bindingID, false)
}

func (s *OwnerService) UpdatePilotBindingStatus(ownerUserID, bindingID int64, status string) (*model.OwnerPilotBinding, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("绑定仓储未初始化")
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
		return nil, errors.New("机主档案仓储未初始化")
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
