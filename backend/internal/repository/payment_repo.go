package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type PaymentRepo struct {
	db *gorm.DB
}

func NewPaymentRepo(db *gorm.DB) *PaymentRepo {
	return &PaymentRepo{db: db}
}

func (r *PaymentRepo) Create(payment *model.Payment) error {
	return r.db.Create(payment).Error
}

func (r *PaymentRepo) GetByPaymentNo(paymentNo string) (*model.Payment, error) {
	var payment model.Payment
	err := r.db.Where("payment_no = ?", paymentNo).First(&payment).Error
	return &payment, err
}

func (r *PaymentRepo) GetByOrderID(orderID int64) ([]model.Payment, error) {
	var payments []model.Payment
	err := r.db.Where("order_id = ?", orderID).Order("created_at DESC").Find(&payments).Error
	return payments, err
}

func (r *PaymentRepo) Update(payment *model.Payment) error {
	return r.db.Save(payment).Error
}

func (r *PaymentRepo) ListByUser(userID int64, page, pageSize int) ([]model.Payment, int64, error) {
	var payments []model.Payment
	var total int64

	query := r.db.Model(&model.Payment{}).Where("user_id = ?", userID)
	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&payments).Error
	return payments, total, err
}

func (r *PaymentRepo) List(page, pageSize int) ([]model.Payment, int64, error) {
	var payments []model.Payment
	var total int64

	r.db.Model(&model.Payment{}).Count(&total)
	err := r.db.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&payments).Error
	return payments, total, err
}
