-- 127_wallet_refund_traceability.sql
-- 退款/资金回滚追溯字段：让反向流水能够指向原始收入流水，退款记录能够保留追溯锚点。

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE wallet_transactions ADD COLUMN related_transaction_id BIGINT NOT NULL DEFAULT 0 COMMENT ''关联原流水ID，用于退款/冲正追溯'' AFTER related_settlement_id',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wallet_transactions'
    AND column_name = 'related_transaction_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE wallet_transactions ADD INDEX idx_tx_related_transaction (related_transaction_id)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wallet_transactions'
    AND index_name = 'idx_tx_related_transaction'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE refunds ADD COLUMN related_transaction_id BIGINT NOT NULL DEFAULT 0 COMMENT ''关联原流水ID，用于退款/冲正追溯'' AFTER payment_id',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'refunds'
    AND column_name = 'related_transaction_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE refunds ADD INDEX idx_refunds_related_transaction (related_transaction_id)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'refunds'
    AND index_name = 'idx_refunds_related_transaction'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
