package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type OrderService struct {
	orderRepo         *repository.OrderRepo
	droneRepo         *repository.DroneRepo
	pilotRepo         *repository.PilotRepo
	demandRepo        *repository.DemandRepo
	paymentRepo       *repository.PaymentRepo
	clientRepo        *repository.ClientRepo
	demandDomainRepo  *repository.DemandDomainRepo
	ownerDomainRepo   *repository.OwnerDomainRepo
	orderArtifactRepo *repository.OrderArtifactRepo
	eventService      *EventService
	contractService   *ContractService
	cfg               *config.Config
	logger            *zap.Logger
}

func NewOrderService(
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	demandRepo *repository.DemandRepo,
	paymentRepo *repository.PaymentRepo,
	clientRepo *repository.ClientRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	orderArtifactRepo *repository.OrderArtifactRepo,
	cfg *config.Config,
	logger *zap.Logger,
) *OrderService {
	return &OrderService{
		orderRepo:         orderRepo,
		droneRepo:         droneRepo,
		pilotRepo:         pilotRepo,
		demandRepo:        demandRepo,
		paymentRepo:       paymentRepo,
		clientRepo:        clientRepo,
		demandDomainRepo:  demandDomainRepo,
		ownerDomainRepo:   ownerDomainRepo,
		orderArtifactRepo: orderArtifactRepo,
		cfg:               cfg,
		logger:            logger,
	}
}

func (s *OrderService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

func (s *OrderService) SetContractService(contractService *ContractService) {
	s.contractService = contractService
}

func (s *OrderService) CreateOrder(req *CreateOrderRequest) (*model.Order, error) {
	db := s.orderRepo.DB()
	if db == nil {
		return s.createOrderWithRepos(req, s.orderRepo, s.droneRepo, s.pilotRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo)
	}

	var created *model.Order
	err := db.Transaction(func(tx *gorm.DB) error {
		orderRepo := repository.NewOrderRepo(tx)
		droneRepo := repository.NewDroneRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)
		demandDomainRepo := repository.NewDemandDomainRepo(tx)
		ownerDomainRepo := repository.NewOwnerDomainRepo(tx)
		order, err := s.createOrderWithRepos(req, orderRepo, droneRepo, pilotRepo, artifactRepo, demandDomainRepo, ownerDomainRepo)
		if err != nil {
			return err
		}
		created = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (s *OrderService) createOrderWithRepos(
	req *CreateOrderRequest,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) (*model.Order, error) {
	drone, err := droneRepo.GetByID(req.DroneID)
	if err != nil {
		return nil, errors.New("无人机不存在")
	}
	if drone.AvailabilityStatus != "available" {
		return nil, errors.New("该无人机当前不可用")
	}

	// 确定 renter_id（支付方）
	renterID := req.RenterID
	if req.OrderType == "cargo" && req.RelatedID > 0 {
		// 货运订单：从 cargo_demand 获取 publisher_id（货主）作为 renter_id
		cargo, err := s.demandRepo.GetCargoByID(req.RelatedID)
		if err != nil {
			return nil, errors.New("货运需求不存在")
		}
		renterID = cargo.PublisherID
		req.ClientID = cargo.ClientID

		// 幂等性检查：同一飞手不能重复接同一个货运订单
		existingOrders, _, _ := orderRepo.List(1, 1, map[string]interface{}{
			"order_type": "cargo",
			"related_id": req.RelatedID,
			"owner_id":   drone.OwnerID,
		})
		if len(existingOrders) > 0 {
			// 检查是否有活跃订单（非cancelled/rejected）
			for _, order := range existingOrders {
				if order.Status != "cancelled" && order.Status != "rejected" {
					return nil, errors.New("您已经接过这个货运订单")
				}
			}
		}
	}
	if req.OrderType == "rental" && req.RelatedID > 0 {
		demand, err := s.demandRepo.GetDemandByID(req.RelatedID)
		if err == nil && demand != nil {
			req.ClientID = demand.ClientID
		}
	}

	commissionRate := float64(s.cfg.Payment.CommissionRate)
	commission := int64(float64(req.TotalAmount) * commissionRate / 100)
	ownerAmount := req.TotalAmount - commission
	orderSource, demandID, sourceSupplyID := s.resolveOrderSourceWithRepo(req, drone.OwnerID, req.DroneID, demandDomainRepo, ownerDomainRepo)
	if orderSource == "supply_direct" && sourceSupplyID == 0 && s.logger != nil {
		s.logger.Warn("source supply not resolved for direct order",
			zap.String("order_type", req.OrderType),
			zap.Int64("drone_id", req.DroneID),
			zap.Int64("owner_user_id", drone.OwnerID),
		)
	}
	clientUserID := s.resolveClientUserID(req.ClientID, renterID)
	address := firstNonEmpty(req.ServiceAddress, req.Address)
	executionMode, needsDispatch, pilotID, executorPilotUserID := s.resolveOrderExecutionWithRepo(drone.OwnerID, pilotRepo)
	initialStatus := "created"
	initialTimelineStatus := "created"
	initialTimelineNote := "订单已创建"
	if orderSource == "supply_direct" {
		initialStatus = "pending_provider_confirmation"
		initialTimelineStatus = "pending_provider_confirmation"
		initialTimelineNote = "直达订单已创建，待机主确认"
	}

	order := &model.Order{
		OrderNo:                generateOrderNo(),
		OrderType:              req.OrderType,
		RelatedID:              req.RelatedID,
		OrderSource:            orderSource,
		DemandID:               demandID,
		SourceSupplyID:         sourceSupplyID,
		DroneID:                req.DroneID,
		OwnerID:                drone.OwnerID,
		PilotID:                pilotID,
		RenterID:               renterID,
		ClientID:               req.ClientID,
		ClientUserID:           clientUserID,
		ProviderUserID:         drone.OwnerID,
		DroneOwnerUserID:       drone.OwnerID,
		ExecutorPilotUserID:    executorPilotUserID,
		NeedsDispatch:          needsDispatch,
		ExecutionMode:          executionMode,
		Title:                  req.Title,
		ServiceType:            req.ServiceType,
		StartTime:              req.StartTime,
		EndTime:                req.EndTime,
		ServiceLatitude:        req.Latitude,
		ServiceLongitude:       req.Longitude,
		ServiceAddress:         address,
		TotalAmount:            req.TotalAmount,
		PlatformCommissionRate: commissionRate,
		PlatformCommission:     commission,
		OwnerAmount:            ownerAmount,
		DepositAmount:          drone.Deposit,
		Status:                 initialStatus,
	}

	// 货运订单自动接单
	if req.AutoAccept && orderSource != "supply_direct" {
		now := time.Now()
		order.Status = "accepted"
		order.ProviderConfirmedAt = &now
		order.ExecutorPilotUserID = drone.OwnerID
		// 更新无人机状态
		if err := droneRepo.UpdateFields(req.DroneID, map[string]interface{}{"availability_status": "rented"}); err != nil {
			return nil, err
		}
	}

	if err := orderRepo.Create(order); err != nil {
		return nil, err
	}

	// 记录创建时间线
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       initialTimelineStatus,
		Note:         initialTimelineNote,
		OperatorID:   renterID,
		OperatorType: "renter",
	}); err != nil {
		return nil, err
	}

	// 如果自动接单，记录接单时间线
	if req.AutoAccept {
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      order.ID,
			Status:       "accepted",
			Note:         "飞手已接单",
			OperatorID:   drone.OwnerID,
			OperatorType: "owner",
		}); err != nil {
			return nil, err
		}
	}

	if err := s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo); err != nil {
		return nil, err
	}

	return order, nil
}

