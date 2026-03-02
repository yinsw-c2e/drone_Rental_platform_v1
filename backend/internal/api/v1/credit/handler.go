package credit

import (
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	creditService *service.CreditService
}

func NewHandler(creditService *service.CreditService) *Handler {
	return &Handler{creditService: creditService}
}

// ============================================================
// 信用分相关接口
// ============================================================

// GetMyCreditScore 获取当前用户信用分
// @Summary 获取我的信用分
// @Tags Credit
// @Success 200 {object} model.CreditScore
// @Router /api/v1/credit/my-score [get]
func (h *Handler) GetMyCreditScore(c *gin.Context) {
	userID, _ := c.Get("user_id")
	score, err := h.creditService.GetUserCreditScore(userID.(int64))
	if err != nil {
		response.Error(c, http.StatusNotFound, "未找到信用分记录")
		return
	}
	response.Success(c, score)
}

// GetUserCreditScore 获取指定用户信用分
// @Summary 获取用户信用分
// @Tags Credit
// @Param user_id path int true "用户ID"
// @Success 200 {object} model.CreditScore
// @Router /api/v1/credit/user/{user_id} [get]
func (h *Handler) GetUserCreditScore(c *gin.Context) {
	userID, _ := strconv.ParseInt(c.Param("user_id"), 10, 64)
	score, err := h.creditService.GetUserCreditScore(userID)
	if err != nil {
		response.Error(c, http.StatusNotFound, "未找到信用分记录")
		return
	}
	response.Success(c, score)
}

// ListCreditScores 列出信用分
// @Summary 列出信用分列表
// @Tags Credit
// @Param user_type query string false "用户类型"
// @Param score_level query string false "信用等级"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/scores [get]
func (h *Handler) ListCreditScores(c *gin.Context) {
	userType := c.Query("user_type")
	scoreLevel := c.Query("score_level")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	scores, total, err := h.creditService.ListCreditScores(userType, scoreLevel, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, scores, total, page, pageSize)
}

// GetMyCreditLogs 获取我的信用分变动记录
// @Summary 获取我的信用分变动记录
// @Tags Credit
// @Param change_type query string false "变动类型"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/my-logs [get]
func (h *Handler) GetMyCreditLogs(c *gin.Context) {
	userID, _ := c.Get("user_id")
	changeType := c.Query("change_type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	logs, total, err := h.creditService.ListCreditScoreLogs(userID.(int64), changeType, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, logs, total, page, pageSize)
}

// ============================================================
// 违规相关接口
// ============================================================

// GetMyViolations 获取我的违规记录
// @Summary 获取我的违规记录
// @Tags Violation
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/my-violations [get]
func (h *Handler) GetMyViolations(c *gin.Context) {
	userID, _ := c.Get("user_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	violations, total, err := h.creditService.ListViolations(userID.(int64), "", "", status, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, violations, total, page, pageSize)
}

// ListViolations 列出违规记录(管理员)
// @Summary 列出违规记录
// @Tags Violation
// @Param user_id query int false "用户ID"
// @Param violation_type query string false "违规类型"
// @Param violation_level query string false "违规等级"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/violations [get]
func (h *Handler) ListViolations(c *gin.Context) {
	userID, _ := strconv.ParseInt(c.Query("user_id"), 10, 64)
	violationType := c.Query("violation_type")
	violationLevel := c.Query("violation_level")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	violations, total, err := h.creditService.ListViolations(userID, violationType, violationLevel, status, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, violations, total, page, pageSize)
}

// GetViolationDetail 获取违规详情
// @Summary 获取违规详情
// @Tags Violation
// @Param id path int true "违规ID"
// @Success 200 {object} model.Violation
// @Router /api/v1/credit/violations/{id} [get]
func (h *Handler) GetViolationDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	violation, err := h.creditService.GetViolationByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "未找到违规记录")
		return
	}
	response.Success(c, violation)
}

