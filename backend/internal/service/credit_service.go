package service

import (
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
	"errors"
	"time"
)

type CreditService struct {
	creditRepo *repository.CreditRepository
}

func NewCreditService(creditRepo *repository.CreditRepository) *CreditService {
	return &CreditService{creditRepo: creditRepo}
}

// ============================================================
// 信用分计算逻辑
// ============================================================

// 计算信用等级
func (s *CreditService) CalculateScoreLevel(score int) string {
	if score >= 800 {
		return "excellent"
	} else if score >= 700 {
		return "good"
	} else if score >= 600 {
		return "normal"
	} else if score >= 400 {
		return "poor"
	}
	return "bad"
}

// GetOrCreateCreditScore 获取或创建用户信用分
func (s *CreditService) GetOrCreateCreditScore(userID int64, userType string) (*model.CreditScore, error) {
	return s.creditRepo.GetOrCreateCreditScore(userID, userType)
}

// GetUserCreditScore 获取用户信用分
func (s *CreditService) GetUserCreditScore(userID int64) (*model.CreditScore, error) {
	return s.creditRepo.GetCreditScoreByUserID(userID)
}

// InitializePilotCredit 初始化飞手信用分
func (s *CreditService) InitializePilotCredit(userID int64, hasLicense bool, isVerified bool) error {
	score, err := s.creditRepo.GetOrCreateCreditScore(userID, "pilot")
	if err != nil {
		return err
	}

	// 基础资质分(0-200)
	qualificationScore := 100 // 基础分
	if hasLicense {
		qualificationScore += 50 // 有执照
	}
	if isVerified {
		qualificationScore += 50 // 已认证
	}

	score.PilotQualification = qualificationScore
	score.PilotService = 150    // 服务质量初始分(满分300)
	score.PilotSafety = 200     // 安全记录初始分(满分300)
	score.PilotActivity = 50    // 活跃度初始分(满分200)

	score.TotalScore = qualificationScore + score.PilotService + score.PilotSafety + score.PilotActivity
	score.ScoreLevel = s.CalculateScoreLevel(score.TotalScore)
	now := time.Now()
	score.LastCalculatedAt = &now

	return s.creditRepo.UpdateCreditScore(score)
}

// InitializeOwnerCredit 初始化机主信用分
func (s *CreditService) InitializeOwnerCredit(userID int64, droneCount int, hasInsurance bool) error {
	score, err := s.creditRepo.GetOrCreateCreditScore(userID, "owner")
	if err != nil {
		return err
	}

	// 设备合规分(0-250)
	complianceScore := 100 // 基础分
	if hasInsurance {
		complianceScore += 100 // 有保险
	}
	if droneCount > 0 {
		complianceScore += min(50, droneCount*10) // 每架无人机+10分，最多+50
	}

	score.OwnerCompliance = complianceScore
	score.OwnerService = 150     // 服务质量初始分(满分300)
	score.OwnerFulfillment = 150 // 履约能力初始分(满分250)
	score.OwnerAttitude = 100    // 合作态度初始分(满分200)

	score.TotalScore = complianceScore + score.OwnerService + score.OwnerFulfillment + score.OwnerAttitude
	score.ScoreLevel = s.CalculateScoreLevel(score.TotalScore)
	now := time.Now()
	score.LastCalculatedAt = &now

	return s.creditRepo.UpdateCreditScore(score)
}

// InitializeClientCredit 初始化业主/客户信用分
func (s *CreditService) InitializeClientCredit(userID int64, isVerified bool, hasCompany bool) error {
	score, err := s.creditRepo.GetOrCreateCreditScore(userID, "client")
	if err != nil {
		return err
	}

	// 身份认证分(0-200)
	identityScore := 100 // 基础分
	if isVerified {
		identityScore += 50 // 已实名
	}
	if hasCompany {
		identityScore += 50 // 企业认证
	}

	score.ClientIdentity = identityScore
	score.ClientPayment = 150      // 支付能力初始分(满分300)
	score.ClientAttitude = 150     // 合作态度初始分(满分300)
	score.ClientOrderQuality = 100 // 订单质量初始分(满分200)

	score.TotalScore = identityScore + score.ClientPayment + score.ClientAttitude + score.ClientOrderQuality
	score.ScoreLevel = s.CalculateScoreLevel(score.TotalScore)
	now := time.Now()
	score.LastCalculatedAt = &now

	return s.creditRepo.UpdateCreditScore(score)
}

