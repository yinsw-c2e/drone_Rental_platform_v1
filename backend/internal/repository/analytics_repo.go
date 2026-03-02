package repository

import (
	"time"

	"gorm.io/gorm"
	"wurenji-backend/internal/model"
)

type AnalyticsRepository struct {
	db *gorm.DB
}

func NewAnalyticsRepository(db *gorm.DB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

// ==================== DailyStatistics ====================

func (r *AnalyticsRepository) GetDailyStatistics(date time.Time) (*model.DailyStatistics, error) {
	var stat model.DailyStatistics
	err := r.db.Where("stat_date = ?", date.Format("2006-01-02")).First(&stat).Error
	if err != nil {
		return nil, err
	}
	return &stat, nil
}

func (r *AnalyticsRepository) GetDailyStatisticsRange(startDate, endDate time.Time) ([]model.DailyStatistics, error) {
	var stats []model.DailyStatistics
	err := r.db.Where("stat_date >= ? AND stat_date <= ?", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).
		Order("stat_date ASC").Find(&stats).Error
	return stats, err
}

func (r *AnalyticsRepository) SaveDailyStatistics(stat *model.DailyStatistics) error {
	return r.db.Save(stat).Error
}

func (r *AnalyticsRepository) UpsertDailyStatistics(stat *model.DailyStatistics) error {
	return r.db.Where("stat_date = ?", stat.StatDate.Format("2006-01-02")).
		Assign(stat).FirstOrCreate(stat).Error
}

// ==================== HourlyMetrics ====================

func (r *AnalyticsRepository) GetHourlyMetrics(metricTime time.Time) (*model.HourlyMetrics, error) {
	var metric model.HourlyMetrics
	err := r.db.Where("metric_time = ?", metricTime).First(&metric).Error
	if err != nil {
		return nil, err
	}
	return &metric, nil
}

func (r *AnalyticsRepository) GetHourlyMetricsRange(startTime, endTime time.Time) ([]model.HourlyMetrics, error) {
	var metrics []model.HourlyMetrics
	err := r.db.Where("metric_time >= ? AND metric_time <= ?", startTime, endTime).
		Order("metric_time ASC").Find(&metrics).Error
	return metrics, err
}

func (r *AnalyticsRepository) SaveHourlyMetrics(metric *model.HourlyMetrics) error {
	return r.db.Save(metric).Error
}

func (r *AnalyticsRepository) UpsertHourlyMetrics(metric *model.HourlyMetrics) error {
	return r.db.Where("metric_time = ?", metric.MetricTime).
		Assign(metric).FirstOrCreate(metric).Error
}

func (r *AnalyticsRepository) GetLatestHourlyMetrics(hours int) ([]model.HourlyMetrics, error) {
	var metrics []model.HourlyMetrics
	err := r.db.Order("metric_time DESC").Limit(hours).Find(&metrics).Error
	return metrics, err
}

// ==================== RegionStatistics ====================

func (r *AnalyticsRepository) GetRegionStatistics(date time.Time, regionCode string) (*model.RegionStatistics, error) {
	var stat model.RegionStatistics
	err := r.db.Where("stat_date = ? AND region_code = ?", date.Format("2006-01-02"), regionCode).
		First(&stat).Error
	if err != nil {
		return nil, err
	}
	return &stat, nil
}

func (r *AnalyticsRepository) GetRegionStatisticsByDate(date time.Time) ([]model.RegionStatistics, error) {
	var stats []model.RegionStatistics
	err := r.db.Where("stat_date = ?", date.Format("2006-01-02")).
		Order("total_orders DESC").Find(&stats).Error
	return stats, err
}

func (r *AnalyticsRepository) GetTopRegions(date time.Time, limit int) ([]model.RegionStatistics, error) {
	var stats []model.RegionStatistics
	err := r.db.Where("stat_date = ?", date.Format("2006-01-02")).
		Order("total_orders DESC").Limit(limit).Find(&stats).Error
	return stats, err
}

func (r *AnalyticsRepository) SaveRegionStatistics(stat *model.RegionStatistics) error {
	return r.db.Save(stat).Error
}

func (r *AnalyticsRepository) UpsertRegionStatistics(stat *model.RegionStatistics) error {
	return r.db.Where("stat_date = ? AND region_code = ?", stat.StatDate.Format("2006-01-02"), stat.RegionCode).
		Assign(stat).FirstOrCreate(stat).Error
}

// ==================== AnalyticsReport ====================

func (r *AnalyticsRepository) GetReportByID(id int64) (*model.AnalyticsReport, error) {
	var report model.AnalyticsReport
	err := r.db.First(&report, id).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *AnalyticsRepository) GetReportByNo(reportNo string) (*model.AnalyticsReport, error) {
	var report model.AnalyticsReport
	err := r.db.Where("report_no = ?", reportNo).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *AnalyticsRepository) GetReportsByType(reportType string, limit, offset int) ([]model.AnalyticsReport, int64, error) {
	var reports []model.AnalyticsReport
	var total int64

	query := r.db.Model(&model.AnalyticsReport{})
	if reportType != "" {
		query = query.Where("report_type = ?", reportType)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&reports).Error
	return reports, total, err
}

func (r *AnalyticsRepository) GetLatestReport(reportType string) (*model.AnalyticsReport, error) {
	var report model.AnalyticsReport
	err := r.db.Where("report_type = ? AND status = 'completed'", reportType).
		Order("period_end DESC").First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *AnalyticsRepository) CreateReport(report *model.AnalyticsReport) error {
	return r.db.Create(report).Error
}

func (r *AnalyticsRepository) UpdateReport(report *model.AnalyticsReport) error {
	return r.db.Save(report).Error
}

func (r *AnalyticsRepository) DeleteReport(id int64) error {
	return r.db.Delete(&model.AnalyticsReport{}, id).Error
}

// ==================== HeatmapData ====================

func (r *AnalyticsRepository) GetHeatmapData(dataType string, date time.Time) ([]model.HeatmapData, error) {
	var data []model.HeatmapData
	err := r.db.Where("data_type = ? AND stat_date = ?", dataType, date.Format("2006-01-02")).
		Find(&data).Error
	return data, err
}

func (r *AnalyticsRepository) SaveHeatmapData(data *model.HeatmapData) error {
	return r.db.Create(data).Error
}

func (r *AnalyticsRepository) BatchSaveHeatmapData(data []model.HeatmapData) error {
	if len(data) == 0 {
		return nil
	}
	return r.db.CreateInBatches(data, 100).Error
}

func (r *AnalyticsRepository) DeleteHeatmapDataByDate(dataType string, date time.Time) error {
	return r.db.Where("data_type = ? AND stat_date = ?", dataType, date.Format("2006-01-02")).
		Delete(&model.HeatmapData{}).Error
}

// ==================== RealtimeDashboard ====================

func (r *AnalyticsRepository) GetDashboardMetric(key string) (*model.RealtimeDashboard, error) {
	var metric model.RealtimeDashboard
	err := r.db.Where("metric_key = ?", key).First(&metric).Error
	if err != nil {
		return nil, err
	}
	return &metric, nil
}

func (r *AnalyticsRepository) GetAllDashboardMetrics() ([]model.RealtimeDashboard, error) {
	var metrics []model.RealtimeDashboard
	err := r.db.Find(&metrics).Error
	return metrics, err
}

func (r *AnalyticsRepository) UpdateDashboardMetric(key, value string) error {
	return r.db.Model(&model.RealtimeDashboard{}).
		Where("metric_key = ?", key).
		Update("metric_value", value).Error
}

func (r *AnalyticsRepository) UpsertDashboardMetric(key, value string) error {
	metric := &model.RealtimeDashboard{
		MetricKey:   key,
		MetricValue: value,
		UpdatedAt:   time.Now(),
	}
	return r.db.Where("metric_key = ?", key).Assign(metric).FirstOrCreate(metric).Error
}

// ==================== 聚合查询 ====================

// CountTodayOrders 统计今日订单数
func (r *AnalyticsRepository) CountTodayOrders() (int64, int64, int64, int64, error) {
	today := time.Now().Format("2006-01-02")
	var newOrders, completed, cancelled, inProgress int64

	r.db.Model(&model.Order{}).Where("DATE(created_at) = ?", today).Count(&newOrders)
	r.db.Model(&model.Order{}).Where("DATE(updated_at) = ? AND status = 'completed'", today).Count(&completed)
	r.db.Model(&model.Order{}).Where("DATE(updated_at) = ? AND status = 'cancelled'", today).Count(&cancelled)
	r.db.Model(&model.Order{}).Where("status IN ('created', 'confirmed', 'preparing', 'flying', 'loading', 'unloading')").Count(&inProgress)

	return newOrders, completed, cancelled, inProgress, nil
}

// SumTodayRevenue 统计今日收入
func (r *AnalyticsRepository) SumTodayRevenue() (int64, error) {
	today := time.Now().Format("2006-01-02")
	var total int64
	err := r.db.Model(&model.OrderSettlement{}).
		Where("DATE(settled_at) = ? AND status = 'settled'", today).
		Select("COALESCE(SUM(final_amount), 0)").Scan(&total).Error
	return total, err
}

// CountOnlineCapacity 统计在线运力
func (r *AnalyticsRepository) CountOnlineCapacity() (int64, int64, int64, error) {
	var onlinePilots, availableDrones, activeFlights int64

	r.db.Model(&model.Pilot{}).Where("availability_status = 'online'").Count(&onlinePilots)
	r.db.Model(&model.Drone{}).Where("availability_status = 'available'").Count(&availableDrones)
	r.db.Model(&model.Order{}).Where("status = 'flying'").Count(&activeFlights)

	return onlinePilots, availableDrones, activeFlights, nil
}

// CountTotalUsers 统计用户总数
func (r *AnalyticsRepository) CountTotalUsers() (int64, int64, int64, int64, error) {
	var total, pilots, owners, clients int64

	r.db.Model(&model.User{}).Count(&total)
	r.db.Model(&model.Pilot{}).Count(&pilots)
	r.db.Model(&model.User{}).Where("user_type = 'drone_owner'").Count(&owners)
	r.db.Model(&model.Client{}).Count(&clients)

	return total, pilots, owners, clients, nil
}

// GetOrderTrend 获取订单趋势(最近N天)
func (r *AnalyticsRepository) GetOrderTrend(days int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	startDate := time.Now().AddDate(0, 0, -days+1).Format("2006-01-02")

	rows, err := r.db.Raw(`
		SELECT DATE(created_at) as date, 
		       COUNT(*) as total,
		       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
		       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
		FROM orders 
		WHERE DATE(created_at) >= ?
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`, startDate).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var date string
		var total, completed, cancelled int64
		if err := rows.Scan(&date, &total, &completed, &cancelled); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"date":      date,
			"total":     total,
			"completed": completed,
			"cancelled": cancelled,
		})
	}
	return results, nil
}

