package service

import (
	"errors"
	"math"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type DevelopmentFlightSimulationOptions struct {
	ResetExistingData  bool `json:"reset_existing_data"`
	InjectSampleAlerts bool `json:"inject_sample_alerts"`
}

type DevelopmentFlightSimulationRoute struct {
	StartLatitude      float64 `json:"start_latitude"`
	StartLongitude     float64 `json:"start_longitude"`
	StartAddress       string  `json:"start_address"`
	EndLatitude        float64 `json:"end_latitude"`
	EndLongitude       float64 `json:"end_longitude"`
	EndAddress         string  `json:"end_address"`
	StraightDistanceM  int     `json:"straight_distance_m"`
	EstimatedDistanceM int     `json:"estimated_distance_m"`
	CruiseAltitudeM    int     `json:"cruise_altitude_m"`
	IntervalSeconds    int     `json:"interval_seconds"`
	EstimatedDurationS int     `json:"estimated_duration_seconds"`
}

type DevelopmentFlightSimulationTelemetry struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	Altitude       int     `json:"altitude"`
	Speed          int     `json:"speed"`
	Heading        int     `json:"heading"`
	VerticalSpeed  int     `json:"vertical_speed"`
	BatteryLevel   int     `json:"battery_level"`
	SignalStrength int     `json:"signal_strength"`
}

type DevelopmentFlightSimulationState struct {
	OrderID             int64                                 `json:"order_id"`
	FlightRecordID      int64                                 `json:"flight_record_id,omitempty"`
	FlightNo            string                                `json:"flight_no,omitempty"`
	Status              string                                `json:"status"`
	Phase               string                                `json:"phase"`
	PhaseLabel          string                                `json:"phase_label"`
	StepIndex           int                                   `json:"step_index"`
	TotalSteps          int                                   `json:"total_steps"`
	PositionCount       int                                   `json:"position_count"`
	AlertCount          int                                   `json:"alert_count"`
	SampleAlertsEnabled bool                                  `json:"sample_alerts_enabled"`
	StartedAt           *time.Time                            `json:"started_at,omitempty"`
	UpdatedAt           *time.Time                            `json:"updated_at,omitempty"`
	CompletedAt         *time.Time                            `json:"completed_at,omitempty"`
	LastError           string                                `json:"last_error,omitempty"`
	Route               DevelopmentFlightSimulationRoute      `json:"route"`
	LatestTelemetry     *DevelopmentFlightSimulationTelemetry `json:"latest_telemetry,omitempty"`
}

type developmentFlightSimulation struct {
	state  DevelopmentFlightSimulationState
	stopCh chan struct{}
}

type developmentFlightSimulationPlan struct {
	Route DevelopmentFlightSimulationRoute
	Steps []developmentFlightSimulationSample
}

type developmentFlightSimulationSample struct {
	Phase          string
	PhaseLabel     string
	Latitude       float64
	Longitude      float64
	Altitude       int
	Speed          int
	Heading        int
	VerticalSpeed  int
	BatteryLevel   int
	SignalStrength int
	GPSSatellites  int
	Temperature    *int
	WindSpeed      *int
	WindDirection  *int
	ManualAlert    *CreateFlightAlertInput
}

