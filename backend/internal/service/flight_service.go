package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

// FlightService 飞行监控服务
type FlightService struct {
	flightRepo *repository.FlightRepo
	orderRepo  *repository.OrderRepo
	pilotRepo  *repository.PilotRepo
	logger     *zap.Logger

	// 配置
	config FlightServiceConfig
}

// FlightServiceConfig 服务配置
type FlightServiceConfig struct {
	LowBatteryWarning       int // 低电量预警阈值(%)
	LowBatteryCritical      int // 低电量紧急阈值(%)
	SignalLostTimeout       int // 信号丢失超时(秒)
	DeviationWarningDist    int // 偏航预警距离(米)
	DeviationCriticalDist   int // 偏航紧急距离(米)
	MaxAltitudeWarning      int // 最大高度预警(米)
	MaxSpeedWarning         int // 最大速度预警(米/秒)
	PositionReportInterval  int // 位置上报间隔(秒)
	GeofenceAlertDistance   int // 围栏预警距离(米)
	TrajectorySimpTolerance int // 轨迹简化容差(米)
}

func NewFlightService(
	flightRepo *repository.FlightRepo,
	orderRepo *repository.OrderRepo,
	pilotRepo *repository.PilotRepo,
	logger *zap.Logger,
) *FlightService {
	s := &FlightService{
		flightRepo: flightRepo,
		orderRepo:  orderRepo,
		pilotRepo:  pilotRepo,
		logger:     logger,
		config: FlightServiceConfig{
			LowBatteryWarning:       30,
			LowBatteryCritical:      15,
			SignalLostTimeout:       30,
			DeviationWarningDist:    200,
			DeviationCriticalDist:   500,
			MaxAltitudeWarning:      120,
			MaxSpeedWarning:         15,
			PositionReportInterval:  3,
			GeofenceAlertDistance:   100,
			TrajectorySimpTolerance: 5,
		},
	}
	// 从数据库加载配置
	s.loadConfigFromDB()
	return s
}

func (s *FlightService) loadConfigFromDB() {
	s.config.LowBatteryWarning = s.flightRepo.GetConfigInt("low_battery_warning", 30)
	s.config.LowBatteryCritical = s.flightRepo.GetConfigInt("low_battery_critical", 15)
	s.config.SignalLostTimeout = s.flightRepo.GetConfigInt("signal_lost_timeout", 30)
	s.config.DeviationWarningDist = s.flightRepo.GetConfigInt("deviation_warning_distance", 200)
	s.config.DeviationCriticalDist = s.flightRepo.GetConfigInt("deviation_critical_distance", 500)
	s.config.MaxAltitudeWarning = s.flightRepo.GetConfigInt("max_altitude_warning", 120)
	s.config.MaxSpeedWarning = s.flightRepo.GetConfigInt("max_speed_warning", 15)
	s.config.PositionReportInterval = s.flightRepo.GetConfigInt("position_report_interval", 3)
	s.config.GeofenceAlertDistance = s.flightRepo.GetConfigInt("geofence_alert_distance", 100)
	s.config.TrajectorySimpTolerance = s.flightRepo.GetConfigInt("trajectory_simplify_tolerance", 5)
}

func (s *FlightService) AdminListFlightRecords(page, pageSize int, filters map[string]interface{}) ([]model.FlightRecord, int64, error) {
	if s.flightRepo == nil {
		return nil, 0, errors.New("飞行记录仓储未初始化")
	}
	return s.flightRepo.AdminListFlightRecords(page, pageSize, filters)
}

// ==================== 位置上报 ====================

// ReportPositionRequest 位置上报请求
type ReportPositionRequest struct {
	OrderID        int64      `json:"order_id"`
	DroneID        int64      `json:"drone_id"`
	PilotID        int64      `json:"pilot_id"`
	Latitude       float64    `json:"latitude"`
	Longitude      float64    `json:"longitude"`
	Altitude       int        `json:"altitude"`
	Speed          int        `json:"speed"`          // 米/秒x100
	Heading        int        `json:"heading"`        // 度
	VerticalSpeed  int        `json:"vertical_speed"` // 米/秒x100
	BatteryLevel   int        `json:"battery_level"`
	SignalStrength int        `json:"signal_strength"`
	GPSSatellites  int        `json:"gps_satellites"`
	Temperature    *int       `json:"temperature"`
	WindSpeed      *int       `json:"wind_speed"`
	WindDirection  *int       `json:"wind_direction"`
	RecordedAt     *time.Time `json:"recorded_at"`
}

// ReportPosition 上报飞行位置
func (s *FlightService) ReportPosition(req *ReportPositionRequest) (*model.FlightPosition, []model.FlightAlert, error) {
	pos := &model.FlightPosition{
		OrderID:        req.OrderID,
		DroneID:        req.DroneID,
		PilotID:        req.PilotID,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		Altitude:       req.Altitude,
		Speed:          req.Speed,
		Heading:        req.Heading,
		VerticalSpeed:  req.VerticalSpeed,
		BatteryLevel:   req.BatteryLevel,
		SignalStrength: req.SignalStrength,
		GPSSatellites:  req.GPSSatellites,
		Temperature:    req.Temperature,
		WindSpeed:      req.WindSpeed,
		WindDirection:  req.WindDirection,
		RecordedAt:     time.Now(),
	}
	if req.RecordedAt != nil {
		pos.RecordedAt = *req.RecordedAt
	}

	return s.persistPosition(pos, req.PilotID)
}

func (s *FlightService) persistPosition(pos *model.FlightPosition, fallbackPilotID int64) (*model.FlightPosition, []model.FlightAlert, error) {
	order, err := s.orderRepo.GetByID(pos.OrderID)
	if err != nil {
		return nil, nil, err
	}

	record, err := s.ensureFlightRecord(order, fallbackPilotID, pos.RecordedAt)
	if err != nil {
		return nil, nil, err
	}
	pos.FlightRecordID = &record.ID

	if err := s.flightRepo.RecordPosition(pos); err != nil {
		return nil, nil, err
	}

	alerts := s.checkAndCreateAlerts(pos)
	if _, err := s.refreshFlightRecordMetrics(record, order); err != nil {
		return pos, alerts, err
	}

	return pos, alerts, nil
}

