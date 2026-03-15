package repository

import (
	"fmt"
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type OrderRepo struct {
	db *gorm.DB
}

func NewOrderRepo(db *gorm.DB) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) DB() *gorm.DB {
	return r.db
}

func (r *OrderRepo) Create(order *model.Order) error {
	if order == nil {
		return nil
	}
	tx := r.db
	if order.PilotID == 0 {
		tx = tx.Omit("PilotID", "pilot_id")
	}
	return tx.Create(order).Error
}

func (r *OrderRepo) GetByID(id int64) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Demand").Preload("Drone").Preload("Owner").Preload("Pilot").Preload("Renter").
		Where("id = ?", id).First(&order).Error
	if err != nil {
		return &order, err
	}

	// 检查是否已评价（租客对订单进行评价）
	var count int64
	r.db.Model(&model.Review{}).
		Where("order_id = ? AND reviewer_id = ?", order.ID, order.RenterID).
		Count(&count)
	order.Reviewed = count > 0

	return &order, nil
}

func (r *OrderRepo) GetByOrderNo(orderNo string) (*model.Order, error) {
	var order model.Order
	err := r.db.Preload("Demand").Preload("Drone").Preload("Owner").Preload("Pilot").Preload("Renter").
		Where("order_no = ?", orderNo).First(&order).Error
	return &order, err
}

func (r *OrderRepo) Update(order *model.Order) error {
	if order == nil {
		return nil
	}
	tx := r.db
	if order.PilotID == 0 {
		tx = tx.Omit("PilotID", "pilot_id")
	}
	return tx.Save(order).Error
}

func (r *OrderRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.Order{}).Where("id = ?", id).Updates(normalizeOrderNullableFields(fields)).Error
}

func (r *OrderRepo) UpdateStatus(id int64, status string) error {
	return r.db.Model(&model.Order{}).Where("id = ?", id).Update("status", status).Error
}

func (r *OrderRepo) UpdateStatusWithFields(orderID int64, pilotID int64, status string, extra map[string]interface{}) error {
	// 验证订单属于该飞手
	var order model.Order
	if err := r.db.Where("id = ? AND pilot_id = ?", orderID, pilotID).First(&order).Error; err != nil {
		return fmt.Errorf("订单不存在或无权操作")
	}
	updates := map[string]interface{}{"status": status}
	for k, v := range extra {
		updates[k] = v
	}
	return r.db.Model(&model.Order{}).Where("id = ?", orderID).Updates(updates).Error
}

func normalizeOrderNullableFields(fields map[string]interface{}) map[string]interface{} {
	if len(fields) == 0 {
		return fields
	}
	if raw, ok := fields["pilot_id"]; ok {
		switch v := raw.(type) {
		case int:
			if v == 0 {
				fields["pilot_id"] = nil
			}
		case int64:
			if v == 0 {
				fields["pilot_id"] = nil
			}
		case uint:
			if v == 0 {
				fields["pilot_id"] = nil
			}
		case uint64:
			if v == 0 {
				fields["pilot_id"] = nil
			}
		case nil:
			fields["pilot_id"] = nil
		}
	}
	return fields
}

func (r *OrderRepo) ListByPilot(pilotID int64, status string, page, pageSize int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64
	query := r.db.Model(&model.Order{}).Where("pilot_id = ?", pilotID)
	if status != "" {
		query = query.Where("status = ?", status)
	} else {
		query = query.Where("status NOT IN (?)", []string{"completed", "cancelled"})
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) ListByUser(userID int64, role string, status string, page, pageSize int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64

	query := r.db.Model(&model.Order{})
	switch role {
	case "owner":
		query = query.Where("(provider_user_id = ? OR (provider_user_id = 0 AND owner_id = ?) OR drone_owner_user_id = ?)", userID, userID, userID)
	case "pilot":
		subquery := r.db.Model(&model.Pilot{}).
			Select("id").
			Where("user_id = ? AND deleted_at IS NULL", userID)
		query = query.Where("(executor_pilot_user_id = ? OR (executor_pilot_user_id = 0 AND pilot_id IN (?)))", userID, subquery)
	default:
		query = query.Where("(client_user_id = ? OR (client_user_id = 0 AND renter_id = ?))", userID, userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)
	err := query.Preload("Demand").Preload("Drone").Preload("Owner").Preload("Pilot").Preload("Renter").
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

func (r *OrderRepo) ListOrdersForFlightSyncByPilotUser(pilotUserID int64) ([]model.Order, error) {
	var orders []model.Order
	if pilotUserID <= 0 {
		return orders, nil
	}

	subquery := r.db.Model(&model.Pilot{}).
		Select("id").
		Where("user_id = ? AND deleted_at IS NULL", pilotUserID)

	err := r.db.Model(&model.Order{}).
		Where("orders.deleted_at IS NULL").
		Where("(orders.executor_pilot_user_id = ? OR (orders.executor_pilot_user_id = 0 AND orders.pilot_id IN (?)))", pilotUserID, subquery).
		Where(`
			orders.flight_start_time IS NOT NULL OR
			orders.flight_end_time IS NOT NULL OR
			orders.actual_flight_duration > 0 OR
			orders.actual_flight_distance > 0 OR
			orders.max_altitude > 0 OR
			EXISTS (
				SELECT 1
				FROM flight_records fr
				WHERE fr.order_id = orders.id
				  AND fr.deleted_at IS NULL
			) OR
			EXISTS (
				SELECT 1
				FROM flight_positions fp
				WHERE fp.order_id = orders.id
			)
		`).
		Order("orders.updated_at DESC, orders.id DESC").
		Find(&orders).Error
	return orders, err
}

func (r *OrderRepo) AddTimeline(timeline *model.OrderTimeline) error {
	return r.db.Create(timeline).Error
}

func (r *OrderRepo) GetTimeline(orderID int64) ([]model.OrderTimeline, error) {
	var timelines []model.OrderTimeline
	err := r.db.Where("order_id = ?", orderID).Order("created_at ASC").Find(&timelines).Error
	return timelines, err
}

func (r *OrderRepo) GetLatestTimeline(orderID int64) (*model.OrderTimeline, error) {
	var timeline model.OrderTimeline
	err := r.db.Where("order_id = ?", orderID).Order("created_at DESC").First(&timeline).Error
	if err != nil {
		return nil, err
	}
	return &timeline, nil
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
