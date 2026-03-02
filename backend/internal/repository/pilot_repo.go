package repository

import (
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type PilotRepo struct {
	db *gorm.DB
}

func NewPilotRepo(db *gorm.DB) *PilotRepo {
	return &PilotRepo{db: db}
}

// Create 创建飞手档案
func (r *PilotRepo) Create(pilot *model.Pilot) error {
	return r.db.Create(pilot).Error
}

// GetByID 根据ID获取飞手
func (r *PilotRepo) GetByID(id int64) (*model.Pilot, error) {
	var pilot model.Pilot
	err := r.db.Preload("User").Where("id = ? AND deleted_at IS NULL", id).First(&pilot).Error
	return &pilot, err
}

// GetByUserID 根据用户ID获取飞手档案
func (r *PilotRepo) GetByUserID(userID int64) (*model.Pilot, error) {
	var pilot model.Pilot
	err := r.db.Preload("User").Where("user_id = ? AND deleted_at IS NULL", userID).First(&pilot).Error
	return &pilot, err
}

// ExistsByUserID 检查用户是否已有飞手档案
func (r *PilotRepo) ExistsByUserID(userID int64) (bool, error) {
	var count int64
	err := r.db.Model(&model.Pilot{}).Where("user_id = ? AND deleted_at IS NULL", userID).Count(&count).Error
	return count > 0, err
}

// Update 更新飞手档案
func (r *PilotRepo) Update(pilot *model.Pilot) error {
	return r.db.Save(pilot).Error
}

// UpdateFields 更新飞手指定字段
func (r *PilotRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.Pilot{}).Where("id = ?", id).Updates(fields).Error
}

// UpdateLocation 更新飞手实时位置
func (r *PilotRepo) UpdateLocation(id int64, lat, lng float64, city string) error {
	return r.db.Model(&model.Pilot{}).Where("id = ?", id).Updates(map[string]interface{}{
		"current_latitude":  lat,
		"current_longitude": lng,
		"current_city":      city,
	}).Error
}

// UpdateAvailability 更新飞手接单状态
func (r *PilotRepo) UpdateAvailability(id int64, status string) error {
	return r.db.Model(&model.Pilot{}).Where("id = ?", id).Update("availability_status", status).Error
}

// List 飞手列表 (支持分页和筛选)
func (r *PilotRepo) List(page, pageSize int, filters map[string]interface{}) ([]model.Pilot, int64, error) {
	var pilots []model.Pilot
	var total int64

	query := r.db.Model(&model.Pilot{}).Where("deleted_at IS NULL")

	// 应用筛选条件
	for k, v := range filters {
		switch k {
		case "verification_status":
			query = query.Where("verification_status = ?", v)
		case "availability_status":
			query = query.Where("availability_status = ?", v)
		case "current_city":
			query = query.Where("current_city = ?", v)
		case "caac_license_type":
			query = query.Where("caac_license_type = ?", v)
		}
	}

	query.Count(&total)
	err := query.Preload("User").Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&pilots).Error
	return pilots, total, err
}

// FindNearby 查找附近在线飞手
func (r *PilotRepo) FindNearby(lat, lng, radiusKM float64, limit int) ([]model.Pilot, error) {
	var pilots []model.Pilot
	// 使用 Haversine 公式计算距离
	err := r.db.Raw(`
		SELECT p.*, 
		(6371 * acos(cos(radians(?)) * cos(radians(current_latitude)) * cos(radians(current_longitude) - radians(?)) + sin(radians(?)) * sin(radians(current_latitude)))) AS distance
		FROM pilots p
		WHERE p.deleted_at IS NULL 
		AND p.verification_status = 'verified'
		AND p.availability_status = 'online'
		AND p.current_latitude IS NOT NULL 
		AND p.current_longitude IS NOT NULL
		HAVING distance <= ?
		ORDER BY distance
		LIMIT ?
	`, lat, lng, lat, radiusKM, limit).Scan(&pilots).Error
	return pilots, err
}

// FindByLicenseType 按执照类型查找飞手
func (r *PilotRepo) FindByLicenseType(licenseType string, page, pageSize int) ([]model.Pilot, int64, error) {
	var pilots []model.Pilot
	var total int64

	query := r.db.Model(&model.Pilot{}).
		Where("deleted_at IS NULL").
		Where("verification_status = 'verified'").
		Where("caac_license_type = ?", licenseType)

	query.Count(&total)
	err := query.Preload("User").Offset((page - 1) * pageSize).Limit(pageSize).Order("service_rating DESC").Find(&pilots).Error
	return pilots, total, err
}

// IncrementOrderCount 增加订单统计
func (r *PilotRepo) IncrementOrderCount(id int64, completed bool) error {
	updates := map[string]interface{}{
		"total_orders": gorm.Expr("total_orders + 1"),
	}
	if completed {
		updates["completed_orders"] = gorm.Expr("completed_orders + 1")
	}
	return r.db.Model(&model.Pilot{}).Where("id = ?", id).Updates(updates).Error
}

// UpdateFlightHours 更新飞行小时数
func (r *PilotRepo) UpdateFlightHours(id int64, hours float64) error {
	return r.db.Model(&model.Pilot{}).Where("id = ?", id).
		Update("total_flight_hours", gorm.Expr("total_flight_hours + ?", hours)).Error
}

