package insurance

import (
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	insuranceService *service.InsuranceService
}

func NewHandler(insuranceService *service.InsuranceService) *Handler {
	return &Handler{insuranceService: insuranceService}
}

// ============================================================
// 保险保单相关接口
// ============================================================

// ListProducts 获取保险产品列表
// @Summary 获取保险产品列表
// @Tags Insurance
// @Param policy_type query string false "保单类型"
// @Param is_mandatory query bool false "是否强制"
// @Success 200 {array} model.InsuranceProduct
// @Router /api/v1/insurance/products [get]
func (h *Handler) ListProducts(c *gin.Context) {
	policyType := c.Query("policy_type")
	var isMandatory *bool
	if mandatoryStr := c.Query("is_mandatory"); mandatoryStr != "" {
		mandatory := mandatoryStr == "true"
		isMandatory = &mandatory
	}

	products, err := h.insuranceService.ListProducts(policyType, isMandatory)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, products)
}

// GetMandatoryProducts 获取强制险产品
// @Summary 获取强制险产品列表
// @Tags Insurance
// @Success 200 {array} model.InsuranceProduct
// @Router /api/v1/insurance/products/mandatory [get]
func (h *Handler) GetMandatoryProducts(c *gin.Context) {
	products, err := h.insuranceService.GetMandatoryProducts()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, products)
}

// PurchaseInsuranceRequest 购买保险请求
type PurchaseInsuranceRequest struct {
	ProductCode    string `json:"product_code" binding:"required"`
	HolderName     string `json:"holder_name" binding:"required"`
	HolderIDCard   string `json:"holder_id_card"`
	HolderPhone    string `json:"holder_phone" binding:"required"`
	InsuredType    string `json:"insured_type" binding:"required"`
	InsuredID      int64  `json:"insured_id"`
	InsuredName    string `json:"insured_name"`
	InsuredValue   int64  `json:"insured_value"`
	CoverageAmount int64  `json:"coverage_amount" binding:"required"`
	InsuranceDays  int    `json:"insurance_days" binding:"required"`
	SpecialTerms   string `json:"special_terms"`
}

// PurchaseInsurance 购买保险
// @Summary 购买保险
// @Tags Insurance
// @Param body body PurchaseInsuranceRequest true "购买信息"
// @Success 200 {object} model.InsurancePolicy
// @Router /api/v1/insurance/purchase [post]
func (h *Handler) PurchaseInsurance(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req PurchaseInsuranceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	serviceReq := &service.PurchaseInsuranceRequest{
		ProductCode:    req.ProductCode,
		HolderID:       userID.(int64),
		HolderType:     "user",
		HolderName:     req.HolderName,
		HolderIDCard:   req.HolderIDCard,
		HolderPhone:    req.HolderPhone,
		InsuredType:    req.InsuredType,
		InsuredID:      req.InsuredID,
		InsuredName:    req.InsuredName,
		InsuredValue:   req.InsuredValue,
		CoverageAmount: req.CoverageAmount,
		InsuranceDays:  req.InsuranceDays,
		SpecialTerms:   req.SpecialTerms,
	}

	policy, err := h.insuranceService.PurchaseInsurance(serviceReq)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, policy)
}

// GetMyPolicies 获取我的保单列表
// @Summary 获取我的保单列表
// @Tags Insurance
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/insurance/my-policies [get]
func (h *Handler) GetMyPolicies(c *gin.Context) {
	userID, _ := c.Get("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	policies, total, err := h.insuranceService.GetUserPolicies(userID.(int64), page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, policies, total, page, pageSize)
}

// GetPolicyDetail 获取保单详情
// @Summary 获取保单详情
// @Tags Insurance
// @Param id path int true "保单ID"
// @Success 200 {object} model.InsurancePolicy
// @Router /api/v1/insurance/policies/{id} [get]
func (h *Handler) GetPolicyDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	policy, err := h.insuranceService.GetPolicyByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "保单不存在")
		return
	}
	response.Success(c, policy)
}

// CheckMandatoryInsurance 检查强制险
// @Summary 检查用户强制险状态
// @Tags Insurance
// @Success 200 {object} map[string]bool
// @Router /api/v1/insurance/check-mandatory [get]
func (h *Handler) CheckMandatoryInsurance(c *gin.Context) {
	userID, _ := c.Get("user_id")
	result, err := h.insuranceService.CheckMandatoryInsurance(userID.(int64))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, result)
}

