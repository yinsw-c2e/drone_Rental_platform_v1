package admin

import (
	"encoding/json"
	"strconv"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
)

func (h *Handler) RegisterExtendedRoutes(group *gin.RouterGroup) {
	group.GET("/orders/detail/:id", h.OrderDetail)
	group.GET("/demands/detail/:id", h.DemandDetail)
	group.GET("/supplies/detail/:id", h.SupplyDetail)
	group.GET("/dispatch-tasks/detail/:id", h.DispatchTaskDetail)
	group.GET("/flight-records/detail/:id", h.FlightRecordDetail)

	group.GET("/refunds", h.RefundList)
	group.GET("/settlements", h.SettlementList)
	group.POST("/settlements/execute/:id", h.ExecuteSettlement)
	group.POST("/settlements/process-pending", h.ProcessPendingSettlements)
	group.GET("/withdrawals", h.WithdrawalList)
	group.POST("/withdrawals/:id/approve", h.ApproveWithdrawal)
	group.POST("/withdrawals/:id/reject", h.RejectWithdrawal)
	group.GET("/pricing-configs", h.PricingConfigList)
	group.PUT("/pricing-configs/:key", h.UpdatePricingConfig)

	group.GET("/airspace-applications", h.AirspaceApplicationList)
	group.POST("/airspace-applications/:id/review", h.ReviewAirspaceApplication)
	group.POST("/airspace-applications/:id/submit-uom", h.SubmitAirspaceToUOM)
	group.GET("/no-fly-zones", h.NoFlyZoneList)
	group.POST("/no-fly-zones", h.CreateNoFlyZone)
	group.DELETE("/no-fly-zones/:id", h.DeleteNoFlyZone)
	group.GET("/compliance-checks", h.ComplianceCheckList)

	group.GET("/credit-scores", h.CreditScoreList)
	group.GET("/credit/statistics", h.CreditStatistics)
	group.GET("/violations", h.ViolationList)
	group.POST("/violations/:id/confirm", h.ConfirmViolation)
	group.POST("/violations/:id/review-appeal", h.ReviewViolationAppeal)
	group.GET("/risk-controls", h.RiskControlList)
	group.POST("/risk-controls/:id/review", h.ReviewRiskControl)
	group.GET("/blacklists", h.BlacklistList)
	group.GET("/deposits", h.DepositList)

	group.GET("/insurance-products", h.InsuranceProductList)
	group.GET("/insurance-policies", h.InsurancePolicyList)
	group.GET("/insurance-claims", h.InsuranceClaimList)
	group.GET("/insurance-claims/:id/timeline", h.InsuranceClaimTimeline)
	group.POST("/insurance-claims/:id/investigate", h.InsuranceStartInvestigation)
	group.POST("/insurance-claims/:id/liability", h.InsuranceDetermineLiability)
	group.POST("/insurance-claims/:id/approve", h.InsuranceApproveClaim)
	group.POST("/insurance-claims/:id/reject", h.InsuranceRejectClaim)
	group.POST("/insurance-claims/:id/pay", h.InsurancePayClaim)
	group.POST("/insurance-claims/:id/close", h.InsuranceCloseClaim)
	group.GET("/insurance/statistics", h.InsuranceStatistics)

	group.GET("/contracts", h.ContractList)
	group.GET("/reviews", h.ReviewList)
	group.GET("/disputes", h.DisputeList)
	group.GET("/admin-logs", h.AdminLogList)
}

func adminPagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func adminParamID(c *gin.Context) int64 {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	return id
}

func adminQueryInt64(c *gin.Context, key string) int64 {
	value := c.Query(key)
	if value == "" {
		return 0
	}
	n, _ := strconv.ParseInt(value, 10, 64)
	return n
}

func (h *Handler) writeAdminLog(c *gin.Context, module, action, targetType string, targetID int64, details interface{}) {
	if h.opsService == nil {
		return
	}
	raw, _ := json.Marshal(details)
	_ = h.opsService.CreateAdminLog(&model.AdminLog{
		AdminID:    c.GetInt64("user_id"),
		Action:     action,
		Module:     module,
		TargetType: targetType,
		TargetID:   targetID,
		Details:    model.JSON(raw),
		IPAddress:  c.ClientIP(),
	})
}

func (h *Handler) OrderDetail(c *gin.Context) {
	id := adminParamID(c)
	order, err := h.orderService.GetOrder(id)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	timeline, _ := h.orderService.GetTimeline(id)
	payments, _ := h.orderService.ListPaymentsByOrder(id)
	refunds, _ := h.orderService.ListRefundsByOrder(id)
	disputes, _ := h.orderService.ListDisputesByOrder(id)
	snapshots, _ := h.orderService.ListSnapshotsByOrder(id)
	response.Success(c, gin.H{
		"order":     order,
		"timeline":  timeline,
		"payments":  payments,
		"refunds":   refunds,
		"disputes":  disputes,
		"snapshots": snapshots,
	})
}

