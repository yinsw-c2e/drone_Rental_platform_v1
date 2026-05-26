-- ============================================================
-- H3.03 自动指派回退：服务商接受时窗与尝试记录
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE TABLE broadcast_assignments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      broadcast_id BIGINT NOT NULL,
      order_id BIGINT NOT NULL,
      provider_user_id BIGINT NOT NULL,
      attempt_seq INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT ''pending_accept'',
      distance_km DECIMAL(8,2) NULL,
      score DECIMAL(8,4) NULL,
      accept_deadline_at DATETIME(3) NOT NULL,
      responded_at DATETIME(3) NULL,
      decline_reason VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

      UNIQUE KEY uk_broadcast_assignments_attempt (broadcast_id, provider_user_id, attempt_seq),
      KEY idx_broadcast_assignments_broadcast_status (broadcast_id, status),
      KEY idx_broadcast_assignments_provider_status (provider_user_id, status),
      KEY idx_broadcast_assignments_status_deadline (status, accept_deadline_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''广播自动指派尝试记录''',
    'SELECT 1'
  )
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'broadcast_assignments'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