// UpdateCreditAfterOrder 订单完成后更新信用分
func (s *CreditService) UpdateCreditAfterOrder(userID int64, rating float64, isCompleted bool, hasCancelled bool) error {
	score, err := s.creditRepo.GetCreditScoreByUserID(userID)
	if err != nil {
		return err
	}

	scoreBefore := score.TotalScore
	var changeReason string
	var dimension string

	// 更新订单统计
	score.TotalOrders++
	if isCompleted {
		score.CompletedOrders++
		changeReason = "订单完成"
	}
	if hasCancelled {
		score.CancelledOrders++
		changeReason = "订单取消"
	}

	// 根据评分调整
	score.TotalReviews++
	if rating >= 4.0 {
		score.PositiveReviews++
	} else if rating < 3.0 {
		score.NegativeReviews++
	}

	// 更新平均评分
	totalRating := score.AverageRating*float64(score.TotalReviews-1) + rating
	score.AverageRating = totalRating / float64(score.TotalReviews)

	// 根据用户类型调整相应维度
	scoreChange := 0
	switch score.UserType {
	case "pilot":
		dimension = "service"
		if rating >= 4.5 {
			scoreChange = 5
			score.PilotService = min(300, score.PilotService+5)
		} else if rating < 3.0 {
			scoreChange = -10
			score.PilotService = max(0, score.PilotService-10)
		}
		if hasCancelled {
			scoreChange = -15
			score.PilotService = max(0, score.PilotService-15)
		}
	case "owner":
		dimension = "service"
		if rating >= 4.5 {
			scoreChange = 5
			score.OwnerService = min(300, score.OwnerService+5)
		} else if rating < 3.0 {
			scoreChange = -10
			score.OwnerService = max(0, score.OwnerService-10)
		}
	case "client":
		dimension = "attitude"
		if rating >= 4.5 {
			scoreChange = 3
			score.ClientAttitude = min(300, score.ClientAttitude+3)
		} else if rating < 3.0 {
			scoreChange = -5
			score.ClientAttitude = max(0, score.ClientAttitude-5)
		}
	}

	// 重新计算总分
	s.recalculateTotalScore(score)
	now := time.Now()
	score.LastCalculatedAt = &now

	if err := s.creditRepo.UpdateCreditScore(score); err != nil {
		return err
	}

	// 记录日志
	return s.creditRepo.CreateCreditScoreLog(&model.CreditScoreLog{
		UserID:       userID,
		ChangeType:   "order_complete",
		ChangeReason: changeReason,
		Dimension:    dimension,
		ScoreBefore:  scoreBefore,
		ScoreAfter:   score.TotalScore,
		ScoreChange:  scoreChange,
		OperatorType: "system",
	})
}

// 重新计算总分
func (s *CreditService) recalculateTotalScore(score *model.CreditScore) {
	switch score.UserType {
	case "pilot":
		score.TotalScore = score.PilotQualification + score.PilotService + score.PilotSafety + score.PilotActivity
	case "owner":
		score.TotalScore = score.OwnerCompliance + score.OwnerService + score.OwnerFulfillment + score.OwnerAttitude
	case "client":
		score.TotalScore = score.ClientIdentity + score.ClientPayment + score.ClientAttitude + score.ClientOrderQuality
	}
	score.ScoreLevel = s.CalculateScoreLevel(score.TotalScore)
}

// ============================================================
// 违规处理
// ============================================================

// CreateViolation 创建违规记录
func (s *CreditService) CreateViolation(violation *model.Violation) error {
	// 设置违规等级对应的处罚
	switch violation.ViolationLevel {
	case "minor":
		violation.Penalty = "warning"
		violation.ScoreDeduction = 10
	case "moderate":
		violation.Penalty = "score_deduct"
		violation.ScoreDeduction = 30
		violation.FreezeDays = 3
	case "serious":
		violation.Penalty = "freeze_temp"
		violation.ScoreDeduction = 70
		violation.FreezeDays = 14
	case "critical":
		violation.Penalty = "blacklist"
		violation.ScoreDeduction = 150
	}

	return s.creditRepo.CreateViolation(violation)
}

