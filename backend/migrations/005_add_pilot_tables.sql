-- 005_add_pilot_tables.sql
-- 飞手角色数据模型迁移
-- 创建日期: 2026-03-01

-- ==================== 飞手档案表 ====================
CREATE TABLE IF NOT EXISTS pilots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联users表',
    caac_license_no VARCHAR(50) COMMENT 'CAAC执照号',
    caac_license_type VARCHAR(30) COMMENT '执照类型: VLOS(视距内), BVLOS(超视距), instructor(教员)',
    caac_license_expire_date DATETIME COMMENT 'CAAC执照有效期',
    caac_license_image VARCHAR(500) COMMENT 'CAAC执照照片',
    criminal_check_status VARCHAR(20) DEFAULT 'pending' COMMENT '无犯罪记录审核状态: pending, approved, rejected',
    criminal_check_doc VARCHAR(500) COMMENT '无犯罪记录证明文件',
    criminal_check_expire DATETIME COMMENT '无犯罪记录有效期',
    health_check_status VARCHAR(20) DEFAULT 'pending' COMMENT '健康体检状态: pending, approved, rejected',
    health_check_doc VARCHAR(500) COMMENT '健康体检证明文件',
    health_check_expire DATETIME COMMENT '健康证明有效期',
    total_flight_hours DECIMAL(10,2) DEFAULT 0 COMMENT '累计飞行小时数',
    total_orders INT DEFAULT 0 COMMENT '累计订单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    service_rating DECIMAL(3,2) DEFAULT 5.0 COMMENT '服务评分',
    credit_score INT DEFAULT 500 COMMENT '飞手信用分(满分1000)',
    availability_status VARCHAR(20) DEFAULT 'offline' COMMENT '接单状态: online, busy, offline',
    current_latitude DECIMAL(10,7) COMMENT '当前纬度',
    current_longitude DECIMAL(10,7) COMMENT '当前经度',
    current_city VARCHAR(50) COMMENT '当前所在城市',
    service_radius DECIMAL(10,2) DEFAULT 50 COMMENT '服务范围(公里)',
    special_skills JSON COMMENT '特殊技能: 夜航、山区、应急等',
    verification_status VARCHAR(20) DEFAULT 'pending' COMMENT '认证状态: pending, verified, rejected',
    verification_note TEXT COMMENT '认证备注',
    verified_at DATETIME COMMENT '认证通过时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    INDEX idx_pilots_user_id (user_id),
    INDEX idx_pilots_caac_license_no (caac_license_no),
    INDEX idx_pilots_current_city (current_city),
    INDEX idx_pilots_availability_status (availability_status),
    INDEX idx_pilots_verification_status (verification_status),
    INDEX idx_pilots_deleted_at (deleted_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='飞手档案表';

-- ==================== 飞手资质证书表 ====================
CREATE TABLE IF NOT EXISTS pilot_certifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pilot_id BIGINT NOT NULL COMMENT '飞手ID',
    cert_type VARCHAR(50) NOT NULL COMMENT '证书类型: caac_license, training, emergency, special_operation',
    cert_name VARCHAR(100) COMMENT '证书名称',
    cert_no VARCHAR(100) COMMENT '证书编号',
    issuing_authority VARCHAR(100) COMMENT '发证机构',
    issue_date DATETIME COMMENT '发证日期',
    expire_date DATETIME COMMENT '有效期',
    cert_image VARCHAR(500) COMMENT '证书图片',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '审核状态: pending, approved, rejected, expired',
    review_note TEXT COMMENT '审核备注',
    reviewed_at DATETIME COMMENT '审核时间',
    reviewed_by BIGINT COMMENT '审核人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    INDEX idx_pilot_certs_pilot_id (pilot_id),
    INDEX idx_pilot_certs_cert_type (cert_type),
    INDEX idx_pilot_certs_status (status),
    INDEX idx_pilot_certs_deleted_at (deleted_at),
    
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='飞手资质证书表';

-- ==================== 飞手飞行记录表 ====================
CREATE TABLE IF NOT EXISTS pilot_flight_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pilot_id BIGINT NOT NULL COMMENT '飞手ID',
    order_id BIGINT COMMENT '关联订单ID(可为空,非平台飞行)',
    drone_id BIGINT COMMENT '无人机ID',
    flight_date DATETIME NOT NULL COMMENT '飞行日期',
    flight_duration DECIMAL(10,2) COMMENT '飞行时长(分钟)',
    flight_distance DECIMAL(10,2) COMMENT '飞行距离(公里)',
    start_latitude DECIMAL(10,7) COMMENT '起点纬度',
    start_longitude DECIMAL(10,7) COMMENT '起点经度',
    start_address VARCHAR(255) COMMENT '起点地址',
    end_latitude DECIMAL(10,7) COMMENT '终点纬度',
    end_longitude DECIMAL(10,7) COMMENT '终点经度',
    end_address VARCHAR(255) COMMENT '终点地址',
    max_altitude DECIMAL(10,2) COMMENT '最高飞行高度(米)',
    max_speed DECIMAL(10,2) COMMENT '最高速度(m/s)',
    cargo_weight DECIMAL(10,2) COMMENT '载货重量(kg)',
    weather_condition VARCHAR(50) COMMENT '天气状况',
    flight_type VARCHAR(30) COMMENT '飞行类型: cargo(货运), training(训练), test(测试)',
    incident_report TEXT COMMENT '异常情况记录',
    track_data JSON COMMENT '飞行轨迹数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_flight_logs_pilot_id (pilot_id),
    INDEX idx_flight_logs_order_id (order_id),
    INDEX idx_flight_logs_drone_id (drone_id),
    INDEX idx_flight_logs_flight_date (flight_date),
    INDEX idx_flight_logs_flight_type (flight_type),
    
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='飞手飞行记录表';

-- ==================== 飞手与无人机绑定关系表 ====================
CREATE TABLE IF NOT EXISTS pilot_drone_bindings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pilot_id BIGINT NOT NULL COMMENT '飞手ID',
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    owner_id BIGINT NOT NULL COMMENT '机主ID',
    binding_type VARCHAR(20) COMMENT '绑定类型: permanent(长期), temporary(临时)',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active, expired, revoked',
    effective_from DATETIME NOT NULL COMMENT '生效时间',
    effective_to DATETIME COMMENT '失效时间(临时绑定)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    INDEX idx_pilot_bindings_pilot_id (pilot_id),
    INDEX idx_pilot_bindings_drone_id (drone_id),
    INDEX idx_pilot_bindings_owner_id (owner_id),
    INDEX idx_pilot_bindings_status (status),
    INDEX idx_pilot_bindings_deleted_at (deleted_at),
    
    UNIQUE KEY uk_pilot_drone (pilot_id, drone_id, deleted_at),
    
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
    FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='飞手与无人机绑定关系表';

-- ==================== 订单表增加飞手ID字段 ====================
ALTER TABLE orders ADD COLUMN pilot_id BIGINT COMMENT '飞手ID' AFTER owner_id;
ALTER TABLE orders ADD INDEX idx_orders_pilot_id (pilot_id);

-- ==================== 订单时间线增加pilot操作类型 ====================
-- 修改operator_type字段注释，支持pilot类型
ALTER TABLE order_timelines MODIFY COLUMN operator_type VARCHAR(20) COMMENT '操作者类型: owner, renter, pilot, system, admin';
