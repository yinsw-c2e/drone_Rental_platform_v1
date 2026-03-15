package repository

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

func (r *DemandDomainRepo) CreateDemand(demand *model.Demand) error {
	if demand == nil {
		return nil
	}
	return r.db.Create(demand).Error
}

func (r *DemandDomainRepo) UpdateDemand(demand *model.Demand) error {
	if demand == nil {
		return nil
	}
	return r.db.Save(demand).Error
}

func (r *DemandDomainRepo) UpdateDemandFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.Demand{}).Where("id = ?", id).Updates(fields).Error
}

func (r *DemandDomainRepo) ListDemandsByClientUser(clientUserID int64, status string, page, pageSize int) ([]model.Demand, int64, error) {
	var demands []model.Demand
	var total int64

	query := r.db.Model(&model.Demand{}).Where("client_user_id = ?", clientUserID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

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

func (r *DemandDomainRepo) AdminListDemands(page, pageSize int, filters map[string]interface{}) ([]model.Demand, int64, error) {
	var demands []model.Demand
	var total int64

	query := r.db.Model(&model.Demand{}).
		Joins("LEFT JOIN users ON users.id = demands.client_user_id")
	if status, ok := filters["status"].(string); ok && strings.TrimSpace(status) != "" {
		query = query.Where("demands.status = ?", strings.TrimSpace(status))
	}
	if cargoScene, ok := filters["cargo_scene"].(string); ok && strings.TrimSpace(cargoScene) != "" {
		query = query.Where("demands.cargo_scene = ?", strings.TrimSpace(cargoScene))
	}
	if keyword, ok := filters["keyword"].(string); ok && strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		query = query.Where(`
			demands.demand_no LIKE ? OR
			demands.title LIKE ? OR
			demands.cargo_scene LIKE ? OR
			users.nickname LIKE ?
		`, like, like, like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.
		Preload("Client").
		Order("demands.created_at DESC, demands.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&demands).Error
	return demands, total, err
}

func (r *DemandDomainRepo) CountQuotesByDemandIDs(demandIDs []int64) (map[int64]int64, error) {
	result := make(map[int64]int64)
	if len(demandIDs) == 0 {
		return result, nil
	}

	type row struct {
		DemandID int64
		Total    int64
	}

	var rows []row
	if err := r.db.Model(&model.DemandQuote{}).
		Select("demand_id, COUNT(*) AS total").
		Where("demand_id IN ?", demandIDs).
		Group("demand_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, item := range rows {
		result[item.DemandID] = item.Total
	}
	return result, nil
}

func (r *DemandDomainRepo) CountActiveCandidatesByDemandIDs(demandIDs []int64) (map[int64]int64, error) {
	result := make(map[int64]int64)
	if len(demandIDs) == 0 {
		return result, nil
	}

	type row struct {
		DemandID int64
		Total    int64
	}

	var rows []row
	if err := r.db.Model(&model.DemandCandidatePilot{}).
		Select("demand_id, COUNT(*) AS total").
		Where("demand_id IN ? AND status = ?", demandIDs, "active").
		Group("demand_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, item := range rows {
		result[item.DemandID] = item.Total
	}
	return result, nil
}

func (r *DemandDomainRepo) ListExpiredActionableDemands(expiresBefore time.Time, limit int) ([]model.Demand, error) {
	if limit <= 0 {
		limit = 100
	}
	var demands []model.Demand
	err := r.db.
		Where("status IN ?", []string{"published", "quoting"}).
		Where("expires_at IS NOT NULL AND expires_at <= ?", expiresBefore).
		Order("expires_at ASC, id ASC").
		Limit(limit).
		Find(&demands).Error
	return demands, err
}

func (r *DemandDomainRepo) CreateDemandQuote(quote *model.DemandQuote) error {
	if quote == nil {
		return nil
	}
	return r.db.Create(quote).Error
}

func (r *DemandDomainRepo) GetDemandQuoteByID(id int64) (*model.DemandQuote, error) {
	var quote model.DemandQuote
	err := r.db.Preload("Owner").Preload("Drone").Where("id = ?", id).First(&quote).Error
	if err != nil {
		return nil, err
	}
	return &quote, nil
}

func (r *DemandDomainRepo) ListDemandQuotes(demandID int64) ([]model.DemandQuote, error) {
	var quotes []model.DemandQuote
	err := r.db.
		Preload("Owner").
		Preload("Drone").
		Where("demand_id = ?", demandID).
		Order("created_at ASC").
		Find(&quotes).Error
	return quotes, err
}

func (r *DemandDomainRepo) UpdateDemandQuoteFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.DemandQuote{}).Where("id = ?", id).Updates(fields).Error
}

func (r *DemandDomainRepo) RejectOtherSubmittedQuotes(demandID, selectedQuoteID int64) error {
	return r.db.Model(&model.DemandQuote{}).
		Where("demand_id = ? AND id <> ? AND status IN ?", demandID, selectedQuoteID, []string{"submitted", "selected"}).
		Updates(map[string]interface{}{
			"status":     "rejected",
			"updated_at": time.Now(),
		}).Error
}

func (r *DemandDomainRepo) UpdateDemandQuoteFieldsByDemand(demandID int64, fields map[string]interface{}, statuses []string) error {
	if demandID == 0 || len(fields) == 0 {
		return nil
	}

	query := r.db.Model(&model.DemandQuote{}).Where("demand_id = ?", demandID)
	if len(statuses) > 0 {
		query = query.Where("status IN ?", statuses)
	}
	return query.Updates(fields).Error
}

func (r *DemandDomainRepo) GenerateDemandNo() string {
	return fmt.Sprintf("DM%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
}

func (r *DemandDomainRepo) GenerateQuoteNo() string {
	return fmt.Sprintf("QT%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
}

func (r *DemandDomainRepo) WithTx(tx *gorm.DB) *DemandDomainRepo {
	if tx == nil {
		return r
	}
	return NewDemandDomainRepo(tx)
}
