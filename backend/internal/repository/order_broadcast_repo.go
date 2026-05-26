package repository

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/limits"
)

type OrderBroadcastRepo struct {
	db *gorm.DB
}

func NewOrderBroadcastRepo(db *gorm.DB) *OrderBroadcastRepo {
	return &OrderBroadcastRepo{db: db}
}

func (r *OrderBroadcastRepo) DB() *gorm.DB {
	return r.db
}

func (r *OrderBroadcastRepo) Create(broadcast *model.OrderBroadcast) error {
	return r.db.Create(broadcast).Error
}

func (r *OrderBroadcastRepo) GetByID(id int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Preload("Order").Where("id = ?", id).First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) GetByOrderID(orderID int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Preload("Order").Where("order_id = ?", orderID).First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) LockByID(id int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", id).
		First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) ListOpen(now time.Time, limit int) ([]model.OrderBroadcast, error) {
	var items []model.OrderBroadcast
	limit = limits.NormalizeLimit(limit, 50, 200)
	err := r.db.Preload("Order").
		Where("status = ? AND expires_at > ?", "open", now).
		Order("created_at ASC, id ASC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *OrderBroadcastRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.OrderBroadcast{}).Where("id = ?", id).Updates(fields).Error
}

func (r *OrderBroadcastRepo) MarkExpired(now time.Time, limit int) (int64, error) {
	limit = limits.NormalizeLimit(limit, 100, 1000)
	subquery := r.db.Model(&model.OrderBroadcast{}).
		Select("id").
		Where("status = ? AND expires_at <= ?", "open", now).
		Order("expires_at ASC, id ASC").
		Limit(limit)
	result := r.db.Model(&model.OrderBroadcast{}).
		Where("id IN (?)", subquery).
		Updates(map[string]interface{}{
			"status":     "expired",
			"updated_at": now,
		})
	return result.RowsAffected, result.Error
}
