-- ============================================================
-- H11.01 修复即时/预约单创建时 drone_id/pilot_id/owner_id = 0 触发外键的 P0 bug
-- 策略：列改为 NULL，外键保留（NULL 不触发 FK 约束）
-- ============================================================

SET @sql = COALESCE((
  SELECT IF(IS_NULLABLE = 'YES', 'SELECT 1',
    'ALTER TABLE orders MODIFY COLUMN drone_id BIGINT NULL DEFAULT NULL COMMENT ''无人机ID，平台定价订单创建时为空，抢单后填''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'drone_id'
), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = COALESCE((
  SELECT IF(IS_NULLABLE = 'YES', 'SELECT 1',
    'ALTER TABLE orders MODIFY COLUMN pilot_id BIGINT NULL DEFAULT NULL COMMENT ''飞手ID，平台定价订单创建时为空''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'pilot_id'
), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = COALESCE((
  SELECT IF(IS_NULLABLE = 'YES', 'SELECT 1',
    'ALTER TABLE orders MODIFY COLUMN owner_id BIGINT NULL DEFAULT NULL COMMENT ''机主ID，平台定价订单创建时为空''')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'owner_id'
), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 历史数据已经有非零值的不动；既有 0 值保留为 0，避免破坏已闭环订单的历史语义。
