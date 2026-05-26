package repository

import (
	"fmt"
	"strings"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/limits"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrderRepo struct {
	db *gorm.DB
}

type DirectOrderReuseLookup struct {
	SourceSupplyID int64
	RenterID       int64
	ServiceType    string
	StartTime      time.Time
	EndTime        time.Time
	ServiceAddress string
	DestAddress    string
	TotalAmount    int64
	CreatedAfter   time.Time
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
	tx := omitUnsupportedOrderOptionalColumns(r.db)
	if order.PilotID == 0 {
		tx = tx.Omit("PilotID", "pilot_id")
	}
	return tx.Create(order).Error
}

// CreateOmit creates an order while skipping selected columns so the database can
// apply NULL/default values. This is used for platform-priced orders before a
// concrete drone/pilot/owner has been assigned.
func (r *OrderRepo) CreateOmit(order *model.Order, columns ...string) error {
	if order == nil {
		return nil
	}
	tx := omitUnsupportedOrderOptionalColumns(r.db)
	if len(columns) > 0 {
		tx = tx.Omit(columns...)
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

func (r *OrderRepo) LockByID(id int64) (*model.Order, error) {
	var order model.Order
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", id).
		First(&order).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *OrderRepo) Update(order *model.Order) error {
	if order == nil {
		return nil
	}
	tx := omitUnsupportedOrderOptionalColumns(r.db)
	if order.PilotID == 0 {
		tx = tx.Omit("PilotID", "pilot_id")
	}
	return tx.Save(order).Error
}

func (r *OrderRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.Order{}).Where("id = ?", id).Updates(normalizeOrderNullableFields(filterUnsupportedOrderOptionalFields(r.db, fields))).Error
}

func (r *OrderRepo) UpdateStatus(id int64, status string) error {
	return r.db.Model(&model.Order{}).Where("id = ?", id).Update("status", status).Error
}

// CountTodayProviderOrders returns today's completed/delivered order count and income in cents.
func (r *OrderRepo) CountTodayProviderOrders(providerUserID int64, since time.Time) (int, int64, error) {
	var row struct {
		Count       int64
		TotalAmount int64
	}
	err := r.db.Model(&model.Order{}).
		Select("COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount").
		Where("provider_user_id = ? AND status IN ?", providerUserID, []string{"completed", "delivered"}).
		Where("completed_at IS NOT NULL AND completed_at >= ?", since).
		Scan(&row).Error
	if err != nil {
		return 0, 0, err
	}
	return int(row.Count), row.TotalAmount, nil
}

func (r *OrderRepo) CountCompletedProviderOrders(providerUserID int64) (int, error) {
	var count int64
	err := r.db.Model(&model.Order{}).
		Where("provider_user_id = ? AND status = ?", providerUserID, "completed").
		Count(&count).Error
	return int(count), err
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

func (r *OrderRepo) FindReusableDirectSupplyOrder(query DirectOrderReuseLookup) (*model.Order, error) {
	var orders []model.Order
	err := r.db.Model(&model.Order{}).
		Where("order_source = ?", "supply_direct").
		Where("source_supply_id = ?", query.SourceSupplyID).
		Where("renter_id = ?", query.RenterID).
		Where("created_at >= ?", query.CreatedAfter).
		Where("status IN ?", []string{
			"pending_provider_confirmation",
			"pending_payment",
			"paid",
			"pending_dispatch",
			"assigned",
			"confirmed",
			"airspace_applying",
			"airspace_approved",
			"loading",
			"preparing",
			"in_progress",
			"in_transit",
			"delivered",
		}).
		Order("created_at ASC, id ASC").
		Find(&orders).Error
	if err != nil {
		return nil, err
	}
	for i := range orders {
		order := orders[i]
		if order.ServiceType != query.ServiceType {
			continue
		}
		if order.TotalAmount != query.TotalAmount {
			continue
		}
		if strings.TrimSpace(order.ServiceAddress) != strings.TrimSpace(query.ServiceAddress) {
			continue
		}
		if strings.TrimSpace(order.DestAddress) != strings.TrimSpace(query.DestAddress) {
			continue
		}
		if order.StartTime.Unix() != query.StartTime.Unix() {
			continue
		}
		if order.EndTime.Unix() != query.EndTime.Unix() {
			continue
		}
		return &order, nil
	}
	return nil, nil
}

func normalizeOrderNullableFields(fields map[string]interface{}) map[string]interface{} {
	if len(fields) == 0 {
		return fields
	}
	for _, key := range []string{"drone_id", "pilot_id", "owner_id"} {
		if raw, ok := fields[key]; ok {
			switch v := raw.(type) {
			case int:
				if v == 0 {
					fields[key] = nil
				}
			case int64:
				if v == 0 {
					fields[key] = nil
				}
			case uint:
				if v == 0 {
					fields[key] = nil
				}
			case uint64:
				if v == 0 {
					fields[key] = nil
				}
			case nil:
				fields[key] = nil
			}
		}
	}
	return fields
}

func orderOptionalColumns() []struct {
	field  string
	column string
} {
	return []struct {
		field  string
		column string
	}{
		{field: "FlightStartTime", column: "flight_start_time"},
		{field: "FlightEndTime", column: "flight_end_time"},
		{field: "OrderMode", column: "order_mode"},
		{field: "ServiceClassCode", column: "service_class_code"},
		{field: "EstimatedDistanceM", column: "estimated_distance_m"},
		{field: "EstimatedDurationMin", column: "estimated_duration_min"},
		{field: "PriceBreakdownJSON", column: "price_breakdown_json"},
		{field: "BroadcastPoolID", column: "broadcast_pool_id"},
		{field: "ReservedStartAt", column: "reserved_start_at"},
		{field: "GrabbedAt", column: "grabbed_at"},
		{field: "GrabbedByUserID", column: "grabbed_by_user_id"},
		{field: "LoadingConfirmedAt", column: "loading_confirmed_at"},
		{field: "LoadingConfirmedBy", column: "loading_confirmed_by"},
		{field: "UnloadingConfirmedAt", column: "unloading_confirmed_at"},
		{field: "UnloadingConfirmedBy", column: "unloading_confirmed_by"},
	}
}

func unsupportedOrderOptionalColumnOmissions(hasColumn func(string) bool) []string {
	if hasColumn == nil {
		return nil
	}

	optionalColumns := orderOptionalColumns()
	omissions := make([]string, 0, len(optionalColumns)*2)
	for _, item := range optionalColumns {
		if hasColumn(item.column) {
			continue
		}
		omissions = append(omissions, item.field, item.column)
	}
	return omissions
}

func unsupportedOrderOptionalColumnOmissionsForDB(db *gorm.DB) []string {
	if db == nil {
		return nil
	}
	return unsupportedOrderOptionalColumnOmissions(func(column string) bool {
		return db.Migrator().HasColumn(&model.Order{}, column)
	})
}

func omitUnsupportedOrderOptionalColumns(db *gorm.DB) *gorm.DB {
	if db == nil {
		return db
	}
	omissions := unsupportedOrderOptionalColumnOmissionsForDB(db)
	if len(omissions) == 0 {
		return db
	}
	return db.Omit(omissions...)
}

func filterUnsupportedOrderOptionalFields(db *gorm.DB, fields map[string]interface{}) map[string]interface{} {
	if db == nil || len(fields) == 0 {
		return fields
	}

	unsupported := map[string]struct{}{}
	for _, omission := range unsupportedOrderOptionalColumnOmissionsForDB(db) {
		unsupported[omission] = struct{}{}
	}
	if len(unsupported) == 0 {
		return fields
	}

	filtered := make(map[string]interface{}, len(fields))
	for key, value := range fields {
		if _, skip := unsupported[key]; skip {
			continue
		}
		filtered[key] = value
	}
	return filtered
}

func (r *OrderRepo) ListByPilot(pilotID int64, status string, page, pageSize int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.Order{}).Where("pilot_id = ?", pilotID)
	if status != "" {
		query = query.Where("status = ?", status)
	} else {
		query = query.Where("status NOT IN (?)", []string{"completed", "cancelled"})
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&orders).Error
	return orders, total, err
}

func (r *OrderRepo) ListByUser(userID int64, role string, status string, page, pageSize int) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

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

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Preload("Demand").Preload("Drone").Preload("Owner").Preload("Pilot").Preload("Renter").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&orders).Error
	if err == nil && role == "client" && len(orders) > 0 {
		err = r.populateReviewedByUser(orders, userID)
	}
	return orders, total, err
}

