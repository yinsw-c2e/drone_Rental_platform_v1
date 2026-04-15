package service

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestCompleteFlightRecordMarksRecordCompleted(t *testing.T) {
	db := newServiceTestDB(
		t,
		&model.Drone{},
		&model.Order{},
		&model.FlightRecord{},
		&model.FlightPosition{},
	)

	drone := &model.Drone{
		OwnerID:            31,
		Brand:              "DJI",
		Model:              "FC30",
		SerialNumber:       "SN-FLIGHT-001",
		AvailabilityStatus: "busy",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	start := time.Now().Add(-2 * time.Hour)
	end := start.Add(3 * time.Hour)
	takeoffAt := time.Now().Add(-35 * time.Minute)

	order := &model.Order{
		OrderNo:         "WRJ-FLIGHT-001",
		DroneID:         drone.ID,
		ClientUserID:    11,
		ProviderUserID:  31,
		Title:           "飞行完成测试单",
		ServiceType:     "heavy_cargo_lift_transport",
		ServiceAddress:  "南沙仓库",
		DestAddress:     "海岛吊运点",
		StartTime:       start,
		EndTime:         end,
		TotalAmount:     9800,
		Status:          "in_transit",
		NeedsDispatch:   true,
		ExecutionMode:   "dispatch_pool",
		FlightStartTime: &takeoffAt,
	}
	if err := db.Create(order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}

	record := &model.FlightRecord{
		FlightNo:    "WRJ-FLIGHT-001-F1",
		OrderID:     order.ID,
		PilotUserID: 66,
		DroneID:     drone.ID,
		TakeoffAt:   &takeoffAt,
		Status:      "in_progress",
	}
	if err := db.Create(record).Error; err != nil {
		t.Fatalf("create flight record: %v", err)
	}

	landingAt := takeoffAt.Add(35 * time.Minute)
	service := NewFlightService(repository.NewFlightRepo(db), repository.NewOrderRepo(db), nil, nil)
	completed, err := service.CompleteFlightRecord(record.ID, &landingAt)
	if err != nil {
		t.Fatalf("complete flight record: %v", err)
	}

	if completed.Status != "completed" {
		t.Fatalf("expected completed status, got %s", completed.Status)
	}
	if completed.LandingAt == nil || !completed.LandingAt.Equal(landingAt) {
		t.Fatalf("expected landing time %v, got %#v", landingAt, completed.LandingAt)
	}
	if completed.TotalDurationSeconds != int(landingAt.Sub(takeoffAt).Seconds()) {
		t.Fatalf("expected duration %d, got %d", int(landingAt.Sub(takeoffAt).Seconds()), completed.TotalDurationSeconds)
	}

	var reloaded model.FlightRecord
	if err := db.First(&reloaded, record.ID).Error; err != nil {
		t.Fatalf("reload flight record: %v", err)
	}
	if reloaded.Status != "completed" {
		t.Fatalf("expected persisted completed status, got %s", reloaded.Status)
	}
}
