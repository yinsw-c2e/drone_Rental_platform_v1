package repository

import (
	"errors"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type RoleProfileRepo struct {
	db *gorm.DB
}

func NewRoleProfileRepo(db *gorm.DB) *RoleProfileRepo {
	return &RoleProfileRepo{db: db}
}

func (r *RoleProfileRepo) DB() *gorm.DB {
	return r.db
}

func (r *RoleProfileRepo) GetClientProfileByUserID(userID int64) (*model.ClientProfile, error) {
	var profile model.ClientProfile
	err := r.db.Where("user_id = ?", userID).First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *RoleProfileRepo) EnsureClientProfile(profile *model.ClientProfile) error {
	if profile == nil {
		return nil
	}
	return r.ensureByUserID(profile, profile.UserID)
}

func (r *RoleProfileRepo) GetOwnerProfileByUserID(userID int64) (*model.OwnerProfile, error) {
	var profile model.OwnerProfile
	err := r.db.Where("user_id = ?", userID).First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *RoleProfileRepo) EnsureOwnerProfile(profile *model.OwnerProfile) error {
	if profile == nil {
		return nil
	}
	return r.ensureByUserID(profile, profile.UserID)
}

func (r *RoleProfileRepo) GetPilotProfileByUserID(userID int64) (*model.PilotProfile, error) {
	var profile model.PilotProfile
	err := r.db.Where("user_id = ?", userID).First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *RoleProfileRepo) EnsurePilotProfile(profile *model.PilotProfile) error {
	if profile == nil {
		return nil
	}
	return r.ensureByUserID(profile, profile.UserID)
}

func (r *RoleProfileRepo) ensureByUserID(profile interface{}, userID int64) error {
	if userID == 0 || profile == nil {
		return nil
	}

	tx := r.db.Where("user_id = ?", userID).First(profile)
	if tx.Error == nil {
		return nil
	}
	if !errors.Is(tx.Error, gorm.ErrRecordNotFound) {
		return tx.Error
	}
	return r.db.Create(profile).Error
}