func (s *FlightService) InspectDevelopmentSimulation(order *model.Order) (*DevelopmentFlightSimulationState, error) {
	if order == nil {
		return nil, errors.New("订单不存在")
	}
	route, err := s.resolveDevelopmentSimulationRoute(order)
	if err != nil {
		return nil, err
	}

	state := &DevelopmentFlightSimulationState{
		OrderID:    order.ID,
		Status:     "idle",
		Phase:      "ready",
		PhaseLabel: "等待启动测试飞行",
		Route:      route,
	}

	record, err := s.flightRepo.GetActiveFlightRecordByOrder(order.ID)
	if err == nil && record != nil {
		state.FlightRecordID = record.ID
		state.FlightNo = record.FlightNo
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if positionCount, countErr := s.flightRepo.CountPositionsByOrder(order.ID); countErr == nil {
		state.PositionCount = int(positionCount)
	}
	if alerts, alertErr := s.flightRepo.GetAlertsByOrder(order.ID); alertErr == nil {
		state.AlertCount = len(alerts)
	}

	if activeState, ok := s.cloneDevelopmentSimulationState(order.ID); ok {
		activeState.Route = route
		if activeState.FlightRecordID == 0 {
			activeState.FlightRecordID = state.FlightRecordID
			activeState.FlightNo = state.FlightNo
		}
		if activeState.PositionCount == 0 {
			activeState.PositionCount = state.PositionCount
		}
		if activeState.AlertCount == 0 {
			activeState.AlertCount = state.AlertCount
		}
		return &activeState, nil
	}

	return state, nil
}

func (s *FlightService) StartDevelopmentSimulation(order *model.Order, options DevelopmentFlightSimulationOptions) (*DevelopmentFlightSimulationState, error) {
	if order == nil {
		return nil, errors.New("订单不存在")
	}
	if order.Status != "in_transit" {
		return nil, errors.New("请先将任务推进到运输中，再启动测试飞行")
	}

	if current, ok := s.cloneDevelopmentSimulationState(order.ID); ok && current.Status == "running" {
		return &current, nil
	}

	route, err := s.resolveDevelopmentSimulationRoute(order)
	if err != nil {
		return nil, err
	}

	record, err := s.GetActiveFlightRecordByOrder(order.ID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		record, err = s.ensureFlightRecord(order, order.PilotID, time.Now())
		if err != nil {
			return nil, err
		}
	}

	if options.ResetExistingData {
		if err := s.resetDevelopmentSimulationHistory(order.ID, record.ID); err != nil {
			return nil, err
		}
	}

	initialPositionCount := 0
	if positionCount, countErr := s.flightRepo.CountPositionsByOrder(order.ID); countErr == nil {
		initialPositionCount = int(positionCount)
	}
	initialAlertCount := 0
	if alerts, alertErr := s.flightRepo.GetAlertsByOrder(order.ID); alertErr == nil {
		initialAlertCount = len(alerts)
	}

	plan := buildDevelopmentFlightSimulationPlan(route, options.InjectSampleAlerts)
	now := time.Now()
	sim := &developmentFlightSimulation{
		state: DevelopmentFlightSimulationState{
			OrderID:             order.ID,
			FlightRecordID:      record.ID,
			FlightNo:            record.FlightNo,
			Status:              "running",
			Phase:               "preflight",
			PhaseLabel:          "飞手已接管测试飞行",
			StepIndex:           0,
			TotalSteps:          len(plan.Steps),
			PositionCount:       initialPositionCount,
			AlertCount:          initialAlertCount,
			SampleAlertsEnabled: options.InjectSampleAlerts,
			StartedAt:           &now,
			UpdatedAt:           &now,
			Route:               plan.Route,
		},
		stopCh: make(chan struct{}),
	}

	s.simMu.Lock()
	s.simulations[order.ID] = sim
	s.simMu.Unlock()

	go s.runDevelopmentSimulation(order, record, plan, sim)

	state := sim.state
	return &state, nil
}

func (s *FlightService) StopDevelopmentSimulation(orderID int64) (*DevelopmentFlightSimulationState, error) {
	s.simMu.Lock()
	defer s.simMu.Unlock()

	sim, ok := s.simulations[orderID]
	if !ok {
		return nil, errors.New("当前没有正在运行的测试飞行")
	}
	if sim.state.Status != "running" {
		state := sim.state
		return &state, nil
	}

	close(sim.stopCh)
	now := time.Now()
	sim.state.Status = "stopped"
	sim.state.Phase = "stopped"
	sim.state.PhaseLabel = "已手动停止测试飞行"
	sim.state.CompletedAt = &now
	sim.state.UpdatedAt = &now

	state := sim.state
	return &state, nil
}

func (s *FlightService) runDevelopmentSimulation(
	order *model.Order,
	record *model.FlightRecord,
	plan developmentFlightSimulationPlan,
	sim *developmentFlightSimulation,
) {
	interval := time.Duration(maxInt(plan.Route.IntervalSeconds, 2)) * time.Second

	for index, sample := range plan.Steps {
		select {
		case <-sim.stopCh:
			return
		default:
		}

		_, alerts, err := s.ReportPosition(&ReportPositionRequest{
			OrderID:        order.ID,
			DroneID:        order.DroneID,
			PilotID:        order.PilotID,
			Latitude:       sample.Latitude,
			Longitude:      sample.Longitude,
			Altitude:       sample.Altitude,
			Speed:          sample.Speed,
			Heading:        sample.Heading,
			VerticalSpeed:  sample.VerticalSpeed,
			BatteryLevel:   sample.BatteryLevel,
			SignalStrength: sample.SignalStrength,
			GPSSatellites:  sample.GPSSatellites,
			Temperature:    sample.Temperature,
			WindSpeed:      sample.WindSpeed,
			WindDirection:  sample.WindDirection,
		})
		if err != nil {
			s.markDevelopmentSimulationFailed(order.ID, sample.PhaseLabel, err)
			return
		}

		alertCount := len(alerts)
		if sample.ManualAlert != nil {
			alertInput := *sample.ManualAlert
			alertInput.FlightRecordID = record.ID
			alertInput.OrderID = order.ID
			alertInput.DroneID = order.DroneID
			alertInput.PilotID = order.PilotID
			if _, alertErr := s.CreateManualAlert(&alertInput); alertErr == nil {
				alertCount++
			} else {
				s.logger.Warn("创建测试态飞行告警失败", zap.Error(alertErr))
			}
		}

		s.updateDevelopmentSimulationProgress(order.ID, sample, index+1, alertCount)

		if index == len(plan.Steps)-1 {
			now := time.Now()
			if _, completeErr := s.CompleteFlightRecord(record.ID, &now); completeErr != nil {
				s.markDevelopmentSimulationFailed(order.ID, sample.PhaseLabel, completeErr)
				return
			}
			s.simMu.Lock()
			if current, ok := s.simulations[order.ID]; ok {
				current.state.Status = "completed"
				current.state.Phase = "landed"
				current.state.PhaseLabel = "测试飞行已完成，已抵达落点"
				current.state.CompletedAt = &now
				current.state.UpdatedAt = &now
			}
			s.simMu.Unlock()
			return
		}

		timer := time.NewTimer(interval)
		select {
		case <-sim.stopCh:
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}

func (s *FlightService) resolveDevelopmentSimulationRoute(order *model.Order) (DevelopmentFlightSimulationRoute, error) {
	var route DevelopmentFlightSimulationRoute
	if order == nil {
		return route, errors.New("订单不存在")
	}

	startLat := order.ServiceLatitude
	startLng := order.ServiceLongitude
	endLat := 0.0
	endLng := 0.0
	if order.DestLatitude != nil {
		endLat = *order.DestLatitude
	}
	if order.DestLongitude != nil {
		endLng = *order.DestLongitude
	}

	if startLat == 0 || startLng == 0 || endLat == 0 || endLng == 0 {
		fallbackStartLat, fallbackStartLng, fallbackEndLat, fallbackEndLng, err := s.GetDispatchCoords(order)
		if err != nil {
			return route, errors.New("当前订单缺少可用于测试飞行的起终点坐标")
		}
		if startLat == 0 || startLng == 0 {
			startLat = fallbackStartLat
			startLng = fallbackStartLng
		}
		if endLat == 0 || endLng == 0 {
			endLat = fallbackEndLat
			endLng = fallbackEndLng
		}
	}

	straightDistance := haversineDistance(startLat, startLng, endLat, endLng)
	if straightDistance < 20 {
		refinedStartLat, refinedStartLng, refinedEndLat, refinedEndLng, refinedDistance, refined := s.tryRefineSimulationCoordsWithGeocode(order)
		if refined {
			startLat = refinedStartLat
			startLng = refinedStartLng
			endLat = refinedEndLat
			endLng = refinedEndLng
			straightDistance = refinedDistance
		}
	}

	cruiseAltitude := clampInt(int(math.Round(42+math.Max(straightDistance, 120)/140)), 42, 108)
	intervalSeconds := maxInt(s.config.PositionReportInterval, 2)
	estimatedDistanceBase := math.Max(straightDistance, 260)
	estimatedDistance := int(math.Round(estimatedDistanceBase * 1.08))
	estimatedDuration := estimateSimulationDurationSeconds(estimatedDistanceBase, intervalSeconds)

	return DevelopmentFlightSimulationRoute{
		StartLatitude:      startLat,
		StartLongitude:     startLng,
		StartAddress:       order.ServiceAddress,
		EndLatitude:        endLat,
		EndLongitude:       endLng,
		EndAddress:         order.DestAddress,
		StraightDistanceM:  int(math.Round(straightDistance)),
		EstimatedDistanceM: estimatedDistance,
		CruiseAltitudeM:    cruiseAltitude,
		IntervalSeconds:    intervalSeconds,
		EstimatedDurationS: estimatedDuration,
	}, nil
}

func (s *FlightService) tryRefineSimulationCoordsWithGeocode(order *model.Order) (float64, float64, float64, float64, float64, bool) {
	if s.amapService == nil || !s.amapService.IsEnabled() || order == nil {
		return 0, 0, 0, 0, 0, false
	}
	if order.ServiceAddress == "" || order.DestAddress == "" {
		return 0, 0, 0, 0, 0, false
	}

	startResults, err := s.amapService.GeoCode(order.ServiceAddress, "")
	if err != nil || len(startResults) == 0 {
		return 0, 0, 0, 0, 0, false
	}
	endResults, err := s.amapService.GeoCode(order.DestAddress, "")
	if err != nil || len(endResults) == 0 {
		return 0, 0, 0, 0, 0, false
	}

	startLat := startResults[0].Latitude
	startLng := startResults[0].Longitude
	endLat := endResults[0].Latitude
	endLng := endResults[0].Longitude
	distance := haversineDistance(startLat, startLng, endLat, endLng)
	if distance <= 0 {
		return 0, 0, 0, 0, 0, false
	}
	return startLat, startLng, endLat, endLng, distance, true
}

func buildDevelopmentFlightSimulationPlan(
	route DevelopmentFlightSimulationRoute,
	injectSampleAlerts bool,
) developmentFlightSimulationPlan {
	distanceM := math.Max(float64(route.StraightDistanceM), 120)
	preflightCount := 2
	takeoffCount := 4
	climbCount := 4
	cruiseCount := clampInt(int(math.Round(distanceM/160))+10, 10, 24)
	descentCount := 4
	landingCount := 3
	totalSteps := preflightCount + takeoffCount + climbCount + cruiseCount + descentCount + landingCount

	totalDrain := clampInt(int(math.Round(distanceM/550))+18, 18, 32)
	maxCurveOffsetM := clampFloat(distanceM*0.08, 24, 85)
	steps := make([]developmentFlightSimulationSample, 0, totalSteps)
	midCruiseIndex := preflightCount + takeoffCount + climbCount + maxInt(cruiseCount/2, 1) - 1
	descentAlertIndex := preflightCount + takeoffCount + climbCount + cruiseCount + maxInt(descentCount/2, 1) - 1

	phaseWindow := func(progress float64, start, end float64) float64 {
		if end <= start {
			return 0
		}
		value := (progress - start) / (end - start)
		return clampFloat(value, 0, 1)
	}

	for index := 0; index < totalSteps; index++ {
		progress := 0.0
		if totalSteps > 1 {
			progress = float64(index) / float64(totalSteps-1)
		}
		pointLat, pointLng := curvedFlightCoordinate(route.StartLatitude, route.StartLongitude, route.EndLatitude, route.EndLongitude, progress, maxCurveOffsetM)
		nextProgress := clampFloat(progress+1/float64(totalSteps), 0, 1)
		nextLat, nextLng := curvedFlightCoordinate(route.StartLatitude, route.StartLongitude, route.EndLatitude, route.EndLongitude, nextProgress, maxCurveOffsetM)
		heading := calculateBearingDegrees(pointLat, pointLng, nextLat, nextLng)
		batteryLevel := clampInt(96-int(math.Round(float64(totalDrain)*progress)), 52, 98)
		signalStrength := clampInt(92-int(math.Round(10*progress))-index%3, 70, 96)
		gpsSatellites := clampInt(16-index%4, 12, 18)
		temperature := intPtr(24 + index%4)
		windSpeed := intPtr(3 + (index % 3))
		windDirection := intPtr((heading + 35) % 360)

		sample := developmentFlightSimulationSample{
			Phase:          "preflight",
			PhaseLabel:     "地面联检与起飞准备",
			Latitude:       pointLat,
			Longitude:      pointLng,
			Altitude:       0,
			Speed:          0,
			Heading:        heading,
			VerticalSpeed:  0,
			BatteryLevel:   batteryLevel,
			SignalStrength: signalStrength,
			GPSSatellites:  gpsSatellites,
			Temperature:    temperature,
			WindSpeed:      windSpeed,
			WindDirection:  windDirection,
		}

		switch {
		case index < preflightCount:
			sample.Phase = "preflight"
			sample.PhaseLabel = "地面联检与起飞准备"
			sample.Altitude = 0
			sample.Speed = 0
			sample.VerticalSpeed = 0
		case index < preflightCount+takeoffCount:
			window := phaseWindow(progress, 0.06, 0.18)
			sample.Phase = "takeoff"
			sample.PhaseLabel = "垂直起飞并离开装货点"
			sample.Altitude = int(math.Round(float64(route.CruiseAltitudeM) * (0.14 + window*0.34)))
			sample.Speed = clampInt(int(math.Round((2.0+window*3.8)*100)), 180, 620)
			sample.VerticalSpeed = clampInt(int(math.Round((2.6-window*0.8)*100)), 160, 320)
		case index < preflightCount+takeoffCount+climbCount:
			window := phaseWindow(progress, 0.18, 0.34)
			sample.Phase = "climb"
			sample.PhaseLabel = "持续爬升至巡航高度"
			sample.Altitude = int(math.Round(float64(route.CruiseAltitudeM) * (0.48 + window*0.52)))
			sample.Speed = clampInt(int(math.Round((5.8+window*2.2)*100)), 520, 820)
			sample.VerticalSpeed = clampInt(int(math.Round((2.2-window*0.9)*100)), 120, 260)
		case index < preflightCount+takeoffCount+climbCount+cruiseCount:
			window := phaseWindow(progress, 0.34, 0.78)
			sample.Phase = "cruise"
			sample.PhaseLabel = "沿订单起终点航线巡航运输"
			sample.Altitude = route.CruiseAltitudeM + int(math.Round(math.Sin(window*math.Pi*2)*3))
			sample.Speed = clampInt(int(math.Round((10.6+math.Sin(window*math.Pi)*1.4)*100)), 980, 1240)
			sample.VerticalSpeed = int(math.Round(math.Sin(window*math.Pi*2) * 25))
		case index < preflightCount+takeoffCount+climbCount+cruiseCount+descentCount:
			window := phaseWindow(progress, 0.78, 0.94)
			sample.Phase = "descent"
			sample.PhaseLabel = "进入落点前下降进场"
			sample.Altitude = clampInt(int(math.Round(float64(route.CruiseAltitudeM)*(0.88-window*0.78))), 10, route.CruiseAltitudeM)
			sample.Speed = clampInt(int(math.Round((7.2-window*2.7)*100)), 360, 720)
			sample.VerticalSpeed = -clampInt(int(math.Round((1.8+window*1.2)*100)), 160, 320)
		default:
			window := phaseWindow(progress, 0.94, 1)
			sample.Phase = "landing"
			sample.PhaseLabel = "减速着陆并贴近收货点"
			sample.Altitude = clampInt(int(math.Round((1-window)*8)), 0, 8)
			sample.Speed = clampInt(int(math.Round((1.8-window*1.7)*100)), 0, 180)
			sample.VerticalSpeed = -clampInt(int(math.Round((0.8-window*0.6)*100)), 0, 80)
			if index == totalSteps-1 {
				sample.Altitude = 0
				sample.Speed = 0
				sample.VerticalSpeed = 0
			}
		}

		if injectSampleAlerts && index == midCruiseIndex {
			lat := sample.Latitude
			lng := sample.Longitude
			alt := sample.Altitude
			sample.ManualAlert = &CreateFlightAlertInput{
				AlertType:      "wind_gust",
				AlertLevel:     "warning",
				AlertCode:      "DEV_WIND_GUST",
				Title:          "测试态阵风预警",
				Description:    "模拟巡航途中出现侧风增强，系统已自动修正航向。",
				Latitude:       &lat,
				Longitude:      &lng,
				Altitude:       &alt,
				ThresholdValue: "6m/s",
				ActualValue:    "8m/s",
			}
		}
		if injectSampleAlerts && index == descentAlertIndex {
			lat := sample.Latitude
			lng := sample.Longitude
			alt := sample.Altitude
			sample.ManualAlert = &CreateFlightAlertInput{
				AlertType:      "approach_notice",
				AlertLevel:     "info",
				AlertCode:      "DEV_APPROACH",
				Title:          "测试态进场提示",
				Description:    "模拟飞行已进入降落区，正在执行减速下降。",
				Latitude:       &lat,
				Longitude:      &lng,
				Altitude:       &alt,
				ThresholdValue: "",
				ActualValue:    "",
			}
		}

		steps = append(steps, sample)
	}

	route.EstimatedDurationS = len(steps) * route.IntervalSeconds
	return developmentFlightSimulationPlan{
		Route: route,
		Steps: steps,
	}
}

func (s *FlightService) updateDevelopmentSimulationProgress(
	orderID int64,
	sample developmentFlightSimulationSample,
	stepIndex int,
	additionalAlerts int,
) {
	now := time.Now()
	s.simMu.Lock()
	defer s.simMu.Unlock()

	sim, ok := s.simulations[orderID]
	if !ok {
		return
	}

	sim.state.StepIndex = stepIndex
	sim.state.Phase = sample.Phase
	sim.state.PhaseLabel = sample.PhaseLabel
	sim.state.PositionCount++
	sim.state.AlertCount += additionalAlerts
	sim.state.UpdatedAt = &now
	sim.state.LatestTelemetry = &DevelopmentFlightSimulationTelemetry{
		Latitude:       sample.Latitude,
		Longitude:      sample.Longitude,
		Altitude:       sample.Altitude,
		Speed:          sample.Speed,
		Heading:        sample.Heading,
		VerticalSpeed:  sample.VerticalSpeed,
		BatteryLevel:   sample.BatteryLevel,
		SignalStrength: sample.SignalStrength,
	}
}

func (s *FlightService) markDevelopmentSimulationFailed(orderID int64, phaseLabel string, err error) {
	now := time.Now()
	s.simMu.Lock()
	defer s.simMu.Unlock()

	if sim, ok := s.simulations[orderID]; ok {
		sim.state.Status = "failed"
		sim.state.Phase = "failed"
		sim.state.PhaseLabel = phaseLabel
		sim.state.LastError = err.Error()
		sim.state.CompletedAt = &now
		sim.state.UpdatedAt = &now
	}
}

func (s *FlightService) cloneDevelopmentSimulationState(orderID int64) (DevelopmentFlightSimulationState, bool) {
	s.simMu.RLock()
	defer s.simMu.RUnlock()

	sim, ok := s.simulations[orderID]
	if !ok {
		return DevelopmentFlightSimulationState{}, false
	}
	return sim.state, true
}

func (s *FlightService) resetDevelopmentSimulationHistory(orderID, flightRecordID int64) error {
	if err := s.flightRepo.DeletePositionsByOrder(orderID); err != nil {
		return err
	}
	if err := s.flightRepo.DeleteAlertsByOrder(orderID); err != nil {
		return err
	}
	if flightRecordID <= 0 {
		return nil
	}

	record, err := s.flightRepo.GetFlightRecordByID(flightRecordID)
	if err != nil {
		return err
	}
	record.TotalDistanceM = 0
	record.TotalDurationSeconds = 0
	record.MaxAltitudeM = 0
	record.LandingAt = nil
	record.Status = "executing"
	return s.flightRepo.UpdateFlightRecord(record)
}

func curvedFlightCoordinate(
	startLat, startLng, endLat, endLng float64,
	progress float64,
	maxCurveOffsetM float64,
) (float64, float64) {
	progress = clampFloat(progress, 0, 1)
	avgLatRad := ((startLat + endLat) / 2) * math.Pi / 180
	metersPerDegLat := 111320.0
	metersPerDegLng := math.Max(111320.0*math.Cos(avgLatRad), 1)

	deltaNorth := (endLat - startLat) * metersPerDegLat
	deltaEast := (endLng - startLng) * metersPerDegLng
	length := math.Hypot(deltaEast, deltaNorth)
	if length <= 0 {
		avgLatRad := startLat * math.Pi / 180
		metersPerDegLat := 111320.0
		metersPerDegLng := math.Max(111320.0*math.Cos(avgLatRad), 1)
		radius := math.Max(maxCurveOffsetM*0.75, 36)
		east := math.Sin(progress*math.Pi) * math.Cos(progress*2*math.Pi) * radius
		north := math.Sin(progress*math.Pi) * math.Sin(progress*2*math.Pi) * radius
		return startLat + north/metersPerDegLat, startLng + east/metersPerDegLng
	}

	forwardEast := deltaEast / length
	forwardNorth := deltaNorth / length
	rightEast := forwardNorth
	rightNorth := -forwardEast
	lateralOffset := math.Sin(progress*math.Pi) * maxCurveOffsetM

	east := deltaEast*progress + rightEast*lateralOffset
	north := deltaNorth*progress + rightNorth*lateralOffset

	return startLat + north/metersPerDegLat, startLng + east/metersPerDegLng
}

func calculateBearingDegrees(startLat, startLng, endLat, endLng float64) int {
	lat1 := startLat * math.Pi / 180
	lat2 := endLat * math.Pi / 180
	deltaLng := (endLng - startLng) * math.Pi / 180
	y := math.Sin(deltaLng) * math.Cos(lat2)
	x := math.Cos(lat1)*math.Sin(lat2) - math.Sin(lat1)*math.Cos(lat2)*math.Cos(deltaLng)
	bearing := math.Atan2(y, x) * 180 / math.Pi
	if bearing < 0 {
		bearing += 360
	}
	return int(math.Round(bearing)) % 360
}

func estimateSimulationDurationSeconds(distanceM float64, intervalSeconds int) int {
	cruiseCount := clampInt(int(math.Round(distanceM/160))+10, 10, 24)
	totalSteps := 2 + 4 + 4 + cruiseCount + 4 + 3
	return totalSteps * maxInt(intervalSeconds, 2)
}

func clampFloat(value, minValue, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func intPtr(value int) *int {
	return &value
}