func (s *OrderService) createDemandMarketOrderWithRepos(
	demand *model.Demand,
	quote *model.DemandQuote,
	client *model.Client,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) (*model.Order, error) {
	if demand == nil || quote == nil {
		return nil, errors.New("需求或报价不能为空")
	}
	if client == nil {
		return nil, errors.New("客户档案不存在")
	}

	drone, err := droneRepo.GetByID(quote.DroneID)
	if err != nil {
		return nil, errors.New("报价设备不存在")
	}
	if drone.OwnerID != quote.OwnerUserID {
		return nil, errors.New("报价机主与设备归属不一致")
	}
	if !drone.EligibleForMarketplace() {
		return nil, errors.New("报价设备当前不满足平台准入条件")
	}
	if quote.PriceAmount <= 0 {
		return nil, errors.New("报价金额无效")
	}

	serviceAddr, serviceLat, serviceLng := resolveDemandPrimaryAddress(demand)
	destAddr, destLat, destLng := resolveDemandDestinationAddress(demand)
	startAt, endAt := resolveDemandSchedule(demand)

	commissionRate := float64(s.cfg.Payment.CommissionRate)
	commission := int64(float64(quote.PriceAmount) * commissionRate / 100)
	ownerAmount := quote.PriceAmount - commission
	sourceSupplyID := s.resolveSourceSupplyIDWithRepo(quote.OwnerUserID, quote.DroneID, ownerDomainRepo)
	now := time.Now()
	executionMode, needsDispatch, pilotID, executorPilotUserID := s.resolveOrderExecutionWithRepo(quote.OwnerUserID, pilotRepo)

	order := &model.Order{
		OrderNo:                generateOrderNo(),
		OrderType:              "cargo",
		RelatedID:              0,
		OrderSource:            "demand_market",
		DemandID:               demand.ID,
		SourceSupplyID:         sourceSupplyID,
		DroneID:                quote.DroneID,
		OwnerID:                quote.OwnerUserID,
		PilotID:                pilotID,
		RenterID:               demand.ClientUserID,
		ClientID:               client.ID,
		ClientUserID:           demand.ClientUserID,
		ProviderUserID:         quote.OwnerUserID,
		DroneOwnerUserID:       drone.OwnerID,
		ExecutorPilotUserID:    executorPilotUserID,
		NeedsDispatch:          needsDispatch,
		ExecutionMode:          executionMode,
		Title:                  demand.Title,
		ServiceType:            demand.ServiceType,
		StartTime:              startAt,
		EndTime:                endAt,
		ServiceLatitude:        serviceLat,
		ServiceLongitude:       serviceLng,
		ServiceAddress:         serviceAddr,
		DestLatitude:           destLat,
		DestLongitude:          destLng,
		DestAddress:            destAddr,
		TotalAmount:            quote.PriceAmount,
		PlatformCommissionRate: commissionRate,
		PlatformCommission:     commission,
		OwnerAmount:            ownerAmount,
		DepositAmount:          drone.Deposit,
		Status:                 "pending_payment",
		ProviderConfirmedAt:    &now,
	}

	if err := orderRepo.Create(order); err != nil {
		return nil, err
	}

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "pending_payment",
		Note:         "客户已选择机主报价，订单待支付",
		OperatorID:   demand.ClientUserID,
		OperatorType: "renter",
	}); err != nil {
		return nil, err
	}

	if err := s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo); err != nil {
		return nil, err
	}

	return order, nil
}

type DirectOrderInput struct {
	ServiceType              string                `json:"service_type"`
	CargoScene               string                `json:"cargo_scene"`
	DepartureAddress         *AddressSnapshotInput `json:"departure_address"`
	DestinationAddress       *AddressSnapshotInput `json:"destination_address"`
	ServiceAddress           *AddressSnapshotInput `json:"service_address"`
	ScheduledStartAt         *time.Time            `json:"scheduled_start_at"`
	ScheduledEndAt           *time.Time            `json:"scheduled_end_at"`
	CargoWeightKG            *float64              `json:"cargo_weight_kg"`
	CargoVolumeM3            *float64              `json:"cargo_volume_m3"`
	CargoType                *string               `json:"cargo_type"`
	CargoSpecialRequirements *string               `json:"cargo_special_requirements"`
	Description              *string               `json:"description"`
	EstimatedTripCount       *int                  `json:"estimated_trip_count"`
}

type DirectOrderResult struct {
	OrderID            int64  `json:"order_id"`
	OrderNo            string `json:"order_no"`
	OrderSource        string `json:"order_source"`
	Status             string `json:"status"`
	TotalAmount        int64  `json:"total_amount"`
	PlatformCommission int64  `json:"platform_commission"`
	OwnerAmount        int64  `json:"owner_amount"`
}

