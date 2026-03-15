-- 911_phase9_backfill_v2_data.sql
-- 阶段 9 / R9.02: 数据回填脚本（只处理 INSERT / UPDATE 回填，不做结构创建）
-- 生成方式：从 101-109 脚本中抽取 DML 语句
-- 说明：
-- 1. 运行前必须先执行 901_phase9_prepare_v2_schema.sql
-- 2. 结构不完整或来源不明的数据，统一进入 migration_audit_records
-- 3. 本脚本偏向开发测试环境和重构切流准备，执行前仍建议先做快照


-- ===== extracted from 101_create_role_profile_tables.sql =====

INSERT IGNORE INTO client_profiles (
    user_id,
    status,
    default_contact_name,
    default_contact_phone,
    preferred_city,
    remark
)
SELECT
    u.id,
    'active',
    COALESCE(NULLIF(u.nickname, ''), NULLIF(u.phone, ''), CONCAT('用户', u.id)),
    COALESCE(u.phone, ''),
    '',
    'backfilled_from_users'
FROM users u
LEFT JOIN client_profiles cp ON cp.user_id = u.id
WHERE cp.id IS NULL;

INSERT IGNORE INTO owner_profiles (
    user_id,
    verification_status,
    status,
    service_city,
    contact_phone,
    intro
)
SELECT
    grouped.user_id,
    'pending',
    'active',
    COALESCE(grouped.service_city, ''),
    COALESCE(u.phone, ''),
    'backfilled_from_legacy_assets'
FROM (
    SELECT
        base.user_id,
        MAX(base.service_city) AS service_city
    FROM (
        SELECT d.owner_id AS user_id, MAX(COALESCE(d.city, '')) AS service_city
        FROM drones d
        WHERE d.deleted_at IS NULL
        GROUP BY d.owner_id
        UNION ALL
        SELECT ro.owner_id AS user_id, MAX('') AS service_city
        FROM rental_offers ro
        WHERE ro.deleted_at IS NULL
        GROUP BY ro.owner_id
    ) base
    GROUP BY base.user_id
) grouped
INNER JOIN users u ON u.id = grouped.user_id
LEFT JOIN owner_profiles op ON op.user_id = grouped.user_id
WHERE op.id IS NULL;

INSERT IGNORE INTO pilot_profiles (
    user_id,
    verification_status,
    availability_status,
    service_radius_km,
    service_cities,
    skill_tags,
    caac_license_no,
    caac_license_expire_at
)
SELECT
    p.user_id,
    COALESCE(NULLIF(p.verification_status, ''), 'pending'),
    COALESCE(NULLIF(p.availability_status, ''), 'offline'),
    COALESCE(NULLIF(CAST(ROUND(p.service_radius) AS SIGNED), 0), 50),
    JSON_ARRAY(COALESCE(NULLIF(p.current_city, ''), '')),
    COALESCE(p.special_skills, JSON_ARRAY()),
    COALESCE(p.caac_license_no, ''),
    p.caac_license_expire_date
FROM pilots p
LEFT JOIN pilot_profiles pp ON pp.user_id = p.user_id
WHERE pp.id IS NULL
  AND p.deleted_at IS NULL;


-- ===== extracted from 102_create_supply_and_binding_tables.sql =====

