package service

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const simulatedIDVerificationAutoApproveDelay = time.Minute

const (
	providerStatusNone          = "none"
	providerStatusPendingReview = "pending_review"
	providerStatusApproved      = "approved"
	providerStatusRejected      = "rejected"
	providerStatusSuspended     = "suspended"

	providerNextActionStartOnboarding = "start_onboarding"
	providerNextActionWaitReview      = "wait_review"
	providerNextActionFixRejected     = "fix_rejected"
	providerNextActionOpenWorkbench   = "open_workbench"
)

type ProviderRoleSummary struct {
	Status             string `json:"status"`
	AssetStatus        string `json:"asset_status"`
	ExecutorStatus     string `json:"executor_status"`
	CanUseWorkbench    bool   `json:"can_use_workbench"`
	CanQuote           bool   `json:"can_quote"`
	CanArrangeDispatch bool   `json:"can_arrange_dispatch"`
	CanAcceptDispatch  bool   `json:"can_accept_dispatch"`
	CanSelfExecute     bool   `json:"can_self_execute"`
	NextAction         string `json:"next_action"`
}

type RoleSummary struct {
	HasClientRole     bool                `json:"has_client_role"`
	HasOwnerRole      bool                `json:"has_owner_role"`
	HasPilotRole      bool                `json:"has_pilot_role"`
	CanPublishSupply  bool                `json:"can_publish_supply"`
	CanAcceptDispatch bool                `json:"can_accept_dispatch"`
	CanSelfExecute    bool                `json:"can_self_execute"`
	Provider          ProviderRoleSummary `json:"provider"`
}

type MeUser struct {
	ID            int64  `json:"id"`
	Phone         string `json:"phone"`
	Nickname      string `json:"nickname"`
	AvatarURL     string `json:"avatar_url"`
	IDVerified    string `json:"id_verified"`
	PreferredMode string `json:"preferred_mode"`
}

type MeSummary struct {
	User        MeUser      `json:"user"`
	RoleSummary RoleSummary `json:"role_summary"`
}

type UserService struct {
	userRepo        *repository.UserRepo
	clientRepo      *repository.ClientRepo
	roleProfileRepo *repository.RoleProfileRepo
	droneRepo       *repository.DroneRepo
	pilotRepo       *repository.PilotRepo
}

func NewUserService(
	userRepo *repository.UserRepo,
	clientRepo *repository.ClientRepo,
	roleProfileRepo *repository.RoleProfileRepo,
	droneRepo *repository.DroneRepo,
	pilotRepo *repository.PilotRepo,
) *UserService {
	return &UserService{
		userRepo:        userRepo,
		clientRepo:      clientRepo,
		roleProfileRepo: roleProfileRepo,
		droneRepo:       droneRepo,
		pilotRepo:       pilotRepo,
	}
}

func (s *UserService) GetProfile(userID int64) (*model.User, error) {
	return s.userRepo.GetByID(userID)
}

func (s *UserService) GetProviderRating(userID int64) float64 {
	rating := s.GetProviderRatingNullable(userID)
	if rating == nil {
		return 4.5
	}
	return *rating
}

func (s *UserService) GetProviderCompletionRate(userID int64) float64 {
	rate := s.GetProviderCompletionRateNullable(userID)
	if rate == nil {
		return 1.0
	}
	return *rate
}

func (s *UserService) GetProviderRatingNullable(userID int64) *float64 {
	if s == nil || s.userRepo == nil || s.userRepo.DB() == nil || userID <= 0 {
		return nil
	}
	var avg sql.NullFloat64
	if err := s.userRepo.DB().Model(&model.Review{}).
		Where("reviewee_id = ?", userID).
		Where("(target_type = '' OR target_type IN ? OR target_type IS NULL)", []string{"user", "owner", "pilot", "provider"}).
		Select("AVG(rating)").
		Scan(&avg).Error; err != nil || !avg.Valid {
		return nil
	}
	value := avg.Float64
	return &value
}

