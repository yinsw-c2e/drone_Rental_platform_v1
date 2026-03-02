package repository

import (
	"time"

	"gorm.io/gorm"
	"wurenji-backend/internal/model"
)

type AirspaceRepo struct {
	db *gorm.DB
}

func NewAirspaceRepo(db *gorm.DB) *AirspaceRepo {
	return &AirspaceRepo{db: db}
}

// ========== AirspaceApplication ==========

func (r *AirspaceRepo) CreateApplication(app *model.AirspaceApplication) error {
	return r.db.Create(app).Error
}

func (r *AirspaceRepo) GetApplicationByID(id int64) (*model.AirspaceApplication, error) {
	var app model.AirspaceApplication
	err := r.db.Preload("Pilot").Preload("Drone").First(&app, id).Error
	return &app, err
}

func (r *AirspaceRepo) GetApplicationByOrderID(orderID int64) (*model.AirspaceApplication, error) {
	var app model.AirspaceApplication
	err := r.db.Where("order_id = ?", orderID).Preload("Pilot").Preload("Drone").First(&app).Error
	return &app, err
}

func (r *AirspaceRepo) UpdateApplication(app *model.AirspaceApplication) error {
	return r.db.Save(app).Error
}

func (r *AirspaceRepo) ListByPilot(pilotID int64, page, pageSize int) ([]model.AirspaceApplication, int64, error) {
	var apps []model.AirspaceApplication
	var total int64
	query := r.db.Where("pilot_id = ?", pilotID)
	query.Model(&model.AirspaceApplication{}).Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&apps).Error
	return apps, total, err
}

func (r *AirspaceRepo) ListPendingReview(page, pageSize int) ([]model.AirspaceApplication, int64, error) {
	var apps []model.AirspaceApplication
	var total int64
	query := r.db.Where("status = ?", "pending_review")
	query.Model(&model.AirspaceApplication{}).Count(&total)
	err := query.Order("created_at ASC").Offset((page - 1) * pageSize).Limit(pageSize).
		Preload("Pilot").Preload("Drone").Find(&apps).Error
	return apps, total, err
}

func (r *AirspaceRepo) UpdateStatus(id int64, status string, reviewedBy int64, notes string) error {
	now := time.Now()
	return r.db.Model(&model.AirspaceApplication{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       status,
		"reviewed_by":  reviewedBy,
		"reviewed_at":  &now,
		"review_notes": notes,
	}).Error
}

func (r *AirspaceRepo) UpdateUOMInfo(id int64, uomNo string) error {
	now := time.Now()
	return r.db.Model(&model.AirspaceApplication{}).Where("id = ?", id).Updates(map[string]interface{}{
		"uom_application_no": uomNo,
		"uom_submitted_at":   &now,
		"status":             "submitted_to_uom",
	}).Error
}

func (r *AirspaceRepo) UpdateUOMResponse(id int64, approvalCode string, approved bool) error {
	now := time.Now()
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return r.db.Model(&model.AirspaceApplication{}).Where("id = ?", id).Updates(map[string]interface{}{
		"uom_response_at":  &now,
		"uom_approval_code": approvalCode,
		"status":            status,
	}).Error
}

func (r *AirspaceRepo) SetComplianceResult(id int64, checkID int64, passed bool, notes string) error {
	return r.db.Model(&model.AirspaceApplication{}).Where("id = ?", id).Updates(map[string]interface{}{
		"compliance_check_id": checkID,
		"compliance_passed":   passed,
		"compliance_notes":    notes,
	}).Error
}

// Check for conflicts with existing approved applications
func (r *AirspaceRepo) FindConflictingApplications(lat, lng float64, radius float64, startTime, endTime time.Time) ([]model.AirspaceApplication, error) {
	var apps []model.AirspaceApplication
	err := r.db.Where("status IN (?) AND planned_start_time < ? AND planned_end_time > ?",
		[]string{"approved", "submitted_to_uom"}, endTime, startTime).
		Where("(6371000 * ACOS(COS(RADIANS(?)) * COS(RADIANS(departure_latitude)) * COS(RADIANS(departure_longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(departure_latitude)))) < ?",
			lat, lng, lat, radius).
		Find(&apps).Error
	return apps, err
}

// ========== NoFlyZone ==========

func (r *AirspaceRepo) CreateNoFlyZone(zone *model.NoFlyZone) error {
	return r.db.Create(zone).Error
}

func (r *AirspaceRepo) GetNoFlyZoneByID(id int64) (*model.NoFlyZone, error) {
	var zone model.NoFlyZone
	err := r.db.First(&zone, id).Error
	return &zone, err
}

func (r *AirspaceRepo) UpdateNoFlyZone(zone *model.NoFlyZone) error {
	return r.db.Save(zone).Error
}

