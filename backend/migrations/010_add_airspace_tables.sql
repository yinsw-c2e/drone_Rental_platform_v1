-- 010: 空域管理与合规系统
-- 创建空域申请、禁飞区和合规检查相关表

-- 空域申请表
CREATE TABLE IF NOT EXISTS airspace_applications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT,
    pilot_id BIGINT NOT NULL,
    drone_id BIGINT,

    -- 飞行计划
    flight_plan_name VARCHAR(200) NOT NULL,
    flight_purpose VARCHAR(50) NOT NULL COMMENT 'cargo_delivery,agriculture,mapping,inspection,training,emergency,other',
    flight_type VARCHAR(30) DEFAULT 'VLOS' COMMENT 'VLOS,BVLOS,EVLOS',

    -- 航线规划
    departure_latitude DECIMAL(10,7) NOT NULL,
    departure_longitude DECIMAL(10,7) NOT NULL,
    departure_address VARCHAR(255),
    arrival_latitude DECIMAL(10,7) NOT NULL,
    arrival_longitude DECIMAL(10,7) NOT NULL,
    arrival_address VARCHAR(255),
    waypoints JSON,
    flight_area JSON,

    -- 飞行参数
    planned_altitude INT NOT NULL,
    max_altitude INT NOT NULL,
    planned_speed DECIMAL(6,2),
    estimated_distance DECIMAL(10,2),
    estimated_duration INT,
    cargo_weight DECIMAL(10,2),

    -- 时间窗口
    planned_start_time DATETIME NOT NULL,
    planned_end_time DATETIME NOT NULL,

    -- UOM平台对接
    uom_application_no VARCHAR(100),
    uom_submitted_at DATETIME,
    uom_response_at DATETIME,
    uom_approval_code VARCHAR(100),

    -- 审批状态
    status VARCHAR(30) DEFAULT 'draft' COMMENT 'draft,pending_review,submitted_to_uom,approved,rejected,expired,cancelled',
    reviewed_by BIGINT DEFAULT 0,
    reviewed_at DATETIME,
    review_notes TEXT,
    rejection_code VARCHAR(50),

    -- 合规检查
    compliance_check_id BIGINT DEFAULT 0,
    compliance_passed TINYINT(1) DEFAULT 0,
    compliance_notes TEXT,

    -- 附件
    flight_plan_doc VARCHAR(500),
    supporting_docs JSON,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_airspace_order (order_id),
    INDEX idx_airspace_pilot (pilot_id),
    INDEX idx_airspace_drone (drone_id),
    INDEX idx_airspace_status (status),
    INDEX idx_airspace_uom_no (uom_application_no),
    INDEX idx_airspace_time (planned_start_time, planned_end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 禁飞区/限飞区表
CREATE TABLE IF NOT EXISTS no_fly_zones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    zone_type VARCHAR(30) NOT NULL COMMENT 'airport,military,restricted,temporary,nature_reserve,government',

    -- 区域定义
    geometry_type VARCHAR(20) NOT NULL COMMENT 'circle,polygon',
    center_latitude DECIMAL(10,7),
    center_longitude DECIMAL(10,7),
    radius INT COMMENT '半径(米)',
    coordinates JSON COMMENT '多边形坐标',

    -- 高度限制
    min_altitude INT DEFAULT 0,
    max_altitude INT DEFAULT 0 COMMENT '0表示全高度禁飞',

    -- 生效时间
    effective_from DATETIME,
    effective_to DATETIME,
    is_permanent TINYINT(1) DEFAULT 0,

    -- 来源信息
    source VARCHAR(50) DEFAULT 'caac' COMMENT 'caac,military,local_gov,platform',
    external_id VARCHAR(100),
    authority VARCHAR(200),

    -- 限制规则
    restriction_level VARCHAR(30) DEFAULT 'no_fly' COMMENT 'no_fly,restricted,caution',
    allowed_with_permit TINYINT(1) DEFAULT 0,
    permit_authority VARCHAR(200),

    description TEXT,
    status VARCHAR(20) DEFAULT 'active' COMMENT 'active,inactive,expired',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_nfz_type (zone_type),
    INDEX idx_nfz_status (status),
    INDEX idx_nfz_center (center_latitude, center_longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 合规检查记录表
CREATE TABLE IF NOT EXISTS compliance_checks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT DEFAULT 0,
    pilot_id BIGINT NOT NULL,
    drone_id BIGINT NOT NULL,
    airspace_application_id BIGINT DEFAULT 0,

    trigger_type VARCHAR(30) NOT NULL COMMENT 'pre_flight,airspace_apply,periodic,manual',
    checked_by VARCHAR(30) DEFAULT 'system',

    -- 总体结果
    overall_result VARCHAR(20) NOT NULL COMMENT 'passed,failed,warning,pending',
    total_items INT DEFAULT 0,
    passed_items INT DEFAULT 0,
    failed_items INT DEFAULT 0,
    warning_items INT DEFAULT 0,

    -- 各项摘要
    pilot_compliance VARCHAR(20),
    drone_compliance VARCHAR(20),
    cargo_compliance VARCHAR(20),
    airspace_compliance VARCHAR(20),
    weather_compliance VARCHAR(20),

    notes TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_cc_order (order_id),
    INDEX idx_cc_pilot (pilot_id),
    INDEX idx_cc_drone (drone_id),
    INDEX idx_cc_airspace (airspace_application_id),
    INDEX idx_cc_result (overall_result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 合规检查明细项表
CREATE TABLE IF NOT EXISTS compliance_check_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    compliance_check_id BIGINT NOT NULL,

    category VARCHAR(30) NOT NULL COMMENT 'pilot,drone,cargo,airspace,weather',
    check_code VARCHAR(50) NOT NULL,
    check_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),

    result VARCHAR(20) NOT NULL COMMENT 'passed,failed,warning,skipped',
    severity VARCHAR(20) DEFAULT 'error',
    expected_value VARCHAR(255),
    actual_value VARCHAR(255),
    message TEXT,

    is_required TINYINT(1) DEFAULT 1,
    is_blocking TINYINT(1) DEFAULT 1,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_cci_check (compliance_check_id),
    INDEX idx_cci_category (category),
    INDEX idx_cci_result (result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入一些示例禁飞区数据
INSERT INTO no_fly_zones (name, zone_type, geometry_type, center_latitude, center_longitude, radius, min_altitude, max_altitude, is_permanent, source, authority, restriction_level, description, status) VALUES
('成都双流国际机场', 'airport', 'circle', 30.578528, 103.947084, 8000, 0, 0, 1, 'caac', '中国民用航空局', 'no_fly', '成都双流国际机场净空保护区，半径8公里内全高度禁飞', 'active'),
('成都天府国际机场', 'airport', 'circle', 30.308455, 104.441100, 8000, 0, 0, 1, 'caac', '中国民用航空局', 'no_fly', '成都天府国际机场净空保护区，半径8公里内全高度禁飞', 'active'),
('天安门广场', 'government', 'circle', 39.908722, 116.397499, 3000, 0, 0, 1, 'local_gov', '北京市公安局', 'no_fly', '天安门广场及周边区域禁飞', 'active'),
('成都大熊猫繁育研究基地', 'nature_reserve', 'circle', 30.735434, 104.145138, 2000, 0, 300, 1, 'local_gov', '成都市林业和园林管理局', 'restricted', '大熊猫基地上空300米以下限飞', 'active');
