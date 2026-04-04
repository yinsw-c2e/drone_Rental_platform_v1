package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type ContractRepo struct {
	db *gorm.DB
}

func NewContractRepo(db *gorm.DB) *ContractRepo {
	return &ContractRepo{db: db}
}

func (r *ContractRepo) DB() *gorm.DB {
	return r.db
}

func (r *ContractRepo) Create(c *model.OrderContract) error {
	return r.db.Create(c).Error
}

func (r *ContractRepo) GetByID(id int64) (*model.OrderContract, error) {
	var c model.OrderContract
	err := r.db.Where("id = ?", id).First(&c).Error
	return &c, err
}

func (r *ContractRepo) GetByOrderID(orderID int64) (*model.OrderContract, error) {
	var c model.OrderContract
	err := r.db.Where("order_id = ?", orderID).First(&c).Error
	return &c, err
}

func (r *ContractRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.OrderContract{}).Where("id = ?", id).Updates(fields).Error
}
