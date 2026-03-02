package flight

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/service"
)

// Handler 飞行监控API处理器
type Handler struct {
	flightService *service.FlightService
	pilotService  *service.PilotService
}

func NewHandler(flightService *service.FlightService, pilotService *service.PilotService) *Handler {
	return &Handler{
		flightService: flightService,
		pilotService:  pilotService,
	}
}

// ==================== 位置上报 ====================

// ReportPosition 上报飞行位置
// @Summary 上报飞行位置
// @Tags 飞行监控
// @Accept json
// @Produce json
// @Param body body service.ReportPositionRequest true "位置数据"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/position [post]
func (h *Handler) ReportPosition(c *gin.Context) {
	var req service.ReportPositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 获取飞手ID
	userID := c.GetInt64("user_id")
	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "非飞手用户"})
		return
	}
	req.PilotID = pilot.ID

	pos, alerts, err := h.flightService.ReportPosition(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"position": pos,
		"alerts":   alerts,
	})
}

// GetLatestPosition 获取最新位置
// @Summary 获取订单最新位置
// @Tags 飞行监控
// @Produce json
// @Param order_id path int true "订单ID"
// @Success 200 {object} model.FlightPosition
// @Router /api/v1/flight/position/{order_id}/latest [get]
func (h *Handler) GetLatestPosition(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	pos, err := h.flightService.GetLatestPosition(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "未找到位置数据"})
		return
	}

	c.JSON(http.StatusOK, pos)
}

// GetPositionHistory 获取位置历史
// @Summary 获取订单位置历史
// @Tags 飞行监控
// @Produce json
// @Param order_id path int true "订单ID"
// @Param limit query int false "数量限制"
// @Success 200 {array} model.FlightPosition
// @Router /api/v1/flight/position/{order_id}/history [get]
func (h *Handler) GetPositionHistory(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	positions, err := h.flightService.GetPositionHistory(orderID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, positions)
}

// ==================== 告警管理 ====================

// GetAlerts 获取订单告警列表
// @Summary 获取订单告警列表
// @Tags 飞行监控
// @Produce json
// @Param order_id path int true "订单ID"
// @Success 200 {array} model.FlightAlert
// @Router /api/v1/flight/alerts/{order_id} [get]
func (h *Handler) GetAlerts(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	alerts, err := h.flightService.GetAlertsByOrder(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alerts)
}

// GetActiveAlerts 获取活跃告警
// @Summary 获取活跃告警
// @Tags 飞行监控
// @Produce json
// @Param order_id path int true "订单ID"
// @Success 200 {array} model.FlightAlert
// @Router /api/v1/flight/alerts/{order_id}/active [get]
func (h *Handler) GetActiveAlerts(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	alerts, err := h.flightService.GetActiveAlerts(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, alerts)
}

// AcknowledgeAlert 确认告警
// @Summary 确认告警
// @Tags 飞行监控
// @Produce json
// @Param alert_id path int true "告警ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/alert/{alert_id}/acknowledge [post]
func (h *Handler) AcknowledgeAlert(c *gin.Context) {
	alertID, _ := strconv.ParseInt(c.Param("alert_id"), 10, 64)
	if alertID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的告警ID"})
		return
	}

	userID := c.GetInt64("user_id")

	if err := h.flightService.AcknowledgeAlert(alertID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "告警已确认"})
}

// ResolveAlert 解决告警
// @Summary 解决告警
// @Tags 飞行监控
// @Accept json
// @Produce json
// @Param alert_id path int true "告警ID"
// @Param body body map[string]string true "解决备注"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/alert/{alert_id}/resolve [post]
func (h *Handler) ResolveAlert(c *gin.Context) {
	alertID, _ := strconv.ParseInt(c.Param("alert_id"), 10, 64)
	if alertID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的告警ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)

	if err := h.flightService.ResolveAlert(alertID, req.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "告警已解决"})
}

// ==================== 围栏管理 ====================

// ListGeofences 围栏列表
// @Summary 获取围栏列表
// @Tags 飞行监控-围栏
// @Produce json
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Param fence_type query string false "围栏类型"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/geofences [get]
func (h *Handler) ListGeofences(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filters := make(map[string]interface{})
	if fenceType := c.Query("fence_type"); fenceType != "" {
		filters["fence_type"] = fenceType
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}

	fences, total, err := h.flightService.ListGeofences(page, pageSize, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  fences,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

// GetGeofence 获取围栏详情
// @Summary 获取围栏详情
// @Tags 飞行监控-围栏
// @Produce json
// @Param id path int true "围栏ID"
// @Success 200 {object} model.Geofence
// @Router /api/v1/flight/geofence/{id} [get]
func (h *Handler) GetGeofence(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的围栏ID"})
		return
	}

	fence, err := h.flightService.GetGeofenceByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "围栏不存在"})
		return
	}

	c.JSON(http.StatusOK, fence)
}

