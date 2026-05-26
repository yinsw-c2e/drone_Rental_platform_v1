-- 115_add_drone_insurance_review_fields.sql
-- 无人机保险资料审核留痕：记录审核人、审核时间和驳回原因
-- 使用 information_schema 做幂等判断，兼容不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 的 MySQL 版本。

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN insurance_reviewed_at DATETIME NULL COMMENT ''保险审核时间'' AFTER insurance_verified',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'insurance_reviewed_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN insurance_reviewed_by BIGINT NOT NULL DEFAULT 0 COMMENT ''保险审核人用户ID'' AFTER insurance_reviewed_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'insurance_reviewed_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN insurance_reject_reason VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''保险驳回原因'' AFTER insurance_reviewed_by',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'insurance_reject_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD INDEX idx_drones_insurance_reviewed_by (insurance_reviewed_by)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND index_name = 'idx_drones_insurance_reviewed_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
