package order

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"
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

func TestRedispatchOrderRequestToOptions(t *testing.T) {
	tests := []struct {
		name    string
		req     redispatchOrderRequest
		wantErr bool
		assert  func(t *testing.T, gotPricePercent float64, gotPriceCents int64, gotRadius float64)
	}{
		{
			name:    "requires at least one option",
			req:     redispatchOrderRequest{},
			wantErr: true,
		},
		{
			name: "rejects negative radius",
			req: redispatchOrderRequest{
				RadiusBumpKM: floatPtr(-1),
			},
			wantErr: true,
		},
		{
			name: "uses explicit percent",
			req: redispatchOrderRequest{
				PriceBumpPercent: floatPtr(12),
			},
			assert: func(t *testing.T, gotPricePercent float64, gotPriceCents int64, gotRadius float64) {
				t.Helper()
				if gotPricePercent != 12 || gotPriceCents != 0 || gotRadius != 0 {
					t.Fatalf("unexpected options percent=%v cents=%v radius=%v", gotPricePercent, gotPriceCents, gotRadius)
				}
			},
		},
		{
			name: "uses default percent when price option is zero",
			req: redispatchOrderRequest{
				PriceBumpPercent: floatPtr(0),
			},
			assert: func(t *testing.T, gotPricePercent float64, gotPriceCents int64, gotRadius float64) {
				t.Helper()
				if gotPricePercent != 10 || gotPriceCents != 0 || gotRadius != 0 {
					t.Fatalf("unexpected options percent=%v cents=%v radius=%v", gotPricePercent, gotPriceCents, gotRadius)
				}
			},
		},
		{
			name: "converts yuan to cents",
			req: redispatchOrderRequest{
				PriceBumpYuan: floatPtr(12.34),
			},
			assert: func(t *testing.T, gotPricePercent float64, gotPriceCents int64, gotRadius float64) {
				t.Helper()
				if gotPricePercent != 0 || gotPriceCents != 1234 || gotRadius != 0 {
					t.Fatalf("unexpected options percent=%v cents=%v radius=%v", gotPricePercent, gotPriceCents, gotRadius)
				}
			},
		},
		{
			name: "uses default radius when radius option is zero",
			req: redispatchOrderRequest{
				RadiusBumpKM: floatPtr(0),
			},
			assert: func(t *testing.T, gotPricePercent float64, gotPriceCents int64, gotRadius float64) {
				t.Helper()
				if gotPricePercent != 0 || gotPriceCents != 0 || gotRadius != 10 {
					t.Fatalf("unexpected options percent=%v cents=%v radius=%v", gotPricePercent, gotPriceCents, gotRadius)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts, err := tt.req.toOptions(10, 10, 77)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if opts.OperatorUserID != 77 {
				t.Fatalf("expected operator 77, got %d", opts.OperatorUserID)
			}
			if tt.assert != nil {
				tt.assert(t, opts.PriceBumpPercent, opts.PriceBumpCents, opts.RadiusBumpKM)
			}
		})
	}
}

func floatPtr(value float64) *float64 {
	return &value
}

func TestRedispatchAPIValidationAndState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, orderRepo := newRedispatchAPIHandler(t)

	t.Run("requires one option", func(t *testing.T) {
		status, payload := callRedispatchAPI(handler, 999, 101, `{}`)
		if status != http.StatusBadRequest || payload["code"] != "VALIDATION_ERROR" {
			t.Fatalf("expected validation error, got status=%d payload=%#v", status, payload)
		}
	})

	t.Run("validates negative option", func(t *testing.T) {
		status, payload := callRedispatchAPI(handler, 999, 101, `{"radius_bump_km":-1}`)
		if status != http.StatusBadRequest || payload["code"] != "VALIDATION_ERROR" {
			t.Fatalf("expected validation error, got status=%d payload=%#v", status, payload)
		}
	})

	t.Run("rejects non dispatch failed order", func(t *testing.T) {
		order := seedRedispatchAPIOrder(t, orderRepo, "WRJ-API-REDISPATCH-BAD", "pending_dispatch", 101, 168000)
		status, payload := callRedispatchAPI(handler, order.ID, 101, `{"price_bump_percent":10}`)
		if status != http.StatusConflict || payload["code"] != broadcastCodeStatusInvalid {
			t.Fatalf("expected conflict for invalid state, got status=%d payload=%#v", status, payload)
		}
	})

	t.Run("maps cooldown to rate limited", func(t *testing.T) {
		order := seedRedispatchAPIOrder(t, orderRepo, "WRJ-API-REDISPATCH-COOLDOWN", "dispatch_failed", 101, 100000)
		setRedispatchAPIPriceBreakdown(t, orderRepo, order.ID, `{"matching_radius_km":30,"redispatch_count":1,"redispatch_last_at":"`+time.Now().Format(time.RFC3339)+`"}`)
		status, payload := callRedispatchAPI(handler, order.ID, 101, `{"radius_bump_km":10}`)
		if status != http.StatusTooManyRequests || payload["code"] != redispatchCodeRateLimited {
			t.Fatalf("expected rate-limited response, got status=%d payload=%#v", status, payload)
		}
		if !strings.Contains(fmt.Sprint(payload["message"]), "秒后再试") {
			t.Fatalf("expected remaining seconds in message, got %#v", payload)
		}
	})

	t.Run("maps cap to conflict", func(t *testing.T) {
		order := seedRedispatchAPIOrder(t, orderRepo, "WRJ-API-REDISPATCH-CAPPED", "dispatch_failed", 101, 100000)
		setRedispatchAPIPriceBreakdown(t, orderRepo, order.ID, `{"matching_radius_km":30,"redispatch_count":3}`)
		status, payload := callRedispatchAPI(handler, order.ID, 101, `{"price_bump_percent":10}`)
		if status != http.StatusConflict || payload["code"] != redispatchCodeCapped {
			t.Fatalf("expected capped response, got status=%d payload=%#v", status, payload)
		}
	})

	t.Run("accepts both price and radius options", func(t *testing.T) {
		order := seedRedispatchAPIOrder(t, orderRepo, "WRJ-API-REDISPATCH-OK", "dispatch_failed", 101, 100000)
		status, payload := callRedispatchAPI(handler, order.ID, 101, `{"price_bump_percent":10,"radius_bump_km":10}`)
		if status != http.StatusOK || payload["code"] != "OK" {
			t.Fatalf("expected success, got status=%d payload=%#v", status, payload)
		}
		updated, err := orderRepo.GetByID(order.ID)
		if err != nil {
			t.Fatalf("reload order: %v", err)
		}
		if updated.Status != "pending_dispatch" || updated.TotalAmount != 110000 {
			t.Fatalf("expected redispatched order with bumped price, got status=%s amount=%d", updated.Status, updated.TotalAmount)
		}
	})
}