func (r *OrderRepo) populateReviewedByUser(orders []model.Order, reviewerID int64) error {
	if reviewerID <= 0 || len(orders) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(orders))
	for i := range orders {
		if orders[i].ID > 0 {
			ids = append(ids, orders[i].ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}

	var rows []struct {
		OrderID int64
	}
	if err := r.db.Model(&model.Review{}).
		Select("order_id").
		Where("reviewer_id = ? AND order_id IN ?", reviewerID, ids).
		Group("order_id").
		Scan(&rows).Error; err != nil {
		return err
	}
	reviewed := make(map[int64]bool, len(rows))
	for _, row := range rows {
		reviewed[row.OrderID] = true
	}
	for i := range orders {
		orders[i].Reviewed = reviewed[orders[i].ID]
	}
	return nil
}

func (r *OrderRepo) ListDueReservationOrders(cutoff time.Time, limit int) ([]model.Order, error) {
	var orders []model.Order
	limit = limits.NormalizeLimit(limit, 100, 1000)
	err := r.db.Model(&model.Order{}).
		Where("order_mode = ? AND status = ?", "reservation", "scheduled").
		Where("(reserved_start_at IS NOT NULL AND reserved_start_at <= ?) OR (reserved_start_at IS NULL AND start_time <= ?)", cutoff, cutoff).
		Order("COALESCE(reserved_start_at, start_time) ASC, id ASC").
		Limit(limit).
		Find(&orders).Error
	return orders, err
}

func (r *OrderRepo) List(page, pageSize int, filters map[string]interface{}) ([]model.Order, int64, error) {
	var orders []model.Order
	var total int64
	page, pageSize = limits.NormalizePagination(page, pageSize)

	query := r.db.Model(&model.Order{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
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

func (r *OrderRepo) CreateSiteSafetyCheck(record *model.OrderSiteSafetyCheck) error {
	return r.db.Create(record).Error
}

func (r *OrderRepo) GetLatestSiteSafetyCheck(orderID int64) (*model.OrderSiteSafetyCheck, error) {
	var record model.OrderSiteSafetyCheck
	err := r.db.Where("order_id = ?", orderID).Order("checked_at DESC, id DESC").First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
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
