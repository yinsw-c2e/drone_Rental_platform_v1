-- ============================================================
-- 财务异常记录：结算、提现、对账等高风险动作的可查询告警
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_anomaly_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    anomaly_no VARCHAR(50) NOT NULL,
    anomaly_type VARCHAR(50) NOT NULL COMMENT 'settlement_execute_failed/settlement_split_mismatch/withdrawal_approve_failed/withdrawal_reject_failed',
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' COMMENT 'info/warning/critical',
    status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open/resolved/ignored',
    source VARCHAR(30) NOT NULL COMMENT 'settlement/withdrawal/reconciliation/system',
    target_type VARCHAR(30) NOT NULL DEFAULT '',
    target_id BIGINT NOT NULL DEFAULT 0,
    order_id BIGINT NOT NULL DEFAULT 0,
    settlement_id BIGINT NOT NULL DEFAULT 0,
    withdrawal_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    message VARCHAR(255) NOT NULL DEFAULT '',
    detail JSON,
    resolved_by BIGINT NOT NULL DEFAULT 0,
    resolved_at DATETIME(3) NULL,
    resolution_note VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE KEY uk_finance_anomaly_no (anomaly_no),
    KEY idx_finance_anomaly_type (anomaly_type),
    KEY idx_finance_anomaly_status (status),
    KEY idx_finance_anomaly_severity (severity),
    KEY idx_finance_anomaly_source (source),
    KEY idx_finance_anomaly_target (target_type, target_id),
    KEY idx_finance_anomaly_order (order_id),
    KEY idx_finance_anomaly_settlement (settlement_id),
    KEY idx_finance_anomaly_withdrawal (withdrawal_id),
    KEY idx_finance_anomaly_user (user_id),
    KEY idx_finance_anomaly_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='财务异常记录';
