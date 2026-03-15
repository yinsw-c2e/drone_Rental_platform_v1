-- 901_phase9_prepare_v2_schema.sql
-- 阶段 9 / R9.01: 结构迁移脚本（只处理建表、改表、索引、表重命名，不做数据回填）
-- 生成方式：从 101-109 脚本中抽取 DDL / 结构变更语句
-- 说明：
-- 1. 本脚本只负责把 v2 结构准备到位，可重复执行
-- 2. 数据回填统一放在 911_phase9_backfill_v2_data.sql
-- 3. 执行前仍建议先做数据库快照或备份


-- ===== extracted from 101_create_role_profile_tables.sql =====

-- 101_create_role_profile_tables.sql
-- R1.01: 创建 v2 角色档案基础表
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS client_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联 users.id',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '档案状态: active, disabled',
    default_contact_name VARCHAR(50) DEFAULT '' COMMENT '默认联系人',
    default_contact_phone VARCHAR(20) DEFAULT '' COMMENT '默认联系电话',
    preferred_city VARCHAR(50) DEFAULT '' COMMENT '常用城市',
    remark TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_client_profiles_status (status),
    INDEX idx_client_profiles_preferred_city (preferred_city),
    INDEX idx_client_profiles_deleted_at (deleted_at),
    CONSTRAINT fk_client_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 客户档案表';

CREATE TABLE IF NOT EXISTS owner_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联 users.id',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态: pending, verified, rejected',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '档案状态: active, disabled',
    service_city VARCHAR(50) DEFAULT '' COMMENT '常驻服务城市',
    contact_phone VARCHAR(20) DEFAULT '' COMMENT '业务联系电话',
    intro TEXT COMMENT '机主介绍',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_owner_profiles_verification_status (verification_status),
    INDEX idx_owner_profiles_status (status),
    INDEX idx_owner_profiles_service_city (service_city),
    INDEX idx_owner_profiles_deleted_at (deleted_at),
    CONSTRAINT fk_owner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 机主档案表';

CREATE TABLE IF NOT EXISTS pilot_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联 users.id',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态: pending, verified, rejected',
    availability_status VARCHAR(20) NOT NULL DEFAULT 'offline' COMMENT '接单状态: offline, online, busy',
    service_radius_km INT NOT NULL DEFAULT 50 COMMENT '服务半径(公里)',
    service_cities JSON COMMENT '服务城市列表',
    skill_tags JSON COMMENT '技能标签',
    caac_license_no VARCHAR(50) DEFAULT '' COMMENT '执照编号',
    caac_license_expire_at DATETIME NULL COMMENT '执照到期时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_pilot_profiles_verification_status (verification_status),
    INDEX idx_pilot_profiles_availability_status (availability_status),
    INDEX idx_pilot_profiles_caac_license_no (caac_license_no),
    INDEX idx_pilot_profiles_deleted_at (deleted_at),
    CONSTRAINT fk_pilot_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 飞手档案表';

-- ==================== 历史数据回填 ====================
-- 说明：
-- 1. 所有现有账号默认补一条 client_profiles
-- 2. 已有无人机或供给的用户补 owner_profiles
-- 3. 已有 pilots 档案的用户补 pilot_profiles



-- ===== extracted from 102_create_supply_and_binding_tables.sql =====

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



-- ===== extracted from 103_create_demand_v2_tables.sql =====

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


-- ===== extracted from 104_extend_orders_for_v2_sources.sql =====

-- 104_extend_orders_for_v2_sources.sql
-- R1.04: 扩展 orders 主表，补齐来源追溯、执行归属、确认状态字段
-- 创建日期: 2026-03-13

