-- ============================================================
-- H3.04 允许同一订单多轮重发广播
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE order_broadcasts DROP INDEX uk_order_broadcasts_order_id',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'order_broadcasts'
    AND index_name = 'uk_order_broadcasts_order_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_broadcasts ADD KEY idx_order_broadcasts_order_id (order_id)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'order_broadcasts'
    AND index_name = 'idx_order_broadcasts_order_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
