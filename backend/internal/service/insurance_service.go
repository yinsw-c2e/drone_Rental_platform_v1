package service

import (
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
	"errors"
	"time"

	"go.uber.org/zap"
)

type InsuranceService struct {
	insuranceRepo *repository.InsuranceRepository
	logger        *zap.Logger
}

func NewInsuranceService(insuranceRepo *repository.InsuranceRepository, logger *zap.Logger) *InsuranceService {
	return &InsuranceService{
		insuranceRepo: insuranceRepo,
		logger:        logger,
	}
}

// ============================================================
// 保险保单管理
// ============================================================

// PurchaseInsuranceRequest 购买保险请求
type PurchaseInsuranceRequest struct {
	ProductCode   string  `json:"product_code"`
	HolderID      int64   `json:"holder_id"`
	HolderType    string  `json:"holder_type"`
	HolderName    string  `json:"holder_name"`
	HolderIDCard  string  `json:"holder_id_card"`
	HolderPhone   string  `json:"holder_phone"`
	InsuredType   string  `json:"insured_type"`
	InsuredID     int64   `json:"insured_id"`
	InsuredName   string  `json:"insured_name"`
	InsuredValue  int64   `json:"insured_value"`
	CoverageAmount int64  `json:"coverage_amount"`
	InsuranceDays int     `json:"insurance_days"`
	SpecialTerms  string  `json:"special_terms"`
}

// PurchaseInsurance 购买保险
func (s *InsuranceService) PurchaseInsurance(req *PurchaseInsuranceRequest) (*model.InsurancePolicy, error) {
	// 获取产品配置
	product, err := s.insuranceRepo.GetProductByCode(req.ProductCode)
	if err != nil {
		return nil, errors.New("保险产品不存在或已下架")
	}

	// 验证保额范围
	if req.CoverageAmount < product.MinCoverage || req.CoverageAmount > product.MaxCoverage {
		return nil, errors.New("保额不在允许范围内")
	}

	// 计算保费
	premium := s.CalculatePremium(product, req.InsuredValue, req.CoverageAmount, req.InsuranceDays)
	if premium < product.MinPremium {
		premium = product.MinPremium
	}

	// 计算免赔额
	deductible := int64(float64(req.CoverageAmount) * product.DeductibleRate)
	if deductible < product.MinDeductible {
		deductible = product.MinDeductible
	}

	// 计算保险期限
	now := time.Now()
	effectiveFrom := now
	effectiveTo := now.AddDate(0, 0, req.InsuranceDays)

	policy := &model.InsurancePolicy{
		PolicyType:       product.PolicyType,
		PolicyCategory:   "mandatory",
		HolderID:         req.HolderID,
		HolderType:       req.HolderType,
		HolderName:       req.HolderName,
		HolderIDCard:     req.HolderIDCard,
		HolderPhone:      req.HolderPhone,
		InsuredType:      req.InsuredType,
		InsuredID:        req.InsuredID,
		InsuredName:      req.InsuredName,
		InsuredValue:     req.InsuredValue,
		CoverageAmount:   req.CoverageAmount,
		DeductibleAmount: deductible,
		PremiumRate:      product.BasePremiumRate,
		Premium:          premium,
		InsurerCode:      product.InsurerCode,
		InsurerName:      product.InsurerName,
		InsuranceProduct: product.ProductName,
		EffectiveFrom:    effectiveFrom,
		EffectiveTo:      effectiveTo,
		InsuranceDays:    req.InsuranceDays,
		Status:           "pending",
		PaymentStatus:    "unpaid",
		CoverageScope:    product.CoverageScope,
		Exclusions:       product.Exclusions,
		SpecialTerms:     req.SpecialTerms,
	}
	if !product.IsMandatory {
		policy.PolicyCategory = "optional"
	}

	if err := s.insuranceRepo.CreatePolicy(policy); err != nil {
		return nil, err
	}

	s.logger.Info("保险保单创建成功",
		zap.String("policy_no", policy.PolicyNo),
		zap.String("policy_type", policy.PolicyType),
		zap.Int64("premium", premium))

	return policy, nil
}

// CalculatePremium 计算保费
func (s *InsuranceService) CalculatePremium(product *model.InsuranceProduct, insuredValue, coverageAmount int64, days int) int64 {
	// 基础保费 = 保额 * 费率 * (天数/365)
	basePremium := float64(coverageAmount) * product.BasePremiumRate * (float64(days) / 365.0)
	
	// 如果是货物险，按货值计算
	if product.PolicyType == "cargo" && insuredValue > 0 {
		basePremium = float64(insuredValue) * product.BasePremiumRate * (float64(days) / 365.0)
	}

	return int64(basePremium)
}

