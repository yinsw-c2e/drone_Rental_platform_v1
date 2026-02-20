package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type MatchingRepo struct {
	db *gorm.DB
}

func NewMatchingRepo(db *gorm.DB) *MatchingRepo {
	return &MatchingRepo{db: db}
}

func (r *MatchingRepo) Create(record *model.MatchingRecord) error {
	return r.db.Create(record).Error
}

func (r *MatchingRepo) BatchCreate(records []model.MatchingRecord) error {
	if len(records) == 0 {
		return nil
	}
	return r.db.Create(&records).Error
}

func (r *MatchingRepo) GetByDemand(demandID int64, demandType string) ([]model.MatchingRecord, error) {
	var records []model.MatchingRecord
	err := r.db.Where("demand_id = ? AND demand_type = ?", demandID, demandType).
		Order("match_score DESC").Find(&records).Error
	return records, err
}

func (r *MatchingRepo) UpdateStatus(id int64, status string) error {
	return r.db.Model(&model.MatchingRecord{}).Where("id = ?", id).Update("status", status).Error
}

func (r *MatchingRepo) DeleteByDemand(demandID int64, demandType string) error {
	return r.db.Where("demand_id = ? AND demand_type = ?", demandID, demandType).
		Delete(&model.MatchingRecord{}).Error
}

func (r *MatchingRepo) FindAvailableOffers(lat, lng, radiusKM float64, demandType string) ([]model.RentalOffer, error) {
	var offers []model.RentalOffer
	distanceExpr := `(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))`

	err := r.db.Preload("Drone").
		Where("status = ?", "active").
		Where(distanceExpr+" < ?", lat, lng, lat, radiusKM).
		Find(&offers).Error
	return offers, err
}

func (r *MatchingRepo) FindAvailableDrones(lat, lng, radiusKM float64) ([]model.Drone, error) {
	var drones []model.Drone
	distanceExpr := `(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))`

	err := r.db.Where("availability_status = ?", "available").
		Where("certification_status = ?", "approved").
		Where(distanceExpr+" < ?", lat, lng, lat, radiusKM).
		Find(&drones).Error
	return drones, err
}
