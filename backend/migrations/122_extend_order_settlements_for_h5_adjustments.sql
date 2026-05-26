-- ============================================================
-- H5 支付结算：订单结算调整、小费与加价字段
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN estimated_amount BIGINT NOT NULL DEFAULT 0 COMMENT ''初始预估金额快照(分)'' AFTER final_amount',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'estimated_amount'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN actual_distance_fee BIGINT NOT NULL DEFAULT 0 COMMENT ''实际里程差额(分)'' AFTER estimated_amount',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'actual_distance_fee'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN actual_duration_fee BIGINT NOT NULL DEFAULT 0 COMMENT ''实际时长差额(分)'' AFTER actual_distance_fee',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'actual_duration_fee'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN surcharge_amount BIGINT NOT NULL DEFAULT 0 COMMENT ''客户加价金额(分)'' AFTER actual_duration_fee',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'surcharge_amount'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN tip_amount BIGINT NOT NULL DEFAULT 0 COMMENT ''客户小费金额(分)，即时入账'' AFTER surcharge_amount',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'tip_amount'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN price_adjust_reason VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''调价原因'' AFTER tip_amount',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'price_adjust_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN adjust_reviewed TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''调价是否已人工复核'' AFTER price_adjust_reason',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'adjust_reviewed'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN adjust_reviewed_by BIGINT NOT NULL DEFAULT 0 COMMENT ''调价复核人'' AFTER adjust_reviewed',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'adjust_reviewed_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE order_settlements ADD COLUMN adjust_reviewed_at DATETIME(3) NULL COMMENT ''调价复核时间'' AFTER adjust_reviewed_by',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'order_settlements'
    AND column_name = 'adjust_reviewed_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE order_settlements
SET estimated_amount = total_amount
WHERE estimated_amount = 0 AND total_amount > 0;

INSERT INTO system_configs (config_key, config_value, description)
VALUES ('settlement.adjust_review_threshold_pct', '20', '结算调价超过订单预估金额百分比时进入人工复核')
ON DUPLICATE KEY UPDATE config_key = config_key;
