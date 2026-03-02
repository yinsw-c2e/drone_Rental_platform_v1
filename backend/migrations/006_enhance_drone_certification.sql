-- 006_enhance_drone_certification.sql
-- 机主认证体系增强 - 增加UOM、保险、适航证书字段
-- 创建日期: 2026-03-01

-- ==================== 无人机表增强字段 ====================

-- UOM平台登记信息
ALTER TABLE drones ADD COLUMN uom_registration_no VARCHAR(100) COMMENT 'UOM平台登记号' AFTER description;
ALTER TABLE drones ADD COLUMN uom_verified VARCHAR(20) DEFAULT 'pending' COMMENT 'UOM验证状态: pending, verified, rejected' AFTER uom_registration_no;
ALTER TABLE drones ADD COLUMN uom_verified_at DATETIME COMMENT 'UOM验证通过时间' AFTER uom_verified;
ALTER TABLE drones ADD COLUMN uom_registration_doc VARCHAR(500) COMMENT 'UOM登记证明文件' AFTER uom_verified_at;

-- 保险信息
ALTER TABLE drones ADD COLUMN insurance_policy_no VARCHAR(100) COMMENT '保险单号' AFTER uom_registration_doc;
ALTER TABLE drones ADD COLUMN insurance_company VARCHAR(100) COMMENT '保险公司' AFTER insurance_policy_no;
ALTER TABLE drones ADD COLUMN insurance_coverage BIGINT DEFAULT 0 COMMENT '保额(分)，要求≥500万即50000000分' AFTER insurance_company;
ALTER TABLE drones ADD COLUMN insurance_expire_date DATETIME COMMENT '保险到期日' AFTER insurance_coverage;
ALTER TABLE drones ADD COLUMN insurance_doc VARCHAR(500) COMMENT '保险单文件' AFTER insurance_expire_date;
ALTER TABLE drones ADD COLUMN insurance_verified VARCHAR(20) DEFAULT 'pending' COMMENT '保险验证状态: pending, verified, rejected' AFTER insurance_doc;

-- 适航证书
ALTER TABLE drones ADD COLUMN airworthiness_cert_no VARCHAR(100) COMMENT '适航证书编号' AFTER insurance_verified;
ALTER TABLE drones ADD COLUMN airworthiness_cert_expire DATETIME COMMENT '适航证书有效期' AFTER airworthiness_cert_no;
ALTER TABLE drones ADD COLUMN airworthiness_cert_doc VARCHAR(500) COMMENT '适航证书文件' AFTER airworthiness_cert_expire;
ALTER TABLE drones ADD COLUMN airworthiness_verified VARCHAR(20) DEFAULT 'pending' COMMENT '适航验证状态: pending, verified, rejected' AFTER airworthiness_cert_doc;

-- 维护记录
ALTER TABLE drones ADD COLUMN last_maintenance_date DATETIME COMMENT '最近维护日期' AFTER airworthiness_verified;
ALTER TABLE drones ADD COLUMN next_maintenance_date DATETIME COMMENT '下次维护日期' AFTER last_maintenance_date;
ALTER TABLE drones ADD COLUMN maintenance_records JSON COMMENT '维护记录历史' AFTER next_maintenance_date;

-- 添加索引
ALTER TABLE drones ADD INDEX idx_drones_uom_registration_no (uom_registration_no);
ALTER TABLE drones ADD INDEX idx_drones_uom_verified (uom_verified);
ALTER TABLE drones ADD INDEX idx_drones_insurance_verified (insurance_verified);
ALTER TABLE drones ADD INDEX idx_drones_airworthiness_verified (airworthiness_verified);

-- ==================== 无人机维护记录表(可选，用于详细维护历史) ====================
CREATE TABLE IF NOT EXISTS drone_maintenance_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    maintenance_type VARCHAR(50) COMMENT '维护类型: routine(常规), repair(维修), upgrade(升级)',
    maintenance_date DATETIME NOT NULL COMMENT '维护日期',
    maintenance_content TEXT COMMENT '维护内容',
    maintenance_cost BIGINT DEFAULT 0 COMMENT '维护费用(分)',
    technician_name VARCHAR(100) COMMENT '维护技师',
    technician_cert VARCHAR(100) COMMENT '技师资质证号',
    parts_replaced JSON COMMENT '更换零件列表',
    before_images JSON COMMENT '维护前照片',
    after_images JSON COMMENT '维护后照片',
    report_doc VARCHAR(500) COMMENT '维护报告文件',
    next_maintenance_date DATETIME COMMENT '建议下次维护日期',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_maintenance_drone_id (drone_id),
    INDEX idx_maintenance_date (maintenance_date),
    INDEX idx_maintenance_type (maintenance_type),
    
    FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='无人机维护记录表';

-- ==================== 无人机保险记录表(用于保险历史和理赔) ====================
CREATE TABLE IF NOT EXISTS drone_insurance_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    owner_id BIGINT NOT NULL COMMENT '机主ID',
    insurance_type VARCHAR(50) COMMENT '险种: liability(第三者责任险), cargo(货物险), hull(机身险)',
    policy_no VARCHAR(100) COMMENT '保单号',
    insurance_company VARCHAR(100) COMMENT '保险公司',
    coverage_amount BIGINT COMMENT '保额(分)',
    premium BIGINT COMMENT '保费(分)',
    effective_from DATETIME COMMENT '保险生效日',
    effective_to DATETIME COMMENT '保险到期日',
    policy_doc VARCHAR(500) COMMENT '保单文件',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active, expired, cancelled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_insurance_drone_id (drone_id),
    INDEX idx_insurance_owner_id (owner_id),
    INDEX idx_insurance_policy_no (policy_no),
    INDEX idx_insurance_status (status),
    
    FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='无人机保险记录表';