// ConfirmViolation 确认违规并执行处罚
func (s *CreditService) ConfirmViolation(violationID int64, confirmedBy int64) error {
	violation, err := s.creditRepo.GetViolationByID(violationID)
	if err != nil {
		return err
	}

	if violation.Status != "pending" {
		return errors.New("违规记录状态不正确")
	}

	// 更新违规状态
	now := time.Now()
	violation.Status = "confirmed"
	violation.ConfirmedBy = confirmedBy
	violation.ConfirmedAt = &now

	if err := s.creditRepo.UpdateViolation(violation); err != nil {
		return err
	}

	// 扣除信用分
	score, err := s.creditRepo.GetCreditScoreByUserID(violation.UserID)
	if err != nil {
		return err
	}

	scoreBefore := score.TotalScore
	score.ViolationCount++
	score.LastViolationAt = &now

	// 根据违规类型扣除相应维度分数
	switch score.UserType {
	case "pilot":
		score.PilotSafety = max(0, score.PilotSafety-violation.ScoreDeduction)
	case "owner":
		score.OwnerFulfillment = max(0, score.OwnerFulfillment-violation.ScoreDeduction)
	case "client":
		score.ClientAttitude = max(0, score.ClientAttitude-violation.ScoreDeduction)
	}

	s.recalculateTotalScore(score)

	// 根据处罚类型执行操作
	switch violation.Penalty {
	case "freeze_temp":
		score.IsFrozen = true
		score.FrozenReason = violation.Description
		score.FrozenAt = &now
	case "blacklist":
		score.IsBlacklisted = true
		score.BlacklistedReason = violation.Description
		score.BlacklistedAt = &now
		// 同时添加到黑名单表
		s.creditRepo.CreateBlacklist(&model.Blacklist{
			UserID:             violation.UserID,
			UserType:           score.UserType,
			BlacklistType:      "permanent",
			Reason:             violation.Description,
			RelatedViolationID: violation.ID,
			AddedBy:            confirmedBy,
		})
	}

	if err := s.creditRepo.UpdateCreditScore(score); err != nil {
		return err
	}

	// 记录信用分变动日志
	return s.creditRepo.CreateCreditScoreLog(&model.CreditScoreLog{
		UserID:       violation.UserID,
		ChangeType:   "violation",
		ChangeReason: "违规处罚: " + violation.ViolationType,
		Dimension:    "safety",
		ScoreBefore:  scoreBefore,
		ScoreAfter:   score.TotalScore,
		ScoreChange:  -violation.ScoreDeduction,
		OperatorID:   confirmedBy,
		OperatorType: "admin",
	})
}

// SubmitAppeal 提交申诉
func (s *CreditService) SubmitAppeal(violationID int64, content string) error {
	violation, err := s.creditRepo.GetViolationByID(violationID)
	if err != nil {
		return err
	}

	if violation.AppealStatus != "none" {
		return errors.New("已提交过申诉")
	}

	now := time.Now()
	violation.AppealStatus = "pending"
	violation.AppealContent = content
	violation.AppealAt = &now
	violation.Status = "appealing"

	return s.creditRepo.UpdateViolation(violation)
}

// ReviewAppeal 审核申诉
func (s *CreditService) ReviewAppeal(violationID int64, approved bool, reviewedBy int64, result string) error {
	violation, err := s.creditRepo.GetViolationByID(violationID)
	if err != nil {
		return err
	}

	if violation.AppealStatus != "pending" {
		return errors.New("申诉状态不正确")
	}

	now := time.Now()
	violation.AppealReviewedBy = reviewedBy
	violation.AppealReviewedAt = &now
	violation.AppealResult = result

	if approved {
		violation.AppealStatus = "approved"
		violation.Status = "revoked"
		// 恢复信用分
		return s.restoreCreditAfterAppeal(violation, reviewedBy)
	}

	violation.AppealStatus = "rejected"
	return s.creditRepo.UpdateViolation(violation)
}