// GetRevenueTrend 获取收入趋势(最近N天)
func (r *AnalyticsRepository) GetRevenueTrend(days int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	startDate := time.Now().AddDate(0, 0, -days+1).Format("2006-01-02")

	rows, err := r.db.Raw(`
		SELECT DATE(settled_at) as date, 
		       COALESCE(SUM(final_amount), 0) as revenue,
		       COALESCE(SUM(platform_fee), 0) as platform_fee
		FROM order_settlements 
		WHERE status = 'settled' AND DATE(settled_at) >= ?
		GROUP BY DATE(settled_at)
		ORDER BY date ASC
	`, startDate).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var date string
		var revenue, platformFee int64
		if err := rows.Scan(&date, &revenue, &platformFee); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"date":         date,
			"revenue":      revenue,
			"platform_fee": platformFee,
		})
	}
	return results, nil
}

// GetUserGrowthTrend 获取用户增长趋势
func (r *AnalyticsRepository) GetUserGrowthTrend(days int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	startDate := time.Now().AddDate(0, 0, -days+1).Format("2006-01-02")

	rows, err := r.db.Raw(`
		SELECT DATE(created_at) as date, COUNT(*) as new_users
		FROM users 
		WHERE DATE(created_at) >= ?
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`, startDate).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var date string
		var newUsers int64
		if err := rows.Scan(&date, &newUsers); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"date":      date,
			"new_users": newUsers,
		})
	}
	return results, nil
}