func TestGetDispatchStateAPI(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, db, orderRepo := newDispatchStateAPIHandler(t)
	now := time.Now()
	createdAt := now.Add(-45 * time.Second)
	expiresAt := now.Add(75 * time.Second)
	order := seedRedispatchAPIOrder(t, orderRepo, "WRJ-API-DISPATCH-STATE", "pending_dispatch", 101, 100000)
	if err := orderRepo.UpdateFields(order.ID, map[string]interface{}{
		"created_at": createdAt,
		"updated_at": createdAt,
	}); err != nil {
		t.Fatalf("set order time: %v", err)
	}
	broadcast := model.OrderBroadcast{
		OrderID:          order.ID,
		OriginLatitude:   22.5431,
		OriginLongitude:  114.0579,
		ServiceClassCode: "light_heavy",
		WeightKG:         80,
		Status:           "open",
		ExpiresAt:        expiresAt,
		CreatedAt:        createdAt,
	}
	if err := db.Create(&broadcast).Error; err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	heartbeat := now.Add(-10 * time.Second)
	if err := db.Create(&model.ProviderPresence{
		UserID:                 201,
		Online:                 true,
		LastLatitude:           22.5432,
		LastLongitude:          114.0580,
		LastHeartbeatAt:        &heartbeat,
		AcceptedServiceClasses: model.JSON(`["light_heavy"]`),
		MaxRadiusKM:            20,
		Status:                 "active",
	}).Error; err != nil {
		t.Fatalf("create matching presence: %v", err)
	}
	if err := db.Create(&model.ProviderPresence{
		UserID:                 202,
		Online:                 true,
		LastLatitude:           22.5433,
		LastLongitude:          114.0581,
		LastHeartbeatAt:        &heartbeat,
		AcceptedServiceClasses: model.JSON(`["super_heavy"]`),
		MaxRadiusKM:            20,
		Status:                 "active",
	}).Error; err != nil {
		t.Fatalf("create nonmatching presence: %v", err)
	}
	for idx, providerID := range []int64{301, 302} {
		if err := db.Create(&model.BroadcastAssignment{
			BroadcastID:      broadcast.ID,
			OrderID:          order.ID,
			ProviderUserID:   providerID,
			AttemptSeq:       idx + 1,
			Status:           "expired",
			AcceptDeadlineAt: now.Add(-time.Minute),
			CreatedAt:        createdAt.Add(time.Duration(idx) * time.Second),
		}).Error; err != nil {
			t.Fatalf("create assignment %d: %v", providerID, err)
		}
	}

	status, payload := callDispatchStateAPI(handler, order.ID, 101)
	if status != http.StatusOK || payload["code"] != "OK" {
		t.Fatalf("expected success, got status=%d payload=%#v", status, payload)
	}
	data, ok := payload["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data map, got %#v", payload["data"])
	}
	if got := int(data["online_providers_count"].(float64)); got != 1 {
		t.Fatalf("expected one matching online provider, got %d", got)
	}
	if got := int(data["tried_providers_count"].(float64)); got != 2 {
		t.Fatalf("expected two tried providers, got %d", got)
	}
	elapsed := int(data["elapsed_seconds"].(float64))
	if elapsed < 40 || elapsed > 60 {
		t.Fatalf("expected elapsed around 45s, got %d", elapsed)
	}
	remaining := int(data["estimated_wait_seconds"].(float64))
	if remaining < 60 || remaining > 90 {
		t.Fatalf("expected remaining around 75s, got %d", remaining)
	}
}