func (s *OrderService) CreateDirectSupplyOrder(renterUserID int64, client *model.Client, supplyID int64, input *DirectOrderInput) (*model.Order, error) {
	db := s.orderRepo.DB()
	if db == nil {
		return s.createDirectSupplyOrderWithRepos(renterUserID, client, supplyID, input, s.orderRepo, s.droneRepo, s.pilotRepo, s.orderArtifactRepo, s.ownerDomainRepo, s.clientRepo)
	}

	var created *model.Order
	err := db.Transaction(func(tx *gorm.DB) error {
		orderRepo := repository.NewOrderRepo(tx)
		droneRepo := repository.NewDroneRepo(tx)
		pilotRepo := repository.NewPilotRepo(tx)
		artifactRepo := repository.NewOrderArtifactRepo(tx)
		ownerRepo := repository.NewOwnerDomainRepo(tx)
		clientRepo := repository.NewClientRepo(tx)
		order, err := s.createDirectSupplyOrderWithRepos(renterUserID, client, supplyID, input, orderRepo, droneRepo, pilotRepo, artifactRepo, ownerRepo, clientRepo)
		if err != nil {
			return err
		}
		created = order
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (s *OrderService) createDirectSupplyOrderWithRepos(
	renterUserID int64,
	client *model.Client,
	supplyID int64,
	input *DirectOrderInput,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	clientRepo *repository.ClientRepo,
) (*model.Order, error) {
	if ownerDomainRepo == nil || droneRepo == nil || orderRepo == nil {
		return nil, errors.New("直达下单依赖未初始化")
	}
	if input == nil {
		return nil, errors.New("下单参数不能为空")
	}
	if client == nil {
		return nil, errors.New("客户档案不存在")
	}

	supply, err := ownerDomainRepo.GetSupplyByID(supplyID)
	if err != nil {
		return nil, errors.New("供给不存在")
	}
	if supply.Status != "active" {
		return nil, errors.New("当前供给不可下单")
	}
	if !supply.AcceptsDirectOrder {
		return nil, errors.New("该供给暂不支持直达下单")
	}

	drone, err := droneRepo.GetByID(supply.DroneID)
	if err != nil {
		return nil, errors.New("供给关联无人机不存在")
	}
	if drone.OwnerID != supply.OwnerUserID {
		return nil, errors.New("供给与无人机归属不一致")
	}
	if !drone.EligibleForMarketplace() {
		return nil, errors.New("当前供给关联无人机不满足平台准入条件")
	}

	serviceType := firstNonEmpty(input.ServiceType, defaultDemandServiceType)
	if serviceType != defaultDemandServiceType {
		return nil, errors.New("当前仅支持重载吊运服务")
	}
	if !hasDirectOrderPrimaryAddress(input) {
		return nil, errors.New("请填写起运地址或服务地址")
	}
	if input.DestinationAddress == nil || input.DestinationAddress.Text == "" {
		return nil, errors.New("请填写送达地址")
	}

	totalAmount, err := calculateDirectOrderAmount(supply, input)
	if err != nil {
		return nil, err
	}
	startAt, endAt := resolveDirectOrderSchedule(input)
	serviceAddr, serviceLat, serviceLng := resolveDirectOrderPrimaryAddress(input)
	destAddr, destLat, destLng := resolveDirectOrderDestination(input)
	executionMode, needsDispatch, pilotID, executorPilotUserID := s.resolveOrderExecutionWithRepo(supply.OwnerUserID, pilotRepo)
	commissionRate := float64(s.cfg.Payment.CommissionRate)
	commission := int64(float64(totalAmount) * commissionRate / 100)
	ownerAmount := totalAmount - commission
	clientUserID := renterUserID
	if client != nil && client.UserID > 0 {
		clientUserID = client.UserID
	} else if clientRepo != nil && client.ID > 0 {
		clientUserID = s.resolveClientUserID(client.ID, renterUserID)
	}

	order := &model.Order{
		OrderNo:                generateOrderNo(),
		OrderType:              "cargo",
		RelatedID:              0,
		OrderSource:            "supply_direct",
		DemandID:               0,
		SourceSupplyID:         supply.ID,
		DroneID:                supply.DroneID,
		OwnerID:                supply.OwnerUserID,
		PilotID:                pilotID,
		RenterID:               renterUserID,
		ClientID:               client.ID,
		ClientUserID:           clientUserID,
		ProviderUserID:         supply.OwnerUserID,
		DroneOwnerUserID:       supply.OwnerUserID,
		ExecutorPilotUserID:    executorPilotUserID,
		NeedsDispatch:          needsDispatch,
		ExecutionMode:          executionMode,
		Title:                  buildDirectOrderTitle(supply, input),
		ServiceType:            serviceType,
		StartTime:              startAt,
		EndTime:                endAt,
		ServiceLatitude:        serviceLat,
		ServiceLongitude:       serviceLng,
		ServiceAddress:         serviceAddr,
		DestLatitude:           destLat,
		DestLongitude:          destLng,
		DestAddress:            destAddr,
		TotalAmount:            totalAmount,
		PlatformCommissionRate: commissionRate,
		PlatformCommission:     commission,
		OwnerAmount:            ownerAmount,
		DepositAmount:          drone.Deposit,
		Status:                 "pending_provider_confirmation",
	}

	existingOrder, err := orderRepo.FindReusableDirectSupplyOrder(repository.DirectOrderReuseLookup{
		SourceSupplyID: supply.ID,
		RenterID:       renterUserID,
		ServiceType:    serviceType,
		StartTime:      startAt,
		EndTime:        endAt,
		ServiceAddress: serviceAddr,
		DestAddress:    destAddr,
		TotalAmount:    totalAmount,
		CreatedAfter:   time.Now().Add(-24 * time.Hour),
	})
	if err != nil {
		return nil, err
	}
	if existingOrder != nil {
		return existingOrder, nil
	}

	if err := orderRepo.Create(order); err != nil {
		return nil, err
	}
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "pending_provider_confirmation",
		Note:         "直达订单已创建，待机主确认",
		OperatorID:   renterUserID,
		OperatorType: "renter",
	}); err != nil {
		return nil, err
	}
	if err := s.syncOrderSnapshots(order, artifactRepo, nil, ownerDomainRepo); err != nil {
		return nil, err
	}

	return order, nil
}

type CreateOrderRequest struct {
	OrderType      string    `json:"order_type"`
	RelatedID      int64     `json:"related_id"`
	DroneID        int64     `json:"drone_id"`
	RenterID       int64     `json:"-"`
	ClientID       int64     `json:"client_id"`
	Title          string    `json:"title"`
	ServiceType    string    `json:"service_type"`
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	Address        string    `json:"address"`
	ServiceAddress string    `json:"service_address"`
	TotalAmount    int64     `json:"total_amount"`
	AutoAccept     bool      `json:"auto_accept"` // 货运订单自动接单
}

func (s *OrderService) ProviderConfirmOrder(orderID, ownerID int64) error {
	db := s.orderRepo.DB()
	if db == nil {
		if err := s.providerConfirmOrderWithRepos(orderID, ownerID, s.orderRepo, s.pilotRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo); err != nil {
			return err
		}
		if s.eventService != nil {
			if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
				s.eventService.NotifyDirectOrderConfirmed(order)
			}
		}
		return nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if txErr := s.providerConfirmOrderWithRepos(
			orderID,
			ownerID,
			repository.NewOrderRepo(tx),
			repository.NewPilotRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		); txErr != nil {
			return txErr
		}
		// 机主确认订单时自动签署合同
		if s.contractService != nil {
			_ = s.contractService.ProviderAutoSign(tx, orderID, ownerID)
		}
		return nil
	}); err != nil {
		return err
	}
	if s.eventService != nil {
		if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
			s.eventService.NotifyDirectOrderConfirmed(order)
		}
	}
	return nil
}

func (s *OrderService) providerConfirmOrderWithRepos(
	orderID, ownerID int64,
	orderRepo *repository.OrderRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.ProviderUserID != 0 && order.ProviderUserID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.ProviderUserID == 0 && order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.OrderSource != "supply_direct" || order.Status != "pending_provider_confirmation" {
		return errors.New("当前订单不允许机主确认")
	}

	executionMode, needsDispatch, pilotID, executorPilotUserID := s.resolveOrderExecutionWithRepo(order.ProviderUserID, pilotRepo)
	now := time.Now()
	if err := orderRepo.UpdateFields(orderID, map[string]interface{}{
		"status":                 "pending_payment",
		"pilot_id":               pilotID,
		"executor_pilot_user_id": executorPilotUserID,
		"needs_dispatch":         needsDispatch,
		"execution_mode":         executionMode,
		"provider_confirmed_at":  &now,
		"provider_rejected_at":   nil,
		"provider_reject_reason": "",
		"cancel_reason":          "",
		"cancel_by":              "",
		"updated_at":             now,
	}); err != nil {
		return err
	}

	order.Status = "pending_payment"
	order.PilotID = pilotID
	order.ExecutorPilotUserID = executorPilotUserID
	order.NeedsDispatch = needsDispatch
	order.ExecutionMode = executionMode
	order.ProviderConfirmedAt = &now
	order.ProviderRejectedAt = nil
	order.ProviderRejectReason = ""
	order.CancelReason = ""
	order.CancelBy = ""

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       "pending_payment",
		Note:         "机主已确认直达订单，待客户支付",
		OperatorID:   ownerID,
		OperatorType: "owner",
	}); err != nil {
		return err
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) ProviderRejectOrder(orderID, ownerID int64, reason string) error {
	db := s.orderRepo.DB()
	if db == nil {
		if err := s.providerRejectOrderWithRepos(orderID, ownerID, reason, s.orderRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo); err != nil {
			return err
		}
		if s.eventService != nil {
			if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
				s.eventService.NotifyDirectOrderRejected(order)
			}
		}
		return nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return s.providerRejectOrderWithRepos(
			orderID,
			ownerID,
			reason,
			repository.NewOrderRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		)
	}); err != nil {
		return err
	}
	if s.eventService != nil {
		if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
			s.eventService.NotifyDirectOrderRejected(order)
		}
	}
	return nil
}

