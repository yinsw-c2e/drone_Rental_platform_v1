package service

import (
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type OrderService struct {
	orderRepo  *repository.OrderRepo
	droneRepo  *repository.DroneRepo
	demandRepo *repository.DemandRepo
	cfg        *config.Config
	logger     *zap.Logger
}

func NewOrderService(orderRepo *repository.OrderRepo, droneRepo *repository.DroneRepo, demandRepo *repository.DemandRepo, cfg *config.Config, logger *zap.Logger) *OrderService {
	return &OrderService{orderRepo: orderRepo, droneRepo: droneRepo, demandRepo: demandRepo, cfg: cfg, logger: logger}
}

func (s *OrderService) CreateOrder(req *CreateOrderRequest) (*model.Order, error) {
	drone, err := s.droneRepo.GetByID(req.DroneID)
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
	}

	commissionRate := float64(s.cfg.Payment.CommissionRate)
	commission := int64(float64(req.TotalAmount) * commissionRate / 100)
	ownerAmount := req.TotalAmount - commission

	order := &model.Order{
		OrderNo:                generateOrderNo(),
		OrderType:              req.OrderType,
		RelatedID:              req.RelatedID,
		DroneID:                req.DroneID,
		OwnerID:                drone.OwnerID,
		RenterID:               renterID,
		Title:                  req.Title,
		ServiceType:            req.ServiceType,
		StartTime:              req.StartTime,
		EndTime:                req.EndTime,
		ServiceLatitude:        req.Latitude,
		ServiceLongitude:       req.Longitude,
		ServiceAddress:         req.Address,
		TotalAmount:            req.TotalAmount,
		PlatformCommissionRate: commissionRate,
		PlatformCommission:     commission,
		OwnerAmount:            ownerAmount,
		DepositAmount:          drone.Deposit,
		Status:                 "created",
	}

	// 货运订单自动接单
	if req.AutoAccept {
		order.Status = "accepted"
		// 更新无人机状态
		s.droneRepo.UpdateFields(req.DroneID, map[string]interface{}{"availability_status": "rented"})
	}

	if err := s.orderRepo.Create(order); err != nil {
		return nil, err
	}

	// 记录创建时间线
	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "created",
		Note:         "订单已创建",
		OperatorID:   renterID,
		OperatorType: "renter",
	})

	// 如果自动接单，记录接单时间线
	if req.AutoAccept {
		s.orderRepo.AddTimeline(&model.OrderTimeline{
			OrderID:      order.ID,
			Status:       "accepted",
			Note:         "飞手已接单",
			OperatorID:   drone.OwnerID,
			OperatorType: "owner",
		})
	}

	return order, nil
}

