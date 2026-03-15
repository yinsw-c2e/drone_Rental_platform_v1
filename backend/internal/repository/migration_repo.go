package repository

import (
	"strings"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type MigrationRepo struct {
	db *gorm.DB
}

func NewMigrationRepo(db *gorm.DB) *MigrationRepo {
	return &MigrationRepo{db: db}
}

func (r *MigrationRepo) DB() *gorm.DB {
	return r.db
}

func (r *MigrationRepo) AdminListAuditRecords(page, pageSize int, filters map[string]interface{}) ([]model.MigrationAuditRecord, int64, error) {
	var records []model.MigrationAuditRecord
	var total int64

	query := r.db.Model(&model.MigrationAuditRecord{})
	if severity, ok := filters["severity"].(string); ok && severity != "" {
		query = query.Where("severity = ?", severity)
	}
	if status, ok := filters["resolution_status"].(string); ok && status != "" {
		query = query.Where("resolution_status = ?", status)
	}
	if issueType, ok := filters["issue_type"].(string); ok && issueType != "" {
		query = query.Where("issue_type = ?", issueType)
	}
	if stage, ok := filters["audit_stage"].(string); ok && stage != "" {
		query = query.Where("audit_stage = ?", stage)
	}
	if keyword, ok := filters["keyword"].(string); ok && strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		query = query.Where(`
			legacy_table LIKE ? OR
			legacy_id LIKE ? OR
			related_table LIKE ? OR
			related_id LIKE ? OR
			issue_message LIKE ?
		`, like, like, like, like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("FIELD(severity, 'critical', 'warning', 'info'), updated_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&records).Error
	return records, total, err
}

func (r *MigrationRepo) AdminGetAuditSummary() (*model.MigrationAuditSummary, error) {
	summary := &model.MigrationAuditSummary{}

	if err := r.db.Model(&model.MigrationAuditRecord{}).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&model.MigrationAuditRecord{}).Where("resolution_status = ?", "open").Count(&summary.OpenCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&model.MigrationAuditRecord{}).Where("resolution_status = ?", "resolved").Count(&summary.ResolvedCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&model.MigrationAuditRecord{}).Where("resolution_status = ? AND severity = ?", "open", "critical").Count(&summary.CriticalCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&model.MigrationAuditRecord{}).Where("resolution_status = ? AND severity = ?", "open", "warning").Count(&summary.WarningCount).Error; err != nil {
		return nil, err
	}
	if err := r.db.Model(&model.MigrationAuditRecord{}).Where("resolution_status = ? AND severity = ?", "open", "info").Count(&summary.InfoCount).Error; err != nil {
		return nil, err
	}

	type bucketRow struct {
		Key   string
		Count int64
	}
	var issueRows []bucketRow
	if err := r.db.Model(&model.MigrationAuditRecord{}).
		Select("issue_type AS `key`, COUNT(*) AS count").
		Where("resolution_status = ?", "open").
		Group("issue_type").
		Order("count DESC, issue_type ASC").
		Limit(10).
		Scan(&issueRows).Error; err != nil {
		return nil, err
	}
	for _, item := range issueRows {
		summary.ByIssueType = append(summary.ByIssueType, model.CountBucket{Key: item.Key, Count: item.Count})
	}

	var stageRows []bucketRow
	if err := r.db.Model(&model.MigrationAuditRecord{}).
		Select("audit_stage AS `key`, COUNT(*) AS count").
		Where("resolution_status = ?", "open").
		Group("audit_stage").
		Order("count DESC, audit_stage ASC").
		Limit(10).
		Scan(&stageRows).Error; err != nil {
		return nil, err
	}
	for _, item := range stageRows {
		summary.ByStage = append(summary.ByStage, model.CountBucket{Key: item.Key, Count: item.Count})
	}

	return summary, nil
}
