package service

import (
	"errors"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/payment"
	"wurenji-backend/internal/repository"
)

type PaymentService struct {
	paymentRepo       *repository.PaymentRepo
	orderRepo         *repository.OrderRepo
	droneRepo         *repository.DroneRepo
	pilotRepo         *repository.PilotRepo
	orderArtifactRepo *repository.OrderArtifactRepo
	dispatchService   *DispatchService
	eventService      *EventService
	provider          payment.PaymentProvider
	logger            *zap.Logger
}

func NewPaymentService(
	paymentRepo *repository.PaymentRepo,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	orderArtifactRepo *repository.OrderArtifactRepo,
	provider payment.PaymentProvider,
	logger *zap.Logger,
) *PaymentService {
	return &PaymentService{
		paymentRepo:       paymentRepo,
		orderRepo:         orderRepo,
		droneRepo:         droneRepo,
		pilotRepo:         pilotRepo,
		orderArtifactRepo: orderArtifactRepo,
		provider:          provider,
		logger:            logger,
	}
}

func (s *PaymentService) SetDispatchService(dispatchService *DispatchService) {
	s.dispatchService = dispatchService
}

func (s *PaymentService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

func (s *PaymentService) CreatePayment(orderID, userID int64, method string) (*model.Payment, *payment.PaymentResult, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, nil, errors.New("订单不存在")
	}
	if order.RenterID != userID && order.ClientUserID != userID {
		return nil, nil, errors.New("无权操作此订单")
	}
	if order.PaidAt != nil || isOrderPaidOrBeyond(order.Status) {
		return nil, nil, errors.New("订单已支付，无需重复支付")
	}
	if order.Status != "pending_payment" && order.Status != "accepted" {
		return nil, nil, errors.New("订单状态不允许支付")
	}

	amount := order.TotalAmount + order.DepositAmount
	paymentNo := payment.GeneratePaymentNo()

	result, err := s.provider.CreatePayment(order.OrderNo, amount, order.Title)
	if err != nil {
		return nil, nil, err
	}

	p := &model.Payment{
		PaymentNo:     paymentNo,
		OrderID:       orderID,
		UserID:        userID,
		PaymentType:   "order",
		PaymentMethod: method,
		Amount:        amount,
		Status:        "pending",
	}
	if err := s.paymentRepo.Create(p); err != nil {
		return nil, nil, err
	}

	return p, result, nil
}

func (s *PaymentService) HandlePaymentCallback(paymentNo, thirdPartyNo string) error {
	shouldNotify := false
	if existing, err := s.paymentRepo.GetByPaymentNo(paymentNo); err == nil && existing != nil && existing.Status != "paid" {
		shouldNotify = true
	}

	db := s.paymentRepo.DB()
	if db == nil {
		err := s.handlePaymentCallbackWithRepos(paymentNo, thirdPartyNo, s.paymentRepo, s.orderRepo, s.droneRepo, s.pilotRepo, s.orderArtifactRepo)
		if err != nil {
			return err
		}
		if err := s.triggerAutoDispatchIfNeeded(paymentNo); err != nil {
			return err
		}
		if shouldNotify && s.eventService != nil {
			if paymentRecord, err := s.paymentRepo.GetByPaymentNo(paymentNo); err == nil && paymentRecord != nil {
				if order, orderErr := s.orderRepo.GetByID(paymentRecord.OrderID); orderErr == nil && order != nil {
					s.eventService.NotifyOrderPaid(order)
				}
			}
		}
		return nil
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return s.handlePaymentCallbackWithRepos(
			paymentNo,
			thirdPartyNo,
			repository.NewPaymentRepo(tx),
			repository.NewOrderRepo(tx),
			repository.NewDroneRepo(tx),
			repository.NewPilotRepo(tx),
			repository.NewOrderArtifactRepo(tx),
		)
	}); err != nil {
		return err
	}
	if err := s.triggerAutoDispatchIfNeeded(paymentNo); err != nil {
		return err
	}
	if shouldNotify && s.eventService != nil {
		if paymentRecord, err := s.paymentRepo.GetByPaymentNo(paymentNo); err == nil && paymentRecord != nil {
			if order, orderErr := s.orderRepo.GetByID(paymentRecord.OrderID); orderErr == nil && order != nil {
				s.eventService.NotifyOrderPaid(order)
			}
		}
	}
	return nil
}

// MockPaymentComplete simulates successful payment for development
func (s *PaymentService) MockPaymentComplete(paymentNo string) error {
	return s.HandlePaymentCallback(paymentNo, "MOCK_"+paymentNo)
}

func (s *PaymentService) GetPaymentStatus(paymentNo string) (*model.Payment, error) {
	return s.paymentRepo.GetByPaymentNo(paymentNo)
}

func (s *PaymentService) RefundPayment(orderID, userID int64) error {
	return s.refundPaymentWithRepos(orderID, userID, s.paymentRepo, s.orderRepo, s.orderArtifactRepo)
}

