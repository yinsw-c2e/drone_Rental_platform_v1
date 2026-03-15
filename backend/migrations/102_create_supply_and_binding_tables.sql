-- 102_create_supply_and_binding_tables.sql
-- R1.02: 创建 v2 供给与机主-飞手协作关系表
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS owner_supplies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    supply_no VARCHAR(50) NOT NULL UNIQUE COMMENT '供给编号',
    owner_user_id BIGINT NOT NULL COMMENT '机主账号ID',
    drone_id BIGINT NOT NULL COMMENT '关联无人机ID',
    title VARCHAR(200) NOT NULL COMMENT '供给标题',
    description TEXT COMMENT '供给描述',
    service_types JSON COMMENT '服务类型列表',
    cargo_scenes JSON COMMENT '可承接场景列表',
    service_area_snapshot JSON COMMENT '服务区域快照',
    mtow_kg DECIMAL(10,2) DEFAULT 0 COMMENT '最大起飞重量(kg)',
    max_payload_kg DECIMAL(10,2) DEFAULT 0 COMMENT '最大吊重(kg)',
    max_range_km DECIMAL(10,2) DEFAULT 0 COMMENT '最大航程(km)',
    base_price_amount BIGINT DEFAULT 0 COMMENT '基础价格(分)',
    pricing_unit VARCHAR(20) DEFAULT 'per_trip' COMMENT '计价单位: per_trip, per_km, per_hour, per_kg',
    pricing_rule JSON COMMENT '计价规则',
    available_time_slots JSON COMMENT '可服务时间段',
    accepts_direct_order TINYINT(1) DEFAULT 1 COMMENT '是否接受客户直达下单',
    status VARCHAR(20) DEFAULT 'draft' COMMENT '状态: draft, active, paused, closed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_owner_supplies_owner_user_id (owner_user_id),
    INDEX idx_owner_supplies_drone_id (drone_id),
    INDEX idx_owner_supplies_status (status),
    INDEX idx_owner_supplies_deleted_at (deleted_at),
    CONSTRAINT fk_owner_supplies_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_owner_supplies_drone FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 机主供给表';

CREATE TABLE IF NOT EXISTS owner_pilot_bindings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT NOT NULL COMMENT '机主账号ID',
    pilot_user_id BIGINT NOT NULL COMMENT '飞手账号ID',
    initiated_by VARCHAR(20) NOT NULL DEFAULT 'owner' COMMENT '发起方: owner, pilot',
    status VARCHAR(30) NOT NULL DEFAULT 'pending_confirmation' COMMENT '状态: pending_confirmation, active, paused, rejected, expired, dissolved',
    is_priority TINYINT(1) DEFAULT 0 COMMENT '是否优先合作',
    note TEXT COMMENT '合作备注',
    confirmed_at DATETIME NULL COMMENT '确认时间',
    dissolved_at DATETIME NULL COMMENT '解除时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_owner_pilot_bindings_owner_user_id (owner_user_id),
    INDEX idx_owner_pilot_bindings_pilot_user_id (pilot_user_id),
    INDEX idx_owner_pilot_bindings_pair (owner_user_id, pilot_user_id),
    INDEX idx_owner_pilot_bindings_status (status),
    INDEX idx_owner_pilot_bindings_deleted_at (deleted_at),
    CONSTRAINT fk_owner_pilot_bindings_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_owner_pilot_bindings_pilot_user FOREIGN KEY (pilot_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 机主-飞手协作关系表';

-- ==================== 历史 rental_offers 回填到 owner_supplies ====================
-- 说明：
-- 1. v2 当前只保留 heavy_cargo_lift_transport 供给语义
-- 2. 历史 offer 无法可靠反推出 cargo_scenes，统一回填为空数组
-- 3. 由于 legacy 模型缺失 mtow_kg，本阶段统一保守回填为 paused/closed/draft，待 R1.09 补齐重载准入后再放开 active

INSERT INTO owner_supplies (
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

INSERT INTO owner_pilot_bindings (
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

INSERT INTO owner_pilot_bindings (
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
