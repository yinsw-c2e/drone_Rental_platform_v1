-- ============================================================
-- H P1：即时/预约单客户端幂等键
-- 策略：允许 NULL，非空 client_request_id 全局唯一，防止网络重试创建重复订单。
-- ============================================================

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN client_request_id VARCHAR(64) NULL DEFAULT NULL COMMENT ''客户端下单幂等键'' AFTER order_mode',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'client_request_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE UNIQUE INDEX idx_orders_client_request_id ON orders (client_request_id)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND INDEX_NAME = 'idx_orders_client_request_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
