package service

import (
	"encoding/json"
	"fmt"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type AnalyticsService struct {
	analyticsRepo *repository.AnalyticsRepository
}

func NewAnalyticsService(analyticsRepo *repository.AnalyticsRepository) *AnalyticsService {
	return &AnalyticsService{
		analyticsRepo: analyticsRepo,
	}
}

// ==================== 实时看板 ====================

// RealtimeDashboardData 实时看板数据结构
type RealtimeDashboardData struct {
	TodayOrders    TodayOrdersMetric    `json:"today_orders"`
	TodayRevenue   TodayRevenueMetric   `json:"today_revenue"`
	OnlineCapacity OnlineCapacityMetric `json:"online_capacity"`
	ActiveUsers    ActiveUsersMetric    `json:"active_users"`
	AlertsSummary  AlertsSummaryMetric  `json:"alerts_summary"`
	RecentOrders   []RecentOrderItem    `json:"recent_orders"`
	TopRegions     []TopRegionItem      `json:"top_regions"`
	SystemHealth   SystemHealthMetric   `json:"system_health"`
}

type TodayOrdersMetric struct {
	New        int64   `json:"new"`
	Completed  int64   `json:"completed"`
	Cancelled  int64   `json:"cancelled"`
	InProgress int64   `json:"in_progress"`
	Rate       float64 `json:"completion_rate"`
}

type TodayRevenueMetric struct {
	Total       int64 `json:"total"`
	PlatformFee int64 `json:"platform_fee"`
	PilotIncome int64 `json:"pilot_income"`
	OwnerIncome int64 `json:"owner_income"`
}

type OnlineCapacityMetric struct {
	Pilots        int64 `json:"pilots"`
	Drones        int64 `json:"drones"`
	ActiveFlights int64 `json:"active_flights"`
}

type ActiveUsersMetric struct {
	Total   int64 `json:"total"`
	Pilots  int64 `json:"pilots"`
	Owners  int64 `json:"owners"`
	Clients int64 `json:"clients"`
}

type AlertsSummaryMetric struct {
	Active        int64 `json:"active"`
	ResolvedToday int64 `json:"resolved_today"`
	Critical      int64 `json:"critical"`
}

type RecentOrderItem struct {
	OrderNo   string    `json:"order_no"`
	Title     string    `json:"title"`
	Amount    int64     `json:"amount"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type TopRegionItem struct {
	Region     string `json:"region"`
	OrderCount int64  `json:"order_count"`
	Revenue    int64  `json:"revenue"`
}

type SystemHealthMetric struct {
	Status        string `json:"status"`
	APILatency    int64  `json:"api_latency"`
	DBConnections int    `json:"db_connections"`
}

// GetRealtimeDashboard 获取实时看板数据
func (s *AnalyticsService) GetRealtimeDashboard() (*RealtimeDashboardData, error) {
	dashboard := &RealtimeDashboardData{}

	// 今日订单统计
	newOrders, completed, cancelled, inProgress, _ := s.analyticsRepo.CountTodayOrders()
	dashboard.TodayOrders = TodayOrdersMetric{
		New:        newOrders,
		Completed:  completed,
		Cancelled:  cancelled,
		InProgress: inProgress,
	}
	if newOrders > 0 {
		dashboard.TodayOrders.Rate = float64(completed) / float64(newOrders) * 100
	}

	// 今日收入统计
	revenue, _ := s.analyticsRepo.SumTodayRevenue()
	dashboard.TodayRevenue = TodayRevenueMetric{
		Total: revenue,
	}

	// 在线运力
	pilots, drones, activeFlights, _ := s.analyticsRepo.CountOnlineCapacity()
	dashboard.OnlineCapacity = OnlineCapacityMetric{
		Pilots:        pilots,
		Drones:        drones,
		ActiveFlights: activeFlights,
	}

	// 用户统计
	total, pilotCount, owners, clients, _ := s.analyticsRepo.CountTotalUsers()
	dashboard.ActiveUsers = ActiveUsersMetric{
		Total:   total,
		Pilots:  pilotCount,
		Owners:  owners,
		Clients: clients,
	}

	// 告警统计
	alertStats, _ := s.analyticsRepo.GetAlertStatistics(time.Now())
	dashboard.AlertsSummary = AlertsSummaryMetric{
		Active:        alertStats["active"].(int64),
		ResolvedToday: alertStats["resolved"].(int64),
		Critical:      alertStats["critical"].(int64),
	}

	// 区域统计
	regionStats, _ := s.analyticsRepo.GetOrdersByRegion(time.Now())
	for _, r := range regionStats {
		if len(dashboard.TopRegions) >= 5 {
			break
		}
		dashboard.TopRegions = append(dashboard.TopRegions, TopRegionItem{
			Region:     r["region"].(string),
			OrderCount: r["order_count"].(int64),
			Revenue:    r["revenue"].(int64),
		})
	}

	// 系统健康状态
	dashboard.SystemHealth = SystemHealthMetric{
		Status:        "healthy",
		APILatency:    50,
		DBConnections: 10,
	}

	return dashboard, nil
}

// RefreshRealtimeDashboard 刷新实时看板缓存
func (s *AnalyticsService) RefreshRealtimeDashboard() error {
	dashboard, err := s.GetRealtimeDashboard()
	if err != nil {
		return err
	}

	// 更新各个缓存项
	ordersJSON, _ := json.Marshal(dashboard.TodayOrders)
	s.analyticsRepo.UpsertDashboardMetric("today_orders", string(ordersJSON))

	revenueJSON, _ := json.Marshal(dashboard.TodayRevenue)
	s.analyticsRepo.UpsertDashboardMetric("today_revenue", string(revenueJSON))

	capacityJSON, _ := json.Marshal(dashboard.OnlineCapacity)
	s.analyticsRepo.UpsertDashboardMetric("online_capacity", string(capacityJSON))

	usersJSON, _ := json.Marshal(dashboard.ActiveUsers)
	s.analyticsRepo.UpsertDashboardMetric("active_users", string(usersJSON))

	alertsJSON, _ := json.Marshal(dashboard.AlertsSummary)
	s.analyticsRepo.UpsertDashboardMetric("alerts_summary", string(alertsJSON))

	regionsJSON, _ := json.Marshal(dashboard.TopRegions)
	s.analyticsRepo.UpsertDashboardMetric("top_regions", string(regionsJSON))

	healthJSON, _ := json.Marshal(dashboard.SystemHealth)
	s.analyticsRepo.UpsertDashboardMetric("system_health", string(healthJSON))

	return nil
}

// ==================== 趋势数据 ====================

// TrendData 趋势数据
type TrendData struct {
	OrderTrend      []map[string]interface{} `json:"order_trend"`
	RevenueTrend    []map[string]interface{} `json:"revenue_trend"`
	UserGrowthTrend []map[string]interface{} `json:"user_growth_trend"`
}

// GetTrendData 获取趋势数据
func (s *AnalyticsService) GetTrendData(days int) (*TrendData, error) {
	if days <= 0 {
		days = 7
	}
	if days > 90 {
		days = 90
	}

	trend := &TrendData{}

	orderTrend, err := s.analyticsRepo.GetOrderTrend(days)
	if err == nil {
		trend.OrderTrend = orderTrend
	}

	revenueTrend, err := s.analyticsRepo.GetRevenueTrend(days)
	if err == nil {
		trend.RevenueTrend = revenueTrend
	}

	userTrend, err := s.analyticsRepo.GetUserGrowthTrend(days)
	if err == nil {
		trend.UserGrowthTrend = userTrend
	}

	return trend, nil
}

// ==================== 每日统计 ====================

// GetDailyStatistics 获取每日统计
func (s *AnalyticsService) GetDailyStatistics(date time.Time) (*model.DailyStatistics, error) {
	return s.analyticsRepo.GetDailyStatistics(date)
}

// GetDailyStatisticsRange 获取日期范围统计
func (s *AnalyticsService) GetDailyStatisticsRange(startDate, endDate time.Time) ([]model.DailyStatistics, error) {
	return s.analyticsRepo.GetDailyStatisticsRange(startDate, endDate)
}

// GenerateDailyStatistics 生成每日统计数据
func (s *AnalyticsService) GenerateDailyStatistics(date time.Time) (*model.DailyStatistics, error) {
	dateStr := date.Format("2006-01-02")
	startTime, _ := time.Parse("2006-01-02", dateStr)
	endTime := startTime.Add(24 * time.Hour)

	stat := &model.DailyStatistics{
		StatDate: startTime,
	}

	// 订单统计
	newOrders, completed, cancelled, inProgress, _ := s.analyticsRepo.CountTodayOrders()
	stat.NewOrders = int(newOrders)
	stat.CompletedOrders = int(completed)
	stat.CancelledOrders = int(cancelled)
	stat.InProgressOrders = int(inProgress)
	stat.TotalOrders = stat.NewOrders

	if stat.TotalOrders > 0 {
		stat.CompletionRate = float64(stat.CompletedOrders) / float64(stat.TotalOrders) * 100
		stat.CancellationRate = float64(stat.CancelledOrders) / float64(stat.TotalOrders) * 100
	}

	// 收入统计
	stat.TotalRevenue, _ = s.analyticsRepo.SumTodayRevenue()

	// 用户统计
	total, pilots, owners, clients, _ := s.analyticsRepo.CountTotalUsers()
	stat.TotalUsers = int(total)
	stat.TotalPilots = int(pilots)

	// 运力统计
	onlinePilots, availableDrones, _, _ := s.analyticsRepo.CountOnlineCapacity()
	stat.OnlinePilots = int(onlinePilots)
	stat.AvailableDrones = int(availableDrones)

	// 活跃用户 - 简化统计
	stat.ActiveUsers = int(pilots + owners + clients)
	stat.NewPilots = 0
	stat.NewOwners = 0
	stat.NewClients = 0

	// 飞行统计
	flightStats, _ := s.analyticsRepo.GetFlightStatistics(startTime, endTime)
	if v, ok := flightStats["total_flights"].(int64); ok {
		stat.TotalFlights = int(v)
	}
	if v, ok := flightStats["total_distance"].(float64); ok {
		stat.TotalDistance = v
	}
	if v, ok := flightStats["total_duration"].(float64); ok {
		stat.TotalFlightHours = v
	}
	if v, ok := flightStats["avg_flight_time"].(float64); ok {
		stat.AvgFlightTime = v
	}

	// 风控统计
	alertStats, _ := s.analyticsRepo.GetAlertStatistics(date)
	if v, ok := alertStats["total"].(int64); ok {
		stat.AlertsTriggered = int(v)
	}

	// 保存统计
	err := s.analyticsRepo.UpsertDailyStatistics(stat)
	if err != nil {
		return nil, err
	}

	return stat, nil
}

// ==================== 报表生成 ====================

// ReportSummary 报表概要
type ReportSummary struct {
	TotalOrders     int     `json:"total_orders"`
	CompletedOrders int     `json:"completed_orders"`
	CompletionRate  float64 `json:"completion_rate"`
	TotalRevenue    int64   `json:"total_revenue"`
	PlatformFee     int64   `json:"platform_fee"`
	NewUsers        int     `json:"new_users"`
	TotalFlights    int     `json:"total_flights"`
	TotalDistance   float64 `json:"total_distance"`
	AlertsCount     int     `json:"alerts_count"`
	ViolationsCount int     `json:"violations_count"`
}

// GenerateReport 生成报表
func (s *AnalyticsService) GenerateReport(reportType string, startDate, endDate time.Time) (*model.AnalyticsReport, error) {
	reportNo := fmt.Sprintf("RPT%s%s", time.Now().Format("20060102150405"), reportType[:1])
	reportName := s.getReportName(reportType, startDate, endDate)

	report := &model.AnalyticsReport{
		ReportNo:    reportNo,
		ReportType:  reportType,
		ReportName:  reportName,
		PeriodStart: startDate,
		PeriodEnd:   endDate,
		Status:      "generating",
		GeneratedBy: "system",
	}

	// 创建报表记录
	err := s.analyticsRepo.CreateReport(report)
	if err != nil {
		return nil, err
	}

	// 异步生成报表内容
	go s.generateReportContent(report)

	return report, nil
}

func (s *AnalyticsService) getReportName(reportType string, startDate, endDate time.Time) string {
	switch reportType {
	case "daily":
		return fmt.Sprintf("日报 - %s", startDate.Format("2006年01月02日"))
	case "weekly":
		return fmt.Sprintf("周报 - %s至%s", startDate.Format("01月02日"), endDate.Format("01月02日"))
	case "monthly":
		return fmt.Sprintf("月报 - %s", startDate.Format("2006年01月"))
	case "quarterly":
		quarter := (startDate.Month()-1)/3 + 1
		return fmt.Sprintf("季报 - %d年Q%d", startDate.Year(), quarter)
	case "yearly":
		return fmt.Sprintf("年报 - %d年", startDate.Year())
	default:
		return fmt.Sprintf("自定义报表 - %s至%s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	}
}

func (s *AnalyticsService) generateReportContent(report *model.AnalyticsReport) {
	// 获取周期内统计数据
	stats, err := s.analyticsRepo.GetDailyStatisticsRange(report.PeriodStart, report.PeriodEnd)
	if err != nil {
		report.Status = "failed"
		s.analyticsRepo.UpdateReport(report)
		return
	}

	// 计算汇总数据
	summary := s.calculateSummary(stats)
	summaryJSON, _ := json.Marshal(summary)
	report.Summary = string(summaryJSON)

	// 订单分析
	orderAnalysis := s.analyzeOrders(stats)
	orderJSON, _ := json.Marshal(orderAnalysis)
	report.OrderAnalysis = string(orderJSON)

	// 收入分析
	revenueAnalysis := s.analyzeRevenue(stats)
	revenueJSON, _ := json.Marshal(revenueAnalysis)
	report.RevenueAnalysis = string(revenueJSON)

	// 用户分析
	userAnalysis := s.analyzeUsers(stats)
	userJSON, _ := json.Marshal(userAnalysis)
	report.UserAnalysis = string(userJSON)

	// 飞行分析
	flightAnalysis := s.analyzeFlights(stats)
	flightJSON, _ := json.Marshal(flightAnalysis)
	report.FlightAnalysis = string(flightJSON)

	// 风控分析
	riskAnalysis := s.analyzeRisks(stats)
	riskJSON, _ := json.Marshal(riskAnalysis)
	report.RiskAnalysis = string(riskJSON)

	// 趋势分析
	trendAnalysis := s.analyzeTrends(stats)
	trendJSON, _ := json.Marshal(trendAnalysis)
	report.TrendAnalysis = string(trendJSON)

	// 生成建议
	recommendations := s.generateRecommendations(summary)
	recommendationsJSON, _ := json.Marshal(recommendations)
	report.Recommendations = string(recommendationsJSON)

	// 更新状态
	now := time.Now()
	report.GeneratedAt = &now
	report.Status = "completed"
	s.analyticsRepo.UpdateReport(report)
}

func (s *AnalyticsService) calculateSummary(stats []model.DailyStatistics) *ReportSummary {
	summary := &ReportSummary{}
	for _, stat := range stats {
		summary.TotalOrders += stat.TotalOrders
		summary.CompletedOrders += stat.CompletedOrders
		summary.TotalRevenue += stat.TotalRevenue
		summary.PlatformFee += stat.PlatformFee
		summary.NewUsers += stat.NewUsers
		summary.TotalFlights += stat.TotalFlights
		summary.TotalDistance += stat.TotalDistance
		summary.AlertsCount += stat.AlertsTriggered
		summary.ViolationsCount += stat.ViolationsCount
	}
	if summary.TotalOrders > 0 {
		summary.CompletionRate = float64(summary.CompletedOrders) / float64(summary.TotalOrders) * 100
	}
	return summary
}

func (s *AnalyticsService) analyzeOrders(stats []model.DailyStatistics) map[string]interface{} {
	analysis := map[string]interface{}{
		"daily_average": 0,
		"peak_day":      "",
		"peak_count":    0,
		"trend":         "stable",
	}

	if len(stats) == 0 {
		return analysis
	}

	total := 0
	peakDay := ""
	peakCount := 0
	for _, stat := range stats {
		total += stat.TotalOrders
		if stat.TotalOrders > peakCount {
			peakCount = stat.TotalOrders
			peakDay = stat.StatDate.Format("2006-01-02")
		}
	}

	analysis["daily_average"] = total / len(stats)
	analysis["peak_day"] = peakDay
	analysis["peak_count"] = peakCount

	// 简单趋势判断
	if len(stats) >= 3 {
		firstHalf := 0
		secondHalf := 0
		mid := len(stats) / 2
		for i, stat := range stats {
			if i < mid {
				firstHalf += stat.TotalOrders
			} else {
				secondHalf += stat.TotalOrders
			}
		}
		if secondHalf > firstHalf*12/10 {
			analysis["trend"] = "growing"
		} else if secondHalf < firstHalf*8/10 {
			analysis["trend"] = "declining"
		}
	}

	return analysis
}

func (s *AnalyticsService) analyzeRevenue(stats []model.DailyStatistics) map[string]interface{} {
	analysis := map[string]interface{}{
		"daily_average": int64(0),
		"peak_day":      "",
		"peak_revenue":  int64(0),
		"growth_rate":   0.0,
	}

	if len(stats) == 0 {
		return analysis
	}

	var total int64
	var peakRevenue int64
	peakDay := ""
	for _, stat := range stats {
		total += stat.TotalRevenue
		if stat.TotalRevenue > peakRevenue {
			peakRevenue = stat.TotalRevenue
			peakDay = stat.StatDate.Format("2006-01-02")
		}
	}

	analysis["daily_average"] = total / int64(len(stats))
	analysis["peak_day"] = peakDay
	analysis["peak_revenue"] = peakRevenue

	return analysis
}

func (s *AnalyticsService) analyzeUsers(stats []model.DailyStatistics) map[string]interface{} {
	analysis := map[string]interface{}{
		"total_new_users":  0,
		"new_pilots":       0,
		"new_owners":       0,
		"new_clients":      0,
		"avg_active_users": 0,
	}

	if len(stats) == 0 {
		return analysis
	}

	totalNew := 0
	totalActive := 0
	for _, stat := range stats {
		totalNew += stat.NewUsers
		totalActive += stat.ActiveUsers
	}

	analysis["total_new_users"] = totalNew
	analysis["avg_active_users"] = totalActive / len(stats)

	return analysis
}

func (s *AnalyticsService) analyzeFlights(stats []model.DailyStatistics) map[string]interface{} {
	analysis := map[string]interface{}{
		"total_flights":   0,
		"total_distance":  0.0,
		"total_hours":     0.0,
		"avg_flight_time": 0.0,
	}

	for _, stat := range stats {
		analysis["total_flights"] = analysis["total_flights"].(int) + stat.TotalFlights
		analysis["total_distance"] = analysis["total_distance"].(float64) + stat.TotalDistance
		analysis["total_hours"] = analysis["total_hours"].(float64) + stat.TotalFlightHours
	}

	totalFlights := analysis["total_flights"].(int)
	if totalFlights > 0 {
		analysis["avg_flight_time"] = analysis["total_hours"].(float64) * 60 / float64(totalFlights)
	}

	return analysis
}

func (s *AnalyticsService) analyzeRisks(stats []model.DailyStatistics) map[string]interface{} {
	analysis := map[string]interface{}{
		"total_alerts":     0,
		"total_violations": 0,
		"total_claims":     0,
		"total_disputes":   0,
		"risk_level":       "low",
	}

	for _, stat := range stats {
		analysis["total_alerts"] = analysis["total_alerts"].(int) + stat.AlertsTriggered
		analysis["total_violations"] = analysis["total_violations"].(int) + stat.ViolationsCount
		analysis["total_claims"] = analysis["total_claims"].(int) + stat.ClaimsCount
		analysis["total_disputes"] = analysis["total_disputes"].(int) + stat.DisputesCount
	}

	// 风险等级评估
	violations := analysis["total_violations"].(int)
	if violations > 10 {
		analysis["risk_level"] = "high"
	} else if violations > 5 {
		analysis["risk_level"] = "medium"
	}

	return analysis
}

func (s *AnalyticsService) analyzeTrends(stats []model.DailyStatistics) map[string]interface{} {
	analysis := map[string]interface{}{
		"order_trend":   "stable",
		"revenue_trend": "stable",
		"user_trend":    "stable",
	}

	if len(stats) < 3 {
		return analysis
	}

	// 订单趋势
	orderFirst := 0
	orderSecond := 0
	mid := len(stats) / 2
	for i, stat := range stats {
		if i < mid {
			orderFirst += stat.TotalOrders
		} else {
			orderSecond += stat.TotalOrders
		}
	}
	if orderSecond > orderFirst*12/10 {
		analysis["order_trend"] = "growing"
	} else if orderSecond < orderFirst*8/10 {
		analysis["order_trend"] = "declining"
	}

	return analysis
}

func (s *AnalyticsService) generateRecommendations(summary *ReportSummary) []string {
	recommendations := []string{}

	if summary.CompletionRate < 80 {
		recommendations = append(recommendations, "订单完成率较低，建议优化派单算法或增加运力供给")
	}

	if summary.ViolationsCount > 5 {
		recommendations = append(recommendations, "违规次数较多，建议加强风控审核和用户培训")
	}

	if summary.AlertsCount > 20 {
		recommendations = append(recommendations, "告警次数较多，建议检查系统配置和优化监控阈值")
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "各项指标运行正常，继续保持")
	}

	return recommendations
}

// GetReport 获取报表详情
func (s *AnalyticsService) GetReport(id int64) (*model.AnalyticsReport, error) {
	return s.analyticsRepo.GetReportByID(id)
}

// GetReportByNo 通过编号获取报表
func (s *AnalyticsService) GetReportByNo(reportNo string) (*model.AnalyticsReport, error) {
	return s.analyticsRepo.GetReportByNo(reportNo)
}

// GetReportList 获取报表列表
func (s *AnalyticsService) GetReportList(reportType string, page, pageSize int) ([]model.AnalyticsReport, int64, error) {
	offset := (page - 1) * pageSize
	return s.analyticsRepo.GetReportsByType(reportType, pageSize, offset)
}

// GetLatestReport 获取最新报表
func (s *AnalyticsService) GetLatestReport(reportType string) (*model.AnalyticsReport, error) {
	return s.analyticsRepo.GetLatestReport(reportType)
}

// DeleteReport 删除报表
func (s *AnalyticsService) DeleteReport(id int64) error {
	return s.analyticsRepo.DeleteReport(id)
}

// ==================== 热力图数据 ====================

// GetHeatmapData 获取热力图数据
func (s *AnalyticsService) GetHeatmapData(dataType string, date time.Time) ([]model.HeatmapData, error) {
	return s.analyticsRepo.GetHeatmapData(dataType, date)
}

// ==================== 区域统计 ====================

// GetRegionStatistics 获取区域统计
func (s *AnalyticsService) GetRegionStatistics(date time.Time) ([]model.RegionStatistics, error) {
	return s.analyticsRepo.GetRegionStatisticsByDate(date)
}

// GetTopRegions 获取TOP区域
func (s *AnalyticsService) GetTopRegions(date time.Time, limit int) ([]model.RegionStatistics, error) {
	return s.analyticsRepo.GetTopRegions(date, limit)
}

// ==================== 小时指标 ====================

// GetHourlyMetrics 获取小时指标
func (s *AnalyticsService) GetHourlyMetrics(hours int) ([]model.HourlyMetrics, error) {
	return s.analyticsRepo.GetLatestHourlyMetrics(hours)
}

// RecordHourlyMetrics 记录小时指标
func (s *AnalyticsService) RecordHourlyMetrics() error {
	now := time.Now()
	metricTime := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), 0, 0, 0, now.Location())

	metric := &model.HourlyMetrics{
		MetricTime: metricTime,
	}

	// 统计数据
	newOrders, completed, cancelled, _, _ := s.analyticsRepo.CountTodayOrders()
	metric.NewOrders = int(newOrders)
	metric.CompletedOrders = int(completed)
	metric.CancelledOrders = int(cancelled)

	revenue, _ := s.analyticsRepo.SumTodayRevenue()
	metric.Revenue = revenue

	pilots, drones, activeFlights, _ := s.analyticsRepo.CountOnlineCapacity()
	metric.OnlinePilots = int(pilots)
	metric.AvailableDrones = int(drones)
	metric.ActiveFlights = int(activeFlights)

	total, _, _, _, _ := s.analyticsRepo.CountTotalUsers()
	metric.ActiveUsers = int(total)

	return s.analyticsRepo.UpsertHourlyMetrics(metric)
}

// ==================== 定时任务 ====================

// RunDailyStatisticsJob 运行每日统计任务
func (s *AnalyticsService) RunDailyStatisticsJob() error {
	yesterday := time.Now().AddDate(0, 0, -1)
	_, err := s.GenerateDailyStatistics(yesterday)
	return err
}

// RunHourlyMetricsJob 运行小时指标任务
func (s *AnalyticsService) RunHourlyMetricsJob() error {
	return s.RecordHourlyMetrics()
}

// RunAutoReportJob 运行自动报表生成任务
func (s *AnalyticsService) RunAutoReportJob() error {
	now := time.Now()

	// 每日凌晨生成日报
	if now.Hour() == 1 {
		yesterday := now.AddDate(0, 0, -1)
		startOfDay := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, yesterday.Location())
		endOfDay := startOfDay.Add(24*time.Hour - time.Second)
		s.GenerateReport("daily", startOfDay, endOfDay)
	}

	// 每周一生成周报
	if now.Weekday() == time.Monday && now.Hour() == 2 {
		startOfWeek := now.AddDate(0, 0, -7)
		startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, startOfWeek.Location())
		endOfWeek := now.AddDate(0, 0, -1)
		endOfWeek = time.Date(endOfWeek.Year(), endOfWeek.Month(), endOfWeek.Day(), 23, 59, 59, 0, endOfWeek.Location())
		s.GenerateReport("weekly", startOfWeek, endOfWeek)
	}

	// 每月1号生成月报
	if now.Day() == 1 && now.Hour() == 3 {
		lastMonth := now.AddDate(0, -1, 0)
		startOfMonth := time.Date(lastMonth.Year(), lastMonth.Month(), 1, 0, 0, 0, 0, lastMonth.Location())
		endOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Add(-time.Second)
		s.GenerateReport("monthly", startOfMonth, endOfMonth)
	}

	return nil
}
