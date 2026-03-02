package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type DroneRepo struct {
	db *gorm.DB
}

func NewDroneRepo(db *gorm.DB) *DroneRepo {
	return &DroneRepo{db: db}
}

func (r *DroneRepo) Create(drone *model.Drone) error {
	return r.db.Create(drone).Error
}

func (r *DroneRepo) GetByID(id int64) (*model.Drone, error) {
	var drone model.Drone
	err := r.db.Preload("Owner").Where("id = ?", id).First(&drone).Error
	return &drone, err
}

func (r *DroneRepo) Update(drone *model.Drone) error {
	return r.db.Save(drone).Error
}

func (r *DroneRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.Drone{}).Where("id = ?", id).Updates(fields).Error
}

func (r *DroneRepo) Delete(id int64) error {
	return r.db.Delete(&model.Drone{}, id).Error
}

func (r *DroneRepo) ListByOwner(ownerID int64, page, pageSize int) ([]model.Drone, int64, error) {
	var drones []model.Drone
	var total int64

	query := r.db.Model(&model.Drone{}).Where("owner_id = ?", ownerID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&drones).Error
	return drones, total, err
}

func (r *DroneRepo) List(page, pageSize int, filters map[string]interface{}) ([]model.Drone, int64, error) {
	var drones []model.Drone
	var total int64

	query := r.db.Model(&model.Drone{}) // 暂时移除 .Preload("Owner")
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&drones).Error
	return drones, total, err
}

func (r *DroneRepo) FindNearby(lat, lng, radiusKM float64, page, pageSize int) ([]model.Drone, int64, error) {
	var drones []model.Drone
	var total int64

	// Haversine formula for distance calculation
	distanceExpr := `(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))`

	query := r.db.Model(&model.Drone{}).
		Where("availability_status = ?", "available").
		Where("certification_status = ?", "approved").
		Where(distanceExpr+" < ?", lat, lng, lat, radiusKM)

	query.Count(&total)
	err := query.
		Select("*, "+distanceExpr+" AS distance", lat, lng, lat).
		Order("distance ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Preload("Owner").
		Find(&drones).Error

	return drones, total, err
}

func (r *DroneRepo) UpdateRating(droneID int64) error {
	return r.db.Exec(`
		UPDATE drones SET rating = (
			SELECT COALESCE(AVG(rating), 0) FROM reviews
			WHERE target_type = 'drone' AND target_id = ? AND rating > 0
		) WHERE id = ?`, droneID, droneID).Error
}

// ==================== 维护记录 ====================

// CreateMaintenanceLog 创建维护记录
func (r *DroneRepo) CreateMaintenanceLog(log *model.DroneMaintenanceLog) error {
	return r.db.Create(log).Error
}

// GetMaintenanceLogs 获取维护记录
func (r *DroneRepo) GetMaintenanceLogs(droneID int64, page, pageSize int) ([]model.DroneMaintenanceLog, int64, error) {
	var logs []model.DroneMaintenanceLog
	var total int64

	query := r.db.Model(&model.DroneMaintenanceLog{}).Where("drone_id = ?", droneID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("maintenance_date DESC").Find(&logs).Error
	return logs, total, err
}

// ==================== 保险记录 ====================

// CreateInsuranceRecord 创建保险记录
func (r *DroneRepo) CreateInsuranceRecord(record *model.DroneInsuranceRecord) error {
	return r.db.Create(record).Error
}

// GetInsuranceRecords 获取保险记录
func (r *DroneRepo) GetInsuranceRecords(droneID int64) ([]model.DroneInsuranceRecord, error) {
	var records []model.DroneInsuranceRecord
	err := r.db.Where("drone_id = ?", droneID).Order("created_at DESC").Find(&records).Error
	return records, err
}

// GetActiveInsurance 获取有效保险
func (r *DroneRepo) GetActiveInsurance(droneID int64, insuranceType string) (*model.DroneInsuranceRecord, error) {
	var record model.DroneInsuranceRecord
	query := r.db.Where("drone_id = ? AND status = 'active'", droneID)
	if insuranceType != "" {
		query = query.Where("insurance_type = ?", insuranceType)
	}
	query = query.Where("effective_to > NOW()")
	err := query.First(&record).Error
	return &record, err
}

// ==================== 合规性检查 ====================

// FindFullyCertifiedDrones 查找完全认证的无人机
func (r *DroneRepo) FindFullyCertifiedDrones(lat, lng, radiusKM float64, page, pageSize int) ([]model.Drone, int64, error) {
	var drones []model.Drone
	var total int64

	distanceExpr := `(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))`

	query := r.db.Model(&model.Drone{}).
		Where("availability_status = ?", "available").
		Where("certification_status = ?", "approved").
		Where("uom_verified = ?", "verified").
		Where("insurance_verified = ?", "verified").
		Where("airworthiness_verified = ?", "verified").
		Where("insurance_expire_date > NOW()").
		Where("airworthiness_cert_expire > NOW()").
		Where(distanceExpr+" < ?", lat, lng, lat, radiusKM)

	query.Count(&total)
	err := query.
		Select("*, "+distanceExpr+" AS distance", lat, lng, lat).
		Order("distance ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Preload("Owner").
		Find(&drones).Error

	return drones, total, err
}
