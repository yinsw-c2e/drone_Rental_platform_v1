package service

import (
	"math"
	"strings"
	"testing"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestCalculateDirectOrderAmountPerTripAndPerKG(t *testing.T) {
	trips := 2
	weight := 3.5
	perTripSupply := &model.OwnerSupply{BasePriceAmount: 12000, PricingUnit: "per_trip"}
	perKGSupply := &model.OwnerSupply{BasePriceAmount: 800, PricingUnit: "per_kg"}

	tripAmount, err := calculateDirectOrderAmount(perTripSupply, &DirectOrderInput{EstimatedTripCount: &trips})
	if err != nil {
		t.Fatalf("unexpected per_trip error: %v", err)
	}
	if tripAmount != 24000 {
		t.Fatalf("expected per_trip amount 24000, got %d", tripAmount)
	}

	kgAmount, err := calculateDirectOrderAmount(perKGSupply, &DirectOrderInput{
		EstimatedTripCount: &trips,
		CargoWeightKG:      &weight,
	})
	if err != nil {
		t.Fatalf("unexpected per_kg error: %v", err)
	}
	if kgAmount != 5600 {
		t.Fatalf("expected per_kg amount 5600, got %d", kgAmount)
	}
}

func TestCalculateDirectOrderAmountPerHourAndPerKM(t *testing.T) {
	start := time.Date(2026, 3, 15, 9, 0, 0, 0, time.Local)
	end := start.Add(3 * time.Hour)
	lat1, lng1 := 23.0215, 113.1214
	lat2, lng2 := 23.0290, 113.1340

	perHourSupply := &model.OwnerSupply{BasePriceAmount: 5000, PricingUnit: "per_hour"}
	perKMSupply := &model.OwnerSupply{BasePriceAmount: 1200, PricingUnit: "per_km"}

	hourAmount, err := calculateDirectOrderAmount(perHourSupply, &DirectOrderInput{
		ScheduledStartAt: &start,
		ScheduledEndAt:   &end,
	})
	if err != nil {
		t.Fatalf("unexpected per_hour error: %v", err)
	}
	if hourAmount != 15000 {
		t.Fatalf("expected per_hour amount 15000, got %d", hourAmount)
	}

	kmAmount, err := calculateDirectOrderAmount(perKMSupply, &DirectOrderInput{
		DepartureAddress:   &AddressSnapshotInput{Text: "起点", Latitude: &lat1, Longitude: &lng1},
		DestinationAddress: &AddressSnapshotInput{Text: "终点", Latitude: &lat2, Longitude: &lng2},
	})
	if err != nil {
		t.Fatalf("unexpected per_km error: %v", err)
	}
	expected := int64(math.Round(float64(perKMSupply.BasePriceAmount) * haversineKM(lat1, lng1, lat2, lng2)))
	if kmAmount != expected {
		t.Fatalf("expected per_km amount %d, got %d", expected, kmAmount)
	}
}

func TestResolveDirectOrderHelpers(t *testing.T) {
	start := time.Date(2026, 3, 15, 10, 0, 0, 0, time.Local)
	end := start
	lat1, lng1 := 23.0, 113.0
	lat2, lng2 := 24.0, 114.0

	input := &DirectOrderInput{
		ServiceAddress:     &AddressSnapshotInput{Text: "服务点", Latitude: &lat1, Longitude: &lng1},
		DepartureAddress:   &AddressSnapshotInput{Text: "起运点", Latitude: &lat2, Longitude: &lng2},
		DestinationAddress: &AddressSnapshotInput{Text: "送达点", Latitude: &lat2, Longitude: &lng2},
		ScheduledStartAt:   &start,
		ScheduledEndAt:     &end,
	}

	if !hasDirectOrderPrimaryAddress(input) {
		t.Fatal("expected primary address to exist")
	}
	text, lat, lng := resolveDirectOrderPrimaryAddress(input)
	if text != "服务点" || lat != lat1 || lng != lng1 {
		t.Fatalf("expected service address to win, got %s %.2f %.2f", text, lat, lng)
	}

	destText, _, _ := resolveDirectOrderDestination(input)
	if destText != "送达点" {
		t.Fatalf("expected destination address, got %s", destText)
	}

	startAt, endAt := resolveDirectOrderSchedule(input)
	if !endAt.After(startAt) {
		t.Fatal("expected schedule helper to normalize zero-length time window")
	}
	if endAt.Sub(startAt) != 2*time.Hour {
		t.Fatalf("expected normalized duration 2h, got %s", endAt.Sub(startAt))
	}
}

func TestNormalizeExecutionStatusMapsLegacyLoading(t *testing.T) {
	if got := normalizeExecutionStatus("loading"); got != "preparing" {
		t.Fatalf("expected loading to normalize to preparing, got %s", got)
	}
	if got := normalizeExecutionStatus("in_transit"); got != "in_transit" {
		t.Fatalf("expected in_transit to stay unchanged, got %s", got)
	}
}

func TestValidateExecutionStatusTransition(t *testing.T) {
	tests := []struct {
		name      string
		current   string
		target    string
		shouldErr bool
	}{
		{name: "assigned to preparing", current: "assigned", target: "preparing"},
		{name: "confirmed to airspace applying", current: "confirmed", target: "airspace_applying"},
		{name: "preparing to in transit", current: "preparing", target: "in_transit"},
		{name: "in transit to delivered", current: "in_transit", target: "delivered"},
		{name: "assigned skips to delivered", current: "assigned", target: "delivered", shouldErr: true},
		{name: "delivered cannot go back", current: "delivered", target: "in_transit", shouldErr: true},
		{name: "same status rejected", current: "preparing", target: "preparing", shouldErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateExecutionStatusTransition(tt.current, tt.target)
			if tt.shouldErr && err == nil {
				t.Fatal("expected transition to fail")
			}
			if !tt.shouldErr && err != nil {
				t.Fatalf("expected transition to succeed, got %v", err)
			}
		})
	}
}