func (s *OrderService) providerRejectOrderWithRepos(
	orderID, ownerID int64,
	reason string,
	orderRepo *repository.OrderRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.ProviderUserID != 0 && order.ProviderUserID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.ProviderUserID == 0 && order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.OrderSource != "supply_direct" || order.Status != "pending_provider_confirmation" {
		return errors.New("当前订单不允许机主拒绝")
	}

	now := time.Now()
	order.Status = "provider_rejected"
	order.CancelReason = reason
	order.CancelBy = "owner"
	order.ProviderRejectedAt = &now
	order.ProviderRejectReason = reason
	if err := orderRepo.Update(order); err != nil {
		return err
	}

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       "provider_rejected",
		Note:         "机主已拒绝直达订单: " + firstNonEmpty(reason, "未提供原因"),
		OperatorID:   ownerID,
		OperatorType: "owner",
	}); err != nil {
		return err
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) AcceptOrder(orderID, ownerID int64) error {
	db := s.orderRepo.DB()
	if db == nil {
		return s.acceptOrderWithRepos(orderID, ownerID, s.orderRepo, s.droneRepo, s.pilotRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		return s.acceptOrderWithRepos(
			orderID,
			ownerID,
			repository.NewOrderRepo(tx),
			repository.NewDroneRepo(tx),
			repository.NewPilotRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		)
	})
}

func (s *OrderService) acceptOrderWithRepos(
	orderID, ownerID int64,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.OrderSource == "supply_direct" && order.Status == "pending_provider_confirmation" {
		return s.providerConfirmOrderWithRepos(orderID, ownerID, orderRepo, pilotRepo, artifactRepo, demandDomainRepo, ownerDomainRepo)
	}
	if order.Status != "created" {
		return errors.New("订单状态不允许此操作")
	}

	now := time.Now()
	if err := orderRepo.UpdateFields(orderID, map[string]interface{}{
		"status":                 "accepted",
		"provider_confirmed_at":  &now,
		"provider_rejected_at":   nil,
		"provider_reject_reason": "",
	}); err != nil {
		return err
	}

	// 更新无人机状态为已出租
	if err := droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "rented"}); err != nil {
		return err
	}

	order.Status = "accepted"
	order.ProviderConfirmedAt = &now
	order.ProviderRejectedAt = nil
	order.ProviderRejectReason = ""

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "accepted", Note: "订单已接受",
		OperatorID: ownerID, OperatorType: "owner",
	}); err != nil {
		return err
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) RejectOrder(orderID, ownerID int64, reason string) error {
	db := s.orderRepo.DB()
	if db == nil {
		return s.rejectOrderWithRepos(orderID, ownerID, reason, s.orderRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		return s.rejectOrderWithRepos(
			orderID,
			ownerID,
			reason,
			repository.NewOrderRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		)
	})
}

func (s *OrderService) rejectOrderWithRepos(
	orderID, ownerID int64,
	reason string,
	orderRepo *repository.OrderRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.OrderSource == "supply_direct" && order.Status == "pending_provider_confirmation" {
		return s.providerRejectOrderWithRepos(orderID, ownerID, reason, orderRepo, artifactRepo, demandDomainRepo, ownerDomainRepo)
	}
	if order.Status != "created" {
		return errors.New("订单状态不允许此操作")
	}

	now := time.Now()
	order.Status = "rejected"
	order.CancelReason = reason
	order.CancelBy = "owner"
	order.ProviderRejectedAt = &now
	order.ProviderRejectReason = reason
	if err := orderRepo.Update(order); err != nil {
		return err
	}

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "rejected", Note: "订单已拒绝: " + reason,
		OperatorID: ownerID, OperatorType: "owner",
	}); err != nil {
		return err
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) resolveClientUserID(clientID, fallbackUserID int64) int64 {
	if clientID <= 0 || s.clientRepo == nil {
		return fallbackUserID
	}

	client, err := s.clientRepo.GetByID(clientID)
	if err != nil || client == nil || client.UserID == 0 {
		return fallbackUserID
	}

	return client.UserID
}

func (s *OrderService) resolveOrderSource(req *CreateOrderRequest, ownerUserID, droneID int64) (string, int64, int64) {
	return s.resolveOrderSourceWithRepo(req, ownerUserID, droneID, s.demandDomainRepo, s.ownerDomainRepo)
}

func (s *OrderService) resolveOrderSourceWithRepo(
	req *CreateOrderRequest,
	ownerUserID, droneID int64,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) (string, int64, int64) {
	if req == nil {
		return "demand_market", 0, 0
	}

	switch req.OrderType {
	case "cargo":
		if req.RelatedID > 0 {
			return "demand_market", s.resolveDemandIDWithRepo("cargo_demand", req.RelatedID, demandDomainRepo), 0
		}
	case "dispatch":
		if req.RelatedID > 0 {
			return "demand_market", 0, 0
		}
	case "rental":
		if req.RelatedID > 0 {
			return "demand_market", s.resolveDemandIDWithRepo("rental_demand", req.RelatedID, demandDomainRepo), 0
		}
	}

	return "supply_direct", 0, s.resolveSourceSupplyIDWithRepo(ownerUserID, droneID, ownerDomainRepo)
}

func (s *OrderService) resolveDemandID(legacyType string, legacyID int64) int64 {
	return s.resolveDemandIDWithRepo(legacyType, legacyID, s.demandDomainRepo)
}

func (s *OrderService) resolveDemandIDWithRepo(legacyType string, legacyID int64, demandDomainRepo *repository.DemandDomainRepo) int64 {
	if demandDomainRepo == nil || legacyID <= 0 {
		return 0
	}
	demandID, err := demandDomainRepo.ResolveDemandIDByLegacy(legacyType, legacyID)
	if err != nil {
		return 0
	}
	return demandID
}

func (s *OrderService) resolveSourceSupplyID(ownerUserID, droneID int64) int64 {
	return s.resolveSourceSupplyIDWithRepo(ownerUserID, droneID, s.ownerDomainRepo)
}

func (s *OrderService) resolveSourceSupplyIDWithRepo(ownerUserID, droneID int64, ownerDomainRepo *repository.OwnerDomainRepo) int64 {
	if ownerDomainRepo == nil || ownerUserID <= 0 || droneID <= 0 {
		return 0
	}
	supply, err := ownerDomainRepo.GetPreferredSupplyByOwnerDrone(ownerUserID, droneID)
	if err != nil || supply == nil {
		return 0
	}
	return supply.ID
}