// GetOrdersByRegion 按区域统计订单
func (r *AnalyticsRepository) GetOrdersByRegion(date time.Time) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	dateStr := date.Format("2006-01-02")

	rows, err := r.db.Raw(`
		SELECT d.city as region, 
		       COUNT(*) as order_count,
		       COALESCE(SUM(o.total_amount), 0) as revenue
		FROM orders o
		LEFT JOIN drones d ON o.drone_id = d.id
		WHERE DATE(o.created_at) = ? AND d.city IS NOT NULL AND d.city != ''
		GROUP BY d.city
		ORDER BY order_count DESC
		LIMIT 20
	`, dateStr).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var region string
		var orderCount int64
		var revenue int64
		if err := rows.Scan(&region, &orderCount, &revenue); err != nil {
			continue
		}
		results = append(results, map[string]interface{}{
			"region":      region,
			"order_count": orderCount,
			"revenue":     revenue,
		})
	}
	return results, nil
}

// GetFlightStatistics 获取飞行统计
func (r *AnalyticsRepository) GetFlightStatistics(startDate, endDate time.Time) (map[string]interface{}, error) {
	result := map[string]interface{}{
		"total_flights":    0,
		"total_distance":   0.0,
		"total_duration":   0.0,
		"total_cargo":      0.0,
		"avg_flight_time":  0.0,
		"max_altitude":     0,
	}

	// 统计飞行轨迹数据
	var totalFlights int64
	var totalDistance, totalDuration float64

	r.db.Model(&model.FlightTrajectory{}).
		Where("started_at >= ? AND started_at <= ?", startDate, endDate).
		Count(&totalFlights)

	r.db.Model(&model.FlightTrajectory{}).
		Where("started_at >= ? AND started_at <= ? AND recording_status = 'completed'", startDate, endDate).
		Select("COALESCE(SUM(total_distance), 0), COALESCE(SUM(total_duration), 0)").
		Row().Scan(&totalDistance, &totalDuration)

	result["total_flights"] = totalFlights
	result["total_distance"] = totalDistance / 1000 // 转换为公里
	result["total_duration"] = totalDuration / 3600 // 转换为小时

	if totalFlights > 0 {
		result["avg_flight_time"] = totalDuration / float64(totalFlights) / 60 // 转换为分钟
	}

	return result, nil
}

