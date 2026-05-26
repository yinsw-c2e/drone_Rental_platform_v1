package repository

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wurenji-backend/internal/model"
)

type ProviderPresenceRepo struct {
	db *gorm.DB
}

func NewProviderPresenceRepo(db *gorm.DB) *ProviderPresenceRepo {
	return &ProviderPresenceRepo{db: db}
}

func (r *ProviderPresenceRepo) DB() *gorm.DB {
	return r.db
}

func (r *ProviderPresenceRepo) Upsert(presence *model.ProviderPresence) error {
	if presence == nil {
		return nil
	}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"online",
			"last_latitude",
			"last_longitude",
			"last_heartbeat_at",
			"accepted_service_classes",
			"max_radius_km",
			"status",
			"updated_at",
		}),
	}).Create(presence).Error
}

func (r *ProviderPresenceRepo) GetByUserID(userID int64) (*model.ProviderPresence, error) {
	var presence model.ProviderPresence
	err := r.db.Where("user_id = ?", userID).First(&presence).Error
	if err != nil {
		return nil, err
	}
	return &presence, nil
}

func (r *ProviderPresenceRepo) SetOffline(userID int64, now time.Time) error {
	return r.db.Model(&model.ProviderPresence{}).
		Where("user_id = ?", userID).
		Updates(map[string]interface{}{
			"online":     false,
			"updated_at": now,
		}).Error
}

func (r *ProviderPresenceRepo) MarkStaleOffline(cutoff time.Time) (int64, error) {
	result := r.db.Model(&model.ProviderPresence{}).
		Where("online = ?", true).
		Where("last_heartbeat_at IS NULL OR last_heartbeat_at < ?", cutoff).
		Updates(map[string]interface{}{"online": false})
	return result.RowsAffected, result.Error
}

func (r *ProviderPresenceRepo) ListOnlineSince(cutoff time.Time) ([]model.ProviderPresence, error) {
	var items []model.ProviderPresence
	err := r.db.Where("online = ? AND status = ?", true, "active").
		Where("last_heartbeat_at >= ?", cutoff).
		Order("last_heartbeat_at DESC").
		Find(&items).Error
	return items, err
}
