package service

import (
	"encoding/json"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type OperationsService struct {
	migrationRepo *repository.MigrationRepo
	orderRepo     *repository.OrderRepo
}

func NewOperationsService(migrationRepo *repository.MigrationRepo, orderRepo *repository.OrderRepo) *OperationsService {
	return &OperationsService{
		migrationRepo: migrationRepo,
		orderRepo:     orderRepo,
	}
}

func (s *OperationsService) AdminListMigrationAudits(page, pageSize int, filters map[string]interface{}) ([]model.MigrationAuditRecord, int64, error) {
	return s.migrationRepo.AdminListAuditRecords(page, pageSize, filters)
}

func (s *OperationsService) AdminGetMigrationAuditSummary() (*model.MigrationAuditSummary, error) {
	return s.migrationRepo.AdminGetAuditSummary()
}

func (s *OperationsService) AdminListOrderAnomalies(page, pageSize int, filters map[string]interface{}) ([]model.OrderAnomaly, int64, error) {
	return s.orderRepo.AdminListOrderAnomalies(page, pageSize, filters)
}

func (s *OperationsService) AdminGetOrderAnomalySummary() (*model.OrderAnomalySummary, error) {
	return s.orderRepo.AdminGetOrderAnomalySummary()
}

func (s *OperationsService) AdminListLogs(module, action string, page, pageSize int) ([]model.AdminLog, int64, error) {
	var logs []model.AdminLog
	var total int64
	query := s.migrationRepo.DB().Model(&model.AdminLog{})
	if module != "" {
		query = query.Where("module = ?", module)
	}
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&logs).Error
	return logs, total, err
}

func (s *OperationsService) CreateAdminLog(log *model.AdminLog) error {
	if log == nil {
		return nil
	}
	if len(log.Details) == 0 {
		encoded, _ := json.Marshal(map[string]string{})
		log.Details = model.JSON(encoded)
	}
	return s.migrationRepo.DB().Create(log).Error
}