// GetAlertStatistics 获取告警统计
func (r *AnalyticsRepository) GetAlertStatistics(date time.Time) (map[string]interface{}, error) {
	dateStr := date.Format("2006-01-02")
	result := map[string]interface{}{
		"total":    0,
		"active":   0,
		"resolved": 0,
		"critical": 0,
		"warning":  0,
		"info":     0,
	}

	var total, active, resolved, critical, warning, info int64

	r.db.Model(&model.FlightAlert{}).Where("DATE(created_at) = ?", dateStr).Count(&total)
	r.db.Model(&model.FlightAlert{}).Where("status = 'active'").Count(&active)
	r.db.Model(&model.FlightAlert{}).Where("DATE(resolved_at) = ?", dateStr).Count(&resolved)
	r.db.Model(&model.FlightAlert{}).Where("DATE(created_at) = ? AND alert_level = 'critical'", dateStr).Count(&critical)
	r.db.Model(&model.FlightAlert{}).Where("DATE(created_at) = ? AND alert_level = 'warning'", dateStr).Count(&warning)
	r.db.Model(&model.FlightAlert{}).Where("DATE(created_at) = ? AND alert_level = 'info'", dateStr).Count(&info)

	result["total"] = total
	result["active"] = active
	result["resolved"] = resolved
	result["critical"] = critical
	result["warning"] = warning
	result["info"] = info

	return result, nil
}
