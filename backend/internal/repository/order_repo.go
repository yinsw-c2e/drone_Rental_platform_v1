package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type OrderRepo struct {
	db *gorm.DB
}

func NewOrderRepo(db *gorm.DB) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) Create(order *model.Order) error {
	return r.db.Create(order).Error
}

func (r *OrderRepo) GetByID(id int64) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Drone").Preload("Owner").Preload("Renter").
		Where("id = ?", id).First(&order).Error
	return &order, err
}

func (r *OrderRepo) GetByOrderNo(orderNo string) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Drone").Preload("Owner").Preload("Renter").
		Where("order_no = ?", orderNo).First(&order).Error
	return &order, err
}

func (r *OrderRepo) Update(order *model.Order) error {
	return r.db.Save(order).Error
}

func (r *OrderRepo) UpdateStatus(id int64, status string) error {
	return r.db.Model(&model.Order{}).Where("id = ?", id).Update("status", status).Error
}

func (r *OrderRepo) ListByUser(userID int64, role string, status string, page, pageSize int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64

	query := r.db.Model(&model.Order{})
	if role == "owner" {
		query = query.Where("owner_id = ?", userID)
	} else {
		query = query.Where("renter_id = ?", userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)
	err := query.Preload("Drone").Preload("Owner").Preload("Renter").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) List(page, pageSize int, filters map[string]interface{}) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64

	query := r.db.Model(&model.Order{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)
	err := query.Preload("Drone").Preload("Owner").Preload("Renter").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) AddTimeline(timeline *model.OrderTimeline) error {
	return r.db.Create(timeline).Error
}

func (r *OrderRepo) GetTimeline(orderID int64) ([]model.OrderTimeline, error) {
	var timelines []model.OrderTimeline
	err := r.db.Where("order_id = ?", orderID).Order("created_at ASC").Find(&timelines).Error
	return timelines, err
}

func (r *OrderRepo) CountByStatus(status string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Order{}).Where("status = ?", status).Count(&count).Error
	return count, err
}

func (r *OrderRepo) GetStatistics() (map[string]int64, error) {
	stats := make(map[string]int64)
	var results []struct {
		Status string
		Count  int64
	}
	err := r.db.Model(&model.Order{}).Select("status, count(*) as count").Group("status").Find(&results).Error
	if err != nil {
		return nil, err
	}
	for _, r := range results {
		stats[r.Status] = r.Count
	}
	return stats, nil
}
