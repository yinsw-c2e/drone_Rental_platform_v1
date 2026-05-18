package airspace

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/service"
)

type Handler struct {
	airspaceService *service.AirspaceService
}

func NewHandler(airspaceService *service.AirspaceService) *Handler {
	return &Handler{airspaceService: airspaceService}
}

func getUserID(c *gin.Context) int64 {
	uid, _ := c.Get("user_id")
	switch v := uid.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	}
	return 0
}

// ========== Airspace Applications ==========

// CreateApplication 创建空域申请
func (h *Handler) CreateApplication(c *gin.Context) {
	var req model.AirspaceApplication
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// PilotID should come from the authenticated user's pilot record
	// For now, accept from request body
	if req.PilotID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "飞手ID不能为空"})
		return
	}

	if err := h.airspaceService.CreateApplication(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "申请创建成功", "data": req})
}

// GetApplication 获取空域申请详情
func (h *Handler) GetApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	app, err := h.airspaceService.GetApplication(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "申请不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": app})
}

// GetApplicationByOrder 根据订单获取空域申请
func (h *Handler) GetApplicationByOrder(c *gin.Context) {
	orderID, err := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的订单ID"})
		return
	}

	app, err := h.airspaceService.GetApplicationByOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "未找到关联的空域申请"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": app})
}

// ListMyApplications 获取飞手的空域申请列表
func (h *Handler) ListMyApplications(c *gin.Context) {
	pilotID, err := strconv.ParseInt(c.Query("pilot_id"), 10, 64)
	if err != nil || pilotID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少飞手ID"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	apps, total, err := h.airspaceService.ListPilotApplications(pilotID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": apps, "total": total, "page": page, "page_size": pageSize})
}

// SubmitForReview 提交空域申请审核
func (h *Handler) SubmitForReview(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}
	var req struct {
		PilotID int64 `json:"pilot_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if err := h.airspaceService.SubmitForReview(id, req.PilotID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已提交审核"})
}

// CancelApplication 取消空域申请
func (h *Handler) CancelApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}
	var req struct {
		PilotID int64 `json:"pilot_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if err := h.airspaceService.CancelApplication(id, req.PilotID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "申请已取消"})
}

// SubmitToUOM 提交到UOM平台
func (h *Handler) SubmitToUOM(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.airspaceService.SubmitToUOM(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已提交UOM平台"})
}

// ReviewApplication 管理员审核空域申请
func (h *Handler) ReviewApplication(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}
	adminID := getUserID(c)

	var req struct {
		Approved bool   `json:"approved"`
		Notes    string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	if err := h.airspaceService.ReviewApplication(id, adminID, req.Approved, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "审核完成"})
}

// ListPendingReview 获取待审核申请列表
func (h *Handler) ListPendingReview(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	apps, total, err := h.airspaceService.ListPendingReview(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": apps, "total": total, "page": page, "page_size": pageSize})
}

// ========== No-Fly Zones ==========

// ListNoFlyZones 获取禁飞区列表
func (h *Handler) ListNoFlyZones(c *gin.Context) {
	zoneType := c.Query("zone_type")
	status := c.DefaultQuery("status", "active")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	zones, total, err := h.airspaceService.ListNoFlyZones(zoneType, status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": zones, "total": total, "page": page, "page_size": pageSize})
}

// GetNoFlyZone 获取禁飞区详情
func (h *Handler) GetNoFlyZone(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	zone, err := h.airspaceService.GetNoFlyZone(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "禁飞区不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": zone})
}

// FindNearbyNoFlyZones 查找附近禁飞区
func (h *Handler) FindNearbyNoFlyZones(c *gin.Context) {
	lat, err := strconv.ParseFloat(c.Query("latitude"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的纬度"})
		return
	}
	lng, err := strconv.ParseFloat(c.Query("longitude"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的经度"})
		return
	}
	radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "50000"), 64)

	zones, err := h.airspaceService.FindNearbyNoFlyZones(lat, lng, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": zones})
}

// CheckAirspaceAvailability 检查空域可用性
func (h *Handler) CheckAirspaceAvailability(c *gin.Context) {
	lat, err := strconv.ParseFloat(c.Query("latitude"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的纬度"})
		return
	}
	lng, err := strconv.ParseFloat(c.Query("longitude"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的经度"})
		return
	}
	altitude, _ := strconv.Atoi(c.DefaultQuery("altitude", "120"))

	result, err := h.airspaceService.CheckAirspaceAvailability(lat, lng, altitude)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// CreateNoFlyZone 创建禁飞区（管理员）
func (h *Handler) CreateNoFlyZone(c *gin.Context) {
	var zone model.NoFlyZone
	if err := c.ShouldBindJSON(&zone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	if err := h.airspaceService.CreateNoFlyZone(&zone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "禁飞区创建成功", "data": zone})
}

// DeleteNoFlyZone 删除禁飞区（管理员）
func (h *Handler) DeleteNoFlyZone(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.airspaceService.DeleteNoFlyZone(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "禁飞区已删除"})
}

// ========== Compliance Check ==========

// RunComplianceCheck 执行合规性检查
func (h *Handler) RunComplianceCheck(c *gin.Context) {
	var req struct {
		PilotID               int64  `json:"pilot_id" binding:"required"`
		DroneID               int64  `json:"drone_id" binding:"required"`
		OrderID               int64  `json:"order_id"`
		AirspaceApplicationID int64  `json:"airspace_application_id"`
		TriggerType           string `json:"trigger_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	triggerType := req.TriggerType
	if triggerType == "" {
		triggerType = "manual"
	}

	check, err := h.airspaceService.RunComplianceCheck(req.PilotID, req.DroneID, req.OrderID, req.AirspaceApplicationID, triggerType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": check})
}

// GetComplianceCheck 获取合规检查详情
func (h *Handler) GetComplianceCheck(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	check, err := h.airspaceService.GetComplianceCheck(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "检查记录不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": check})
}

// ListComplianceChecks 获取合规检查列表
func (h *Handler) ListComplianceChecks(c *gin.Context) {
	pilotID, _ := strconv.ParseInt(c.Query("pilot_id"), 10, 64)
	droneID, _ := strconv.ParseInt(c.Query("drone_id"), 10, 64)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	checks, total, err := h.airspaceService.ListComplianceChecks(pilotID, droneID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": checks, "total": total, "page": page, "page_size": pageSize})
}

// GetLatestComplianceCheck 获取最新合规检查
func (h *Handler) GetLatestComplianceCheck(c *gin.Context) {
	pilotID, err := strconv.ParseInt(c.Query("pilot_id"), 10, 64)
	if err != nil || pilotID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少飞手ID"})
		return
	}
	droneID, err := strconv.ParseInt(c.Query("drone_id"), 10, 64)
	if err != nil || droneID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少无人机ID"})
		return
	}

	check, err := h.airspaceService.GetLatestComplianceCheck(pilotID, droneID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "暂无合规检查记录"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": check})
}
