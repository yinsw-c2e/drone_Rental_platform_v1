package payment

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
	orderService   *service.OrderService
	paymentService *service.PaymentService
}

func NewHandler(orderService *service.OrderService, paymentService *service.PaymentService) *Handler {
	return &Handler{
		orderService:   orderService,
		paymentService: paymentService,
	}
}

func (h *Handler) CreateOrderPayment(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, "client"); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	var req struct {
		Method string `json:"method" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid payment payload")
		return
	}

	paymentRecord, payParams, err := h.paymentService.CreatePayment(orderID, userID, req.Method)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	data := gin.H{
		"payment":    buildPaymentSummary(paymentRecord),
		"pay_params": payParams,
	}
	if req.Method == "mock" {
		if err := h.paymentService.MockPaymentComplete(paymentRecord.PaymentNo); err != nil {
			v2common.HandleServiceError(c, err)
			return
		}
		if latestPayment, err := h.paymentService.GetPaymentStatus(paymentRecord.PaymentNo); err == nil && latestPayment != nil {
			data["payment"] = buildPaymentSummary(latestPayment)
		}
		if order, err := h.orderService.GetAuthorizedOrder(orderID, userID, "client"); err == nil && order != nil {
			data["order"] = gin.H{
				"id":             order.ID,
				"order_no":       order.OrderNo,
				"status":         order.Status,
				"execution_mode": order.ExecutionMode,
				"needs_dispatch": order.NeedsDispatch,
				"paid_at":        order.PaidAt,
			}
		}
	}

	response.V2Success(c, data)
}

func (h *Handler) ListOrderPayments(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	payments, err := h.orderService.ListPaymentsByOrder(orderID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(payments))
	for i := range payments {
		items = append(items, buildPaymentSummary(&payments[i]))
	}
	response.V2Success(c, gin.H{"items": items})
}

func (h *Handler) ListOrderRefunds(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, ""); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	refunds, err := h.orderService.ListRefundsByOrder(orderID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(refunds))
	for i := range refunds {
		items = append(items, buildRefundSummary(&refunds[i]))
	}
	response.V2Success(c, gin.H{"items": items})
}

func (h *Handler) RefundOrder(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	orderID, ok := parseOrderID(c)
	if !ok {
		return
	}
	if _, err := h.orderService.GetAuthorizedOrder(orderID, userID, "client"); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	if err := h.paymentService.RefundPayment(orderID, userID); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	refunds, err := h.orderService.ListRefundsByOrder(orderID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	items := make([]gin.H, 0, len(refunds))
	for i := range refunds {
		items = append(items, buildRefundSummary(&refunds[i]))
	}
	response.V2Success(c, gin.H{"items": items})
}

func parseOrderID(c *gin.Context) (int64, bool) {
	orderID, err := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if err != nil || orderID <= 0 {
		response.V2ValidationError(c, "invalid order_id")
		return 0, false
	}
	return orderID, true
}

func buildPaymentSummary(payment *model.Payment) gin.H {
	if payment == nil {
		return nil
	}
	return gin.H{
		"id":             payment.ID,
		"payment_no":     payment.PaymentNo,
		"order_id":       payment.OrderID,
		"user_id":        payment.UserID,
		"payment_type":   payment.PaymentType,
		"payment_method": payment.PaymentMethod,
		"amount":         payment.Amount,
		"status":         payment.Status,
		"third_party_no": payment.ThirdPartyNo,
		"paid_at":        payment.PaidAt,
		"created_at":     payment.CreatedAt,
		"updated_at":     payment.UpdatedAt,
	}
}

func buildRefundSummary(refund *model.Refund) gin.H {
	if refund == nil {
		return nil
	}
	return gin.H{
		"id":         refund.ID,
		"refund_no":  refund.RefundNo,
		"payment_id": refund.PaymentID,
		"amount":     refund.Amount,
		"reason":     refund.Reason,
		"status":     refund.Status,
		"created_at": refund.CreatedAt,
		"updated_at": refund.UpdatedAt,
	}
}
