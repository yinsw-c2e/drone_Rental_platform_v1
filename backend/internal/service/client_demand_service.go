package service

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const defaultDemandServiceType = "heavy_cargo_lift_transport"

type AddressSnapshotInput struct {
	Text      string   `json:"text"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	City      string   `json:"city"`
	District  string   `json:"district"`
}

type ClientDemandInput struct {
	Title                    *string               `json:"title"`
	ServiceType              *string               `json:"service_type"`
	CargoScene               *string               `json:"cargo_scene"`
	Description              *string               `json:"description"`
	DepartureAddress         *AddressSnapshotInput `json:"departure_address"`
	DestinationAddress       *AddressSnapshotInput `json:"destination_address"`
	ServiceAddress           *AddressSnapshotInput `json:"service_address"`
	ScheduledStartAt         *time.Time            `json:"scheduled_start_at"`
	ScheduledEndAt           *time.Time            `json:"scheduled_end_at"`
	CargoWeightKG            *float64              `json:"cargo_weight_kg"`
	CargoVolumeM3            *float64              `json:"cargo_volume_m3"`
	CargoType                *string               `json:"cargo_type"`
	CargoSpecialRequirements *string               `json:"cargo_special_requirements"`
	EstimatedTripCount       *int                  `json:"estimated_trip_count"`
	BudgetMin                *int64                `json:"budget_min"`
	BudgetMax                *int64                `json:"budget_max"`
	AllowsPilotCandidate     *bool                 `json:"allows_pilot_candidate"`
	ExpiresAt                *time.Time            `json:"expires_at"`
}

type SelectProviderResult struct {
	OrderID int64  `json:"order_id"`
	OrderNo string `json:"order_no"`
	Status  string `json:"status"`
}

type DemandViewerState struct {
	MyQuote     *model.DemandQuote          `json:"my_quote,omitempty"`
	MyCandidate *model.DemandCandidatePilot `json:"my_candidate,omitempty"`
}

type addressSnapshotPayload struct {
	Text      string   `json:"text"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
	City      string   `json:"city,omitempty"`
	District  string   `json:"district,omitempty"`
}

func (s *ClientService) CreateDemand(userID int64, input *ClientDemandInput) (*model.Demand, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}

	if _, err := s.requireCurrentEligibility(userID, clientEligibilityActionPublishDemand); err != nil {
		return nil, err
	}

	if _, err := s.ensureDefaultClient(userID); err != nil {
		return nil, err
	}

	demand, err := buildDemandDraft(userID, s.demandDomainRepo.GenerateDemandNo(), input)
	if err != nil {
		return nil, err
	}

	if err := s.demandDomainRepo.CreateDemand(demand); err != nil {
		return nil, err
	}

	return demand, nil
}

func (s *ClientService) UpdateDemand(userID, demandID int64, input *ClientDemandInput) (*model.Demand, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}

	demand, err := s.getOwnedDemand(userID, demandID)
	if err != nil {
		return nil, err
	}
	if demand.Status != "draft" && demand.Status != "published" && demand.Status != "quoting" {
		return nil, errors.New("仅草稿、已发布或询价中的需求允许修改")
	}

	if err := applyDemandInput(demand, input); err != nil {
		return nil, err
	}
	if err := s.demandDomainRepo.UpdateDemand(demand); err != nil {
		return nil, err
	}

	return demand, nil
}

func (s *ClientService) PublishDemand(userID, demandID int64) (*model.Demand, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}

	if _, err := s.requireCurrentEligibility(userID, clientEligibilityActionPublishDemand); err != nil {
		return nil, err
	}

	demand, err := s.getOwnedDemand(userID, demandID)
	if err != nil {
		return nil, err
	}
	if demand.Status != "draft" {
		return nil, errors.New("仅草稿需求允许发布")
	}
	if err := validateDemandForPublish(demand); err != nil {
		return nil, err
	}

	demand.Status = "published"
	if err := s.demandDomainRepo.UpdateDemand(demand); err != nil {
		return nil, err
	}

	return demand, nil
}

