package settlement

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/service"
)

type Handler struct {
	settlementService *service.SettlementService
	opsService        *service.OperationsService
}

func NewHandler(settlementService *service.SettlementService, opsService ...*service.OperationsService) *Handler {
	var ops *service.OperationsService
	if len(opsService) > 0 {
		ops = opsService[0]
	}
	return &Handler{settlementService: settlementService, opsService: ops}
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

func (h *Handler) writeAdminLog(c *gin.Context, action, targetType string, targetID int64, details interface{}) {
	if h.opsService == nil {
		return
	}
	raw, _ := json.Marshal(details)
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	_ = h.opsService.CreateAdminLog(&model.AdminLog{
		AdminID:    getUserID(c),
		Action:     action,
		Module:     "finance",
		TargetType: targetType,
		TargetID:   targetID,
		Details:    model.JSON(raw),
		IPAddress:  c.ClientIP(),
	})
}

func settlementAuditDetails(s *model.OrderSettlement, extra gin.H) gin.H {
	details := gin.H{}
	for key, value := range extra {
		details[key] = value
	}
	if s == nil {
		return details
	}
	details["settlement_no"] = s.SettlementNo
	details["order_id"] = s.OrderID
	details["order_no"] = s.OrderNo
	details["status"] = s.Status
	details["final_amount"] = s.FinalAmount
	details["platform_fee"] = s.PlatformFee
	details["pilot_fee"] = s.PilotFee
	details["owner_fee"] = s.OwnerFee
	details["insurance_deduction"] = s.InsuranceDeduction
	details["pilot_user_id"] = s.PilotUserID
	details["owner_user_id"] = s.OwnerUserID
	details["payer_user_id"] = s.PayerUserID
	return details
}

func withdrawalAuditDetails(w *model.WithdrawalRecord, extra gin.H) gin.H {
	details := gin.H{}
	for key, value := range extra {
		details[key] = value
	}
	if w == nil {
		return details
	}
	details["withdrawal_no"] = w.WithdrawalNo
	details["user_id"] = w.UserID
	details["wallet_id"] = w.WalletID
	details["amount"] = w.Amount
	details["service_fee"] = w.ServiceFee
	details["actual_amount"] = w.ActualAmount
	details["withdraw_method"] = w.WithdrawMethod
	details["status"] = w.Status
	details["third_party_no"] = w.ThirdPartyNo
	details["review_notes"] = w.ReviewNotes
	return details
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

	h.writeAdminLog(c, "create_settlement", "settlement", settlement.ID, settlementAuditDetails(settlement, gin.H{"order_id": req.OrderID}))
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

	settlement, _ := h.settlementService.GetSettlement(id)
	h.writeAdminLog(c, "confirm_settlement", "settlement", id, settlementAuditDetails(settlement, nil))
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "结算已确认"})
}

// ExecuteSettlement 执行结算
func (h *Handler) ExecuteSettlement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)

	settlement, err := h.settlementService.FinalizeSettlement(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	h.writeAdminLog(c, "execute_settlement", "settlement", id, settlementAuditDetails(settlement, gin.H{"note": req.Note}))
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settlement, "message": "结算已执行，资金已入账"})
}

// MarkSettlementDisputed 标记异常/争议结算
func (h *Handler) MarkSettlementDisputed(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	settlement, err := h.settlementService.MarkSettlementDisputed(id, getUserID(c), req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	h.writeAdminLog(c, "mark_settlement_disputed", "settlement", id, settlementAuditDetails(settlement, gin.H{"reason": req.Reason}))
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settlement, "message": "结算已标记争议"})
}