// CreateGeofenceRequest 创建围栏请求
type CreateGeofenceRequest struct {
	Name            string                   `json:"name" binding:"required"`
	FenceType       string                   `json:"fence_type" binding:"required"`
	GeometryType    string                   `json:"geometry_type" binding:"required"`
	CenterLatitude  *float64                 `json:"center_latitude"`
	CenterLongitude *float64                 `json:"center_longitude"`
	Radius          *int                     `json:"radius"`
	Coordinates     []map[string]interface{} `json:"coordinates"`
	MinAltitude     int                      `json:"min_altitude"`
	MaxAltitude     int                      `json:"max_altitude"`
	EffectiveFrom   *time.Time               `json:"effective_from"`
	EffectiveTo     *time.Time               `json:"effective_to"`
	ViolationAction string                   `json:"violation_action"`
	AlertDistance   int                      `json:"alert_distance"`
	Description     string                   `json:"description"`
}

// CreateGeofence 创建围栏
// @Summary 创建围栏
// @Tags 飞行监控-围栏
// @Accept json
// @Produce json
// @Param body body CreateGeofenceRequest true "围栏数据"
// @Success 200 {object} model.Geofence
// @Router /api/v1/flight/geofence [post]
func (h *Handler) CreateGeofence(c *gin.Context) {
	var req CreateGeofenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	fence := &model.Geofence{
		Name:            req.Name,
		FenceType:       req.FenceType,
		GeometryType:    req.GeometryType,
		CenterLatitude:  req.CenterLatitude,
		CenterLongitude: req.CenterLongitude,
		Radius:          req.Radius,
		MinAltitude:     req.MinAltitude,
		MaxAltitude:     req.MaxAltitude,
		EffectiveFrom:   req.EffectiveFrom,
		EffectiveTo:     req.EffectiveTo,
		ViolationAction: req.ViolationAction,
		AlertDistance:   req.AlertDistance,
		Description:     req.Description,
		Status:          "active",
	}

	if err := h.flightService.CreateGeofence(fence); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, fence)
}

// DeleteGeofence 删除围栏
// @Summary 删除围栏
// @Tags 飞行监控-围栏
// @Produce json
// @Param id path int true "围栏ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/geofence/{id} [delete]
func (h *Handler) DeleteGeofence(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的围栏ID"})
		return
	}

	if err := h.flightService.DeleteGeofence(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "围栏已删除"})
}

// ==================== 轨迹录制 ====================

// StartTrajectoryRequest 开始轨迹录制请求
type StartTrajectoryRequest struct {
	OrderID   int64   `json:"order_id" binding:"required"`
	DroneID   int64   `json:"drone_id" binding:"required"`
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	Address   string  `json:"address"`
}

// StartTrajectory 开始轨迹录制
// @Summary 开始轨迹录制
// @Tags 飞行监控-轨迹
// @Accept json
// @Produce json
// @Param body body StartTrajectoryRequest true "起点信息"
// @Success 200 {object} model.FlightTrajectory
// @Router /api/v1/flight/trajectory/start [post]
func (h *Handler) StartTrajectory(c *gin.Context) {
	var req StartTrajectoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	userID := c.GetInt64("user_id")
	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "非飞手用户"})
		return
	}

	traj, err := h.flightService.StartTrajectoryRecording(
		req.OrderID, req.DroneID, pilot.ID,
		req.Latitude, req.Longitude, req.Address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, traj)
}

// StopTrajectoryRequest 停止轨迹录制请求
type StopTrajectoryRequest struct {
	TrajectoryID int64   `json:"trajectory_id" binding:"required"`
	Latitude     float64 `json:"latitude" binding:"required"`
	Longitude    float64 `json:"longitude" binding:"required"`
	Address      string  `json:"address"`
}

// StopTrajectory 停止轨迹录制
// @Summary 停止轨迹录制
// @Tags 飞行监控-轨迹
// @Accept json
// @Produce json
// @Param body body StopTrajectoryRequest true "终点信息"
// @Success 200 {object} model.FlightTrajectory
// @Router /api/v1/flight/trajectory/stop [post]
func (h *Handler) StopTrajectory(c *gin.Context) {
	var req StopTrajectoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	traj, err := h.flightService.StopTrajectoryRecording(
		req.TrajectoryID, req.Latitude, req.Longitude, req.Address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, traj)
}

// GetTrajectory 获取轨迹详情
// @Summary 获取轨迹详情
// @Tags 飞行监控-轨迹
// @Produce json
// @Param order_id path int true "订单ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/trajectory/{order_id} [get]
func (h *Handler) GetTrajectory(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	traj, err := h.flightService.GetTrajectoryByOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "轨迹不存在"})
		return
	}

	waypoints, _ := h.flightService.GetTrajectoryWaypoints(traj.ID)

	c.JSON(http.StatusOK, gin.H{
		"trajectory": traj,
		"waypoints":  waypoints,
	})
}

