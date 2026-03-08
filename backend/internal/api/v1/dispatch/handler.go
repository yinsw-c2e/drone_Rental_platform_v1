package dispatch

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/repository"
	"wurenji-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	dispatchService *service.DispatchService
	clientService   *service.ClientService
	pilotService    *service.PilotService
	orderRepo       *repository.OrderRepo
}

func NewHandler(dispatchService *service.DispatchService, clientService *service.ClientService, pilotService *service.PilotService, orderRepo *repository.OrderRepo) *Handler {
	return &Handler{
		dispatchService: dispatchService,
		clientService:   clientService,
		pilotService:    pilotService,
		orderRepo:       orderRepo,
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

	response.Success(c, task)
}

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

	response.Success(c, task)
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

	response.Success(c, task)
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

	response.SuccessWithPage(c, tasks, total, page, pageSize)
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

	response.Success(c, "任务已取消")
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

	response.Success(c, candidates)
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

	response.Success(c, logs)
}

// ==================== 飞手端接口 ====================

// ListPilotTasks 获取飞手的任务列表（候选中的派单任务）
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

	list, total, err := h.dispatchService.ListCandidatesForPilot(pilot.ID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response.SuccessWithPage(c, list, total, page, pageSize)
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
		response.Success(c, nil)
		return
	}

	response.Success(c, candidate)
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

	// 接单后为此候选任务创建执行订单
	orderID, err := h.createOrderForAcceptedTask(id, pilot)
	if err != nil {
		log.Printf("[AcceptTask] 创建执行订单失败 candidateID=%d err=%v", id, err)
		// 创建订单失败不影响接单成功，但返回错误信息供前端重试
		response.Success(c, gin.H{"message": "已接受任务", "order_id": 0, "order_error": err.Error()})
		return
	}

	response.Success(c, gin.H{"message": "已接受任务", "order_id": orderID})
}

// createOrderForAcceptedTask 接单后创建执行订单
func (h *Handler) createOrderForAcceptedTask(candidateID int64, pilot *model.Pilot) (int64, error) {
	candidate, _ := h.dispatchService.GetCandidateByID(candidateID)
	if candidate == nil {
		return 0, fmt.Errorf("候选人记录不存在")
	}
	task, _ := h.dispatchService.GetTask(candidate.TaskID)
	if task == nil {
		return 0, fmt.Errorf("任务不存在")
	}

	// 检查是否已有关联订单（避免重复创建）
	existing, _, _ := h.orderRepo.List(1, 1, map[string]interface{}{"order_type": "dispatch", "related_id": task.ID})
	if len(existing) > 0 {
		return existing[0].ID, nil
	}

	now := time.Now()
	orderNo := fmt.Sprintf("DO%s%d", now.Format("20060102150405"), task.ID)
	order := &model.Order{
		OrderNo:          orderNo,
		OrderType:        "dispatch",
		RelatedID:        task.ID,
		DroneID:          candidate.DroneID,
		OwnerID:          candidate.OwnerID,
		PilotID:          pilot.ID,
		Title:            fmt.Sprintf("派单货运: %s → %s", task.PickupAddress, task.DeliveryAddress),
		ServiceType:      "cargo_delivery",
		StartTime:        now,
		EndTime:          now.Add(24 * time.Hour),
		ServiceLatitude:  task.PickupLatitude,
		ServiceLongitude: task.PickupLongitude,
		ServiceAddress:   task.PickupAddress,
		TotalAmount:      candidate.QuotedPrice,
		Status:           "confirmed",
	}
	if err := h.orderRepo.Create(order); err != nil {
		return 0, err
	}
	// 更新 dispatch_task 关联订单（related_id 已在 Order 创建时就设置）
	h.dispatchService.UpdateTaskOrderID(task.ID, order.ID)
	return order.ID, nil
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

	response.Success(c, "已拒绝任务")
}

// ==================== 飞手执行流程接口 ====================

// GetMyActiveOrder 获取飞手当前进行中的订单（接单后的执行订单）
// GET /api/v1/dispatch/order/active
func (h *Handler) GetMyActiveOrder(c *gin.Context) {
	userID := c.GetInt64("user_id")
	pilot, err := h.pilotService.GetByUserID(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册成为飞手"})
		return
	}
	orders, _, err := h.orderRepo.ListByPilot(pilot.ID, "", 1, 1)
	if err != nil || len(orders) == 0 {
		response.Success(c, nil)
		return
	}
	response.Success(c, orders[0])
}

// GetOrderByTaskID 根据派单任务ID获取订单
// GET /api/v1/dispatch/task/:id/order
func (h *Handler) GetOrderByTaskID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}
	existing, _, _ := h.orderRepo.List(1, 1, map[string]interface{}{"order_type": "dispatch", "related_id": id})
	if len(existing) == 0 {
		response.Success(c, nil)
		return
	}
	response.Success(c, existing[0])
}

// UpdateExecutionStatus 更新飞手执行状态
// POST /api/v1/dispatch/order/:id/status
func (h *Handler) UpdateExecutionStatus(c *gin.Context) {
	userID := c.GetInt64("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	orderID, err := strconv.ParseInt(c.Param("id"), 10, 64)
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
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 校验状态流转：confirmed -> airspace_applying -> loading -> in_transit -> delivered -> completed
	allowedStatuses := map[string]bool{
		"airspace_applying": true,
		"airspace_approved": true,
		"loading":           true,
		"in_transit":        true,
		"delivered":         true,
		"completed":         true,
	}
	if !allowedStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的状态值"})
		return
	}

	// 验证订单属于该飞手
	extra := map[string]interface{}{}
	now := time.Now()
	switch req.Status {
	case "loading":
		extra["airspace_status"] = "approved"
	case "in_transit":
		extra["loading_confirmed_at"] = now
		extra["flight_start_time"] = now
	case "delivered":
		extra["unloading_confirmed_at"] = now
		extra["flight_end_time"] = now
	}

	if err := h.orderRepo.UpdateStatusWithFields(orderID, pilot.ID, req.Status, extra); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response.Success(c, gin.H{"status": req.Status})
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

	// 通知最优候选人，让飞手可以看到接单任务
	h.dispatchService.NotifyTopCandidate(id) //nolint:errcheck

	response.Success(c, gin.H{"candidates": candidates})
}

// ProcessPendingTasks 处理待派单任务
// POST /api/v1/dispatch/admin/process
func (h *Handler) ProcessPendingTasks(c *gin.Context) {
	if err := h.dispatchService.ProcessPendingTasks(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response.Success(c, "处理完成")
}

// HandleExpiredTasks 处理过期任务
// POST /api/v1/dispatch/admin/handle-expired
func (h *Handler) HandleExpiredTasks(c *gin.Context) {
	if err := h.dispatchService.HandleExpiredTasks(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response.Success(c, "处理完成")
}
