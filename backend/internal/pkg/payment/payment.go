package payment

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type PaymentProvider interface {
	CreatePayment(orderNo string, amount int64, description string) (*PaymentResult, error)
	QueryPayment(paymentNo string) (*PaymentStatus, error)
	Refund(paymentNo string, amount int64) (*RefundResult, error)
}

type PaymentResult struct {
	PaymentNo string `json:"payment_no"`
	PayParams string `json:"pay_params"` // JSON string for client SDK
}

type PaymentStatus struct {
	PaymentNo    string `json:"payment_no"`
	Status       string `json:"status"`
	ThirdPartyNo string `json:"third_party_no"`
}

type RefundResult struct {
	RefundNo string `json:"refund_no"`
	Status   string `json:"status"`
}

// MockPayment implements PaymentProvider for development
type MockPayment struct {
	logger *zap.Logger
}

func NewMockPayment(logger *zap.Logger) *MockPayment {
	return &MockPayment{logger: logger}
}

func (m *MockPayment) CreatePayment(orderNo string, amount int64, description string) (*PaymentResult, error) {
	paymentNo := fmt.Sprintf("MOCK_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])
	m.logger.Info("mock payment created",
		zap.String("order_no", orderNo),
		zap.Int64("amount", amount),
		zap.String("payment_no", paymentNo),
	)
	return &PaymentResult{
		PaymentNo: paymentNo,
		PayParams: `{"mock": true}`,
	}, nil
}

func (m *MockPayment) QueryPayment(paymentNo string) (*PaymentStatus, error) {
	return &PaymentStatus{
		PaymentNo:    paymentNo,
		Status:       "paid",
		ThirdPartyNo: "MOCK_THIRD_" + paymentNo,
	}, nil
}

func (m *MockPayment) Refund(paymentNo string, amount int64) (*RefundResult, error) {
	refundNo := fmt.Sprintf("REFUND_%d_%s", time.Now().UnixMilli(), uuid.New().String()[:8])
	m.logger.Info("mock refund processed",
		zap.String("payment_no", paymentNo),
		zap.Int64("amount", amount),
	)
	return &RefundResult{
		RefundNo: refundNo,
		Status:   "refunded",
	}, nil
}

func GeneratePaymentNo() string {
	return fmt.Sprintf("PAY%d%s", time.Now().UnixMilli(), uuid.New().String()[:6])
}