// ActivatePolicy 激活保单(支付成功后调用)
func (s *InsuranceService) ActivatePolicy(policyID int64, paymentID int64) error {
	policy, err := s.insuranceRepo.GetPolicyByID(policyID)
	if err != nil {
		return err
	}

	if policy.Status != "pending" {
		return errors.New("保单状态不正确")
	}

	now := time.Now()
	policy.Status = "active"
	policy.PaymentStatus = "paid"
	policy.PaymentID = paymentID
	policy.PaidAt = &now

	return s.insuranceRepo.UpdatePolicy(policy)
}

// CancelPolicy 取消保单
func (s *InsuranceService) CancelPolicy(policyID int64, reason string) error {
	policy, err := s.insuranceRepo.GetPolicyByID(policyID)
	if err != nil {
		return err
	}

	if policy.Status != "pending" && policy.Status != "active" {
		return errors.New("该保单无法取消")
	}

	policy.Status = "cancelled"
	policy.SpecialTerms = policy.SpecialTerms + "\n取消原因: " + reason

	return s.insuranceRepo.UpdatePolicy(policy)
}

// GetUserPolicies 获取用户保单列表
func (s *InsuranceService) GetUserPolicies(userID int64, page, pageSize int) ([]model.InsurancePolicy, int64, error) {
	return s.insuranceRepo.GetUserPolicies(userID, page, pageSize)
}

// GetPolicyByID 获取保单详情
func (s *InsuranceService) GetPolicyByID(policyID int64) (*model.InsurancePolicy, error) {
	return s.insuranceRepo.GetPolicyByID(policyID)
}

// CheckMandatoryInsurance 检查强制险
func (s *InsuranceService) CheckMandatoryInsurance(userID int64) (map[string]bool, error) {
	result := make(map[string]bool)
	
	// 检查第三者责任险
	hasLiability, err := s.insuranceRepo.CheckMandatoryInsurance(userID, "liability")
	if err != nil {
		return nil, err
	}
	result["liability"] = hasLiability

	// 检查飞手意外险(飞手角色)
	hasAccident, err := s.insuranceRepo.CheckMandatoryInsurance(userID, "accident")
	if err != nil {
		return nil, err
	}
	result["accident"] = hasAccident

	return result, nil
}

// ============================================================
// 理赔管理
// ============================================================

// ReportClaimRequest 报案请求
type ReportClaimRequest struct {
	PolicyID            int64     `json:"policy_id"`
	OrderID             int64     `json:"order_id"`
	ClaimantID          int64     `json:"claimant_id"`
	ClaimantName        string    `json:"claimant_name"`
	ClaimantPhone       string    `json:"claimant_phone"`
	IncidentType        string    `json:"incident_type"`
	IncidentTime        time.Time `json:"incident_time"`
	IncidentLocation    string    `json:"incident_location"`
	IncidentLat         float64   `json:"incident_lat"`
	IncidentLng         float64   `json:"incident_lng"`
	IncidentDescription string    `json:"incident_description"`
	LossType            string    `json:"loss_type"`
	EstimatedLoss       int64     `json:"estimated_loss"`
	EvidenceFiles       string    `json:"evidence_files"`
}

// ReportClaim 报案
func (s *InsuranceService) ReportClaim(req *ReportClaimRequest) (*model.InsuranceClaim, error) {
	// 验证保单
	policy, err := s.insuranceRepo.GetPolicyByID(req.PolicyID)
	if err != nil {
		return nil, errors.New("保单不存在")
	}

	if policy.Status != "active" {
		return nil, errors.New("保单未生效或已失效")
	}

	// 检查事故时间是否在保险期限内
	if req.IncidentTime.Before(policy.EffectiveFrom) || req.IncidentTime.After(policy.EffectiveTo) {
		return nil, errors.New("事故发生时间不在保险期限内")
	}

	claim := &model.InsuranceClaim{
		PolicyID:            req.PolicyID,
		PolicyNo:            policy.PolicyNo,
		OrderID:             req.OrderID,
		ClaimantID:          req.ClaimantID,
		ClaimantName:        req.ClaimantName,
		ClaimantPhone:       req.ClaimantPhone,
		IncidentType:        req.IncidentType,
		IncidentTime:        req.IncidentTime,
		IncidentLocation:    req.IncidentLocation,
		IncidentLat:         req.IncidentLat,
		IncidentLng:         req.IncidentLng,
		IncidentDescription: req.IncidentDescription,
		LossType:            req.LossType,
		EstimatedLoss:       req.EstimatedLoss,
		ClaimAmount:         req.EstimatedLoss, // 初始索赔金额 = 预估损失
		EvidenceFiles:       req.EvidenceFiles,
		Status:              "reported",
		CurrentStep:         "report",
	}

	if err := s.insuranceRepo.CreateClaim(claim); err != nil {
		return nil, err
	}

	// 记录时间线
	s.addClaimTimeline(claim.ID, "report", "用户报案", req.ClaimantID, "user", req.ClaimantName, "")

	// 更新保单状态
	policy.Status = "claimed"
	s.insuranceRepo.UpdatePolicy(policy)

	s.logger.Info("理赔报案成功",
		zap.String("claim_no", claim.ClaimNo),
		zap.String("incident_type", claim.IncidentType))

	return claim, nil
}