func (s *FlightService) SyncOrderFlightRecord(orderID int64) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}
	_, err = s.syncOrderFlightRecord(order)
	return err
}

func (s *FlightService) SyncPilotFulfillmentRecords(pilotID int64) error {
	if pilotID <= 0 {
		return nil
	}

	pilot, err := s.pilotRepo.GetByID(pilotID)
	if err != nil {
		return err
	}
	if pilot.UserID <= 0 {
		return nil
	}

	orders, err := s.orderRepo.ListOrdersForFlightSyncByPilotUser(pilot.UserID)
	if err != nil {
		return err
	}
	for i := range orders {
		if _, err := s.syncOrderFlightRecord(&orders[i]); err != nil {
			return err
		}
	}
	return nil
}

func (s *FlightService) syncOrderFlightRecord(order *model.Order) (*model.FlightRecord, error) {
	if order == nil || order.ID == 0 {
		return nil, nil
	}

	record, err := s.flightRepo.GetLatestFlightRecordByOrder(order.ID)
	if err == nil && record != nil {
		return s.refreshFlightRecordMetrics(record, order)
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if !s.shouldMaterializeFlightRecord(order) {
		return nil, nil
	}

	recordedAt := order.UpdatedAt
	if order.CompletedAt != nil {
		recordedAt = *order.CompletedAt
	}
	if order.FlightEndTime != nil {
		recordedAt = *order.FlightEndTime
	}
	if order.FlightStartTime != nil {
		recordedAt = *order.FlightStartTime
	}

	record, err = s.ensureFlightRecord(order, order.PilotID, recordedAt)
	if err != nil {
		return nil, err
	}
	return s.refreshFlightRecordMetrics(record, order)
}

func (s *FlightService) shouldMaterializeFlightRecord(order *model.Order) bool {
	if order == nil {
		return false
	}
	if order.FlightStartTime != nil || order.FlightEndTime != nil {
		return true
	}
	if order.ActualFlightDuration > 0 || order.ActualFlightDistance > 0 || order.MaxAltitude > 0 {
		return true
	}
	positionCount, err := s.flightRepo.CountPositionsByOrder(order.ID)
	if err == nil && positionCount > 0 {
		return true
	}
	return false
}

func (s *FlightService) ensureFlightRecord(order *model.Order, fallbackPilotID int64, recordedAt time.Time) (*model.FlightRecord, error) {
	record, err := s.flightRepo.GetActiveFlightRecordByOrder(order.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err == nil {
		if syncErr := s.syncFlightRecordWithOrder(record, order, fallbackPilotID, recordedAt); syncErr != nil {
			return nil, syncErr
		}
		return record, nil
	}

	recordCount, err := s.flightRepo.CountFlightRecordsByOrder(order.ID)
	if err != nil {
		return nil, err
	}

	pilotUserID, err := s.resolvePilotUserID(order, fallbackPilotID)
	if err != nil {
		return nil, err
	}

	takeoffAt := recordedAt
	if order.FlightStartTime != nil {
		takeoffAt = *order.FlightStartTime
	}

	orderNo := order.OrderNo
	if orderNo == "" {
		orderNo = fmt.Sprintf("ORD%d", order.ID)
	}

	record = &model.FlightRecord{
		FlightNo:             fmt.Sprintf("%s-F%d", orderNo, recordCount+1),
		OrderID:              order.ID,
		DispatchTaskID:       order.DispatchTaskID,
		PilotUserID:          pilotUserID,
		DroneID:              order.DroneID,
		TakeoffAt:            &takeoffAt,
		TotalDurationSeconds: order.ActualFlightDuration,
		TotalDistanceM:       float64(order.ActualFlightDistance),
		MaxAltitudeM:         float64(order.MaxAltitude),
		Status:               "executing",
	}
	if order.FlightEndTime != nil {
		record.LandingAt = order.FlightEndTime
		record.Status = "completed"
	}

	if err := s.flightRepo.CreateFlightRecord(record); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *FlightService) resolvePilotUserID(order *model.Order, fallbackPilotID int64) (int64, error) {
	if order.ExecutorPilotUserID > 0 {
		return order.ExecutorPilotUserID, nil
	}
	if order.PilotID > 0 {
		pilot, err := s.pilotRepo.GetByID(order.PilotID)
		if err == nil && pilot.UserID > 0 {
			return pilot.UserID, nil
		}
	}
	if fallbackPilotID > 0 {
		pilot, err := s.pilotRepo.GetByID(fallbackPilotID)
		if err == nil && pilot.UserID > 0 {
			return pilot.UserID, nil
		}
	}
	return 0, nil
}

func (s *FlightService) syncFlightRecordWithOrder(record *model.FlightRecord, order *model.Order, fallbackPilotID int64, recordedAt time.Time) error {
	changed := false

	if record.DispatchTaskID == nil && order.DispatchTaskID != nil {
		record.DispatchTaskID = order.DispatchTaskID
		changed = true
	}
	if record.PilotUserID == 0 {
		pilotUserID, err := s.resolvePilotUserID(order, fallbackPilotID)
		if err != nil {
			return err
		}
		if pilotUserID > 0 {
			record.PilotUserID = pilotUserID
			changed = true
		}
	}
	if record.TakeoffAt == nil {
		takeoffAt := recordedAt
		if order.FlightStartTime != nil {
			takeoffAt = *order.FlightStartTime
		}
		record.TakeoffAt = &takeoffAt
		changed = true
	} else if order.FlightStartTime != nil && order.FlightStartTime.Before(*record.TakeoffAt) {
		record.TakeoffAt = order.FlightStartTime
		changed = true
	}

	if order.FlightEndTime != nil && (record.LandingAt == nil || order.FlightEndTime.After(*record.LandingAt)) {
		record.LandingAt = order.FlightEndTime
		changed = true
	}

	targetStatus := record.Status
	switch {
	case order.Status == "cancelled" && record.TakeoffAt != nil:
		targetStatus = "aborted"
	case record.LandingAt != nil || order.Status == "delivered" || order.Status == "completed":
		targetStatus = "completed"
	case record.TakeoffAt != nil || order.Status == "in_transit":
		targetStatus = "executing"
	default:
		targetStatus = "pending"
	}
	if targetStatus != record.Status {
		record.Status = targetStatus
		changed = true
	}

	if !changed {
		return nil
	}
	return s.flightRepo.UpdateFlightRecord(record)
}

func (s *FlightService) refreshFlightRecordMetrics(record *model.FlightRecord, order *model.Order) (*model.FlightRecord, error) {
	positions, err := s.flightRepo.GetPositionsByFlightRecord(record.ID)
	if err != nil {
		return nil, err
	}

	if err := s.syncFlightRecordWithOrder(record, order, order.PilotID, time.Now()); err != nil {
		return nil, err
	}

	durationSec, distanceMeters, maxAlt := calcFlightMetricsFromPositions(positions)
	if durationSec == 0 && order.ActualFlightDuration > 0 {
		durationSec = int64(order.ActualFlightDuration)
	}
	if record.TakeoffAt == nil && len(positions) > 0 {
		record.TakeoffAt = &positions[0].RecordedAt
	}
	if record.LandingAt == nil && order.FlightEndTime != nil {
		record.LandingAt = order.FlightEndTime
	}

	if durationSec == 0 && record.TakeoffAt != nil && record.LandingAt != nil && record.LandingAt.After(*record.TakeoffAt) {
		durationSec = int64(record.LandingAt.Sub(*record.TakeoffAt).Seconds())
	}

	record.TotalDurationSeconds = int(durationSec)
	if distanceMeters == 0 && order.ActualFlightDistance > 0 {
		distanceMeters = float64(order.ActualFlightDistance)
	}
	record.TotalDistanceM = distanceMeters
	record.MaxAltitudeM = math.Max(math.Max(float64(maxAlt), float64(order.MaxAltitude)), record.MaxAltitudeM)

	if err := s.syncFlightRecordWithOrder(record, order, order.PilotID, time.Now()); err != nil {
		return nil, err
	}
	if err := s.flightRepo.UpdateFlightRecord(record); err != nil {
		return nil, err
	}
	if err := s.syncOrderFlightSummary(order.ID); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *FlightService) syncOrderFlightSummary(orderID int64) error {
	records, err := s.flightRepo.ListFlightRecordsByOrder(orderID)
	if err != nil {
		return err
	}
	if len(records) == 0 {
		return nil
	}

	totalDuration := 0
	totalDistance := 0.0
	maxAltitude := 0.0
	var earliestTakeoff *time.Time
	var latestLanding *time.Time

	for _, record := range records {
		totalDuration += record.TotalDurationSeconds
		totalDistance += record.TotalDistanceM
		if record.MaxAltitudeM > maxAltitude {
			maxAltitude = record.MaxAltitudeM
		}
		if record.TakeoffAt != nil && (earliestTakeoff == nil || record.TakeoffAt.Before(*earliestTakeoff)) {
			t := *record.TakeoffAt
			earliestTakeoff = &t
		}
		if record.LandingAt != nil && (latestLanding == nil || record.LandingAt.After(*latestLanding)) {
			t := *record.LandingAt
			latestLanding = &t
		}
	}

	avgSpeed := 0
	if totalDuration > 0 {
		avgSpeed = int(math.Round((totalDistance / float64(totalDuration)) * 100))
	}

	fields := map[string]interface{}{
		"actual_flight_duration": totalDuration,
		"actual_flight_distance": int(math.Round(totalDistance)),
		"max_altitude":           int(math.Round(maxAltitude)),
		"avg_speed":              avgSpeed,
	}
	if earliestTakeoff != nil {
		fields["flight_start_time"] = *earliestTakeoff
	}
	if latestLanding != nil {
		fields["flight_end_time"] = *latestLanding
	}

	return s.orderRepo.UpdateFields(orderID, fields)
}

// checkAndCreateAlerts 检查状态并创建告警
func (s *FlightService) checkAndCreateAlerts(pos *model.FlightPosition) []model.FlightAlert {
	var alerts []model.FlightAlert

	// 1. 低电量检查
	if pos.BatteryLevel <= s.config.LowBatteryCritical {
		alert := s.createAlert(pos, "low_battery", "critical", "BATT_CRIT",
			"电量严重不足",
			fmt.Sprintf("当前电量%d%%，低于紧急阈值%d%%，请立即降落", pos.BatteryLevel, s.config.LowBatteryCritical),
			fmt.Sprintf("%d%%", s.config.LowBatteryCritical),
			fmt.Sprintf("%d%%", pos.BatteryLevel))
		alerts = append(alerts, alert)
	} else if pos.BatteryLevel <= s.config.LowBatteryWarning {
		alert := s.createAlert(pos, "low_battery", "warning", "BATT_WARN",
			"电量不足预警",
			fmt.Sprintf("当前电量%d%%，低于预警阈值%d%%", pos.BatteryLevel, s.config.LowBatteryWarning),
			fmt.Sprintf("%d%%", s.config.LowBatteryWarning),
			fmt.Sprintf("%d%%", pos.BatteryLevel))
		alerts = append(alerts, alert)
	}

	// 2. 高度检查
	if pos.Altitude > s.config.MaxAltitudeWarning {
		alert := s.createAlert(pos, "altitude", "warning", "ALT_WARN",
			"飞行高度超限",
			fmt.Sprintf("当前高度%d米，超过限制%d米", pos.Altitude, s.config.MaxAltitudeWarning),
			fmt.Sprintf("%dm", s.config.MaxAltitudeWarning),
			fmt.Sprintf("%dm", pos.Altitude))
		alerts = append(alerts, alert)
	}

	// 3. 速度检查 (speed是米/秒x100)
	speedMS := float64(pos.Speed) / 100.0
	if speedMS > float64(s.config.MaxSpeedWarning) {
		alert := s.createAlert(pos, "speed", "warning", "SPEED_WARN",
			"飞行速度过快",
			fmt.Sprintf("当前速度%.1f米/秒，超过限制%d米/秒", speedMS, s.config.MaxSpeedWarning),
			fmt.Sprintf("%dm/s", s.config.MaxSpeedWarning),
			fmt.Sprintf("%.1fm/s", speedMS))
		alerts = append(alerts, alert)
	}

	// 4. 信号强度检查
	if pos.SignalStrength < 30 {
		alert := s.createAlert(pos, "signal_lost", "warning", "SIG_WEAK",
			"信号较弱",
			fmt.Sprintf("当前信号强度%d%%", pos.SignalStrength),
			"30%",
			fmt.Sprintf("%d%%", pos.SignalStrength))
		alerts = append(alerts, alert)
	}

	// 5. 围栏检查
	fenceAlerts := s.checkGeofences(pos)
	alerts = append(alerts, fenceAlerts...)

	// 保存告警
	for i := range alerts {
		s.flightRepo.CreateAlert(&alerts[i])
	}

	return alerts
}

func (s *FlightService) createAlert(pos *model.FlightPosition, alertType, level, code, title, desc, threshold, actual string) model.FlightAlert {
	lat := pos.Latitude
	lng := pos.Longitude
	alt := pos.Altitude
	return model.FlightAlert{
		FlightRecordID: pos.FlightRecordID,
		OrderID:        pos.OrderID,
		DroneID:        pos.DroneID,
		PilotID:        pos.PilotID,
		AlertType:      alertType,
		AlertLevel:     level,
		AlertCode:      code,
		Title:          title,
		Description:    desc,
		Latitude:       &lat,
		Longitude:      &lng,
		Altitude:       &alt,
		ThresholdValue: threshold,
		ActualValue:    actual,
		Status:         "active",
		TriggeredAt:    time.Now(),
	}
}

// checkGeofences 检查围栏违规
func (s *FlightService) checkGeofences(pos *model.FlightPosition) []model.FlightAlert {
	var alerts []model.FlightAlert

	fences, err := s.flightRepo.GetActiveGeofences()
	if err != nil {
		s.logger.Error("获取围栏列表失败", zap.Error(err))
		return alerts
	}

	for _, fence := range fences {
		isInside := s.isInsideGeofence(pos.Latitude, pos.Longitude, pos.Altitude, &fence)

		// 禁飞区/限飞区内部触发告警
		if isInside && (fence.FenceType == "no_fly" || fence.FenceType == "restricted") {
			level := "warning"
			if fence.FenceType == "no_fly" {
				level = "critical"
			}

			alert := model.FlightAlert{
				FlightRecordID: pos.FlightRecordID,
				OrderID:        pos.OrderID,
				DroneID:        pos.DroneID,
				PilotID:        pos.PilotID,
				AlertType:      "geofence",
				AlertLevel:     level,
				AlertCode:      "GEO_VIOLATION",
				Title:          fmt.Sprintf("进入%s", fence.Name),
				Description:    fmt.Sprintf("无人机已进入%s(%s)，请立即撤离", fence.Name, fence.FenceType),
				Latitude:       &pos.Latitude,
				Longitude:      &pos.Longitude,
				Altitude:       &pos.Altitude,
				Status:         "active",
				TriggeredAt:    time.Now(),
			}
			alerts = append(alerts, alert)

			// 记录违规
			violation := &model.GeofenceViolation{
				OrderID:       pos.OrderID,
				DroneID:       pos.DroneID,
				GeofenceID:    fence.ID,
				ViolationType: "entered",
				Latitude:      pos.Latitude,
				Longitude:     pos.Longitude,
				Altitude:      &pos.Altitude,
				ActionTaken:   "alert_sent",
				ViolatedAt:    time.Now(),
			}
			s.flightRepo.CreateViolation(violation)
		}
	}

	return alerts
}

// isInsideGeofence 判断是否在围栏内
func (s *FlightService) isInsideGeofence(lat, lng float64, alt int, fence *model.Geofence) bool {
	// 高度检查
	if alt < fence.MinAltitude || alt > fence.MaxAltitude {
		return false
	}

	if fence.GeometryType == "circle" {
		if fence.CenterLatitude == nil || fence.CenterLongitude == nil || fence.Radius == nil {
			return false
		}
		dist := haversineDistance(lat, lng, *fence.CenterLatitude, *fence.CenterLongitude)
		return dist <= float64(*fence.Radius)
	}

	// 多边形检查 - 简化实现
	// TODO: 实现完整的多边形包含判断
	return false
}

// ==================== 告警管理 ====================

// GetAlertsByOrder 获取订单告警列表
func (s *FlightService) GetAlertsByOrder(orderID int64) ([]model.FlightAlert, error) {
	return s.flightRepo.GetAlertsByOrder(orderID)
}

func (s *FlightService) GetAlertsByFlightRecord(flightRecordID int64) ([]model.FlightAlert, error) {
	return s.flightRepo.GetAlertsByFlightRecord(flightRecordID)
}

// GetActiveAlerts 获取活跃告警
func (s *FlightService) GetActiveAlerts(orderID int64) ([]model.FlightAlert, error) {
	return s.flightRepo.GetActiveAlerts(orderID)
}

// AcknowledgeAlert 确认告警
func (s *FlightService) AcknowledgeAlert(alertID, userID int64) error {
	return s.flightRepo.AcknowledgeAlert(alertID, userID)
}

// ResolveAlert 解决告警
func (s *FlightService) ResolveAlert(alertID int64, note string) error {
	return s.flightRepo.ResolveAlert(alertID, note)
}

// ==================== 围栏管理 ====================

// CreateGeofence 创建围栏
func (s *FlightService) CreateGeofence(fence *model.Geofence) error {
	return s.flightRepo.CreateGeofence(fence)
}

// GetGeofenceByID 获取围栏
func (s *FlightService) GetGeofenceByID(id int64) (*model.Geofence, error) {
	return s.flightRepo.GetGeofenceByID(id)
}

// UpdateGeofence 更新围栏
func (s *FlightService) UpdateGeofence(fence *model.Geofence) error {
	return s.flightRepo.UpdateGeofence(fence)
}

// DeleteGeofence 删除围栏
func (s *FlightService) DeleteGeofence(id int64) error {
	return s.flightRepo.DeleteGeofence(id)
}

// ListGeofences 围栏列表
func (s *FlightService) ListGeofences(page, pageSize int, filters map[string]interface{}) ([]model.Geofence, int64, error) {
	return s.flightRepo.ListGeofences(page, pageSize, filters)
}

// ==================== 轨迹录制 ====================

// StartTrajectoryRecording 开始轨迹录制
func (s *FlightService) StartTrajectoryRecording(orderID, droneID, pilotID int64, startLat, startLng float64, startAddr string) (*model.FlightTrajectory, error) {
	traj := &model.FlightTrajectory{
		OrderID:         orderID,
		DroneID:         droneID,
		PilotID:         pilotID,
		StartLatitude:   startLat,
		StartLongitude:  startLng,
		StartAddress:    startAddr,
		EndLatitude:     startLat, // 初始值
		EndLongitude:    startLng,
		RecordingStatus: "recording",
		StartedAt:       time.Now(),
	}

	if err := s.flightRepo.CreateTrajectory(traj); err != nil {
		return nil, err
	}

	// 创建起点航点
	startWP := &model.FlightWaypoint{
		TrajectoryID: traj.ID,
		SequenceNo:   0,
		Latitude:     startLat,
		Longitude:    startLng,
		Altitude:     0,
		WaypointType: "start",
		RecordedAt:   time.Now(),
	}
	s.flightRepo.CreateWaypoint(startWP)

	return traj, nil
}

// StopTrajectoryRecording 停止轨迹录制
func (s *FlightService) StopTrajectoryRecording(trajectoryID int64, endLat, endLng float64, endAddr string) (*model.FlightTrajectory, error) {
	traj, err := s.flightRepo.GetTrajectoryByID(trajectoryID)
	if err != nil {
		return nil, err
	}

	if traj.RecordingStatus != "recording" {
		return nil, errors.New("轨迹未在录制中")
	}

	// 获取所有航点计算统计
	waypoints, _ := s.flightRepo.GetWaypointsByTrajectory(trajectoryID)

	// 计算统计数据
	totalDist := 0.0
	maxAlt := 0
	sumAlt := 0
	sumSpeed := 0
	count := len(waypoints)

	for i, wp := range waypoints {
		if wp.Altitude > maxAlt {
			maxAlt = wp.Altitude
		}
		sumAlt += wp.Altitude
		if wp.Speed != nil {
			sumSpeed += *wp.Speed
		}

		if i > 0 {
			dist := haversineDistance(waypoints[i-1].Latitude, waypoints[i-1].Longitude, wp.Latitude, wp.Longitude)
			totalDist += dist
		}
	}

	avgAlt := 0
	avgSpeed := 0
	if count > 0 {
		avgAlt = sumAlt / count
		avgSpeed = sumSpeed / count
	}

	duration := int(time.Since(traj.StartedAt).Seconds())

	// 添加终点航点
	endWP := &model.FlightWaypoint{
		TrajectoryID: trajectoryID,
		SequenceNo:   count,
		Latitude:     endLat,
		Longitude:    endLng,
		WaypointType: "end",
		RecordedAt:   time.Now(),
	}
	s.flightRepo.CreateWaypoint(endWP)

	// 生成简化轨迹数据
	waypointsData := s.generateSimplifiedWaypoints(waypoints)
	waypointsJSON, _ := json.Marshal(waypointsData)

	// 更新轨迹
	stats := map[string]interface{}{
		"end_latitude":   endLat,
		"end_longitude":  endLng,
		"end_address":    endAddr,
		"total_distance": int(totalDist),
		"total_duration": duration,
		"waypoint_count": count + 1,
		"max_altitude":   maxAlt,
		"avg_altitude":   avgAlt,
		"avg_speed":      avgSpeed,
		"waypoints_data": waypointsJSON,
	}

	if err := s.flightRepo.CompleteTrajectory(trajectoryID, stats); err != nil {
		return nil, err
	}

	return s.flightRepo.GetTrajectoryByID(trajectoryID)
}

// generateSimplifiedWaypoints 生成简化航点数据(用于快速加载)
func (s *FlightService) generateSimplifiedWaypoints(waypoints []model.FlightWaypoint) []map[string]interface{} {
	// 使用 Douglas-Peucker 算法简化轨迹
	simplified := make([]map[string]interface{}, 0)

	tolerance := float64(s.config.TrajectorySimpTolerance)
	indices := douglasPeuckerIndices(waypoints, tolerance)

	for _, i := range indices {
		wp := waypoints[i]
		simplified = append(simplified, map[string]interface{}{
			"lat": wp.Latitude,
			"lng": wp.Longitude,
			"alt": wp.Altitude,
		})
	}

	return simplified
}

// AddWaypointToTrajectory 添加航点到轨迹
func (s *FlightService) AddWaypointToTrajectory(trajectoryID int64, lat, lng float64, alt int, speed, heading *int, waypointType string) error {
	traj, err := s.flightRepo.GetTrajectoryByID(trajectoryID)
	if err != nil {
		return err
	}

	if traj.RecordingStatus != "recording" {
		return errors.New("轨迹未在录制中")
	}

	// 获取当前航点数量作为序号
	wps, _ := s.flightRepo.GetWaypointsByTrajectory(trajectoryID)
	seqNo := len(wps)

	wp := &model.FlightWaypoint{
		TrajectoryID: trajectoryID,
		SequenceNo:   seqNo,
		Latitude:     lat,
		Longitude:    lng,
		Altitude:     alt,
		WaypointType: waypointType,
		Speed:        speed,
		Heading:      heading,
		RecordedAt:   time.Now(),
	}

	return s.flightRepo.CreateWaypoint(wp)
}

// GetTrajectoryByOrder 根据订单获取轨迹
func (s *FlightService) GetTrajectoryByOrder(orderID int64) (*model.FlightTrajectory, error) {
	return s.flightRepo.GetTrajectoryByOrderID(orderID)
}

// GetTrajectoryWaypoints 获取轨迹航点
func (s *FlightService) GetTrajectoryWaypoints(trajectoryID int64) ([]model.FlightWaypoint, error) {
	return s.flightRepo.GetWaypointsByTrajectory(trajectoryID)
}

// MarkTrajectoryAsTemplate 标记轨迹为模板
func (s *FlightService) MarkTrajectoryAsTemplate(trajectoryID int64, name, description string) error {
	traj, err := s.flightRepo.GetTrajectoryByID(trajectoryID)
	if err != nil {
		return err
	}

	traj.IsTemplate = true
	if name != "" {
		traj.Name = name
	}
	if description != "" {
		traj.Description = description
	}

	return s.flightRepo.UpdateTrajectory(traj)
}

// ==================== 路线管理 ====================

// CreateRouteFromTrajectory 从轨迹创建路线
func (s *FlightService) CreateRouteFromTrajectory(trajectoryID, ownerID int64, name, desc string, visibility string) (*model.SavedRoute, error) {
	traj, err := s.flightRepo.GetTrajectoryByID(trajectoryID)
	if err != nil {
		return nil, err
	}

	if traj.RecordingStatus != "completed" {
		return nil, errors.New("轨迹尚未完成录制")
	}

	// 获取航点
	waypoints, _ := s.flightRepo.GetWaypointsByTrajectory(trajectoryID)
	waypointsData := make([]map[string]interface{}, len(waypoints))
	for i, wp := range waypoints {
		waypointsData[i] = map[string]interface{}{
			"seq":  wp.SequenceNo,
			"lat":  wp.Latitude,
			"lng":  wp.Longitude,
			"alt":  wp.Altitude,
			"type": wp.WaypointType,
		}
	}
	waypointsJSON, _ := json.Marshal(waypointsData)

	route := &model.SavedRoute{
		OwnerID:             ownerID,
		PilotID:             traj.PilotID,
		SourceTrajectoryID:  trajectoryID,
		Name:                name,
		Description:         desc,
		StartLatitude:       traj.StartLatitude,
		StartLongitude:      traj.StartLongitude,
		StartAddress:        traj.StartAddress,
		EndLatitude:         traj.EndLatitude,
		EndLongitude:        traj.EndLongitude,
		EndAddress:          traj.EndAddress,
		TotalDistance:       traj.TotalDistance,
		EstimatedDuration:   traj.TotalDuration,
		WaypointCount:       traj.WaypointCount,
		RecommendedAltitude: traj.AvgAltitude,
		Waypoints:           model.JSON(waypointsJSON),
		Visibility:          visibility,
		Status:              "active",
	}

	if err := s.flightRepo.CreateSavedRoute(route); err != nil {
		return nil, err
	}

	// 增加轨迹使用计数
	s.flightRepo.IncrementTrajectoryUseCount(trajectoryID)

	return route, nil
}

// GetSavedRouteByID 获取保存的路线
func (s *FlightService) GetSavedRouteByID(id int64) (*model.SavedRoute, error) {
	return s.flightRepo.GetSavedRouteByID(id)
}

// UpdateSavedRoute 更新保存的路线
func (s *FlightService) UpdateSavedRoute(route *model.SavedRoute) error {
	return s.flightRepo.UpdateSavedRoute(route)
}

// DeleteSavedRoute 删除保存的路线
func (s *FlightService) DeleteSavedRoute(id int64) error {
	return s.flightRepo.DeleteSavedRoute(id)
}

// ListUserRoutes 获取用户路线列表
func (s *FlightService) ListUserRoutes(ownerID int64) ([]model.SavedRoute, error) {
	return s.flightRepo.GetRoutesByOwner(ownerID)
}

// ListPublicRoutes 获取公开路线
func (s *FlightService) ListPublicRoutes(limit int) ([]model.SavedRoute, error) {
	return s.flightRepo.GetPublicRoutes(limit)
}

// FindNearbyRoutes 查找附近路线
func (s *FlightService) FindNearbyRoutes(lat, lng, radiusKM float64) ([]model.SavedRoute, error) {
	return s.flightRepo.FindNearbyRoutes(lat, lng, radiusKM)
}

// UseRoute 使用路线
func (s *FlightService) UseRoute(routeID int64) error {
	return s.flightRepo.IncrementRouteUseCount(routeID)
}

// RateRoute 评价路线
func (s *FlightService) RateRoute(routeID int64, rating float64) error {
	if rating < 1 || rating > 5 {
		return errors.New("评分必须在1-5之间")
	}
	return s.flightRepo.UpdateRouteRating(routeID, rating)
}

// ==================== 多点任务 ====================

// CreateMultiPointTaskRequest 创建多点任务请求
type CreateMultiPointTaskRequest struct {
	OrderID  int64                   `json:"order_id"`
	TaskType string                  `json:"task_type"` // pickup, delivery, mixed
	Stops    []MultiPointStopRequest `json:"stops"`
}

type MultiPointStopRequest struct {
	StopType         string     `json:"stop_type"` // pickup, delivery, transfer
	Latitude         float64    `json:"latitude"`
	Longitude        float64    `json:"longitude"`
	Address          string     `json:"address"`
	ContactName      string     `json:"contact_name"`
	ContactPhone     string     `json:"contact_phone"`
	CargoDescription string     `json:"cargo_description"`
	CargoWeight      int        `json:"cargo_weight"`
	CargoAction      string     `json:"cargo_action"` // load, unload
	TimeWindowStart  *time.Time `json:"time_window_start"`
	TimeWindowEnd    *time.Time `json:"time_window_end"`
}

// CreateMultiPointTask 创建多点任务
func (s *FlightService) CreateMultiPointTask(req *CreateMultiPointTaskRequest) (*model.MultiPointTask, error) {
	if len(req.Stops) < 2 {
		return nil, errors.New("多点任务至少需要2个站点")
	}

	// 计算规划距离和时间
	plannedDist := 0.0
	for i := 1; i < len(req.Stops); i++ {
		dist := haversineDistance(
			req.Stops[i-1].Latitude, req.Stops[i-1].Longitude,
			req.Stops[i].Latitude, req.Stops[i].Longitude)
		plannedDist += dist
	}

	// 估算时间 (假设平均速度10m/s，每站点停留2分钟)
	plannedDuration := int(plannedDist/10) + len(req.Stops)*120

	task := &model.MultiPointTask{
		OrderID:         req.OrderID,
		TaskType:        req.TaskType,
		TotalPoints:     len(req.Stops),
		PlannedDistance: int(plannedDist),
		PlannedDuration: plannedDuration,
		Status:          "pending",
	}

	if err := s.flightRepo.CreateMultiPointTask(task); err != nil {
		return nil, err
	}

	// 创建站点
	stops := make([]*model.MultiPointTaskStop, len(req.Stops))
	for i, stop := range req.Stops {
		stops[i] = &model.MultiPointTaskStop{
			TaskID:           task.ID,
			SequenceNo:       i,
			StopType:         stop.StopType,
			Latitude:         stop.Latitude,
			Longitude:        stop.Longitude,
			Address:          stop.Address,
			ContactName:      stop.ContactName,
			ContactPhone:     stop.ContactPhone,
			CargoDescription: stop.CargoDescription,
			CargoWeight:      stop.CargoWeight,
			CargoAction:      stop.CargoAction,
			TimeWindowStart:  stop.TimeWindowStart,
			TimeWindowEnd:    stop.TimeWindowEnd,
			Status:           "pending",
		}
	}

	if err := s.flightRepo.CreateTaskStops(stops); err != nil {
		return nil, err
	}

	task.TotalPoints = len(stops)
	return task, nil
}

// GetMultiPointTask 获取多点任务
func (s *FlightService) GetMultiPointTask(taskID int64) (*model.MultiPointTask, []model.MultiPointTaskStop, error) {
	task, err := s.flightRepo.GetMultiPointTaskByID(taskID)
	if err != nil {
		return nil, nil, err
	}

	stops, err := s.flightRepo.GetTaskStops(taskID)
	if err != nil {
		return nil, nil, err
	}

	return task, stops, nil
}

// GetMultiPointTaskByOrder 根据订单获取多点任务
func (s *FlightService) GetMultiPointTaskByOrder(orderID int64) (*model.MultiPointTask, []model.MultiPointTaskStop, error) {
	task, err := s.flightRepo.GetMultiPointTaskByOrderID(orderID)
	if err != nil {
		return nil, nil, err
	}

	stops, err := s.flightRepo.GetTaskStops(task.ID)
	if err != nil {
		return nil, nil, err
	}

	return task, stops, nil
}

// StartMultiPointTask 开始多点任务
func (s *FlightService) StartMultiPointTask(taskID int64) error {
	task, err := s.flightRepo.GetMultiPointTaskByID(taskID)
	if err != nil {
		return err
	}

	if task.Status != "pending" {
		return errors.New("任务状态不允许开始")
	}

	now := time.Now()
	task.Status = "in_progress"
	task.StartedAt = &now
	task.CurrentPointIndex = 0

	return s.flightRepo.UpdateMultiPointTask(task)
}

// ArriveAtStop 到达站点
func (s *FlightService) ArriveAtStop(stopID int64) error {
	return s.flightRepo.ArriveAtStop(stopID)
}

// CompleteStop 完成站点
func (s *FlightService) CompleteStop(stopID int64, photos []string, signature, confirmedBy string) error {
	photosJSON, _ := json.Marshal(photos)
	return s.flightRepo.CompleteStop(stopID, model.JSON(photosJSON), signature, confirmedBy)
}

// SkipStop 跳过站点
func (s *FlightService) SkipStop(stopID int64, reason string) error {
	return s.flightRepo.SkipStop(stopID, reason)
}

// AdvanceToNextStop 前进到下一站点
func (s *FlightService) AdvanceToNextStop(taskID int64) (*model.MultiPointTaskStop, error) {
	task, err := s.flightRepo.GetMultiPointTaskByID(taskID)
	if err != nil {
		return nil, err
	}

	stops, err := s.flightRepo.GetTaskStops(taskID)
	if err != nil {
		return nil, err
	}

	// 更新已完成计数
	completedCount := 0
	for _, stop := range stops {
		if stop.Status == "completed" || stop.Status == "skipped" {
			completedCount++
		}
	}

	nextIndex := task.CurrentPointIndex + 1
	if nextIndex >= len(stops) {
		// 所有站点完成
		return nil, s.CompleteMultiPointTask(taskID)
	}

	// 更新任务进度
	s.flightRepo.UpdateTaskProgress(taskID, completedCount, nextIndex)

	return &stops[nextIndex], nil
}

// CompleteMultiPointTask 完成多点任务
func (s *FlightService) CompleteMultiPointTask(taskID int64) error {
	task, err := s.flightRepo.GetMultiPointTaskByID(taskID)
	if err != nil {
		return err
	}

	// 计算实际距离和时间
	stops, _ := s.flightRepo.GetTaskStops(taskID)

	actualDist := 0.0
	for i := 1; i < len(stops); i++ {
		if stops[i].Status == "completed" && stops[i-1].Status == "completed" {
			dist := haversineDistance(
				stops[i-1].Latitude, stops[i-1].Longitude,
				stops[i].Latitude, stops[i].Longitude)
			actualDist += dist
		}
	}

	actualDuration := 0
	if task.StartedAt != nil {
		actualDuration = int(time.Since(*task.StartedAt).Seconds())
	}

	return s.flightRepo.CompleteMultiPointTask(taskID, int(actualDist), actualDuration)
}

// ==================== 飞行统计 ====================

// GetFlightStats 获取飞行统计
func (s *FlightService) GetFlightStats(orderID int64) (map[string]interface{}, error) {
	if err := s.SyncOrderFlightRecord(orderID); err != nil {
		return nil, err
	}
	return s.flightRepo.GetFlightStats(orderID)
}

func (s *FlightService) GetFlightRecordByID(flightID int64) (*model.FlightRecord, error) {
	record, err := s.flightRepo.GetFlightRecordByID(flightID)
	if err != nil {
		return nil, err
	}
	order, err := s.orderRepo.GetByID(record.OrderID)
	if err != nil {
		return record, nil
	}
	return s.refreshFlightRecordMetrics(record, order)
}

func (s *FlightService) GetLatestFlightRecordByOrder(orderID int64) (*model.FlightRecord, error) {
	if err := s.SyncOrderFlightRecord(orderID); err != nil {
		return nil, err
	}
	return s.flightRepo.GetLatestFlightRecordByOrder(orderID)
}

func (s *FlightService) GetActiveFlightRecordByOrder(orderID int64) (*model.FlightRecord, error) {
	if err := s.SyncOrderFlightRecord(orderID); err != nil {
		return nil, err
	}
	return s.flightRepo.GetActiveFlightRecordByOrder(orderID)
}

func (s *FlightService) ListFlightRecordsByOrder(orderID int64) ([]model.FlightRecord, error) {
	if err := s.SyncOrderFlightRecord(orderID); err != nil {
		return nil, err
	}
	return s.flightRepo.ListFlightRecordsByOrder(orderID)
}

func (s *FlightService) GetPositionsByFlightRecord(flightID int64) ([]model.FlightPosition, error) {
	return s.flightRepo.GetPositionsByFlightRecord(flightID)
}

type CreateFlightAlertInput struct {
	FlightRecordID int64
	OrderID        int64
	DroneID        int64
	PilotID        int64
	AlertType      string
	AlertLevel     string
	AlertCode      string
	Title          string
	Description    string
	Latitude       *float64
	Longitude      *float64
	Altitude       *int
	ThresholdValue string
	ActualValue    string
	TriggeredAt    *time.Time
}

func (s *FlightService) CreateManualAlert(input *CreateFlightAlertInput) (*model.FlightAlert, error) {
	if input == nil {
		return nil, errors.New("告警参数不能为空")
	}
	triggeredAt := time.Now()
	if input.TriggeredAt != nil {
		triggeredAt = *input.TriggeredAt
	}
	alert := &model.FlightAlert{
		FlightRecordID: &input.FlightRecordID,
		OrderID:        input.OrderID,
		DroneID:        input.DroneID,
		PilotID:        input.PilotID,
		AlertType:      input.AlertType,
		AlertLevel:     input.AlertLevel,
		AlertCode:      input.AlertCode,
		Title:          input.Title,
		Description:    input.Description,
		Latitude:       input.Latitude,
		Longitude:      input.Longitude,
		Altitude:       input.Altitude,
		ThresholdValue: input.ThresholdValue,
		ActualValue:    input.ActualValue,
		Status:         "active",
		TriggeredAt:    triggeredAt,
	}
	if err := s.flightRepo.CreateAlert(alert); err != nil {
		return nil, err
	}
	return alert, nil
}

func (s *FlightService) CompleteFlightRecord(flightID int64, landedAt *time.Time) (*model.FlightRecord, error) {
	record, err := s.flightRepo.GetFlightRecordByID(flightID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if landedAt != nil {
		now = *landedAt
	}

	if record.LandingAt == nil {
		record.LandingAt = &now
	}
	record.Status = "completed"
	if record.TakeoffAt != nil && record.TotalDurationSeconds == 0 {
		record.TotalDurationSeconds = int(record.LandingAt.Sub(*record.TakeoffAt).Seconds())
	}

	if err := s.flightRepo.UpdateFlightRecord(record); err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(record.OrderID)
	if err != nil {
		return record, nil
	}
	return s.refreshFlightRecordMetrics(record, order)
}

// GetLatestPosition 获取最新位置
func (s *FlightService) GetLatestPosition(orderID int64) (*model.FlightPosition, error) {
	return s.flightRepo.GetLatestPosition(orderID)
}

// GetPositionHistory 获取位置历史
func (s *FlightService) GetPositionHistory(orderID int64, limit int) ([]model.FlightPosition, error) {
	return s.flightRepo.GetPositionsByOrder(orderID, limit)
}

// ==================== 辅助函数 ====================

// douglasPeuckerIndices 使用 Douglas-Peucker 算法简化轨迹，返回保留点的索引
func douglasPeuckerIndices(points []model.FlightWaypoint, tolerance float64) []int {
	if len(points) <= 2 {
		indices := make([]int, len(points))
		for i := range points {
			indices[i] = i
		}
		return indices
	}

	// 递归实现
	var simplify func(start, end int) []int
	simplify = func(start, end int) []int {
		if end-start <= 1 {
			return []int{start}
		}

		// 找到最远点
		maxDist := 0.0
		maxIdx := start

		startPt := points[start]
		endPt := points[end]

		for i := start + 1; i < end; i++ {
			dist := perpendicularDistance(
				points[i].Latitude, points[i].Longitude,
				startPt.Latitude, startPt.Longitude,
				endPt.Latitude, endPt.Longitude)

			if dist > maxDist {
				maxDist = dist
				maxIdx = i
			}
		}

		// 如果最大距离大于容差，递归简化
		if maxDist > tolerance {
			left := simplify(start, maxIdx)
			right := simplify(maxIdx, end)
			return append(left, right...)
		}

		return []int{start}
	}

	indices := simplify(0, len(points)-1)
	indices = append(indices, len(points)-1)
	return indices
}

// perpendicularDistance 计算点到线段的垂直距离
func perpendicularDistance(lat, lng, lat1, lng1, lat2, lng2 float64) float64 {
	// 简化计算：使用平面近似
	dx := lat2 - lat1
	dy := lng2 - lng1

	if dx == 0 && dy == 0 {
		return haversineDistance(lat, lng, lat1, lng1)
	}

	t := ((lat-lat1)*dx + (lng-lng1)*dy) / (dx*dx + dy*dy)
	t = math.Max(0, math.Min(1, t))

	nearLat := lat1 + t*dx
	nearLng := lng1 + t*dy

	return haversineDistance(lat, lng, nearLat, nearLng)
}

// ==================== 开发模拟辅助方法 ====================

// GetOrderForSimulate 获取订单（模拟飞行用）
func (s *FlightService) GetOrderForSimulate(orderID int64) (*model.Order, error) {
	return s.orderRepo.GetByID(orderID)
}

// GetDispatchCoords 从订单关联的 dispatch_task 获取取送货坐标
func (s *FlightService) GetDispatchCoords(order *model.Order) (startLat, startLng, endLat, endLng float64, err error) {
	if order.RelatedID == 0 {
		err = errors.New("订单无关联派单任务")
		return
	}
	var task *model.DispatchTask
	task, err = s.flightRepo.GetDispatchTask(order.RelatedID)
	if err != nil {
		err = fmt.Errorf("查询 dispatch_task 失败: %w", err)
		return
	}
	startLat = task.PickupLatitude
	startLng = task.PickupLongitude
	endLat = task.DeliveryLatitude
	endLng = task.DeliveryLongitude
	if startLat == 0 && startLng == 0 {
		err = errors.New("取货坐标未设置")
	}
	return
}

// SaveSimulatePosition 保存模拟飞行位置点
func (s *FlightService) SaveSimulatePosition(pos *model.FlightPosition) {
	if _, _, err := s.persistPosition(pos, pos.PilotID); err != nil {
		s.logger.Error("模拟飞行位置保存失败", zap.Error(err))
	}
}

// FinishSimulate 模拟飞行完成，更新订单状态为 delivered
func (s *FlightService) FinishSimulate(orderID int64) {
	if err := s.orderRepo.UpdateStatus(orderID, "delivered"); err != nil {
		s.logger.Error("模拟飞行完成后更新订单状态失败", zap.Int64("order_id", orderID), zap.Error(err))
	} else {
		s.logger.Info("模拟飞行完成，订单状态已更新为 delivered", zap.Int64("order_id", orderID))
	}
}
