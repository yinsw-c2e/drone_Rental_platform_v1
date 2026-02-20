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
	orderRepo *repository.OrderRepo
	droneRepo *repository.DroneRepo
	cfg       *config.Config
	logger    *zap.Logger
}

func NewOrderService(orderRepo *repository.OrderRepo, droneRepo *repository.DroneRepo, cfg *config.Config, logger *zap.Logger) *OrderService {
	return &OrderService{orderRepo: orderRepo, droneRepo: droneRepo, cfg: cfg, logger: logger}
}

func (s *OrderService) CreateOrder(req *CreateOrderRequest) (*model.Order, error) {
	drone, err := s.droneRepo.GetByID(req.DroneID)
	if err != nil {
		return nil, errors.New("无人机不存在")
	}
	if drone.AvailabilityStatus != "available" {
		return nil, errors.New("该无人机当前不可用")
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
		RenterID:               req.RenterID,
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

	if err := s.orderRepo.Create(order); err != nil {
		return nil, err
	}

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      order.ID,
		Status:       "created",
		Note:         "订单已创建",
		OperatorID:   req.RenterID,
		OperatorType: "renter",
	})

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

	allowCancel := order.Status == "created" || order.Status == "accepted" || order.Status == "paid"
	if !allowCancel {
		return errors.New("当前状态不允许取消")
	}

	order.Status = "cancelled"
	order.CancelReason = reason
	order.CancelBy = role
	if err := s.orderRepo.Update(order); err != nil {
		return err
	}

	// Restore drone availability
	s.droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "available"})

	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID: orderID, Status: "cancelled", Note: "订单已取消: " + reason,
		OperatorID: userID, OperatorType: role,
	})
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

	s.droneRepo.UpdateFields(order.DroneID, map[string]interface{}{"availability_status": "available"})

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

func generateOrderNo() string {
	return fmt.Sprintf("WRJ%d", time.Now().UnixNano()/1000000)
}