func newRedispatchAPIHandler(t *testing.T) (*Handler, *repository.OrderRepo) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.ProviderPresence{},
		&model.OrderBroadcast{},
		&model.OrderBroadcastExclusion{},
		&model.BroadcastAssignment{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
		&model.SystemConfig{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	orderRepo := repository.NewOrderRepo(db)
	artifactRepo := repository.NewOrderArtifactRepo(db)
	broadcastService := service.NewBroadcastService(
		repository.NewProviderPresenceRepo(db),
		repository.NewOrderBroadcastRepo(db),
		repository.NewBroadcastAssignmentRepo(db),
		orderRepo,
		artifactRepo,
		nil,
		zap.NewNop(),
	)
	orderService := service.NewOrderService(
		orderRepo,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		artifactRepo,
		nil,
		zap.NewNop(),
	)
	return NewHandler(orderService, nil, nil, nil, nil, broadcastService), orderRepo
}

func newDispatchStateAPIHandler(t *testing.T) (*Handler, *gorm.DB, *repository.OrderRepo) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.ProviderPresence{},
		&model.OrderBroadcast{},
		&model.OrderBroadcastExclusion{},
		&model.BroadcastAssignment{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
		&model.SystemConfig{},
	); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	orderRepo := repository.NewOrderRepo(db)
	artifactRepo := repository.NewOrderArtifactRepo(db)
	broadcastService := service.NewBroadcastService(
		repository.NewProviderPresenceRepo(db),
		repository.NewOrderBroadcastRepo(db),
		repository.NewBroadcastAssignmentRepo(db),
		orderRepo,
		artifactRepo,
		nil,
		zap.NewNop(),
	)
	orderService := service.NewOrderService(
		orderRepo,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		artifactRepo,
		nil,
		zap.NewNop(),
	)
	return NewHandler(orderService, nil, nil, nil, nil, broadcastService), db, orderRepo
}

func seedRedispatchAPIOrder(t *testing.T, orderRepo *repository.OrderRepo, orderNo, status string, clientUserID int64, amount int64) *model.Order {
	t.Helper()
	start := time.Now().Add(time.Hour)
	order := &model.Order{
		OrderNo:              orderNo,
		OrderType:            "cargo",
		OrderSource:          service.OrderModeInstant,
		OrderMode:            service.OrderModeInstant,
		ClientUserID:         clientUserID,
		RenterID:             clientUserID,
		ServiceClassCode:     "light_heavy",
		ServiceType:          "cargo_heavy_lift",
		CargoWeightKG:        80,
		StartTime:            start,
		EndTime:              start.Add(time.Hour),
		ServiceLatitude:      22.5431,
		ServiceLongitude:     114.0579,
		ServiceAddress:       "起点",
		DestAddress:          "终点",
		TotalAmount:          amount,
		PriceBreakdownJSON:   model.JSON(`{"matching_radius_km":30}`),
		Status:               status,
		EstimatedDistanceM:   10000,
		EstimatedDurationMin: 30,
	}
	if err := orderRepo.Create(order); err != nil {
		t.Fatalf("create order: %v", err)
	}
	return order
}

func setRedispatchAPIPriceBreakdown(t *testing.T, orderRepo *repository.OrderRepo, orderID int64, priceBreakdownJSON string) {
	t.Helper()
	if err := orderRepo.UpdateFields(orderID, map[string]interface{}{
		"price_breakdown_json": model.JSON(priceBreakdownJSON),
	}); err != nil {
		t.Fatalf("update price breakdown: %v", err)
	}
}

func callRedispatchAPI(handler *Handler, orderID, userID int64, body string) (int, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user_id", userID)
	c.Set("user_type", "client")
	c.Params = gin.Params{{Key: "order_id", Value: fmt.Sprintf("%d", orderID)}}
	c.Request = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v2/customer/orders/%d/redispatch", orderID), strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	handler.Redispatch(c)

	var payload map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &payload)
	return w.Code, payload
}

func callDispatchStateAPI(handler *Handler, orderID, userID int64) (int, map[string]interface{}) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user_id", userID)
	c.Set("user_type", "client")
	c.Params = gin.Params{{Key: "order_id", Value: fmt.Sprintf("%d", orderID)}}
	c.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v2/orders/%d/dispatch-state", orderID), nil)
	handler.GetDispatchState(c)

	var payload map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &payload)
	return w.Code, payload
}
