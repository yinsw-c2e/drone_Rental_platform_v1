package analytics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"wurenji-backend/internal/service"
)

type Handler struct {
	analyticsService *service.AnalyticsService
}

func NewHandler(analyticsService *service.AnalyticsService) *Handler {
	return &Handler{
		analyticsService: analyticsService,
	}
}

// ==================== 实时看板 ====================

// GetRealtimeDashboard 获取实时看板数据
// GET /api/v1/analytics/dashboard/realtime
func (h *Handler) GetRealtimeDashboard(c *gin.Context) {
	dashboard, err := h.analyticsService.GetRealtimeDashboard()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取看板数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": dashboard,
	})
}

// RefreshDashboard 刷新看板缓存
// POST /api/v1/analytics/dashboard/refresh
func (h *Handler) RefreshDashboard(c *gin.Context) {
	err := h.analyticsService.RefreshRealtimeDashboard()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刷新失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "刷新成功",
	})
}

// ==================== 趋势数据 ====================

// GetTrendData 获取趋势数据
// GET /api/v1/analytics/trends?days=7
func (h *Handler) GetTrendData(c *gin.Context) {
	days := 7
	if d, err := strconv.Atoi(c.Query("days")); err == nil && d > 0 {
		days = d
	}

	trend, err := h.analyticsService.GetTrendData(days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取趋势数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": trend,
	})
}

// ==================== 每日统计 ====================

// GetDailyStatistics 获取每日统计
// GET /api/v1/analytics/daily?date=2026-03-01
func (h *Handler) GetDailyStatistics(c *gin.Context) {
	dateStr := c.Query("date")
	var date time.Time
	var err error

	if dateStr == "" {
		date = time.Now()
	} else {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "日期格式错误，请使用 YYYY-MM-DD 格式"})
			return
		}
	}

	stat, err := h.analyticsService.GetDailyStatistics(date)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "未找到统计数据"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": stat,
	})
}

// GetDailyStatisticsRange 获取日期范围统计
// GET /api/v1/analytics/daily/range?start=2026-03-01&end=2026-03-07
func (h *Handler) GetDailyStatisticsRange(c *gin.Context) {
	startStr := c.Query("start")
	endStr := c.Query("end")

	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供 start 和 end 日期参数"})
		return
	}

	startDate, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "开始日期格式错误"})
		return
	}

	endDate, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "结束日期格式错误"})
		return
	}

	stats, err := h.analyticsService.GetDailyStatisticsRange(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取统计数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  stats,
		"total": len(stats),
	})
}

// GenerateDailyStatistics 生成每日统计(管理端)
// POST /api/v1/analytics/admin/daily/generate
func (h *Handler) GenerateDailyStatistics(c *gin.Context) {
	var req struct {
		Date string `json:"date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var date time.Time
	var err error
	if req.Date == "" {
		date = time.Now().AddDate(0, 0, -1) // 默认生成昨天的
	} else {
		date, err = time.Parse("2006-01-02", req.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "日期格式错误"})
			return
		}
	}

	stat, err := h.analyticsService.GenerateDailyStatistics(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成统计失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "生成成功",
		"data":    stat,
	})
}

// ==================== 报表管理 ====================

// GenerateReport 生成报表
// POST /api/v1/analytics/report/generate
func (h *Handler) GenerateReport(c *gin.Context) {
	var req struct {
		ReportType string `json:"report_type" binding:"required"` // daily, weekly, monthly, quarterly, yearly, custom
		StartDate  string `json:"start_date" binding:"required"`
		EndDate    string `json:"end_date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "开始日期格式错误"})
		return
	}

	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "结束日期格式错误"})
		return
	}

	report, err := h.analyticsService.GenerateReport(req.ReportType, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建报表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "报表生成中",
		"data":    report,
	})
}

// GetReport 获取报表详情
// GET /api/v1/analytics/report/:id
func (h *Handler) GetReport(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID格式错误"})
		return
	}

	report, err := h.analyticsService.GetReport(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "报表不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": report,
	})
}

// GetReportByNo 通过编号获取报表
// GET /api/v1/analytics/report/no/:reportNo
func (h *Handler) GetReportByNo(c *gin.Context) {
	reportNo := c.Param("reportNo")
	report, err := h.analyticsService.GetReportByNo(reportNo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "报表不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": report,
	})
}

