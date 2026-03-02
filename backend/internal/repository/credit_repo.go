package repository

import (
	"wurenji-backend/internal/model"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type CreditRepository struct {
	db *gorm.DB
}

func NewCreditRepository(db *gorm.DB) *CreditRepository {
	return &CreditRepository{db: db}
}

// ============================================================
// CreditScore 信用分相关
// ============================================================

func (r *CreditRepository) GetCreditScoreByUserID(userID int64) (*model.CreditScore, error) {
	var score model.CreditScore
	err := r.db.Where("user_id = ?", userID).First(&score).Error
	if err != nil {
		return nil, err
	}
	return &score, nil
}

func (r *CreditRepository) GetOrCreateCreditScore(userID int64, userType string) (*model.CreditScore, error) {
	var score model.CreditScore
	err := r.db.Where("user_id = ?", userID).First(&score).Error
	if err == gorm.ErrRecordNotFound {
		score = model.CreditScore{
			UserID:     userID,
			UserType:   userType,
			TotalScore: 600,
			ScoreLevel: "normal",
		}
		if err := r.db.Create(&score).Error; err != nil {
			return nil, err
		}
		return &score, nil
	}
	return &score, err
}

func (r *CreditRepository) UpdateCreditScore(score *model.CreditScore) error {
	return r.db.Save(score).Error
}

func (r *CreditRepository) ListCreditScores(userType string, scoreLevel string, page, pageSize int) ([]model.CreditScore, int64, error) {
	var scores []model.CreditScore
	var total int64

	query := r.db.Model(&model.CreditScore{})
	if userType != "" {
		query = query.Where("user_type = ?", userType)
	}
	if scoreLevel != "" {
		query = query.Where("score_level = ?", scoreLevel)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("total_score DESC").Offset(offset).Limit(pageSize).Find(&scores).Error; err != nil {
		return nil, 0, err
	}

	return scores, total, nil
}

func (r *CreditRepository) ListFrozenUsers(page, pageSize int) ([]model.CreditScore, int64, error) {
	var scores []model.CreditScore
	var total int64

	query := r.db.Model(&model.CreditScore{}).Where("is_frozen = ?", true)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("frozen_at DESC").Offset(offset).Limit(pageSize).Find(&scores).Error; err != nil {
		return nil, 0, err
	}

	return scores, total, nil
}

func (r *CreditRepository) ListBlacklistedUsers(page, pageSize int) ([]model.CreditScore, int64, error) {
	var scores []model.CreditScore
	var total int64

	query := r.db.Model(&model.CreditScore{}).Where("is_blacklisted = ?", true)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("blacklisted_at DESC").Offset(offset).Limit(pageSize).Find(&scores).Error; err != nil {
		return nil, 0, err
	}

	return scores, total, nil
}

func (r *CreditRepository) FreezeUser(userID int64, reason string) error {
	now := time.Now()
	return r.db.Model(&model.CreditScore{}).Where("user_id = ?", userID).Updates(map[string]interface{}{
		"is_frozen":     true,
		"frozen_reason": reason,
		"frozen_at":     now,
	}).Error
}

func (r *CreditRepository) UnfreezeUser(userID int64) error {
	return r.db.Model(&model.CreditScore{}).Where("user_id = ?", userID).Updates(map[string]interface{}{
		"is_frozen":     false,
		"frozen_reason": "",
		"frozen_at":     nil,
	}).Error
}

func (r *CreditRepository) BlacklistUser(userID int64, reason string) error {
	now := time.Now()
	return r.db.Model(&model.CreditScore{}).Where("user_id = ?", userID).Updates(map[string]interface{}{
		"is_blacklisted":     true,
		"blacklisted_reason": reason,
		"blacklisted_at":     now,
	}).Error
}

func (r *CreditRepository) RemoveFromBlacklist(userID int64) error {
	return r.db.Model(&model.CreditScore{}).Where("user_id = ?", userID).Updates(map[string]interface{}{
		"is_blacklisted":     false,
		"blacklisted_reason": "",
		"blacklisted_at":     nil,
	}).Error
}

// ============================================================
// CreditScoreLog 信用分变动日志
// ============================================================

func (r *CreditRepository) CreateCreditScoreLog(log *model.CreditScoreLog) error {
	return r.db.Create(log).Error
}

func (r *CreditRepository) ListCreditScoreLogs(userID int64, changeType string, page, pageSize int) ([]model.CreditScoreLog, int64, error) {
	var logs []model.CreditScoreLog
	var total int64

	query := r.db.Model(&model.CreditScoreLog{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if changeType != "" {
		query = query.Where("change_type = ?", changeType)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// ============================================================
// RiskControl 风控记录
// ============================================================

func (r *CreditRepository) CreateRiskControl(risk *model.RiskControl) error {
	risk.RiskNo = fmt.Sprintf("RISK%d%04d", time.Now().Unix(), risk.UserID%10000)
	return r.db.Create(risk).Error
}

func (r *CreditRepository) GetRiskControlByID(id int64) (*model.RiskControl, error) {
	var risk model.RiskControl
	err := r.db.First(&risk, id).Error
	if err != nil {
		return nil, err
	}
	return &risk, nil
}

func (r *CreditRepository) GetRiskControlByNo(riskNo string) (*model.RiskControl, error) {
	var risk model.RiskControl
	err := r.db.Where("risk_no = ?", riskNo).First(&risk).Error
	if err != nil {
		return nil, err
	}
	return &risk, nil
}

func (r *CreditRepository) UpdateRiskControl(risk *model.RiskControl) error {
	return r.db.Save(risk).Error
}

func (r *CreditRepository) ListRiskControls(userID int64, riskPhase, riskType, status string, page, pageSize int) ([]model.RiskControl, int64, error) {
	var risks []model.RiskControl
	var total int64

	query := r.db.Model(&model.RiskControl{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if riskPhase != "" {
		query = query.Where("risk_phase = ?", riskPhase)
	}
	if riskType != "" {
		query = query.Where("risk_type = ?", riskType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&risks).Error; err != nil {
		return nil, 0, err
	}

	return risks, total, nil
}

func (r *CreditRepository) ListPendingRiskControls(page, pageSize int) ([]model.RiskControl, int64, error) {
	return r.ListRiskControls(0, "", "", "pending", page, pageSize)
}

func (r *CreditRepository) GetRiskControlsByOrderID(orderID int64) ([]model.RiskControl, error) {
	var risks []model.RiskControl
	err := r.db.Where("order_id = ?", orderID).Order("created_at DESC").Find(&risks).Error
	return risks, err
}

// ============================================================
// Violation 违规记录
// ============================================================

func (r *CreditRepository) CreateViolation(violation *model.Violation) error {
	violation.ViolationNo = fmt.Sprintf("VIO%d%04d", time.Now().Unix(), violation.UserID%10000)
	return r.db.Create(violation).Error
}

func (r *CreditRepository) GetViolationByID(id int64) (*model.Violation, error) {
	var violation model.Violation
	err := r.db.First(&violation, id).Error
	if err != nil {
		return nil, err
	}
	return &violation, nil
}

func (r *CreditRepository) GetViolationByNo(violationNo string) (*model.Violation, error) {
	var violation model.Violation
	err := r.db.Where("violation_no = ?", violationNo).First(&violation).Error
	if err != nil {
		return nil, err
	}
	return &violation, nil
}

func (r *CreditRepository) UpdateViolation(violation *model.Violation) error {
	return r.db.Save(violation).Error
}

func (r *CreditRepository) ListViolations(userID int64, violationType, violationLevel, status string, page, pageSize int) ([]model.Violation, int64, error) {
	var violations []model.Violation
	var total int64

	query := r.db.Model(&model.Violation{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if violationType != "" {
		query = query.Where("violation_type = ?", violationType)
	}
	if violationLevel != "" {
		query = query.Where("violation_level = ?", violationLevel)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&violations).Error; err != nil {
		return nil, 0, err
	}

	return violations, total, nil
}

func (r *CreditRepository) ListUserViolations(userID int64, page, pageSize int) ([]model.Violation, int64, error) {
	return r.ListViolations(userID, "", "", "", page, pageSize)
}

func (r *CreditRepository) ListPendingAppeals(page, pageSize int) ([]model.Violation, int64, error) {
	var violations []model.Violation
	var total int64

	query := r.db.Model(&model.Violation{}).Where("appeal_status = ?", "pending")
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("appeal_at ASC").Offset(offset).Limit(pageSize).Find(&violations).Error; err != nil {
		return nil, 0, err
	}

	return violations, total, nil
}

func (r *CreditRepository) CountUserViolations(userID int64) (int64, error) {
	var count int64
	err := r.db.Model(&model.Violation{}).Where("user_id = ? AND status = ?", userID, "confirmed").Count(&count).Error
	return count, err
}

// ============================================================
// Blacklist 黑名单
// ============================================================

func (r *CreditRepository) CreateBlacklist(blacklist *model.Blacklist) error {
	blacklist.AddedAt = time.Now()
	return r.db.Create(blacklist).Error
}

func (r *CreditRepository) GetBlacklistByUserID(userID int64) (*model.Blacklist, error) {
	var blacklist model.Blacklist
	err := r.db.Where("user_id = ? AND is_active = ?", userID, true).First(&blacklist).Error
	if err != nil {
		return nil, err
	}
	return &blacklist, nil
}

func (r *CreditRepository) UpdateBlacklist(blacklist *model.Blacklist) error {
	return r.db.Save(blacklist).Error
}

func (r *CreditRepository) ListBlacklists(blacklistType string, isActive *bool, page, pageSize int) ([]model.Blacklist, int64, error) {
	var blacklists []model.Blacklist
	var total int64

	query := r.db.Model(&model.Blacklist{})
	if blacklistType != "" {
		query = query.Where("blacklist_type = ?", blacklistType)
	}
	if isActive != nil {
		query = query.Where("is_active = ?", *isActive)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("added_at DESC").Offset(offset).Limit(pageSize).Find(&blacklists).Error; err != nil {
		return nil, 0, err
	}

	return blacklists, total, nil
}

func (r *CreditRepository) IsUserBlacklisted(userID int64) (bool, error) {
	var count int64
	err := r.db.Model(&model.Blacklist{}).Where("user_id = ? AND is_active = ?", userID, true).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *CreditRepository) RemoveBlacklist(userID int64, removedBy int64, reason string) error {
	now := time.Now()
	return r.db.Model(&model.Blacklist{}).Where("user_id = ? AND is_active = ?", userID, true).Updates(map[string]interface{}{
		"is_active":      false,
		"removed_by":     removedBy,
		"removed_at":     now,
		"removed_reason": reason,
	}).Error
}

func (r *CreditRepository) GetExpiredTemporaryBlacklists() ([]model.Blacklist, error) {
	var blacklists []model.Blacklist
	now := time.Now()
	err := r.db.Where("blacklist_type = ? AND is_active = ? AND expire_at < ?", "temporary", true, now).Find(&blacklists).Error
	return blacklists, err
}

// ============================================================
// Deposit 保证金
// ============================================================

func (r *CreditRepository) CreateDeposit(deposit *model.Deposit) error {
	deposit.DepositNo = fmt.Sprintf("DEP%d%04d", time.Now().Unix(), deposit.UserID%10000)
	return r.db.Create(deposit).Error
}

func (r *CreditRepository) GetDepositByUserID(userID int64) (*model.Deposit, error) {
	var deposit model.Deposit
	err := r.db.Where("user_id = ?", userID).Order("created_at DESC").First(&deposit).Error
	if err != nil {
		return nil, err
	}
	return &deposit, nil
}

func (r *CreditRepository) GetDepositByID(id int64) (*model.Deposit, error) {
	var deposit model.Deposit
	err := r.db.First(&deposit, id).Error
	if err != nil {
		return nil, err
	}
	return &deposit, nil
}

func (r *CreditRepository) UpdateDeposit(deposit *model.Deposit) error {
	return r.db.Save(deposit).Error
}

func (r *CreditRepository) ListDeposits(userType, status string, page, pageSize int) ([]model.Deposit, int64, error) {
	var deposits []model.Deposit
	var total int64

	query := r.db.Model(&model.Deposit{})
	if userType != "" {
		query = query.Where("user_type = ?", userType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&deposits).Error; err != nil {
		return nil, 0, err
	}

	return deposits, total, nil
}

func (r *CreditRepository) GetUserDeposits(userID int64, page, pageSize int) ([]model.Deposit, int64, error) {
	var deposits []model.Deposit
	var total int64

	query := r.db.Model(&model.Deposit{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&deposits).Error; err != nil {
		return nil, 0, err
	}

	return deposits, total, nil
}

// ============================================================
// 统计查询
// ============================================================

func (r *CreditRepository) GetCreditStatistics() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 各等级用户数
	var levelStats []struct {
		ScoreLevel string `gorm:"column:score_level"`
		Count      int64  `gorm:"column:count"`
	}
	r.db.Model(&model.CreditScore{}).Select("score_level, COUNT(*) as count").Group("score_level").Scan(&levelStats)
	stats["level_distribution"] = levelStats

	// 冻结用户数
	var frozenCount int64
	r.db.Model(&model.CreditScore{}).Where("is_frozen = ?", true).Count(&frozenCount)
	stats["frozen_users"] = frozenCount

	// 黑名单用户数
	var blacklistedCount int64
	r.db.Model(&model.Blacklist{}).Where("is_active = ?", true).Count(&blacklistedCount)
	stats["blacklisted_users"] = blacklistedCount

	// 待处理违规数
	var pendingViolations int64
	r.db.Model(&model.Violation{}).Where("status = ?", "pending").Count(&pendingViolations)
	stats["pending_violations"] = pendingViolations

	// 待处理风控数
	var pendingRisks int64
	r.db.Model(&model.RiskControl{}).Where("status = ?", "pending").Count(&pendingRisks)
	stats["pending_risks"] = pendingRisks

	// 待处理申诉数
	var pendingAppeals int64
	r.db.Model(&model.Violation{}).Where("appeal_status = ?", "pending").Count(&pendingAppeals)
	stats["pending_appeals"] = pendingAppeals

	return stats, nil
}