// UploadEvidence 上传证据
func (s *InsuranceService) UploadEvidence(claimID int64, evidenceType string, evidenceFiles string, userID int64, userName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "reported" && claim.Status != "investigating" {
		return errors.New("当前状态不允许上传证据")
	}

	// 根据证据类型更新对应字段
	switch evidenceType {
	case "evidence":
		claim.EvidenceFiles = evidenceFiles
	case "police_report":
		claim.PoliceReport = evidenceFiles
	case "medical_report":
		claim.MedicalReport = evidenceFiles
	case "repair_quote":
		claim.RepairQuote = evidenceFiles
	case "other":
		claim.OtherDocuments = evidenceFiles
	}

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "upload_evidence", "上传"+evidenceType+"证据", userID, "user", userName, evidenceFiles)
	return nil
}

// StartInvestigation 开始调查
func (s *InsuranceService) StartInvestigation(claimID int64, investigatorID int64, investigatorName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "reported" {
		return errors.New("只能对已报案的理赔单开始调查")
	}

	claim.Status = "investigating"
	claim.CurrentStep = "evidence"
	claim.InvestigatorID = investigatorID

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "investigate", "开始调查", investigatorID, "adjuster", investigatorName, "")
	return nil
}

// DetermineLiability 责任认定
func (s *InsuranceService) DetermineLiability(claimID int64, liabilityRatio float64, liabilityParty, liabilityReason string, actualLoss int64, adjusterID int64, adjusterName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "investigating" {
		return errors.New("只能对调查中的理赔单进行责任认定")
	}

	now := time.Now()
	claim.Status = "liability_determined"
	claim.CurrentStep = "liability"
	claim.LiabilityRatio = liabilityRatio
	claim.LiabilityParty = liabilityParty
	claim.LiabilityReason = liabilityReason
	claim.ActualLoss = actualLoss
	claim.InvestigatedAt = &now
	claim.DeterminedAt = &now

	// 计算核定金额
	approvedAmount := int64(float64(actualLoss) * liabilityRatio / 100)
	// 扣除免赔额
	if claim.Policy != nil {
		if approvedAmount > claim.Policy.DeductibleAmount {
			claim.DeductedAmount = claim.Policy.DeductibleAmount
			approvedAmount -= claim.Policy.DeductibleAmount
		} else {
			claim.DeductedAmount = approvedAmount
			approvedAmount = 0
		}
		// 不超过保额
		if approvedAmount > claim.Policy.CoverageAmount {
			approvedAmount = claim.Policy.CoverageAmount
		}
	}
	claim.ApprovedAmount = approvedAmount

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "determine_liability",
		"责任认定完成，责任方: "+liabilityParty+", 责任比例: "+string(rune(int(liabilityRatio)))+"%",
		adjusterID, "adjuster", adjusterName, "")
	return nil
}

// ApproveClaim 核赔通过
func (s *InsuranceService) ApproveClaim(claimID int64, approvedAmount int64, notes string, approverID int64, approverName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "liability_determined" {
		return errors.New("只能对已完成责任认定的理赔单进行核赔")
	}

	now := time.Now()
	claim.Status = "approved"
	claim.CurrentStep = "approve"
	claim.ApprovedAmount = approvedAmount
	claim.ApprovedAt = &now
	claim.ApproverID = approverID
	claim.AdjustmentNotes = notes

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "approve", "核赔通过，核定金额: "+formatAmount(approvedAmount), approverID, "admin", approverName, "")
	return nil
}