SET @has_orders_order_source := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_source'
);
SET @sql := IF(
    @has_orders_order_source = 0,
    'ALTER TABLE orders ADD COLUMN order_source VARCHAR(30) DEFAULT ''demand_market'' COMMENT ''订单来源: demand_market, supply_direct'' AFTER related_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_demand_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'demand_id'
);
SET @sql := IF(@has_orders_demand_id = 0, 'ALTER TABLE orders ADD COLUMN demand_id BIGINT DEFAULT 0 COMMENT ''来源需求ID'' AFTER order_source', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_source_supply_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'source_supply_id'
);
SET @sql := IF(@has_orders_source_supply_id = 0, 'ALTER TABLE orders ADD COLUMN source_supply_id BIGINT DEFAULT 0 COMMENT ''来源供给ID'' AFTER demand_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_client_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'client_id'
);
SET @sql := IF(@has_orders_client_id = 0, 'ALTER TABLE orders ADD COLUMN client_id BIGINT DEFAULT 0 COMMENT ''客户档案ID(兼容字段)'' AFTER renter_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_client_user_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'client_user_id'
);
SET @sql := IF(@has_orders_client_user_id = 0, 'ALTER TABLE orders ADD COLUMN client_user_id BIGINT DEFAULT 0 COMMENT ''客户账号ID'' AFTER client_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_provider_user_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'provider_user_id'
);
SET @sql := IF(@has_orders_provider_user_id = 0, 'ALTER TABLE orders ADD COLUMN provider_user_id BIGINT DEFAULT 0 COMMENT ''承接机主账号ID'' AFTER client_user_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_drone_owner_user_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'drone_owner_user_id'
);
SET @sql := IF(@has_orders_drone_owner_user_id = 0, 'ALTER TABLE orders ADD COLUMN drone_owner_user_id BIGINT DEFAULT 0 COMMENT ''无人机所属机主账号ID'' AFTER provider_user_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_executor_pilot_user_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'executor_pilot_user_id'
);
SET @sql := IF(@has_orders_executor_pilot_user_id = 0, 'ALTER TABLE orders ADD COLUMN executor_pilot_user_id BIGINT DEFAULT 0 COMMENT ''实际执行飞手账号ID'' AFTER drone_owner_user_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_needs_dispatch := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'needs_dispatch'
);
SET @sql := IF(@has_orders_needs_dispatch = 0, 'ALTER TABLE orders ADD COLUMN needs_dispatch TINYINT(1) DEFAULT 0 COMMENT ''是否需要派单'' AFTER dispatch_task_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_execution_mode := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'execution_mode'
);
SET @sql := IF(@has_orders_execution_mode = 0, 'ALTER TABLE orders ADD COLUMN execution_mode VARCHAR(30) DEFAULT ''self_execute'' COMMENT ''执行模式: self_execute, bound_pilot, dispatch_pool'' AFTER needs_dispatch', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @orders_status_length := COALESCE((
    SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'
), 0);
SET @sql := IF(
    @orders_status_length > 0 AND @orders_status_length < 40,
    'ALTER TABLE orders MODIFY COLUMN status VARCHAR(40) DEFAULT ''created''',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_provider_confirmed_at := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'provider_confirmed_at'
);
SET @sql := IF(@has_orders_provider_confirmed_at = 0, 'ALTER TABLE orders ADD COLUMN provider_confirmed_at DATETIME NULL COMMENT ''机主确认时间'' AFTER status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_provider_rejected_at := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'provider_rejected_at'
);
SET @sql := IF(@has_orders_provider_rejected_at = 0, 'ALTER TABLE orders ADD COLUMN provider_rejected_at DATETIME NULL COMMENT ''机主拒绝时间'' AFTER provider_confirmed_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_provider_reject_reason := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'provider_reject_reason'
);
SET @sql := IF(@has_orders_provider_reject_reason = 0, 'ALTER TABLE orders ADD COLUMN provider_reject_reason TEXT COMMENT ''机主拒绝原因'' AFTER provider_rejected_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_actual_flight_distance := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'actual_flight_distance'
);
SET @sql := IF(@has_orders_actual_flight_distance = 0, 'ALTER TABLE orders ADD COLUMN actual_flight_distance INT DEFAULT 0 COMMENT ''实际飞行距离(米)'' AFTER flight_end_time', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_actual_flight_duration := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'actual_flight_duration'
);
SET @sql := IF(@has_orders_actual_flight_duration = 0, 'ALTER TABLE orders ADD COLUMN actual_flight_duration INT DEFAULT 0 COMMENT ''实际飞行时长(秒)'' AFTER actual_flight_distance', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_max_altitude := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'max_altitude'
);
SET @sql := IF(@has_orders_max_altitude = 0, 'ALTER TABLE orders ADD COLUMN max_altitude INT DEFAULT 0 COMMENT ''最高飞行高度(米)'' AFTER actual_flight_duration', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_avg_speed := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'avg_speed'
);
SET @sql := IF(@has_orders_avg_speed = 0, 'ALTER TABLE orders ADD COLUMN avg_speed INT DEFAULT 0 COMMENT ''平均速度'' AFTER max_altitude', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_trajectory_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'trajectory_id'
);
SET @sql := IF(@has_orders_trajectory_id = 0, 'ALTER TABLE orders ADD COLUMN trajectory_id BIGINT NULL COMMENT ''轨迹ID'' AFTER avg_speed', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_order_source := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_order_source'
);
SET @sql := IF(@has_idx_orders_order_source = 0, 'ALTER TABLE orders ADD INDEX idx_orders_order_source (order_source)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_demand_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_demand_id'
);
SET @sql := IF(@has_idx_orders_demand_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_demand_id (demand_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_source_supply_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_source_supply_id'
);
SET @sql := IF(@has_idx_orders_source_supply_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_source_supply_id (source_supply_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_client_user_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_client_user_id'
);
SET @sql := IF(@has_idx_orders_client_user_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_client_user_id (client_user_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_provider_user_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_provider_user_id'
);
SET @sql := IF(@has_idx_orders_provider_user_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_provider_user_id (provider_user_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_drone_owner_user_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_drone_owner_user_id'
);
SET @sql := IF(@has_idx_orders_drone_owner_user_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_drone_owner_user_id (drone_owner_user_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_executor_pilot_user_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_executor_pilot_user_id'
);
SET @sql := IF(@has_idx_orders_executor_pilot_user_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_executor_pilot_user_id (executor_pilot_user_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_needs_dispatch := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_needs_dispatch'
);
SET @sql := IF(@has_idx_orders_needs_dispatch = 0, 'ALTER TABLE orders ADD INDEX idx_orders_needs_dispatch (needs_dispatch)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_execution_mode := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_execution_mode'
);
SET @sql := IF(@has_idx_orders_execution_mode = 0, 'ALTER TABLE orders ADD INDEX idx_orders_execution_mode (execution_mode)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_orders_trajectory_id := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_trajectory_id'
);
SET @sql := IF(@has_idx_orders_trajectory_id = 0, 'ALTER TABLE orders ADD INDEX idx_orders_trajectory_id (trajectory_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @order_timelines_status_length := COALESCE((
    SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_timelines' AND COLUMN_NAME = 'status'
), 0);
SET @sql := IF(
    @order_timelines_status_length > 0 AND @order_timelines_status_length < 40,
    'ALTER TABLE order_timelines MODIFY COLUMN status VARCHAR(40) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;



-- ===== extracted from 105_create_order_artifacts.sql =====

-- 105_create_order_artifacts.sql
-- R1.05: 创建 order_snapshots / refunds / dispute_records，并补齐 orders.paid_at / completed_at
-- 创建日期: 2026-03-13

SET @has_orders_paid_at := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'paid_at'
);
SET @sql := IF(@has_orders_paid_at = 0, 'ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL COMMENT ''支付时间'' AFTER provider_reject_reason', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_orders_completed_at := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'completed_at'
);
SET @sql := IF(@has_orders_completed_at = 0, 'ALTER TABLE orders ADD COLUMN completed_at DATETIME NULL COMMENT ''完成时间'' AFTER paid_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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



-- ===== extracted from 106_split_dispatch_pool_and_formal_dispatch.sql =====

-- 106_split_dispatch_pool_and_formal_dispatch.sql
-- R1.06: 将旧“任务池”语义显式迁移到 dispatch_pool_*，并把 dispatch_tasks / dispatch_logs 重新定义为正式派单对象
-- 创建日期: 2026-03-13

SET @has_dispatch_tasks := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_tasks'
);
SET @has_dispatch_pool_tasks := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_tasks'
);
SET @sql := IF(
    @has_dispatch_tasks > 0 AND @has_dispatch_pool_tasks = 0,
    'RENAME TABLE dispatch_tasks TO dispatch_pool_tasks',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dispatch_candidates := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_candidates'
);
SET @has_dispatch_pool_candidates := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_candidates'
);
SET @sql := IF(
    @has_dispatch_candidates > 0 AND @has_dispatch_pool_candidates = 0,
    'RENAME TABLE dispatch_candidates TO dispatch_pool_candidates',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dispatch_logs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_logs'
);
SET @has_dispatch_pool_logs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_logs'
);
SET @sql := IF(
    @has_dispatch_logs > 0 AND @has_dispatch_pool_logs = 0,
    'RENAME TABLE dispatch_logs TO dispatch_pool_logs',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dispatch_configs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_configs'
);
SET @has_dispatch_pool_configs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_configs'
);
SET @sql := IF(
    @has_dispatch_configs > 0 AND @has_dispatch_pool_configs = 0,
    'RENAME TABLE dispatch_configs TO dispatch_pool_configs',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS dispatch_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dispatch_no VARCHAR(50) NOT NULL COMMENT '正式派单编号',
    order_id BIGINT NOT NULL COMMENT '对应订单ID',
    provider_user_id BIGINT NOT NULL COMMENT '发起派单的机主账号ID',
    target_pilot_user_id BIGINT NOT NULL COMMENT '目标飞手账号ID',
    dispatch_source VARCHAR(30) NOT NULL COMMENT '派单来源: bound_pilot, candidate_pool, general_pool',
    retry_count INT NOT NULL DEFAULT 0 COMMENT '当前重派次数',
    status VARCHAR(20) NOT NULL DEFAULT 'pending_response' COMMENT 'pending_response, accepted, rejected, expired, executing, finished, exception',
    reason TEXT NULL COMMENT '派单说明',
    sent_at DATETIME NULL COMMENT '发出时间',
    responded_at DATETIME NULL COMMENT '响应时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_dispatch_tasks_dispatch_no (dispatch_no),
    KEY idx_dispatch_tasks_order_id (order_id),
    KEY idx_dispatch_tasks_provider_user_id (provider_user_id),
    KEY idx_dispatch_tasks_target_pilot_user_id (target_pilot_user_id),
    KEY idx_dispatch_tasks_dispatch_source (dispatch_source),
    KEY idx_dispatch_tasks_status (status),
    KEY idx_dispatch_tasks_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='正式派单任务表';

CREATE TABLE IF NOT EXISTS dispatch_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dispatch_task_id BIGINT NOT NULL COMMENT '正式派单任务ID',
    action_type VARCHAR(30) NOT NULL COMMENT 'created, accepted, rejected, expired, reassign, exception_reported',
    operator_user_id BIGINT NOT NULL DEFAULT 0 COMMENT '操作人账号ID',
    note TEXT NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dispatch_logs_dispatch_task_id (dispatch_task_id),
    KEY idx_dispatch_logs_action_type (action_type),
    KEY idx_dispatch_logs_operator_user_id (operator_user_id),
    KEY idx_dispatch_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='正式派单日志表';

-- 补齐旧任务池的 order_id 关联。历史上有一部分数据只在 orders.related_id 中可追溯。
SET @has_pool_task_order_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_tasks' AND COLUMN_NAME = 'order_id'
);
SET @sql := IF(
    @has_pool_task_order_col = 0,
    'ALTER TABLE dispatch_pool_tasks ADD COLUMN order_id BIGINT DEFAULT 0 COMMENT ''关联订单ID'' AFTER task_no',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;



-- ===== extracted from 107_rebuild_flight_records.sql =====

-- 107_rebuild_flight_records.sql
-- R1.07: 重建 flight_records，并把 flight_positions / flight_alerts 挂到履约架次记录
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS flight_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    flight_no VARCHAR(50) NOT NULL COMMENT '飞行记录编号',
    order_id BIGINT NOT NULL COMMENT '对应订单ID',
    dispatch_task_id BIGINT NULL COMMENT '对应正式派单ID',
    pilot_user_id BIGINT NOT NULL DEFAULT 0 COMMENT '执行飞手账号ID',
    drone_id BIGINT NOT NULL COMMENT '执行设备ID',
    takeoff_at DATETIME NULL COMMENT '起飞时间',
    landing_at DATETIME NULL COMMENT '降落时间',
    total_duration_seconds INT NOT NULL DEFAULT 0 COMMENT '飞行总时长(秒)',
    total_distance_m DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '飞行总距离(米)',
    max_altitude_m DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最大高度(米)',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, executing, completed, aborted',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_flight_records_flight_no (flight_no),
    KEY idx_flight_records_order_id (order_id),
    KEY idx_flight_records_dispatch_task_id (dispatch_task_id),
    KEY idx_flight_records_pilot_user_id (pilot_user_id),
    KEY idx_flight_records_drone_id (drone_id),
    KEY idx_flight_records_status (status),
    KEY idx_flight_records_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单履约飞行记录表';

SET @has_flight_positions_record_col := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_positions'
      AND COLUMN_NAME = 'flight_record_id'
);
SET @sql := IF(
    @has_flight_positions_record_col = 0,
    'ALTER TABLE flight_positions ADD COLUMN flight_record_id BIGINT NULL COMMENT ''对应飞行记录ID'' AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_flight_alerts_record_col := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_alerts'
      AND COLUMN_NAME = 'flight_record_id'
);
SET @sql := IF(
    @has_flight_alerts_record_col = 0,
    'ALTER TABLE flight_alerts ADD COLUMN flight_record_id BIGINT NULL COMMENT ''对应飞行记录ID'' AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_positions_record := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_positions'
      AND INDEX_NAME = 'idx_flight_positions_record_id'
);
SET @sql := IF(
    @has_idx_positions_record = 0,
    'ALTER TABLE flight_positions ADD INDEX idx_flight_positions_record_id (flight_record_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_alerts_record := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_alerts'
      AND INDEX_NAME = 'idx_flight_alerts_record_id'
);
SET @sql := IF(
    @has_idx_alerts_record = 0,
    'ALTER TABLE flight_alerts ADD INDEX idx_flight_alerts_record_id (flight_record_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 第一类回填：以订单执行与位置点为依据，重建每个历史订单的首个履约飞行记录。


-- ===== extracted from 108_create_migration_mapping_tables.sql =====

-- 108_create_migration_mapping_tables.sql
-- R1.08: 建立迁移映射表与迁移审计表，集中记录旧表 -> 新表映射，以及不确定数据的审计清单
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS migration_entity_mappings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    legacy_table VARCHAR(100) NOT NULL COMMENT '旧表名',
    legacy_id VARCHAR(100) NOT NULL COMMENT '旧记录ID',
    new_table VARCHAR(100) NOT NULL COMMENT '新表名',
    new_id VARCHAR(100) NOT NULL COMMENT '新记录ID',
    mapping_type VARCHAR(20) NOT NULL DEFAULT 'migrated' COMMENT 'migrated, merged, derived',
    mapping_note VARCHAR(255) DEFAULT '' COMMENT '映射说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_migration_entity_mapping (legacy_table, legacy_id, new_table, new_id),
    KEY idx_migration_entity_legacy (legacy_table, legacy_id),
    KEY idx_migration_entity_new (new_table, new_id),
    KEY idx_migration_entity_mapping_type (mapping_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='迁移实体映射表';

CREATE TABLE IF NOT EXISTS migration_audit_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    audit_stage VARCHAR(50) NOT NULL COMMENT '审计阶段',
    legacy_table VARCHAR(100) NOT NULL COMMENT '旧表名',
    legacy_id VARCHAR(100) NOT NULL DEFAULT '' COMMENT '旧记录ID',
    related_table VARCHAR(100) NOT NULL DEFAULT '' COMMENT '关联新表名',
    related_id VARCHAR(100) NOT NULL DEFAULT '' COMMENT '关联新记录ID',
    issue_type VARCHAR(50) NOT NULL COMMENT '问题类型',
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' COMMENT 'info, warning, critical',
    issue_message TEXT NOT NULL COMMENT '问题描述',
    payload_json JSON NULL COMMENT '补充上下文',
    resolution_status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open, resolved, ignored',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_migration_audit_issue (audit_stage, legacy_table, legacy_id, related_table, related_id, issue_type),
    KEY idx_migration_audit_legacy (legacy_table, legacy_id),
    KEY idx_migration_audit_related (related_table, related_id),
    KEY idx_migration_audit_issue_type (issue_type),
    KEY idx_migration_audit_resolution_status (resolution_status),
    KEY idx_migration_audit_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='迁移审计记录表';

-- ==================== 关键映射回填 ====================



-- ===== extracted from 109_add_heavy_lift_threshold_rules.sql =====

-- 109_add_heavy_lift_threshold_rules.sql
-- R1.09: 落地平台重载准入字段与校验规则
-- 创建日期: 2026-03-13

SET @has_drones_mtow_kg := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drones' AND COLUMN_NAME = 'mtow_kg'
);
SET @sql := IF(@has_drones_mtow_kg = 0, 'ALTER TABLE drones ADD COLUMN mtow_kg DECIMAL(10,2) DEFAULT 0 COMMENT ''最大起飞重量(kg)'' AFTER serial_number', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_drones_max_payload_kg := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drones' AND COLUMN_NAME = 'max_payload_kg'
);
SET @sql := IF(@has_drones_max_payload_kg = 0, 'ALTER TABLE drones ADD COLUMN max_payload_kg DECIMAL(10,2) DEFAULT 0 COMMENT ''最大载重能力(kg)'' AFTER mtow_kg', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_drones_mtow_kg := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drones' AND INDEX_NAME = 'idx_drones_mtow_kg'
);
SET @sql := IF(@has_idx_drones_mtow_kg = 0, 'ALTER TABLE drones ADD INDEX idx_drones_mtow_kg (mtow_kg)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx_drones_max_payload_kg := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drones' AND INDEX_NAME = 'idx_drones_max_payload_kg'
);
SET @sql := IF(@has_idx_drones_max_payload_kg = 0, 'ALTER TABLE drones ADD INDEX idx_drones_max_payload_kg (max_payload_kg)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 历史兼容：若尚未填写 max_payload_kg，则沿用 legacy max_load