func (h *Handler) DemandDetail(c *gin.Context) {
	item, err := h.clientService.AdminGetDemand(adminParamID(c))
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, item)
}

func (h *Handler) SupplyDetail(c *gin.Context) {
	item, err := h.ownerService.AdminGetSupply(adminParamID(c))
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, item)
}

func (h *Handler) DispatchTaskDetail(c *gin.Context) {
	item, err := h.dispatchService.GetFormalTask(adminParamID(c))
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, item)
}

func (h *Handler) FlightRecordDetail(c *gin.Context) {
	item, err := h.flightService.GetFlightRecordByID(adminParamID(c))
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	positions, _ := h.flightService.GetPositionsByFlightRecord(item.ID)
	alerts, _ := h.flightService.GetAlertsByFlightRecord(item.ID)
	response.Success(c, gin.H{"record": item, "positions": positions, "alerts": alerts})
}

func (h *Handler) RefundList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.paymentService.AdminListRefunds(c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) SettlementList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.settlementService.ListSettlements(c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) ExecuteSettlement(c *gin.Context) {
	id := adminParamID(c)
	if _, err := h.settlementService.FinalizeSettlement(id); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "finance", "execute_settlement", "settlement", id, gin.H{"note": c.PostForm("note")})
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) ProcessPendingSettlements(c *gin.Context) {
	count, err := h.settlementService.ProcessPendingSettlements()
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "finance", "process_pending_settlements", "settlement", 0, gin.H{"processed": count})
	response.Success(c, gin.H{"processed": count})
}

