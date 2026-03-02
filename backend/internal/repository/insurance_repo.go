package repository

import (
	"wurenji-backend/internal/model"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type InsuranceRepository struct {
	db *gorm.DB
}

func NewInsuranceRepository(db *gorm.DB) *InsuranceRepository {
	return &InsuranceRepository{db: db}
}

// ============================================================
// InsurancePolicy 保险保单
// ============================================================

func (r *InsuranceRepository) CreatePolicy(policy *model.InsurancePolicy) error {
	policy.PolicyNo = fmt.Sprintf("POL%d%04d", time.Now().Unix(), policy.HolderID%10000)
	return r.db.Create(policy).Error
}

func (r *InsuranceRepository) GetPolicyByID(id int64) (*model.InsurancePolicy, error) {
	var policy model.InsurancePolicy
	err := r.db.First(&policy, id).Error
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *InsuranceRepository) GetPolicyByNo(policyNo string) (*model.InsurancePolicy, error) {
	var policy model.InsurancePolicy
	err := r.db.Where("policy_no = ?", policyNo).First(&policy).Error
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *InsuranceRepository) UpdatePolicy(policy *model.InsurancePolicy) error {
	return r.db.Save(policy).Error
}

func (r *InsuranceRepository) ListPolicies(holderID int64, policyType, status string, page, pageSize int) ([]model.InsurancePolicy, int64, error) {
	var policies []model.InsurancePolicy
	var total int64

	query := r.db.Model(&model.InsurancePolicy{})
	if holderID > 0 {
		query = query.Where("holder_id = ?", holderID)
	}
	if policyType != "" {
		query = query.Where("policy_type = ?", policyType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&policies).Error; err != nil {
		return nil, 0, err
	}

	return policies, total, nil
}

func (r *InsuranceRepository) GetUserPolicies(userID int64, page, pageSize int) ([]model.InsurancePolicy, int64, error) {
	return r.ListPolicies(userID, "", "", page, pageSize)
}

func (r *InsuranceRepository) GetActivePolicies(userID int64, policyType string) ([]model.InsurancePolicy, error) {
	var policies []model.InsurancePolicy
	now := time.Now()
	query := r.db.Where("holder_id = ? AND status = ? AND effective_from <= ? AND effective_to >= ?",
		userID, "active", now, now)
	if policyType != "" {
		query = query.Where("policy_type = ?", policyType)
	}
	err := query.Find(&policies).Error
	return policies, err
}

func (r *InsuranceRepository) GetPolicyByInsured(insuredType string, insuredID int64, policyType string) (*model.InsurancePolicy, error) {
	var policy model.InsurancePolicy
	now := time.Now()
	err := r.db.Where("insured_type = ? AND insured_id = ? AND policy_type = ? AND status = ? AND effective_from <= ? AND effective_to >= ?",
		insuredType, insuredID, policyType, "active", now, now).First(&policy).Error
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

func (r *InsuranceRepository) GetExpiredPolicies() ([]model.InsurancePolicy, error) {
	var policies []model.InsurancePolicy
	now := time.Now()
	err := r.db.Where("status = ? AND effective_to < ?", "active", now).Find(&policies).Error
	return policies, err
}

func (r *InsuranceRepository) UpdatePolicyStatus(policyID int64, status string) error {
	return r.db.Model(&model.InsurancePolicy{}).Where("id = ?", policyID).Update("status", status).Error
}

// ============================================================
// InsuranceClaim 保险理赔
// ============================================================

func (r *InsuranceRepository) CreateClaim(claim *model.InsuranceClaim) error {
	claim.ClaimNo = fmt.Sprintf("CLM%d%04d", time.Now().Unix(), claim.ClaimantID%10000)
	claim.ReportedAt = time.Now()
	claim.CurrentStep = "report"
	return r.db.Create(claim).Error
}

func (r *InsuranceRepository) GetClaimByID(id int64) (*model.InsuranceClaim, error) {
	var claim model.InsuranceClaim
	err := r.db.Preload("Policy").First(&claim, id).Error
	if err != nil {
		return nil, err
	}
	return &claim, nil
}

func (r *InsuranceRepository) GetClaimByNo(claimNo string) (*model.InsuranceClaim, error) {
	var claim model.InsuranceClaim
	err := r.db.Preload("Policy").Where("claim_no = ?", claimNo).First(&claim).Error
	if err != nil {
		return nil, err
	}
	return &claim, nil
}

func (r *InsuranceRepository) UpdateClaim(claim *model.InsuranceClaim) error {
	return r.db.Save(claim).Error
}

func (r *InsuranceRepository) ListClaims(claimantID int64, policyID int64, status string, page, pageSize int) ([]model.InsuranceClaim, int64, error) {
	var claims []model.InsuranceClaim
	var total int64

	query := r.db.Model(&model.InsuranceClaim{})
	if claimantID > 0 {
		query = query.Where("claimant_id = ?", claimantID)
	}
	if policyID > 0 {
		query = query.Where("policy_id = ?", policyID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Policy").Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&claims).Error; err != nil {
		return nil, 0, err
	}

	return claims, total, nil
}

func (r *InsuranceRepository) GetUserClaims(userID int64, page, pageSize int) ([]model.InsuranceClaim, int64, error) {
	return r.ListClaims(userID, 0, "", page, pageSize)
}

func (r *InsuranceRepository) GetPolicyClaims(policyID int64, page, pageSize int) ([]model.InsuranceClaim, int64, error) {
	return r.ListClaims(0, policyID, "", page, pageSize)
}

func (r *InsuranceRepository) GetClaimsByOrderID(orderID int64) ([]model.InsuranceClaim, error) {
	var claims []model.InsuranceClaim
	err := r.db.Preload("Policy").Where("order_id = ?", orderID).Order("created_at DESC").Find(&claims).Error
	return claims, err
}

func (r *InsuranceRepository) ListPendingClaims(page, pageSize int) ([]model.InsuranceClaim, int64, error) {
	var claims []model.InsuranceClaim
	var total int64

	query := r.db.Model(&model.InsuranceClaim{}).Where("status IN ?", []string{"reported", "investigating", "liability_determined"})
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Policy").Order("reported_at ASC").Offset(offset).Limit(pageSize).Find(&claims).Error; err != nil {
		return nil, 0, err
	}

	return claims, total, nil
}

// ============================================================
// ClaimTimeline 理赔时间线
// ============================================================

func (r *InsuranceRepository) CreateClaimTimeline(timeline *model.ClaimTimeline) error {
	return r.db.Create(timeline).Error
}

func (r *InsuranceRepository) GetClaimTimelines(claimID int64) ([]model.ClaimTimeline, error) {
	var timelines []model.ClaimTimeline
	err := r.db.Where("claim_id = ?", claimID).Order("created_at ASC").Find(&timelines).Error
	return timelines, err
}

// ============================================================
// InsuranceProduct 保险产品
// ============================================================

func (r *InsuranceRepository) GetProductByCode(code string) (*model.InsuranceProduct, error) {
	var product model.InsuranceProduct
	err := r.db.Where("product_code = ? AND is_active = ?", code, true).First(&product).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *InsuranceRepository) ListProducts(policyType string, isMandatory *bool) ([]model.InsuranceProduct, error) {
	var products []model.InsuranceProduct
	query := r.db.Where("is_active = ?", true)
	if policyType != "" {
		query = query.Where("policy_type = ?", policyType)
	}
	if isMandatory != nil {
		query = query.Where("is_mandatory = ?", *isMandatory)
	}
	err := query.Order("sort_order ASC").Find(&products).Error
	return products, err
}

func (r *InsuranceRepository) GetMandatoryProducts() ([]model.InsuranceProduct, error) {
	mandatory := true
	return r.ListProducts("", &mandatory)
}

func (r *InsuranceRepository) CreateProduct(product *model.InsuranceProduct) error {
	return r.db.Create(product).Error
}

func (r *InsuranceRepository) UpdateProduct(product *model.InsuranceProduct) error {
	return r.db.Save(product).Error
}

// ============================================================
// 统计查询
// ============================================================

func (r *InsuranceRepository) GetInsuranceStatistics() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 有效保单数
	var activePolicies int64
	r.db.Model(&model.InsurancePolicy{}).Where("status = ?", "active").Count(&activePolicies)
	stats["active_policies"] = activePolicies

	// 各类型保单数
	var typeStats []struct {
		PolicyType string `gorm:"column:policy_type"`
		Count      int64  `gorm:"column:count"`
	}
	r.db.Model(&model.InsurancePolicy{}).Select("policy_type, COUNT(*) as count").Group("policy_type").Scan(&typeStats)
	stats["policy_type_distribution"] = typeStats

	// 待处理理赔数
	var pendingClaims int64
	r.db.Model(&model.InsuranceClaim{}).Where("status IN ?", []string{"reported", "investigating", "liability_determined"}).Count(&pendingClaims)
	stats["pending_claims"] = pendingClaims

	// 本月理赔金额
	var monthlyPaid int64
	startOfMonth := time.Now().AddDate(0, 0, -time.Now().Day()+1)
	r.db.Model(&model.InsuranceClaim{}).Where("status = ? AND paid_at >= ?", "paid", startOfMonth).Select("COALESCE(SUM(paid_amount), 0)").Scan(&monthlyPaid)
	stats["monthly_paid_amount"] = monthlyPaid

	// 本月保费收入
	var monthlyPremium int64
	r.db.Model(&model.InsurancePolicy{}).Where("payment_status = ? AND paid_at >= ?", "paid", startOfMonth).Select("COALESCE(SUM(premium), 0)").Scan(&monthlyPremium)
	stats["monthly_premium"] = monthlyPremium

	return stats, nil
}

// 检查用户是否有有效的强制险
func (r *InsuranceRepository) CheckMandatoryInsurance(userID int64, policyType string) (bool, error) {
	var count int64
	now := time.Now()
	err := r.db.Model(&model.InsurancePolicy{}).
		Where("holder_id = ? AND policy_type = ? AND status = ? AND effective_from <= ? AND effective_to >= ?",
			userID, policyType, "active", now, now).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