// CreateViolationRequest 创建违规请求
type CreateViolationRequest struct {
	UserID         int64  `json:"user_id" binding:"required"`
	OrderID        int64  `json:"order_id"`
	ViolationType  string `json:"violation_type" binding:"required"`
	ViolationLevel string `json:"violation_level" binding:"required"`
	Description    string `json:"description" binding:"required"`
	Evidence       string `json:"evidence"`
}

// CreateViolation 创建违规记录
// @Summary 创建违规记录
// @Tags Violation
// @Param body body CreateViolationRequest true "违规信息"
// @Success 200 {object} model.Violation
// @Router /api/v1/credit/violations [post]
func (h *Handler) CreateViolation(c *gin.Context) {
	var req CreateViolationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	violation := &model.Violation{
		UserID:         req.UserID,
		OrderID:        req.OrderID,
		ViolationType:  req.ViolationType,
		ViolationLevel: req.ViolationLevel,
		Description:    req.Description,
		Evidence:       req.Evidence,
	}

	if err := h.creditService.CreateViolation(violation); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, violation)
}

// ConfirmViolation 确认违规
// @Summary 确认违规并执行处罚
// @Tags Violation
// @Param id path int true "违规ID"
// @Success 200 {string} string "success"
// @Router /api/v1/credit/violations/{id}/confirm [post]
func (h *Handler) ConfirmViolation(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	adminID, _ := c.Get("user_id")

	if err := h.creditService.ConfirmViolation(id, adminID.(int64)); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "违规已确认")
}

// AppealRequest 申诉请求
type AppealRequest struct {
	Content string `json:"content" binding:"required"`
}

// SubmitAppeal 提交申诉
// @Summary 提交违规申诉
// @Tags Violation
// @Param id path int true "违规ID"
// @Param body body AppealRequest true "申诉内容"
// @Success 200 {string} string "success"
// @Router /api/v1/credit/violations/{id}/appeal [post]
func (h *Handler) SubmitAppeal(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req AppealRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.creditService.SubmitAppeal(id, req.Content); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "申诉已提交")
}

// ReviewAppealRequest 审核申诉请求
type ReviewAppealRequest struct {
	Approved bool   `json:"approved"`
	Result   string `json:"result" binding:"required"`
}

// ReviewAppeal 审核申诉
// @Summary 审核违规申诉
// @Tags Violation
// @Param id path int true "违规ID"
// @Param body body ReviewAppealRequest true "审核结果"
// @Success 200 {string} string "success"
// @Router /api/v1/credit/violations/{id}/review-appeal [post]
func (h *Handler) ReviewAppeal(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	adminID, _ := c.Get("user_id")
	var req ReviewAppealRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.creditService.ReviewAppeal(id, req.Approved, adminID.(int64), req.Result); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "申诉已审核")
}

// ============================================================
// 风控相关接口
// ============================================================

// ListRiskControls 列出风控记录
// @Summary 列出风控记录
// @Tags RiskControl
// @Param user_id query int false "用户ID"
// @Param risk_phase query string false "风控阶段"
// @Param risk_type query string false "风控类型"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/risks [get]
func (h *Handler) ListRiskControls(c *gin.Context) {
	userID, _ := strconv.ParseInt(c.Query("user_id"), 10, 64)
	riskPhase := c.Query("risk_phase")
	riskType := c.Query("risk_type")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	risks, total, err := h.creditService.ListRiskControls(userID, riskPhase, riskType, status, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, risks, total, page, pageSize)
}

// GetRiskControlDetail 获取风控详情
// @Summary 获取风控详情
// @Tags RiskControl
// @Param id path int true "风控ID"
// @Success 200 {object} model.RiskControl
// @Router /api/v1/credit/risks/{id} [get]
func (h *Handler) GetRiskControlDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	risk, err := h.creditService.GetRiskControlByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "未找到风控记录")
		return
	}
	response.Success(c, risk)
}