func TestBuildExecutionStatusUpdates(t *testing.T) {
	now := time.Date(2026, 4, 13, 10, 30, 0, 0, time.Local)
	order := &model.Order{AirspaceStatus: ""}

	preparing := buildExecutionStatusUpdates(order, 17, "preparing", "preparing", now)
	if preparing["status"] != "preparing" {
		t.Fatalf("expected preparing status, got %#v", preparing["status"])
	}
	if preparing["airspace_status"] != "approved" {
		t.Fatalf("expected airspace_status approved, got %#v", preparing["airspace_status"])
	}

	inTransit := buildExecutionStatusUpdates(order, 23, "in_transit", "in_transit", now)
	if inTransit["loading_confirmed_by"] != int64(23) {
		t.Fatalf("expected loading_confirmed_by=23, got %#v", inTransit["loading_confirmed_by"])
	}
	if inTransit["flight_start_time"] != now {
		t.Fatalf("expected flight_start_time=%v, got %#v", now, inTransit["flight_start_time"])
	}

	delivered := buildExecutionStatusUpdates(order, 31, "delivered", "delivered", now)
	if delivered["unloading_confirmed_by"] != int64(31) {
		t.Fatalf("expected unloading_confirmed_by=31, got %#v", delivered["unloading_confirmed_by"])
	}
	if delivered["flight_end_time"] != now {
		t.Fatalf("expected flight_end_time=%v, got %#v", now, delivered["flight_end_time"])
	}
}

func TestFilterExecutionStatusUpdates(t *testing.T) {
	now := time.Date(2026, 4, 13, 10, 30, 0, 0, time.Local)
	updates := map[string]interface{}{
		"status":                 "in_transit",
		"updated_at":             now,
		"loading_confirmed_at":   now,
		"loading_confirmed_by":   int64(23),
		"flight_start_time":      now,
		"unloading_confirmed_at": now,
	}

	filtered := filterExecutionStatusUpdates(updates, func(column string) bool {
		return column != "loading_confirmed_by" && column != "flight_start_time"
	})

	if _, ok := filtered["loading_confirmed_by"]; ok {
		t.Fatal("expected missing optional actor column to be dropped")
	}
	if _, ok := filtered["flight_start_time"]; ok {
		t.Fatal("expected missing optional flight time column to be dropped")
	}
	if filtered["status"] != "in_transit" {
		t.Fatalf("expected core status field to stay intact, got %#v", filtered["status"])
	}
	if _, ok := filtered["loading_confirmed_at"]; !ok {
		t.Fatal("expected available optional timestamp column to stay intact")
	}
}

