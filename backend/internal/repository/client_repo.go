package repository

import (
	"wurenji-backend/internal/model"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type ClientRepo struct {
	db *gorm.DB
}

func NewClientRepo(db *gorm.DB) *ClientRepo {
	return &ClientRepo{db: db}
}

// ==================== Client CRUD ====================

func (r *ClientRepo) Create(client *model.Client) error {
	return r.db.Create(client).Error
}

func (r *ClientRepo) GetByID(id int64) (*model.Client, error) {
	var client model.Client
	err := r.db.Preload("User").First(&client, id).Error
	if err != nil {
		return nil, err
	}
	return &client, nil
}

func (r *ClientRepo) GetByUserID(userID int64) (*model.Client, error) {
	var client model.Client
	err := r.db.Preload("User").Where("user_id = ?", userID).First(&client).Error
	if err != nil {
		return nil, err
	}
	return &client, nil
}

func (r *ClientRepo) Update(client *model.Client) error {
	return r.db.Save(client).Error
}

func (r *ClientRepo) UpdateFields(id int64, fields map[string]interface{}) error {
	return r.db.Model(&model.Client{}).Where("id = ?", id).Updates(fields).Error
}

func (r *ClientRepo) Delete(id int64) error {
	return r.db.Delete(&model.Client{}, id).Error
}

// ==================== 列表查询 ====================

func (r *ClientRepo) List(page, pageSize int, clientType, status string) ([]model.Client, int64, error) {
	var clients []model.Client
	var total int64

	query := r.db.Model(&model.Client{})
	if clientType != "" {
		query = query.Where("client_type = ?", clientType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("User").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&clients).Error; err != nil {
		return nil, 0, err
	}

	return clients, total, nil
}

func (r *ClientRepo) ListPendingVerification(page, pageSize int) ([]model.Client, int64, error) {
	var clients []model.Client
	var total int64

	query := r.db.Model(&model.Client{}).Where("verification_status = ?", "pending")
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("User").Offset(offset).Limit(pageSize).Order("created_at ASC").Find(&clients).Error; err != nil {
		return nil, 0, err
	}

	return clients, total, nil
}

func (r *ClientRepo) ListEnterpriseClients(page, pageSize int) ([]model.Client, int64, error) {
	var clients []model.Client
	var total int64

	query := r.db.Model(&model.Client{}).Where("client_type = ?", "enterprise")
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("User").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&clients).Error; err != nil {
		return nil, 0, err
	}

	return clients, total, nil
}

// ==================== 征信相关 ====================

func (r *ClientRepo) CreateCreditCheck(check *model.ClientCreditCheck) error {
	return r.db.Create(check).Error
}

func (r *ClientRepo) GetCreditChecksByClientID(clientID int64, limit int) ([]model.ClientCreditCheck, error) {
	var checks []model.ClientCreditCheck
	query := r.db.Where("client_id = ?", clientID).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Find(&checks).Error
	return checks, err
}

func (r *ClientRepo) GetLatestCreditCheck(clientID int64) (*model.ClientCreditCheck, error) {
	var check model.ClientCreditCheck
	err := r.db.Where("client_id = ? AND status = ?", clientID, "success").Order("created_at DESC").First(&check).Error
	if err != nil {
		return nil, err
	}
	return &check, nil
}

func (r *ClientRepo) UpdateCreditCheckStatus(checkID int64, status string, errorMsg string) error {
	updates := map[string]interface{}{
		"status": status,
	}
	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}
	return r.db.Model(&model.ClientCreditCheck{}).Where("id = ?", checkID).Updates(updates).Error
}

// ==================== 企业资质相关 ====================

func (r *ClientRepo) CreateEnterpriseCert(cert *model.ClientEnterpriseCert) error {
	return r.db.Create(cert).Error
}

func (r *ClientRepo) GetEnterpriseCertByID(id int64) (*model.ClientEnterpriseCert, error) {
	var cert model.ClientEnterpriseCert
	err := r.db.First(&cert, id).Error
	if err != nil {
		return nil, err
	}
	return &cert, nil
}

func (r *ClientRepo) GetEnterpriseCertsByClientID(clientID int64) ([]model.ClientEnterpriseCert, error) {
	var certs []model.ClientEnterpriseCert
	err := r.db.Where("client_id = ?", clientID).Order("created_at DESC").Find(&certs).Error
	return certs, err
}

func (r *ClientRepo) GetValidEnterpriseCerts(clientID int64) ([]model.ClientEnterpriseCert, error) {
	var certs []model.ClientEnterpriseCert
	err := r.db.Where("client_id = ? AND status = ? AND (expire_date IS NULL OR expire_date > ?)", 
		clientID, "approved", time.Now()).Find(&certs).Error
	return certs, err
}

func (r *ClientRepo) UpdateEnterpriseCertStatus(certID int64, status, reviewNote string, reviewedBy int64) error {
	now := time.Now()
	return r.db.Model(&model.ClientEnterpriseCert{}).Where("id = ?", certID).Updates(map[string]interface{}{
		"status":      status,
		"review_note": reviewNote,
		"reviewed_at": &now,
		"reviewed_by": reviewedBy,
	}).Error
}

func (r *ClientRepo) CheckHazmatPermit(clientID int64) (bool, error) {
	var count int64
	err := r.db.Model(&model.ClientEnterpriseCert{}).Where(
		"client_id = ? AND cert_type = ? AND status = ? AND (expire_date IS NULL OR expire_date > ?)",
		clientID, "hazmat_permit", "approved", time.Now(),
	).Count(&count).Error
	return count > 0, err
}

// ==================== 货物申报相关 ====================

func (r *ClientRepo) CreateCargoDeclaration(decl *model.CargoDeclaration) error {
	return r.db.Create(decl).Error
}

