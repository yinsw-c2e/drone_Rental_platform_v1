package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type ReviewRepo struct {
	db *gorm.DB
}

func NewReviewRepo(db *gorm.DB) *ReviewRepo {
	return &ReviewRepo{db: db}
}

func (r *ReviewRepo) Create(review *model.Review) error {
	return r.db.Create(review).Error
}

func (r *ReviewRepo) GetByOrderID(orderID int64) ([]model.Review, error) {
	var reviews []model.Review
	err := r.db.Where("order_id = ?", orderID).Find(&reviews).Error
	return reviews, err
}

func (r *ReviewRepo) ListByTarget(targetType string, targetID int64, page, pageSize int) ([]model.Review, int64, error) {
	var reviews []model.Review
	var total int64

	query := r.db.Model(&model.Review{}).Where("target_type = ? AND target_id = ?", targetType, targetID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&reviews).Error
	return reviews, total, err
}

func (r *ReviewRepo) ExistsByOrderAndReviewer(orderID, reviewerID int64) (bool, error) {
	var count int64
	err := r.db.Model(&model.Review{}).
		Where("order_id = ? AND reviewer_id = ?", orderID, reviewerID).
		Count(&count).Error
	return count > 0, err
}

func (r *ReviewRepo) GetAverageRating(targetType string, targetID int64) (float64, error) {
	var avg float64
	err := r.db.Model(&model.Review{}).
		Where("target_type = ? AND target_id = ?", targetType, targetID).
		Select("COALESCE(AVG(rating), 0)").Scan(&avg).Error
	return avg, err
}