// ==================== 飞手资质证书 ====================

// CreateCertification 创建资质证书
func (r *PilotRepo) CreateCertification(cert *model.PilotCertification) error {
	return r.db.Create(cert).Error
}

// GetCertificationByID 根据ID获取证书
func (r *PilotRepo) GetCertificationByID(id int64) (*model.PilotCertification, error) {
	var cert model.PilotCertification
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&cert).Error
	return &cert, err
}

// GetCertificationsByPilotID 获取飞手所有证书
func (r *PilotRepo) GetCertificationsByPilotID(pilotID int64) ([]model.PilotCertification, error) {
	var certs []model.PilotCertification
	err := r.db.Where("pilot_id = ? AND deleted_at IS NULL", pilotID).Order("created_at DESC").Find(&certs).Error
	return certs, err
}

// UpdateCertification 更新证书
func (r *PilotRepo) UpdateCertification(cert *model.PilotCertification) error {
	return r.db.Save(cert).Error
}

// UpdateCertificationStatus 更新证书审核状态
func (r *PilotRepo) UpdateCertificationStatus(id int64, status, note string, reviewedBy int64) error {
	now := time.Now()
	return r.db.Model(&model.PilotCertification{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":      status,
		"review_note": note,
		"reviewed_at": &now,
		"reviewed_by": reviewedBy,
	}).Error
}

// ListPendingCertifications 获取待审核的证书列表
func (r *PilotRepo) ListPendingCertifications(page, pageSize int) ([]model.PilotCertification, int64, error) {
	var certs []model.PilotCertification
	var total int64

	query := r.db.Model(&model.PilotCertification{}).
		Where("deleted_at IS NULL").
		Where("status = 'pending'")

	query.Count(&total)
	err := query.Preload("Pilot").Preload("Pilot.User").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at ASC").Find(&certs).Error
	return certs, total, err
}

// ==================== 飞行记录 ====================

// CreateFlightLog 创建飞行记录
func (r *PilotRepo) CreateFlightLog(log *model.PilotFlightLog) error {
	return r.db.Create(log).Error
}

// GetFlightLogsByPilotID 获取飞手飞行记录
func (r *PilotRepo) GetFlightLogsByPilotID(pilotID int64, page, pageSize int) ([]model.PilotFlightLog, int64, error) {
	var logs []model.PilotFlightLog
	var total int64

	query := r.db.Model(&model.PilotFlightLog{}).Where("pilot_id = ?", pilotID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("flight_date DESC").Find(&logs).Error
	return logs, total, err
}

// GetFlightStatsByPilotID 获取飞手飞行统计
func (r *PilotRepo) GetFlightStatsByPilotID(pilotID int64) (totalHours float64, totalDistance float64, totalFlights int64, err error) {
	var result struct {
		TotalHours    float64
		TotalDistance float64
		TotalFlights  int64
	}
	err = r.db.Model(&model.PilotFlightLog{}).
		Select("COALESCE(SUM(flight_duration)/60, 0) as total_hours, COALESCE(SUM(flight_distance), 0) as total_distance, COUNT(*) as total_flights").
		Where("pilot_id = ?", pilotID).
		Scan(&result).Error
	return result.TotalHours, result.TotalDistance, result.TotalFlights, err
}

// ==================== 飞手-无人机绑定 ====================

// CreateBinding 创建飞手与无人机绑定
func (r *PilotRepo) CreateBinding(binding *model.PilotDroneBinding) error {
	return r.db.Create(binding).Error
}

// GetBindingsByPilotID 获取飞手绑定的无人机
func (r *PilotRepo) GetBindingsByPilotID(pilotID int64) ([]model.PilotDroneBinding, error) {
	var bindings []model.PilotDroneBinding
	err := r.db.Preload("Drone").Preload("Owner").
		Where("pilot_id = ? AND deleted_at IS NULL AND status = 'active'", pilotID).
		Find(&bindings).Error
	return bindings, err
}

// GetBindingsByDroneID 获取无人机绑定的飞手
func (r *PilotRepo) GetBindingsByDroneID(droneID int64) ([]model.PilotDroneBinding, error) {
	var bindings []model.PilotDroneBinding
	err := r.db.Preload("Pilot").Preload("Pilot.User").
		Where("drone_id = ? AND deleted_at IS NULL AND status = 'active'", droneID).
		Find(&bindings).Error
	return bindings, err
}

// CheckBinding 检查飞手是否可以操作某无人机
func (r *PilotRepo) CheckBinding(pilotID, droneID int64) (bool, error) {
	var count int64
	now := time.Now()
	err := r.db.Model(&model.PilotDroneBinding{}).
		Where("pilot_id = ? AND drone_id = ? AND deleted_at IS NULL AND status = 'active'", pilotID, droneID).
		Where("effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)", now, now).
		Count(&count).Error
	return count > 0, err
}

// RevokeBinding 撤销绑定
func (r *PilotRepo) RevokeBinding(id int64) error {
	return r.db.Model(&model.PilotDroneBinding{}).Where("id = ?", id).Update("status", "revoked").Error
}
