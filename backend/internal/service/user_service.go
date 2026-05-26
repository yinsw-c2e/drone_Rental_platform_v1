package service

import (
	"errors"
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
	ID         int64  `json:"id"`
	Phone      string `json:"phone"`
	Nickname   string `json:"nickname"`
	AvatarURL  string `json:"avatar_url"`
	IDVerified string `json:"id_verified"`
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
	if userID <= 0 {
		return 4.5
	}
	return 4.5
}

func (s *UserService) GetProviderCompletionRate(userID int64) float64 {
	if userID <= 0 {
		return 1.0
	}
	return 1.0
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
			ID:         user.ID,
			Phone:      user.Phone,
			Nickname:   user.Nickname,
			AvatarURL:  user.AvatarURL,
			IDVerified: user.IDVerified,
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
	summary.CanSelfExecute = summary.CanPublishSupply && summary.CanAcceptDispatch
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
	canQuote := assetStatus == providerStatusApproved
	executorApproved := executorStatus == providerStatusApproved
	canAcceptDispatch := executorApproved && executorOnline

	return ProviderRoleSummary{
		Status:             status,
		AssetStatus:        assetStatus,
		ExecutorStatus:     executorStatus,
		CanUseWorkbench:    status == providerStatusApproved,
		CanQuote:           canQuote,
		CanArrangeDispatch: canQuote,
		CanAcceptDispatch:  canAcceptDispatch,
		CanSelfExecute:     canQuote && executorApproved,
		NextAction:         providerNextActionForStatus(status),
	}
}

func combinedProviderStatus(assetStatus, executorStatus string) string {
	if assetStatus == providerStatusApproved || executorStatus == providerStatusApproved {
		return providerStatusApproved
	}
	if assetStatus == providerStatusSuspended || executorStatus == providerStatusSuspended {
		return providerStatusSuspended
	}
	if assetStatus == providerStatusPendingReview || executorStatus == providerStatusPendingReview {
		return providerStatusPendingReview
	}
	if assetStatus == providerStatusRejected || executorStatus == providerStatusRejected {
		return providerStatusRejected
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