func (h *Handler) WithdrawalList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.settlementService.ListWithdrawals(c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) ApproveWithdrawal(c *gin.Context) {
	id := adminParamID(c)
	if err := h.settlementService.ApproveWithdrawal(id, c.GetInt64("user_id")); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "finance", "approve_withdrawal", "withdrawal", id, gin.H{"note": c.PostForm("note")})
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) RejectWithdrawal(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		Reason string `json:"reason"`
		Note   string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Reason == "" {
		req.Reason = req.Note
	}
	if err := h.settlementService.RejectWithdrawal(id, c.GetInt64("user_id"), req.Reason); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "finance", "reject_withdrawal", "withdrawal", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) PricingConfigList(c *gin.Context) {
	items, err := h.settlementService.GetAllPricingConfigs()
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *Handler) UpdatePricingConfig(c *gin.Context) {
	var req struct {
		Value float64 `json:"value"`
		Note  string  `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.settlementService.UpdatePricingConfig(c.Param("key"), req.Value); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "finance", "update_pricing_config", "pricing_config", 0, gin.H{"key": c.Param("key"), "value": req.Value, "note": req.Note})
	response.Success(c, gin.H{"key": c.Param("key"), "value": req.Value})
}

func (h *Handler) AirspaceApplicationList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.airspaceService.ListApplications(c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) ReviewAirspaceApplication(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		Approved bool   `json:"approved"`
		Note     string `json:"note"`
		Reason   string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	note := req.Note
	if note == "" {
		note = req.Reason
	}
	if err := h.airspaceService.ReviewApplication(id, c.GetInt64("user_id"), req.Approved, note); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "airspace", "review_airspace_application", "airspace_application", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) SubmitAirspaceToUOM(c *gin.Context) {
	id := adminParamID(c)
	if err := h.airspaceService.SubmitToUOM(id); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "airspace", "submit_to_uom", "airspace_application", id, nil)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) NoFlyZoneList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.airspaceService.ListNoFlyZones(c.Query("zone_type"), c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) CreateNoFlyZone(c *gin.Context) {
	var zone model.NoFlyZone
	if err := c.ShouldBindJSON(&zone); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.airspaceService.CreateNoFlyZone(&zone); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "airspace", "create_no_fly_zone", "no_fly_zone", zone.ID, zone)
	response.Success(c, zone)
}

func (h *Handler) DeleteNoFlyZone(c *gin.Context) {
	id := adminParamID(c)
	if err := h.airspaceService.DeleteNoFlyZone(id); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "airspace", "delete_no_fly_zone", "no_fly_zone", id, nil)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) ComplianceCheckList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.airspaceService.ListComplianceChecks(adminQueryInt64(c, "pilot_id"), adminQueryInt64(c, "drone_id"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) CreditScoreList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.creditService.ListCreditScores(c.Query("user_type"), c.Query("score_level"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) CreditStatistics(c *gin.Context) {
	stats, err := h.creditService.GetCreditStatistics()
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, stats)
}

func (h *Handler) ViolationList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.creditService.ListViolations(adminQueryInt64(c, "user_id"), c.Query("violation_type"), c.Query("violation_level"), c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) ConfirmViolation(c *gin.Context) {
	id := adminParamID(c)
	if err := h.creditService.ConfirmViolation(id, c.GetInt64("user_id")); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "risk", "confirm_violation", "violation", id, nil)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) ReviewViolationAppeal(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		Approved bool   `json:"approved"`
		Result   string `json:"result"`
		Note     string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Result == "" {
		req.Result = req.Note
	}
	if err := h.creditService.ReviewAppeal(id, req.Approved, c.GetInt64("user_id"), req.Result); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "risk", "review_violation_appeal", "violation", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) RiskControlList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.creditService.ListRiskControls(adminQueryInt64(c, "user_id"), c.Query("risk_phase"), c.Query("risk_type"), c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) ReviewRiskControl(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		Action string `json:"action"`
		Notes  string `json:"notes"`
		Note   string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Notes == "" {
		req.Notes = req.Note
	}
	if err := h.creditService.ReviewRiskControl(id, req.Action, c.GetInt64("user_id"), req.Notes); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "risk", "review_risk_control", "risk_control", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) BlacklistList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	var active *bool
	if c.Query("is_active") != "" {
		v := c.Query("is_active") == "true" || c.Query("is_active") == "1"
		active = &v
	}
	items, total, err := h.creditService.ListBlacklists(c.Query("blacklist_type"), active, page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) DepositList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.creditService.ListDeposits(c.Query("user_type"), c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) InsuranceProductList(c *gin.Context) {
	var mandatory *bool
	if c.Query("is_mandatory") != "" {
		v := c.Query("is_mandatory") == "true" || c.Query("is_mandatory") == "1"
		mandatory = &v
	}
	items, err := h.insuranceService.ListProducts(c.Query("policy_type"), mandatory)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *Handler) InsurancePolicyList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.insuranceService.ListPolicies(adminQueryInt64(c, "holder_id"), c.Query("policy_type"), c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) InsuranceClaimList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.insuranceService.ListClaims(adminQueryInt64(c, "claimant_id"), adminQueryInt64(c, "policy_id"), c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) InsuranceClaimTimeline(c *gin.Context) {
	items, err := h.insuranceService.GetClaimTimelines(adminParamID(c))
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, items)
}

func (h *Handler) InsuranceStartInvestigation(c *gin.Context) {
	id := adminParamID(c)
	if err := h.insuranceService.StartInvestigation(id, c.GetInt64("user_id"), "平台管理员"); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "insurance", "start_investigation", "insurance_claim", id, nil)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) InsuranceDetermineLiability(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		LiabilityRatio  float64 `json:"liability_ratio"`
		LiabilityParty  string  `json:"liability_party"`
		LiabilityReason string  `json:"liability_reason"`
		ActualLoss      int64   `json:"actual_loss"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}
	if err := h.insuranceService.DetermineLiability(id, req.LiabilityRatio, req.LiabilityParty, req.LiabilityReason, req.ActualLoss, c.GetInt64("user_id"), "平台管理员"); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "insurance", "determine_liability", "insurance_claim", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) InsuranceApproveClaim(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		ApprovedAmount int64  `json:"approved_amount"`
		Notes          string `json:"notes"`
		Note           string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Notes == "" {
		req.Notes = req.Note
	}
	if err := h.insuranceService.ApproveClaim(id, req.ApprovedAmount, req.Notes, c.GetInt64("user_id"), "平台管理员"); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "insurance", "approve_claim", "insurance_claim", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) InsuranceRejectClaim(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		Reason string `json:"reason"`
		Note   string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Reason == "" {
		req.Reason = req.Note
	}
	if err := h.insuranceService.RejectClaim(id, req.Reason, c.GetInt64("user_id"), "平台管理员"); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "insurance", "reject_claim", "insurance_claim", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) InsurancePayClaim(c *gin.Context) {
	id := adminParamID(c)
	var req struct {
		PaidAmount int64 `json:"paid_amount"`
	}
	_ = c.ShouldBindJSON(&req)
	if err := h.insuranceService.PayClaim(id, req.PaidAmount, c.GetInt64("user_id"), "平台管理员"); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "insurance", "pay_claim", "insurance_claim", id, req)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) InsuranceCloseClaim(c *gin.Context) {
	id := adminParamID(c)
	if err := h.insuranceService.CloseClaim(id, c.GetInt64("user_id"), "平台管理员"); err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	h.writeAdminLog(c, "insurance", "close_claim", "insurance_claim", id, nil)
	response.Success(c, gin.H{"id": id})
}

func (h *Handler) InsuranceStatistics(c *gin.Context) {
	stats, err := h.insuranceService.GetInsuranceStatistics()
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.Success(c, stats)
}

func (h *Handler) ContractList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.contractService.ListContracts(c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) ReviewList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.reviewService.ListAll(c.Query("target_type"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) DisputeList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.orderService.AdminListDisputes(c.Query("status"), page, pageSize)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}

func (h *Handler) AdminLogList(c *gin.Context) {
	page, pageSize := adminPagination(c)
	items, total, err := h.opsService.AdminListLogs(
		c.Query("module"),
		c.Query("action"),
		c.Query("target_type"),
		adminQueryInt64(c, "target_id"),
		adminQueryInt64(c, "admin_id"),
		page,
		pageSize,
	)
	if err != nil {
		response.Error(c, response.CodeDBError, err.Error())
		return
	}
	response.SuccessWithPage(c, items, total, page, pageSize)
}
