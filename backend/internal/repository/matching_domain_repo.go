package repository

import (
	"time"

	"wurenji-backend/internal/model"
)

func (r *OwnerDomainRepo) ListActiveSuppliesByOwner(ownerUserID int64) ([]model.OwnerSupply, error) {
	var supplies []model.OwnerSupply
	err := r.db.
		Preload("Drone").
		Where("owner_user_id = ? AND status = ?", ownerUserID, "active").
		Order("updated_at DESC, id DESC").
		Find(&supplies).Error
	return supplies, err
}

func (r *DemandDomainRepo) ListOpenDemands(limit int) ([]model.Demand, error) {
	var demands []model.Demand
	query := r.db.Model(&model.Demand{}).
		Where("service_type = ?", "heavy_cargo_lift_transport").
		Where("status IN ?", []string{"published", "quoting"}).
		Where("(expires_at IS NULL OR expires_at > ?)", time.Now()).
		Order("created_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&demands).Error
	return demands, err
}

func (r *DemandDomainRepo) ListDemandCandidates(demandID int64, statuses []string) ([]model.DemandCandidatePilot, error) {
	var candidates []model.DemandCandidatePilot
	query := r.db.
		Preload("Pilot").
		Where("demand_id = ?", demandID)
	if len(statuses) > 0 {
		query = query.Where("status IN ?", statuses)
	}

	err := query.
		Order("created_at ASC").
		Find(&candidates).Error
	return candidates, err
}
