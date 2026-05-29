package service

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"

	"wurenji-backend/internal/model"
	paymentpkg "wurenji-backend/internal/pkg/payment"
	"wurenji-backend/internal/repository"
)

func TestNormalizePaymentMethod(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "mock", input: "mock", want: "mock"},
		{name: "wechat upper", input: " WeChat ", want: "wechat"},
		{name: "alipay", input: "alipay", want: "alipay"},
		{name: "invalid", input: "bank", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizePaymentMethod(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %s, got %s", tt.want, got)
			}
		})
	}
}

func TestBuildCreatePaymentResult(t *testing.T) {
	tests := []struct {
		method                 string
		wantAutoComplete       bool
		wantRequiresExternalCB bool
		wantDeferred           bool
	}{
		{method: "mock", wantAutoComplete: true, wantRequiresExternalCB: false, wantDeferred: false},
		{method: "wechat", wantAutoComplete: false, wantRequiresExternalCB: true, wantDeferred: true},
		{method: "alipay", wantAutoComplete: false, wantRequiresExternalCB: true, wantDeferred: true},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			result, err := buildCreatePaymentResult(tt.method, "PAY_TEST_001")
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.PaymentNo != "PAY_TEST_001" {
				t.Fatalf("expected payment no to stay aligned, got %s", result.PaymentNo)
			}

			var payload map[string]interface{}
			if err := json.Unmarshal([]byte(result.PayParams), &payload); err != nil {
				t.Fatalf("failed to parse pay params: %v", err)
			}

			if payload["method"] != tt.method {
				t.Fatalf("expected method %s, got %#v", tt.method, payload["method"])
			}
			if payload["payment_no"] != "PAY_TEST_001" {
				t.Fatalf("expected payment_no PAY_TEST_001, got %#v", payload["payment_no"])
			}
			if payload["auto_complete"] != tt.wantAutoComplete {
				t.Fatalf("expected auto_complete=%v, got %#v", tt.wantAutoComplete, payload["auto_complete"])
			}
			if payload["requires_external_callback"] != tt.wantRequiresExternalCB {
				t.Fatalf("expected requires_external_callback=%v, got %#v", tt.wantRequiresExternalCB, payload["requires_external_callback"])
			}

			_, hasDeferred := payload["deferred"]
			if hasDeferred != tt.wantDeferred {
				t.Fatalf("expected deferred presence=%v, got %v", tt.wantDeferred, hasDeferred)
			}
		})
	}
}

func TestCreatePaymentRequiresFullySignedContract(t *testing.T) {
	db := newServiceTestDB(t, &model.Order{}, &model.OrderContract{}, &model.Payment{})

	orderRepo := repository.NewOrderRepo(db)
	paymentRepo := repository.NewPaymentRepo(db)
	contractRepo := repository.NewContractRepo(db)

	order := &model.Order{
		OrderNo:      "ORD202604160001",
		OrderSource:  "supply_direct",
		ClientUserID: 301,
		RenterID:     301,
		Status:       "pending_payment",
		TotalAmount:  88000,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}
	if err := contractRepo.Create(&model.OrderContract{
		OrderID:        order.ID,
		OrderNo:        order.OrderNo,
		Status:         "client_signed",
		ClientUserID:   301,
		ProviderUserID: 401,
	}); err != nil {
		t.Fatalf("create contract: %v", err)
	}

	service := NewPaymentService(paymentRepo, orderRepo, nil, nil, nil, nil, nil)
	service.SetContractRepo(contractRepo)

	_, _, err := service.CreatePayment(order.ID, 301, "mock")
	if err == nil {
		t.Fatal("expected contract gating error, got nil")
	}
	if !strings.Contains(err.Error(), "合同签署") {
		t.Fatalf("expected contract signing error, got %v", err)
	}
}

