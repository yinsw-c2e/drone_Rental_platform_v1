package payment

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	paymentService *service.PaymentService
}

func NewHandler(paymentService *service.PaymentService) *Handler {
	return &Handler{paymentService: paymentService}
}

type CreatePaymentReq struct {
	OrderID int64  `json:"order_id" binding:"required"`
	Method  string `json:"method" binding:"required"` // wechat, alipay, mock
}

func (h *Handler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req CreatePaymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	p, result, err := h.paymentService.CreatePayment(req.OrderID, userID, req.Method)
	if err != nil {
		response.Error(c, response.CodePaymentError, err.Error())
		return
	}
	response.Success(c, gin.H{
		"payment":    p,
		"pay_params": result,
	})
}

func (h *Handler) MockCallback(c *gin.Context) {
	var req struct {
		PaymentNo string `json:"payment_no" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.paymentService.MockPaymentComplete(req.PaymentNo); err != nil {
		response.Error(c, response.CodePaymentError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) WechatNotify(c *gin.Context) {
	// In production, parse WeChat callback XML/JSON and verify signature
	var req struct {
		PaymentNo    string `json:"payment_no"`
		ThirdPartyNo string `json:"third_party_no"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(200, "FAIL")
		return
	}
	h.paymentService.HandlePaymentCallback(req.PaymentNo, req.ThirdPartyNo)
	c.String(200, "SUCCESS")
}

func (h *Handler) AlipayNotify(c *gin.Context) {
	// In production, parse Alipay callback and verify signature
	var req struct {
		PaymentNo    string `json:"payment_no"`
		ThirdPartyNo string `json:"third_party_no"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(200, "fail")
		return
	}
	h.paymentService.HandlePaymentCallback(req.PaymentNo, req.ThirdPartyNo)
	c.String(200, "success")
}

func (h *Handler) GetStatus(c *gin.Context) {
	paymentNo := c.Param("id")
	p, err := h.paymentService.GetPaymentStatus(paymentNo)
	if err != nil {
		response.Error(c, response.CodeNotFound, "支付记录不存在")
		return
	}
	response.Success(c, p)
}

func (h *Handler) Refund(c *gin.Context) {
	userID := middleware.GetUserID(c)
	orderID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.paymentService.RefundPayment(orderID, userID); err != nil {
		response.Error(c, response.CodePaymentError, err.Error())
		return
	}
	response.Success(c, nil)
}

func (h *Handler) History(c *gin.Context) {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	payments, total, err := h.paymentService.ListByUser(userID, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, payments, total, page, pageSize)
}
