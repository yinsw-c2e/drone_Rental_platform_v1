package order

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
)

func TestBuildAggregatedOrderTimelineSortsAndExpandsSources(t *testing.T) {
	base := time.Date(2026, 4, 14, 12, 0, 0, 0, time.Local)
	paidAt := base.Add(-6 * time.Hour)
	sentAt := base.Add(-5 * time.Hour)
	respondedAt := base.Add(-4 * time.Hour)
	takeoffAt := base.Add(-3 * time.Hour)
	landingAt := base.Add(-2 * time.Hour)
	refundAt := base.Add(-1 * time.Hour)

	events := buildAggregatedOrderTimeline(
		[]model.OrderTimeline{
			{
				ID:           11,
				Status:       "pending_payment",
				Note:         "客户已选择机主报价，订单待支付",
				OperatorID:   4,
				OperatorType: "client",
				CreatedAt:    base.Add(-7 * time.Hour),
			},
		},
		[]model.Payment{
			{
				ID:            21,
				PaymentNo:     "PAY001",
				PaymentType:   "order",
				PaymentMethod: "mock",
				Amount:        158000,
				Status:        "paid",
				PaidAt:        &paidAt,
				CreatedAt:     base.Add(-6*time.Hour - 10*time.Minute),
			},
		},
		[]model.Refund{
			{
				ID:        31,
				RefundNo:  "RF001",
				PaymentID: 21,
				Amount:    158000,
				Reason:    "用户取消",
				Status:    "completed",
				CreatedAt: refundAt,
			},
		},
		[]model.FormalDispatchTask{
			{
				ID:             41,
				DispatchNo:     "DP001",
				OrderID:        99,
				DispatchSource: "candidate_pool",
				Status:         "accepted",
				SentAt:         &sentAt,
				RespondedAt:    &respondedAt,
				CreatedAt:      sentAt,
			},
		},
		[]model.FlightRecord{
			{
				ID:        51,
				FlightNo:  "FL001",
				OrderID:   99,
				Status:    "completed",
				TakeoffAt: &takeoffAt,
				LandingAt: &landingAt,
				CreatedAt: takeoffAt,
			},
		},
	)

	if len(events) != 7 {
		t.Fatalf("expected 7 timeline events, got %d", len(events))
	}

	if events[0].EventType != "refund_completed" {
		t.Fatalf("expected newest event to be refund_completed, got %s", events[0].EventType)
	}
	if events[1].EventType != "flight_landing" {
		t.Fatalf("expected second event to be flight_landing, got %s", events[1].EventType)
	}
	if events[len(events)-1].EventType != "order_status_changed" {
		t.Fatalf("expected oldest event to be order_status_changed, got %s", events[len(events)-1].EventType)
	}

	foundDispatchSent := false
	foundDispatchAccepted := false
	foundFlightTakeoff := false
	for _, event := range events {
		switch event.EventType {
		case "dispatch_sent":
			foundDispatchSent = true
		case "dispatch_accepted":
			foundDispatchAccepted = true
		case "flight_takeoff":
			foundFlightTakeoff = true
		}
	}

	if !foundDispatchSent || !foundDispatchAccepted || !foundFlightTakeoff {
		t.Fatalf("expected dispatch and flight node events to be present, got %#v", events)
	}
}