func (s *UserService) GetProviderCompletionRateNullable(userID int64) *float64 {
	if s == nil || s.userRepo == nil || s.userRepo.DB() == nil || userID <= 0 {
		return nil
	}
	db := s.userRepo.DB().Model(&model.Order{}).
		Where("(provider_user_id = ? OR owner_id = ?)", userID, userID)

	var completed int64
	if err := db.Session(&gorm.Session{}).
		Where("status = ?", "completed").
		Count(&completed).Error; err != nil {
		return nil
	}

	var failed int64
	if err := db.Session(&gorm.Session{}).
		Where("(status = ? OR (status = ? AND cancel_by IN ?))", "provider_rejected", "cancelled", []string{"provider", "owner"}).
		Count(&failed).Error; err != nil {
		return nil
	}

	total := completed + failed
	if total <= 0 {
		return nil
	}
	value := float64(completed) / float64(total)
	return &value
}

func (s *UserService) GetTodayProviderIncomeCents(userID int64, today time.Time) (int64, error) {
	if s == nil || s.userRepo == nil || s.userRepo.DB() == nil || userID <= 0 {
		return 0, nil
	}
	if today.IsZero() {
		now := time.Now()
		today = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	}
	db := s.userRepo.DB()
	// 优先按 wallet_transactions 今日 income 流水统计服务商净收入。
	if db.Migrator().HasTable(&model.WalletTransaction{}) {
		var income sql.NullInt64
		if err := db.Model(&model.WalletTransaction{}).
			Where("user_id = ?", userID).
			Where("type = ?", "income").
			Where("created_at >= ?", today).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&income).Error; err == nil {
			if income.Valid {
				return income.Int64, nil
			}
			return 0, nil
		}
	}
	return s.getTodayProviderSettlementIncomeCents(userID, today)
}

func (s *UserService) getTodayProviderSettlementIncomeCents(userID int64, today time.Time) (int64, error) {
	var income sql.NullInt64
	// wallet_transactions 不可用时按 order_settlements 的 today 净分账兜底。
	err := s.userRepo.DB().Model(&model.OrderSettlement{}).
		Where("status = ?", "settled").
		Where("settled_at IS NOT NULL AND settled_at >= ?", today).
		Where("(pilot_user_id = ? OR owner_user_id = ? OR partial_handover_provider_user_id = ?)", userID, userID, userID).
		Select(`COALESCE(SUM(
			CASE WHEN pilot_user_id = ? THEN pilot_fee ELSE 0 END +
			CASE WHEN owner_user_id = ? THEN owner_fee ELSE 0 END +
			CASE WHEN partial_handover_provider_user_id = ? THEN partial_handover_amount ELSE 0 END
		), 0)`, userID, userID, userID).
		Scan(&income).Error
	if err != nil || !income.Valid {
		return 0, err
	}
	return income.Int64, nil
}

func (s *UserService) GetMe(userID int64) (*MeSummary, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}

	roleSummary, err := s.GetRoleSummary(userID)
	if err != nil {
		return nil, err
	}

	return &MeSummary{
		User: MeUser{
			ID:            user.ID,
			Phone:         user.Phone,
			Nickname:      user.Nickname,
			AvatarURL:     user.AvatarURL,
			IDVerified:    user.IDVerified,
			PreferredMode: user.PreferredMode,
		},
		RoleSummary: *roleSummary,
	}, nil
}

