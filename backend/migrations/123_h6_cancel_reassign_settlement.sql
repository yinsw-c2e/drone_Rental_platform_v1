-- ============================================================
-- H6 取消、改派、责任链：取消阈值配置与改派部分结算字段
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN partial_handover_amount BIGINT NOT NULL DEFAULT 0 COMMENT ''改派前已履约部分结算金额(分)'' AFTER tip_amount',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'partial_handover_amount'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN partial_handover_provider_user_id BIGINT NOT NULL DEFAULT 0 COMMENT ''改派前原服务商用户ID'' AFTER partial_handover_amount',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'partial_handover_provider_user_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN partial_handover_settled_at DATETIME(3) NULL COMMENT ''改派部分结算入账时间'' AFTER partial_handover_provider_user_id',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'partial_handover_settled_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN partial_handover_reason VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''改派部分结算原因'' AFTER partial_handover_settled_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'partial_handover_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO system_configs (config_key, config_value, description)
VALUES
  ('cancel.grace_window_seconds', '300', '客户在服务商接单后的免费取消宽限期秒数'),
  ('cancel.client_penalty_rate', '0.10', '客户超出免费取消期后的预估价扣费比例')
ON DUPLICATE KEY UPDATE config_key = config_key;
