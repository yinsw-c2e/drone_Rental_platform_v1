-- ============================================================
-- 财务人工处理记录：保存前后快照，为未入账人工处理提供可审计回滚入口
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_manual_action_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action_no VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL COMMENT 'settlement_dispute_mark/settlement_dispute_resolve/finance_anomaly_resolve',
    status VARCHAR(20) NOT NULL DEFAULT 'applied' COMMENT 'applied/rolled_back/rollback_failed',
    target_type VARCHAR(30) NOT NULL DEFAULT '',
    target_id BIGINT NOT NULL DEFAULT 0,
    settlement_id BIGINT NOT NULL DEFAULT 0,
    withdrawal_id BIGINT NOT NULL DEFAULT 0,
    anomaly_id BIGINT NOT NULL DEFAULT 0,
    admin_id BIGINT NOT NULL DEFAULT 0,
    reason VARCHAR(255) NOT NULL DEFAULT '',
    before_snapshot JSON,
    after_snapshot JSON,
    rollback_snapshot JSON,
    rollback_by BIGINT NOT NULL DEFAULT 0,
    rollback_at DATETIME(3) NULL,
    rollback_note VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE KEY uk_finance_manual_action_no (action_no),
    KEY idx_finance_manual_action_type (action_type),
    KEY idx_finance_manual_action_status (status),
    KEY idx_finance_manual_action_target (target_type, target_id),
    KEY idx_finance_manual_action_settlement (settlement_id),
    KEY idx_finance_manual_action_withdrawal (withdrawal_id),
    KEY idx_finance_manual_action_anomaly (anomaly_id),
    KEY idx_finance_manual_action_admin (admin_id),
    KEY idx_finance_manual_action_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='财务人工处理记录';
