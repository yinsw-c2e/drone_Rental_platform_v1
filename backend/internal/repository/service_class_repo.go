package repository

import (
	"strings"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type ServiceClassRepo struct {
	db *gorm.DB
}

func NewServiceClassRepo(db *gorm.DB) *ServiceClassRepo {
	return &ServiceClassRepo{db: db}
}

func (r *ServiceClassRepo) DB() *gorm.DB {
	return r.db
}

func (r *ServiceClassRepo) ListAll() ([]model.ServiceClass, error) {
	var items []model.ServiceClass
	err := r.db.
		Order("sort_order ASC, payload_max_kg ASC, id ASC").
		Find(&items).Error
	return items, err
}

func (r *ServiceClassRepo) GetByID(id int64) (*model.ServiceClass, error) {
	var item model.ServiceClass
	err := r.db.Where("id = ?", id).First(&item).Error
	return &item, err
}

func (r *ServiceClassRepo) GetActiveByCode(code string) (*model.ServiceClass, error) {
	var serviceClass model.ServiceClass
	err := r.db.
		Where("code = ? AND status = ?", strings.TrimSpace(code), "active").
		First(&serviceClass).Error
	return &serviceClass, err
}

func (r *ServiceClassRepo) ListActive() ([]model.ServiceClass, error) {
	var items []model.ServiceClass
	err := r.db.
		Where("status = ?", "active").
		Order("sort_order ASC, payload_max_kg ASC, id ASC").
		Find(&items).Error
	return items, err
}

func (r *ServiceClassRepo) Create(item *model.ServiceClass) error {
	return r.db.Create(item).Error
}

func (r *ServiceClassRepo) Update(item *model.ServiceClass) error {
	return r.db.Save(item).Error
}

func (r *ServiceClassRepo) Archive(id int64) error {
	return r.db.Model(&model.ServiceClass{}).
		Where("id = ?", id).
		Update("status", "archived").Error
}
