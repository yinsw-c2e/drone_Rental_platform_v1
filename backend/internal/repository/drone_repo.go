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

	query := r.db.Model(&model.Drone{}).Preload("Owner")
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