// PreOrderRiskCheck 订单前风控检查
// @Summary 订单前风控检查
// @Tags RiskControl
// @Param user_id query int true "用户ID"
// @Param order_id query int false "订单ID"
// @Success 200 {object} model.RiskControl
// @Router /api/v1/credit/risk-check [get]
func (h *Handler) PreOrderRiskCheck(c *gin.Context) {
	userID, _ := strconv.ParseInt(c.Query("user_id"), 10, 64)
	orderID, _ := strconv.ParseInt(c.Query("order_id"), 10, 64)

	risk, err := h.creditService.PreOrderRiskCheck(userID, orderID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	if risk == nil {
		response.Success(c, gin.H{"risk_detected": false, "message": "风控检查通过"})
		return
	}

	response.Success(c, gin.H{"risk_detected": true, "risk": risk})
}

// ReviewRiskRequest 审核风控请求
type ReviewRiskRequest struct {
	Action string `json:"action" binding:"required"`
	Notes  string `json:"notes"`
}

// ReviewRiskControl 审核风控
// @Summary 审核风控记录
// @Tags RiskControl
// @Param id path int true "风控ID"
// @Param body body ReviewRiskRequest true "审核信息"
// @Success 200 {string} string "success"
// @Router /api/v1/credit/risks/{id}/review [post]
func (h *Handler) ReviewRiskControl(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	adminID, _ := c.Get("user_id")
	var req ReviewRiskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.creditService.ReviewRiskControl(id, req.Action, adminID.(int64), req.Notes); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "风控已处理")
}

// ============================================================
// 黑名单相关接口
// ============================================================

// ListBlacklists 列出黑名单
// @Summary 列出黑名单
// @Tags Blacklist
// @Param blacklist_type query string false "黑名单类型"
// @Param is_active query bool false "是否生效"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/blacklists [get]
func (h *Handler) ListBlacklists(c *gin.Context) {
	blacklistType := c.Query("blacklist_type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var isActive *bool
	if activeStr := c.Query("is_active"); activeStr != "" {
		active := activeStr == "true"
		isActive = &active
	}

	blacklists, total, err := h.creditService.ListBlacklists(blacklistType, isActive, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, blacklists, total, page, pageSize)
}

// ============================================================
// 保证金相关接口
// ============================================================

// GetMyDeposit 获取我的保证金
// @Summary 获取我的保证金
// @Tags Deposit
// @Success 200 {object} model.Deposit
// @Router /api/v1/credit/my-deposit [get]
func (h *Handler) GetMyDeposit(c *gin.Context) {
	userID, _ := c.Get("user_id")
	deposit, err := h.creditService.GetDepositByUserID(userID.(int64))
	if err != nil {
		response.Error(c, http.StatusNotFound, "未找到保证金记录")
		return
	}
	response.Success(c, deposit)
}

// ListDeposits 列出保证金
// @Summary 列出保证金
// @Tags Deposit
// @Param user_type query string false "用户类型"
// @Param status query string false "状态"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/credit/deposits [get]
func (h *Handler) ListDeposits(c *gin.Context) {
	userType := c.Query("user_type")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	deposits, total, err := h.creditService.ListDeposits(userType, status, page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, deposits, total, page, pageSize)
}

// RequireDepositRequest 要求保证金请求
type RequireDepositRequest struct {
	UserID   int64  `json:"user_id" binding:"required"`
	UserType string `json:"user_type" binding:"required"`
	Amount   int64  `json:"amount" binding:"required"`
	Reason   string `json:"reason" binding:"required"`
}

// RequireDeposit 要求缴纳保证金
// @Summary 要求缴纳保证金
// @Tags Deposit
// @Param body body RequireDepositRequest true "保证金信息"
// @Success 200 {object} model.Deposit
// @Router /api/v1/credit/deposits [post]
func (h *Handler) RequireDeposit(c *gin.Context) {
	var req RequireDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	deposit, err := h.creditService.RequireDeposit(req.UserID, req.UserType, req.Amount, req.Reason)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, deposit)
}

// ============================================================
// 统计接口
// ============================================================

// GetCreditStatistics 获取信用统计
// @Summary 获取信用风控统计
// @Tags Credit
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/credit/statistics [get]
func (h *Handler) GetCreditStatistics(c *gin.Context) {
	stats, err := h.creditService.GetCreditStatistics()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, stats)
}
