package repository

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/limits"
)

type OrderBroadcastRepo struct {
	db *gorm.DB
}

type BroadcastStats struct {
	TotalBroadcasts   int64   `json:"total_broadcasts"`
	GrabbedCount      int64   `json:"grabbed_count"`
	ExpiredCount      int64   `json:"expired_count"`
	AutoAssignedCount int64   `json:"auto_assigned_count"`
	AvgGrabSeconds    float64 `json:"avg_grab_seconds"`
	UnmatchedRatePct  float64 `json:"unmatched_rate_pct"`
}

func NewOrderBroadcastRepo(db *gorm.DB) *OrderBroadcastRepo {
	return &OrderBroadcastRepo{db: db}
}

func (r *OrderBroadcastRepo) DB() *gorm.DB {
	return r.db
}

func (r *OrderBroadcastRepo) Create(broadcast *model.OrderBroadcast) error {
	return r.db.Create(broadcast).Error
}

func (r *OrderBroadcastRepo) GetByID(id int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Preload("Order").Where("id = ?", id).First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) GetByOrderID(orderID int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Preload("Order").Where("order_id = ?", orderID).Order("id DESC").First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) LockByOrderID(orderID int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("order_id = ?", orderID).
		Order("id DESC").
		First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) LockByID(id int64) (*model.OrderBroadcast, error) {
	var broadcast model.OrderBroadcast
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", id).
		First(&broadcast).Error
	if err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func (r *OrderBroadcastRepo) ListOpen(now time.Time, limit int) ([]model.OrderBroadcast, error) {
	var items []model.OrderBroadcast
	limit = limits.NormalizeLimit(limit, 50, 200)
	err := r.db.Preload("Order").
		Where("status = ? AND expires_at > ?", "open", now).
		Order("created_at ASC, id ASC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *OrderBroadcastRepo) ListAwaitingAutoAssign(now time.Time, attemptCutoff time.Time, limit int) ([]model.OrderBroadcast, error) {
	var items []model.OrderBroadcast
	limit = limits.NormalizeLimit(limit, 100, 500)
	err := r.db.Preload("Order").
		Where("status = ? AND expires_at > ? AND expires_at <= ?", "open", now, attemptCutoff).
		Order("expires_at ASC, id ASC").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *OrderBroadcastRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.OrderBroadcast{}).Where("id = ?", id).Updates(fields).Error
}

func (r *OrderBroadcastRepo) ExcludeProvider(orderID, broadcastID, providerUserID int64, reason string, expiresAt ...*time.Time) error {
	if r == nil || r.db == nil || orderID <= 0 || broadcastID <= 0 || providerUserID <= 0 {
		return nil
	}
	var expiry *time.Time
	if len(expiresAt) > 0 && expiresAt[0] != nil {
		value := *expiresAt[0]
		expiry = &value
	}
	exclusion := &model.OrderBroadcastExclusion{
		OrderID:        orderID,
		BroadcastID:    broadcastID,
		ProviderUserID: providerUserID,
		Reason:         strings.TrimSpace(reason),
		CreatedAt:      time.Now(),
		ExpiresAt:      expiry,
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing model.OrderBroadcastExclusion
		err := tx.Where("order_id = ? AND provider_user_id = ?", orderID, providerUserID).First(&existing).Error
		if err == nil {
			if existing.ExpiresAt == nil && expiry != nil {
				return nil
			}
			return tx.Model(&model.OrderBroadcastExclusion{}).
				Where("id = ?", existing.ID).
				Updates(map[string]interface{}{
					"broadcast_id": broadcastID,
					"reason":       exclusion.Reason,
					"expires_at":   expiry,
				}).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return tx.Create(exclusion).Error
	})
}

func (r *OrderBroadcastRepo) DeleteTimeoutExclusionsByOrder(orderID int64) error {
	if r == nil || r.db == nil || orderID <= 0 {
		return nil
	}
	return r.db.Where("order_id = ? AND reason = ?", orderID, "assignment_timeout").
		Delete(&model.OrderBroadcastExclusion{}).Error
}

func (r *OrderBroadcastRepo) IsProviderExcluded(orderID, broadcastID, providerUserID int64) (bool, error) {
	if r == nil || r.db == nil || providerUserID <= 0 {
		return false, nil
	}
	now := time.Now()
	query := r.db.Model(&model.OrderBroadcastExclusion{}).
		Where("provider_user_id = ?", providerUserID).
		Where("(expires_at IS NULL OR expires_at > ?)", now)
	switch {
	case orderID > 0 && broadcastID > 0:
		query = query.Where("(broadcast_id = ? OR (order_id = ? AND expires_at IS NULL))", broadcastID, orderID)
	case orderID > 0:
		query = query.Where("order_id = ? AND expires_at IS NULL", orderID)
	case broadcastID > 0:
		query = query.Where("broadcast_id = ?", broadcastID)
	default:
		return false, nil
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *OrderBroadcastRepo) MarkExpired(now time.Time, limit int) (int64, error) {
	limit = limits.NormalizeLimit(limit, 100, 1000)
	subquery := r.db.Model(&model.OrderBroadcast{}).
		Select("id").
		Where("status = ? AND expires_at <= ?", "open", now).
		Order("expires_at ASC, id ASC").
		Limit(limit)
	result := r.db.Model(&model.OrderBroadcast{}).
		Where("id IN (?)", subquery).
		Updates(map[string]interface{}{
			"status":     "expired",
			"updated_at": now,
		})
	return result.RowsAffected, result.Error
}

func (r *OrderBroadcastRepo) StatsBetween(from, to time.Time) (*BroadcastStats, error) {
	stats := &BroadcastStats{}
	if r == nil || r.db == nil {
		return stats, nil
	}
	var items []model.OrderBroadcast
	if err := r.db.
		Where("created_at >= ? AND created_at < ?", from, to).
		Find(&items).Error; err != nil {
		return nil, err
	}

	var grabSecondsTotal float64
	var grabSecondsCount int64
	for _, item := range items {
		stats.TotalBroadcasts++
		switch item.Status {
		case "grabbed":
			stats.GrabbedCount++
			if item.GrabbedAt != nil {
				grabSecondsTotal += item.GrabbedAt.Sub(item.CreatedAt).Seconds()
				grabSecondsCount++
			}
		case "expired":
			stats.ExpiredCount++
		case "auto_assigning":
			stats.AutoAssignedCount++
		}
	}
	if grabSecondsCount > 0 {
		stats.AvgGrabSeconds = grabSecondsTotal / float64(grabSecondsCount)
	}
	if stats.TotalBroadcasts > 0 {
		stats.UnmatchedRatePct = float64(stats.ExpiredCount) / float64(stats.TotalBroadcasts) * 100
	}
	return stats, nil
}

func (r *OrderBroadcastRepo) ListRecent(limit int) ([]model.OrderBroadcast, error) {
	var items []model.OrderBroadcast
	if r == nil || r.db == nil {
		return items, nil
	}
	limit = limits.NormalizeLimit(limit, 50, 200)
	err := r.db.Preload("Order").
		Order("created_at DESC, id DESC").
		Limit(limit).
		Find(&items).Error
	return items, err
}