func (r *AirspaceRepo) DeleteNoFlyZone(id int64) error {
	return r.db.Delete(&model.NoFlyZone{}, id).Error
}

func (r *AirspaceRepo) ListNoFlyZones(zoneType string, status string, page, pageSize int) ([]model.NoFlyZone, int64, error) {
	var zones []model.NoFlyZone
	var total int64
	query := r.db.Model(&model.NoFlyZone{})
	if zoneType != "" {
		query = query.Where("zone_type = ?", zoneType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&zones).Error
	return zones, total, err
}

func (r *AirspaceRepo) FindNearbyNoFlyZones(lat, lng float64, radiusMeters float64) ([]model.NoFlyZone, error) {
	var zones []model.NoFlyZone
	err := r.db.Where("status = 'active' AND geometry_type = 'circle'").
		Where("center_latitude IS NOT NULL AND center_longitude IS NOT NULL").
		Where("(6371000 * ACOS(COS(RADIANS(?)) * COS(RADIANS(center_latitude)) * COS(RADIANS(center_longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(center_latitude)))) < (COALESCE(radius, 0) + ?)",
			lat, lng, lat, radiusMeters).
		Find(&zones).Error
	return zones, err
}

func (r *AirspaceRepo) CheckNoFlyZoneConflict(lat, lng float64, altitude int) ([]model.NoFlyZone, error) {
	var zones []model.NoFlyZone
	now := time.Now()
	err := r.db.Where("status = 'active' AND geometry_type = 'circle'").
		Where("center_latitude IS NOT NULL AND center_longitude IS NOT NULL").
		Where("(is_permanent = 1 OR (effective_from <= ? AND effective_to >= ?))", now, now).
		Where("(6371000 * ACOS(COS(RADIANS(?)) * COS(RADIANS(center_latitude)) * COS(RADIANS(center_longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(center_latitude)))) < COALESCE(radius, 0)",
			lat, lng, lat).
		Where("(max_altitude = 0 OR ? <= max_altitude)", altitude).
		Where("(min_altitude = 0 OR ? >= min_altitude)", altitude).
		Find(&zones).Error
	return zones, err
}

// GetCargoWeightByOrderID 通过订单ID获取货物重量(优先从派单任务取，其次从货运需求取)
func (r *AirspaceRepo) GetCargoWeightByOrderID(orderID int64) float64 {
	var weight float64
	// 优先从 dispatch_tasks 获取
	err := r.db.Model(&model.DispatchTask{}).Where("order_id = ?", orderID).
		Select("cargo_weight").Limit(1).Scan(&weight).Error
	if err == nil && weight > 0 {
		return weight
	}
	// 其次从 cargo_demands 获取 (通过 order.related_id)
	var order model.Order
	if err := r.db.Select("related_id, order_type").Where("id = ?", orderID).First(&order).Error; err == nil {
		if order.OrderType == "cargo" && order.RelatedID > 0 {
			r.db.Model(&model.CargoDemand{}).Where("id = ?", order.RelatedID).
				Select("cargo_weight").Limit(1).Scan(&weight)
		}
	}
	return weight
}

// ========== ComplianceCheck ==========

func (r *AirspaceRepo) CreateComplianceCheck(check *model.ComplianceCheck) error {
	return r.db.Create(check).Error
}

func (r *AirspaceRepo) GetComplianceCheckByID(id int64) (*model.ComplianceCheck, error) {
	var check model.ComplianceCheck
	err := r.db.Preload("Items").Preload("Pilot").Preload("Drone").First(&check, id).Error
	return &check, err
}

func (r *AirspaceRepo) CreateComplianceCheckItems(items []model.ComplianceCheckItem) error {
	if len(items) == 0 {
		return nil
	}
	return r.db.Create(&items).Error
}

func (r *AirspaceRepo) ListComplianceChecks(pilotID, droneID int64, page, pageSize int) ([]model.ComplianceCheck, int64, error) {
	var checks []model.ComplianceCheck
	var total int64
	query := r.db.Model(&model.ComplianceCheck{})
	if pilotID > 0 {
		query = query.Where("pilot_id = ?", pilotID)
	}
	if droneID > 0 {
		query = query.Where("drone_id = ?", droneID)
	}
	query.Count(&total)
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).
		Preload("Items").Find(&checks).Error
	return checks, total, err
}

func (r *AirspaceRepo) GetLatestComplianceCheck(pilotID, droneID int64) (*model.ComplianceCheck, error) {
	var check model.ComplianceCheck
	err := r.db.Where("pilot_id = ? AND drone_id = ?", pilotID, droneID).
		Order("created_at DESC").Preload("Items").First(&check).Error
	return &check, err
}