func TestCreatePaymentRejectsMockWhenDisabled(t *testing.T) {
	db := newServiceTestDB(t, &model.Order{}, &model.Payment{})

	orderRepo := repository.NewOrderRepo(db)
	paymentRepo := repository.NewPaymentRepo(db)

	order := &model.Order{
		OrderNo:      "ORD202604160002",
		OrderSource:  "supply_direct",
		ClientUserID: 302,
		RenterID:     302,
		Status:       "pending_payment",
		TotalAmount:  66000,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := NewPaymentService(paymentRepo, orderRepo, nil, nil, nil, nil, nil)
	service.SetAllowMockPayments(false)

	_, _, err := service.CreatePayment(order.ID, 302, "mock")
	if err == nil {
		t.Fatal("expected mock disabled error, got nil")
	}
	if !strings.Contains(err.Error(), "不允许模拟支付") {
		t.Fatalf("expected mock disabled error, got %v", err)
	}
}

func TestMockPaymentCompleteRejectsWhenDisabled(t *testing.T) {
	db := newServiceTestDB(t, &model.Order{}, &model.Payment{})
	service := NewPaymentService(repository.NewPaymentRepo(db), repository.NewOrderRepo(db), nil, nil, nil, nil, nil)
	service.SetAllowMockPayments(false)

	err := service.MockPaymentComplete("PAY_TEST_002")
	if err == nil {
		t.Fatal("expected mock disabled error, got nil")
	}
	if !strings.Contains(err.Error(), "不允许模拟支付") {
		t.Fatalf("expected mock disabled error, got %v", err)
	}
}

func TestRefundPaymentIsIdempotentAndDoesNotDuplicateTimeline(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.Payment{},
		&model.Refund{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
	)
	orderRepo := repository.NewOrderRepo(db)
	paymentRepo := repository.NewPaymentRepo(db)
	artifactRepo := repository.NewOrderArtifactRepo(db)

	paidAt := time.Now().Add(-30 * time.Minute)
	order := &model.Order{
		OrderNo:      "WRJ-REFUND-IDEMPOTENT",
		OrderType:    "cargo",
		OrderMode:    OrderModeInstant,
		OrderSource:  OrderModeInstant,
		ClientUserID: 46,
		RenterID:     46,
		Status:       "cancelled",
		TotalAmount:  108400,
		PaidAt:       &paidAt,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}
	p := &model.Payment{
		PaymentNo:     "PAY-REFUND-IDEMPOTENT",
		OrderID:       order.ID,
		UserID:        order.ClientUserID,
		PaymentType:   "order",
		PaymentMethod: "mock",
		Amount:        108400,
		Status:        "paid",
		PaidAt:        &paidAt,
	}
	if err := paymentRepo.Create(p); err != nil {
		t.Fatalf("create payment: %v", err)
	}
	if err := artifactRepo.CreateRefund(&model.Refund{
		RefundNo:  repository.GenerateRefundNo(),
		OrderID:   order.ID,
		PaymentID: p.ID,
		Amount:    108400,
		Reason:    "取消退款",
		Status:    "pending",
	}); err != nil {
		t.Fatalf("create refund: %v", err)
	}

	service := NewPaymentService(paymentRepo, orderRepo, nil, nil, artifactRepo, paymentpkg.NewMockPayment(zap.NewNop()), nil)
	for i := 0; i < 2; i++ {
		if err := service.RefundPayment(order.ID, order.ClientUserID); err != nil {
			t.Fatalf("refund payment attempt %d: %v", i+1, err)
		}
	}

	var refund model.Refund
	if err := db.Where("payment_id = ?", p.ID).First(&refund).Error; err != nil {
		t.Fatalf("load refund: %v", err)
	}
	if refund.Status != "success" {
		t.Fatalf("expected success refund, got %#v", refund)
	}
	var payment model.Payment
	if err := db.First(&payment, p.ID).Error; err != nil {
		t.Fatalf("load payment: %v", err)
	}
	if payment.Status != "refunded" {
		t.Fatalf("expected refunded payment, got %#v", payment)
	}
	var refundedTimelineCount int64
	if err := db.Model(&model.OrderTimeline{}).
		Where("order_id = ? AND status = ?", order.ID, "refunded").
		Count(&refundedTimelineCount).Error; err != nil {
		t.Fatalf("count refund timeline: %v", err)
	}
	if refundedTimelineCount != 1 {
		t.Fatalf("expected one refunded timeline, got %d", refundedTimelineCount)
	}
}
