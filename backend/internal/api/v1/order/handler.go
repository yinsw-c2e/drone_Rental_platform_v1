package order

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	orderService *service.OrderService
}

func NewHandler(orderService *service.OrderService) *Handler {
	return &Handler{orderService: orderService}
}

func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req service.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	req.RenterID = userID
	order, err := h.orderService.CreateOrder(&req)
	if err != nil {
		response.Error(c, response.CodeOrderError, err.Error())
		return
	}
	response.Success(c, order)
}

func (h *Handler) GetByID(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	order, err := h.orderService.GetOrder(id)
	if err != nil {
		response.Error(c, response.CodeNotFound, "订单不存在")
		return
	}
	response.Success(c, order)
}

func (h *Handler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	role := c.DefaultQuery("role", "renter")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	orders, total, err := h.orderService.ListOrders(userID, role, status, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, orders, total, page, pageSize)
}

func (h *Handler) Accept(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.orderService.AcceptOrder(id, userID); err != nil {
		response.Error(c, response.CodeOrderError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) Reject(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)
	if err := h.orderService.RejectOrder(id, userID, req.Reason); err != nil {
		response.Error(c, response.CodeOrderError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) Cancel(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)
	role := middleware.GetUserType(c)
	if err := h.orderService.CancelOrder(id, userID, req.Reason, role); err != nil {
		response.Error(c, response.CodeOrderError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) Start(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.orderService.StartOrder(id, userID); err != nil {
		response.Error(c, response.CodeOrderError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) Complete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	role := middleware.GetUserType(c)
	if err := h.orderService.CompleteOrder(id, userID, role); err != nil {
		response.Error(c, response.CodeOrderError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) GetTimeline(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	timelines, err := h.orderService.GetTimeline(id)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, timelines)
}
