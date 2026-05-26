package repository

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/limits"
)

type BroadcastAssignmentRepo struct {
	db *gorm.DB
}

func NewBroadcastAssignmentRepo(db *gorm.DB) *BroadcastAssignmentRepo {
	return &BroadcastAssignmentRepo{db: db}
}

func (r *BroadcastAssignmentRepo) DB() *gorm.DB {
	return r.db
}

func (r *BroadcastAssignmentRepo) Create(assignment *model.BroadcastAssignment) error {
	return r.db.Create(assignment).Error
}

func (r *BroadcastAssignmentRepo) LockByID(id int64) (*model.BroadcastAssignment, error) {
	var assignment model.BroadcastAssignment
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", id).
		First(&assignment).Error
	if err != nil {
		return nil, err
	}
	return &assignment, nil
}

func (r *BroadcastAssignmentRepo) GetActiveByBroadcast(broadcastID int64) (*model.BroadcastAssignment, error) {
	var assignment model.BroadcastAssignment
	err := r.db.Where("broadcast_id = ? AND status = ?", broadcastID, "pending_accept").
		Order("attempt_seq DESC, id DESC").
		First(&assignment).Error
	if err != nil {
		return nil, err
	}
	return &assignment, nil
}

func (r *BroadcastAssignmentRepo) ListAttempts(broadcastID int64) ([]model.BroadcastAssignment, error) {
	var items []model.BroadcastAssignment
	err := r.db.Where("broadcast_id = ?", broadcastID).
		Order("attempt_seq ASC, id ASC").
		Find(&items).Error
	return items, err
}

func (r *BroadcastAssignmentRepo) ListPendingByProvider(providerUserID int64, now time.Time, limit int) ([]model.BroadcastAssignment, error) {
	var items []model.BroadcastAssignment
	limit = limits.NormalizeLimit(limit, 20, 100)
	err := r.db.Preload("Broadcast").Preload("Order").
		Where("provider_user_id = ? AND status = ?", providerUserID, "pending_accept").
		Where("accept_deadline_at > ?", now).
		Order("accept_deadline_at ASC, id ASC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *BroadcastAssignmentRepo) ListOverduePending(now time.Time, limit int) ([]model.BroadcastAssignment, error) {
	var items []model.BroadcastAssignment
	limit = limits.NormalizeLimit(limit, 100, 1000)
	err := r.db.Where("status = ? AND accept_deadline_at <= ?", "pending_accept", now).
		Order("accept_deadline_at ASC, id ASC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *BroadcastAssignmentRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.BroadcastAssignment{}).Where("id = ?", id).Updates(fields).Error
}

func (r *BroadcastAssignmentRepo) SupersedeOtherPending(broadcastID, keepID int64, now time.Time) error {
	return r.db.Model(&model.BroadcastAssignment{}).
		Where("broadcast_id = ? AND id <> ? AND status = ?", broadcastID, keepID, "pending_accept").
		Updates(map[string]interface{}{
			"status":       "superseded",
			"responded_at": now,
			"updated_at":   now,
		}).Error
}

func (r *BroadcastAssignmentRepo) ExpireOverdue(now time.Time, limit int) (int64, error) {
	limit = limits.NormalizeLimit(limit, 100, 1000)
	subquery := r.db.Model(&model.BroadcastAssignment{}).
		Select("id").
		Where("status = ? AND accept_deadline_at <= ?", "pending_accept", now).
		Order("accept_deadline_at ASC, id ASC").
		Limit(limit)
	result := r.db.Model(&model.BroadcastAssignment{}).
		Where("id IN (?)", subquery).
		Updates(map[string]interface{}{
			"status":       "expired",
			"responded_at": now,
			"updated_at":   now,
		})
	return result.RowsAffected, result.Error
}
