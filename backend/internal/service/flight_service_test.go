package service

import (
	"math"
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

func TestBuildDevelopmentFlightSimulationPlanIncludesCorePhases(t *testing.T) {
	route := DevelopmentFlightSimulationRoute{
		StartLatitude:      23.03254,
		StartLongitude:     113.12241,
		EndLatitude:        23.03891,
		EndLongitude:       113.13567,
		StraightDistanceM:  1580,
		EstimatedDistanceM: 1710,
		CruiseAltitudeM:    76,
		IntervalSeconds:    3,
	}

	plan := buildDevelopmentFlightSimulationPlan(route, true)
	if len(plan.Steps) < 20 {
		t.Fatalf("expected at least 20 simulation samples, got %d", len(plan.Steps))
	}
	if plan.Route.EstimatedDurationS != len(plan.Steps)*route.IntervalSeconds {
		t.Fatalf("expected duration %d, got %d", len(plan.Steps)*route.IntervalSeconds, plan.Route.EstimatedDurationS)
	}

	phases := map[string]bool{}
	manualAlertCount := 0
	for _, step := range plan.Steps {
		phases[step.Phase] = true
		if step.ManualAlert != nil {
			manualAlertCount++
		}
	}

	for _, phase := range []string{"preflight", "takeoff", "climb", "cruise", "descent", "landing"} {
		if !phases[phase] {
			t.Fatalf("expected phase %s to be present", phase)
		}
	}
	if manualAlertCount < 2 {
		t.Fatalf("expected at least 2 sample alerts, got %d", manualAlertCount)
	}

	first := plan.Steps[0]
	last := plan.Steps[len(plan.Steps)-1]
	if first.Altitude != 0 {
		t.Fatalf("expected first sample altitude 0, got %d", first.Altitude)
	}
	if last.Altitude != 0 || last.Speed != 0 {
		t.Fatalf("expected final sample to be landed, got altitude=%d speed=%d", last.Altitude, last.Speed)
	}
	if math.Abs(first.Latitude-route.StartLatitude) > 0.0002 || math.Abs(first.Longitude-route.StartLongitude) > 0.0002 {
		t.Fatalf("expected first sample near start point, got (%f,%f)", first.Latitude, first.Longitude)
	}
	if math.Abs(last.Latitude-route.EndLatitude) > 0.0002 || math.Abs(last.Longitude-route.EndLongitude) > 0.0002 {
		t.Fatalf("expected final sample near end point, got (%f,%f)", last.Latitude, last.Longitude)
	}
}

func TestCurvedFlightCoordinateAnchorsStartAndEnd(t *testing.T) {
	startLat, startLng := 23.03254, 113.12241
	endLat, endLng := 23.03891, 113.13567

	lat0, lng0 := curvedFlightCoordinate(startLat, startLng, endLat, endLng, 0, 60)
	lat1, lng1 := curvedFlightCoordinate(startLat, startLng, endLat, endLng, 1, 60)

	if math.Abs(lat0-startLat) > 0.000001 || math.Abs(lng0-startLng) > 0.000001 {
		t.Fatalf("expected progress 0 to stay at start, got (%f,%f)", lat0, lng0)
	}
	if math.Abs(lat1-endLat) > 0.000001 || math.Abs(lng1-endLng) > 0.000001 {
		t.Fatalf("expected progress 1 to stay at end, got (%f,%f)", lat1, lng1)
	}
}

func TestCurvedFlightCoordinateCreatesLoopForSamePoint(t *testing.T) {
	startLat, startLng := 23.03254, 113.12241

	lat0, lng0 := curvedFlightCoordinate(startLat, startLng, startLat, startLng, 0, 60)
	latMid, lngMid := curvedFlightCoordinate(startLat, startLng, startLat, startLng, 0.5, 60)
	lat1, lng1 := curvedFlightCoordinate(startLat, startLng, startLat, startLng, 1, 60)

	if math.Abs(lat0-startLat) > 0.000001 || math.Abs(lng0-startLng) > 0.000001 {
		t.Fatalf("expected progress 0 to stay at origin, got (%f,%f)", lat0, lng0)
	}
	if math.Abs(lat1-startLat) > 0.000001 || math.Abs(lng1-startLng) > 0.000001 {
		t.Fatalf("expected progress 1 to return to origin, got (%f,%f)", lat1, lng1)
	}
	if math.Abs(latMid-startLat) < 0.00001 && math.Abs(lngMid-startLng) < 0.00001 {
		t.Fatalf("expected midpoint to move away from origin, got (%f,%f)", latMid, lngMid)
	}
}