// MarkAsTemplate 标记轨迹为模板
// @Summary 标记轨迹为模板
// @Tags 飞行监控-轨迹
// @Accept json
// @Produce json
// @Param id path int true "轨迹ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/trajectory/{id}/template [post]
func (h *Handler) MarkAsTemplate(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的轨迹ID"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	c.ShouldBindJSON(&req)

	if err := h.flightService.MarkTrajectoryAsTemplate(id, req.Name, req.Description); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已标记为模板"})
}

// ==================== 路线管理 ====================

// CreateRouteFromTrajectoryRequest 从轨迹创建路线请求
type CreateRouteFromTrajectoryRequest struct {
	TrajectoryID int64  `json:"trajectory_id" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Description  string `json:"description"`
	Visibility   string `json:"visibility"` // private, shared, public
}

// CreateRouteFromTrajectory 从轨迹创建路线
// @Summary 从轨迹创建路线
// @Tags 飞行监控-路线
// @Accept json
// @Produce json
// @Param body body CreateRouteFromTrajectoryRequest true "路线信息"
// @Success 200 {object} model.SavedRoute
// @Router /api/v1/flight/route/from-trajectory [post]
func (h *Handler) CreateRouteFromTrajectory(c *gin.Context) {
	var req CreateRouteFromTrajectoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	userID := c.GetInt64("user_id")
	visibility := req.Visibility
	if visibility == "" {
		visibility = "private"
	}

	route, err := h.flightService.CreateRouteFromTrajectory(
		req.TrajectoryID, userID, req.Name, req.Description, visibility)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, route)
}

// ListMyRoutes 获取我的路线列表
// @Summary 获取我的路线列表
// @Tags 飞行监控-路线
// @Produce json
// @Success 200 {array} model.SavedRoute
// @Router /api/v1/flight/routes/mine [get]
func (h *Handler) ListMyRoutes(c *gin.Context) {
	userID := c.GetInt64("user_id")

	routes, err := h.flightService.ListUserRoutes(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, routes)
}

// ListPublicRoutes 获取公开路线列表
// @Summary 获取公开路线列表
// @Tags 飞行监控-路线
// @Produce json
// @Param limit query int false "数量限制"
// @Success 200 {array} model.SavedRoute
// @Router /api/v1/flight/routes/public [get]
func (h *Handler) ListPublicRoutes(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	routes, err := h.flightService.ListPublicRoutes(limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, routes)
}

// GetRouteDetail 获取路线详情
// @Summary 获取路线详情
// @Tags 飞行监控-路线
// @Produce json
// @Param id path int true "路线ID"
// @Success 200 {object} model.SavedRoute
// @Router /api/v1/flight/route/{id} [get]
func (h *Handler) GetRouteDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的路线ID"})
		return
	}

	route, err := h.flightService.GetSavedRouteByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "路线不存在"})
		return
	}

	c.JSON(http.StatusOK, route)
}

// FindNearbyRoutes 查找附近路线
// @Summary 查找附近路线
// @Tags 飞行监控-路线
// @Produce json
// @Param lat query number true "纬度"
// @Param lng query number true "经度"
// @Param radius query number false "搜索半径(km)"
// @Success 200 {array} model.SavedRoute
// @Router /api/v1/flight/routes/nearby [get]
func (h *Handler) FindNearbyRoutes(c *gin.Context) {
	lat, _ := strconv.ParseFloat(c.Query("lat"), 64)
	lng, _ := strconv.ParseFloat(c.Query("lng"), 64)
	radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "10"), 64)

	if lat == 0 || lng == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供有效的经纬度"})
		return
	}

	routes, err := h.flightService.FindNearbyRoutes(lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, routes)
}

// UseRoute 使用路线
// @Summary 使用路线
// @Tags 飞行监控-路线
// @Produce json
// @Param id path int true "路线ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/route/{id}/use [post]
func (h *Handler) UseRoute(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的路线ID"})
		return
	}

	if err := h.flightService.UseRoute(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已记录使用"})
}

// RateRoute 评价路线
// @Summary 评价路线
// @Tags 飞行监控-路线
// @Accept json
// @Produce json
// @Param id path int true "路线ID"
// @Param body body map[string]float64 true "评分"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/route/{id}/rate [post]
func (h *Handler) RateRoute(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的路线ID"})
		return
	}

	var req struct {
		Rating float64 `json:"rating" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if err := h.flightService.RateRoute(id, req.Rating); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "评价成功"})
}

// DeleteRoute 删除路线
// @Summary 删除路线
// @Tags 飞行监控-路线
// @Produce json
// @Param id path int true "路线ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/route/{id} [delete]
func (h *Handler) DeleteRoute(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的路线ID"})
		return
	}

	if err := h.flightService.DeleteSavedRoute(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "路线已删除"})
}

