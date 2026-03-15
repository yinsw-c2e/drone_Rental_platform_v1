-- 103_create_demand_v2_tables.sql
-- R1.03: 创建 v2 需求、报价、候选飞手、匹配日志表
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS demands (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    demand_no VARCHAR(50) NOT NULL UNIQUE COMMENT '需求编号',
    client_user_id BIGINT NOT NULL COMMENT '客户账号ID',
    title VARCHAR(200) NOT NULL COMMENT '需求标题',
    service_type VARCHAR(50) NOT NULL COMMENT '服务类型',
    cargo_scene VARCHAR(50) NOT NULL COMMENT '场景类型',
    description TEXT COMMENT '需求描述',
    departure_address_snapshot JSON COMMENT '出发地址快照',
    destination_address_snapshot JSON COMMENT '目的地址快照',
    service_address_snapshot JSON COMMENT '作业地址快照',
    scheduled_start_at DATETIME NULL COMMENT '预约开始时间',
    scheduled_end_at DATETIME NULL COMMENT '预约结束时间',
    cargo_weight_kg DECIMAL(10,2) DEFAULT 0 COMMENT '货物重量(kg)',
    cargo_volume_m3 DECIMAL(10,3) DEFAULT 0 COMMENT '货物体积(m3)',
    cargo_type VARCHAR(50) DEFAULT '' COMMENT '货物类型',
    cargo_special_requirements TEXT COMMENT '货物特殊要求',
    estimated_trip_count INT DEFAULT 1 COMMENT '预计架次',
    cargo_snapshot JSON COMMENT '货物/任务快照',
    budget_min BIGINT DEFAULT 0 COMMENT '预算下限(分)',
    budget_max BIGINT DEFAULT 0 COMMENT '预算上限(分)',
    allows_pilot_candidate TINYINT(1) DEFAULT 0 COMMENT '是否允许飞手候选',
    selected_quote_id BIGINT DEFAULT 0 COMMENT '已选报价ID',
    selected_provider_user_id BIGINT DEFAULT 0 COMMENT '已选机主账号ID',
    expires_at DATETIME NULL COMMENT '需求有效期截止',
    status VARCHAR(30) DEFAULT 'draft' COMMENT '状态: draft, published, quoting, selected, converted_to_order, expired, cancelled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_demands_client_user_id (client_user_id),
    INDEX idx_demands_status (status),
    INDEX idx_demands_cargo_scene (cargo_scene),
    INDEX idx_demands_expires_at (expires_at),
    CONSTRAINT fk_demands_client_user FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 客户公开需求表';

CREATE TABLE IF NOT EXISTS demand_quotes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    quote_no VARCHAR(50) NOT NULL UNIQUE COMMENT '报价编号',
    demand_id BIGINT NOT NULL COMMENT '关联需求ID',
    owner_user_id BIGINT NOT NULL COMMENT '机主账号ID',
    drone_id BIGINT NOT NULL COMMENT '拟投入无人机ID',
    price_amount BIGINT DEFAULT 0 COMMENT '报价金额(分)',
    pricing_snapshot JSON COMMENT '报价快照',
    execution_plan TEXT COMMENT '执行说明',
    status VARCHAR(20) DEFAULT 'submitted' COMMENT '状态: submitted, withdrawn, rejected, selected, expired',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_demand_quotes_demand_id (demand_id),
    INDEX idx_demand_quotes_owner_user_id (owner_user_id),
    INDEX idx_demand_quotes_drone_id (drone_id),
    INDEX idx_demand_quotes_status (status),
    CONSTRAINT fk_demand_quotes_demand FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE,
    CONSTRAINT fk_demand_quotes_owner_user FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_demand_quotes_drone FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 需求报价表';

CREATE TABLE IF NOT EXISTS demand_candidate_pilots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    demand_id BIGINT NOT NULL COMMENT '关联需求ID',
    pilot_user_id BIGINT NOT NULL COMMENT '飞手账号ID',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active, withdrawn, expired, converted, skipped',
    availability_snapshot JSON COMMENT '报名时能力快照',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_demand_candidate_pilots_demand_id (demand_id),
    INDEX idx_demand_candidate_pilots_pilot_user_id (pilot_user_id),
    INDEX idx_demand_candidate_pilots_status (status),
    CONSTRAINT fk_demand_candidate_pilots_demand FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE,
    CONSTRAINT fk_demand_candidate_pilots_pilot_user FOREIGN KEY (pilot_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 候选飞手池表';

CREATE TABLE IF NOT EXISTS matching_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    demand_id BIGINT NOT NULL COMMENT '关联需求ID',
    actor_type VARCHAR(20) NOT NULL COMMENT '触发方: system, client, owner, pilot',
    action_type VARCHAR(30) NOT NULL COMMENT '动作类型: recommend_owner, quote_rank, candidate_rank, auto_push',
    result_snapshot JSON COMMENT '结果快照',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_matching_logs_demand_id (demand_id),
    INDEX idx_matching_logs_actor_type (actor_type),
    INDEX idx_matching_logs_action_type (action_type),
    CONSTRAINT fk_matching_logs_demand FOREIGN KEY (demand_id) REFERENCES demands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 匹配日志表';

-- ==================== 历史 rental_demands 回填到 demands ====================
INSERT INTO demands (
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
INSERT INTO demands (
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
INSERT INTO matching_logs (
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
