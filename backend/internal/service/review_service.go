package service

import (
	"errors"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type ReviewService struct {
	reviewRepo *repository.ReviewRepo
	droneRepo  *repository.DroneRepo
	orderRepo  *repository.OrderRepo
}

func NewReviewService(reviewRepo *repository.ReviewRepo, droneRepo *repository.DroneRepo, orderRepo *repository.OrderRepo) *ReviewService {
	return &ReviewService{reviewRepo: reviewRepo, droneRepo: droneRepo, orderRepo: orderRepo}
}

func (s *ReviewService) CreateReview(review *model.Review) error {
	// Check if order is completed
	order, err := s.orderRepo.GetByID(review.OrderID)
	if err != nil {
		return errors.New("订单不存在")
	}
	if order.Status != "completed" {
		return errors.New("订单未完成，不能评价")
	}

	// Check if already reviewed
	exists, err := s.reviewRepo.ExistsByOrderAndReviewer(review.OrderID, review.ReviewerID)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("已评价过此订单")
	}

	if err := s.reviewRepo.Create(review); err != nil {
		return err
	}

	// Update drone rating if target is drone
	if review.TargetType == "drone" {
		s.droneRepo.UpdateRating(review.TargetID)
	}

	return nil
}

func (s *ReviewService) GetByOrder(orderID int64) ([]model.Review, error) {
	return s.reviewRepo.GetByOrderID(orderID)
}

func (s *ReviewService) ListByTarget(targetType string, targetID int64, page, pageSize int) ([]model.Review, int64, error) {
	return s.reviewRepo.ListByTarget(targetType, targetID, page, pageSize)
}