// 申诉成功后恢复信用分
func (s *CreditService) restoreCreditAfterAppeal(violation *model.Violation, operatorID int64) error {
	if err := s.creditRepo.UpdateViolation(violation); err != nil {
		return err
	}

	score, err := s.creditRepo.GetCreditScoreByUserID(violation.UserID)
	if err != nil {
		return err
	}

	scoreBefore := score.TotalScore

	// 恢复扣除的分数
	switch score.UserType {
	case "pilot":
		score.PilotSafety = min(300, score.PilotSafety+violation.ScoreDeduction)
	case "owner":
		score.OwnerFulfillment = min(250, score.OwnerFulfillment+violation.ScoreDeduction)
	case "client":
		score.ClientAttitude = min(300, score.ClientAttitude+violation.ScoreDeduction)
	}

	score.ViolationCount = max(0, score.ViolationCount-1)
	s.recalculateTotalScore(score)

	// 解除冻结/黑名单
	if violation.Penalty == "freeze_temp" {
		score.IsFrozen = false
		score.FrozenReason = ""
		score.FrozenAt = nil
	}
	if violation.Penalty == "blacklist" {
		score.IsBlacklisted = false
		score.BlacklistedReason = ""
		score.BlacklistedAt = nil
		s.creditRepo.RemoveBlacklist(violation.UserID, operatorID, "申诉成功")
	}

	if err := s.creditRepo.UpdateCreditScore(score); err != nil {
		return err
	}

	return s.creditRepo.CreateCreditScoreLog(&model.CreditScoreLog{
		UserID:       violation.UserID,
		ChangeType:   "bonus",
		ChangeReason: "申诉成功，恢复信用分",
		ScoreBefore:  scoreBefore,
		ScoreAfter:   score.TotalScore,
		ScoreChange:  violation.ScoreDeduction,
		OperatorID:   operatorID,
		OperatorType: "admin",
	})
}

// ============================================================
// 风控检测
// ============================================================

// PreOrderRiskCheck 订单前风控检查
func (s *CreditService) PreOrderRiskCheck(userID int64, orderID int64) (*model.RiskControl, error) {
	// 检查是否黑名单
	isBlacklisted, err := s.creditRepo.IsUserBlacklisted(userID)
	if err != nil {
		return nil, err
	}
	if isBlacklisted {
		return s.createRiskRecord(userID, orderID, "pre", "blacklist", "critical", 100, "用户在黑名单中")
	}

	// 检查信用分
	score, err := s.creditRepo.GetCreditScoreByUserID(userID)
	if err != nil {
		return nil, nil // 新用户没有信用分，不触发风控
	}

	// 信用分过低
	if score.TotalScore < 400 {
		return s.createRiskRecord(userID, orderID, "pre", "behavior_abnormal", "high", 70, "信用分过低")
	}

	// 频繁取消
	if score.CancelledOrders > 5 && float64(score.CancelledOrders)/float64(score.TotalOrders) > 0.3 {
		return s.createRiskRecord(userID, orderID, "pre", "behavior_abnormal", "medium", 50, "取消率过高")
	}

	// 频繁违规
	if score.ViolationCount >= 3 {
		return s.createRiskRecord(userID, orderID, "pre", "violation", "high", 60, "违规记录过多")
	}

	return nil, nil
}

// 创建风控记录
func (s *CreditService) createRiskRecord(userID, orderID int64, phase, riskType, level string, score int, desc string) (*model.RiskControl, error) {
	risk := &model.RiskControl{
		UserID:      userID,
		OrderID:     orderID,
		RiskPhase:   phase,
		RiskType:    riskType,
		RiskLevel:   level,
		RiskScore:   score,
		Description: desc,
		Status:      "pending",
	}

	// 设置建议处置措施
	switch level {
	case "critical":
		risk.Action = "block_order"
	case "high":
		risk.Action = "require_deposit"
	case "medium":
		risk.Action = "warn"
	default:
		risk.Action = "none"
	}

	if err := s.creditRepo.CreateRiskControl(risk); err != nil {
		return nil, err
	}
	return risk, nil
}

