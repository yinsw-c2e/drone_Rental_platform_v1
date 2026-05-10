SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilots' AND COLUMN_NAME = 'service_base_address') = 0,
  'ALTER TABLE pilots ADD COLUMN service_base_address VARCHAR(255) DEFAULT '''' COMMENT ''服务基准地址'' AFTER current_city',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilots' AND COLUMN_NAME = 'service_base_latitude') = 0,
  'ALTER TABLE pilots ADD COLUMN service_base_latitude DECIMAL(10,7) DEFAULT 0 COMMENT ''服务基准纬度'' AFTER service_base_address',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilots' AND COLUMN_NAME = 'service_base_longitude') = 0,
  'ALTER TABLE pilots ADD COLUMN service_base_longitude DECIMAL(10,7) DEFAULT 0 COMMENT ''服务基准经度'' AFTER service_base_latitude',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilots' AND INDEX_NAME = 'idx_pilots_service_base_latitude') = 0,
  'ALTER TABLE pilots ADD INDEX idx_pilots_service_base_latitude (service_base_latitude)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilots' AND INDEX_NAME = 'idx_pilots_service_base_longitude') = 0,
  'ALTER TABLE pilots ADD INDEX idx_pilots_service_base_longitude (service_base_longitude)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilot_profiles' AND COLUMN_NAME = 'service_base_address') = 0,
  'ALTER TABLE pilot_profiles ADD COLUMN service_base_address VARCHAR(255) DEFAULT '''' COMMENT ''服务基准地址'' AFTER service_radius_km',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilot_profiles' AND COLUMN_NAME = 'service_base_latitude') = 0,
  'ALTER TABLE pilot_profiles ADD COLUMN service_base_latitude DECIMAL(10,7) DEFAULT 0 COMMENT ''服务基准纬度'' AFTER service_base_address',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilot_profiles' AND COLUMN_NAME = 'service_base_longitude') = 0,
  'ALTER TABLE pilot_profiles ADD COLUMN service_base_longitude DECIMAL(10,7) DEFAULT 0 COMMENT ''服务基准经度'' AFTER service_base_latitude',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilot_profiles' AND INDEX_NAME = 'idx_pilot_profiles_service_base_latitude') = 0,
  'ALTER TABLE pilot_profiles ADD INDEX idx_pilot_profiles_service_base_latitude (service_base_latitude)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pilot_profiles' AND INDEX_NAME = 'idx_pilot_profiles_service_base_longitude') = 0,
  'ALTER TABLE pilot_profiles ADD INDEX idx_pilot_profiles_service_base_longitude (service_base_longitude)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE pilots
SET
  service_base_address = COALESCE(NULLIF(current_city, ''), service_base_address),
  service_base_latitude = COALESCE(NULLIF(current_latitude, 0), service_base_latitude),
  service_base_longitude = COALESCE(NULLIF(current_longitude, 0), service_base_longitude)
WHERE service_base_latitude = 0
  AND service_base_longitude = 0
  AND current_latitude <> 0
  AND current_longitude <> 0;

UPDATE pilot_profiles pp
JOIN pilots p ON p.user_id = pp.user_id
SET
  pp.service_base_address = COALESCE(NULLIF(p.service_base_address, ''), pp.service_base_address),
  pp.service_base_latitude = p.service_base_latitude,
  pp.service_base_longitude = p.service_base_longitude
WHERE pp.service_base_latitude = 0
  AND pp.service_base_longitude = 0
  AND p.service_base_latitude <> 0
  AND p.service_base_longitude <> 0;
