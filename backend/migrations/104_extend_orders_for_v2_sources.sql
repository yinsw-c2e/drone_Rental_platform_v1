-- 104_extend_orders_for_v2_sources.sql
-- R1.04: 扩展 orders 主表，补齐来源追溯、执行归属、确认状态字段
-- 创建日期: 2026-03-13

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR(30) DEFAULT 'demand_market' COMMENT '订单来源: demand_market, supply_direct' AFTER related_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS demand_id BIGINT DEFAULT 0 COMMENT '来源需求ID' AFTER order_source;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_supply_id BIGINT DEFAULT 0 COMMENT '来源供给ID' AFTER demand_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id BIGINT DEFAULT 0 COMMENT '客户档案ID(兼容字段)' AFTER renter_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_user_id BIGINT DEFAULT 0 COMMENT '客户账号ID' AFTER client_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_user_id BIGINT DEFAULT 0 COMMENT '承接机主账号ID' AFTER client_user_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS drone_owner_user_id BIGINT DEFAULT 0 COMMENT '无人机所属机主账号ID' AFTER provider_user_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS executor_pilot_user_id BIGINT DEFAULT 0 COMMENT '实际执行飞手账号ID' AFTER drone_owner_user_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS needs_dispatch TINYINT(1) DEFAULT 0 COMMENT '是否需要派单' AFTER dispatch_task_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(30) DEFAULT 'self_execute' COMMENT '执行模式: self_execute, bound_pilot, dispatch_pool' AFTER needs_dispatch;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_confirmed_at DATETIME NULL COMMENT '机主确认时间' AFTER status;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_rejected_at DATETIME NULL COMMENT '机主拒绝时间' AFTER provider_confirmed_at;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_reject_reason TEXT COMMENT '机主拒绝原因' AFTER provider_rejected_at;

ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_order_source (order_source);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_demand_id (demand_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_source_supply_id (source_supply_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_client_user_id (client_user_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_provider_user_id (provider_user_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_drone_owner_user_id (drone_owner_user_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_executor_pilot_user_id (executor_pilot_user_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_needs_dispatch (needs_dispatch);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_execution_mode (execution_mode);

UPDATE orders o
LEFT JOIN clients c ON c.user_id = o.renter_id
LEFT JOIN pilots p ON p.id = o.pilot_id
LEFT JOIN owner_pilot_bindings opb
    ON opb.owner_user_id = o.owner_id
   AND opb.pilot_user_id = p.user_id
   AND opb.status = 'active'
LEFT JOIN dispatch_tasks dt
    ON dt.id = CASE
        WHEN o.order_type = 'dispatch' THEN o.related_id
        ELSE COALESCE(o.dispatch_task_id, 0)
    END
LEFT JOIN order_timelines tl_accept
    ON tl_accept.id = (
        SELECT ot.id
        FROM order_timelines ot
        WHERE ot.order_id = o.id
          AND ot.status IN ('accepted', 'confirmed')
        ORDER BY ot.created_at ASC, ot.id ASC
        LIMIT 1
    )
LEFT JOIN order_timelines tl_reject
    ON tl_reject.id = (
        SELECT ot.id
        FROM order_timelines ot
        WHERE ot.order_id = o.id
          AND ot.status = 'rejected'
        ORDER BY ot.created_at ASC, ot.id ASC
        LIMIT 1
    )
SET
    o.client_id = COALESCE(NULLIF(o.client_id, 0), NULLIF(c.id, 0), 0),
    o.client_user_id = COALESCE(NULLIF(c.user_id, 0), o.renter_id),
    o.provider_user_id = CASE
        WHEN o.owner_id > 0 THEN o.owner_id
        ELSE o.provider_user_id
    END,
    o.drone_owner_user_id = CASE
        WHEN o.owner_id > 0 THEN o.owner_id
        ELSE o.drone_owner_user_id
    END,
    o.executor_pilot_user_id = CASE
        WHEN p.user_id IS NOT NULL AND p.user_id > 0 THEN p.user_id
        WHEN o.pilot_id = 0
         AND o.owner_id > 0
         AND o.status IN ('accepted', 'confirmed', 'paid', 'in_progress', 'completed', 'cancelled', 'refunded')
        THEN o.owner_id
        ELSE o.executor_pilot_user_id
    END,
    o.order_source = CASE
        WHEN o.order_type IN ('cargo', 'dispatch') THEN 'demand_market'
        WHEN o.order_type = 'rental' AND o.related_id > 0 THEN 'demand_market'
        ELSE 'supply_direct'
    END,
    o.dispatch_task_id = CASE
        WHEN o.dispatch_task_id IS NOT NULL THEN o.dispatch_task_id
        WHEN o.order_type = 'dispatch' AND dt.id IS NOT NULL THEN dt.id
        ELSE o.dispatch_task_id
    END,
    o.demand_id = CASE
        WHEN o.order_type = 'cargo' AND o.related_id > 0 THEN COALESCE((
            SELECT d.id
            FROM demands d
            WHERE d.demand_no = CONCAT('DMCLEGACY', LPAD(o.related_id, 10, '0'))
            LIMIT 1
        ), o.demand_id)
        WHEN o.order_type = 'rental' AND o.related_id > 0 THEN COALESCE((
            SELECT d.id
            FROM demands d
            WHERE d.demand_no = CONCAT('DMRLEGACY', LPAD(o.related_id, 10, '0'))
            LIMIT 1
        ), o.demand_id)
        WHEN o.order_type = 'dispatch' AND COALESCE(dt.cargo_demand_id, 0) > 0 THEN COALESCE((
            SELECT d.id
            FROM demands d
            WHERE d.demand_no = CONCAT('DMCLEGACY', LPAD(dt.cargo_demand_id, 10, '0'))
            LIMIT 1
        ), o.demand_id)
        ELSE o.demand_id
    END,
    o.source_supply_id = CASE
        WHEN o.order_type = 'rental'
         AND o.related_id = 0
         AND o.drone_id > 0
         AND o.owner_id > 0
        THEN COALESCE((
            SELECT os.id
            FROM owner_supplies os
            WHERE os.drone_id = o.drone_id
              AND os.owner_user_id = o.owner_id
            ORDER BY
                CASE os.status
                    WHEN 'active' THEN 0
                    WHEN 'paused' THEN 1
                    WHEN 'draft' THEN 2
                    ELSE 3
                END,
                os.updated_at DESC,
                os.id DESC
            LIMIT 1
        ), o.source_supply_id)
        ELSE o.source_supply_id
    END,
    o.needs_dispatch = CASE
        WHEN o.order_type = 'dispatch' THEN 1
        WHEN p.user_id IS NOT NULL AND p.user_id > 0 AND p.user_id <> o.owner_id THEN 1
        ELSE 0
    END,
    o.execution_mode = CASE
        WHEN o.order_type = 'dispatch' THEN 'dispatch_pool'
        WHEN p.user_id IS NOT NULL AND p.user_id > 0 AND p.user_id <> o.owner_id AND opb.id IS NOT NULL THEN 'bound_pilot'
        WHEN p.user_id IS NOT NULL AND p.user_id > 0 AND p.user_id <> o.owner_id THEN 'dispatch_pool'
        ELSE 'self_execute'
    END,
    o.provider_confirmed_at = CASE
        WHEN o.status IN ('accepted', 'confirmed', 'paid', 'in_progress', 'completed', 'cancelled', 'refunded')
        THEN COALESCE(o.provider_confirmed_at, tl_accept.created_at, o.updated_at)
        ELSE o.provider_confirmed_at
    END,
    o.provider_rejected_at = CASE
        WHEN o.status = 'rejected'
        THEN COALESCE(o.provider_rejected_at, tl_reject.created_at, o.updated_at)
        ELSE o.provider_rejected_at
    END,
    o.provider_reject_reason = CASE
        WHEN o.status = 'rejected'
        THEN COALESCE(NULLIF(o.provider_reject_reason, ''), o.cancel_reason)
        ELSE o.provider_reject_reason
    END;

-- 说明：
-- 1. 历史 cargo / dispatch 订单统一视为 demand_market
-- 2. 历史 rental 且无 related_id 的订单，视为 supply_direct，并尽量通过 owner_supplies 回填 source_supply_id
-- 3. 若历史 direct rental 未找到对应 owner_supply，保留 source_supply_id = 0，待 R1.08 迁移审计阶段进一步补齐