func (s *UserService) GetRoleSummary(userID int64) (*RoleSummary, error) {
	summary := &RoleSummary{}
	assetStatus := providerStatusNone
	executorStatus := providerStatusNone
	executorOnline := false

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}

	summary.HasClientRole = user.UserType != "admin"
	if s.clientRepo != nil {
		if _, err := s.clientRepo.GetByUserID(userID); err == nil {
			summary.HasClientRole = true
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if s.roleProfileRepo != nil {
		if _, err := s.roleProfileRepo.GetClientProfileByUserID(userID); err == nil {
			summary.HasClientRole = true
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		if ownerProfile, err := s.roleProfileRepo.GetOwnerProfileByUserID(userID); err == nil {
			summary.HasOwnerRole = true
			assetStatus = combineProviderCapabilityStatus(assetStatus, ownerProfileStatus(ownerProfile))
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		if pilotProfile, err := s.roleProfileRepo.GetPilotProfileByUserID(userID); err == nil {
			summary.HasPilotRole = true
			executorStatus = combineProviderCapabilityStatus(executorStatus, statusFromVerification(pilotProfile.VerificationStatus))
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if s.droneRepo != nil {
		if total, err := s.droneRepo.CountByOwner(userID); err != nil {
			return nil, err
		} else if total > 0 {
			summary.HasOwnerRole = true
			assetStatus = combineProviderCapabilityStatus(assetStatus, providerStatusPendingReview)
		}

		if total, err := s.droneRepo.CountMarketplaceEligibleByOwner(userID); err != nil {
			return nil, err
		} else if total > 0 {
			summary.HasOwnerRole = true
			assetStatus = providerStatusApproved
		}
	}

	if s.pilotRepo != nil {
		pilot, err := s.pilotRepo.GetByUserID(userID)
		if err == nil && pilot != nil {
			summary.HasPilotRole = true
			executorStatus = combineProviderCapabilityStatus(executorStatus, statusFromVerification(pilot.VerificationStatus))
			executorOnline = strings.EqualFold(strings.TrimSpace(pilot.AvailabilityStatus), "online")
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	summary.Provider = buildProviderRoleSummary(assetStatus, executorStatus, executorOnline)
	summary.CanPublishSupply = summary.Provider.CanQuote
	summary.CanAcceptDispatch = summary.Provider.CanAcceptDispatch
	summary.CanSelfExecute = summary.Provider.CanSelfExecute
	return summary, nil
}

func ownerProfileStatus(profile *model.OwnerProfile) string {
	if profile == nil {
		return providerStatusNone
	}
	if strings.EqualFold(strings.TrimSpace(profile.Status), providerStatusSuspended) {
		return providerStatusSuspended
	}
	if strings.EqualFold(strings.TrimSpace(profile.VerificationStatus), providerStatusRejected) {
		return providerStatusRejected
	}
	return providerStatusPendingReview
}

func statusFromVerification(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "verified", "approved", "active":
		return providerStatusApproved
	case "rejected":
		return providerStatusRejected
	case providerStatusSuspended, "disabled", "blocked":
		return providerStatusSuspended
	case "", "pending", "reviewing", "under_review", "pending_review":
		return providerStatusPendingReview
	default:
		return providerStatusPendingReview
	}
}

func combineProviderCapabilityStatus(current, next string) string {
	if current == "" || current == providerStatusNone {
		return normalizeProviderCapabilityStatus(next)
	}
	next = normalizeProviderCapabilityStatus(next)
	if next == providerStatusNone {
		return normalizeProviderCapabilityStatus(current)
	}
	for _, status := range []string{
		providerStatusApproved,
		providerStatusSuspended,
		providerStatusPendingReview,
		providerStatusRejected,
	} {
		if current == status || next == status {
			return status
		}
	}
	return providerStatusNone
}

func normalizeProviderCapabilityStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case providerStatusApproved:
		return providerStatusApproved
	case providerStatusPendingReview:
		return providerStatusPendingReview
	case providerStatusRejected:
		return providerStatusRejected
	case providerStatusSuspended:
		return providerStatusSuspended
	default:
		return providerStatusNone
	}
}

func buildProviderRoleSummary(assetStatus, executorStatus string, executorOnline bool) ProviderRoleSummary {
	assetStatus = normalizeProviderCapabilityStatus(assetStatus)
	executorStatus = normalizeProviderCapabilityStatus(executorStatus)
	status := combinedProviderStatus(assetStatus, executorStatus)
	assetApproved := assetStatus == providerStatusApproved
	executorApproved := executorStatus == providerStatusApproved
	qualificationApproved := assetApproved && executorApproved
	canAcceptDispatch := qualificationApproved && executorOnline

	return ProviderRoleSummary{
		Status:             status,
		AssetStatus:        assetStatus,
		ExecutorStatus:     executorStatus,
		CanUseWorkbench:    qualificationApproved,
		CanQuote:           qualificationApproved,
		CanArrangeDispatch: qualificationApproved,
		CanAcceptDispatch:  canAcceptDispatch,
		CanSelfExecute:     qualificationApproved,
		NextAction:         providerNextActionForStatus(status),
	}
}

func combinedProviderStatus(assetStatus, executorStatus string) string {
	if assetStatus == providerStatusSuspended || executorStatus == providerStatusSuspended {
		return providerStatusSuspended
	}
	if assetStatus == providerStatusRejected || executorStatus == providerStatusRejected {
		return providerStatusRejected
	}
	if assetStatus == providerStatusApproved && executorStatus == providerStatusApproved {
		return providerStatusApproved
	}
	if assetStatus == providerStatusPendingReview || executorStatus == providerStatusPendingReview {
		return providerStatusPendingReview
	}
	if assetStatus == providerStatusApproved || executorStatus == providerStatusApproved {
		return providerStatusPendingReview
	}
	return providerStatusNone
}

func providerNextActionForStatus(status string) string {
	switch status {
	case providerStatusApproved:
		return providerNextActionOpenWorkbench
	case providerStatusPendingReview:
		return providerNextActionWaitReview
	case providerStatusRejected, providerStatusSuspended:
		return providerNextActionFixRejected
	default:
		return providerNextActionStartOnboarding
	}
}

func (s *UserService) UpdateProfile(userID int64, nickname, avatarURL, userType string) error {
	_ = userType
	fields := make(map[string]interface{})
	if nickname != "" {
		fields["nickname"] = nickname
	}
	if avatarURL != "" {
		fields["avatar_url"] = avatarURL
	}
	if len(fields) == 0 {
		return nil
	}
	return s.userRepo.UpdateFields(userID, fields)
}

func (s *UserService) SubmitIDVerification(userID int64, idCardNo string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user.IDVerified == "approved" {
		return errors.New("已通过实名认证")
	}

	if err := s.userRepo.UpdateFields(userID, map[string]interface{}{
		"id_card_no":  idCardNo,
		"id_verified": "pending",
	}); err != nil {
		return err
	}

	s.scheduleSimulatedIDVerificationAutoApproval(userID, idCardNo, simulatedIDVerificationAutoApproveDelay)
	return nil
}

func (s *UserService) scheduleSimulatedIDVerificationAutoApproval(userID int64, idCardNo string, delay time.Duration) {
	if delay <= 0 {
		_ = s.approvePendingSimulatedIDVerification(userID, idCardNo)
		return
	}
	time.AfterFunc(delay, func() {
		_ = s.approvePendingSimulatedIDVerification(userID, idCardNo)
	})
}

func (s *UserService) approvePendingSimulatedIDVerification(userID int64, idCardNo string) error {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}
	if user.IDVerified != "pending" || user.IDCardNo != idCardNo {
		return nil
	}
	return s.userRepo.UpdateFields(userID, map[string]interface{}{"id_verified": "approved"})
}

func (s *UserService) GetPublicProfile(userID int64) (*model.User, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, err
	}
	// Clear sensitive fields
	user.PasswordHash = ""
	user.IDCardNo = ""
	return user, nil
}

func (s *UserService) ListUsers(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error) {
	return s.userRepo.List(page, pageSize, filters)
}

// SetPreferredMode 落库用户在小程序选择的意向身份("customer"/"provider")。
// 与 role_summary 解耦:仅作为运营分群和登录态恢复参考,不影响能力位。
func (s *UserService) SetPreferredMode(userID int64, mode string) error {
	switch mode {
	case "customer", "provider", "":
		// 允许空串表示用户主动清空选择
	default:
		return fmt.Errorf("invalid preferred_mode: %s", mode)
	}
	return s.userRepo.UpdatePreferredMode(userID, mode)
}

// AdminProviderView 用于管理端"服务商入驻审核"聚合视图。
// 同时携带用户基础信息、双侧能力位汇总,以及资产和执行两条线的快照数据,
// 让运营可以一处看到"机主资料 / 飞手资料 / 持有无人机数"三方面进展。
type AdminProviderView struct {
	User                model.User          `json:"user"`
	RoleSummary         RoleSummary         `json:"role_summary"`
	DroneTotal          int64               `json:"drone_total"`
	MarketEligibleTotal int64               `json:"market_eligible_drone_total"`
	OwnerProfile        *model.OwnerProfile `json:"owner_profile,omitempty"`
	PilotProfile        *model.PilotProfile `json:"pilot_profile,omitempty"`
	Pilot               *model.Pilot        `json:"pilot,omitempty"`
}

// ListProviders 分页返回服务商候选用户聚合视图,供管理端"服务商入驻审核"页使用。
// 与 GetRoleSummary 共用同一口径,确保管理端看到的状态和小程序端用户看到的一致。
func (s *UserService) ListProviders(page, pageSize int) ([]AdminProviderView, int64, error) {
	users, total, err := s.userRepo.ListProviderCandidates(page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	views := make([]AdminProviderView, 0, len(users))
	for i := range users {
		view := AdminProviderView{User: users[i]}
		if summary, err := s.GetRoleSummary(users[i].ID); err == nil {
			view.RoleSummary = *summary
		}
		if s.roleProfileRepo != nil {
			if op, err := s.roleProfileRepo.GetOwnerProfileByUserID(users[i].ID); err == nil {
				view.OwnerProfile = op
			}
			if pp, err := s.roleProfileRepo.GetPilotProfileByUserID(users[i].ID); err == nil {
				view.PilotProfile = pp
			}
		}
		if s.pilotRepo != nil {
			if p, err := s.pilotRepo.GetByUserID(users[i].ID); err == nil {
				view.Pilot = p
			}
		}
		if s.droneRepo != nil {
			if total, err := s.droneRepo.CountByOwner(users[i].ID); err == nil {
				view.DroneTotal = total
			}
			if mt, err := s.droneRepo.CountMarketplaceEligibleByOwner(users[i].ID); err == nil {
				view.MarketEligibleTotal = mt
			}
		}
		views = append(views, view)
	}
	return views, total, nil
}

// AdminUserView 在用户基础信息上附带与小程序端一致的角色能力汇总。
// 双端改造后注册不再写入有意义的 user_type（统一默认 renter），身份改由
// client/owner/pilot 能力位体现，管理端需按同一口径（客户 / 服务商）展示。
type AdminUserView struct {
	model.User
	RoleSummary *RoleSummary `json:"role_summary"`
}

// ListUsersWithRoles 在分页用户列表基础上逐条附加角色汇总，使管理端“身份”口径
// 与小程序端 /auth/me 返回的 role_summary 完全一致（复用同一 GetRoleSummary）。
// 注意：当前实现逐用户查询能力位，列表页 20 条规模可接受；如需更大页或更高频，
// 可在仓储层补批量查询（见服务商聚合视图的后续规划）。
func (s *UserService) ListUsersWithRoles(page, pageSize int, filters map[string]interface{}) ([]AdminUserView, int64, error) {
	users, total, err := s.userRepo.List(page, pageSize, filters)
	if err != nil {
		return nil, 0, err
	}
	views := make([]AdminUserView, 0, len(users))
	for i := range users {
		view := AdminUserView{User: users[i]}
		if summary, err := s.GetRoleSummary(users[i].ID); err == nil {
			view.RoleSummary = summary
		}
		views = append(views, view)
	}
	return views, total, nil
}

func (s *UserService) UpdateUserStatus(userID int64, status string) error {
	return s.userRepo.UpdateFields(userID, map[string]interface{}{"status": status})
}

func (s *UserService) ApproveIDVerification(userID int64, approved bool) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.userRepo.UpdateFields(userID, map[string]interface{}{"id_verified": status})
}

// GetByIDs 批量查询用户（用于 DTO 转换）
func (s *UserService) GetByIDs(ids []int64) (map[int64]*model.User, error) {
	if len(ids) == 0 {
		return make(map[int64]*model.User), nil
	}
	return s.userRepo.GetByIDs(ids)
}