func (s *PaymentService) ListByUser(userID int64, page, pageSize int) ([]model.Payment, int64, error) {
	return s.paymentRepo.ListByUser(userID, page, pageSize)
}

func (s *PaymentService) AdminList(page, pageSize int) ([]model.Payment, int64, error) {
	return s.paymentRepo.List(page, pageSize)
}

func (s *PaymentService) handlePaymentCallbackWithRepos(
	paymentNo, thirdPartyNo string,
	paymentRepo *repository.PaymentRepo,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
) error {
	p, err := paymentRepo.GetByPaymentNo(paymentNo)
	if err != nil {
		return errors.New("支付记录不存在")
	}
	order, err := orderRepo.GetByID(p.OrderID)
	if err != nil {
		return errors.New("订单不存在")
	}

	if p.Status == "paid" {
		paidAt := p.PaidAt
		if paidAt == nil {
			now := time.Now()
			paidAt = &now
		}
		if order.PaidAt == nil {
			if err := orderRepo.UpdateFields(p.OrderID, map[string]interface{}{"paid_at": paidAt}); err != nil {
				return err
			}
			order.PaidAt = paidAt
		}
		if order.Status == "pending_payment" || order.Status == "accepted" || order.Status == "paid" {
			return s.advanceOrderAfterPaymentWithRepos(order, p.UserID, paidAt, orderRepo, droneRepo, pilotRepo, artifactRepo)
		}
		if artifactRepo != nil {
			order.PaidAt = paidAt
			return repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil)
		}
		return nil
	}

	now := time.Now()
	p.Status = "paid"
	p.ThirdPartyNo = thirdPartyNo
	p.PaidAt = &now
	if err := paymentRepo.Update(p); err != nil {
		return err
	}

	return s.advanceOrderAfterPaymentWithRepos(order, p.UserID, &now, orderRepo, droneRepo, pilotRepo, artifactRepo)
}

func (s *PaymentService) refundPaymentWithRepos(
	orderID, userID int64,
	paymentRepo *repository.PaymentRepo,
	orderRepo *repository.OrderRepo,
	artifactRepo *repository.OrderArtifactRepo,
) error {
	if artifactRepo == nil {
		return errors.New("退款记录依赖未初始化")
	}

	order, err := orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.RenterID != userID && order.ClientUserID != userID {
		return errors.New("无权对该订单发起退款")
	}

	payments, err := paymentRepo.GetByOrderID(orderID)
	if err != nil || len(payments) == 0 {
		return errors.New("未找到支付记录")
	}

	refunds, err := artifactRepo.ListRefundsByOrder(orderID)
	if err != nil {
		return err
	}

	refundByPaymentID := make(map[int64]*model.Refund, len(refunds))
	for i := range refunds {
		refundByPaymentID[refunds[i].PaymentID] = &refunds[i]
	}

	if len(refundByPaymentID) == 0 {
		return errors.New("未找到待处理退款记录，请先取消订单")
	}

	var refundedAmount int64
	refundSuccessCount := 0
	for _, p := range payments {
		refundRecord, ok := refundByPaymentID[p.ID]
		if !ok || refundRecord == nil {
			continue
		}
		if refundRecord.Status == "success" {
			refundedAmount += refundRecord.Amount
			refundSuccessCount++
			continue
		}

		refundRecord.Status = "processing"
		if err := artifactRepo.UpdateRefund(refundRecord); err != nil {
			return err
		}

		_, refundErr := s.provider.Refund(p.PaymentNo, refundRecord.Amount)
		if refundErr != nil {
			refundRecord.Status = "failed"
			_ = artifactRepo.UpdateRefund(refundRecord)
			if s.logger != nil {
				s.logger.Error("refund failed",
					zap.String("payment_no", p.PaymentNo),
					zap.Int64("refund_id", refundRecord.ID),
					zap.Error(refundErr),
				)
			}
			return refundErr
		}

		refundRecord.Status = "success"
		if err := artifactRepo.UpdateRefund(refundRecord); err != nil {
			return err
		}

		refundedAmount += refundRecord.Amount
		refundSuccessCount++
	}

	if refundSuccessCount == 0 {
		return errors.New("没有可处理的退款记录")
	}

	for _, p := range payments {
		refundRecord, ok := refundByPaymentID[p.ID]
		if !ok || refundRecord == nil || refundRecord.Status != "success" {
			continue
		}

		totalRefundedForPayment := refundRecord.Amount
		if totalRefundedForPayment >= p.Amount {
			p.Status = "refunded"
			if err := paymentRepo.Update(&p); err != nil {
				return err
			}
		}
	}

	if err := orderRepo.UpdateStatus(orderID, "refunded"); err != nil {
		return err
	}
	order.Status = "refunded"

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       "refunded",
		Note:         "退款已处理",
		OperatorID:   userID,
		OperatorType: "system",
	}); err != nil {
		return err
	}

	if artifactRepo != nil {
		if err := artifactRepo.UpsertSnapshot(orderID, "execution", repository.BuildExecutionSnapshot(order)); err != nil {
			return err
		}
	}

	if s.logger != nil {
		s.logger.Info("order refund completed",
			zap.Int64("order_id", orderID),
			zap.Int64("refunded_amount", refundedAmount),
		)
	}

	return nil
}