func TestCancelOrderWithRefundCreatesRefundRecord(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.Payment{},
		&model.Refund{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
	)

	start := time.Now().Add(48 * time.Hour)
	end := start.Add(2 * time.Hour)
	paidAt := time.Now().Add(-30 * time.Minute)

	drone := &model.Drone{
		OwnerID:            21,
		Brand:              "DJI",
		Model:              "FlyCart",
		SerialNumber:       "SN-CANCEL-001",
		AvailabilityStatus: "busy",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	order := &model.Order{
		OrderNo:                "WRJ-CANCEL-001",
		DroneID:                drone.ID,
		ClientUserID:           11,
		ProviderUserID:         21,
		Title:                  "取消退款测试单",
		ServiceType:            "heavy_cargo_lift_transport",
		ServiceAddress:         "广州仓库",
		DestAddress:            "珠海码头",
		StartTime:              start,
		EndTime:                end,
		TotalAmount:            12800,
		Status:                 "pending_dispatch",
		NeedsDispatch:          true,
		ExecutionMode:          "dispatch_pool",
		PaidAt:                 &paidAt,
		PlatformCommissionRate: 0.1,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	payment := &model.Payment{
		PaymentNo:     "PAY-CANCEL-001",
		OrderID:       order.ID,
		UserID:        order.ClientUserID,
		PaymentType:   "order",
		PaymentMethod: "mock",
		Amount:        order.TotalAmount,
		Status:        "paid",
		PaidAt:        &paidAt,
	}
	if err := db.Create(payment).Error; err != nil {
		t.Fatalf("create payment: %v", err)
	}

	service := &OrderService{}
	orderRepo := repository.NewOrderRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	paymentRepo := repository.NewPaymentRepo(db)
	artifactRepo := repository.NewOrderArtifactRepo(db)

	if err := service.cancelOrderWithRepos(
		order.ID,
		order.ClientUserID,
		"客户改期",
		"client",
		orderRepo,
		droneRepo,
		paymentRepo,
		artifactRepo,
		nil,
		nil,
	); err != nil {
		t.Fatalf("cancel order: %v", err)
	}

	var updated model.Order
	if err := db.First(&updated, order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updated.Status != "cancelled" {
		t.Fatalf("expected cancelled order, got %s", updated.Status)
	}
	if updated.CancelReason != "客户改期" || updated.CancelBy != "client" {
		t.Fatalf("expected cancel metadata to persist, got reason=%q by=%q", updated.CancelReason, updated.CancelBy)
	}

	var refunds []model.Refund
	if err := db.Where("order_id = ?", order.ID).Find(&refunds).Error; err != nil {
		t.Fatalf("query refunds: %v", err)
	}
	if len(refunds) != 1 {
		t.Fatalf("expected exactly one refund record, got %d", len(refunds))
	}
	if refunds[0].Amount != order.TotalAmount || refunds[0].Status != "pending" {
		t.Fatalf("unexpected refund payload: %#v", refunds[0])
	}
	if !strings.Contains(refunds[0].Reason, "客户改期") {
		t.Fatalf("expected refund reason to contain cancel reason, got %q", refunds[0].Reason)
	}

	var timeline model.OrderTimeline
	if err := db.Where("order_id = ?", order.ID).Order("id DESC").First(&timeline).Error; err != nil {
		t.Fatalf("query timeline: %v", err)
	}
	if timeline.Status != "cancelled" || !strings.Contains(timeline.Note, "退款记录") {
		t.Fatalf("expected cancelled timeline with refund note, got %#v", timeline)
	}
}
