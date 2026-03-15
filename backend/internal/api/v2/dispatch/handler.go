package dispatch

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	dispatchService *service.DispatchService
	orderService    *service.OrderService
}

func NewHandler(dispatchService *service.DispatchService, orderService *service.OrderService) *Handler {
	return &Handler{
		dispatchService: dispatchService,
		orderService:    orderService,
	}
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	role := c.DefaultQuery("role", "owner")
	status := c.Query("status")

	var (
		tasks []model.FormalDispatchTask
		total int64
		err   error
	)

	switch role {
	case "pilot":
		tasks, total, err = h.dispatchService.ListFormalTasksByPilot(userID, status, page, pageSize)
	default:
		tasks, total, err = h.dispatchService.ListFormalTasksByProvider(userID, status, page, pageSize)
	}
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(tasks))
	for i := range tasks {
		items = append(items, buildFormalTaskSummary(&tasks[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	dispatchID, ok := parseDispatchID(c)
	if !ok {
		return
	}

	task, err := h.dispatchService.GetFormalTask(dispatchID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	order, err := h.orderService.GetOrder(task.OrderID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	if !h.orderService.CanAccessOrder(order, userID, "") && task.TargetPilotUserID != userID {
		response.V2Forbidden(c, "无权查看该正式派单")
		return
	}
	logs, err := h.dispatchService.ListFormalLogs(dispatchID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"dispatch_task": buildFormalTaskSummary(task),
		"order":         buildFormalOrderSummary(order),
		"logs":          buildFormalLogList(logs),
	})
}

func (h *Handler) Reassign(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	dispatchID, ok := parseDispatchID(c)
	if !ok {
		return
	}

	currentTask, err := h.dispatchService.GetFormalTask(dispatchID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	var req struct {
		DispatchMode      string `json:"dispatch_mode" binding:"required"`
		TargetPilotUserID int64  `json:"target_pilot_user_id"`
		Reason            string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid dispatch reassign payload")
		return
	}

	task, err := h.dispatchService.ReassignFormalTask(dispatchID, userID, req.DispatchMode, req.TargetPilotUserID, req.Reason)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	order, err := h.orderService.GetAuthorizedOrder(currentTask.OrderID, userID, "owner")
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	response.V2Success(c, gin.H{
		"order": gin.H{
			"id":             order.ID,
			"order_no":       order.OrderNo,
			"status":         order.Status,
			"execution_mode": order.ExecutionMode,
		},
		"dispatch_task": gin.H{
			"id":                   nullableDispatchTaskID(task),
			"dispatch_no":          safeDispatchNo(task),
			"status":               safeDispatchStatus(task),
			"dispatch_source":      safeDispatchSource(task),
			"target_pilot_user_id": safeDispatchPilot(task),
		},
	})
}

func parseDispatchID(c *gin.Context) (int64, bool) {
	dispatchID, err := strconv.ParseInt(c.Param("dispatch_id"), 10, 64)
	if err != nil || dispatchID <= 0 {
		response.V2ValidationError(c, "invalid dispatch_id")
		return 0, false
	}
	return dispatchID, true
}

func buildFormalLogList(logs []model.FormalDispatchLog) []gin.H {
	items := make([]gin.H, 0, len(logs))
	for i := range logs {
		items = append(items, gin.H{
			"id":                logs[i].ID,
			"action_type":       logs[i].ActionType,
			"operator_user_id":  logs[i].OperatorUserID,
			"operator_nickname": safeUserNickname(logs[i].Operator),
			"note":              logs[i].Note,
			"created_at":        logs[i].CreatedAt,
		})
	}
	return items
}

func buildFormalTaskSummary(task *model.FormalDispatchTask) gin.H {
	if task == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                   task.ID,
		"dispatch_no":          task.DispatchNo,
		"order_id":             task.OrderID,
		"status":               task.Status,
		"dispatch_source":      task.DispatchSource,
		"target_pilot_user_id": task.TargetPilotUserID,
		"retry_count":          task.RetryCount,
		"reason":               task.Reason,
		"sent_at":              task.SentAt,
		"responded_at":         task.RespondedAt,
		"provider": gin.H{
			"user_id":    task.ProviderUserID,
			"nickname":   safeUserNickname(task.Provider),
			"avatar_url": safeUserAvatar(task.Provider),
		},
		"target_pilot": gin.H{
			"user_id":    task.TargetPilotUserID,
			"nickname":   safeUserNickname(task.TargetPilot),
			"avatar_url": safeUserAvatar(task.TargetPilot),
		},
		"order":      buildFormalOrderSummary(task.Order),
		"created_at": task.CreatedAt,
		"updated_at": task.UpdatedAt,
	}
}

func buildFormalOrderSummary(order *model.Order) gin.H {
	if order == nil {
		return gin.H{}
	}
	return gin.H{
		"id":              order.ID,
		"order_no":        order.OrderNo,
		"order_source":    order.OrderSource,
		"status":          order.Status,
		"needs_dispatch":  order.NeedsDispatch,
		"execution_mode":  order.ExecutionMode,
		"title":           order.Title,
		"service_type":    order.ServiceType,
		"service_address": order.ServiceAddress,
		"dest_address":    order.DestAddress,
		"total_amount":    order.TotalAmount,
		"created_at":      order.CreatedAt,
	}
}

func safeUserNickname(user *model.User) string {
	if user == nil {
		return ""
	}
	return user.Nickname
}

func safeUserAvatar(user *model.User) string {
	if user == nil {
		return ""
	}
	return user.AvatarURL
}

func nullableDispatchTaskID(task *model.FormalDispatchTask) interface{} {
	if task == nil {
		return nil
	}
	return task.ID
}

func safeDispatchNo(task *model.FormalDispatchTask) interface{} {
	if task == nil {
		return nil
	}
	return task.DispatchNo
}

func safeDispatchStatus(task *model.FormalDispatchTask) interface{} {
	if task == nil {
		return nil
	}
	return task.Status
}

func safeDispatchSource(task *model.FormalDispatchTask) interface{} {
	if task == nil {
		return nil
	}
	return task.DispatchSource
}

func safeDispatchPilot(task *model.FormalDispatchTask) interface{} {
	if task == nil {
		return nil
	}
	return task.TargetPilotUserID
}
