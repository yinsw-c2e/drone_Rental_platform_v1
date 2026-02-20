-- 无人机租赁平台数据库初始化脚本
-- Database: wurenji

CREATE DATABASE IF NOT EXISTS wurenji DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wurenji;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    nickname VARCHAR(50) NOT NULL DEFAULT '',
    avatar_url VARCHAR(500) NOT NULL DEFAULT '',
    user_type VARCHAR(20) NOT NULL DEFAULT 'renter',
    id_card_no VARCHAR(255) NOT NULL DEFAULT '',
    id_verified VARCHAR(20) NOT NULL DEFAULT 'pending',
    credit_score INT NOT NULL DEFAULT 100,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    UNIQUE INDEX idx_phone (phone),
    INDEX idx_user_type (user_type),
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 无人机表
CREATE TABLE IF NOT EXISTS drones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    brand VARCHAR(100) NOT NULL DEFAULT '',
    model VARCHAR(100) NOT NULL DEFAULT '',
    serial_number VARCHAR(100) NOT NULL DEFAULT '',
    max_load DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_flight_time INT NOT NULL DEFAULT 0,
    max_distance DECIMAL(10,2) NOT NULL DEFAULT 0,
    features JSON,
    images JSON,
    certification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    certification_docs JSON,
    daily_price BIGINT NOT NULL DEFAULT 0,
    hourly_price BIGINT NOT NULL DEFAULT 0,
    deposit BIGINT NOT NULL DEFAULT 0,
    latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    address VARCHAR(255) NOT NULL DEFAULT '',
    city VARCHAR(50) NOT NULL DEFAULT '',
    availability_status VARCHAR(20) NOT NULL DEFAULT 'available',
    rating DECIMAL(3,2) NOT NULL DEFAULT 0,
    order_count INT NOT NULL DEFAULT 0,
    description TEXT,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    UNIQUE INDEX idx_serial_number (serial_number),
    INDEX idx_owner_id (owner_id),
    INDEX idx_city (city),
    INDEX idx_certification_status (certification_status),
    INDEX idx_availability_status (availability_status),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 租赁供给表
CREATE TABLE IF NOT EXISTS rental_offers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    drone_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    service_type VARCHAR(30) NOT NULL DEFAULT 'rental',
    available_from DATETIME NOT NULL,
    available_to DATETIME NOT NULL,
    latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    address VARCHAR(255) NOT NULL DEFAULT '',
    service_radius DECIMAL(10,2) NOT NULL DEFAULT 50,
    price_type VARCHAR(20) NOT NULL DEFAULT 'daily',
    price BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    views INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    INDEX idx_drone_id (drone_id),
    INDEX idx_owner_id (owner_id),
    INDEX idx_status (status),
    INDEX idx_service_type (service_type),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 租赁需求表
