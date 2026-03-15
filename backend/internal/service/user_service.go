package service

import (
	"errors"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type RoleSummary struct {
	HasClientRole     bool `json:"has_client_role"`
	HasOwnerRole      bool `json:"has_owner_role"`
	HasPilotRole      bool `json:"has_pilot_role"`
	CanPublishSupply  bool `json:"can_publish_supply"`
	CanAcceptDispatch bool `json:"can_accept_dispatch"`
	CanSelfExecute    bool `json:"can_self_execute"`
}

type MeUser struct {
	ID        int64  `json:"id"`
	Phone     string `json:"phone"`
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatar_url"`
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
			ID:        user.ID,
			Phone:     user.Phone,
			Nickname:  user.Nickname,
			AvatarURL: user.AvatarURL,
		},
		RoleSummary: *roleSummary,
	}, nil
}

func (s *UserService) GetRoleSummary(userID int64) (*RoleSummary, error) {
	summary := &RoleSummary{}

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

		if _, err := s.roleProfileRepo.GetOwnerProfileByUserID(userID); err == nil {
			summary.HasOwnerRole = true
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}

		if _, err := s.roleProfileRepo.GetPilotProfileByUserID(userID); err == nil {
			summary.HasPilotRole = true
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if s.droneRepo != nil {
		if total, err := s.droneRepo.CountByOwner(userID); err != nil {
			return nil, err
		} else if total > 0 {
			summary.HasOwnerRole = true
		}

		if total, err := s.droneRepo.CountMarketplaceEligibleByOwner(userID); err != nil {
			return nil, err
		} else if total > 0 {
			summary.HasOwnerRole = true
			summary.CanPublishSupply = true
		}
	}

	if s.pilotRepo != nil {
		pilot, err := s.pilotRepo.GetByUserID(userID)
		if err == nil && pilot != nil {
			summary.HasPilotRole = true
			summary.CanAcceptDispatch = pilot.VerificationStatus == "verified" && pilot.AvailabilityStatus == "online"
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	summary.CanSelfExecute = summary.CanPublishSupply && summary.CanAcceptDispatch
	return summary, nil
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

	return s.userRepo.UpdateFields(userID, map[string]interface{}{
		"id_card_no":  idCardNo,
		"id_verified": "pending",
	})
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
