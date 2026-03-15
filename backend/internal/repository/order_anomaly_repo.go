package repository

import (
	"fmt"
	"strings"
	"time"

	"wurenji-backend/internal/model"
)

const orderAnomalyStalledHours = 2

func (r *OrderRepo) AdminListOrderAnomalies(page, pageSize int, filters map[string]interface{}) ([]model.OrderAnomaly, int64, error) {
	filteredSQL, args := r.buildOrderAnomalyFilteredSQL(filters)

	countSQL := fmt.Sprintf("SELECT COUNT(1) AS total FROM (%s) anomaly_rows", filteredSQL)
	var total int64
	if err := r.db.Raw(countSQL, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	listSQL := filteredSQL + " ORDER BY FIELD(severity, 'critical', 'warning', 'info'), updated_at DESC, order_id DESC LIMIT ? OFFSET ?"
	listArgs := append(append([]interface{}{}, args...), pageSize, (page-1)*pageSize)

	var items []model.OrderAnomaly
	if err := r.db.Raw(listSQL, listArgs...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *OrderRepo) AdminGetOrderAnomalySummary() (*model.OrderAnomalySummary, error) {
	filteredSQL, args := r.buildOrderAnomalyFilteredSQL(nil)
	summary := &model.OrderAnomalySummary{}

	countSQL := fmt.Sprintf("SELECT COUNT(1) AS total FROM (%s) anomaly_rows", filteredSQL)
	if err := r.db.Raw(countSQL, args...).Scan(&summary.Total).Error; err != nil {
		return nil, err
	}
	criticalSQL := fmt.Sprintf("SELECT COUNT(1) AS total FROM (%s) anomaly_rows WHERE severity = 'critical'", filteredSQL)
	if err := r.db.Raw(criticalSQL, args...).Scan(&summary.CriticalCount).Error; err != nil {
		return nil, err
	}
	warningSQL := fmt.Sprintf("SELECT COUNT(1) AS total FROM (%s) anomaly_rows WHERE severity = 'warning'", filteredSQL)
	if err := r.db.Raw(warningSQL, args...).Scan(&summary.WarningCount).Error; err != nil {
		return nil, err
	}

	type bucketRow struct {
		Key   string
		Count int64
	}
	var anomalyRows []bucketRow
	anomalySQL := fmt.Sprintf(`
		SELECT anomaly_type AS `+"`key`"+`, COUNT(1) AS count
		FROM (%s) anomaly_rows
		GROUP BY anomaly_type
		ORDER BY count DESC, anomaly_type ASC
	`, filteredSQL)
	if err := r.db.Raw(anomalySQL, args...).Scan(&anomalyRows).Error; err != nil {
		return nil, err
	}
	for _, item := range anomalyRows {
		summary.ByAnomalyType = append(summary.ByAnomalyType, model.CountBucket{Key: item.Key, Count: item.Count})
	}

	var statusRows []bucketRow
	statusSQL := fmt.Sprintf(`
		SELECT status AS `+"`key`"+`, COUNT(1) AS count
		FROM (%s) anomaly_rows
		GROUP BY status
		ORDER BY count DESC, status ASC
	`, filteredSQL)
	if err := r.db.Raw(statusSQL, args...).Scan(&statusRows).Error; err != nil {
		return nil, err
	}
	for _, item := range statusRows {
		summary.ByOrderStatus = append(summary.ByOrderStatus, model.CountBucket{Key: item.Key, Count: item.Count})
	}

	return summary, nil
}

func (r *OrderRepo) buildOrderAnomalyFilteredSQL(filters map[string]interface{}) (string, []interface{}) {
	baseSQL, args := r.orderAnomalyBaseSQL()
	filteredSQL := "SELECT * FROM (" + baseSQL + ") anomaly_rows WHERE 1 = 1"
	filteredArgs := append([]interface{}{}, args...)

	if filters == nil {
		return filteredSQL, filteredArgs
	}
	if anomalyType, ok := filters["anomaly_type"].(string); ok && anomalyType != "" {
		filteredSQL += " AND anomaly_type = ?"
		filteredArgs = append(filteredArgs, anomalyType)
	}
	if severity, ok := filters["severity"].(string); ok && severity != "" {
		filteredSQL += " AND severity = ?"
		filteredArgs = append(filteredArgs, severity)
	}
	if status, ok := filters["status"].(string); ok && status != "" {
		filteredSQL += " AND status = ?"
		filteredArgs = append(filteredArgs, status)
	}
	if keyword, ok := filters["keyword"].(string); ok && strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		filteredSQL += `
			AND (
				order_no LIKE ? OR
				title LIKE ? OR
				provider_nickname LIKE ? OR
				client_nickname LIKE ? OR
				message LIKE ?
			)
		`
		filteredArgs = append(filteredArgs, like, like, like, like, like)
	}

	return filteredSQL, filteredArgs
}

func (r *OrderRepo) orderAnomalyBaseSQL() (string, []interface{}) {
	stalledBefore := time.Now().Add(-orderAnomalyStalledHours * time.Hour)
	baseSQL := `
		SELECT
			o.id AS order_id,
			o.order_no,
			o.title,
			o.status,
			o.order_source,
			o.execution_mode,
			o.needs_dispatch,
			o.dispatch_task_id,
			o.provider_user_id,
			o.client_user_id,
			COALESCE(provider.nickname, '') AS provider_nickname,
			COALESCE(client.nickname, '') AS client_nickname,
			'missing_source_supply' AS anomaly_type,
			'warning' AS severity,
			'直达订单缺少 source_supply_id，来源追溯不完整' AS message,
			o.created_at,
			o.updated_at,
			o.completed_at
		FROM orders o
		LEFT JOIN users provider ON provider.id = o.provider_user_id AND provider.deleted_at IS NULL
		LEFT JOIN users client ON client.id = o.client_user_id AND client.deleted_at IS NULL
		WHERE o.deleted_at IS NULL
		  AND o.order_source = 'supply_direct'
		  AND COALESCE(o.source_supply_id, 0) = 0

		UNION ALL

		SELECT
			o.id AS order_id,
			o.order_no,
			o.title,
			o.status,
			o.order_source,
			o.execution_mode,
			o.needs_dispatch,
			o.dispatch_task_id,
			o.provider_user_id,
			o.client_user_id,
			COALESCE(provider.nickname, '') AS provider_nickname,
			COALESCE(client.nickname, '') AS client_nickname,
			'missing_demand_source' AS anomaly_type,
			'warning' AS severity,
			'需求转单订单缺少 demand_id，来源追溯不完整' AS message,
			o.created_at,
			o.updated_at,
			o.completed_at
		FROM orders o
		LEFT JOIN users provider ON provider.id = o.provider_user_id AND provider.deleted_at IS NULL
		LEFT JOIN users client ON client.id = o.client_user_id AND client.deleted_at IS NULL
		WHERE o.deleted_at IS NULL
		  AND o.order_source = 'demand_market'
		  AND COALESCE(o.demand_id, 0) = 0

		UNION ALL

		SELECT
			o.id AS order_id,
			o.order_no,
			o.title,
			o.status,
			o.order_source,
			o.execution_mode,
			o.needs_dispatch,
			o.dispatch_task_id,
			o.provider_user_id,
			o.client_user_id,
			COALESCE(provider.nickname, '') AS provider_nickname,
			COALESCE(client.nickname, '') AS client_nickname,
			'stalled_pending_dispatch' AS anomaly_type,
			'critical' AS severity,
			'订单长时间停留在待派单状态，需要运营人工介入' AS message,
			o.created_at,
			o.updated_at,
			o.completed_at
		FROM orders o
		LEFT JOIN users provider ON provider.id = o.provider_user_id AND provider.deleted_at IS NULL
		LEFT JOIN users client ON client.id = o.client_user_id AND client.deleted_at IS NULL
		WHERE o.deleted_at IS NULL
		  AND o.status = 'pending_dispatch'
		  AND o.needs_dispatch = 1
		  AND o.updated_at < ?

		UNION ALL

		SELECT
			o.id AS order_id,
			o.order_no,
			o.title,
			o.status,
			o.order_source,
			o.execution_mode,
			o.needs_dispatch,
			o.dispatch_task_id,
			o.provider_user_id,
			o.client_user_id,
			COALESCE(provider.nickname, '') AS provider_nickname,
			COALESCE(client.nickname, '') AS client_nickname,
			'completed_missing_timestamp' AS anomaly_type,
			'warning' AS severity,
			'订单状态已完成，但 completed_at 为空' AS message,
			o.created_at,
			o.updated_at,
			o.completed_at
		FROM orders o
		LEFT JOIN users provider ON provider.id = o.provider_user_id AND provider.deleted_at IS NULL
		LEFT JOIN users client ON client.id = o.client_user_id AND client.deleted_at IS NULL
		WHERE o.deleted_at IS NULL
		  AND o.status = 'completed'
		  AND o.completed_at IS NULL

		UNION ALL

		SELECT
			o.id AS order_id,
			o.order_no,
			o.title,
			o.status,
			o.order_source,
			o.execution_mode,
			o.needs_dispatch,
			o.dispatch_task_id,
			o.provider_user_id,
			o.client_user_id,
			COALESCE(provider.nickname, '') AS provider_nickname,
			COALESCE(client.nickname, '') AS client_nickname,
			'provider_rejected_missing_reason' AS anomaly_type,
			'warning' AS severity,
			'机主拒单后未记录拒绝原因' AS message,
			o.created_at,
			o.updated_at,
			o.completed_at
		FROM orders o
		LEFT JOIN users provider ON provider.id = o.provider_user_id AND provider.deleted_at IS NULL
		LEFT JOIN users client ON client.id = o.client_user_id AND client.deleted_at IS NULL
		WHERE o.deleted_at IS NULL
		  AND o.status = 'provider_rejected'
		  AND COALESCE(NULLIF(TRIM(o.provider_reject_reason), ''), '') = ''

		UNION ALL

		SELECT
			o.id AS order_id,
			o.order_no,
			o.title,
			o.status,
			o.order_source,
			o.execution_mode,
			o.needs_dispatch,
			o.dispatch_task_id,
			o.provider_user_id,
			o.client_user_id,
			COALESCE(provider.nickname, '') AS provider_nickname,
			COALESCE(client.nickname, '') AS client_nickname,
			'execution_without_dispatch_task' AS anomaly_type,
			'critical' AS severity,
			'订单需要派单且已进入执行链路，但没有正式派单记录' AS message,
			o.created_at,
			o.updated_at,
			o.completed_at
		FROM orders o
		LEFT JOIN users provider ON provider.id = o.provider_user_id AND provider.deleted_at IS NULL
		LEFT JOIN users client ON client.id = o.client_user_id AND client.deleted_at IS NULL
		WHERE o.deleted_at IS NULL
		  AND o.needs_dispatch = 1
		  AND o.status IN ('assigned', 'preparing', 'in_progress', 'delivered', 'completed')
		  AND COALESCE(o.dispatch_task_id, 0) = 0
	`

	return baseSQL, []interface{}{stalledBefore}
}