// ReviewRiskControl 审核风控记录
func (s *CreditService) ReviewRiskControl(riskID int64, action string, reviewedBy int64, notes string) error {
	risk, err := s.creditRepo.GetRiskControlByID(riskID)
	if err != nil {
		return err
	}

	now := time.Now()
	risk.Status = "resolved"
	risk.Action = action
	risk.ReviewedBy = reviewedBy
	risk.ReviewedAt = &now
	risk.ReviewNotes = notes
	risk.ResolvedAt = &now

	// 执行处置措施
	switch action {
	case "freeze":
		s.creditRepo.FreezeUser(risk.UserID, "风控处置："+risk.Description)
	case "blacklist":
		s.creditRepo.BlacklistUser(risk.UserID, "风控处置："+risk.Description)
	}

	return s.creditRepo.UpdateRiskControl(risk)
}

// ============================================================
// 保证金管理
// ============================================================

// RequireDeposit 要求缴纳保证金
func (s *CreditService) RequireDeposit(userID int64, userType string, amount int64, reason string) (*model.Deposit, error) {
	deposit := &model.Deposit{
		UserID:         userID,
		UserType:       userType,
		RequiredAmount: amount,
		Status:         "pending",
		RequireReason:  reason,
	}

	if err := s.creditRepo.CreateDeposit(deposit); err != nil {
		return nil, err
	}
	return deposit, nil
}

// PayDeposit 缴纳保证金
func (s *CreditService) PayDeposit(depositID int64, paymentID int64, amount int64) error {
	deposit, err := s.creditRepo.GetDepositByID(depositID)
	if err != nil {
		return err
	}

	now := time.Now()
	deposit.PaidAmount += amount
	deposit.PaymentID = paymentID
	deposit.PaidAt = &now

	if deposit.PaidAmount >= deposit.RequiredAmount {
		deposit.Status = "paid"
	} else {
		deposit.Status = "partial"
	}

	return s.creditRepo.UpdateDeposit(deposit)
}

// RefundDeposit 退还保证金
func (s *CreditService) RefundDeposit(depositID int64, reason string) error {
	deposit, err := s.creditRepo.GetDepositByID(depositID)
	if err != nil {
		return err
	}

	now := time.Now()
	deposit.RefundedAmount = deposit.PaidAmount - deposit.FrozenAmount
	deposit.Status = "refunded"
	deposit.RefundedAt = &now
	deposit.RefundReason = reason

	return s.creditRepo.UpdateDeposit(deposit)
}

// ============================================================
// 列表查询
// ============================================================

func (s *CreditService) ListCreditScores(userType, scoreLevel string, page, pageSize int) ([]model.CreditScore, int64, error) {
	return s.creditRepo.ListCreditScores(userType, scoreLevel, page, pageSize)
}

func (s *CreditService) ListCreditScoreLogs(userID int64, changeType string, page, pageSize int) ([]model.CreditScoreLog, int64, error) {
	return s.creditRepo.ListCreditScoreLogs(userID, changeType, page, pageSize)
}

func (s *CreditService) ListViolations(userID int64, violationType, violationLevel, status string, page, pageSize int) ([]model.Violation, int64, error) {
	return s.creditRepo.ListViolations(userID, violationType, violationLevel, status, page, pageSize)
}

func (s *CreditService) ListRiskControls(userID int64, riskPhase, riskType, status string, page, pageSize int) ([]model.RiskControl, int64, error) {
	return s.creditRepo.ListRiskControls(userID, riskPhase, riskType, status, page, pageSize)
}

func (s *CreditService) ListBlacklists(blacklistType string, isActive *bool, page, pageSize int) ([]model.Blacklist, int64, error) {
	return s.creditRepo.ListBlacklists(blacklistType, isActive, page, pageSize)
}

func (s *CreditService) ListDeposits(userType, status string, page, pageSize int) ([]model.Deposit, int64, error) {
	return s.creditRepo.ListDeposits(userType, status, page, pageSize)
}

func (s *CreditService) GetViolationByID(id int64) (*model.Violation, error) {
	return s.creditRepo.GetViolationByID(id)
}

func (s *CreditService) GetRiskControlByID(id int64) (*model.RiskControl, error) {
	return s.creditRepo.GetRiskControlByID(id)
}

func (s *CreditService) GetDepositByUserID(userID int64) (*model.Deposit, error) {
	return s.creditRepo.GetDepositByUserID(userID)
}

func (s *CreditService) GetCreditStatistics() (map[string]interface{}, error) {
	return s.creditRepo.GetCreditStatistics()
}
