-- 105_create_order_artifacts.sql
-- R1.05: 创建 order_snapshots / refunds / dispute_records，并补齐 orders.paid_at / completed_at
-- 创建日期: 2026-03-13

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL COMMENT '支付时间' AFTER provider_reject_reason,
    ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL COMMENT '完成时间' AFTER paid_at;

CREATE TABLE IF NOT EXISTS order_snapshots (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    snapshot_type VARCHAR(30) NOT NULL COMMENT 'client, demand, supply, pricing, execution',
    snapshot_data JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_order_snapshot_type (order_id, snapshot_type),
    KEY idx_order_snapshots_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单快照表';

CREATE TABLE IF NOT EXISTS refunds (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    refund_no VARCHAR(50) NOT NULL,
    order_id BIGINT NOT NULL,
    payment_id BIGINT NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    reason TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, processing, success, failed',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_refund_no (refund_no),
    UNIQUE KEY uk_refunds_payment_id (payment_id),
    KEY idx_refunds_order_id (order_id),
    KEY idx_refunds_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单退款记录表';

CREATE TABLE IF NOT EXISTS dispute_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    initiator_user_id BIGINT NOT NULL,
    dispute_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open, processing, resolved, closed',
    summary TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    KEY idx_dispute_records_order_id (order_id),
    KEY idx_dispute_records_initiator_user_id (initiator_user_id),
    KEY idx_dispute_records_status (status),
    KEY idx_dispute_records_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单争议记录表';

UPDATE orders o
LEFT JOIN (
    SELECT
        p.order_id,
        MIN(COALESCE(p.paid_at, p.updated_at, p.created_at)) AS paid_at
    FROM payments p
    WHERE p.status IN ('paid', 'refunded')
    GROUP BY p.order_id
) pp ON pp.order_id = o.id
LEFT JOIN (
    SELECT
        ot.order_id,
        MIN(ot.created_at) AS completed_at
    FROM order_timelines ot
    WHERE ot.status = 'completed'
    GROUP BY ot.order_id
) tt ON tt.order_id = o.id
SET
    o.paid_at = COALESCE(o.paid_at, pp.paid_at),
    o.completed_at = COALESCE(
        o.completed_at,
        tt.completed_at,
        CASE
            WHEN o.status IN ('completed', 'refunded') THEN o.updated_at
            ELSE NULL
        END
    )
WHERE o.paid_at IS NULL OR o.completed_at IS NULL;

INSERT INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
SELECT
    o.id,
    'client',
    JSON_OBJECT(
        'renter_id', o.renter_id,
        'client_id', o.client_id,
        'client_user_id', o.client_user_id,
        'order_source', o.order_source,
        'provider_user_id', o.provider_user_id
    ),
    o.created_at,
    o.updated_at
FROM orders o
ON DUPLICATE KEY UPDATE
    snapshot_data = VALUES(snapshot_data),
    updated_at = VALUES(updated_at);

INSERT INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
SELECT
    o.id,
    'pricing',
    JSON_OBJECT(
        'total_amount', o.total_amount,
        'deposit_amount', o.deposit_amount,
        'platform_commission_rate', o.platform_commission_rate,
        'platform_commission', o.platform_commission,
        'owner_amount', o.owner_amount,
        'service_type', o.service_type
    ),
    o.created_at,
    o.updated_at
FROM orders o
ON DUPLICATE KEY UPDATE
    snapshot_data = VALUES(snapshot_data),
    updated_at = VALUES(updated_at);

INSERT INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
SELECT
    o.id,
    'execution',
    JSON_OBJECT(
        'status', o.status,
        'provider_user_id', o.provider_user_id,
        'drone_owner_user_id', o.drone_owner_user_id,
        'executor_pilot_user_id', o.executor_pilot_user_id,
        'dispatch_task_id', o.dispatch_task_id,
        'needs_dispatch', o.needs_dispatch,
        'execution_mode', o.execution_mode,
        'provider_confirmed_at', o.provider_confirmed_at,
        'provider_rejected_at', o.provider_rejected_at,
        'paid_at', o.paid_at,
        'completed_at', o.completed_at,
        'cancel_reason', o.cancel_reason,
        'cancel_by', o.cancel_by
    ),
    o.created_at,
    o.updated_at
FROM orders o
ON DUPLICATE KEY UPDATE
    snapshot_data = VALUES(snapshot_data),
    updated_at = VALUES(updated_at);

INSERT INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
SELECT
    o.id,
    'demand',
    JSON_OBJECT(
        'demand_id', d.id,
        'demand_no', d.demand_no,
        'title', d.title,
        'service_type', d.service_type,
        'cargo_scene', d.cargo_scene,
        'description', d.description,
        'departure_address_snapshot', COALESCE(d.departure_address_snapshot, JSON_OBJECT()),
        'destination_address_snapshot', COALESCE(d.destination_address_snapshot, JSON_OBJECT()),
        'service_address_snapshot', COALESCE(d.service_address_snapshot, JSON_OBJECT()),
        'cargo_weight_kg', d.cargo_weight_kg,
        'cargo_volume_m3', d.cargo_volume_m3,
        'cargo_type', d.cargo_type,
        'cargo_special_requirements', d.cargo_special_requirements,
        'estimated_trip_count', d.estimated_trip_count,
        'budget_min', d.budget_min,
        'budget_max', d.budget_max
    ),
    o.created_at,
    o.updated_at
FROM orders o
JOIN demands d ON d.id = o.demand_id
WHERE o.demand_id > 0
ON DUPLICATE KEY UPDATE
    snapshot_data = VALUES(snapshot_data),
    updated_at = VALUES(updated_at);

INSERT INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
SELECT
    o.id,
    'supply',
    JSON_OBJECT(
        'supply_id', s.id,
        'supply_no', s.supply_no,
        'owner_user_id', s.owner_user_id,
        'drone_id', s.drone_id,
        'title', s.title,
        'description', s.description,
        'service_types', COALESCE(s.service_types, JSON_ARRAY()),
        'cargo_scenes', COALESCE(s.cargo_scenes, JSON_ARRAY()),
        'service_area_snapshot', COALESCE(s.service_area_snapshot, JSON_OBJECT()),
        'mtow_kg', s.mtow_kg,
        'max_payload_kg', s.max_payload_kg,
        'max_range_km', s.max_range_km,
        'base_price_amount', s.base_price_amount,
        'pricing_unit', s.pricing_unit,
        'pricing_rule', COALESCE(s.pricing_rule, JSON_OBJECT()),
        'accepts_direct_order', s.accepts_direct_order,
        'status', s.status
    ),
    o.created_at,
    o.updated_at
FROM orders o
JOIN owner_supplies s ON s.id = o.source_supply_id
WHERE o.source_supply_id > 0
ON DUPLICATE KEY UPDATE
    snapshot_data = VALUES(snapshot_data),
    updated_at = VALUES(updated_at);

INSERT INTO refunds (refund_no, order_id, payment_id, amount, reason, status, created_at, updated_at)
SELECT
    CONCAT('RFLEGACY', LPAD(p.id, 10, '0')),
    p.order_id,
    p.id,
    p.amount,
    '历史退款记录回填',
    'success',
    COALESCE(p.updated_at, p.created_at),
    COALESCE(p.updated_at, p.created_at)
FROM payments p
LEFT JOIN refunds r ON r.payment_id = p.id
WHERE p.status = 'refunded'
  AND p.order_id > 0
  AND r.id IS NULL;

-- 说明：
-- 1. paid_at / completed_at 为订单级业务时间，优先从支付与时间线回填，无法识别时回退到订单更新时间
-- 2. 历史退款仅能从 payments.status = refunded 中识别，金额按 payment.amount 回填；若历史存在部分退款，留待 R1.08 审计清单核查
-- 3. dispute_records 当前无可靠历史来源，不做脏回填，后续由新流程正式写入
