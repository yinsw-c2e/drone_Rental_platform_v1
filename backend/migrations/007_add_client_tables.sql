-- 任务1.4: 业主角色整合与增强 - 数据库迁移
-- 创建业主相关表：clients, client_credit_checks, client_enterprise_certs, cargo_declarations

-- ==================== 客户/业主档案表 ====================
CREATE TABLE IF NOT EXISTS clients (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    client_type VARCHAR(20) DEFAULT 'individual' COMMENT '客户类型: individual(个人), enterprise(企业)',
    company_name VARCHAR(200) DEFAULT '' COMMENT '企业名称',
    business_license_no VARCHAR(100) DEFAULT '' COMMENT '统一社会信用代码',
    business_license_doc VARCHAR(500) DEFAULT '' COMMENT '营业执照照片',
    legal_representative VARCHAR(50) DEFAULT '' COMMENT '法定代表人',
    contact_person VARCHAR(50) DEFAULT '' COMMENT '联系人',
    contact_phone VARCHAR(20) DEFAULT '' COMMENT '联系电话',
    contact_email VARCHAR(100) DEFAULT '' COMMENT '联系邮箱',

    -- 征信信息
    credit_provider VARCHAR(50) DEFAULT '' COMMENT '征信来源: baihang(百行征信), sesame(芝麻信用)',
    credit_score INT DEFAULT 600 COMMENT '外部征信分',
    credit_check_status VARCHAR(20) DEFAULT 'pending' COMMENT '征信状态: pending, approved, rejected',
    credit_check_time DATETIME NULL COMMENT '征信查询时间',
    credit_report_doc VARCHAR(500) DEFAULT '' COMMENT '征信报告',
    platform_credit_score INT DEFAULT 600 COMMENT '平台内部信用分(满分1000)',

    -- 企业资质
    enterprise_verified VARCHAR(20) DEFAULT 'pending' COMMENT '企业认证状态: pending, verified, rejected',
    enterprise_verified_at DATETIME NULL COMMENT '企业认证时间',
    enterprise_verify_note TEXT COMMENT '认证备注',
    industry_category VARCHAR(100) DEFAULT '' COMMENT '行业类别',
    registration_capital BIGINT DEFAULT 0 COMMENT '注册资本(分)',
    operating_years INT DEFAULT 0 COMMENT '经营年限',
    special_qualifications JSON COMMENT '特殊资质',

    -- 服务偏好
    preferred_cargo_types JSON COMMENT '常用货物类型',
    preferred_routes JSON COMMENT '常用路线',
    default_pickup_address VARCHAR(255) DEFAULT '' COMMENT '默认取货地址',
    default_delivery_address VARCHAR(255) DEFAULT '' COMMENT '默认送货地址',

    -- 统计信息
    total_orders INT DEFAULT 0 COMMENT '总订单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    cancelled_orders INT DEFAULT 0 COMMENT '取消订单数',
    total_spending BIGINT DEFAULT 0 COMMENT '总消费金额(分)',
    average_rating DECIMAL(3,2) DEFAULT 5.0 COMMENT '被评平均分',

    -- 状态信息
    verification_status VARCHAR(20) DEFAULT 'pending' COMMENT '认证状态: pending, verified, rejected',
    verification_note TEXT COMMENT '认证备注',
    verified_at DATETIME NULL COMMENT '认证时间',
    status VARCHAR(20) DEFAULT 'active' COMMENT '账户状态: active, suspended, banned',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_clients_user_id (user_id),
    INDEX idx_clients_client_type (client_type),
    INDEX idx_clients_business_license_no (business_license_no),
    INDEX idx_clients_credit_check_status (credit_check_status),
    INDEX idx_clients_enterprise_verified (enterprise_verified),
    INDEX idx_clients_verification_status (verification_status),
    INDEX idx_clients_status (status),
    INDEX idx_clients_deleted_at (deleted_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业主/客户档案表';

-- ==================== 征信查询记录表 ====================
CREATE TABLE IF NOT EXISTS client_credit_checks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id BIGINT NOT NULL,
    check_provider VARCHAR(50) NOT NULL COMMENT '查询来源: baihang(百行征信), sesame(芝麻信用), internal(内部)',
    check_type VARCHAR(30) NOT NULL COMMENT '查询类型: pre_order(订单前), periodic(定期), manual(人工)',
    request_id VARCHAR(100) DEFAULT '' COMMENT '查询请求ID',
    credit_score INT DEFAULT 0 COMMENT '信用分',
    credit_level VARCHAR(20) DEFAULT '' COMMENT '信用等级: excellent, good, fair, poor',
    risk_level VARCHAR(20) DEFAULT '' COMMENT '风险等级: low, medium, high',
    overdue TINYINT(1) DEFAULT 0 COMMENT '是否有逾期记录',
    overdue_amount BIGINT DEFAULT 0 COMMENT '逾期金额(分)',
    overdue_count INT DEFAULT 0 COMMENT '逾期次数',
    report_summary JSON COMMENT '报告摘要',
    raw_response JSON COMMENT '原始响应数据',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '查询状态: pending, success, failed',
    error_message TEXT COMMENT '错误信息',
    cost_amount BIGINT DEFAULT 0 COMMENT '查询费用(分)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_client_credit_checks_client_id (client_id),
    INDEX idx_client_credit_checks_provider (check_provider),
    INDEX idx_client_credit_checks_status (status),
    INDEX idx_client_credit_checks_created_at (created_at),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='征信查询记录表';

-- ==================== 企业资质证书表 ====================
CREATE TABLE IF NOT EXISTS client_enterprise_certs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id BIGINT NOT NULL,
    cert_type VARCHAR(50) NOT NULL COMMENT '证书类型: business_license, hazmat_permit, food_license等',
    cert_name VARCHAR(100) DEFAULT '' COMMENT '证书名称',
    cert_no VARCHAR(100) DEFAULT '' COMMENT '证书编号',
    issuing_authority VARCHAR(100) DEFAULT '' COMMENT '发证机构',
    issue_date DATE NULL COMMENT '发证日期',
    expire_date DATE NULL COMMENT '有效期至',
    cert_image VARCHAR(500) DEFAULT '' COMMENT '证书图片',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending, approved, rejected, expired',
    review_note TEXT COMMENT '审核备注',
    reviewed_at DATETIME NULL COMMENT '审核时间',
    reviewed_by BIGINT DEFAULT 0 COMMENT '审核人ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_client_enterprise_certs_client_id (client_id),
    INDEX idx_client_enterprise_certs_cert_type (cert_type),
    INDEX idx_client_enterprise_certs_status (status),
    INDEX idx_client_enterprise_certs_expire_date (expire_date),
    INDEX idx_client_enterprise_certs_deleted_at (deleted_at),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='企业资质证书表';

-- ==================== 货物申报表 ====================
CREATE TABLE IF NOT EXISTS cargo_declarations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id BIGINT NOT NULL,
    order_id BIGINT DEFAULT 0 COMMENT '关联订单ID',
    declaration_no VARCHAR(50) NOT NULL UNIQUE COMMENT '申报单号',
    cargo_category VARCHAR(50) NOT NULL COMMENT '货物类别: normal, valuable, fragile, hazardous, perishable, medical',
    cargo_name VARCHAR(200) NOT NULL COMMENT '货物名称',
    cargo_description TEXT COMMENT '货物描述',
    quantity INT DEFAULT 1 COMMENT '数量',
    total_weight DECIMAL(10,2) DEFAULT 0 COMMENT '总重量(kg)',
    length DECIMAL(10,2) DEFAULT 0 COMMENT '长(cm)',
    width DECIMAL(10,2) DEFAULT 0 COMMENT '宽(cm)',
    height DECIMAL(10,2) DEFAULT 0 COMMENT '高(cm)',
    declared_value BIGINT DEFAULT 0 COMMENT '申报价值(分)',

    -- 特殊货物信息
    is_hazardous TINYINT(1) DEFAULT 0 COMMENT '是否危险品',
    hazard_class VARCHAR(20) DEFAULT '' COMMENT '危险品类别',
    un_number VARCHAR(20) DEFAULT '' COMMENT 'UN编号',
    hazmat_permit_no VARCHAR(100) DEFAULT '' COMMENT '危化品运输许可证号',
    is_temperature_control TINYINT(1) DEFAULT 0 COMMENT '是否需要温控',
    temperature_min DECIMAL(5,2) DEFAULT 0 COMMENT '最低温度要求',
    temperature_max DECIMAL(5,2) DEFAULT 0 COMMENT '最高温度要求',
    is_moisture_sensitive TINYINT(1) DEFAULT 0 COMMENT '是否怕潮',
    requires_insurance TINYINT(1) DEFAULT 0 COMMENT '是否需要保价',
    insurance_amount BIGINT DEFAULT 0 COMMENT '保价金额(分)',

    -- 合规检查
    compliance_status VARCHAR(20) DEFAULT 'pending' COMMENT '合规状态: pending, approved, rejected',
    compliance_note TEXT COMMENT '合规备注',
    compliance_checked_at DATETIME NULL COMMENT '合规检查时间',
    compliance_checked_by BIGINT DEFAULT 0 COMMENT '检查人ID',

    -- 附件
    cargo_images JSON COMMENT '货物照片',
    packing_images JSON COMMENT '包装照片',
    supporting_docs JSON COMMENT '证明文件',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_cargo_declarations_client_id (client_id),
    INDEX idx_cargo_declarations_order_id (order_id),
    INDEX idx_cargo_declarations_declaration_no (declaration_no),
    INDEX idx_cargo_declarations_cargo_category (cargo_category),
    INDEX idx_cargo_declarations_compliance_status (compliance_status),
    INDEX idx_cargo_declarations_is_hazardous (is_hazardous),
    INDEX idx_cargo_declarations_deleted_at (deleted_at),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='货物申报表';

-- ==================== 更新 users 表 user_type 字段说明 ====================
-- user_type 现支持值: pilot, drone_owner, client, admin
-- 其中 client 角色整合了原 renter 和 cargo_owner 角色

-- ==================== 更新 orders 表添加 client_id 字段 ====================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_id BIGINT DEFAULT 0 COMMENT '业主ID' AFTER renter_id;
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_client_id (client_id);

-- ==================== 更新 cargo_demands 表添加 client_id 字段 ====================
ALTER TABLE cargo_demands ADD COLUMN IF NOT EXISTS client_id BIGINT DEFAULT 0 COMMENT '业主ID' AFTER publisher_id;
ALTER TABLE cargo_demands ADD INDEX IF NOT EXISTS idx_cargo_demands_client_id (client_id);

-- ==================== 更新 rental_demands 表添加 client_id 字段 ====================
ALTER TABLE rental_demands ADD COLUMN IF NOT EXISTS client_id BIGINT DEFAULT 0 COMMENT '业主ID' AFTER renter_id;
ALTER TABLE rental_demands ADD INDEX IF NOT EXISTS idx_rental_demands_client_id (client_id);
