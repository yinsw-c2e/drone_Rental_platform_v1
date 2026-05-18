package settlement

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"wurenji-backend/internal/service"
)

type Handler struct {
	settlementService *service.SettlementService
}

func NewHandler(settlementService *service.SettlementService) *Handler {
	return &Handler{settlementService: settlementService}
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

// ========== 定价相关 ==========

// CalculatePrice 计算订单价格(预估)
func (h *Handler) CalculatePrice(c *gin.Context) {
	var req struct {
		FlightDistance float64 `json:"flight_distance"` // km
		FlightDuration float64 `json:"flight_duration"` // 分钟
		CargoWeight    float64 `json:"cargo_weight"`    // kg
		CargoValue     int64   `json:"cargo_value"`     // 分
		CargoType      string  `json:"cargo_type"`      // normal, fragile, hazardous
		TaskType       string  `json:"task_type"`
		IsNightFlight  bool    `json:"is_night_flight"`
		IsPeakHour     bool    `json:"is_peak_hour"`
		IsHoliday      bool    `json:"is_holiday"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	result, err := h.settlementService.CalculatePrice(service.PricingInput{
		FlightDistance: req.FlightDistance,
		FlightDuration: req.FlightDuration,
		CargoWeight:    req.CargoWeight,
		CargoValue:     req.CargoValue,
		CargoType:      req.CargoType,
		TaskType:       req.TaskType,
		IsNightFlight:  req.IsNightFlight,
		IsPeakHour:     req.IsPeakHour,
		IsHoliday:      req.IsHoliday,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// ========== 结算相关 ==========

// CreateSettlement 创建订单结算
func (h *Handler) CreateSettlement(c *gin.Context) {
	var req struct {
		OrderID int64 `json:"order_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "缺少订单ID"})
		return
	}

	settlement, err := h.settlementService.CreateSettlement(req.OrderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settlement})
}

// GetSettlement 获取结算详情
func (h *Handler) GetSettlement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	settlement, err := h.settlementService.GetSettlement(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 1, "message": "结算记录不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settlement})
}

// GetSettlementByOrder 根据订单获取结算
func (h *Handler) GetSettlementByOrder(c *gin.Context) {
	orderID, err := strconv.ParseInt(c.Param("order_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的订单ID"})
		return
	}

	settlement, err := h.settlementService.GetSettlementByOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": 1, "message": "未找到结算记录"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settlement})
}

// ConfirmSettlement 确认结算
func (h *Handler) ConfirmSettlement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	if err := h.settlementService.ConfirmSettlement(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "结算已确认"})
}

// ExecuteSettlement 执行结算
func (h *Handler) ExecuteSettlement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	if err := h.settlementService.ExecuteSettlement(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "结算已执行，资金已入账"})
}

// ListSettlements 获取结算列表
func (h *Handler) ListSettlements(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	list, total, err := h.settlementService.ListSettlements(status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// ListMySettlements 获取我的结算
func (h *Handler) ListMySettlements(c *gin.Context) {
	userID := getUserID(c)
	role := c.DefaultQuery("role", "")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	list, total, err := h.settlementService.ListUserSettlements(userID, role, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// ========== 钱包相关 ==========

// GetWallet 获取我的钱包
func (h *Handler) GetWallet(c *gin.Context) {
	userID := getUserID(c)
	wallet, err := h.settlementService.GetWallet(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": wallet})
}

// GetWalletTransactions 获取钱包流水
func (h *Handler) GetWalletTransactions(c *gin.Context) {
	userID := getUserID(c)
	txType := c.Query("type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	list, total, err := h.settlementService.GetWalletTransactions(userID, txType, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// ========== 提现相关 ==========

// RequestWithdrawal 申请提现
func (h *Handler) RequestWithdrawal(c *gin.Context) {
	userID := getUserID(c)
	var req struct {
		Amount        int64  `json:"amount" binding:"required"`
		Method        string `json:"method" binding:"required"` // bank_card, alipay, wechat
		BankName      string `json:"bank_name"`
		BankBranch    string `json:"bank_branch"`
		AccountNo     string `json:"account_no"`
		AccountName   string `json:"account_name"`
		AlipayAccount string `json:"alipay_account"`
		WechatAccount string `json:"wechat_account"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	accountInfo := map[string]string{
		"bank_name":      req.BankName,
		"bank_branch":    req.BankBranch,
		"account_no":     req.AccountNo,
		"account_name":   req.AccountName,
		"alipay_account": req.AlipayAccount,
		"wechat_account": req.WechatAccount,
	}

	record, err := h.settlementService.RequestWithdrawal(userID, req.Amount, req.Method, accountInfo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": record, "message": "提现申请已提交"})
}

// ListMyWithdrawals 获取我的提现记录
func (h *Handler) ListMyWithdrawals(c *gin.Context) {
	userID := getUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	list, total, err := h.settlementService.ListUserWithdrawals(userID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// ========== 管理员 ==========

// AdminListPendingWithdrawals 管理员获取待审核提现
func (h *Handler) AdminListPendingWithdrawals(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	list, total, err := h.settlementService.ListPendingWithdrawals(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// AdminApproveWithdrawal 管理员审批通过提现
func (h *Handler) AdminApproveWithdrawal(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}
	adminID := getUserID(c)

	if err := h.settlementService.ApproveWithdrawal(id, adminID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "提现已通过"})
}

// AdminRejectWithdrawal 管理员拒绝提现
func (h *Handler) AdminRejectWithdrawal(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}
	adminID := getUserID(c)

	var req struct {
		Reason string `json:"reason"`
	}
	c.ShouldBindJSON(&req)

	if err := h.settlementService.RejectWithdrawal(id, adminID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "提现已拒绝"})
}

// AdminProcessSettlements 批量处理结算
func (h *Handler) AdminProcessSettlements(c *gin.Context) {
	count, err := h.settlementService.ProcessPendingSettlements()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "处理完成", "data": gin.H{"processed_count": count}})
}

// ========== 定价配置 ==========

// GetPricingConfigs 获取定价配置
func (h *Handler) GetPricingConfigs(c *gin.Context) {
	configs, err := h.settlementService.GetAllPricingConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": configs})
}

// UpdatePricingConfig 更新定价配置
func (h *Handler) UpdatePricingConfig(c *gin.Context) {
	var req struct {
		Key   string  `json:"key" binding:"required"`
		Value float64 `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	if err := h.settlementService.UpdatePricingConfig(req.Key, req.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "配置已更新"})
}