func (s *OrderService) syncOrderSnapshots(
	order *model.Order,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	if artifactRepo == nil || order == nil || order.ID == 0 {
		return nil
	}

	var demand *model.Demand
	if order.DemandID > 0 && demandDomainRepo != nil {
		record, err := demandDomainRepo.GetDemandByID(order.DemandID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		demand = record
	}

	var supply *model.OwnerSupply
	if order.SourceSupplyID > 0 && ownerDomainRepo != nil {
		record, err := ownerDomainRepo.GetSupplyByID(order.SourceSupplyID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		supply = record
	}

	return repository.UpsertOrderSnapshotBundle(artifactRepo, order, demand, supply)
}

func (s *OrderService) calculateRefundPlan(order *model.Order) (int64, string, error) {
	if order == nil || order.PaidAt == nil || order.Status == "refunded" || order.Status == "provider_rejected" {
		return 0, "", nil
	}

	now := time.Now()
	hoursUntilStart := order.StartTime.Sub(now).Hours()

	switch {
	case hoursUntilStart > 24:
		return order.TotalAmount + order.DepositAmount, "提前24小时以上取消，全额退款", nil
	case hoursUntilStart > 0:
		return int64(float64(order.TotalAmount)*0.7) + order.DepositAmount,
			fmt.Sprintf("提前%.1f小时取消，退款70%%订单金额和全部压金", hoursUntilStart), nil
	default:
		return 0, "", errors.New("服务已过开始时间，无法取消")
	}
}

func (s *OrderService) buildRefundPlans(orderID, refundAmount int64, cancelReason, policyReason string, payments []model.Payment) ([]*model.Refund, error) {
	if refundAmount <= 0 {
		return nil, nil
	}

	remaining := refundAmount
	refunds := make([]*model.Refund, 0)
	for _, payment := range payments {
		if payment.Status != "paid" {
			continue
		}
		if remaining <= 0 {
			break
		}

		amount := payment.Amount
		if amount > remaining {
			amount = remaining
		}
		if amount <= 0 {
			continue
		}

		refundReason := policyReason
		if cancelReason != "" {
			refundReason = cancelReason + "；" + policyReason
		}
		refunds = append(refunds, &model.Refund{
			RefundNo:  repository.GenerateRefundNo(),
			OrderID:   orderID,
			PaymentID: payment.ID,
			Amount:    amount,
			Reason:    firstNonEmpty(refundReason, cancelReason, policyReason),
			Status:    "pending",
		})
		remaining -= amount
	}

	if len(refunds) == 0 {
		return nil, errors.New("未找到可退款的支付记录")
	}
	if remaining > 0 {
		return nil, errors.New("支付记录金额不足，无法生成完整退款记录")
	}

	return refunds, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func (s *OrderService) CancelOrder(orderID, userID int64, reason, role string) error {
	db := s.orderRepo.DB()
	if db == nil {
		if err := s.cancelOrderWithRepos(
			orderID,
			userID,
			reason,
			role,
			s.orderRepo,
			s.droneRepo,
			s.paymentRepo,
			s.orderArtifactRepo,
			s.demandDomainRepo,
			s.ownerDomainRepo,
		); err != nil {
			return err
		}
		if s.eventService != nil {
			if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
				s.eventService.NotifyOrderStatusChanged(order, "order_cancelled", "订单已取消", fmt.Sprintf("订单“%s”已取消。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
			}
		}
		return nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return s.cancelOrderWithRepos(
			orderID,
			userID,
			reason,
			role,
			repository.NewOrderRepo(tx),
			repository.NewDroneRepo(tx),
			repository.NewPaymentRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		)
	}); err != nil {
		return err
	}
	if s.eventService != nil {
		if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
			s.eventService.NotifyOrderStatusChanged(order, "order_cancelled", "订单已取消", fmt.Sprintf("订单“%s”已取消。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
		}
	}
	return nil
}

func (s *OrderService) cancelOrderWithRepos(
	orderID, userID int64,
	reason, role string,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	paymentRepo *repository.PaymentRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}

	if order.Status == "completed" || order.Status == "cancelled" || order.Status == "refunded" {
		return errors.New("该订单不能取消")
	}
	if order.Status == "provider_rejected" {
		return errors.New("该订单不能取消")
	}
	if order.Status == "in_progress" {
		return errors.New("服务已开始，无法取消。请在服务结束后协商解决")
	}

	refundAmount, refundReason, err := s.calculateRefundPlan(order)
	if err != nil {
		return err
	}

	order.Status = "cancelled"
	order.CancelReason = reason
	order.CancelBy = role
	if err := orderRepo.Update(order); err != nil {
		return err
	}

	if refundAmount > 0 {
		if paymentRepo == nil || artifactRepo == nil {
			return errors.New("退款记录依赖未初始化")
		}

		payments, err := paymentRepo.GetByOrderID(orderID)
		if err != nil {
			return err
		}
		refundPlans, err := s.buildRefundPlans(orderID, refundAmount, reason, refundReason, payments)
		if err != nil {
			return err
		}
		for _, refund := range refundPlans {
			if err := artifactRepo.CreateRefund(refund); err != nil {
				return err
			}
		}
	}

	s.restoreDroneStatusIfNoActiveOrdersWithRepos(order.DroneID, orderID, orderRepo, droneRepo)

	note := "订单已取消: " + reason
	if refundAmount > 0 {
		note = fmt.Sprintf("%s；已生成退款记录，待处理金额 %d 分", note, refundAmount)
	}
	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "cancelled", Note: note,
		OperatorID: userID, OperatorType: role,
	}); err != nil {
		return err
	}

	if refundAmount > 0 && s.logger != nil {
		s.logger.Info("refund records created for cancelled order",
			zap.Int64("order_id", orderID),
			zap.Int64("refund_amount", refundAmount),
			zap.String("reason", refundReason),
		)
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) StartOrder(orderID, ownerID int64) error {
	db := s.orderRepo.DB()
	if db == nil {
		if err := s.startOrderWithRepos(orderID, ownerID, s.orderRepo, s.droneRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo); err != nil {
			return err
		}
		if s.eventService != nil {
			if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
				s.eventService.NotifyOrderStatusChanged(order, "order_in_progress", "订单进行中", fmt.Sprintf("订单“%s”已开始执行。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
			}
		}
		return nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return s.startOrderWithRepos(
			orderID,
			ownerID,
			repository.NewOrderRepo(tx),
			repository.NewDroneRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		)
	}); err != nil {
		return err
	}
	if s.eventService != nil {
		if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
			s.eventService.NotifyOrderStatusChanged(order, "order_in_progress", "订单进行中", fmt.Sprintf("订单“%s”已开始执行。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
		}
	}
	return nil
}

func (s *OrderService) startOrderWithRepos(
	orderID, ownerID int64,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.Status != "paid" {
		if order.Status != "assigned" {
			return errors.New("订单未进入可执行状态，无法开始")
		}
	}

	if err := orderRepo.UpdateStatus(orderID, "in_progress"); err != nil {
		return err
	}

	if err := droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "rented"}); err != nil {
		return err
	}

	order.Status = "in_progress"

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "in_progress", Note: "服务已开始",
		OperatorID: ownerID, OperatorType: "owner",
	}); err != nil {
		return err
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) CompleteOrder(orderID, userID int64, role string) error {
	db := s.orderRepo.DB()
	if db == nil {
		if err := s.completeOrderWithRepos(orderID, userID, role, s.orderRepo, s.droneRepo, s.orderArtifactRepo, s.demandDomainRepo, s.ownerDomainRepo); err != nil {
			return err
		}
		if s.eventService != nil {
			if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
				s.eventService.NotifyOrderStatusChanged(order, "order_completed", "订单已完成", fmt.Sprintf("订单“%s”已完成。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
			}
		}
		return nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return s.completeOrderWithRepos(
			orderID,
			userID,
			role,
			repository.NewOrderRepo(tx),
			repository.NewDroneRepo(tx),
			repository.NewOrderArtifactRepo(tx),
			repository.NewDemandDomainRepo(tx),
			repository.NewOwnerDomainRepo(tx),
		)
	}); err != nil {
		return err
	}
	if s.eventService != nil {
		if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
			s.eventService.NotifyOrderStatusChanged(order, "order_completed", "订单已完成", fmt.Sprintf("订单“%s”已完成。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
		}
	}
	return nil
}

func (s *OrderService) completeOrderWithRepos(
	orderID, userID int64,
	role string,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	artifactRepo *repository.OrderArtifactRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
) error {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.Status != "in_progress" {
		return errors.New("订单状态不允许完成")
	}

	now := time.Now()
	if err := orderRepo.UpdateFields(orderID, map[string]interface{}{
		"status":       "completed",
		"completed_at": &now,
	}); err != nil {
		return err
	}

	// 检查是否还有其他活跃订单，如果没有则恢复无人机状态
	s.restoreDroneStatusIfNoActiveOrdersWithRepos(order.DroneID, orderID, orderRepo, droneRepo)

	order.Status = "completed"
	order.CompletedAt = &now

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "completed", Note: "订单已完成",
		OperatorID: userID, OperatorType: role,
	}); err != nil {
		return err
	}

	return s.syncOrderSnapshots(order, artifactRepo, demandDomainRepo, ownerDomainRepo)
}

