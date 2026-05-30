-- ============================================================
-- H3.03 自动指派超时排除短期化
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_broadcast_exclusions
      ADD COLUMN expires_at DATETIME(3) NULL COMMENT ''排除过期时间，NULL 表示永久排除'' AFTER created_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_broadcast_exclusions'
    AND column_name = 'expires_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_broadcast_exclusions
      ADD KEY idx_broadcast_exclusions_expires_at (expires_at)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'order_broadcast_exclusions'
    AND index_name = 'idx_broadcast_exclusions_expires_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