func (r *ClientRepo) GetCargoDeclarationByID(id int64) (*model.CargoDeclaration, error) {
	var decl model.CargoDeclaration
	err := r.db.Preload("Client").Preload("Order").First(&decl, id).Error
	if err != nil {
		return nil, err
	}
	return &decl, nil
}

func (r *ClientRepo) GetCargoDeclarationByNo(declarationNo string) (*model.CargoDeclaration, error) {
	var decl model.CargoDeclaration
	err := r.db.Where("declaration_no = ?", declarationNo).First(&decl).Error
	if err != nil {
		return nil, err
	}
	return &decl, nil
}

func (r *ClientRepo) GetCargoDeclarationsByClientID(clientID int64, page, pageSize int) ([]model.CargoDeclaration, int64, error) {
	var declarations []model.CargoDeclaration
	var total int64

	query := r.db.Model(&model.CargoDeclaration{}).Where("client_id = ?", clientID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&declarations).Error; err != nil {
		return nil, 0, err
	}

	return declarations, total, nil
}

func (r *ClientRepo) GetCargoDeclarationByOrderID(orderID int64) (*model.CargoDeclaration, error) {
	var decl model.CargoDeclaration
	err := r.db.Where("order_id = ?", orderID).First(&decl).Error
	if err != nil {
		return nil, err
	}
	return &decl, nil
}

func (r *ClientRepo) UpdateCargoDeclaration(decl *model.CargoDeclaration) error {
	return r.db.Save(decl).Error
}

func (r *ClientRepo) UpdateCargoDeclarationCompliance(declID int64, status, note string, checkedBy int64) error {
	now := time.Now()
	return r.db.Model(&model.CargoDeclaration{}).Where("id = ?", declID).Updates(map[string]interface{}{
		"compliance_status":     status,
		"compliance_note":       note,
		"compliance_checked_at": &now,
		"compliance_checked_by": checkedBy,
	}).Error
}

func (r *ClientRepo) ListPendingCargoDeclarations(page, pageSize int) ([]model.CargoDeclaration, int64, error) {
	var declarations []model.CargoDeclaration
	var total int64

	query := r.db.Model(&model.CargoDeclaration{}).Where("compliance_status = ?", "pending")
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Client").Offset(offset).Limit(pageSize).Order("created_at ASC").Find(&declarations).Error; err != nil {
		return nil, 0, err
	}

	return declarations, total, nil
}

func (r *ClientRepo) ListHazardousCargoDeclarations(page, pageSize int) ([]model.CargoDeclaration, int64, error) {
	var declarations []model.CargoDeclaration
	var total int64

	query := r.db.Model(&model.CargoDeclaration{}).Where("is_hazardous = ?", true)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("Client").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&declarations).Error; err != nil {
		return nil, 0, err
	}

	return declarations, total, nil
}

// ==================== 统计更新 ====================

func (r *ClientRepo) IncrementOrderStats(clientID int64, totalAmount int64, completed bool) error {
	updates := map[string]interface{}{
		"total_orders":   gorm.Expr("total_orders + 1"),
		"total_spending": gorm.Expr("total_spending + ?", totalAmount),
	}
	if completed {
		updates["completed_orders"] = gorm.Expr("completed_orders + 1")
	}
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Updates(updates).Error
}

func (r *ClientRepo) IncrementCancelledOrders(clientID int64) error {
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).
		Update("cancelled_orders", gorm.Expr("cancelled_orders + 1")).Error
}

func (r *ClientRepo) UpdateAverageRating(clientID int64, rating float64) error {
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Update("average_rating", rating).Error
}

func (r *ClientRepo) UpdatePlatformCreditScore(clientID int64, score int) error {
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Update("platform_credit_score", score).Error
}

// ==================== 验证相关 ====================

func (r *ClientRepo) ApproveVerification(clientID int64, note string) error {
	now := time.Now()
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Updates(map[string]interface{}{
		"verification_status": "verified",
		"verification_note":   note,
		"verified_at":         &now,
	}).Error
}

func (r *ClientRepo) RejectVerification(clientID int64, note string) error {
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Updates(map[string]interface{}{
		"verification_status": "rejected",
		"verification_note":   note,
	}).Error
}

func (r *ClientRepo) ApproveEnterpriseVerification(clientID int64, note string) error {
	now := time.Now()
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Updates(map[string]interface{}{
		"enterprise_verified":    "verified",
		"enterprise_verified_at": &now,
		"enterprise_verify_note": note,
	}).Error
}

func (r *ClientRepo) RejectEnterpriseVerification(clientID int64, note string) error {
	return r.db.Model(&model.Client{}).Where("id = ?", clientID).Updates(map[string]interface{}{
		"enterprise_verified":    "rejected",
		"enterprise_verify_note": note,
	}).Error
}

// ==================== 按企业信息查询 ====================

func (r *ClientRepo) GetByBusinessLicenseNo(licenseNo string) (*model.Client, error) {
	var client model.Client
	err := r.db.Where("business_license_no = ?", licenseNo).First(&client).Error
	if err != nil {
		return nil, err
	}
	return &client, nil
}

func (r *ClientRepo) SearchByCompanyName(keyword string, page, pageSize int) ([]model.Client, int64, error) {
	var clients []model.Client
	var total int64

	query := r.db.Model(&model.Client{}).Where("client_type = ? AND company_name LIKE ?", "enterprise", "%"+keyword+"%")
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Preload("User").Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&clients).Error; err != nil {
		return nil, 0, err
	}

	return clients, total, nil
}

// ==================== 生成申报单号 ====================

func (r *ClientRepo) GenerateDeclarationNo() string {
	return fmt.Sprintf("CD%s%06d", time.Now().Format("20060102"), time.Now().UnixNano()%1000000)
}