func (s *PaymentService) advanceOrderAfterPaymentWithRepos(
	order *model.Order,
	operatorUserID int64,
	paidAt *time.Time,
	orderRepo *repository.OrderRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
	artifactRepo *repository.OrderArtifactRepo,
) error {
	if order == nil || orderRepo == nil {
		return errors.New("订单不存在")
	}

	targetStatus, updates, targetNote, err := resolvePostPaymentTransition(order, paidAt, pilotRepo)
	if err != nil {
		return err
	}
	if err := orderRepo.UpdateFields(order.ID, updates); err != nil {
		return err
	}
	if droneRepo != nil && order.DroneID > 0 {
		if err := droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "rented"}); err != nil {
			return err
		}
	}

	order.Status = targetStatus
	order.PaidAt = paidAt
	if pilotID, ok := updates["pilot_id"].(int64); ok {
		order.PilotID = pilotID
	}
	if executorPilotUserID, ok := updates["executor_pilot_user_id"].(int64); ok {
		order.ExecutorPilotUserID = executorPilotUserID
	}
	if needsDispatch, ok := updates["needs_dispatch"].(bool); ok {
		order.NeedsDispatch = needsDispatch
	}
	if executionMode, ok := updates["execution_mode"].(string); ok {
		order.ExecutionMode = executionMode
	}

	if err := orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "paid",
		Note:         "支付成功",
		OperatorID:   operatorUserID,
		OperatorType: "system",
	}); err != nil {
		return err
	}
	if targetStatus != "paid" {
		if err := orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      order.ID,
			Status:       targetStatus,
			Note:         targetNote,
			OperatorID:   operatorUserID,
			OperatorType: "system",
		}); err != nil {
			return err
		}
	}

	return repository.UpsertOrderSnapshotBundle(artifactRepo, order, nil, nil)
}

func resolvePostPaymentTransition(order *model.Order, paidAt *time.Time, pilotRepo *repository.PilotRepo) (string, map[string]interface{}, string, error) {
	if order == nil {
		return "", nil, "", errors.New("订单不存在")
	}

	updates := map[string]interface{}{
		"paid_at":    paidAt,
		"updated_at": time.Now(),
	}

	executionMode := order.ExecutionMode
	if executionMode == "" {
		if order.ExecutorPilotUserID > 0 || order.PilotID > 0 {
			executionMode = "self_execute"
		} else {
			executionMode = "dispatch_pool"
		}
	}

	if executionMode == "self_execute" {
		pilotID := order.PilotID
		executorPilotUserID := order.ExecutorPilotUserID
		if executorPilotUserID == 0 {
			executorPilotUserID = order.ProviderUserID
		}
		if pilotID == 0 && executorPilotUserID > 0 && pilotRepo != nil {
			if pilot, err := pilotRepo.GetByUserID(executorPilotUserID); err == nil && pilot != nil && pilot.VerificationStatus == "verified" {
				pilotID = pilot.ID
			}
		}
		if pilotID == 0 || executorPilotUserID == 0 {
			executionMode = "dispatch_pool"
		} else {
			updates["status"] = "assigned"
			updates["execution_mode"] = "self_execute"
			updates["needs_dispatch"] = false
			updates["pilot_id"] = pilotID
			updates["executor_pilot_user_id"] = executorPilotUserID
			return "assigned", updates, "支付成功，订单进入自执行", nil
		}
	}

	updates["status"] = "pending_dispatch"
	updates["execution_mode"] = "dispatch_pool"
	updates["needs_dispatch"] = true
	return "pending_dispatch", updates, "支付成功，订单待派单", nil
}

func isOrderPaidOrBeyond(status string) bool {
	switch status {
	case "paid", "pending_dispatch", "assigned", "preparing", "in_progress", "delivered", "completed", "refunding", "refunded":
		return true
	default:
		return false
	}
}

func (s *PaymentService) triggerAutoDispatchIfNeeded(paymentNo string) error {
	if s.dispatchService == nil || s.paymentRepo == nil || s.orderRepo == nil {
		return nil
	}
	paymentRecord, err := s.paymentRepo.GetByPaymentNo(paymentNo)
	if err != nil || paymentRecord == nil {
		return err
	}
	order, err := s.orderRepo.GetByID(paymentRecord.OrderID)
	if err != nil || order == nil {
		return err
	}
	if order.Status != "pending_dispatch" || !order.NeedsDispatch {
		return nil
	}
	if _, err := s.dispatchService.EnsureOrderDispatch(order.ID); err != nil && s.logger != nil {
		s.logger.Warn("payment callback auto dispatch failed",
			zap.Int64("order_id", order.ID),
			zap.Error(err),
		)
	}
	return nil
}
