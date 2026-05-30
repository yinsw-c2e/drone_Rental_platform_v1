package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wurenji-backend/internal/model"
)

type WeChatSubscribeRepo struct {
	db *gorm.DB
}

func NewWeChatSubscribeRepo(db *gorm.DB) *WeChatSubscribeRepo {
	return &WeChatSubscribeRepo{db: db}
}

func (r *WeChatSubscribeRepo) Grant(ctx context.Context, userID int64, templateID string, count int) error {
	if r == nil || r.db == nil || userID <= 0 {
		return nil
	}
	templateID = strings.TrimSpace(templateID)
	if templateID == "" || count <= 0 {
		return nil
	}
	now := time.Now()
	grant := model.WechatSubscribeGrant{
		UserID:         userID,
		TemplateID:     templateID,
		RemainingCount: count,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "template_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"remaining_count": gorm.Expr("remaining_count + ?", count),
			"updated_at":      now,
		}),
	}).Create(&grant).Error
}

func (r *WeChatSubscribeRepo) TryConsume(ctx context.Context, userID int64, templateID string) (bool, error) {
	if r == nil || r.db == nil || userID <= 0 {
		return false, nil
	}
	templateID = strings.TrimSpace(templateID)
	if templateID == "" {
		return false, nil
	}
	result := r.db.WithContext(ctx).
		Model(&model.WechatSubscribeGrant{}).
		Where("user_id = ? AND template_id = ? AND remaining_count > 0", userID, templateID).
		Updates(map[string]interface{}{
			"remaining_count": gorm.Expr("remaining_count - 1"),
			"updated_at":      time.Now(),
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}
