package service

import (
	"database/sql"
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
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

func TestHuolalaOrderModeInitialStatusCompatibility(t *testing.T) {
	tests := []struct {
		name                       string
		orderSource                string
		orderMode                  string
		expectedStatus             string
		expectProviderConfirmation bool
	}{
		{
			name:                       "legacy direct empty mode stays negotiated",
			orderSource:                "supply_direct",
			orderMode:                  "",
			expectedStatus:             "pending_provider_confirmation",
			expectProviderConfirmation: true,
		},
		{
			name:                       "negotiated direct asks provider confirmation",
			orderSource:                "supply_direct",
			orderMode:                  OrderModeNegotiated,
			expectedStatus:             "pending_provider_confirmation",
			expectProviderConfirmation: true,
		},
		{
			name:           "negotiated market keeps created default",
			orderSource:    "demand_market",
			orderMode:      OrderModeNegotiated,
			expectedStatus: "created",
		},
		{
			name:           "instant direct never asks provider confirmation",
			orderSource:    "supply_direct",
			orderMode:      OrderModeInstant,
			expectedStatus: "pending_dispatch",
		},
		{
			name:           "instant source enters pending dispatch",
			orderSource:    OrderModeInstant,
			orderMode:      OrderModeInstant,
			expectedStatus: "pending_dispatch",
		},
		{
			name:           "reservation direct enters scheduled",
			orderSource:    "supply_direct",
			orderMode:      OrderModeReservation,
			expectedStatus: "scheduled",
		},
		{
			name:           "reservation source enters scheduled",
			orderSource:    OrderModeReservation,
			orderMode:      OrderModeReservation,
			expectedStatus: "scheduled",
		},
		{
			name:                       "unknown mode defaults to negotiated compatibility",
			orderSource:                "supply_direct",
			orderMode:                  "bad-mode",
			expectedStatus:             "pending_provider_confirmation",
			expectProviderConfirmation: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := initialOrderStatus(tt.orderSource, tt.orderMode); got != tt.expectedStatus {
				t.Fatalf("expected status %s, got %s", tt.expectedStatus, got)
			}
			if got := shouldEnterProviderConfirmation(tt.orderSource, tt.orderMode); got != tt.expectProviderConfirmation {
				t.Fatalf("expected provider confirmation=%v, got %v", tt.expectProviderConfirmation, got)
			}
		})
	}
}

