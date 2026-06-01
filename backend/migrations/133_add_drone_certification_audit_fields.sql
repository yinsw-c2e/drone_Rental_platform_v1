-- 133_add_drone_certification_audit_fields.sql
-- 无人机平台资质审核留痕：记录审核人、审核时间、强制通过标记和原因
-- 使用 information_schema 做幂等判断，兼容不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 的 MySQL 版本。

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN certification_reviewed_at DATETIME NULL COMMENT ''平台资质审核时间'' AFTER certification_status',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'certification_reviewed_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN certification_reviewed_by BIGINT NOT NULL DEFAULT 0 COMMENT ''平台资质审核人用户ID'' AFTER certification_reviewed_at',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'certification_reviewed_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN certification_force_approved TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''平台资质是否强制通过'' AFTER certification_reviewed_by',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'certification_force_approved'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE drones ADD COLUMN certification_override_reason VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''平台资质强制通过原因'' AFTER certification_force_approved',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'drones'
    AND column_name = 'certification_override_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