INSERT IGNORE INTO owner_supplies (
    supply_no,
    owner_user_id,
    drone_id,
    title,
    description,
    service_types,
    cargo_scenes,
    service_area_snapshot,
    mtow_kg,
    max_payload_kg,
    max_range_km,
    base_price_amount,
    pricing_unit,
    pricing_rule,
    available_time_slots,
    accepts_direct_order,
    status,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    CONCAT('SPLEGACY', LPAD(ro.id, 10, '0')),
    ro.owner_id,
    ro.drone_id,
    ro.title,
    ro.description,
    JSON_ARRAY('heavy_cargo_lift_transport'),
    JSON_ARRAY(),
    JSON_OBJECT(
        'address', COALESCE(ro.address, ''),
        'latitude', COALESCE(ro.latitude, 0),
        'longitude', COALESCE(ro.longitude, 0),
        'service_radius_km', COALESCE(ro.service_radius, 0),
        'city', COALESCE(d.city, '')
    ),
    0,
    COALESCE(d.max_load, 0),
    COALESCE(d.max_distance, 0),
    COALESCE(ro.price, 0),
    CASE
        WHEN ro.price_type = 'hourly' THEN 'per_hour'
        WHEN ro.price_type IN ('daily', 'fixed') THEN 'per_trip'
        ELSE 'per_trip'
    END,
    JSON_OBJECT(
        'legacy_offer_id', ro.id,
        'legacy_service_type', COALESCE(ro.service_type, ''),
        'legacy_price_type', COALESCE(ro.price_type, '')
    ),
    CASE
        WHEN ro.available_from IS NOT NULL AND ro.available_to IS NOT NULL THEN
            JSON_ARRAY(JSON_OBJECT(
                'start_at', DATE_FORMAT(ro.available_from, '%Y-%m-%d %H:%i:%s'),
                'end_at', DATE_FORMAT(ro.available_to, '%Y-%m-%d %H:%i:%s')
            ))
        ELSE JSON_ARRAY()
    END,
    CASE WHEN ro.status = 'active' THEN 1 ELSE 0 END,
    CASE
        WHEN ro.deleted_at IS NOT NULL THEN 'closed'
        WHEN ro.status = 'active' THEN 'paused'
        WHEN ro.status IN ('inactive', 'paused', 'offline', 'maintenance') THEN 'paused'
        WHEN ro.status = 'closed' THEN 'closed'
        ELSE 'draft'
    END,
    ro.created_at,
    ro.updated_at,
    ro.deleted_at
FROM rental_offers ro
LEFT JOIN drones d ON d.id = ro.drone_id
LEFT JOIN owner_supplies os ON os.supply_no = CONCAT('SPLEGACY', LPAD(ro.id, 10, '0'))
WHERE os.id IS NULL;

-- ==================== 历史 pilot_drone_bindings 回填到 owner_pilot_bindings ====================
-- 说明：
-- 1. 新模型抽象为 owner_user_id + pilot_user_id 长期协作关系
-- 2. 历史发起方无法追溯，统一视为 owner 发起
-- 3. active 优先；若无 active，则 expired 次之，其余回填 dissolved

INSERT IGNORE INTO owner_pilot_bindings (
    owner_user_id,
    pilot_user_id,
    initiated_by,
    status,
    is_priority,
    note,
    confirmed_at,
    dissolved_at,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    pb.owner_id,
    p.user_id,
    'owner',
    'active',
    0,
    'backfilled_from_pilot_drone_bindings',
    MIN(pb.created_at),
    NULL,
    MIN(pb.created_at),
    MAX(COALESCE(pb.updated_at, pb.created_at)),
    NULL
FROM pilot_drone_bindings pb
INNER JOIN pilots p ON p.id = pb.pilot_id AND p.deleted_at IS NULL
LEFT JOIN owner_pilot_bindings opb
    ON opb.owner_user_id = pb.owner_id
   AND opb.pilot_user_id = p.user_id
   AND opb.deleted_at IS NULL
WHERE pb.deleted_at IS NULL
  AND pb.status = 'active'
  AND opb.id IS NULL
GROUP BY pb.owner_id, p.user_id;

INSERT IGNORE INTO owner_pilot_bindings (
    owner_user_id,
    pilot_user_id,
    initiated_by,
    status,
    is_priority,
    note,
    confirmed_at,
    dissolved_at,
    created_at,
    updated_at,
    deleted_at
)
SELECT
    base.owner_id,
    base.pilot_user_id,
    'owner',
    base.binding_status,
    0,
    'backfilled_from_pilot_drone_bindings',
    NULL,
    CASE WHEN base.binding_status = 'dissolved' THEN base.latest_at ELSE NULL END,
    base.first_at,
    base.latest_at,
    NULL
FROM (
    SELECT
        pb.owner_id,
        p.user_id AS pilot_user_id,
        CASE
            WHEN SUM(CASE WHEN pb.status = 'expired' THEN 1 ELSE 0 END) > 0 THEN 'expired'
            ELSE 'dissolved'
        END AS binding_status,
        MIN(pb.created_at) AS first_at,
        MAX(COALESCE(pb.updated_at, pb.created_at, pb.deleted_at)) AS latest_at
    FROM pilot_drone_bindings pb
    INNER JOIN pilots p ON p.id = pb.pilot_id AND p.deleted_at IS NULL
    WHERE (pb.deleted_at IS NOT NULL OR pb.status IN ('expired', 'revoked'))
    GROUP BY pb.owner_id, p.user_id
) base
LEFT JOIN owner_pilot_bindings opb
    ON opb.owner_user_id = base.owner_id
   AND opb.pilot_user_id = base.pilot_user_id
   AND opb.deleted_at IS NULL
WHERE opb.id IS NULL;


-- ===== extracted from 103_create_demand_v2_tables.sql =====

INSERT IGNORE INTO demands (
    demand_no,
    client_user_id,
    title,
    service_type,
    cargo_scene,
    description,
    departure_address_snapshot,
    destination_address_snapshot,
    service_address_snapshot,
    scheduled_start_at,
    scheduled_end_at,
    cargo_weight_kg,
    cargo_volume_m3,
    cargo_type,
    cargo_special_requirements,
    estimated_trip_count,
    cargo_snapshot,
    budget_min,
    budget_max,
    allows_pilot_candidate,
    selected_quote_id,
    selected_provider_user_id,
    expires_at,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT('DMRLEGACY', LPAD(rd.id, 10, '0')),
    rd.renter_id,
    COALESCE(NULLIF(rd.title, ''), '历史需求'),
    'heavy_cargo_lift_transport',
    'other_heavy_lift',
    rd.description,
    NULL,
    NULL,
    JSON_OBJECT(
        'text', COALESCE(rd.address, ''),
        'latitude', COALESCE(rd.latitude, 0),
        'longitude', COALESCE(rd.longitude, 0),
        'city', COALESCE(rd.city, '')
    ),
    rd.start_time,
    rd.end_time,
    COALESCE(rd.required_load, 0),
    0,
    COALESCE(NULLIF(rd.demand_type, ''), 'legacy_rental'),
    '',
    1,
    JSON_OBJECT(
        'legacy_source_type', 'rental_demand',
        'legacy_source_id', rd.id,
        'required_features', COALESCE(rd.required_features, JSON_ARRAY()),
        'urgency', COALESCE(rd.urgency, ''),
        'legacy_demand_type', COALESCE(rd.demand_type, '')
    ),
    COALESCE(rd.budget_min, 0),
    COALESCE(rd.budget_max, 0),
    0,
    0,
    0,
    rd.end_time,
    CASE
        WHEN rd.status IN ('quoting', 'matching', 'matched') THEN 'quoting'
        WHEN rd.status = 'selected' THEN 'selected'
        WHEN rd.status IN ('ordered', 'converted', 'completed') THEN 'converted_to_order'
        WHEN rd.status = 'expired' THEN 'expired'
        WHEN rd.status IN ('cancelled', 'canceled', 'closed', 'deleted') THEN 'cancelled'
        ELSE 'published'
    END,
    rd.created_at,
    rd.updated_at
FROM rental_demands rd
LEFT JOIN demands d ON d.demand_no = CONCAT('DMRLEGACY', LPAD(rd.id, 10, '0'))
WHERE d.id IS NULL;

-- ==================== 历史 cargo_demands 回填到 demands ====================
INSERT IGNORE INTO demands (
    demand_no,
    client_user_id,
    title,
    service_type,
    cargo_scene,
    description,
    departure_address_snapshot,
    destination_address_snapshot,
    service_address_snapshot,
    scheduled_start_at,
    scheduled_end_at,
    cargo_weight_kg,
    cargo_volume_m3,
    cargo_type,
    cargo_special_requirements,
    estimated_trip_count,
    cargo_snapshot,
    budget_min,
    budget_max,
    allows_pilot_candidate,
    selected_quote_id,
    selected_provider_user_id,
    expires_at,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT('DMCLEGACY', LPAD(cd.id, 10, '0')),
    cd.publisher_id,
    COALESCE(NULLIF(cd.cargo_description, ''), CONCAT(COALESCE(NULLIF(cd.cargo_type, ''), '货物'), '吊运需求')),
    'heavy_cargo_lift_transport',
    'other_heavy_lift',
    cd.cargo_description,
    JSON_OBJECT(
        'text', COALESCE(cd.pickup_address, ''),
        'latitude', COALESCE(cd.pickup_latitude, 0),
        'longitude', COALESCE(cd.pickup_longitude, 0)
    ),
    JSON_OBJECT(
        'text', COALESCE(cd.delivery_address, ''),
        'latitude', COALESCE(cd.delivery_latitude, 0),
        'longitude', COALESCE(cd.delivery_longitude, 0)
    ),
    NULL,
    cd.pickup_time,
    COALESCE(cd.delivery_deadline, DATE_ADD(cd.pickup_time, INTERVAL 2 HOUR)),
    COALESCE(cd.cargo_weight, 0),
    CASE
        WHEN JSON_EXTRACT(cd.cargo_size, '$.length') IS NOT NULL
         AND JSON_EXTRACT(cd.cargo_size, '$.width') IS NOT NULL
         AND JSON_EXTRACT(cd.cargo_size, '$.height') IS NOT NULL
        THEN ROUND(
            (
                JSON_EXTRACT(cd.cargo_size, '$.length')
                * JSON_EXTRACT(cd.cargo_size, '$.width')
                * JSON_EXTRACT(cd.cargo_size, '$.height')
            ) / 1000000,
            3
        )
        ELSE 0
    END,
    COALESCE(NULLIF(cd.cargo_type, ''), 'legacy_cargo'),
    COALESCE(cd.special_requirements, ''),
    1,
    JSON_OBJECT(
        'legacy_source_type', 'cargo_demand',
        'legacy_source_id', cd.id,
        'cargo_size', COALESCE(cd.cargo_size, JSON_OBJECT()),
        'distance_km', COALESCE(cd.distance, 0),
        'images', COALESCE(cd.images, JSON_ARRAY())
    ),
    COALESCE(cd.offered_price, 0),
    COALESCE(cd.offered_price, 0),
    0,
    0,
    0,
    COALESCE(cd.delivery_deadline, DATE_ADD(cd.pickup_time, INTERVAL 2 HOUR)),
    CASE
        WHEN cd.status IN ('quoting', 'matching', 'matched') THEN 'quoting'
        WHEN cd.status = 'selected' THEN 'selected'
        WHEN cd.status IN ('ordered', 'converted', 'completed') THEN 'converted_to_order'
        WHEN cd.status = 'expired' THEN 'expired'
        WHEN cd.status IN ('cancelled', 'canceled', 'closed', 'deleted') THEN 'cancelled'
        ELSE 'published'
    END,
    cd.created_at,
    cd.updated_at
FROM cargo_demands cd
LEFT JOIN demands d ON d.demand_no = CONCAT('DMCLEGACY', LPAD(cd.id, 10, '0'))
WHERE d.id IS NULL;

-- ==================== 历史 matching_records 回填到 matching_logs ====================
INSERT IGNORE INTO matching_logs (
    demand_id,
    actor_type,
    action_type,
    result_snapshot,
    created_at
)
SELECT
    d.id,
    'system',
    CASE
        WHEN mr.status = 'viewed' THEN 'quote_rank'
        ELSE 'recommend_owner'
    END,
    JSON_OBJECT(
        'legacy_matching_record_id', mr.id,
        'legacy_demand_type', mr.demand_type,
        'legacy_supply_id', mr.supply_id,
        'legacy_supply_type', mr.supply_type,
        'match_score', mr.match_score,
        'match_reason', COALESCE(mr.match_reason, JSON_OBJECT()),
        'legacy_status', COALESCE(mr.status, '')
    ),
    mr.created_at
FROM matching_records mr
INNER JOIN demands d
    ON d.demand_no = CASE
        WHEN mr.demand_type = 'rental_demand' THEN CONCAT('DMRLEGACY', LPAD(mr.demand_id, 10, '0'))
        WHEN mr.demand_type = 'cargo_demand' THEN CONCAT('DMCLEGACY', LPAD(mr.demand_id, 10, '0'))
        ELSE CONCAT('DMLEGACY', LPAD(mr.demand_id, 10, '0'))
    END;

-- ==================== 说明 ====================
-- 1. demand_quotes 当前无稳定历史来源，本阶段只建表，不强行回填
-- 2. demand_candidate_pilots 与 dispatch_candidates 的拆分依赖后续 R1.06 dispatch 语义重构，本阶段先建表，不做脏回填
-- 3. 当前 legacy rental_demands / cargo_demands 在真实旧库中不稳定包含 client_id，回填 client_user_id 时统一回退到 renter_id / publisher_id


-- ===== extracted from 104_extend_orders_for_v2_sources.sql =====

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
LEFT JOIN dispatch_pool_tasks dpt
    ON dpt.id = CASE
        WHEN o.order_type = 'dispatch' THEN o.related_id
        ELSE 0
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
        WHEN o.order_type = 'dispatch' AND COALESCE(dpt.cargo_demand_id, 0) > 0 THEN COALESCE((
            SELECT d.id
            FROM demands d
            WHERE d.demand_no = CONCAT('DMCLEGACY', LPAD(dpt.cargo_demand_id, 10, '0'))
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


-- ===== extracted from 105_create_order_artifacts.sql =====

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

INSERT IGNORE INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
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

INSERT IGNORE INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
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

INSERT IGNORE INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
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

INSERT IGNORE INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
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

INSERT IGNORE INTO order_snapshots (order_id, snapshot_type, snapshot_data, created_at, updated_at)
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

INSERT IGNORE INTO refunds (refund_no, order_id, payment_id, amount, reason, status, created_at, updated_at)
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


-- ===== extracted from 106_split_dispatch_pool_and_formal_dispatch.sql =====

UPDATE dispatch_pool_tasks pt
JOIN orders o
  ON o.order_type = 'dispatch'
 AND o.related_id = pt.id
SET pt.order_id = o.id
WHERE COALESCE(pt.order_id, 0) = 0;

INSERT IGNORE INTO dispatch_tasks (
    dispatch_no,
    order_id,
    provider_user_id,
    target_pilot_user_id,
    dispatch_source,
    retry_count,
    status,
    reason,
    sent_at,
    responded_at,
    created_at,
    updated_at
)
SELECT
    CONCAT('DPLEGACY', LPAD(pt.id, 10, '0')),
    COALESCE(NULLIF(pt.order_id, 0), o.id),
    COALESCE(NULLIF(pt.assigned_owner_id, 0), dc.owner_id, 0),
    COALESCE(NULLIF(p.user_id, 0), 0),
    CASE
        WHEN opb.id IS NOT NULL THEN 'bound_pilot'
        ELSE 'candidate_pool'
    END,
    GREATEST(COALESCE(pt.match_attempts, 1) - 1, 0),
    CASE
        WHEN o.status IN ('in_progress', 'delivered') THEN 'executing'
        WHEN o.status IN ('completed', 'refunded') THEN 'finished'
        WHEN pt.status = 'expired' THEN 'expired'
        ELSE 'accepted'
    END,
    CASE
        WHEN pt.fail_reason IS NOT NULL AND pt.fail_reason <> '' THEN CONCAT('历史任务池迁移：', pt.fail_reason)
        ELSE CONCAT('历史任务池 ', pt.task_no, ' 迁移')
    END,
    COALESCE(dc.notified_at, pt.assigned_at, pt.created_at),
    COALESCE(dc.responded_at, pt.assigned_at, pt.updated_at),
    pt.created_at,
    pt.updated_at
FROM dispatch_pool_tasks pt
LEFT JOIN orders o
  ON o.id = pt.order_id
LEFT JOIN dispatch_pool_candidates dc
  ON dc.task_id = pt.id
 AND dc.pilot_id = pt.assigned_pilot_id
 AND dc.status = 'accepted'
LEFT JOIN pilots p
  ON p.id = pt.assigned_pilot_id
LEFT JOIN owner_pilot_bindings opb
  ON opb.owner_user_id = COALESCE(NULLIF(pt.assigned_owner_id, 0), dc.owner_id)
 AND opb.pilot_user_id = p.user_id
 AND opb.status = 'active'
LEFT JOIN dispatch_tasks ft
  ON ft.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'))
WHERE COALESCE(NULLIF(pt.order_id, 0), o.id, 0) > 0
  AND COALESCE(NULLIF(pt.assigned_owner_id, 0), dc.owner_id, 0) > 0
  AND COALESCE(NULLIF(p.user_id, 0), 0) > 0
  AND ft.id IS NULL;

INSERT IGNORE INTO dispatch_logs (dispatch_task_id, action_type, operator_user_id, note, created_at)
SELECT
    ft.id,
    'created',
    ft.provider_user_id,
    CONCAT('由历史任务池 ', pt.task_no, ' 创建正式派单'),
    COALESCE(ft.sent_at, ft.created_at)
FROM dispatch_tasks ft
JOIN dispatch_pool_tasks pt
  ON ft.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'))
LEFT JOIN dispatch_logs fl
  ON fl.dispatch_task_id = ft.id
 AND fl.action_type = 'created'
WHERE fl.id IS NULL;

INSERT IGNORE INTO dispatch_logs (dispatch_task_id, action_type, operator_user_id, note, created_at)
SELECT
    ft.id,
    CASE
        WHEN ft.status = 'expired' THEN 'expired'
        ELSE 'accepted'
    END,
    CASE
        WHEN ft.status = 'expired' THEN ft.provider_user_id
        ELSE ft.target_pilot_user_id
    END,
    CASE
        WHEN ft.status = 'expired' THEN '历史正式派单已过期'
        ELSE '历史飞手已接受正式派单'
    END,
    COALESCE(ft.responded_at, ft.updated_at, ft.created_at)
FROM dispatch_tasks ft
LEFT JOIN dispatch_logs fl
  ON fl.dispatch_task_id = ft.id
 AND fl.action_type IN ('accepted', 'expired')
WHERE ft.dispatch_no LIKE 'DPLEGACY%'
  AND fl.id IS NULL
  AND ft.status IN ('accepted', 'executing', 'finished', 'expired');

UPDATE orders o
JOIN dispatch_tasks ft
  ON ft.order_id = o.id
SET o.dispatch_task_id = ft.id
WHERE o.order_type = 'dispatch';

-- 说明：
-- 1. 旧 dispatch_pool_* 保留任务池语义，继续服务 v1 匹配/候选逻辑
-- 2. 新 dispatch_tasks / dispatch_logs 专用于“订单 -> 飞手”的正式派单指令与状态历史
-- 3. 历史正式派单只回填“已明确接单/已有关联订单”的记录；其余仍保留在任务池，后续由 R1.08 迁移审计补齐


-- ===== extracted from 107_rebuild_flight_records.sql =====

INSERT IGNORE INTO flight_records (
    flight_no,
    order_id,
    dispatch_task_id,
    pilot_user_id,
    drone_id,
    takeoff_at,
    landing_at,
    total_duration_seconds,
    total_distance_m,
    max_altitude_m,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT(o.order_no, '-F1') AS flight_no,
    o.id AS order_id,
    NULLIF(o.dispatch_task_id, 0) AS dispatch_task_id,
    COALESCE(NULLIF(o.executor_pilot_user_id, 0), NULLIF(p.user_id, 0), 0) AS pilot_user_id,
    o.drone_id,
    COALESCE(o.flight_start_time, pos.first_recorded_at) AS takeoff_at,
    COALESCE(o.flight_end_time, pos.last_recorded_at) AS landing_at,
    COALESCE(
        NULLIF(o.actual_flight_duration, 0),
        CASE
            WHEN COALESCE(o.flight_start_time, pos.first_recorded_at) IS NOT NULL
             AND COALESCE(o.flight_end_time, pos.last_recorded_at) IS NOT NULL
             AND COALESCE(o.flight_end_time, pos.last_recorded_at) > COALESCE(o.flight_start_time, pos.first_recorded_at)
            THEN TIMESTAMPDIFF(
                SECOND,
                COALESCE(o.flight_start_time, pos.first_recorded_at),
                COALESCE(o.flight_end_time, pos.last_recorded_at)
            )
            ELSE 0
        END
    ) AS total_duration_seconds,
    COALESCE(NULLIF(o.actual_flight_distance, 0), 0) AS total_distance_m,
    COALESCE(NULLIF(o.max_altitude, 0), pos.max_altitude, 0) AS max_altitude_m,
    CASE
        WHEN o.status = 'cancelled' AND COALESCE(o.flight_start_time, pos.first_recorded_at) IS NOT NULL THEN 'aborted'
        WHEN o.flight_end_time IS NOT NULL OR o.status IN ('delivered', 'completed', 'refunded') THEN 'completed'
        WHEN o.flight_start_time IS NOT NULL OR pos.order_id IS NOT NULL OR o.status = 'in_transit' THEN 'executing'
        ELSE 'pending'
    END AS status,
    o.created_at,
    o.updated_at
FROM orders o
LEFT JOIN pilots p
  ON p.id = o.pilot_id
LEFT JOIN (
    SELECT
        order_id,
        MIN(recorded_at) AS first_recorded_at,
        MAX(recorded_at) AS last_recorded_at,
        MAX(altitude) AS max_altitude
    FROM flight_positions
    GROUP BY order_id
) pos
  ON pos.order_id = o.id
LEFT JOIN flight_records fr
  ON fr.order_id = o.id
 AND fr.deleted_at IS NULL
WHERE o.deleted_at IS NULL
  AND o.drone_id > 0
  AND fr.id IS NULL
  AND (
      pos.order_id IS NOT NULL
      OR o.flight_start_time IS NOT NULL
      OR o.flight_end_time IS NOT NULL
      OR COALESCE(o.actual_flight_distance, 0) > 0
      OR COALESCE(o.actual_flight_duration, 0) > 0
      OR COALESCE(o.max_altitude, 0) > 0
  );

-- 第二类回填：只有飞手历史日志、但订单执行表证据不足的订单，也补一条履约飞行记录。
INSERT IGNORE INTO flight_records (
    flight_no,
    order_id,
    dispatch_task_id,
    pilot_user_id,
    drone_id,
    takeoff_at,
    landing_at,
    total_duration_seconds,
    total_distance_m,
    max_altitude_m,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT(o.order_no, '-F1') AS flight_no,
    pl.order_id,
    NULLIF(o.dispatch_task_id, 0) AS dispatch_task_id,
    COALESCE(NULLIF(o.executor_pilot_user_id, 0), NULLIF(pp.user_id, 0), 0) AS pilot_user_id,
    COALESCE(NULLIF(pl.drone_id, 0), o.drone_id) AS drone_id,
    COALESCE(o.flight_start_time, pl.flight_date) AS takeoff_at,
    COALESCE(
        o.flight_end_time,
        DATE_ADD(pl.flight_date, INTERVAL CAST(ROUND(COALESCE(pl.flight_duration, 0) * 60) AS SIGNED) SECOND)
    ) AS landing_at,
    CAST(ROUND(COALESCE(pl.flight_duration, 0) * 60) AS SIGNED) AS total_duration_seconds,
    ROUND(COALESCE(pl.flight_distance, 0) * 1000, 2) AS total_distance_m,
    COALESCE(pl.max_altitude, 0) AS max_altitude_m,
    CASE
        WHEN o.status = 'cancelled' THEN 'aborted'
        ELSE 'completed'
    END AS status,
    COALESCE(pl.created_at, o.created_at),
    COALESCE(pl.created_at, o.updated_at)
FROM pilot_flight_logs pl
JOIN orders o
  ON o.id = pl.order_id
 AND o.deleted_at IS NULL
LEFT JOIN pilots pp
  ON pp.id = pl.pilot_id
LEFT JOIN flight_records fr
  ON fr.order_id = pl.order_id
 AND fr.deleted_at IS NULL
WHERE pl.order_id > 0
  AND COALESCE(NULLIF(pl.drone_id, 0), o.drone_id, 0) > 0
  AND fr.id IS NULL;

-- 把历史位置点和告警挂到新的飞行记录上。迁移期每个历史订单最多先挂到其首条履约飞行记录。
UPDATE flight_positions fp
JOIN (
    SELECT order_id, MIN(id) AS flight_record_id
    FROM flight_records
    WHERE deleted_at IS NULL
    GROUP BY order_id
) fr
  ON fr.order_id = fp.order_id
SET fp.flight_record_id = fr.flight_record_id
WHERE fp.flight_record_id IS NULL;

UPDATE flight_alerts fa
JOIN (
    SELECT order_id, MIN(id) AS flight_record_id
    FROM flight_records
    WHERE deleted_at IS NULL
    GROUP BY order_id
) fr
  ON fr.order_id = fa.order_id
SET fa.flight_record_id = fr.flight_record_id
WHERE fa.flight_record_id IS NULL;

-- 反向同步订单汇总字段，确保旧页面也能读取到真实履约飞行汇总。
UPDATE orders o
JOIN (
    SELECT
        order_id,
        COALESCE(SUM(total_duration_seconds), 0) AS total_duration_seconds,
        COALESCE(ROUND(SUM(total_distance_m)), 0) AS total_distance_m,
        COALESCE(ROUND(MAX(max_altitude_m)), 0) AS max_altitude_m,
        MIN(takeoff_at) AS first_takeoff_at,
        MAX(landing_at) AS last_landing_at
    FROM flight_records
    WHERE deleted_at IS NULL
    GROUP BY order_id
) frs
  ON frs.order_id = o.id
SET o.actual_flight_duration = frs.total_duration_seconds,
    o.actual_flight_distance = frs.total_distance_m,
    o.max_altitude = frs.max_altitude_m,
    o.flight_start_time = COALESCE(o.flight_start_time, frs.first_takeoff_at),
    o.flight_end_time = COALESCE(o.flight_end_time, frs.last_landing_at)
WHERE o.deleted_at IS NULL;


-- ===== extracted from 108_create_migration_mapping_tables.sql =====

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'users',
    CAST(cp.user_id AS CHAR),
    'client_profiles',
    CAST(cp.id AS CHAR),
    'derived',
    'default_client_profile'
FROM client_profiles cp;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'users',
    CAST(op.user_id AS CHAR),
    'owner_profiles',
    CAST(op.id AS CHAR),
    'derived',
    'owner_profile_from_assets'
FROM owner_profiles op;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'pilots',
    CAST(p.id AS CHAR),
    'pilot_profiles',
    CAST(pp.id AS CHAR),
    'derived',
    'pilot_profile_from_legacy_pilot'
FROM pilots p
JOIN pilot_profiles pp ON pp.user_id = p.user_id;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'rental_offers',
    CAST(ro.id AS CHAR),
    'owner_supplies',
    CAST(os.id AS CHAR),
    'migrated',
    'legacy_offer_to_owner_supply'
FROM rental_offers ro
JOIN owner_supplies os
  ON os.supply_no = CONCAT('SPLEGACY', LPAD(ro.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'pilot_drone_bindings',
    CAST(pb.id AS CHAR),
    'owner_pilot_bindings',
    CAST(opb.id AS CHAR),
    'merged',
    'legacy_binding_merged_by_owner_user_and_pilot_user'
FROM pilot_drone_bindings pb
JOIN pilots p ON p.id = pb.pilot_id
JOIN owner_pilot_bindings opb
  ON opb.owner_user_id = pb.owner_id
 AND opb.pilot_user_id = p.user_id
 AND opb.deleted_at IS NULL;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'rental_demands',
    CAST(rd.id AS CHAR),
    'demands',
    CAST(d.id AS CHAR),
    'migrated',
    'legacy_rental_demand_to_v2_demand'
FROM rental_demands rd
JOIN demands d
  ON d.demand_no = CONCAT('DMRLEGACY', LPAD(rd.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'cargo_demands',
    CAST(cd.id AS CHAR),
    'demands',
    CAST(d.id AS CHAR),
    'migrated',
    'legacy_cargo_demand_to_v2_demand'
FROM cargo_demands cd
JOIN demands d
  ON d.demand_no = CONCAT('DMCLEGACY', LPAD(cd.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'dispatch_pool_tasks',
    CAST(pt.id AS CHAR),
    'dispatch_tasks',
    CAST(dt.id AS CHAR),
    'migrated',
    'legacy_dispatch_pool_to_formal_dispatch'
FROM dispatch_pool_tasks pt
JOIN dispatch_tasks dt
  ON dt.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'payments',
    CAST(p.id AS CHAR),
    'refunds',
    CAST(r.id AS CHAR),
    'derived',
    'legacy_refunded_payment_to_refund_record'
FROM payments p
JOIN refunds r ON r.payment_id = p.id;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'orders',
    CAST(o.id AS CHAR),
    'flight_records',
    CAST(fr.id AS CHAR),
    'derived',
    'order_execution_to_flight_record'
FROM orders o
JOIN flight_records fr ON fr.order_id = o.id AND fr.deleted_at IS NULL;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'pilot_flight_logs',
    CAST(pfl.id AS CHAR),
    'flight_records',
    CAST(fr.id AS CHAR),
    'merged',
    'order_linked_pilot_flight_log_to_flight_record'
FROM pilot_flight_logs pfl
JOIN flight_records fr ON fr.order_id = pfl.order_id AND fr.deleted_at IS NULL
WHERE pfl.order_id > 0;

-- ==================== 迁移审计回填 ====================

-- 1. 历史直达订单未能解析 source_supply_id
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'orders',
    'orders',
    CAST(o.id AS CHAR),
    'owner_supplies',
    '',
    'missing_source_supply',
    'warning',
    '历史直达订单未能回填 source_supply_id，需要人工补齐后再纳入 v2 直达链路统计',
    JSON_OBJECT(
        'order_no', o.order_no,
        'order_type', o.order_type,
        'owner_id', o.owner_id,
        'drone_id', o.drone_id
    )
FROM orders o
WHERE o.deleted_at IS NULL
  AND o.order_source = 'supply_direct'
  AND COALESCE(o.source_supply_id, 0) = 0;

-- 2. 历史退款支付未生成正式 refunds 记录
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'refunds',
    'payments',
    CAST(p.id AS CHAR),
    'orders',
    CAST(p.order_id AS CHAR),
    'missing_refund_record',
    'warning',
    '历史支付记录显示已退款，但 refunds 表中不存在对应记录，需要人工核对是否为部分退款或异常退款',
    JSON_OBJECT(
        'payment_no', p.payment_no,
        'amount', p.amount,
        'status', p.status
    )
FROM payments p
LEFT JOIN refunds r ON r.payment_id = p.id
WHERE p.status = 'refunded'
  AND p.order_id > 0
  AND r.id IS NULL;

-- 3. 历史任务池记录未能明确回填为正式派单
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'dispatch',
    'dispatch_pool_tasks',
    CAST(pt.id AS CHAR),
    'dispatch_tasks',
    '',
    'unmapped_formal_dispatch',
    'warning',
    '历史任务池记录未能明确回填为正式派单，需人工判断其是否应转入正式 dispatch_tasks',
    JSON_OBJECT(
        'task_no', pt.task_no,
        'status', pt.status,
        'order_id', COALESCE(pt.order_id, 0),
        'assigned_owner_id', COALESCE(pt.assigned_owner_id, 0),
        'assigned_pilot_id', COALESCE(pt.assigned_pilot_id, 0)
    )
FROM dispatch_pool_tasks pt
LEFT JOIN dispatch_tasks dt
  ON dt.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'))
WHERE dt.id IS NULL
  AND (
      COALESCE(pt.order_id, 0) > 0
      OR COALESCE(pt.assigned_owner_id, 0) > 0
      OR COALESCE(pt.assigned_pilot_id, 0) > 0
      OR pt.status IN ('matched', 'assigned', 'accepted', 'expired', 'completed', 'failed')
  );

-- 4. 有订单归属的历史飞手飞行日志，未能挂到 flight_records
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'flight',
    'pilot_flight_logs',
    CAST(pfl.id AS CHAR),
    'orders',
    CAST(pfl.order_id AS CHAR),
    'unmapped_order_flight_log',
    'warning',
    '历史飞手飞行日志已关联订单，但未能生成履约 flight_record，需要人工核对订单与飞行数据',
    JSON_OBJECT(
        'pilot_id', pfl.pilot_id,
        'drone_id', pfl.drone_id,
        'flight_date', DATE_FORMAT(pfl.flight_date, '%Y-%m-%d %H:%i:%s')
    )
FROM pilot_flight_logs pfl
LEFT JOIN flight_records fr ON fr.order_id = pfl.order_id AND fr.deleted_at IS NULL
WHERE pfl.order_id > 0
  AND fr.id IS NULL;

-- 5. 仍未挂 flight_record_id 的位置点与告警，统一进入审计
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'flight',
    'flight_positions',
    CAST(fp.id AS CHAR),
    'orders',
    CAST(fp.order_id AS CHAR),
    'missing_flight_record_link',
    'warning',
    '历史位置点未能挂到任何 flight_record，需要人工核对订单履约链路',
    JSON_OBJECT(
        'drone_id', fp.drone_id,
        'pilot_id', fp.pilot_id,
        'recorded_at', DATE_FORMAT(fp.recorded_at, '%Y-%m-%d %H:%i:%s')
    )
FROM flight_positions fp
WHERE COALESCE(fp.flight_record_id, 0) = 0
  AND COALESCE(fp.order_id, 0) > 0;

INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'flight',
    'flight_alerts',
    CAST(fa.id AS CHAR),
    'orders',
    CAST(fa.order_id AS CHAR),
    'missing_flight_record_link',
    'warning',
    '历史飞行告警未能挂到任何 flight_record，需要人工核对订单履约链路',
    JSON_OBJECT(
        'alert_type', fa.alert_type,
        'alert_level', fa.alert_level,
        'drone_id', fa.drone_id
    )
FROM flight_alerts fa
WHERE COALESCE(fa.flight_record_id, 0) = 0
  AND COALESCE(fa.order_id, 0) > 0;


-- ===== extracted from 109_add_heavy_lift_threshold_rules.sql =====

UPDATE drones
SET max_payload_kg = COALESCE(NULLIF(max_payload_kg, 0), max_load, 0)
WHERE COALESCE(max_payload_kg, 0) = 0;

-- 同步 owner_supplies 的机型能力字段
UPDATE owner_supplies os
JOIN drones d ON d.id = os.drone_id
SET os.mtow_kg = d.mtow_kg,
    os.max_payload_kg = COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load, 0),
    os.max_range_km = d.max_distance,
    os.updated_at = CURRENT_TIMESTAMP
WHERE os.deleted_at IS NULL;

-- 对历史 legacy offer 供给，若当前机型已满足重载准入且 offer 仍为 active，则允许从此前的保守 paused 放开到 active
UPDATE owner_supplies os
JOIN drones d ON d.id = os.drone_id
JOIN rental_offers ro
  ON os.supply_no = CONCAT('SPLEGACY', LPAD(ro.id, 10, '0'))
SET os.status = 'active',
    os.updated_at = CURRENT_TIMESTAMP
WHERE os.deleted_at IS NULL
  AND os.status IN ('paused', 'active')
  AND ro.deleted_at IS NULL
  AND ro.status = 'active'
  AND d.availability_status = 'available'
  AND d.certification_status = 'approved'
  AND d.uom_verified = 'verified'
  AND d.insurance_verified = 'verified'
  AND d.airworthiness_verified = 'verified'
  AND d.mtow_kg >= 150
  AND COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load) >= 50;

-- 不满足平台准入的 active 供给统一降为 paused，禁止继续进入主市场
UPDATE owner_supplies os
JOIN drones d ON d.id = os.drone_id
SET os.status = 'paused',
    os.updated_at = CURRENT_TIMESTAMP
WHERE os.deleted_at IS NULL
  AND os.status = 'active'
  AND (
      d.availability_status <> 'available'
      OR d.certification_status <> 'approved'
      OR d.uom_verified <> 'verified'
      OR d.insurance_verified <> 'verified'
      OR d.airworthiness_verified <> 'verified'
      OR d.mtow_kg < 150
      OR COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load) < 50
  );

-- 审计：仍在 active 的 legacy offer 若机型不达标，应列入审计，防止旧公开市场继续暴露
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'heavy_lift_threshold',
    'rental_offers',
    CAST(ro.id AS CHAR),
    'drones',
    CAST(d.id AS CHAR),
    'ineligible_active_offer',
    'warning',
    '历史 active 供给对应无人机不满足平台重载准入，已从主市场过滤，需人工补齐机型能力或下架旧供给',
    JSON_OBJECT(
        'offer_title', ro.title,
        'drone_id', d.id,
        'mtow_kg', d.mtow_kg,
        'max_payload_kg', COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load, 0),
        'availability_status', d.availability_status,
        'certification_status', d.certification_status,
        'uom_verified', d.uom_verified,
        'insurance_verified', d.insurance_verified,
        'airworthiness_verified', d.airworthiness_verified
    )
FROM rental_offers ro
JOIN drones d ON d.id = ro.drone_id
WHERE ro.deleted_at IS NULL
  AND ro.status = 'active'
  AND (
      d.mtow_kg < 150
      OR COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load) < 50
      OR d.availability_status <> 'available'
      OR d.certification_status <> 'approved'
      OR d.uom_verified <> 'verified'
      OR d.insurance_verified <> 'verified'
      OR d.airworthiness_verified <> 'verified'
  );

-- 审计：仍未补齐 mtow_kg 的机型，后续不能进入主市场
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'heavy_lift_threshold',
    'drones',
    CAST(d.id AS CHAR),
    'owner_supplies',
    CAST(os.id AS CHAR),
    'missing_mtow_kg',
    'warning',
    '无人机未补齐 mtow_kg，无法判断是否满足平台重载准入，当前不纳入主市场匹配池',
    JSON_OBJECT(
        'owner_id', d.owner_id,
        'serial_number', d.serial_number,
        'max_payload_kg', COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load, 0),
        'supply_status', COALESCE(os.status, '')
    )
FROM drones d
LEFT JOIN owner_supplies os
  ON os.drone_id = d.id
 AND os.deleted_at IS NULL
WHERE COALESCE(d.mtow_kg, 0) = 0;