func (s *OrderService) GetOrder(orderID int64) (*model.Order, error) {
	return s.orderRepo.GetByID(orderID)
}

func (s *OrderService) ListOrders(userID int64, role, status string, page, pageSize int) ([]model.Order, int64, error) {
	return s.orderRepo.ListByUser(userID, normalizeOrderRole(role), status, page, pageSize)
}

func (s *OrderService) GetTimeline(orderID int64) ([]model.OrderTimeline, error) {
	return s.orderRepo.GetTimeline(orderID)
}

func (s *OrderService) GetAuthorizedOrder(orderID, userID int64, role string) (*model.Order, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, err
	}
	if userID > 0 && !s.CanAccessOrder(order, userID, role) {
		return nil, errors.New("无权查看该订单")
	}
	return order, nil
}

func (s *OrderService) CanAccessOrder(order *model.Order, userID int64, role string) bool {
	if order == nil || userID <= 0 {
		return false
	}

	matchClient := func() bool {
		return order.ClientUserID == userID || order.RenterID == userID
	}
	matchOwner := func() bool {
		return order.ProviderUserID == userID || order.OwnerID == userID || order.DroneOwnerUserID == userID
	}
	matchPilot := func() bool {
		if order.ExecutorPilotUserID == userID {
			return true
		}
		if order.PilotID > 0 && s.pilotRepo != nil {
			pilot, err := s.pilotRepo.GetByUserID(userID)
			return err == nil && pilot != nil && pilot.ID == order.PilotID
		}
		return false
	}

	switch normalizeOrderRole(role) {
	case "client":
		return matchClient()
	case "owner":
		return matchOwner()
	case "pilot":
		return matchPilot()
	default:
		return matchClient() || matchOwner() || matchPilot()
	}
}

func (s *OrderService) ListPaymentsByOrder(orderID int64) ([]model.Payment, error) {
	if s.paymentRepo == nil {
		return nil, nil
	}
	return s.paymentRepo.GetByOrderID(orderID)
}

func (s *OrderService) ListRefundsByOrder(orderID int64) ([]model.Refund, error) {
	if s.orderArtifactRepo == nil {
		return nil, nil
	}
	return s.orderArtifactRepo.ListRefundsByOrder(orderID)
}

func (s *OrderService) ListSnapshotsByOrder(orderID int64) ([]model.OrderSnapshot, error) {
	if s.orderArtifactRepo == nil {
		return nil, nil
	}
	return s.orderArtifactRepo.ListSnapshotsByOrder(orderID)
}

func (s *OrderService) ListDisputesByOrder(orderID int64) ([]model.DisputeRecord, error) {
	if s.orderArtifactRepo == nil {
		return nil, nil
	}
	return s.orderArtifactRepo.ListDisputesByOrder(orderID)
}

func (s *OrderService) CreateDispute(orderID, userID int64, disputeType, summary string) (*model.DisputeRecord, error) {
	if s.orderArtifactRepo == nil {
		return nil, errors.New("争议记录依赖未初始化")
	}
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("订单不存在")
	}
	if !s.CanAccessOrder(order, userID, "") {
		return nil, errors.New("无权对该订单发起争议")
	}
	if order.Status == "pending_provider_confirmation" || order.Status == "provider_rejected" || order.Status == "pending_payment" {
		return nil, errors.New("当前订单状态不允许发起争议")
	}

	record := &model.DisputeRecord{
		OrderID:         orderID,
		InitiatorUserID: userID,
		DisputeType:     firstNonEmpty(disputeType, "general"),
		Status:          "open",
		Summary:         summary,
	}
	if err := s.orderArtifactRepo.CreateDispute(record); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *OrderService) AdminListOrders(page, pageSize int, filters map[string]interface{}) ([]model.Order, int64, error) {
	return s.orderRepo.List(page, pageSize, filters)
}

func (s *OrderService) GetStatistics() (map[string]int64, error) {
	return s.orderRepo.GetStatistics()
}

// restoreDroneStatusIfNoActiveOrders 检查无人机是否还有其他活跃订单，如果没有则恢复为可用状态
func (s *OrderService) restoreDroneStatusIfNoActiveOrders(droneID, excludeOrderID int64) {
	s.restoreDroneStatusIfNoActiveOrdersWithRepos(droneID, excludeOrderID, s.orderRepo, s.droneRepo)
}

func (s *OrderService) restoreDroneStatusIfNoActiveOrdersWithRepos(droneID, excludeOrderID int64, orderRepo *repository.OrderRepo, droneRepo *repository.DroneRepo) {
	// 查询是否还有其他进行中的订单
	activeStatuses := []string{"accepted", "confirmed", "paid", "pending_dispatch", "assigned", "loading", "preparing", "in_progress", "in_transit", "delivered"}
	hasOtherOrders := false

	for _, status := range activeStatuses {
		orders, _, _ := orderRepo.List(1, 1, map[string]interface{}{
			"drone_id": droneID,
			"status":   status,
		})

		// 过滤掉当前订单
		for _, order := range orders {
			if order.ID != excludeOrderID {
				hasOtherOrders = true
				break
			}
		}

		if hasOtherOrders {
			break
		}
	}

	// 如果没有其他活跃订单，恢复无人机状态
	if !hasOtherOrders {
		_ = droneRepo.UpdateFields(droneID, map[string]interface{}{"availability_status": "available"})
	}
}

func generateOrderNo() string {
	return fmt.Sprintf("WRJ%d", time.Now().UnixNano()/1000000)
}

