package admin

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	userService    *service.UserService
	droneService   *service.DroneService
	orderService   *service.OrderService
	paymentService *service.PaymentService
}

func NewHandler(userService *service.UserService, droneService *service.DroneService, orderService *service.OrderService, paymentService *service.PaymentService) *Handler {
	return &Handler{
		userService:    userService,
		droneService:   droneService,
		orderService:   orderService,
		paymentService: paymentService,
	}
}

func (h *Handler) Dashboard(c *gin.Context) {
	stats, _ := h.orderService.GetStatistics()
	_, userTotal, _ := h.userService.ListUsers(1, 1, nil)
	_, droneTotal, _ := h.droneService.List(1, 1, nil)

	response.Success(c, gin.H{
		"order_stats": stats,
		"user_total":  userTotal,
		"drone_total": droneTotal,
	})
}

func (h *Handler) UserList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if ut := c.Query("user_type"); ut != "" {
		filters["user_type"] = ut
	}
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	users, total, err := h.userService.ListUsers(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, users, total, page, pageSize)
}

func (h *Handler) UpdateUserStatus(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.userService.UpdateUserStatus(id, req.Status); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) ApproveIDVerification(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.userService.ApproveIDVerification(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) DroneList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if cs := c.Query("certification_status"); cs != "" {
		filters["certification_status"] = cs
	}
	drones, total, err := h.droneService.List(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, drones, total, page, pageSize)
}

func (h *Handler) ApproveDroneCertification(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Approved bool `json:"approved"`
	}
	c.ShouldBindJSON(&req)
	if err := h.droneService.ApproveCertification(id, req.Approved); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) OrderList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	filters := make(map[string]interface{})
	if status := c.Query("status"); status != "" {
		filters["status"] = status
	}
	orders, total, err := h.orderService.AdminListOrders(page, pageSize, filters)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, orders, total, page, pageSize)
}

func (h *Handler) PaymentList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	payments, total, err := h.paymentService.AdminList(page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, payments, total, page, pageSize)
}
