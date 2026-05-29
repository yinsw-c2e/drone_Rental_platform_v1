-- 127_wallet_refund_traceability.sql
-- 退款/资金回滚追溯字段：让反向流水能够指向原始收入流水，退款记录能够保留追溯锚点。

ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS related_transaction_id BIGINT NOT NULL DEFAULT 0 COMMENT '关联原流水ID，用于退款/冲正追溯' AFTER related_settlement_id,
    ADD INDEX IF NOT EXISTS idx_tx_related_transaction (related_transaction_id);

ALTER TABLE refunds
    ADD COLUMN IF NOT EXISTS related_transaction_id BIGINT NOT NULL DEFAULT 0 COMMENT '关联原流水ID，用于退款/冲正追溯' AFTER payment_id,
    ADD INDEX IF NOT EXISTS idx_refunds_related_transaction (related_transaction_id);