func TestProviderConfirmRejectsInstantOrderEvenIfLegacyStatusLeaked(t *testing.T) {
	db := newServiceTestDB(t, &model.Order{}, &model.OrderTimeline{}, &model.Review{})
	order := &model.Order{
		OrderNo:        "WRJ-H2-INSTANT-CONFIRM",
		OrderSource:    "supply_direct",
		OrderMode:      OrderModeInstant,
		Status:         "pending_provider_confirmation",
		ProviderUserID: 7,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := &OrderService{}
	err := service.providerConfirmOrderWithRepos(order.ID, 7, repository.NewOrderRepo(db), nil, nil, nil, nil)
	if err == nil {
		t.Fatal("expected instant order to reject provider confirmation path")
	}
}

func TestCreateInstantOrderUsesServerPricingAndStoresBreakdown(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Client{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
	)
	orderRepo := repository.NewOrderRepo(db)
	service := NewOrderService(
		orderRepo,
		nil,
		nil,
		nil,
		nil,
		repository.NewClientRepo(db),
		nil,
		nil,
		repository.NewOrderArtifactRepo(db),
		&config.Config{Payment: config.PaymentConfig{CommissionRate: 10}},
		zap.NewNop(),
	)
	service.SetPricingService(seedPricingServiceClasses(t))

	start := time.Date(2026, 6, 1, 10, 0, 0, 0, time.Local)
	result, err := service.CreateInstantOrder(13800000004, &PlatformPricedOrderInput{
		Origin:           PricingPoint{Latitude: 22.5431, Longitude: 114.0579, Address: "深圳市龙岗区坂田仓库"},
		Destination:      PricingPoint{Latitude: 22.6283, Longitude: 114.3612, Address: "深圳市坪山区施工点"},
		CargoWeightKG:    80,
		ScheduledStartAt: start,
		ServiceClassCode: "light_heavy",
		CargoScene:       "施工物料吊运",
	})
	if err != nil {
		t.Fatalf("create instant order: %v", err)
	}
	if result.Order.OrderMode != OrderModeInstant || result.Order.OrderSource != OrderModeInstant {
		t.Fatalf("expected instant order mode/source, got mode=%s source=%s", result.Order.OrderMode, result.Order.OrderSource)
	}
	if result.Order.Status != "pending_dispatch" {
		t.Fatalf("expected pending_dispatch, got %s", result.Order.Status)
	}
	if result.Order.TotalAmount != result.Estimate.TotalEstimatedCents {
		t.Fatalf("expected total_amount from server estimate %d, got %d", result.Estimate.TotalEstimatedCents, result.Order.TotalAmount)
	}
	if result.Order.EstimatedDistanceM != result.Estimate.DistanceM || result.Order.EstimatedDurationMin != result.Estimate.EstimatedDurationMin {
		t.Fatalf("expected estimate metadata to persist, order=%#v estimate=%#v", result.Order, result.Estimate)
	}
	if len(result.Order.PriceBreakdownJSON) == 0 || string(result.Order.PriceBreakdownJSON) == "null" {
		t.Fatal("expected price breakdown json to be stored")
	}

	var persisted model.Order
	if err := db.First(&persisted, result.Order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if persisted.TotalAmount != result.Estimate.TotalEstimatedCents {
		t.Fatalf("expected persisted total amount %d, got %d", result.Estimate.TotalEstimatedCents, persisted.TotalAmount)
	}
	if persisted.ProviderUserID != 0 || persisted.DemandID != 0 || persisted.SourceSupplyID != 0 {
		t.Fatalf("instant order should not bind demand/provider before grab, got %#v", persisted)
	}

	var timelines []model.OrderTimeline
	if err := db.Where("order_id = ?", result.Order.ID).Find(&timelines).Error; err != nil {
		t.Fatalf("query timelines: %v", err)
	}
	if len(timelines) != 1 || timelines[0].Status != "pending_dispatch" {
		t.Fatalf("expected pending_dispatch timeline, got %#v", timelines)
	}
}

func TestCreateInstantOrderWithEmptyDroneIDPersistsAsNullable(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Client{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
	)
	service := NewOrderService(
		repository.NewOrderRepo(db),
		nil,
		nil,
		nil,
		nil,
		repository.NewClientRepo(db),
		nil,
		nil,
		repository.NewOrderArtifactRepo(db),
		&config.Config{Payment: config.PaymentConfig{CommissionRate: 10}},
		zap.NewNop(),
	)
	service.SetPricingService(seedPricingServiceClasses(t))

	result, err := service.CreateInstantOrder(13800000004, &PlatformPricedOrderInput{
		Origin:           PricingPoint{Latitude: 22.5431, Longitude: 114.0579, Address: "深圳市龙岗区坂田仓库"},
		Destination:      PricingPoint{Latitude: 22.6283, Longitude: 114.3612, Address: "深圳市坪山区施工点"},
		CargoWeightKG:    80,
		ScheduledStartAt: time.Date(2026, 6, 1, 10, 0, 0, 0, time.Local),
		ServiceClassCode: "light_heavy",
		CargoScene:       "施工物料吊运",
	})
	if err != nil {
		t.Fatalf("create instant order: %v", err)
	}

	var droneID, pilotID, ownerID sql.NullInt64
	row := db.Raw("SELECT drone_id, pilot_id, owner_id FROM orders WHERE id = ?", result.Order.ID).Row()
	if err := row.Scan(&droneID, &pilotID, &ownerID); err != nil {
		t.Fatalf("scan nullable refs: %v", err)
	}
	if droneID.Valid || pilotID.Valid || ownerID.Valid {
		t.Fatalf("expected nullable refs to persist as SQL NULL, got drone=%#v pilot=%#v owner=%#v", droneID, pilotID, ownerID)
	}
}

func TestCreateReservationOrderSchedulesWithoutProviderConfirmation(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Client{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
	)
	service := NewOrderService(
		repository.NewOrderRepo(db),
		nil,
		nil,
		nil,
		nil,
		repository.NewClientRepo(db),
		nil,
		nil,
		repository.NewOrderArtifactRepo(db),
		&config.Config{Payment: config.PaymentConfig{CommissionRate: 10}},
		zap.NewNop(),
	)
	service.SetPricingService(seedPricingServiceClasses(t))

	start := time.Now().Add(24 * time.Hour)
	result, err := service.CreateReservationOrder(13800000004, &PlatformPricedOrderInput{
		Origin:           PricingPoint{Latitude: 22.5431, Longitude: 114.0579, Address: "深圳市龙岗区坂田仓库"},
		Destination:      PricingPoint{Latitude: 22.6283, Longitude: 114.3612, Address: "深圳市坪山区施工点"},
		CargoWeightKG:    120,
		ScheduledStartAt: start,
		ServiceClassCode: "medium_heavy",
	})
	if err != nil {
		t.Fatalf("create reservation order: %v", err)
	}
	if result.Order.OrderMode != OrderModeReservation || result.Order.Status != "scheduled" {
		t.Fatalf("expected scheduled reservation, got mode=%s status=%s", result.Order.OrderMode, result.Order.Status)
	}
	if result.Order.ReservedStartAt == nil || !result.Order.ReservedStartAt.Equal(start) {
		t.Fatalf("expected reserved_start_at=%v, got %v", start, result.Order.ReservedStartAt)
	}
	if result.Order.Status == "pending_provider_confirmation" {
		t.Fatal("reservation order must not enter pending_provider_confirmation")
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

func TestConfirmSiteSafetyCheckUpdatesAirspaceStatusAndTimeline(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.Review{},
	)

	drone := &model.Drone{
		OwnerID:            801,
		Brand:              "DJI",
		Model:              "FlyCart",
		SerialNumber:       "SN-SAFETY-001",
		AvailabilityStatus: "busy",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}
	order := &model.Order{
		OrderNo:             "WRJ-SAFETY-001",
		DroneID:             drone.ID,
		ClientUserID:        601,
		ProviderUserID:      801,
		ExecutorPilotUserID: 901,
		Title:               "现场复核测试单",
		Status:              "assigned",
		NeedsDispatch:       true,
		ExecutionMode:       "dispatch_pool",
		AirspaceStatus:      "pending_review",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := &OrderService{
		orderRepo: repository.NewOrderRepo(db),
		droneRepo: repository.NewDroneRepo(db),
	}

	if err := service.ConfirmSiteSafetyCheck(order.ID, order.ProviderUserID, "现场安全复核通过"); err != nil {
		t.Fatalf("confirm site safety: %v", err)
	}

	var updated model.Order
	if err := db.First(&updated, order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updated.AirspaceStatus != "approved" {
		t.Fatalf("expected airspace approved, got %s", updated.AirspaceStatus)
	}
	if updated.Status != "assigned" {
		t.Fatalf("expected order status to stay assigned, got %s", updated.Status)
	}

	var timeline model.OrderTimeline
	if err := db.Where("order_id = ? AND status = ?", order.ID, "airspace_approved").First(&timeline).Error; err != nil {
		t.Fatalf("query safety timeline: %v", err)
	}
	if timeline.OperatorID != order.ProviderUserID || timeline.OperatorType != "owner" {
		t.Fatalf("unexpected timeline operator: %#v", timeline)
	}
	if !strings.Contains(timeline.Note, "现场安全复核通过") {
		t.Fatalf("expected safety note, got %s", timeline.Note)
	}
}

func TestConfirmSiteSafetyCheckRejectsUnauthorizedUser(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.Review{},
	)
	order := &model.Order{
		OrderNo:        "WRJ-SAFETY-002",
		ClientUserID:   601,
		ProviderUserID: 801,
		Status:         "assigned",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := &OrderService{orderRepo: repository.NewOrderRepo(db)}
	if err := service.ConfirmSiteSafetyCheck(order.ID, 777, ""); err == nil {
		t.Fatal("expected unauthorized user to be rejected")
	}
}

func TestSubmitSiteSafetyCheckPersistsEvidenceAndApprovesAirspace(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSiteSafetyCheck{},
		&model.Review{},
	)

	order := &model.Order{
		OrderNo:             "WRJ-SAFETY-003",
		ClientUserID:        601,
		ProviderUserID:      801,
		ExecutorPilotUserID: 901,
		Title:               "现场证据测试单",
		Status:              "assigned",
		AirspaceStatus:      "pending_review",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	service := &OrderService{orderRepo: repository.NewOrderRepo(db)}
	record, err := service.SubmitSiteSafetyCheck(order.ID, order.ProviderUserID, SubmitSiteSafetyCheckInput{
		Checklist: []SiteSafetyChecklistItem{
			{Key: "pickup_clearance", Label: "起吊点安全距离已确认", Checked: true},
			{Key: "weather_wind", Label: "天气与风速满足作业条件", Checked: true},
		},
		Photos: []string{"/uploads/drone/site-1.jpg", "/uploads/drone/site-1.jpg", " /uploads/drone/site-2.jpg "},
		Note:   "现场已拍照复核",
	})
	if err != nil {
		t.Fatalf("submit site safety: %v", err)
	}
	if record.ID == 0 {
		t.Fatal("expected persisted site safety record")
	}
	if record.OperatorRole != "owner" {
		t.Fatalf("expected owner operator role, got %s", record.OperatorRole)
	}

	var updated model.Order
	if err := db.First(&updated, order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updated.AirspaceStatus != "approved" {
		t.Fatalf("expected airspace approved, got %s", updated.AirspaceStatus)
	}

	var photos []string
	if err := json.Unmarshal([]byte(record.Photos), &photos); err != nil {
		t.Fatalf("decode photos: %v", err)
	}
	if len(photos) != 2 || photos[0] != "/uploads/drone/site-1.jpg" || photos[1] != "/uploads/drone/site-2.jpg" {
		t.Fatalf("expected normalized photos, got %#v", photos)
	}

	var timeline model.OrderTimeline
	if err := db.Where("order_id = ? AND status = ?", order.ID, "airspace_approved").First(&timeline).Error; err != nil {
		t.Fatalf("query timeline: %v", err)
	}
	if timeline.OperatorID != order.ProviderUserID || timeline.OperatorType != "owner" {
		t.Fatalf("unexpected timeline operator: %#v", timeline)
	}
}

func TestSubmitSiteSafetyCheckRejectsIncompleteEvidence(t *testing.T) {
	service := &OrderService{}
	_, err := service.SubmitSiteSafetyCheck(1, 801, SubmitSiteSafetyCheckInput{
		Checklist: []SiteSafetyChecklistItem{{Key: "weather_wind", Label: "天气与风速满足作业条件", Checked: false}},
		Photos:    []string{"/uploads/drone/site-1.jpg"},
	})
	if err == nil || !strings.Contains(err.Error(), "天气与风速") {
		t.Fatalf("expected unchecked item error, got %v", err)
	}

	_, err = service.SubmitSiteSafetyCheck(1, 801, SubmitSiteSafetyCheckInput{
		Checklist: []SiteSafetyChecklistItem{{Key: "weather_wind", Label: "天气与风速满足作业条件", Checked: true}},
	})
	if err == nil || !strings.Contains(err.Error(), "上传") {
		t.Fatalf("expected missing photo error, got %v", err)
	}
}

func TestConfirmReceiptCompletesFormalDispatchTask(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.FormalDispatchTask{},
		&model.FormalDispatchLog{},
		&model.Review{},
	)

	now := time.Now()
	drone := &model.Drone{
		OwnerID:            801,
		Brand:              "DJI",
		Model:              "FlyCart",
		SerialNumber:       "SN-CONFIRM-001",
		AvailabilityStatus: "busy",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	order := &model.Order{
		OrderNo:              "WRJ-CONFIRM-001",
		DroneID:              drone.ID,
		ClientUserID:         601,
		ProviderUserID:       801,
		ExecutorPilotUserID:  901,
		Title:                "签收完成自动收尾测试单",
		ServiceAddress:       "佛山起点",
		DestAddress:          "佛山终点",
		StartTime:            now.Add(-2 * time.Hour),
		EndTime:              now.Add(2 * time.Hour),
		TotalAmount:          12800,
		Status:               "delivered",
		NeedsDispatch:        true,
		ExecutionMode:        "dispatch_pool",
		LoadingConfirmedBy:   901,
		UnloadingConfirmedBy: 901,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	task := &model.FormalDispatchTask{
		DispatchNo:        "DSP-CONFIRM-001",
		OrderID:           order.ID,
		ProviderUserID:    order.ProviderUserID,
		TargetPilotUserID: order.ExecutorPilotUserID,
		DispatchSource:    "pool",
		Status:            "accepted",
		SentAt:            &now,
	}
	if err := db.Create(task).Error; err != nil {
		t.Fatalf("create dispatch task: %v", err)
	}

	service := &OrderService{
		orderRepo: repository.NewOrderRepo(db),
		droneRepo: repository.NewDroneRepo(db),
	}

	if err := service.ConfirmReceipt(order.ClientUserID, order.ID); err != nil {
		t.Fatalf("confirm receipt: %v", err)
	}

	var updatedOrder model.Order
	if err := db.First(&updatedOrder, order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updatedOrder.Status != "completed" {
		t.Fatalf("expected order completed, got %s", updatedOrder.Status)
	}
	if updatedOrder.CompletedAt == nil {
		t.Fatalf("expected completed_at to be filled")
	}

	var updatedTask model.FormalDispatchTask
	if err := db.First(&updatedTask, task.ID).Error; err != nil {
		t.Fatalf("reload dispatch task: %v", err)
	}
	if updatedTask.Status != "completed" {
		t.Fatalf("expected dispatch task completed, got %s", updatedTask.Status)
	}

	var logs []model.FormalDispatchLog
	if err := db.Where("dispatch_task_id = ?", task.ID).Find(&logs).Error; err != nil {
		t.Fatalf("query dispatch logs: %v", err)
	}
	if len(logs) == 0 || !strings.Contains(logs[len(logs)-1].Note, "自动归档完成") {
		t.Fatalf("expected completion log, got %#v", logs)
	}

	var updatedDrone model.Drone
	if err := db.First(&updatedDrone, drone.ID).Error; err != nil {
		t.Fatalf("reload drone: %v", err)
	}
	if updatedDrone.AvailabilityStatus != "available" {
		t.Fatalf("expected drone availability restored, got %s", updatedDrone.AvailabilityStatus)
	}
}

func TestConfirmReceiptFinalizesSettlementWalletIncome(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSettlement{},
		&model.PricingConfig{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.Message{},
		&model.PricingConfig{},
		&model.Review{},
	)

	drone := &model.Drone{
		OwnerID:            7,
		Brand:              "DJI",
		Model:              "FlyCart",
		SerialNumber:       "SN-SETTLE-001",
		AvailabilityStatus: "busy",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	order := &model.Order{
		OrderNo:             "WRJ-CONFIRM-SETTLE-001",
		OrderType:           "cargo",
		DroneID:             drone.ID,
		ClientUserID:        4,
		RenterID:            4,
		ProviderUserID:      7,
		ExecutorPilotUserID: 16,
		Title:               "签收后自动结算测试单",
		TotalAmount:         168000,
		Status:              "delivered",
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	orderRepo := repository.NewOrderRepo(db)
	settlementService := NewSettlementService(repository.NewSettlementRepo(db), orderRepo, zap.NewNop())
	messageService := NewMessageService(repository.NewMessageRepo(db))
	eventService := NewEventService(messageService, nil, zap.NewNop())
	service := &OrderService{
		orderRepo:         orderRepo,
		droneRepo:         repository.NewDroneRepo(db),
		eventService:      eventService,
		settlementService: settlementService,
		logger:            zap.NewNop(),
	}

	if err := service.ConfirmReceipt(order.ClientUserID, order.ID); err != nil {
		t.Fatalf("confirm receipt: %v", err)
	}

	var settlement model.OrderSettlement
	if err := db.Where("order_id = ?", order.ID).First(&settlement).Error; err != nil {
		t.Fatalf("load settlement: %v", err)
	}
	if settlement.Status != "settled" {
		t.Fatalf("expected settlement settled, got %s", settlement.Status)
	}
	if settlement.PilotUserID != 16 || settlement.OwnerUserID != 7 || settlement.PayerUserID != 4 {
		t.Fatalf("unexpected participants: pilot=%d owner=%d payer=%d", settlement.PilotUserID, settlement.OwnerUserID, settlement.PayerUserID)
	}

	var pilotWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(16)).First(&pilotWallet).Error; err != nil {
		t.Fatalf("load pilot wallet: %v", err)
	}
	if pilotWallet.AvailableBalance != 75600 {
		t.Fatalf("expected pilot wallet 75600, got %d", pilotWallet.AvailableBalance)
	}

	var ownerWallet model.UserWallet
	if err := db.Where("user_id = ?", int64(7)).First(&ownerWallet).Error; err != nil {
		t.Fatalf("load owner wallet: %v", err)
	}
	if ownerWallet.AvailableBalance != 67200 {
		t.Fatalf("expected owner wallet 67200, got %d", ownerWallet.AvailableBalance)
	}

	var settledTimelineCount int64
	if err := db.Model(&model.OrderTimeline{}).Where("order_id = ? AND status = ?", order.ID, "settled").Count(&settledTimelineCount).Error; err != nil {
		t.Fatalf("count settled timeline: %v", err)
	}
	if settledTimelineCount != 1 {
		t.Fatalf("expected one settled timeline event, got %d", settledTimelineCount)
	}

	var allNotifications []model.Message
	if err := db.
		Where("sender_id = ? AND message_type = ? AND receiver_id IN ?", int64(0), "system", []int64{4, 7, 16}).
		Order("receiver_id ASC").
		Find(&allNotifications).Error; err != nil {
		t.Fatalf("query settlement notifications: %v", err)
	}
	notifications := make([]model.Message, 0, 3)
	for _, notification := range allNotifications {
		var extra map[string]interface{}
		if err := json.Unmarshal(notification.ExtraData, &extra); err != nil {
			t.Fatalf("unmarshal notification extra: %v", err)
		}
		if extra["event_type"] == "settlement_settled" {
			notifications = append(notifications, notification)
		}
	}
	if len(notifications) != 3 {
		t.Fatalf("expected 3 settlement notifications, got %d: %#v", len(notifications), notifications)
	}

	byReceiver := map[int64]model.Message{}
	for _, notification := range notifications {
		var extra map[string]interface{}
		if err := json.Unmarshal(notification.ExtraData, &extra); err != nil {
			t.Fatalf("unmarshal notification extra: %v", err)
		}
		if extra["event_type"] != "settlement_settled" || extra["business_type"] != "settlement" {
			t.Fatalf("unexpected notification extra for receiver %d: %#v", notification.ReceiverID, extra)
		}
		byReceiver[notification.ReceiverID] = notification
	}
	if !strings.Contains(byReceiver[16].Content, "履约服务费¥756.00已入账") {
		t.Fatalf("unexpected pilot settlement notification: %s", byReceiver[16].Content)
	}
	if !strings.Contains(byReceiver[7].Content, "设备服务费¥672.00已入账") {
		t.Fatalf("unexpected owner settlement notification: %s", byReceiver[7].Content)
	}
	if !strings.Contains(byReceiver[4].Content, "已完成结算") {
		t.Fatalf("unexpected client settlement notification: %s", byReceiver[4].Content)
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

	if _, err := service.cancelOrderWithRepos(
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

func TestPlatformPricedCancelGraceBoundary(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.Payment{},
		&model.Refund{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
	)

	now := time.Now()
	service := &OrderService{
		orderRepo:         repository.NewOrderRepo(db),
		paymentRepo:       repository.NewPaymentRepo(db),
		orderArtifactRepo: repository.NewOrderArtifactRepo(db),
		logger:            zap.NewNop(),
	}

	cases := []struct {
		name           string
		elapsed        time.Duration
		expectedRefund int64
	}{
		{name: "within_grace_4m59s", elapsed: 4*time.Minute + 59*time.Second, expectedRefund: 10000},
		{name: "after_grace_5m01s", elapsed: 5*time.Minute + time.Second, expectedRefund: 9000},
	}
	for i, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			grabbedAt := now.Add(-tc.elapsed)
			paidAt := now.Add(-10 * time.Minute)
			order := &model.Order{
				OrderNo:              "WRJ-H6-CANCEL-" + tc.name,
				OrderType:            "cargo",
				OrderMode:            OrderModeInstant,
				OrderSource:          OrderModeInstant,
				ClientUserID:         int64(6000 + i),
				ProviderUserID:       7000,
				GrabbedByUserID:      7000,
				GrabbedAt:            &grabbedAt,
				ProviderConfirmedAt:  &grabbedAt,
				Title:                "H6 取消边界测试",
				ServiceType:          defaultDemandServiceType,
				StartTime:            now,
				EndTime:              now.Add(time.Hour),
				ServiceLatitude:      22.5431,
				ServiceLongitude:     114.0579,
				ServiceAddress:       "起点",
				DestAddress:          "终点",
				TotalAmount:          10000,
				Status:               "assigned",
				EstimatedDistanceM:   10000,
				EstimatedDurationMin: 30,
				PaidAt:               &paidAt,
			}
			if err := db.Create(order).Error; err != nil {
				t.Fatalf("create order: %v", err)
			}
			if err := db.Create(&model.Payment{
				PaymentNo:     "PAY-H6-CANCEL-" + tc.name,
				OrderID:       order.ID,
				UserID:        order.ClientUserID,
				PaymentType:   "order",
				PaymentMethod: "mock",
				Amount:        order.TotalAmount,
				Status:        "paid",
				PaidAt:        &paidAt,
			}).Error; err != nil {
				t.Fatalf("create payment: %v", err)
			}

			if err := service.CancelOrder(order.ID, order.ClientUserID, "客户取消", "client"); err != nil {
				t.Fatalf("cancel order: %v", err)
			}
			var refund model.Refund
			if err := db.Where("order_id = ?", order.ID).First(&refund).Error; err != nil {
				t.Fatalf("load refund: %v", err)
			}
			if refund.Amount != tc.expectedRefund {
				t.Fatalf("expected refund %d, got %d (%s)", tc.expectedRefund, refund.Amount, refund.Reason)
			}
		})
	}
}

func TestProviderCancelTriggersAutoReassign(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
		&model.OrderBroadcast{},
		&model.OrderBroadcastExclusion{},
		&model.BroadcastAssignment{},
		&model.ProviderPresence{},
		&model.SystemConfig{},
		&model.CreditScore{},
		&model.CreditScoreLog{},
	)
	orderService, broadcastService := newH6OrderBroadcastServices(db)
	now := time.Now()
	grabbedAt := now.Add(-2 * time.Minute)
	order := &model.Order{
		OrderNo:              "WRJ-H6-REASSIGN-001",
		OrderType:            "cargo",
		OrderMode:            OrderModeInstant,
		OrderSource:          OrderModeInstant,
		ClientUserID:         6101,
		ProviderUserID:       7101,
		OwnerID:              7101,
		DroneOwnerUserID:     7101,
		ExecutorPilotUserID:  7101,
		GrabbedByUserID:      7101,
		GrabbedAt:            &grabbedAt,
		ProviderConfirmedAt:  &grabbedAt,
		Title:                "服务商取消自动重派",
		ServiceType:          defaultDemandServiceType,
		StartTime:            now,
		EndTime:              now.Add(time.Hour),
		ServiceLatitude:      22.5431,
		ServiceLongitude:     114.0579,
		ServiceAddress:       "起点",
		DestAddress:          "终点",
		ServiceClassCode:     "light_heavy",
		CargoWeightKG:        80,
		TotalAmount:          120000,
		Status:               "assigned",
		EstimatedDistanceM:   10000,
		EstimatedDurationMin: 30,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	grabbed := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: order.TotalAmount,
		Status:              broadcastStatusGrabbed,
		ExpiresAt:           now.Add(2 * time.Minute),
		GrabbedByUserID:     7101,
		GrabbedAt:           &grabbedAt,
	}
	if err := db.Create(grabbed).Error; err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	if err := db.Model(order).Update("broadcast_pool_id", grabbed.ID).Error; err != nil {
		t.Fatalf("link broadcast: %v", err)
	}
	seedProviderPresence(t, broadcastService, 7101, 22.5432, 114.05795, []string{"light_heavy"}, 20)
	seedProviderPresence(t, broadcastService, 7201, 22.5435, 114.0580, []string{"light_heavy"}, 20)

	if err := orderService.CancelOrder(order.ID, 7101, "设备临时故障", "provider"); err != nil {
		t.Fatalf("provider cancel: %v", err)
	}

	var updated model.Order
	if err := db.First(&updated, order.ID).Error; err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if updated.Status != "pending_dispatch" || updated.ProviderUserID != 0 || updated.GrabbedByUserID != 0 {
		t.Fatalf("expected order back to pending dispatch without provider, got status=%s provider=%d grabbed=%d", updated.Status, updated.ProviderUserID, updated.GrabbedByUserID)
	}
	var assignment model.BroadcastAssignment
	if err := db.Where("broadcast_id = ? AND status = ?", grabbed.ID, assignmentStatusPendingAccept).First(&assignment).Error; err != nil {
		t.Fatalf("expected pending auto assignment: %v", err)
	}
	if assignment.ProviderUserID != 7201 {
		t.Fatalf("expected assignment to provider 7201, got %d", assignment.ProviderUserID)
	}
	excluded, err := repository.NewOrderBroadcastRepo(db).IsProviderExcluded(order.ID, grabbed.ID, 7101)
	if err != nil {
		t.Fatalf("check original provider exclusion: %v", err)
	}
	if !excluded {
		t.Fatal("expected original cancelling provider to be excluded from reopened broadcast")
	}
	var credit model.CreditScore
	if err := db.Where("user_id = ?", int64(7101)).First(&credit).Error; err != nil {
		t.Fatalf("load credit: %v", err)
	}
	if credit.CancelledOrders != 1 {
		t.Fatalf("expected provider cancel count 1, got %d", credit.CancelledOrders)
	}
}

func TestProviderCancelInTransitCreatesPartialHandoverSettlement(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Order{},
		&model.OrderTimeline{},
		&model.OrderSnapshot{},
		&model.Review{},
		&model.OrderBroadcast{},
		&model.OrderBroadcastExclusion{},
		&model.BroadcastAssignment{},
		&model.ProviderPresence{},
		&model.SystemConfig{},
		&model.OrderSettlement{},
		&model.UserWallet{},
		&model.WalletTransaction{},
		&model.CreditScore{},
		&model.CreditScoreLog{},
	)
	orderService, broadcastService := newH6OrderBroadcastServices(db)
	now := time.Now()
	grabbedAt := now.Add(-12 * time.Minute)
	order := &model.Order{
		OrderNo:              "WRJ-H6-HANDOVER-001",
		OrderType:            "cargo",
		OrderMode:            OrderModeInstant,
		OrderSource:          OrderModeInstant,
		ClientUserID:         6201,
		ProviderUserID:       7301,
		OwnerID:              7301,
		DroneOwnerUserID:     7301,
		ExecutorPilotUserID:  7301,
		GrabbedByUserID:      7301,
		GrabbedAt:            &grabbedAt,
		ProviderConfirmedAt:  &grabbedAt,
		Title:                "改派部分结算",
		ServiceType:          defaultDemandServiceType,
		StartTime:            now.Add(-10 * time.Minute),
		EndTime:              now.Add(time.Hour),
		ServiceLatitude:      22.5431,
		ServiceLongitude:     114.0579,
		ServiceAddress:       "起点",
		DestAddress:          "终点",
		ServiceClassCode:     "light_heavy",
		CargoWeightKG:        80,
		TotalAmount:          100000,
		Status:               "in_transit",
		EstimatedDistanceM:   10000,
		EstimatedDurationMin: 30,
		ActualFlightDistance: 5000,
		ActualFlightDuration: 600,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	grabbed := &model.OrderBroadcast{
		OrderID:             order.ID,
		OriginLatitude:      order.ServiceLatitude,
		OriginLongitude:     order.ServiceLongitude,
		ServiceClassCode:    order.ServiceClassCode,
		WeightKG:            order.CargoWeightKG,
		EstimatedTotalCents: order.TotalAmount,
		Status:              broadcastStatusGrabbed,
		ExpiresAt:           now.Add(2 * time.Minute),
		GrabbedByUserID:     7301,
		GrabbedAt:           &grabbedAt,
	}
	if err := db.Create(grabbed).Error; err != nil {
		t.Fatalf("create broadcast: %v", err)
	}
	if err := db.Model(order).Update("broadcast_pool_id", grabbed.ID).Error; err != nil {
		t.Fatalf("link broadcast: %v", err)
	}
	seedProviderPresence(t, broadcastService, 7401, 22.5436, 114.0581, []string{"light_heavy"}, 20)

	if err := orderService.CancelOrder(order.ID, 7301, "无法继续履约", "provider"); err != nil {
		t.Fatalf("provider cancel in transit: %v", err)
	}

	var settlement model.OrderSettlement
	if err := db.Where("order_id = ?", order.ID).First(&settlement).Error; err != nil {
		t.Fatalf("load settlement: %v", err)
	}
	if settlement.Status != "partial_handover" {
		t.Fatalf("expected partial_handover status, got %s", settlement.Status)
	}
	if settlement.PartialHandoverAmount != 50000 {
		t.Fatalf("expected partial handover 50000, got %d", settlement.PartialHandoverAmount)
	}
	if settlement.PartialHandoverProviderUserID != 7301 {
		t.Fatalf("expected original provider 7301, got %d", settlement.PartialHandoverProviderUserID)
	}
	var wallet model.UserWallet
	if err := db.Where("user_id = ?", int64(7301)).First(&wallet).Error; err != nil {
		t.Fatalf("load wallet: %v", err)
	}
	if wallet.AvailableBalance != 50000 {
		t.Fatalf("expected wallet income 50000, got %d", wallet.AvailableBalance)
	}
	var reopened model.OrderBroadcast
	if err := db.First(&reopened, grabbed.ID).Error; err != nil {
		t.Fatalf("load broadcast: %v", err)
	}
	if reopened.EstimatedTotalCents != 50000 {
		t.Fatalf("expected remaining broadcast amount 50000, got %d", reopened.EstimatedTotalCents)
	}
}

func newH6OrderBroadcastServices(db *gorm.DB) (*OrderService, *BroadcastService) {
	orderRepo := repository.NewOrderRepo(db)
	artifactRepo := repository.NewOrderArtifactRepo(db)
	broadcastRepo := repository.NewOrderBroadcastRepo(db)
	presenceRepo := repository.NewProviderPresenceRepo(db)
	assignmentRepo := repository.NewBroadcastAssignmentRepo(db)
	settlementRepo := repository.NewSettlementRepo(db)
	broadcastService := NewBroadcastService(presenceRepo, broadcastRepo, assignmentRepo, orderRepo, artifactRepo, nil, zap.NewNop())
	orderService := &OrderService{
		orderRepo:         orderRepo,
		paymentRepo:       repository.NewPaymentRepo(db),
		orderArtifactRepo: artifactRepo,
		broadcastService:  broadcastService,
		settlementService: NewSettlementService(settlementRepo, orderRepo, zap.NewNop()),
		creditService:     NewCreditService(repository.NewCreditRepository(db)),
		logger:            zap.NewNop(),
	}
	return orderService, broadcastService
}
