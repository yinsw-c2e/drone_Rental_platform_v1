package service

import (
	"errors"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/payment"
	"wurenji-backend/internal/repository"
)

type PaymentService struct {
	paymentRepo *repository.PaymentRepo
	orderRepo   *repository.OrderRepo
	provider    payment.PaymentProvider
	logger      *zap.Logger
}

func NewPaymentService(paymentRepo *repository.PaymentRepo, orderRepo *repository.OrderRepo, provider payment.PaymentProvider, logger *zap.Logger) *PaymentService {
	return &PaymentService{paymentRepo: paymentRepo, orderRepo: orderRepo, provider: provider, logger: logger}
}

func (s *PaymentService) CreatePayment(orderID, userID int64, method string) (*model.Payment, *payment.PaymentResult, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, nil, errors.New("订单不存在")
	}
	if order.Status != "accepted" {
		return nil, nil, errors.New("订单状态不允许支付")
	}
	if order.RenterID != userID {
		return nil, nil, errors.New("无权操作此订单")
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
	p, err := s.paymentRepo.GetByPaymentNo(paymentNo)
	if err != nil {
		return errors.New("支付记录不存在")
	}
	if p.Status == "paid" {
		return nil // Idempotent
	}

	now := time.Now()
	p.Status = "paid"
	p.ThirdPartyNo = thirdPartyNo
	p.PaidAt = &now
	if err := s.paymentRepo.Update(p); err != nil {
		return err
	}

	// Update order status
	s.orderRepo.UpdateStatus(p.OrderID, "paid")
	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      p.OrderID,
		Status:       "paid",
		Note:         "支付成功",
		OperatorID:   p.UserID,
		OperatorType: "system",
	})

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
	payments, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil || len(payments) == 0 {
		return errors.New("未找到支付记录")
	}

	for _, p := range payments {
		if p.Status == "paid" {
			_, refundErr := s.provider.Refund(p.PaymentNo, p.Amount)
			if refundErr != nil {
				s.logger.Error("refund failed", zap.String("payment_no", p.PaymentNo), zap.Error(refundErr))
				continue
			}
			p.Status = "refunded"
			s.paymentRepo.Update(&p)
		}
	}

	s.orderRepo.UpdateStatus(orderID, "refunded")
	s.orderRepo.AddTimeline(&model.OrderTimeline{
		OrderID:      orderID,
		Status:       "refunded",
		Note:         "退款已处理",
		OperatorID:   userID,
		OperatorType: "system",
	})

	return nil
}

func (s *PaymentService) ListByUser(userID int64, page, pageSize int) ([]model.Payment, int64, error) {
	return s.paymentRepo.ListByUser(userID, page, pageSize)
}

func (s *PaymentService) AdminList(page, pageSize int) ([]model.Payment, int64, error) {
	return s.paymentRepo.List(page, pageSize)
}