// ActivatePolicy 激活保单
// @Summary 激活保单(支付成功后调用)
// @Tags Insurance
// @Param id path int true "保单ID"
// @Param payment_id query int true "支付ID"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/policies/{id}/activate [post]
func (h *Handler) ActivatePolicy(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	paymentID, _ := strconv.ParseInt(c.Query("payment_id"), 10, 64)

	if err := h.insuranceService.ActivatePolicy(id, paymentID); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "保单已激活")
}

// ============================================================
// 理赔相关接口
// ============================================================

// ReportClaimRequest 报案请求
type ReportClaimRequest struct {
	PolicyID            int64   `json:"policy_id" binding:"required"`
	OrderID             int64   `json:"order_id"`
	ClaimantName        string  `json:"claimant_name" binding:"required"`
	ClaimantPhone       string  `json:"claimant_phone" binding:"required"`
	IncidentType        string  `json:"incident_type" binding:"required"`
	IncidentTime        string  `json:"incident_time" binding:"required"`
	IncidentLocation    string  `json:"incident_location" binding:"required"`
	IncidentLat         float64 `json:"incident_lat"`
	IncidentLng         float64 `json:"incident_lng"`
	IncidentDescription string  `json:"incident_description" binding:"required"`
	LossType            string  `json:"loss_type" binding:"required"`
	EstimatedLoss       int64   `json:"estimated_loss" binding:"required"`
	EvidenceFiles       string  `json:"evidence_files"`
}

// ReportClaim 报案
// @Summary 提交理赔报案
// @Tags Claim
// @Param body body ReportClaimRequest true "报案信息"
// @Success 200 {object} model.InsuranceClaim
// @Router /api/v1/insurance/claims/report [post]
func (h *Handler) ReportClaim(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req ReportClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	incidentTime, err := time.Parse("2006-01-02 15:04:05", req.IncidentTime)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "事故时间格式错误")
		return
	}

	serviceReq := &service.ReportClaimRequest{
		PolicyID:            req.PolicyID,
		OrderID:             req.OrderID,
		ClaimantID:          userID.(int64),
		ClaimantName:        req.ClaimantName,
		ClaimantPhone:       req.ClaimantPhone,
		IncidentType:        req.IncidentType,
		IncidentTime:        incidentTime,
		IncidentLocation:    req.IncidentLocation,
		IncidentLat:         req.IncidentLat,
		IncidentLng:         req.IncidentLng,
		IncidentDescription: req.IncidentDescription,
		LossType:            req.LossType,
		EstimatedLoss:       req.EstimatedLoss,
		EvidenceFiles:       req.EvidenceFiles,
	}

	claim, err := h.insuranceService.ReportClaim(serviceReq)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, claim)
}

// GetMyClaims 获取我的理赔列表
// @Summary 获取我的理赔列表
// @Tags Claim
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/insurance/my-claims [get]
func (h *Handler) GetMyClaims(c *gin.Context) {
	userID, _ := c.Get("user_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	claims, total, err := h.insuranceService.GetUserClaims(userID.(int64), page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, claims, total, page, pageSize)
}

// GetClaimDetail 获取理赔详情
// @Summary 获取理赔详情
// @Tags Claim
// @Param id path int true "理赔ID"
// @Success 200 {object} model.InsuranceClaim
// @Router /api/v1/insurance/claims/{id} [get]
func (h *Handler) GetClaimDetail(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	claim, err := h.insuranceService.GetClaimByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "理赔记录不存在")
		return
	}
	response.Success(c, claim)
}

// GetClaimTimelines 获取理赔时间线
// @Summary 获取理赔时间线
// @Tags Claim
// @Param id path int true "理赔ID"
// @Success 200 {array} model.ClaimTimeline
// @Router /api/v1/insurance/claims/{id}/timelines [get]
func (h *Handler) GetClaimTimelines(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	timelines, err := h.insuranceService.GetClaimTimelines(id)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, timelines)
}

// UploadEvidenceRequest 上传证据请求
type UploadEvidenceRequest struct {
	EvidenceType  string `json:"evidence_type" binding:"required"`
	EvidenceFiles string `json:"evidence_files" binding:"required"`
}

// UploadEvidence 上传证据
// @Summary 上传理赔证据
// @Tags Claim
// @Param id path int true "理赔ID"
// @Param body body UploadEvidenceRequest true "证据信息"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/claims/{id}/evidence [post]
func (h *Handler) UploadEvidence(c *gin.Context) {
	userID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req UploadEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.insuranceService.UploadEvidence(id, req.EvidenceType, req.EvidenceFiles, userID.(int64), "用户"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "证据上传成功")
}

