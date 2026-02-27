package service

import (
	"errors"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type UserService struct {
	userRepo *repository.UserRepo
}

func NewUserService(userRepo *repository.UserRepo) *UserService {
	return &UserService{userRepo: userRepo}
}

func (s *UserService) GetProfile(userID int64) (*model.User, error) {
	return s.userRepo.GetByID(userID)
}

func (s *UserService) UpdateProfile(userID int64, nickname, avatarURL, userType string) error {
	fields := make(map[string]interface{})
	if nickname != "" {
		fields["nickname"] = nickname
	}
	if avatarURL != "" {
		fields["avatar_url"] = avatarURL
	}
	if userType != "" {
		fields["user_type"] = userType
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