func (s *ClientService) CancelDemand(userID, demandID int64) (*model.Demand, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}

	db := s.demandDomainRepo.DB()
	if db == nil {
		return nil, errors.New("需求域数据库未初始化")
	}

	var updated *model.Demand
	err := db.Transaction(func(tx *gorm.DB) error {
		repo := repository.NewDemandDomainRepo(tx)
		demand, err := repo.GetDemandByID(demandID)
		if err != nil {
			return errors.New("需求不存在")
		}
		if demand.ClientUserID != userID {
			return errors.New("无权操作该需求")
		}
		if demand.Status != "draft" && demand.Status != "published" && demand.Status != "quoting" {
			return errors.New("当前需求状态不允许取消")
		}

		if err := repo.UpdateDemandQuoteFieldsByDemand(demandID, map[string]interface{}{
			"status":     "rejected",
			"updated_at": time.Now(),
		}, []string{"submitted", "selected"}); err != nil {
			return err
		}

		demand.Status = "cancelled"
		if err := repo.UpdateDemand(demand); err != nil {
			return err
		}

		updated = demand
		return nil
	})
	if err != nil {
		return nil, err
	}

	if s.matchingService != nil {
		_ = s.matchingService.SyncDemandQuoteRanking(demandID, "client", userID)
	}
	if s.eventService != nil && updated != nil {
		quotes, err := s.demandDomainRepo.ListDemandQuotes(demandID)
		if err == nil {
			ownerUserIDs := make([]int64, 0, len(quotes))
			for _, quote := range quotes {
				ownerUserIDs = append(ownerUserIDs, quote.OwnerUserID)
			}
			s.eventService.NotifyDemandCancelled(updated, ownerUserIDs)
		}
	}

	return updated, nil
}

func (s *ClientService) CloseExpiredDemands(limit int) (int, error) {
	if s.demandDomainRepo == nil {
		return 0, errors.New("需求域仓储未初始化")
	}

	db := s.demandDomainRepo.DB()
	if db == nil {
		return 0, errors.New("需求域数据库未初始化")
	}

	now := time.Now()
	var expiredDemands []model.Demand
	err := db.Transaction(func(tx *gorm.DB) error {
		repo := repository.NewDemandDomainRepo(tx)
		items, err := repo.ListExpiredActionableDemands(now, limit)
		if err != nil {
			return err
		}
		if len(items) == 0 {
			expiredDemands = nil
			return nil
		}

		for i := range items {
			if err := repo.UpdateDemandQuoteFieldsByDemand(items[i].ID, map[string]interface{}{
				"status":     "rejected",
				"updated_at": now,
			}, []string{"submitted", "selected"}); err != nil {
				return err
			}
			if err := repo.UpdateDemandFields(items[i].ID, map[string]interface{}{
				"status":     "expired",
				"updated_at": now,
			}); err != nil {
				return err
			}
			items[i].Status = "expired"
			items[i].UpdatedAt = now
		}

		expiredDemands = items
		return nil
	})
	if err != nil {
		return 0, err
	}

	if len(expiredDemands) == 0 {
		return 0, nil
	}

	if s.matchingService != nil {
		for i := range expiredDemands {
			_ = s.matchingService.SyncDemandQuoteRanking(expiredDemands[i].ID, "system", 0)
		}
	}
	if s.eventService != nil {
		for i := range expiredDemands {
			s.eventService.NotifyDemandExpired(&expiredDemands[i])
		}
	}

	return len(expiredDemands), nil
}

func (s *ClientService) ListMyDemands(userID int64, status string, page, pageSize int) ([]model.Demand, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, errors.New("需求域仓储未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return s.demandDomainRepo.ListDemandsByClientUser(userID, status, page, pageSize)
}

func (s *ClientService) GetDemandDetail(userID, demandID int64) (*model.Demand, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}
	demand, err := s.demandDomainRepo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.ClientUserID == userID {
		return demand, nil
	}
	if demand.Status != "published" && demand.Status != "quoting" {
		return nil, errors.New("无权查看该需求")
	}
	if demand.ExpiresAt != nil && demand.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("当前需求已过期")
	}
	return demand, nil
}

func (s *ClientService) ListDemandQuotes(userID, demandID int64) ([]model.DemandQuote, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}
	demand, err := s.getOwnedDemand(userID, demandID)
	if err != nil {
		return nil, err
	}
	if demand.Status == "converted_to_order" || demand.Status == "cancelled" || demand.Status == "expired" || demand.Status == "closed" {
		return []model.DemandQuote{}, nil
	}
	return s.demandDomainRepo.ListDemandQuotes(demandID)
}

