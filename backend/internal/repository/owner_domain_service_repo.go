package repository

import (
	"strings"
	"time"

	"wurenji-backend/internal/model"
)

func (r *OwnerDomainRepo) ListMarketplaceSupplies(region, cargoScene, serviceType string, minPayloadKG float64, acceptsDirectOrder *bool, page, pageSize int) ([]model.OwnerSupply, int64, error) {
	var supplies []model.OwnerSupply
	var total int64

	query := r.db.Model(&model.OwnerSupply{}).
		Joins("JOIN drones ON drones.id = owner_supplies.drone_id AND drones.deleted_at IS NULL").
		Where("owner_supplies.status = ?", "active").
		Where("owner_supplies.mtow_kg >= ? AND owner_supplies.max_payload_kg >= ?", model.HeavyLiftMinMTOWKG, model.HeavyLiftMinPayloadKG).
		Where("drones.availability_status = ?", "available").
		Where("drones.certification_status = ?", "approved").
		Where("drones.uom_verified = ?", "verified").
		Where("drones.insurance_verified = ?", "verified").
		Where("drones.airworthiness_verified = ?", "verified")

	if trimmed := strings.TrimSpace(region); trimmed != "" {
		like := "%" + trimmed + "%"
		query = query.Where("(drones.city LIKE ? OR CAST(owner_supplies.service_area_snapshot AS CHAR) LIKE ?)", like, like)
	}
	if trimmed := strings.TrimSpace(cargoScene); trimmed != "" {
		query = query.Where("JSON_CONTAINS(owner_supplies.cargo_scenes, JSON_ARRAY(?))", trimmed)
	}
	if trimmed := strings.TrimSpace(serviceType); trimmed != "" {
		query = query.Where("JSON_CONTAINS(owner_supplies.service_types, JSON_ARRAY(?))", trimmed)
	}
	if minPayloadKG > 0 {
		query = query.Where("owner_supplies.max_payload_kg >= ?", minPayloadKG)
	}
	if acceptsDirectOrder != nil {
		query = query.Where("owner_supplies.accepts_direct_order = ?", *acceptsDirectOrder)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Drone").
		Preload("Owner").
		Order("owner_supplies.updated_at DESC, owner_supplies.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&supplies).Error
	return supplies, total, err
}

func (r *OwnerDomainRepo) GetMarketplaceSupplyByID(id int64) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.Model(&model.OwnerSupply{}).
		Joins("JOIN drones ON drones.id = owner_supplies.drone_id AND drones.deleted_at IS NULL").
		Preload("Drone").
		Preload("Owner").
		Where("owner_supplies.id = ?", id).
		Where("owner_supplies.status = ?", "active").
		Where("owner_supplies.mtow_kg >= ? AND owner_supplies.max_payload_kg >= ?", model.HeavyLiftMinMTOWKG, model.HeavyLiftMinPayloadKG).
		Where("drones.availability_status = ?", "available").
		Where("drones.certification_status = ?", "approved").
		Where("drones.uom_verified = ?", "verified").
		Where("drones.insurance_verified = ?", "verified").
		Where("drones.airworthiness_verified = ?", "verified").
		First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) ListSuppliesByOwner(ownerUserID int64, status string, page, pageSize int) ([]model.OwnerSupply, int64, error) {
	var supplies []model.OwnerSupply
	var total int64

	query := r.db.Model(&model.OwnerSupply{}).Where("owner_user_id = ?", ownerUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Drone").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&supplies).Error
	return supplies, total, err
}

func (r *OwnerDomainRepo) AdminListSupplies(page, pageSize int, filters map[string]interface{}) ([]model.OwnerSupply, int64, error) {
	var supplies []model.OwnerSupply
	var total int64

	query := r.db.Model(&model.OwnerSupply{}).
		Joins("LEFT JOIN drones ON drones.id = owner_supplies.drone_id AND drones.deleted_at IS NULL").
		Joins("LEFT JOIN users ON users.id = owner_supplies.owner_user_id")

	if status, ok := filters["status"].(string); ok && strings.TrimSpace(status) != "" {
		query = query.Where("owner_supplies.status = ?", strings.TrimSpace(status))
	}
	if cargoScene, ok := filters["cargo_scene"].(string); ok && strings.TrimSpace(cargoScene) != "" {
		query = query.Where("JSON_CONTAINS(owner_supplies.cargo_scenes, JSON_ARRAY(?))", strings.TrimSpace(cargoScene))
	}
	if keyword, ok := filters["keyword"].(string); ok && strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		query = query.Where(`
			owner_supplies.supply_no LIKE ? OR
			owner_supplies.title LIKE ? OR
			drones.serial_number LIKE ? OR
			drones.model LIKE ? OR
			users.nickname LIKE ?
		`, like, like, like, like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Drone").
		Preload("Owner").
		Order("owner_supplies.updated_at DESC, owner_supplies.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&supplies).Error
	return supplies, total, err
}

func (r *OwnerDomainRepo) GetSupplyByIDAndOwner(id, ownerUserID int64) (*model.OwnerSupply, error) {
	var supply model.OwnerSupply
	err := r.db.
		Preload("Drone").
		Where("id = ? AND owner_user_id = ?", id, ownerUserID).
		First(&supply).Error
	if err != nil {
		return nil, err
	}
	return &supply, nil
}

func (r *OwnerDomainRepo) CreateSupply(supply *model.OwnerSupply) error {
	if supply == nil {
		return nil
	}
	return r.db.Create(supply).Error
}

func (r *OwnerDomainRepo) UpdateSupply(supply *model.OwnerSupply) error {
	if supply == nil {
		return nil
	}
	return r.db.Save(supply).Error
}

func (r *OwnerDomainRepo) UpdateSupplyFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.OwnerSupply{}).Where("id = ?", id).Updates(fields).Error
}

func (r *OwnerDomainRepo) ListBindingsByOwner(ownerUserID int64, status string, page, pageSize int) ([]model.OwnerPilotBinding, int64, error) {
	var bindings []model.OwnerPilotBinding
	var total int64

	query := r.db.Model(&model.OwnerPilotBinding{}).Where("owner_user_id = ?", ownerUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Pilot").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&bindings).Error
	return bindings, total, err
}

func (r *OwnerDomainRepo) GetBindingByID(id int64) (*model.OwnerPilotBinding, error) {
	var binding model.OwnerPilotBinding
	err := r.db.Preload("Pilot").Preload("Owner").Where("id = ?", id).First(&binding).Error
	if err != nil {
		return nil, err
	}
	return &binding, nil
}

func (r *OwnerDomainRepo) CreateBinding(binding *model.OwnerPilotBinding) error {
	if binding == nil {
		return nil
	}
	return r.db.Create(binding).Error
}

func (r *OwnerDomainRepo) UpdateBindingFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.OwnerPilotBinding{}).Where("id = ?", id).Updates(fields).Error
}

func (r *OwnerDomainRepo) ListExpiredPendingBindings(cutoff time.Time, limit int) ([]model.OwnerPilotBinding, error) {
	if limit <= 0 {
		limit = 100
	}
	var bindings []model.OwnerPilotBinding
	err := r.db.
		Where("status = ?", "pending_confirmation").
		Where("created_at <= ?", cutoff).
		Order("created_at ASC, id ASC").
		Limit(limit).
		Find(&bindings).Error
	return bindings, err
}

func (r *DemandDomainRepo) ListRecommendedDemands(page, pageSize int) ([]model.Demand, int64, error) {
	var demands []model.Demand
	var total int64

	query := r.db.Model(&model.Demand{}).
		Where("status IN ?", []string{"published", "quoting"}).
		Where("(expires_at IS NULL OR expires_at > ?)", time.Now())

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&demands).Error
	return demands, total, err
}

func (r *DemandDomainRepo) GetQuoteByDemandAndOwner(demandID, ownerUserID int64) (*model.DemandQuote, error) {
	var quote model.DemandQuote
	err := r.db.Where("demand_id = ? AND owner_user_id = ?", demandID, ownerUserID).
		Order("id DESC").
		First(&quote).Error
	if err != nil {
		return nil, err
	}
	return &quote, nil
}

func (r *DemandDomainRepo) ListQuotesByOwner(ownerUserID int64, status string, page, pageSize int) ([]model.DemandQuote, int64, error) {
	var quotes []model.DemandQuote
	var total int64

	query := r.db.Model(&model.DemandQuote{}).Where("owner_user_id = ?", ownerUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Demand").
		Preload("Drone").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&quotes).Error
	return quotes, total, err
}
