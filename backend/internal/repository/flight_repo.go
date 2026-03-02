package repository

import (
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

// FlightRepo 飞行监控数据仓库
type FlightRepo struct {
	db *gorm.DB
}

func NewFlightRepo(db *gorm.DB) *FlightRepo {
	return &FlightRepo{db: db}
}

// ==================== 飞行位置相关 ====================

// RecordPosition 记录飞行位置
func (r *FlightRepo) RecordPosition(pos *model.FlightPosition) error {
	return r.db.Create(pos).Error
}

// RecordPositions 批量记录飞行位置
func (r *FlightRepo) RecordPositions(positions []*model.FlightPosition) error {
	if len(positions) == 0 {
		return nil
	}
	return r.db.Create(&positions).Error
}

// GetLatestPosition 获取最新位置
func (r *FlightRepo) GetLatestPosition(orderID int64) (*model.FlightPosition, error) {
	var pos model.FlightPosition
	err := r.db.Where("order_id = ?", orderID).Order("recorded_at DESC").First(&pos).Error
	if err != nil {
		return nil, err
	}
	return &pos, nil
}

// GetPositionsByOrder 获取订单的位置记录
func (r *FlightRepo) GetPositionsByOrder(orderID int64, limit int) ([]model.FlightPosition, error) {
	var positions []model.FlightPosition
	query := r.db.Where("order_id = ?", orderID).Order("recorded_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&positions).Error
	return positions, err
}

// GetPositionsByTimeRange 获取时间范围内的位置记录
func (r *FlightRepo) GetPositionsByTimeRange(orderID int64, start, end time.Time) ([]model.FlightPosition, error) {
	var positions []model.FlightPosition
	err := r.db.Where("order_id = ? AND recorded_at BETWEEN ? AND ?", orderID, start, end).
		Order("recorded_at ASC").Find(&positions).Error
	return positions, err
}

// GetPositionsForTrajectory 获取用于轨迹生成的位置数据(按顺序)
func (r *FlightRepo) GetPositionsForTrajectory(orderID int64) ([]model.FlightPosition, error) {
	var positions []model.FlightPosition
	err := r.db.Where("order_id = ?", orderID).Order("recorded_at ASC").Find(&positions).Error
	return positions, err
}

// DeleteOldPositions 删除旧位置记录(保留最近N天)
func (r *FlightRepo) DeleteOldPositions(days int) error {
	cutoff := time.Now().AddDate(0, 0, -days)
	return r.db.Where("recorded_at < ?", cutoff).Delete(&model.FlightPosition{}).Error
}

// ==================== 飞行告警相关 ====================

// CreateAlert 创建告警
func (r *FlightRepo) CreateAlert(alert *model.FlightAlert) error {
	return r.db.Create(alert).Error
}

// GetAlertByID 根据ID获取告警
func (r *FlightRepo) GetAlertByID(id int64) (*model.FlightAlert, error) {
	var alert model.FlightAlert
	err := r.db.First(&alert, id).Error
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

// UpdateAlert 更新告警
func (r *FlightRepo) UpdateAlert(alert *model.FlightAlert) error {
	return r.db.Save(alert).Error
}

// GetAlertsByOrder 获取订单的告警列表
func (r *FlightRepo) GetAlertsByOrder(orderID int64) ([]model.FlightAlert, error) {
	var alerts []model.FlightAlert
	err := r.db.Where("order_id = ?", orderID).Order("triggered_at DESC").Find(&alerts).Error
	return alerts, err
}

// GetActiveAlerts 获取活跃告警
func (r *FlightRepo) GetActiveAlerts(orderID int64) ([]model.FlightAlert, error) {
	var alerts []model.FlightAlert
	err := r.db.Where("order_id = ? AND status = ?", orderID, "active").
		Order("triggered_at DESC").Find(&alerts).Error
	return alerts, err
}

// GetAlertsByType 按类型获取告警
func (r *FlightRepo) GetAlertsByType(orderID int64, alertType string) ([]model.FlightAlert, error) {
	var alerts []model.FlightAlert
	err := r.db.Where("order_id = ? AND alert_type = ?", orderID, alertType).
		Order("triggered_at DESC").Find(&alerts).Error
	return alerts, err
}

// AcknowledgeAlert 确认告警
func (r *FlightRepo) AcknowledgeAlert(id, userID int64) error {
	now := time.Now()
	return r.db.Model(&model.FlightAlert{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":          "acknowledged",
		"acknowledged_at": now,
		"acknowledged_by": userID,
	}).Error
}

// ResolveAlert 解决告警
func (r *FlightRepo) ResolveAlert(id int64, note string) error {
	now := time.Now()
	return r.db.Model(&model.FlightAlert{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":          "resolved",
		"resolved_at":     now,
		"resolution_note": note,
	}).Error
}

// GetUnresolvedAlertCount 获取未解决告警数
func (r *FlightRepo) GetUnresolvedAlertCount(orderID int64) (int64, error) {
	var count int64
	err := r.db.Model(&model.FlightAlert{}).
		Where("order_id = ? AND status IN ?", orderID, []string{"active", "acknowledged"}).
		Count(&count).Error
	return count, err
}

// ==================== 电子围栏相关 ====================

// CreateGeofence 创建围栏
func (r *FlightRepo) CreateGeofence(fence *model.Geofence) error {
	return r.db.Create(fence).Error
}

// GetGeofenceByID 根据ID获取围栏
func (r *FlightRepo) GetGeofenceByID(id int64) (*model.Geofence, error) {
	var fence model.Geofence
	err := r.db.First(&fence, id).Error
	if err != nil {
		return nil, err
	}
	return &fence, nil
}

// UpdateGeofence 更新围栏
func (r *FlightRepo) UpdateGeofence(fence *model.Geofence) error {
	return r.db.Save(fence).Error
}

// DeleteGeofence 删除围栏
func (r *FlightRepo) DeleteGeofence(id int64) error {
	return r.db.Delete(&model.Geofence{}, id).Error
}

// GetActiveGeofences 获取当前有效的围栏列表
func (r *FlightRepo) GetActiveGeofences() ([]model.Geofence, error) {
	var fences []model.Geofence
	now := time.Now()
	err := r.db.Where("status = ? AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to >= ?)",
		"active", now, now).Find(&fences).Error
	return fences, err
}

// GetGeofencesByType 按类型获取围栏
func (r *FlightRepo) GetGeofencesByType(fenceType string) ([]model.Geofence, error) {
	var fences []model.Geofence
	err := r.db.Where("fence_type = ? AND status = ?", fenceType, "active").Find(&fences).Error
	return fences, err
}

// GetGeofencesNearLocation 获取位置附近的围栏
func (r *FlightRepo) GetGeofencesNearLocation(lat, lng float64, radiusKM float64) ([]model.Geofence, error) {
	var fences []model.Geofence
	// 简化查询，获取所有有效围栏后在业务层过滤
	err := r.db.Where("status = ?", "active").Find(&fences).Error
	return fences, err
}

// ListGeofences 分页列表
func (r *FlightRepo) ListGeofences(page, pageSize int, filters map[string]interface{}) ([]model.Geofence, int64, error) {
	var fences []model.Geofence
	var total int64

	query := r.db.Model(&model.Geofence{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&fences).Error
	return fences, total, err
}

// ==================== 围栏违规相关 ====================

// CreateViolation 创建违规记录
func (r *FlightRepo) CreateViolation(v *model.GeofenceViolation) error {
	return r.db.Create(v).Error
}

// GetViolationsByOrder 获取订单的违规记录
func (r *FlightRepo) GetViolationsByOrder(orderID int64) ([]model.GeofenceViolation, error) {
	var violations []model.GeofenceViolation
	err := r.db.Where("order_id = ?", orderID).Order("violated_at DESC").Find(&violations).Error
	return violations, err
}

// GetViolationsByGeofence 获取围栏的违规记录
func (r *FlightRepo) GetViolationsByGeofence(geofenceID int64) ([]model.GeofenceViolation, error) {
	var violations []model.GeofenceViolation
	err := r.db.Where("geofence_id = ?", geofenceID).Order("violated_at DESC").Find(&violations).Error
	return violations, err
}

// ==================== 监控配置相关 ====================

// GetConfig 获取配置
func (r *FlightRepo) GetConfig(key string) (string, error) {
	var config model.FlightMonitorConfig
	err := r.db.Where("config_key = ?", key).First(&config).Error
	if err != nil {
		return "", err
	}
	return config.ConfigValue, nil
}

// GetConfigInt 获取整数配置
func (r *FlightRepo) GetConfigInt(key string, defaultVal int) int {
	val, err := r.GetConfig(key)
	if err != nil {
		return defaultVal
	}
	intVal, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return intVal
}

// GetConfigFloat 获取浮点配置
func (r *FlightRepo) GetConfigFloat(key string, defaultVal float64) float64 {
	val, err := r.GetConfig(key)
	if err != nil {
		return defaultVal
	}
	floatVal, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return defaultVal
	}
	return floatVal
}

// SetConfig 设置配置
func (r *FlightRepo) SetConfig(key, value, configType, desc string) error {
	config := model.FlightMonitorConfig{
		ConfigKey:   key,
		ConfigValue: value,
		ConfigType:  configType,
		Description: desc,
	}
	return r.db.Where("config_key = ?", key).
		Assign(map[string]interface{}{
			"config_value": value,
			"config_type":  configType,
			"description":  desc,
		}).FirstOrCreate(&config).Error
}

// GetAllConfigs 获取所有配置
func (r *FlightRepo) GetAllConfigs() ([]model.FlightMonitorConfig, error) {
	var configs []model.FlightMonitorConfig
	err := r.db.Find(&configs).Error
	return configs, err
}

// ==================== 统计相关 ====================

// GetFlightStats 获取订单的飞行统计
func (r *FlightRepo) GetFlightStats(orderID int64) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 位置点数
	var posCount int64
	r.db.Model(&model.FlightPosition{}).Where("order_id = ?", orderID).Count(&posCount)
	stats["position_count"] = posCount

	// 告警统计
	var alertStats []struct {
		AlertLevel string `gorm:"column:alert_level"`
		Count      int64  `gorm:"column:count"`
	}
	r.db.Model(&model.FlightAlert{}).
		Select("alert_level, COUNT(*) as count").
		Where("order_id = ?", orderID).
		Group("alert_level").
		Scan(&alertStats)

	alertMap := make(map[string]int64)
	for _, s := range alertStats {
		alertMap[s.AlertLevel] = s.Count
	}
	stats["alerts"] = alertMap

	// 违规次数
	var violationCount int64
	r.db.Model(&model.GeofenceViolation{}).Where("order_id = ?", orderID).Count(&violationCount)
	stats["violation_count"] = violationCount

	// 飞行距离和时间(从位置记录计算)
	var firstPos, lastPos model.FlightPosition
	r.db.Where("order_id = ?", orderID).Order("recorded_at ASC").First(&firstPos)
	r.db.Where("order_id = ?", orderID).Order("recorded_at DESC").First(&lastPos)

	if firstPos.ID > 0 && lastPos.ID > 0 {
		duration := lastPos.RecordedAt.Sub(firstPos.RecordedAt).Seconds()
		stats["flight_duration"] = int(duration)
	}

	return stats, nil
}

// GetDroneFlightHistory 获取无人机飞行历史
func (r *FlightRepo) GetDroneFlightHistory(droneID int64, days int) ([]map[string]interface{}, error) {
	cutoff := time.Now().AddDate(0, 0, -days)

	var results []struct {
		OrderID    int64     `gorm:"column:order_id"`
		Date       time.Time `gorm:"column:date"`
		PointCount int64     `gorm:"column:point_count"`
	}

	err := r.db.Model(&model.FlightPosition{}).
		Select("order_id, DATE(recorded_at) as date, COUNT(*) as point_count").
		Where("drone_id = ? AND recorded_at >= ?", droneID, cutoff).
		Group("order_id, DATE(recorded_at)").
		Order("date DESC").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	history := make([]map[string]interface{}, len(results))
	for i, r := range results {
		history[i] = map[string]interface{}{
			"order_id":    r.OrderID,
			"date":        r.Date.Format("2006-01-02"),
			"point_count": r.PointCount,
		}
	}
	return history, nil
}

// ==================== 轨迹相关 ====================

// CreateTrajectory 创建轨迹
func (r *FlightRepo) CreateTrajectory(traj *model.FlightTrajectory) error {
	if traj.TrajectoryNo == "" {
		traj.TrajectoryNo = fmt.Sprintf("TRJ%d", time.Now().UnixNano()/1000000)
	}
	return r.db.Create(traj).Error
}

// GetTrajectoryByID 根据ID获取轨迹
func (r *FlightRepo) GetTrajectoryByID(id int64) (*model.FlightTrajectory, error) {
	var traj model.FlightTrajectory
	err := r.db.First(&traj, id).Error
	if err != nil {
		return nil, err
	}
	return &traj, nil
}

// GetTrajectoryByOrderID 根据订单ID获取轨迹
func (r *FlightRepo) GetTrajectoryByOrderID(orderID int64) (*model.FlightTrajectory, error) {
	var traj model.FlightTrajectory
	err := r.db.Where("order_id = ?", orderID).First(&traj).Error
	if err != nil {
		return nil, err
	}
	return &traj, nil
}

// UpdateTrajectory 更新轨迹
func (r *FlightRepo) UpdateTrajectory(traj *model.FlightTrajectory) error {
	return r.db.Save(traj).Error
}

// CompleteTrajectory 完成轨迹录制
func (r *FlightRepo) CompleteTrajectory(id int64, stats map[string]interface{}) error {
	now := time.Now()
	updates := map[string]interface{}{
		"recording_status": "completed",
		"ended_at":         now,
	}
	for k, v := range stats {
		updates[k] = v
	}
	return r.db.Model(&model.FlightTrajectory{}).Where("id = ?", id).Updates(updates).Error
}

// ListTrajectories 轨迹列表
func (r *FlightRepo) ListTrajectories(page, pageSize int, filters map[string]interface{}) ([]model.FlightTrajectory, int64, error) {
	var trajs []model.FlightTrajectory
	var total int64

	query := r.db.Model(&model.FlightTrajectory{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&trajs).Error
	return trajs, total, err
}

// GetTemplateTrajectories 获取模板轨迹列表
func (r *FlightRepo) GetTemplateTrajectories() ([]model.FlightTrajectory, error) {
	var trajs []model.FlightTrajectory
	err := r.db.Where("is_template = ? AND recording_status = ?", true, "completed").
		Order("use_count DESC").Find(&trajs).Error
	return trajs, err
}

// IncrementTrajectoryUseCount 增加轨迹使用次数
func (r *FlightRepo) IncrementTrajectoryUseCount(id int64) error {
	return r.db.Model(&model.FlightTrajectory{}).Where("id = ?", id).
		UpdateColumn("use_count", gorm.Expr("use_count + 1")).Error
}

// ==================== 航点相关 ====================

// CreateWaypoint 创建航点
func (r *FlightRepo) CreateWaypoint(wp *model.FlightWaypoint) error {
	return r.db.Create(wp).Error
}

// CreateWaypoints 批量创建航点
func (r *FlightRepo) CreateWaypoints(wps []*model.FlightWaypoint) error {
	if len(wps) == 0 {
		return nil
	}
	return r.db.Create(&wps).Error
}

// GetWaypointsByTrajectory 获取轨迹的航点列表
func (r *FlightRepo) GetWaypointsByTrajectory(trajectoryID int64) ([]model.FlightWaypoint, error) {
	var wps []model.FlightWaypoint
	err := r.db.Where("trajectory_id = ?", trajectoryID).Order("sequence_no ASC").Find(&wps).Error
	return wps, err
}

// DeleteWaypointsByTrajectory 删除轨迹的所有航点
func (r *FlightRepo) DeleteWaypointsByTrajectory(trajectoryID int64) error {
	return r.db.Where("trajectory_id = ?", trajectoryID).Delete(&model.FlightWaypoint{}).Error
}

// ==================== 保存路线相关 ====================

// CreateSavedRoute 创建保存路线
func (r *FlightRepo) CreateSavedRoute(route *model.SavedRoute) error {
	if route.RouteNo == "" {
		route.RouteNo = fmt.Sprintf("RTE%d", time.Now().UnixNano()/1000000)
	}
	return r.db.Create(route).Error
}

// GetSavedRouteByID 根据ID获取保存路线
func (r *FlightRepo) GetSavedRouteByID(id int64) (*model.SavedRoute, error) {
	var route model.SavedRoute
	err := r.db.First(&route, id).Error
	if err != nil {
		return nil, err
	}
	return &route, nil
}

// UpdateSavedRoute 更新保存路线
func (r *FlightRepo) UpdateSavedRoute(route *model.SavedRoute) error {
	return r.db.Save(route).Error
}

// DeleteSavedRoute 软删除保存路线
func (r *FlightRepo) DeleteSavedRoute(id int64) error {
	return r.db.Delete(&model.SavedRoute{}, id).Error
}

// ListSavedRoutes 保存路线列表
func (r *FlightRepo) ListSavedRoutes(page, pageSize int, filters map[string]interface{}) ([]model.SavedRoute, int64, error) {
	var routes []model.SavedRoute
	var total int64

	query := r.db.Model(&model.SavedRoute{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("use_count DESC, created_at DESC").Find(&routes).Error
	return routes, total, err
}

// GetRoutesByOwner 获取用户的保存路线
func (r *FlightRepo) GetRoutesByOwner(ownerID int64) ([]model.SavedRoute, error) {
	var routes []model.SavedRoute
	err := r.db.Where("owner_id = ? AND status = ?", ownerID, "active").
		Order("use_count DESC").Find(&routes).Error
	return routes, err
}

// GetPublicRoutes 获取公开路线
func (r *FlightRepo) GetPublicRoutes(limit int) ([]model.SavedRoute, error) {
	var routes []model.SavedRoute
	query := r.db.Where("visibility IN ? AND status = ?", []string{"shared", "public"}, "active").
		Order("rating DESC, use_count DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&routes).Error
	return routes, err
}

// FindNearbyRoutes 查找附近起点的路线
func (r *FlightRepo) FindNearbyRoutes(lat, lng float64, radiusKM float64) ([]model.SavedRoute, error) {
	var routes []model.SavedRoute
	// 使用 Haversine 公式的简化版本(小范围近似)
	// 1度纬度约111km
	latDelta := radiusKM / 111.0
	lngDelta := radiusKM / (111.0 * 0.85) // 大约在中纬度地区

	err := r.db.Where("status = ? AND start_latitude BETWEEN ? AND ? AND start_longitude BETWEEN ? AND ?",
		"active", lat-latDelta, lat+latDelta, lng-lngDelta, lng+lngDelta).
		Order("use_count DESC").Find(&routes).Error
	return routes, err
}

// IncrementRouteUseCount 增加路线使用次数
func (r *FlightRepo) IncrementRouteUseCount(id int64) error {
	now := time.Now()
	return r.db.Model(&model.SavedRoute{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"use_count":    gorm.Expr("use_count + 1"),
			"last_used_at": now,
		}).Error
}

// UpdateRouteRating 更新路线评分
func (r *FlightRepo) UpdateRouteRating(id int64, rating float64) error {
	return r.db.Model(&model.SavedRoute{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"rating":       gorm.Expr("(rating * rating_count + ?) / (rating_count + 1)", rating),
			"rating_count": gorm.Expr("rating_count + 1"),
		}).Error
}

// ==================== 多点任务相关 ====================

// CreateMultiPointTask 创建多点任务
func (r *FlightRepo) CreateMultiPointTask(task *model.MultiPointTask) error {
	if task.TaskNo == "" {
		task.TaskNo = fmt.Sprintf("MPT%d", time.Now().UnixNano()/1000000)
	}
	return r.db.Create(task).Error
}

// GetMultiPointTaskByID 根据ID获取多点任务
func (r *FlightRepo) GetMultiPointTaskByID(id int64) (*model.MultiPointTask, error) {
	var task model.MultiPointTask
	err := r.db.Preload("Order").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// GetMultiPointTaskByOrderID 根据订单ID获取多点任务
func (r *FlightRepo) GetMultiPointTaskByOrderID(orderID int64) (*model.MultiPointTask, error) {
	var task model.MultiPointTask
	err := r.db.Where("order_id = ?", orderID).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// UpdateMultiPointTask 更新多点任务
func (r *FlightRepo) UpdateMultiPointTask(task *model.MultiPointTask) error {
	return r.db.Save(task).Error
}

// UpdateTaskProgress 更新任务进度
func (r *FlightRepo) UpdateTaskProgress(id int64, completedPoints, currentIndex int) error {
	return r.db.Model(&model.MultiPointTask{}).Where("id = ?", id).Updates(map[string]interface{}{
		"completed_points":    completedPoints,
		"current_point_index": currentIndex,
	}).Error
}

// CompleteMultiPointTask 完成多点任务
func (r *FlightRepo) CompleteMultiPointTask(id int64, actualDistance, actualDuration int) error {
	now := time.Now()
	return r.db.Model(&model.MultiPointTask{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":          "completed",
		"completed_at":    now,
		"actual_distance": actualDistance,
		"actual_duration": actualDuration,
	}).Error
}

// ==================== 多点任务站点相关 ====================

// CreateTaskStop 创建任务站点
func (r *FlightRepo) CreateTaskStop(stop *model.MultiPointTaskStop) error {
	return r.db.Create(stop).Error
}

// CreateTaskStops 批量创建任务站点
func (r *FlightRepo) CreateTaskStops(stops []*model.MultiPointTaskStop) error {
	if len(stops) == 0 {
		return nil
	}
	return r.db.Create(&stops).Error
}

// GetTaskStopByID 根据ID获取站点
func (r *FlightRepo) GetTaskStopByID(id int64) (*model.MultiPointTaskStop, error) {
	var stop model.MultiPointTaskStop
	err := r.db.First(&stop, id).Error
	if err != nil {
		return nil, err
	}
	return &stop, nil
}

// GetTaskStops 获取任务的所有站点
func (r *FlightRepo) GetTaskStops(taskID int64) ([]model.MultiPointTaskStop, error) {
	var stops []model.MultiPointTaskStop
	err := r.db.Where("task_id = ?", taskID).Order("sequence_no ASC").Find(&stops).Error
	return stops, err
}

// UpdateTaskStop 更新站点
func (r *FlightRepo) UpdateTaskStop(stop *model.MultiPointTaskStop) error {
	return r.db.Save(stop).Error
}

// ArriveAtStop 到达站点
func (r *FlightRepo) ArriveAtStop(id int64) error {
	now := time.Now()
	return r.db.Model(&model.MultiPointTaskStop{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":         "arrived",
		"actual_arrival": now,
	}).Error
}

// CompleteStop 完成站点
func (r *FlightRepo) CompleteStop(id int64, photos model.JSON, signature, confirmedBy string) error {
	now := time.Now()
	return r.db.Model(&model.MultiPointTaskStop{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":               "completed",
		"actual_departure":     now,
		"confirmation_photos":  photos,
		"confirmation_signature": signature,
		"confirmed_at":         now,
		"confirmed_by":         confirmedBy,
	}).Error
}

// SkipStop 跳过站点
func (r *FlightRepo) SkipStop(id int64, reason string) error {
	return r.db.Model(&model.MultiPointTaskStop{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":      "skipped",
		"skip_reason": reason,
	}).Error
}