// RejectClaim 拒赔
func (s *InsuranceService) RejectClaim(claimID int64, reason string, approverID int64, approverName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "investigating" && claim.Status != "liability_determined" {
		return errors.New("当前状态不允许拒赔")
	}

	now := time.Now()
	claim.Status = "rejected"
	claim.CurrentStep = "close"
	claim.ApprovedAmount = 0
	claim.ApprovedAt = &now
	claim.ApproverID = approverID
	claim.RejectReason = reason
	claim.ClosedAt = &now

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "reject", "拒赔: "+reason, approverID, "admin", approverName, "")
	return nil
}

// PayClaim 赔付
func (s *InsuranceService) PayClaim(claimID int64, paidAmount int64, operatorID int64, operatorName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "approved" {
		return errors.New("只能对核赔通过的理赔单进行赔付")
	}

	now := time.Now()
	claim.Status = "paid"
	claim.CurrentStep = "pay"
	claim.PaidAmount = paidAmount
	claim.PaidAt = &now

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "pay", "已赔付: "+formatAmount(paidAmount), operatorID, "admin", operatorName, "")
	return nil
}

// CloseClaim 结案
func (s *InsuranceService) CloseClaim(claimID int64, operatorID int64, operatorName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "paid" && claim.Status != "rejected" {
		return errors.New("只能对已赔付或已拒赔的理赔单进行结案")
	}

	now := time.Now()
	claim.Status = "closed"
	claim.CurrentStep = "close"
	claim.ClosedAt = &now

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "close", "理赔结案", operatorID, "admin", operatorName, "")
	return nil
}

// DisputeClaim 争议申诉
func (s *InsuranceService) DisputeClaim(claimID int64, reason string, userID int64, userName string) error {
	claim, err := s.insuranceRepo.GetClaimByID(claimID)
	if err != nil {
		return err
	}

	if claim.Status != "rejected" && claim.Status != "approved" && claim.Status != "paid" {
		return errors.New("当前状态不允许申诉")
	}

	claim.Status = "disputed"
	claim.InvestigationNotes = claim.InvestigationNotes + "\n争议原因: " + reason

	if err := s.insuranceRepo.UpdateClaim(claim); err != nil {
		return err
	}

	s.addClaimTimeline(claimID, "appeal", "提交争议申诉: "+reason, userID, "user", userName, "")
	return nil
}

// GetUserClaims 获取用户理赔列表
func (s *InsuranceService) GetUserClaims(userID int64, page, pageSize int) ([]model.InsuranceClaim, int64, error) {
	return s.insuranceRepo.GetUserClaims(userID, page, pageSize)
}

// GetClaimByID 获取理赔详情
func (s *InsuranceService) GetClaimByID(claimID int64) (*model.InsuranceClaim, error) {
	return s.insuranceRepo.GetClaimByID(claimID)
}

// GetClaimTimelines 获取理赔时间线
func (s *InsuranceService) GetClaimTimelines(claimID int64) ([]model.ClaimTimeline, error) {
	return s.insuranceRepo.GetClaimTimelines(claimID)
}

// ListPendingClaims 获取待处理理赔
func (s *InsuranceService) ListPendingClaims(page, pageSize int) ([]model.InsuranceClaim, int64, error) {
	return s.insuranceRepo.ListPendingClaims(page, pageSize)
}

// ============================================================
// 保险产品管理
// ============================================================

func (s *InsuranceService) ListProducts(policyType string, isMandatory *bool) ([]model.InsuranceProduct, error) {
	return s.insuranceRepo.ListProducts(policyType, isMandatory)
}

func (s *InsuranceService) GetMandatoryProducts() ([]model.InsuranceProduct, error) {
	return s.insuranceRepo.GetMandatoryProducts()
}

func (s *InsuranceService) GetInsuranceStatistics() (map[string]interface{}, error) {
	return s.insuranceRepo.GetInsuranceStatistics()
}

// ============================================================
// 辅助方法
// ============================================================

func (s *InsuranceService) addClaimTimeline(claimID int64, action, description string, operatorID int64, operatorType, operatorName, attachments string) {
	timeline := &model.ClaimTimeline{
		ClaimID:      claimID,
		Action:       action,
		Description:  description,
		OperatorID:   operatorID,
		OperatorType: operatorType,
		OperatorName: operatorName,
		Attachments:  attachments,
	}
	s.insuranceRepo.CreateClaimTimeline(timeline)
}

func formatAmount(amount int64) string {
	return "¥" + string(rune(amount/100)) + "." + string(rune(amount%100))
}
