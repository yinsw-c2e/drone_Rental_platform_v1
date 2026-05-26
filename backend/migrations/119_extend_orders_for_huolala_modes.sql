-- ============================================================
-- H2 货拉拉式即时单/预约单：订单模式与平台计价快照
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN order_mode VARCHAR(20) NOT NULL DEFAULT ''negotiated'' COMMENT ''订单模式: negotiated, instant, reservation'' AFTER order_source',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'order_mode'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN service_class_code VARCHAR(50) NOT NULL DEFAULT '''' COMMENT ''平台计价机型档编码'' AFTER order_mode',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'service_class_code'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN estimated_distance_m INT NOT NULL DEFAULT 0 COMMENT ''预估运输距离，米'' AFTER dest_address',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'estimated_distance_m'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN estimated_duration_min INT NOT NULL DEFAULT 0 COMMENT ''预估履约时长，分钟'' AFTER estimated_distance_m',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'estimated_duration_min'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN price_breakdown_json JSON NULL COMMENT ''平台计价明细快照'' AFTER estimated_duration_min',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'price_breakdown_json'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN broadcast_pool_id BIGINT NULL COMMENT ''H3 抢单广播池ID'' AFTER price_breakdown_json',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'broadcast_pool_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN reserved_start_at DATETIME(3) NULL COMMENT ''预约单计划入池时间'' AFTER broadcast_pool_id',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'reserved_start_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN grabbed_at DATETIME(3) NULL COMMENT ''服务商抢单时间'' AFTER reserved_start_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'grabbed_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD COLUMN grabbed_by_user_id BIGINT NOT NULL DEFAULT 0 COMMENT ''抢单服务商用户ID'' AFTER grabbed_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'grabbed_by_user_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE orders
SET order_mode = 'negotiated'
WHERE order_mode IS NULL OR order_mode = '';

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_order_mode (order_mode)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_order_mode'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_service_class_code (service_class_code)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_service_class_code'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_broadcast_pool_id (broadcast_pool_id)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_broadcast_pool_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_reserved_start_at (reserved_start_at)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_reserved_start_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_grabbed_by_user_id (grabbed_by_user_id)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND index_name = 'idx_orders_grabbed_by_user_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