type orderAddressSnapshot struct {
	Text      string   `json:"text"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
}

func resolveDemandPrimaryAddress(demand *model.Demand) (string, float64, float64) {
	service := parseOrderAddressSnapshot(demand.ServiceAddressSnapshot)
	if service.Text != "" {
		return service.Text, derefFloat64(service.Latitude), derefFloat64(service.Longitude)
	}
	departure := parseOrderAddressSnapshot(demand.DepartureAddressSnapshot)
	return departure.Text, derefFloat64(departure.Latitude), derefFloat64(departure.Longitude)
}

func resolveDemandDestinationAddress(demand *model.Demand) (string, *float64, *float64) {
	destination := parseOrderAddressSnapshot(demand.DestinationAddressSnapshot)
	return destination.Text, destination.Latitude, destination.Longitude
}

func resolveDemandSchedule(demand *model.Demand) (time.Time, time.Time) {
	now := time.Now()
	startAt := now
	endAt := now.Add(2 * time.Hour)
	if demand != nil && demand.ScheduledStartAt != nil {
		startAt = *demand.ScheduledStartAt
	}
	if demand != nil && demand.ScheduledEndAt != nil {
		endAt = *demand.ScheduledEndAt
	}
	if endAt.Before(startAt) {
		endAt = startAt.Add(2 * time.Hour)
	}
	return startAt, endAt
}

func parseOrderAddressSnapshot(snapshot model.JSON) orderAddressSnapshot {
	if len(snapshot) == 0 {
		return orderAddressSnapshot{}
	}
	var result orderAddressSnapshot
	_ = json.Unmarshal(snapshot, &result)
	return result
}

func (s *OrderService) resolveOrderExecutionWithRepo(providerUserID int64, pilotRepo *repository.PilotRepo) (string, bool, int64, int64) {
	if providerUserID <= 0 || pilotRepo == nil {
		return "dispatch_pool", true, 0, 0
	}
	pilot, err := pilotRepo.GetByUserID(providerUserID)
	if err != nil || pilot == nil || pilot.VerificationStatus != "verified" {
		return "dispatch_pool", true, 0, 0
	}
	return "self_execute", false, pilot.ID, providerUserID
}

func hasDirectOrderPrimaryAddress(input *DirectOrderInput) bool {
	if input == nil {
		return false
	}
	return (input.ServiceAddress != nil && input.ServiceAddress.Text != "") ||
		(input.DepartureAddress != nil && input.DepartureAddress.Text != "")
}

func resolveDirectOrderPrimaryAddress(input *DirectOrderInput) (string, float64, float64) {
	if input != nil && input.ServiceAddress != nil && input.ServiceAddress.Text != "" {
		return input.ServiceAddress.Text, derefFloat64(input.ServiceAddress.Latitude), derefFloat64(input.ServiceAddress.Longitude)
	}
	if input != nil && input.DepartureAddress != nil {
		return input.DepartureAddress.Text, derefFloat64(input.DepartureAddress.Latitude), derefFloat64(input.DepartureAddress.Longitude)
	}
	return "", 0, 0
}

func resolveDirectOrderDestination(input *DirectOrderInput) (string, *float64, *float64) {
	if input == nil || input.DestinationAddress == nil {
		return "", nil, nil
	}
	return input.DestinationAddress.Text, input.DestinationAddress.Latitude, input.DestinationAddress.Longitude
}

func resolveDirectOrderSchedule(input *DirectOrderInput) (time.Time, time.Time) {
	now := time.Now()
	startAt := now
	endAt := now.Add(2 * time.Hour)
	if input != nil && input.ScheduledStartAt != nil {
		startAt = *input.ScheduledStartAt
	}
	if input != nil && input.ScheduledEndAt != nil {
		endAt = *input.ScheduledEndAt
	}
	if endAt.Before(startAt) || endAt.Equal(startAt) {
		endAt = startAt.Add(2 * time.Hour)
	}
	return startAt, endAt
}

func buildDirectOrderTitle(supply *model.OwnerSupply, input *DirectOrderInput) string {
	if input != nil && input.Description != nil && *input.Description != "" {
		return firstNonEmpty(supply.Title, *input.Description)
	}
	if supply != nil {
		return firstNonEmpty(supply.Title, "重载吊运直达订单")
	}
	return "重载吊运直达订单"
}

func normalizeOrderRole(role string) string {
	switch role {
	case "client", "renter", "payer":
		return "client"
	case "owner", "provider":
		return "owner"
	case "pilot", "executor":
		return "pilot"
	default:
		return ""
	}
}

func calculateDirectOrderAmount(supply *model.OwnerSupply, input *DirectOrderInput) (int64, error) {
	if supply == nil {
		return 0, errors.New("供给不存在")
	}
	if supply.BasePriceAmount <= 0 {
		return 0, errors.New("供给挂牌价无效")
	}

	trips := 1.0
	if input != nil && input.EstimatedTripCount != nil && *input.EstimatedTripCount > 0 {
		trips = float64(*input.EstimatedTripCount)
	}

	switch supply.PricingUnit {
	case "", "per_trip":
		return int64(math.Round(float64(supply.BasePriceAmount) * trips)), nil
	case "per_kg":
		if input == nil || input.CargoWeightKG == nil || *input.CargoWeightKG <= 0 {
			return 0, errors.New("按重量计价时必须填写货物重量")
		}
		return int64(math.Round(float64(supply.BasePriceAmount) * *input.CargoWeightKG * trips)), nil
	case "per_hour":
		if input == nil || input.ScheduledStartAt == nil || input.ScheduledEndAt == nil {
			return 0, errors.New("按时长计价时必须填写计划开始和结束时间")
		}
		hours := input.ScheduledEndAt.Sub(*input.ScheduledStartAt).Hours()
		if hours <= 0 {
			return 0, errors.New("按时长计价时计划结束时间必须晚于开始时间")
		}
		return int64(math.Round(float64(supply.BasePriceAmount) * hours * trips)), nil
	case "per_km":
		if input == nil || input.DepartureAddress == nil || input.DestinationAddress == nil ||
			input.DepartureAddress.Latitude == nil || input.DepartureAddress.Longitude == nil ||
			input.DestinationAddress.Latitude == nil || input.DestinationAddress.Longitude == nil {
			return 0, errors.New("按里程计价时必须填写带坐标的起运和送达地址")
		}
		distanceKM := haversineKM(*input.DepartureAddress.Latitude, *input.DepartureAddress.Longitude, *input.DestinationAddress.Latitude, *input.DestinationAddress.Longitude)
		if distanceKM <= 0 {
			return 0, errors.New("无法计算有效运输距离")
		}
		return int64(math.Round(float64(supply.BasePriceAmount) * distanceKM * trips)), nil
	default:
		return 0, errors.New("暂不支持该供给的计价方式")
	}
}

func haversineKM(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadiusKM = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKM * c
}

func derefFloat64(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

func normalizeExecutionStatus(status string) string {
	switch status {
	case "loading":
		return "preparing"
	default:
		return status
	}
}

func executionStatusTransitions() map[string]map[string]bool {
	return map[string]map[string]bool{
		"assigned": {
			"confirmed": true,
			"preparing": true,
		},
		"confirmed": {
			"airspace_applying": true,
			"preparing":         true,
		},
		"airspace_applying": {
			"airspace_approved": true,
			"preparing":         true,
		},
		"airspace_approved": {
			"preparing": true,
		},
		"preparing": {
			"in_transit": true,
		},
		"in_transit": {
			"delivered": true,
		},
	}
}

func executionStatusLabels() map[string]string {
	return map[string]string{
		"confirmed":         "飞手已确认接单",
		"airspace_applying": "正在申请空域许可",
		"airspace_approved": "空域许可已获批",
		"preparing":         "执行人已开始准备",
		"in_transit":        "无人机已起飞，订单执行中",
		"delivered":         "已到达目的地，完成投送",
	}
}

func executionStatusNotification(status string) (string, string, string, bool) {
	switch status {
	case "preparing":
		return "order_preparing", "订单准备中", "订单“%s”已进入准备阶段。", true
	case "in_transit":
		return "order_in_transit", "订单执行中", "订单“%s”已开始飞行，请留意执行进度。", true
	case "delivered":
		return "order_delivered", "订单已投送", "订单“%s”已完成投送，请尽快确认签收。", true
	default:
		return "", "", "", false
	}
}

func validateExecutionStatusTransition(currentStatus, targetStatus string) error {
	if targetStatus == "" {
		return errors.New("无效的状态值")
	}
	if currentStatus == targetStatus {
		return errors.New("订单已处于该状态")
	}
	next, exists := executionStatusTransitions()[currentStatus]
	if !exists || !next[targetStatus] {
		return fmt.Errorf("订单当前状态为 %s，不允许变更为 %s", currentStatus, targetStatus)
	}
	return nil
}

func buildExecutionStatusUpdates(order *model.Order, operatorUserID int64, targetStatus, persistedStatus string, now time.Time) map[string]interface{} {
	updates := map[string]interface{}{
		"status":     persistedStatus,
		"updated_at": now,
	}

	switch targetStatus {
	case "preparing":
		if order != nil && order.AirspaceStatus == "" {
			updates["airspace_status"] = "approved"
		}
	case "in_transit":
		updates["loading_confirmed_at"] = now
		updates["loading_confirmed_by"] = operatorUserID
		updates["flight_start_time"] = now
	case "delivered":
		updates["unloading_confirmed_at"] = now
		updates["unloading_confirmed_by"] = operatorUserID
		updates["flight_end_time"] = now
	}

	return updates
}

func executionStatusOptionalColumns() map[string]struct{} {
	return map[string]struct{}{
		"loading_confirmed_at":   {},
		"loading_confirmed_by":   {},
		"unloading_confirmed_at": {},
		"unloading_confirmed_by": {},
		"flight_start_time":      {},
		"flight_end_time":        {},
	}
}

func filterExecutionStatusUpdates(updates map[string]interface{}, hasColumn func(string) bool) map[string]interface{} {
	if len(updates) == 0 || hasColumn == nil {
		return updates
	}

	optionalColumns := executionStatusOptionalColumns()
	filtered := make(map[string]interface{}, len(updates))
	for column, value := range updates {
		if _, optional := optionalColumns[column]; optional && !hasColumn(column) {
			continue
		}
		filtered[column] = value
	}
	return filtered
}

func (s *OrderService) updateExecutionStatusWithRepos(userID int64, orderID int64, rawStatus string, orderRepo *repository.OrderRepo) (string, error) {
	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return "", errors.New("订单不存在")
	}
	if !s.CanAccessOrder(order, userID, "pilot") {
		return "", errors.New("无权操作此订单")
	}

	targetStatus := normalizeExecutionStatus(rawStatus)
	allowedStatuses := map[string]bool{
		"confirmed":         true,
		"airspace_applying": true,
		"airspace_approved": true,
		"preparing":         true,
		"in_transit":        true,
		"delivered":         true,
	}
	if !allowedStatuses[targetStatus] {
		return "", errors.New("无效的状态值")
	}

	currentStatus := normalizeExecutionStatus(order.Status)
	if err := validateExecutionStatusTransition(currentStatus, targetStatus); err != nil {
		return "", err
	}

	now := time.Now()
	updates := buildExecutionStatusUpdates(order, userID, targetStatus, rawStatus, now)
	if db := orderRepo.DB(); db != nil {
		updates = filterExecutionStatusUpdates(updates, func(column string) bool {
			return db.Migrator().HasColumn(&model.Order{}, column)
		})
	}
	if err := orderRepo.UpdateFields(orderID, updates); err != nil {
		return "", err
	}

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       rawStatus,
		Note:         executionStatusLabels()[targetStatus],
		OperatorID:   userID,
		OperatorType: "pilot",
	}); err != nil {
		return "", err
	}

	return targetStatus, nil
}

func (s *OrderService) UpdateExecutionStatus(userID int64, orderID int64, status string) error {
	db := s.orderRepo.DB()
	if db == nil {
		targetStatus, err := s.updateExecutionStatusWithRepos(userID, orderID, status, s.orderRepo)
		if err != nil {
			return err
		}
		if eventType, title, template, ok := executionStatusNotification(targetStatus); ok && s.eventService != nil {
			if order, orderErr := s.orderRepo.GetByID(orderID); orderErr == nil && order != nil {
				order.Status = status
				s.eventService.NotifyOrderStatusChanged(order, eventType, title, fmt.Sprintf(template, firstNonEmpty(order.Title, order.OrderNo, "订单")))
			}
		}
		return nil
	}

	targetStatus := ""
	if err := db.Transaction(func(tx *gorm.DB) error {
		nextStatus, txErr := s.updateExecutionStatusWithRepos(userID, orderID, status, repository.NewOrderRepo(tx))
		if txErr != nil {
			return txErr
		}
		targetStatus = nextStatus
		return nil
	}); err != nil {
		return err
	}

	if eventType, title, template, ok := executionStatusNotification(targetStatus); ok && s.eventService != nil {
		if order, err := s.orderRepo.GetByID(orderID); err == nil && order != nil {
			order.Status = status
			s.eventService.NotifyOrderStatusChanged(order, eventType, title, fmt.Sprintf(template, firstNonEmpty(order.Title, order.OrderNo, "订单")))
		}
	}
	return nil
}

func (s *OrderService) StartPreparing(userID int64, orderID int64) error {
	return s.UpdateExecutionStatus(userID, orderID, "preparing")
}

func (s *OrderService) StartFlight(userID int64, orderID int64) error {
	return s.UpdateExecutionStatus(userID, orderID, "in_transit")
}

func (s *OrderService) ConfirmDelivery(userID int64, orderID int64) error {
	return s.UpdateExecutionStatus(userID, orderID, "delivered")
}

func (s *OrderService) ConfirmReceipt(userID int64, orderID int64) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.ClientUserID != userID && order.RenterID != userID {
		return errors.New("无权确认此订单")
	}
	if order.Status != "delivered" {
		return errors.New("订单状态不允许确认签收")
	}

	now := time.Now()
	if err := s.orderRepo.UpdateFields(orderID, map[string]interface{}{
		"status":       "completed",
		"completed_at": &now,
	}); err != nil {
		return err
	}

	s.restoreDroneStatusIfNoActiveOrders(order.DroneID, orderID)

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       "completed",
		Note:         "客户已确认签收",
		OperatorID:   userID,
		OperatorType: "client",
	})

	if s.eventService != nil {
		s.eventService.NotifyOrderStatusChanged(order, "order_completed", "订单已完成", fmt.Sprintf("订单\u201c%s\u201d已完成。", firstNonEmpty(order.Title, order.OrderNo, "订单")))
	}

	return nil
}
