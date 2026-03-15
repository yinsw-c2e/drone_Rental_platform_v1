package repository

import (
	"time"

	"wurenji-backend/internal/model"
)

func (r *OwnerDomainRepo) ListBindingsByPilot(pilotUserID int64, status string, page, pageSize int) ([]model.OwnerPilotBinding, int64, error) {
	var bindings []model.OwnerPilotBinding
	var total int64

	query := r.db.Model(&model.OwnerPilotBinding{}).Where("pilot_user_id = ?", pilotUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Owner").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&bindings).Error
	return bindings, total, err
}

func (r *DemandDomainRepo) ListCandidateDemands(page, pageSize int) ([]model.Demand, int64, error) {
	var demands []model.Demand
	var total int64

	query := r.db.Model(&model.Demand{}).
		Where("service_type = ?", "heavy_cargo_lift_transport").
		Where("allows_pilot_candidate = ?", true).
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

func (r *DemandDomainRepo) GetDemandCandidateByDemandAndPilot(demandID, pilotUserID int64) (*model.DemandCandidatePilot, error) {
	var candidate model.DemandCandidatePilot
	err := r.db.Where("demand_id = ? AND pilot_user_id = ?", demandID, pilotUserID).
		Order("id DESC").
		First(&candidate).Error
	if err != nil {
		return nil, err
	}
	return &candidate, nil
}

func (r *DemandDomainRepo) CreateDemandCandidate(candidate *model.DemandCandidatePilot) error {
	if candidate == nil {
		return nil
	}
	return r.db.Create(candidate).Error
}

func (r *DemandDomainRepo) ListActiveDemandCandidatesByDemand(demandID int64) ([]model.DemandCandidatePilot, error) {
	var candidates []model.DemandCandidatePilot
	err := r.db.Where("demand_id = ? AND status = ?", demandID, "active").
		Order("updated_at DESC, id DESC").
		Find(&candidates).Error
	return candidates, err
}

func (r *DemandDomainRepo) UpdateDemandCandidateFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.DemandCandidatePilot{}).Where("id = ?", id).Updates(fields).Error
}

func (r *DispatchRepo) GetFormalTaskByID(id int64) (*model.FormalDispatchTask, error) {
	var task model.FormalDispatchTask
	err := r.db.Preload("Order").Preload("Provider").Preload("TargetPilot").
		Where("id = ?", id).
		First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *DispatchRepo) ListFormalTasksByPilot(pilotUserID int64, status string, page, pageSize int) ([]model.FormalDispatchTask, int64, error) {
	var tasks []model.FormalDispatchTask
	var total int64

	query := r.db.Model(&model.FormalDispatchTask{}).Where("target_pilot_user_id = ?", pilotUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Order").
		Preload("Provider").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&tasks).Error
	return tasks, total, err
}

func (r *DispatchRepo) UpdateFormalTaskFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.FormalDispatchTask{}).Where("id = ?", id).Updates(fields).Error
}

func (r *FlightRepo) ListFlightRecordsByPilot(pilotUserID int64, page, pageSize int) ([]model.FlightRecord, int64, error) {
	var records []model.FlightRecord
	var total int64

	query := r.db.Model(&model.FlightRecord{}).
		Where("pilot_user_id = ? AND deleted_at IS NULL", pilotUserID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Order").
		Order("COALESCE(landing_at, takeoff_at, updated_at, created_at) DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&records).Error
	return records, total, err
}
