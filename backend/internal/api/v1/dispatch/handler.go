package dispatch

import (
	"net/http"
	"strconv"
	"time"
	"wurenji-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	dispatchService *service.DispatchService
	clientService   *service.ClientService
	pilotService    *service.PilotService
}

func NewHandler(dispatchService *service.DispatchService, clientService *service.ClientService, pilotService *service.PilotService) *Handler {
	return &Handler{
		dispatchService: dispatchService,
		clientService:   clientService,
		pilotService:    pilotService,
	}
}

// ==================== 业主端接口 ====================

// CreateTask 创建派单任务
// POST /api/v1/dispatch/task
func (h *Handler) CreateTask(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取客户档案
	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为业主"})
		return
	}

	var req struct {
		TaskType             string  `json:"task_type"`
		Priority             int     `json:"priority"`
		CargoWeight          float64 `json:"cargo_weight" binding:"required"`
		CargoVolume          float64 `json:"cargo_volume"`
		CargoCategory        string  `json:"cargo_category"`
		IsHazardous          bool    `json:"is_hazardous"`
		PickupLatitude       float64 `json:"pickup_latitude" binding:"required"`
		PickupLongitude      float64 `json:"pickup_longitude" binding:"required"`
		PickupAddress        string  `json:"pickup_address" binding:"required"`
		DeliveryLatitude     float64 `json:"delivery_latitude" binding:"required"`
		DeliveryLongitude    float64 `json:"delivery_longitude" binding:"required"`
		DeliveryAddress      string  `json:"delivery_address" binding:"required"`
		RequiredPickupTime   string  `json:"required_pickup_time"`
		RequiredDeliveryTime string  `json:"required_delivery_time"`
		BudgetMin            int64   `json:"budget_min"`
		BudgetMax            int64   `json:"budget_max"`
		OfferedPrice         int64   `json:"offered_price"`
		RequiredLicenseType  string  `json:"required_license_type"`
		MinPilotRating       float64 `json:"min_pilot_rating"`
		MinDroneRating       float64 `json:"min_drone_rating"`
		MinCreditScore       int     `json:"min_credit_score"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 设置默认值
	if req.TaskType == "" {
		req.TaskType = "instant"
	}
	if req.Priority == 0 {
		req.Priority = 5
	}

	// 解析时间
	var pickupTime, deliveryTime *time.Time
	if req.RequiredPickupTime != "" {
		if t, err := time.Parse(time.RFC3339, req.RequiredPickupTime); err == nil {
			pickupTime = &t
		}
	}
	if req.RequiredDeliveryTime != "" {
		if t, err := time.Parse(time.RFC3339, req.RequiredDeliveryTime); err == nil {
			deliveryTime = &t
		}
	}

	taskReq := &service.CreateTaskRequest{
		TaskType:             req.TaskType,
		Priority:             req.Priority,
		CargoWeight:          req.CargoWeight,
		CargoVolume:          req.CargoVolume,
		CargoCategory:        req.CargoCategory,
		IsHazardous:          req.IsHazardous,
		PickupLatitude:       req.PickupLatitude,
		PickupLongitude:      req.PickupLongitude,
		PickupAddress:        req.PickupAddress,
		DeliveryLatitude:     req.DeliveryLatitude,
		DeliveryLongitude:    req.DeliveryLongitude,
		DeliveryAddress:      req.DeliveryAddress,
		RequiredPickupTime:   pickupTime,
		RequiredDeliveryTime: deliveryTime,
		BudgetMin:            req.BudgetMin,
		BudgetMax:            req.BudgetMax,
		OfferedPrice:         req.OfferedPrice,
		RequiredLicenseType:  req.RequiredLicenseType,
		MinPilotRating:       req.MinPilotRating,
		MinDroneRating:       req.MinDroneRating,
		MinCreditScore:       req.MinCreditScore,
	}

	task, err := h.dispatchService.CreateTask(client.ID, taskReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

// GetTask 获取任务详情
// GET /api/v1/dispatch/task/:id
func (h *Handler) GetTask(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	task, err := h.dispatchService.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

// GetTaskByNo 根据任务编号获取任务
// GET /api/v1/dispatch/task/no/:taskNo
func (h *Handler) GetTaskByNo(c *gin.Context) {
	taskNo := c.Param("taskNo")
	if taskNo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "任务编号不能为空"})
		return
	}

	task, err := h.dispatchService.GetTaskByNo(taskNo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

// ListClientTasks 获取业主的任务列表
// GET /api/v1/dispatch/tasks/client
func (h *Handler) ListClientTasks(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为业主"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	tasks, total, err := h.dispatchService.ListClientTasks(client.ID, page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      tasks,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// CancelTask 取消任务
// POST /api/v1/dispatch/task/:id/cancel
func (h *Handler) CancelTask(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	client, err := h.clientService.GetProfile(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为业主"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	if err := h.dispatchService.CancelTask(id, client.ID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "任务已取消"})
}

// GetCandidates 获取任务候选人
// GET /api/v1/dispatch/task/:id/candidates
func (h *Handler) GetCandidates(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	candidates, err := h.dispatchService.GetCandidates(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": candidates})
}

// GetTaskLogs 获取任务日志
// GET /api/v1/dispatch/task/:id/logs
func (h *Handler) GetTaskLogs(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	logs, err := h.dispatchService.GetTaskLogs(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// ==================== 飞手端接口 ====================

// ListPilotTasks 获取飞手的任务列表
// GET /api/v1/dispatch/tasks/pilot
func (h *Handler) ListPilotTasks(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为飞手"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	tasks, total, err := h.dispatchService.ListPilotTasks(pilot.ID, page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      tasks,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetPendingTask 获取飞手待处理的任务
// GET /api/v1/dispatch/task/pending
func (h *Handler) GetPendingTask(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为飞手"})
		return
	}

	candidate, err := h.dispatchService.GetPendingTaskForPilot(pilot.ID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil, "message": "暂无待处理任务"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": candidate})
}

// AcceptTask 接受任务
// POST /api/v1/dispatch/candidate/:id/accept
func (h *Handler) AcceptTask(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为飞手"})
		return
	}

	if err := h.dispatchService.AcceptTask(id, pilot.ID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已接受任务"})
}

// RejectTask 拒绝任务
// POST /api/v1/dispatch/candidate/:id/reject
func (h *Handler) RejectTask(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为飞手"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	if err := h.dispatchService.RejectTask(id, pilot.ID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "已拒绝任务"})
}

// ==================== 管理员接口 ====================

// ManualMatch 手动触发匹配
// POST /api/v1/dispatch/task/:id/match
func (h *Handler) ManualMatch(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	candidates, err := h.dispatchService.MatchTask(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "匹配完成",
		"candidates": candidates,
	})
}

// ProcessPendingTasks 处理待派单任务
// POST /api/v1/dispatch/admin/process
func (h *Handler) ProcessPendingTasks(c *gin.Context) {
	if err := h.dispatchService.ProcessPendingTasks(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "处理完成"})
}

// HandleExpiredTasks 处理过期任务
// POST /api/v1/dispatch/admin/handle-expired
func (h *Handler) HandleExpiredTasks(c *gin.Context) {
	if err := h.dispatchService.HandleExpiredTasks(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "处理完成"})
}