// ==================== 多点任务 ====================

// CreateMultiPointTask 创建多点任务
// @Summary 创建多点任务
// @Tags 飞行监控-多点任务
// @Accept json
// @Produce json
// @Param body body service.CreateMultiPointTaskRequest true "任务信息"
// @Success 200 {object} model.MultiPointTask
// @Router /api/v1/flight/multipoint-task [post]
func (h *Handler) CreateMultiPointTask(c *gin.Context) {
	var req service.CreateMultiPointTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	task, err := h.flightService.CreateMultiPointTask(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

// GetMultiPointTask 获取多点任务详情
// @Summary 获取多点任务详情
// @Tags 飞行监控-多点任务
// @Produce json
// @Param id path int true "任务ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/{id} [get]
func (h *Handler) GetMultiPointTask(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的任务ID"})
		return
	}

	task, stops, err := h.flightService.GetMultiPointTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task":  task,
		"stops": stops,
	})
}

// GetMultiPointTaskByOrder 根据订单获取多点任务
// @Summary 根据订单获取多点任务
// @Tags 飞行监控-多点任务
// @Produce json
// @Param order_id path int true "订单ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/order/{order_id} [get]
func (h *Handler) GetMultiPointTaskByOrder(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	task, stops, err := h.flightService.GetMultiPointTaskByOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task":  task,
		"stops": stops,
	})
}

// StartMultiPointTask 开始多点任务
// @Summary 开始多点任务
// @Tags 飞行监控-多点任务
// @Produce json
// @Param id path int true "任务ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/{id}/start [post]
func (h *Handler) StartMultiPointTask(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的任务ID"})
		return
	}

	if err := h.flightService.StartMultiPointTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "任务已开始"})
}

// ArriveAtStop 到达站点
// @Summary 到达站点
// @Tags 飞行监控-多点任务
// @Produce json
// @Param stop_id path int true "站点ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/stop/{stop_id}/arrive [post]
func (h *Handler) ArriveAtStop(c *gin.Context) {
	stopID, _ := strconv.ParseInt(c.Param("stop_id"), 10, 64)
	if stopID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的站点ID"})
		return
	}

	if err := h.flightService.ArriveAtStop(stopID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已到达站点"})
}

// CompleteStopRequest 完成站点请求
type CompleteStopRequest struct {
	Photos      []string `json:"photos"`
	Signature   string   `json:"signature"`
	ConfirmedBy string   `json:"confirmed_by"`
}

// CompleteStop 完成站点
// @Summary 完成站点
// @Tags 飞行监控-多点任务
// @Accept json
// @Produce json
// @Param stop_id path int true "站点ID"
// @Param body body CompleteStopRequest true "完成信息"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/stop/{stop_id}/complete [post]
func (h *Handler) CompleteStop(c *gin.Context) {
	stopID, _ := strconv.ParseInt(c.Param("stop_id"), 10, 64)
	if stopID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的站点ID"})
		return
	}

	var req CompleteStopRequest
	c.ShouldBindJSON(&req)

	if err := h.flightService.CompleteStop(stopID, req.Photos, req.Signature, req.ConfirmedBy); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "站点已完成"})
}

// SkipStop 跳过站点
// @Summary 跳过站点
// @Tags 飞行监控-多点任务
// @Accept json
// @Produce json
// @Param stop_id path int true "站点ID"
// @Param body body map[string]string true "跳过原因"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/stop/{stop_id}/skip [post]
func (h *Handler) SkipStop(c *gin.Context) {
	stopID, _ := strconv.ParseInt(c.Param("stop_id"), 10, 64)
	if stopID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的站点ID"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	if err := h.flightService.SkipStop(stopID, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "站点已跳过"})
}

// NextStop 前进到下一站点
// @Summary 前进到下一站点
// @Tags 飞行监控-多点任务
// @Produce json
// @Param id path int true "任务ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/multipoint-task/{id}/next [post]
func (h *Handler) NextStop(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的任务ID"})
		return
	}

	nextStop, err := h.flightService.AdvanceToNextStop(id)
	if err != nil {
		// 可能是任务已完成
		c.JSON(http.StatusOK, gin.H{
			"message":   "任务已完成或无下一站点",
			"completed": true,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"next_stop": nextStop,
		"completed": false,
	})
}

// ==================== 飞行统计 ====================

// GetFlightStats 获取飞行统计
// @Summary 获取飞行统计
// @Tags 飞行监控
// @Produce json
// @Param order_id path int true "订单ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/flight/stats/{order_id} [get]
func (h *Handler) GetFlightStats(c *gin.Context) {
	orderID, _ := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if orderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	stats, err := h.flightService.GetFlightStats(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