// DisputeClaimRequest 争议申诉请求
type DisputeClaimRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// DisputeClaim 提交争议申诉
// @Summary 提交争议申诉
// @Tags Claim
// @Param id path int true "理赔ID"
// @Param body body DisputeClaimRequest true "申诉原因"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/claims/{id}/dispute [post]
func (h *Handler) DisputeClaim(c *gin.Context) {
	userID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req DisputeClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.insuranceService.DisputeClaim(id, req.Reason, userID.(int64), "用户"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "申诉已提交")
}

// ============================================================
// 管理员接口
// ============================================================

// AdminListPendingClaims 获取待处理理赔
// @Summary 获取待处理理赔列表(管理员)
// @Tags ClaimAdmin
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} response.PageResponse
// @Router /api/v1/insurance/admin/claims/pending [get]
func (h *Handler) AdminListPendingClaims(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	claims, total, err := h.insuranceService.ListPendingClaims(page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessWithPage(c, claims, total, page, pageSize)
}

// AdminStartInvestigation 开始调查
// @Summary 开始调查(管理员)
// @Tags ClaimAdmin
// @Param id path int true "理赔ID"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/admin/claims/{id}/investigate [post]
func (h *Handler) AdminStartInvestigation(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	if err := h.insuranceService.StartInvestigation(id, adminID.(int64), "管理员"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "已开始调查")
}

// DetermineLiabilityRequest 责任认定请求
type DetermineLiabilityRequest struct {
	LiabilityRatio  float64 `json:"liability_ratio" binding:"required"`
	LiabilityParty  string  `json:"liability_party" binding:"required"`
	LiabilityReason string  `json:"liability_reason" binding:"required"`
	ActualLoss      int64   `json:"actual_loss" binding:"required"`
}

// AdminDetermineLiability 责任认定
// @Summary 责任认定(管理员)
// @Tags ClaimAdmin
// @Param id path int true "理赔ID"
// @Param body body DetermineLiabilityRequest true "责任认定信息"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/admin/claims/{id}/liability [post]
func (h *Handler) AdminDetermineLiability(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req DetermineLiabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.insuranceService.DetermineLiability(id, req.LiabilityRatio, req.LiabilityParty, req.LiabilityReason, req.ActualLoss, adminID.(int64), "管理员"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "责任认定完成")
}

// ApproveClaimRequest 核赔请求
type ApproveClaimRequest struct {
	ApprovedAmount int64  `json:"approved_amount" binding:"required"`
	Notes          string `json:"notes"`
}

// AdminApproveClaim 核赔通过
// @Summary 核赔通过(管理员)
// @Tags ClaimAdmin
// @Param id path int true "理赔ID"
// @Param body body ApproveClaimRequest true "核赔信息"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/admin/claims/{id}/approve [post]
func (h *Handler) AdminApproveClaim(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req ApproveClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.insuranceService.ApproveClaim(id, req.ApprovedAmount, req.Notes, adminID.(int64), "管理员"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "核赔通过")
}

// RejectClaimRequest 拒赔请求
type RejectClaimRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// AdminRejectClaim 拒赔
// @Summary 拒赔(管理员)
// @Tags ClaimAdmin
// @Param id path int true "理赔ID"
// @Param body body RejectClaimRequest true "拒赔原因"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/admin/claims/{id}/reject [post]
func (h *Handler) AdminRejectClaim(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req RejectClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.insuranceService.RejectClaim(id, req.Reason, adminID.(int64), "管理员"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "已拒赔")
}

// PayClaimRequest 赔付请求
type PayClaimRequest struct {
	PaidAmount int64 `json:"paid_amount" binding:"required"`
}

// AdminPayClaim 赔付
// @Summary 赔付(管理员)
// @Tags ClaimAdmin
// @Param id path int true "理赔ID"
// @Param body body PayClaimRequest true "赔付金额"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/admin/claims/{id}/pay [post]
func (h *Handler) AdminPayClaim(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req PayClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.insuranceService.PayClaim(id, req.PaidAmount, adminID.(int64), "管理员"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "已赔付")
}

// AdminCloseClaim 结案
// @Summary 结案(管理员)
// @Tags ClaimAdmin
// @Param id path int true "理赔ID"
// @Success 200 {string} string "success"
// @Router /api/v1/insurance/admin/claims/{id}/close [post]
func (h *Handler) AdminCloseClaim(c *gin.Context) {
	adminID, _ := c.Get("user_id")
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)

	if err := h.insuranceService.CloseClaim(id, adminID.(int64), "管理员"); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "已结案")
}

// GetInsuranceStatistics 获取保险统计
// @Summary 获取保险统计(管理员)
// @Tags InsuranceAdmin
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/insurance/admin/statistics [get]
func (h *Handler) GetInsuranceStatistics(c *gin.Context) {
	stats, err := h.insuranceService.GetInsuranceStatistics()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, stats)
}
