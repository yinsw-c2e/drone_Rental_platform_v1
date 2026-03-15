package service

import (
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