type CreateOrderRequest struct {
	OrderType   string    `json:"order_type"`
	RelatedID   int64     `json:"related_id"`
	DroneID     int64     `json:"drone_id"`
	RenterID    int64     `json:"-"`
	Title       string    `json:"title"`
	ServiceType string    `json:"service_type"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Latitude    float64   `json:"latitude"`
	Longitude   float64   `json:"longitude"`
	Address     string    `json:"address"`
	TotalAmount int64     `json:"total_amount"`
	AutoAccept  bool      `json:"auto_accept"` // 货运订单自动接单
}

func (s *OrderService) AcceptOrder(orderID, ownerID int64) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.Status != "created" {
		return errors.New("订单状态不允许此操作")
	}

	if err := s.orderRepo.UpdateStatus(orderID, "accepted"); err != nil {
		return err
	}

	// 更新无人机状态为已出租
	s.droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "rented"})

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "accepted", Note: "订单已接受",
		OperatorID: ownerID, OperatorType: "owner",
	})
	return nil
}

func (s *OrderService) RejectOrder(orderID, ownerID int64, reason string) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.Status != "created" {
		return errors.New("订单状态不允许此操作")
	}

	order.Status = "rejected"
	order.CancelReason = reason
	order.CancelBy = "owner"
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "rejected", Note: "订单已拒绝: " + reason,
		OperatorID: ownerID, OperatorType: "owner",
	})
	return nil
}

func (s *OrderService) CancelOrder(orderID, userID int64, reason, role string) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}

	// 判断是否允许取消
	if order.Status == "completed" || order.Status == "cancelled" || order.Status == "refunded" {
		return errors.New("该订单不能取消")
	}

	// 如果订单已开始（in_progress），不允许取消
	if order.Status == "in_progress" {
		return errors.New("服务已开始，无法取消。请在服务结束后协商解决")
	}

	// 计算退款金额（如果已支付）
	var refundAmount int64 = 0
	var refundReason string

	if order.Status == "paid" {
		now := time.Now()

		// 退款策略：
		// 1. 开始时间前24小时以上：全额退款
		// 2. 开始时间前24小时内：退款70%
		// 3. 开始时间后：不退款

		hoursUntilStart := order.StartTime.Sub(now).Hours()

		if hoursUntilStart > 24 {
			// 全额退款（订单金额 + 压金）
			refundAmount = order.TotalAmount + order.DepositAmount
			refundReason = "提前24小时以上取消，全额退款"
		} else if hoursUntilStart > 0 {
			// 部分退款：订单金额70% + 全部压金
			refundAmount = int64(float64(order.TotalAmount)*0.7) + order.DepositAmount
			refundReason = fmt.Sprintf("提前%.1f小时取消，退款70%%订单金额和全部压金", hoursUntilStart)
		} else {
			// 开始时间后，不退款
			return errors.New("服务已过开始时间，无法取消")
		}
	}

	// 更新订单状态
	order.Status = "cancelled"
	order.CancelReason = reason
	order.CancelBy = role
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}

	// 检查是否还有其他活跃订单，如果没有则恢复无人机状态
	s.restoreDroneStatusIfNoActiveOrders(order.DroneID, orderID)

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "cancelled", Note: "订单已取消: " + reason,
		OperatorID: userID, OperatorType: role,
	})

	// 如果有退款，创建退款记录
	if refundAmount > 0 {
		s.logger.Info("Creating refund",
			zap.Int64("order_id", orderID),
			zap.Int64("refund_amount", refundAmount),
			zap.String("reason", refundReason),
		)
		// TODO: 实际生产环境中，需要调用支付服务的退款接口
		// 这里先记录日志，实际退款由PaymentService处理
	}

	return nil
}

func (s *OrderService) StartOrder(orderID, ownerID int64) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.OwnerID != ownerID {
		return errors.New("无权操作此订单")
	}
	if order.Status != "paid" {
		return errors.New("订单未支付，无法开始")
	}

	if err := s.orderRepo.UpdateStatus(orderID, "in_progress"); err != nil {
		return err
	}

	s.droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "rented"})

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "in_progress", Note: "服务已开始",
		OperatorID: ownerID, OperatorType: "owner",
	})
	return nil
}

func (s *OrderService) CompleteOrder(orderID, userID int64, role string) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.Status != "in_progress" {
		return errors.New("订单状态不允许完成")
	}

	if err := s.orderRepo.UpdateStatus(orderID, "completed"); err != nil {
		return err
	}

	// 检查是否还有其他活跃订单，如果没有则恢复无人机状态
	s.restoreDroneStatusIfNoActiveOrders(order.DroneID, orderID)

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "completed", Note: "订单已完成",
		OperatorID: userID, OperatorType: role,
	})
	return nil
}

func (s *OrderService) GetOrder(orderID int64) (*model.Order, error) {
	return s.orderRepo.GetByID(orderID)
}

func (s *OrderService) ListOrders(userID int64, role, status string, page, pageSize int) ([]model.Order, int64, error) {
	return s.orderRepo.ListByUser(userID, role, status, page, pageSize)
}

func (s *OrderService) GetTimeline(orderID int64) ([]model.OrderTimeline, error) {
	return s.orderRepo.GetTimeline(orderID)
}

func (s *OrderService) AdminListOrders(page, pageSize int, filters map[string]interface{}) ([]model.Order, int64, error) {
	return s.orderRepo.List(page, pageSize, filters)
}

func (s *OrderService) GetStatistics() (map[string]int64, error) {
	return s.orderRepo.GetStatistics()
}

// restoreDroneStatusIfNoActiveOrders 检查无人机是否还有其他活跃订单，如果没有则恢复为可用状态
func (s *OrderService) restoreDroneStatusIfNoActiveOrders(droneID, excludeOrderID int64) {
	// 查询是否还有其他进行中的订单
	activeStatuses := []string{"accepted", "paid", "in_progress"}
	hasOtherOrders := false

	for _, status := range activeStatuses {
		orders, _, _ := s.orderRepo.List(1, 1, map[string]interface{}{
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
		s.droneRepo.UpdateFields(droneID, map[string]interface{}{"availability_status": "available"})
	}
}

func generateOrderNo() string {
	return fmt.Sprintf("WRJ%d", time.Now().UnixNano()/1000000)
}