// ResolveSettlementDispute 解除异常/争议结算
func (h *Handler) ResolveSettlementDispute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	var req struct {
		Resolution         string `json:"resolution"`
		NextStatus         string `json:"next_status"`
		PlatformFee        *int64 `json:"platform_fee"`
		PilotFee           *int64 `json:"pilot_fee"`
		OwnerFee           *int64 `json:"owner_fee"`
		InsuranceDeduction *int64 `json:"insurance_deduction"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	settlement, err := h.settlementService.ResolveSettlementDispute(id, getUserID(c), service.SettlementDisputeResolution{
		Resolution:         req.Resolution,
		NextStatus:         req.NextStatus,
		PlatformFee:        req.PlatformFee,
		PilotFee:           req.PilotFee,
		OwnerFee:           req.OwnerFee,
		InsuranceDeduction: req.InsuranceDeduction,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	h.writeAdminLog(c, "resolve_settlement_dispute", "settlement", id, settlementAuditDetails(settlement, gin.H{
		"resolution":          req.Resolution,
		"next_status":         req.NextStatus,
		"platform_fee":        req.PlatformFee,
		"pilot_fee":           req.PilotFee,
		"owner_fee":           req.OwnerFee,
		"insurance_deduction": req.InsuranceDeduction,
	}))
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settlement, "message": "结算争议已处理"})
}

// ListSettlements 获取结算列表
func (h *Handler) ListSettlements(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter, err := parseReconciliationExportFilter(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}
	list, total, err := h.settlementService.ListSettlementsFiltered(filter, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

func (h *Handler) ExportSettlements(c *gin.Context) {
	filter, err := parseReconciliationExportFilter(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}
	content, err := h.settlementService.ExportSettlementReconciliationCSV(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	h.writeAdminLog(c, "export_settlements_csv", "settlement", 0, gin.H{
		"status":     filter.Status,
		"time_field": filter.TimeField,
		"start_at":   filter.StartAt,
		"end_at":     filter.EndAt,
		"limit":      filter.Limit,
		"bytes":      len(content),
	})
	writeCSV(c, fmt.Sprintf("settlements_%s.csv", time.Now().Format("20060102150405")), content)
}

func (h *Handler) ExportWithdrawals(c *gin.Context) {
	filter, err := parseReconciliationExportFilter(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}
	content, err := h.settlementService.ExportWithdrawalReconciliationCSV(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}
	h.writeAdminLog(c, "export_withdrawals_csv", "withdrawal", 0, gin.H{
		"status":     filter.Status,
		"time_field": filter.TimeField,
		"start_at":   filter.StartAt,
		"end_at":     filter.EndAt,
		"limit":      filter.Limit,
		"bytes":      len(content),
	})
	writeCSV(c, fmt.Sprintf("withdrawals_%s.csv", time.Now().Format("20060102150405")), content)
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

func (h *Handler) AdminListWithdrawals(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter, err := parseReconciliationExportFilter(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}
	list, total, err := h.settlementService.ListWithdrawalsFiltered(filter, page, pageSize)
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

	record, _ := h.settlementService.GetWithdrawal(id)
	h.writeAdminLog(c, "approve_withdrawal", "withdrawal", id, withdrawalAuditDetails(record, nil))
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

	record, _ := h.settlementService.GetWithdrawal(id)
	h.writeAdminLog(c, "reject_withdrawal", "withdrawal", id, withdrawalAuditDetails(record, gin.H{"reason": req.Reason}))
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "提现已拒绝"})
}

// AdminProcessSettlements 批量处理结算
func (h *Handler) AdminProcessSettlements(c *gin.Context) {
	count, err := h.settlementService.ProcessPendingSettlements()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	h.writeAdminLog(c, "process_pending_settlements", "settlement", 0, gin.H{"processed_count": count})
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "处理完成", "data": gin.H{"processed_count": count}})
}

// AdminFinanceOverview 汇总财务运营待办、异常和今日处理情况
func (h *Handler) AdminFinanceOverview(c *gin.Context) {
	overview, err := h.settlementService.GetFinanceOperationsOverview(time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": overview})
}

// AdminListFinanceAnomalies 管理员查询财务异常记录
func (h *Handler) AdminListFinanceAnomalies(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := service.FinanceAnomalyFilter{
		Status:       c.Query("status"),
		Severity:     c.Query("severity"),
		AnomalyType:  c.Query("anomaly_type"),
		Source:       c.Query("source"),
		TargetType:   c.Query("target_type"),
		TargetID:     parseQueryInt64(c, "target_id"),
		OrderID:      parseQueryInt64(c, "order_id"),
		SettlementID: parseQueryInt64(c, "settlement_id"),
		WithdrawalID: parseQueryInt64(c, "withdrawal_id"),
		UserID:       parseQueryInt64(c, "user_id"),
		Keyword:      c.Query("keyword"),
	}
	list, total, err := h.settlementService.ListFinanceAnomalies(filter, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// AdminResolveFinanceAnomaly 标记财务异常已处理
func (h *Handler) AdminResolveFinanceAnomaly(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	record, err := h.settlementService.ResolveFinanceAnomaly(id, getUserID(c), req.Note)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	h.writeAdminLog(c, "resolve_finance_anomaly", "finance_anomaly", id, gin.H{
		"anomaly_no":    record.AnomalyNo,
		"anomaly_type":  record.AnomalyType,
		"severity":      record.Severity,
		"target_type":   record.TargetType,
		"target_id":     record.TargetID,
		"settlement_id": record.SettlementID,
		"withdrawal_id": record.WithdrawalID,
		"note":          req.Note,
	})
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": record, "message": "财务异常已标记处理"})
}

// AdminListFinanceManualActions 管理员查询财务人工处理记录
func (h *Handler) AdminListFinanceManualActions(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := service.FinanceManualActionFilter{
		Status:       c.Query("status"),
		ActionType:   c.Query("action_type"),
		TargetType:   c.Query("target_type"),
		TargetID:     parseQueryInt64(c, "target_id"),
		SettlementID: parseQueryInt64(c, "settlement_id"),
		WithdrawalID: parseQueryInt64(c, "withdrawal_id"),
		AnomalyID:    parseQueryInt64(c, "anomaly_id"),
		AdminID:      parseQueryInt64(c, "admin_id"),
		Keyword:      c.Query("keyword"),
	}
	list, total, err := h.settlementService.ListFinanceManualActions(filter, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 1, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": list, "total": total, "page": page, "page_size": pageSize})
}

// AdminRollbackFinanceManualAction 回滚尚未被后续变更覆盖的人工处理
func (h *Handler) AdminRollbackFinanceManualAction(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "无效的ID"})
		return
	}

	var req struct {
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": "参数错误"})
		return
	}

	record, err := h.settlementService.RollbackFinanceManualAction(id, getUserID(c), req.Note)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 1, "message": err.Error()})
		return
	}

	h.writeAdminLog(c, "rollback_finance_manual_action", "finance_manual_action", id, gin.H{
		"action_no":     record.ActionNo,
		"action_type":   record.ActionType,
		"target_type":   record.TargetType,
		"target_id":     record.TargetID,
		"settlement_id": record.SettlementID,
		"withdrawal_id": record.WithdrawalID,
		"anomaly_id":    record.AnomalyID,
		"note":          req.Note,
	})
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": record, "message": "人工处理已回滚"})
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

	h.writeAdminLog(c, "update_pricing_config", "pricing_config", 0, gin.H{"key": req.Key, "value": req.Value})
	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "配置已更新"})
}

func parseReconciliationExportFilter(c *gin.Context) (service.ReconciliationExportFilter, error) {
	startAt, err := parseExportTime(c.Query("start_date"), false)
	if err != nil {
		return service.ReconciliationExportFilter{}, fmt.Errorf("开始日期格式错误")
	}
	endAt, err := parseExportTime(c.Query("end_date"), true)
	if err != nil {
		return service.ReconciliationExportFilter{}, fmt.Errorf("结束日期格式错误")
	}
	if startAt != nil && endAt != nil && !startAt.Before(*endAt) {
		return service.ReconciliationExportFilter{}, fmt.Errorf("开始日期必须早于结束日期")
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5000"))
	return service.ReconciliationExportFilter{
		Status:    c.Query("status"),
		TimeField: c.Query("time_field"),
		StartAt:   startAt,
		EndAt:     endAt,
		Limit:     limit,
	}, nil
}

func parseQueryInt64(c *gin.Context, key string) int64 {
	value := strings.TrimSpace(c.Query(key))
	if value == "" {
		return 0
	}
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

func parseExportTime(value string, endOfDate bool) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if len(value) == len("2006-01-02") {
		parsed, err := time.ParseInLocation("2006-01-02", value, time.Local)
		if err != nil {
			return nil, err
		}
		if endOfDate {
			parsed = parsed.AddDate(0, 0, 1)
		}
		return &parsed, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func writeCSV(c *gin.Context, filename string, content []byte) {
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Data(http.StatusOK, "text/csv; charset=utf-8", content)
}