// GetReportList 获取报表列表
// GET /api/v1/analytics/reports?type=daily&page=1&page_size=10
func (h *Handler) GetReportList(c *gin.Context) {
	reportType := c.Query("type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	reports, total, err := h.analyticsService.GetReportList(reportType, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取报表列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      reports,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetLatestReport 获取最新报表
// GET /api/v1/analytics/report/latest/:type
func (h *Handler) GetLatestReport(c *gin.Context) {
	reportType := c.Param("type")
	report, err := h.analyticsService.GetLatestReport(reportType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "未找到报表"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": report,
	})
}

// DeleteReport 删除报表
// DELETE /api/v1/analytics/report/:id
func (h *Handler) DeleteReport(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID格式错误"})
		return
	}

	err = h.analyticsService.DeleteReport(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "删除成功",
	})
}

// ==================== 热力图 ====================

// GetHeatmapData 获取热力图数据
// GET /api/v1/analytics/heatmap?type=order_density&date=2026-03-01
func (h *Handler) GetHeatmapData(c *gin.Context) {
	dataType := c.Query("type")
	if dataType == "" {
		dataType = "order_density"
	}

	dateStr := c.Query("date")
	var date time.Time
	var err error

	if dateStr == "" {
		date = time.Now()
	} else {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "日期格式错误"})
			return
		}
	}

	data, err := h.analyticsService.GetHeatmapData(dataType, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取热力图数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  data,
		"total": len(data),
	})
}

// ==================== 区域统计 ====================

// GetRegionStatistics 获取区域统计
// GET /api/v1/analytics/regions?date=2026-03-01
func (h *Handler) GetRegionStatistics(c *gin.Context) {
	dateStr := c.Query("date")
	var date time.Time
	var err error

	if dateStr == "" {
		date = time.Now()
	} else {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "日期格式错误"})
			return
		}
	}

	stats, err := h.analyticsService.GetRegionStatistics(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取区域统计失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  stats,
		"total": len(stats),
	})
}

// GetTopRegions 获取TOP区域
// GET /api/v1/analytics/regions/top?date=2026-03-01&limit=10
func (h *Handler) GetTopRegions(c *gin.Context) {
	dateStr := c.Query("date")
	var date time.Time
	var err error

	if dateStr == "" {
		date = time.Now()
	} else {
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "日期格式错误"})
			return
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit < 1 || limit > 50 {
		limit = 10
	}

	stats, err := h.analyticsService.GetTopRegions(date, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取区域统计失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": stats,
	})
}

// ==================== 小时指标 ====================

// GetHourlyMetrics 获取小时指标
// GET /api/v1/analytics/hourly?hours=24
func (h *Handler) GetHourlyMetrics(c *gin.Context) {
	hours, _ := strconv.Atoi(c.DefaultQuery("hours", "24"))
	if hours < 1 || hours > 168 {
		hours = 24
	}

	metrics, err := h.analyticsService.GetHourlyMetrics(hours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取小时指标失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  metrics,
		"total": len(metrics),
	})
}

// ==================== 定时任务(管理端) ====================

// TriggerDailyJob 手动触发每日统计任务
// POST /api/v1/analytics/admin/job/daily
func (h *Handler) TriggerDailyJob(c *gin.Context) {
	err := h.analyticsService.RunDailyStatisticsJob()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "执行失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "每日统计任务执行成功",
	})
}

// TriggerHourlyJob 手动触发小时指标任务
// POST /api/v1/analytics/admin/job/hourly
func (h *Handler) TriggerHourlyJob(c *gin.Context) {
	err := h.analyticsService.RunHourlyMetricsJob()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "执行失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "小时指标任务执行成功",
	})
}

// TriggerAutoReportJob 手动触发自动报表任务
// POST /api/v1/analytics/admin/job/report
func (h *Handler) TriggerAutoReportJob(c *gin.Context) {
	err := h.analyticsService.RunAutoReportJob()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "执行失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "自动报表任务执行成功",
	})
}

// ==================== 概览统计 ====================

// GetOverview 获取数据概览
// GET /api/v1/analytics/overview
func (h *Handler) GetOverview(c *gin.Context) {
	dashboard, err := h.analyticsService.GetRealtimeDashboard()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取概览失败"})
		return
	}

	// 获取趋势数据
	trend, _ := h.analyticsService.GetTrendData(7)

	c.JSON(http.StatusOK, gin.H{
		"dashboard": dashboard,
		"trend":     trend,
	})
}