CREATE TABLE IF NOT EXISTS rental_demands (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    renter_id BIGINT NOT NULL,
    demand_type VARCHAR(30) NOT NULL DEFAULT 'rental',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    required_features JSON,
    required_load DECIMAL(10,2) NOT NULL DEFAULT 0,
    latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    address VARCHAR(255) NOT NULL DEFAULT '',
    city VARCHAR(50) NOT NULL DEFAULT '',
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    budget_min BIGINT NOT NULL DEFAULT 0,
    budget_max BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    urgency VARCHAR(20) NOT NULL DEFAULT 'medium',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    INDEX idx_renter_id (renter_id),
    INDEX idx_demand_type (demand_type),
    INDEX idx_status (status),
    INDEX idx_city (city),
    INDEX idx_urgency (urgency),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 货运需求表
CREATE TABLE IF NOT EXISTS cargo_demands (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    publisher_id BIGINT NOT NULL,
    cargo_type VARCHAR(30) NOT NULL DEFAULT 'package',
    cargo_weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    cargo_size JSON,
    cargo_description TEXT,
    pickup_latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    pickup_longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    pickup_address VARCHAR(255) NOT NULL DEFAULT '',
    delivery_latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    delivery_longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    delivery_address VARCHAR(255) NOT NULL DEFAULT '',
    distance DECIMAL(10,2) NOT NULL DEFAULT 0,
    pickup_time DATETIME NOT NULL,
    delivery_deadline DATETIME NULL,
    offered_price BIGINT NOT NULL DEFAULT 0,
    special_requirements TEXT,
    images JSON,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    INDEX idx_publisher_id (publisher_id),
    INDEX idx_cargo_type (cargo_type),
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(30) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    related_id BIGINT NOT NULL DEFAULT 0,
    drone_id BIGINT NOT NULL DEFAULT 0,
    owner_id BIGINT NOT NULL DEFAULT 0,
    renter_id BIGINT NOT NULL DEFAULT 0,
    title VARCHAR(200) NOT NULL DEFAULT '',
    service_type VARCHAR(30) NOT NULL DEFAULT '',
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    service_latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    service_longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
    service_address VARCHAR(255) NOT NULL DEFAULT '',
    total_amount BIGINT NOT NULL DEFAULT 0,
    platform_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    platform_commission BIGINT NOT NULL DEFAULT 0,
    owner_amount BIGINT NOT NULL DEFAULT 0,
    deposit_amount BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    cancel_reason TEXT,
    cancel_by VARCHAR(20) NOT NULL DEFAULT '',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted_at DATETIME(3) NULL,
    UNIQUE INDEX idx_order_no (order_no),
    INDEX idx_drone_id (drone_id),
    INDEX idx_owner_id (owner_id),
    INDEX idx_renter_id (renter_id),
    INDEX idx_status (status),
    INDEX idx_order_type (order_type),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订单时间线表
CREATE TABLE IF NOT EXISTS order_timelines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    note TEXT,
    operator_id BIGINT NOT NULL DEFAULT 0,
    operator_type VARCHAR(20) NOT NULL DEFAULT 'system',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 支付记录表
CREATE TABLE IF NOT EXISTS payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_no VARCHAR(50) NOT NULL,
    order_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    payment_type VARCHAR(20) NOT NULL DEFAULT 'order',
    payment_method VARCHAR(20) NOT NULL DEFAULT 'mock',
    amount BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    third_party_no VARCHAR(100) NOT NULL DEFAULT '',
    paid_at DATETIME NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX idx_payment_no (payment_no),
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(50) NOT NULL,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    content TEXT,
    extra_data JSON,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_receiver_id (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 评价表
CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    reviewer_id BIGINT NOT NULL,
    reviewee_id BIGINT NOT NULL,
    review_type VARCHAR(30) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL DEFAULT 0,
    rating TINYINT NOT NULL DEFAULT 5,
    content TEXT,
    images JSON,
    tags JSON,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_order_id (order_id),
    INDEX idx_reviewer_id (reviewer_id),
    INDEX idx_reviewee_id (reviewee_id),
    INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 匹配记录表
CREATE TABLE IF NOT EXISTS matching_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    demand_id BIGINT NOT NULL,
    demand_type VARCHAR(30) NOT NULL,
    supply_id BIGINT NOT NULL DEFAULT 0,
    supply_type VARCHAR(30) NOT NULL DEFAULT '',
    match_score INT NOT NULL DEFAULT 0,
    match_reason JSON,
    status VARCHAR(20) NOT NULL DEFAULT 'recommended',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_demand (demand_id, demand_type),
    INDEX idx_supply (supply_id, supply_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    description VARCHAR(255) NOT NULL DEFAULT '',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50) NOT NULL DEFAULT '',
    target_type VARCHAR(50) NOT NULL DEFAULT '',
    target_id BIGINT NOT NULL DEFAULT 0,
    details JSON,
    ip_address VARCHAR(50) NOT NULL DEFAULT '',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('platform_commission_rate', '10', '平台佣金比例(%)'),
('payment_timeout', '1800', '支付超时时间(秒)'),
('order_accept_timeout', '1800', '订单接受超时时间(秒)'),
('matching_radius', '50', '匹配搜索半径(km)'),
('matching_top_n', '10', '匹配推荐数量')
ON DUPLICATE KEY UPDATE config_key = config_key;

-- 插入默认管理员账号 (密码: admin123)
INSERT INTO users (phone, password_hash, nickname, user_type, id_verified, status) VALUES
('13800000000', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', 'admin', 'approved', 'active')
ON DUPLICATE KEY UPDATE phone = phone;