func (s *ClientService) GetDemandViewerState(userID, demandID int64) (*DemandViewerState, error) {
	state := &DemandViewerState{}
	if s.demandDomainRepo == nil || userID == 0 || demandID == 0 {
		return state, nil
	}

	if quote, err := s.demandDomainRepo.GetQuoteByDemandAndOwner(demandID, userID); err == nil && quote != nil {
		state.MyQuote = quote
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if candidate, err := s.demandDomainRepo.GetDemandCandidateByDemandAndPilot(demandID, userID); err == nil && candidate != nil {
		state.MyCandidate = candidate
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	return state, nil
}

func (s *ClientService) SelectProvider(userID, demandID, quoteID int64) (*SelectProviderResult, error) {
	if s.demandDomainRepo == nil || s.orderService == nil {
		return nil, errors.New("需求转单依赖未初始化")
	}

	if _, err := s.requireCurrentEligibility(userID, clientEligibilityActionSelectProvider); err != nil {
		return nil, err
	}

	client, err := s.ensureDefaultClient(userID)
	if err != nil {
		return nil, err
	}

	db := s.demandDomainRepo.DB()
	if db == nil {
		return nil, errors.New("需求域数据库未初始化")
	}

	var result *SelectProviderResult
	err = db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandDomainRepo(tx)
		orderRepo := repository.NewOrderRepo(tx)
		droneRepo := repository.NewDroneRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)
		ownerRepo := repository.NewOwnerDomainRepo(tx)

		demand, err := demandRepo.GetDemandByID(demandID)
		if err != nil {
			return errors.New("需求不存在")
		}
		if demand.ClientUserID != userID {
			return errors.New("无权操作该需求")
		}
		if demand.Status == "converted_to_order" {
			return errors.New("该需求已转为订单")
		}
		if demand.Status != "published" && demand.Status != "quoting" && demand.Status != "selected" {
			return errors.New("当前需求状态不允许选择机主")
		}
		if demand.ExpiresAt != nil && demand.ExpiresAt.Before(time.Now()) {
			return errors.New("需求已过期，无法继续转单")
		}

		quote, err := demandRepo.GetDemandQuoteByID(quoteID)
		if err != nil {
			return errors.New("报价不存在")
		}
		if quote.DemandID != demand.ID {
			return errors.New("报价不属于当前需求")
		}
		if quote.Status != "submitted" && quote.Status != "selected" {
			return errors.New("当前报价不可被选定")
		}
		if quote.PriceAmount <= 0 {
			return errors.New("报价金额无效")
		}

		now := time.Now()
		demand.Status = "selected"
		demand.SelectedQuoteID = quote.ID
		demand.SelectedProviderUserID = quote.OwnerUserID
		if err := demandRepo.UpdateDemandFields(demand.ID, map[string]interface{}{
			"status":                    "selected",
			"selected_quote_id":         quote.ID,
			"selected_provider_user_id": quote.OwnerUserID,
			"updated_at":                now,
		}); err != nil {
			return err
		}
		if err := demandRepo.UpdateDemandQuoteFields(quote.ID, map[string]interface{}{
			"status":     "selected",
			"updated_at": now,
		}); err != nil {
			return err
		}
		if err := demandRepo.RejectOtherSubmittedQuotes(demand.ID, quote.ID); err != nil {
			return err
		}

		order, err := s.orderService.createDemandMarketOrderWithRepos(
			demand,
			quote,
			client,
			orderRepo,
			droneRepo,
			pilotRepo,
			artifactRepo,
			demandRepo,
			ownerRepo,
		)
		if err != nil {
			return err
		}

		demand.Status = "converted_to_order"
		if err := demandRepo.UpdateDemandFields(demand.ID, map[string]interface{}{
			"status":                    "converted_to_order",
			"selected_quote_id":         quote.ID,
			"selected_provider_user_id": quote.OwnerUserID,
			"updated_at":                now,
		}); err != nil {
			return err
		}

		result = &SelectProviderResult{
			OrderID: order.ID,
			OrderNo: order.OrderNo,
			Status:  order.Status,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if s.matchingService != nil {
		_ = s.matchingService.SyncDemandQuoteRanking(demandID, "client", userID)
	}

	// 自动生成合同
	if s.contractService != nil && result != nil {
		_, _ = s.contractService.GenerateContractForOrder(result.OrderID)
	}

	if s.eventService != nil && result != nil {
		demand, err := s.demandDomainRepo.GetDemandByID(demandID)
		if err == nil {
			quote, quoteErr := s.demandDomainRepo.GetDemandQuoteByID(quoteID)
			if quoteErr == nil {
				s.eventService.NotifyDemandSelected(demand, quote, result.OrderID, result.OrderNo)
			}
		}
	}

	return result, nil
}

func (s *ClientService) CreateDirectSupplyOrder(userID, supplyID int64, input *DirectOrderInput) (*DirectOrderResult, error) {
	if s.orderService == nil {
		return nil, errors.New("直达下单服务未初始化")
	}

	if _, err := s.requireCurrentEligibility(userID, clientEligibilityActionCreateDirectOrder); err != nil {
		return nil, err
	}

	client, err := s.ensureDefaultClient(userID)
	if err != nil {
		return nil, err
	}

	order, err := s.orderService.CreateDirectSupplyOrder(userID, client, supplyID, input)
	if err != nil {
		return nil, err
	}

	// 直达订单也自动生成合同
	if s.contractService != nil {
		_, _ = s.contractService.GenerateContractForOrder(order.ID)
	}

	if s.eventService != nil {
		s.eventService.NotifyDirectOrderCreated(order)
	}

	return &DirectOrderResult{
		OrderID:            order.ID,
		OrderNo:            order.OrderNo,
		OrderSource:        order.OrderSource,
		Status:             order.Status,
		TotalAmount:        order.TotalAmount,
		PlatformCommission: order.PlatformCommission,
		OwnerAmount:        order.OwnerAmount,
	}, nil
}

func (s *ClientService) getOwnedDemand(userID, demandID int64) (*model.Demand, error) {
	if s.demandDomainRepo == nil {
		return nil, errors.New("需求域仓储未初始化")
	}
	demand, err := s.demandDomainRepo.GetDemandByID(demandID)
	if err != nil {
		return nil, errors.New("需求不存在")
	}
	if demand.ClientUserID != userID {
		return nil, errors.New("无权查看该需求")
	}
	return demand, nil
}

func buildDemandDraft(userID int64, demandNo string, input *ClientDemandInput) (*model.Demand, error) {
	demand := &model.Demand{
		DemandNo:             demandNo,
		ClientUserID:         userID,
		ServiceType:          defaultDemandServiceType,
		CargoScene:           "other_heavy_lift",
		EstimatedTripCount:   1,
		AllowsPilotCandidate: false,
		Status:               "draft",
	}

	if err := applyDemandInput(demand, input); err != nil {
		return nil, err
	}
	if demand.ExpiresAt == nil {
		defaultExpiry := time.Now().Add(72 * time.Hour)
		demand.ExpiresAt = &defaultExpiry
	}
	return demand, nil
}

func applyDemandInput(demand *model.Demand, input *ClientDemandInput) error {
	if demand == nil || input == nil {
		return validateDemandDraft(demand)
	}

	if input.Title != nil {
		demand.Title = strings.TrimSpace(*input.Title)
	}
	if input.ServiceType != nil {
		demand.ServiceType = normalizeDemandServiceType(*input.ServiceType)
	}
	if input.CargoScene != nil {
		demand.CargoScene = normalizeCargoScene(*input.CargoScene)
	}
	if input.Description != nil {
		demand.Description = strings.TrimSpace(*input.Description)
	}
	if input.DepartureAddress != nil {
		demand.DepartureAddressSnapshot = buildAddressSnapshot(input.DepartureAddress)
	}
	if input.DestinationAddress != nil {
		demand.DestinationAddressSnapshot = buildAddressSnapshot(input.DestinationAddress)
	}
	if input.ServiceAddress != nil {
		demand.ServiceAddressSnapshot = buildAddressSnapshot(input.ServiceAddress)
	}
	if input.ScheduledStartAt != nil {
		t := *input.ScheduledStartAt
		demand.ScheduledStartAt = &t
	}
	if input.ScheduledEndAt != nil {
		t := *input.ScheduledEndAt
		demand.ScheduledEndAt = &t
	}
	if input.CargoWeightKG != nil {
		demand.CargoWeightKG = *input.CargoWeightKG
	}
	if input.CargoVolumeM3 != nil {
		demand.CargoVolumeM3 = *input.CargoVolumeM3
	}
	if input.CargoType != nil {
		demand.CargoType = strings.TrimSpace(*input.CargoType)
	}
	if input.CargoSpecialRequirements != nil {
		demand.CargoSpecialRequirements = strings.TrimSpace(*input.CargoSpecialRequirements)
	}
	if input.EstimatedTripCount != nil {
		demand.EstimatedTripCount = *input.EstimatedTripCount
	}
	if input.BudgetMin != nil {
		demand.BudgetMin = *input.BudgetMin
	}
	if input.BudgetMax != nil {
		demand.BudgetMax = *input.BudgetMax
	}
	if input.AllowsPilotCandidate != nil {
		demand.AllowsPilotCandidate = *input.AllowsPilotCandidate
	}
	if input.ExpiresAt != nil {
		t := *input.ExpiresAt
		demand.ExpiresAt = &t
	}

	return validateDemandDraft(demand)
}

func validateDemandDraft(demand *model.Demand) error {
	if demand == nil {
		return errors.New("需求不能为空")
	}
	if demand.ServiceType == "" {
		demand.ServiceType = defaultDemandServiceType
	}
	if demand.ServiceType != defaultDemandServiceType {
		return errors.New("当前仅支持 heavy_cargo_lift_transport 服务类型")
	}
	if demand.CargoScene == "" {
		demand.CargoScene = "other_heavy_lift"
	}
	if demand.EstimatedTripCount <= 0 {
		demand.EstimatedTripCount = 1
	}
	if demand.BudgetMin > 0 && demand.BudgetMax > 0 && demand.BudgetMax < demand.BudgetMin {
		return errors.New("预算上限不能小于预算下限")
	}
	if demand.CargoWeightKG < 0 || demand.CargoVolumeM3 < 0 {
		return errors.New("货物重量或体积不能为负数")
	}
	if demand.ScheduledStartAt != nil && demand.ScheduledEndAt != nil && demand.ScheduledEndAt.Before(*demand.ScheduledStartAt) {
		return errors.New("预约结束时间不能早于开始时间")
	}
	return nil
}

func validateDemandForPublish(demand *model.Demand) error {
	if err := validateDemandDraft(demand); err != nil {
		return err
	}
	if strings.TrimSpace(demand.Title) == "" {
		return errors.New("需求标题不能为空")
	}
	if demand.ScheduledStartAt == nil || demand.ScheduledEndAt == nil {
		return errors.New("请补充预约开始和结束时间")
	}
	if demand.CargoWeightKG <= 0 {
		return errors.New("请填写有效的货物重量")
	}
	if demand.ExpiresAt == nil || demand.ExpiresAt.Before(time.Now()) {
		return errors.New("需求有效期无效")
	}

	serviceAddr := parseAddressSnapshot(demand.ServiceAddressSnapshot)
	departureAddr := parseAddressSnapshot(demand.DepartureAddressSnapshot)
	destinationAddr := parseAddressSnapshot(demand.DestinationAddressSnapshot)
	hasServiceAddr := strings.TrimSpace(serviceAddr.Text) != ""
	hasRoute := strings.TrimSpace(departureAddr.Text) != "" && strings.TrimSpace(destinationAddr.Text) != ""
	if !hasServiceAddr && !hasRoute {
		return errors.New("请至少填写服务地址，或完整填写起点和终点地址")
	}

	return nil
}

func buildAddressSnapshot(input *AddressSnapshotInput) model.JSON {
	if input == nil {
		return nil
	}
	payload := addressSnapshotPayload{
		Text:      strings.TrimSpace(input.Text),
		Latitude:  input.Latitude,
		Longitude: input.Longitude,
		City:      strings.TrimSpace(input.City),
		District:  strings.TrimSpace(input.District),
	}
	return mustClientJSON(payload)
}

func parseAddressSnapshot(snapshot model.JSON) addressSnapshotPayload {
	if len(snapshot) == 0 {
		return addressSnapshotPayload{}
	}
	var payload addressSnapshotPayload
	_ = json.Unmarshal(snapshot, &payload)
	return payload
}

func normalizeDemandServiceType(value string) string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return defaultDemandServiceType
	}
	return normalized
}

func normalizeCargoScene(value string) string {
	if strings.TrimSpace(value) == "" {
		return "other_heavy_lift"
	}
	return value
}

func mustClientJSON(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}
