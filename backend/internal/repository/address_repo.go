package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type AddressRepo struct {
	db *gorm.DB
}

func NewAddressRepo(db *gorm.DB) *AddressRepo {
	return &AddressRepo{db: db}
}

func (r *AddressRepo) FindByUserID(userID int64) ([]model.UserAddress, error) {
	var addresses []model.UserAddress
	err := r.db.Where("user_id = ?", userID).Order("is_default DESC, updated_at DESC").Find(&addresses).Error
	return addresses, err
}

func (r *AddressRepo) FindByID(id, userID int64) (*model.UserAddress, error) {
	var addr model.UserAddress
	err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&addr).Error
	return &addr, err
}

func (r *AddressRepo) CountByUserID(userID int64) (int64, error) {
	var count int64
	err := r.db.Model(&model.UserAddress{}).Where("user_id = ?", userID).Count(&count).Error
	return count, err
}

func (r *AddressRepo) Create(addr *model.UserAddress) error {
	return r.db.Create(addr).Error
}

func (r *AddressRepo) Update(id, userID int64, updates map[string]interface{}) error {
	return r.db.Model(&model.UserAddress{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates).Error
}

func (r *AddressRepo) Delete(id, userID int64) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.UserAddress{}).Error
}

func (r *AddressRepo) ClearDefault(userID int64) error {
	return r.db.Model(&model.UserAddress{}).Where("user_id = ? AND is_default = ?", userID, true).
		Update("is_default", false).Error
}

func (r *AddressRepo) SetDefault(id, userID int64) error {
	// Clear all defaults first
	if err := r.ClearDefault(userID); err != nil {
		return err
	}
	return r.db.Model(&model.UserAddress{}).Where("id = ? AND user_id = ?", id, userID).
		Update("is_default", true).Error
}
