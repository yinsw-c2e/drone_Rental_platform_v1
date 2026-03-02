-- ============================================================
-- 阶段七：保险与理赔系统
-- 创建保险保单、理赔记录、理赔时间线、保险产品配置等表
-- ============================================================

-- 1. 保险保单表
CREATE TABLE IF NOT EXISTS insurance_policies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    policy_no VARCHAR(50) NOT NULL COMMENT '保单号',
    
    -- 保单类型
    policy_type VARCHAR(30) NOT NULL COMMENT 'liability(第三者责任险), cargo(货物险), hull(机身险), accident(飞手意外险)',
    policy_category VARCHAR(20) DEFAULT 'mandatory' COMMENT 'mandatory(强制), optional(可选)',
    
    -- 投保人信息
    holder_id BIGINT NOT NULL COMMENT '投保人ID',
    holder_type VARCHAR(20) NOT NULL COMMENT 'pilot, owner, client',
    holder_name VARCHAR(50) COMMENT '投保人姓名',
    holder_id_card VARCHAR(50) COMMENT '投保人身份证号(加密)',
    holder_phone VARCHAR(20) COMMENT '投保人电话',
    
    -- 被保险标的
    insured_type VARCHAR(20) COMMENT 'drone, cargo, person',
    insured_id BIGINT COMMENT '被保险标的ID',
    insured_name VARCHAR(100) COMMENT '被保险标的名称',
    insured_value BIGINT DEFAULT 0 COMMENT '标的价值(分)',
    
    -- 保险金额与费用
    coverage_amount BIGINT DEFAULT 0 COMMENT '保险金额/保额(分)',
    deductible_amount BIGINT DEFAULT 0 COMMENT '免赔额(分)',
    premium_rate DECIMAL(8,6) DEFAULT 0 COMMENT '费率',
    premium BIGINT DEFAULT 0 COMMENT '保费(分)',
    
    -- 保险公司信息
    insurer_code VARCHAR(20) COMMENT '保险公司代码',
    insurer_name VARCHAR(100) COMMENT '保险公司名称',
    insurance_product VARCHAR(100) COMMENT '保险产品名称',
    
    -- 保险期限
    effective_from DATETIME COMMENT '保险起期',
    effective_to DATETIME COMMENT '保险止期',
    insurance_days INT DEFAULT 0 COMMENT '保险天数',
    
    -- 状态管理
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, active, expired, cancelled, claimed',
    payment_status VARCHAR(20) DEFAULT 'unpaid' COMMENT 'unpaid, paid, refunded',
    payment_id BIGINT COMMENT '支付记录ID',
    paid_at DATETIME COMMENT '支付时间',
    
    -- 附加信息
    coverage_scope TEXT COMMENT '保障范围(JSON)',
    exclusions TEXT COMMENT '免责条款(JSON)',
    special_terms TEXT COMMENT '特别约定',
    attachments TEXT COMMENT '附件(JSON)',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    UNIQUE KEY uk_policy_no (policy_no),
    INDEX idx_holder_id (holder_id),
    INDEX idx_holder_type (holder_type),
    INDEX idx_policy_type (policy_type),
    INDEX idx_insured_id (insured_id),
    INDEX idx_status (status),
    INDEX idx_effective_dates (effective_from, effective_to),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保险保单表';

-- 2. 保险理赔表
CREATE TABLE IF NOT EXISTS insurance_claims (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_no VARCHAR(50) NOT NULL COMMENT '理赔单号',
    
    -- 关联信息
    policy_id BIGINT NOT NULL COMMENT '关联保单ID',
    policy_no VARCHAR(50) COMMENT '保单号',
    order_id BIGINT COMMENT '关联订单ID',
    
    -- 报案人信息
    claimant_id BIGINT NOT NULL COMMENT '报案人ID',
    claimant_name VARCHAR(50) COMMENT '报案人姓名',
    claimant_phone VARCHAR(20) COMMENT '报案人电话',
    
    -- 事故信息
    incident_type VARCHAR(30) NOT NULL COMMENT 'crash, collision, cargo_damage, cargo_loss, personal_injury, third_party',
    incident_time DATETIME COMMENT '事故发生时间',
    incident_location VARCHAR(255) COMMENT '事故地点',
    incident_lat DECIMAL(10,6) COMMENT '事故纬度',
    incident_lng DECIMAL(10,6) COMMENT '事故经度',
    incident_description TEXT COMMENT '事故描述',
    
    -- 损失信息
    loss_type VARCHAR(30) COMMENT 'property, personal, both',
    estimated_loss BIGINT DEFAULT 0 COMMENT '预估损失(分)',
    actual_loss BIGINT DEFAULT 0 COMMENT '实际损失(分)',
    
    -- 理赔金额
    claim_amount BIGINT DEFAULT 0 COMMENT '索赔金额(分)',
    approved_amount BIGINT DEFAULT 0 COMMENT '核定金额(分)',
    deducted_amount BIGINT DEFAULT 0 COMMENT '免赔额扣除(分)',
    paid_amount BIGINT DEFAULT 0 COMMENT '实际赔付(分)',
    
    -- 证据材料
    evidence_files TEXT COMMENT '证据文件(JSON)',
    police_report VARCHAR(255) COMMENT '公安报案回执',
    medical_report VARCHAR(255) COMMENT '医疗证明',
    repair_quote VARCHAR(255) COMMENT '维修报价单',
    other_documents TEXT COMMENT '其他证明材料(JSON)',
    
    -- 责任认定
    liability_ratio DECIMAL(5,2) DEFAULT 0 COMMENT '责任比例',
    liability_party VARCHAR(30) COMMENT 'pilot, owner, client, third_party, force_majeure',
    liability_reason TEXT COMMENT '责任认定理由',
    
    -- 流程状态
    status VARCHAR(20) DEFAULT 'reported' COMMENT 'reported, investigating, liability_determined, approved, rejected, paid, closed, disputed',
    current_step VARCHAR(30) COMMENT 'report, evidence, liability, approve, pay, close',
    
    -- 时间节点
    reported_at DATETIME COMMENT '报案时间',
    investigated_at DATETIME COMMENT '调查完成时间',
    determined_at DATETIME COMMENT '责任认定时间',
    approved_at DATETIME COMMENT '核赔时间',
    paid_at DATETIME COMMENT '赔付时间',
    closed_at DATETIME COMMENT '结案时间',
    
    -- 处理人员
    investigator_id BIGINT COMMENT '调查员ID',
    adjuster_id BIGINT COMMENT '核赔员ID',
    approver_id BIGINT COMMENT '审批人ID',
    
    -- 备注
    investigation_notes TEXT COMMENT '调查备注',
    adjustment_notes TEXT COMMENT '核赔备注',
    reject_reason TEXT COMMENT '拒赔原因',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    
    UNIQUE KEY uk_claim_no (claim_no),
    INDEX idx_policy_id (policy_id),
    INDEX idx_order_id (order_id),
    INDEX idx_claimant_id (claimant_id),
    INDEX idx_incident_type (incident_type),
    INDEX idx_status (status),
    INDEX idx_reported_at (reported_at),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保险理赔表';

-- 3. 理赔时间线表
CREATE TABLE IF NOT EXISTS claim_timelines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    claim_id BIGINT NOT NULL COMMENT '理赔单ID',
    action VARCHAR(50) NOT NULL COMMENT 'report, upload_evidence, investigate, determine_liability, approve, reject, pay, appeal, close',
    description VARCHAR(255) COMMENT '动作描述',
    operator_id BIGINT COMMENT '操作人ID',
    operator_type VARCHAR(20) COMMENT 'system, user, adjuster, admin',
    operator_name VARCHAR(50) COMMENT '操作人姓名',
    attachments TEXT COMMENT '附件(JSON)',
    remark TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_claim_id (claim_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='理赔时间线表';

-- 4. 保险产品配置表
CREATE TABLE IF NOT EXISTS insurance_products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_code VARCHAR(30) NOT NULL COMMENT '产品代码',
    product_name VARCHAR(100) NOT NULL COMMENT '产品名称',
    policy_type VARCHAR(30) NOT NULL COMMENT 'liability, cargo, hull, accident',
    insurer_code VARCHAR(20) COMMENT '保险公司代码',
    insurer_name VARCHAR(100) COMMENT '保险公司名称',
    
    -- 费率配置
    base_premium_rate DECIMAL(8,6) DEFAULT 0 COMMENT '基础费率',
    min_premium BIGINT DEFAULT 0 COMMENT '最低保费(分)',
    max_coverage BIGINT DEFAULT 0 COMMENT '最高保额(分)',
    min_coverage BIGINT DEFAULT 0 COMMENT '最低保额(分)',
    deductible_rate DECIMAL(5,4) DEFAULT 0 COMMENT '免赔率',
    min_deductible BIGINT DEFAULT 0 COMMENT '最低免赔额(分)',
    
    -- 保障配置
    coverage_scope TEXT COMMENT '保障范围(JSON)',
    exclusions TEXT COMMENT '免责条款(JSON)',
    
    -- 状态
    is_mandatory TINYINT(1) DEFAULT 0 COMMENT '是否强制',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    sort_order INT DEFAULT 0 COMMENT '排序',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_product_code (product_code),
    INDEX idx_policy_type (policy_type),
    INDEX idx_is_mandatory (is_mandatory),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保险产品配置表';

-- ============================================================
-- 初始化保险产品配置数据
-- ============================================================

INSERT INTO insurance_products (product_code, product_name, policy_type, insurer_code, insurer_name, base_premium_rate, min_premium, max_coverage, min_coverage, deductible_rate, min_deductible, is_mandatory, is_active, sort_order, coverage_scope, exclusions) VALUES
-- 第三者责任险 (强制, ≥500万保额)
('LIABILITY_500W', '第三者责任险(500万)', 'liability', 'PICC', '中国人保', 0.001500, 50000, 500000000, 500000000, 0.0000, 0, 1, 1, 1, 
 '["第三者人身伤亡", "第三者财产损失", "法律费用", "急救费用"]',
 '["故意行为", "战争暴乱", "核辐射", "无证驾驶"]'),

-- 货物险 (按货值投保)
('CARGO_STANDARD', '货物运输险(标准版)', 'cargo', 'CPIC', '太平洋保险', 0.003000, 10000, 100000000, 100000, 0.0500, 10000, 1, 1, 2,
 '["货物全损", "货物部分损失", "货物丢失", "搬运损坏"]',
 '["自然损耗", "包装不当", "违禁品", "申报不实"]'),

-- 机身险
('HULL_STANDARD', '无人机机身险(标准版)', 'hull', 'PINGAN', '平安保险', 0.050000, 100000, 50000000, 500000, 0.1000, 50000, 0, 1, 3,
 '["意外坠毁", "碰撞损失", "飞行事故", "自然灾害"]',
 '["正常磨损", "电池老化", "非正常使用", "改装损坏"]'),

-- 飞手意外险
('ACCIDENT_PILOT', '飞手意外伤害险', 'accident', 'CPLIFE', '太平洋人寿', 0.002000, 5000, 100000000, 10000000, 0.0000, 0, 1, 1, 4,
 '["意外身故", "意外伤残", "意外医疗", "住院津贴"]',
 '["故意自伤", "犯罪行为", "酒后飞行", "无证操作"]');

-- 事故类型说明:
-- crash: 坠机
-- collision: 碰撞
-- cargo_damage: 货物损坏
-- cargo_loss: 货物丢失
-- personal_injury: 人身伤害
-- third_party: 第三方损失

-- 理赔状态流程:
-- reported(已报案) → investigating(调查中) → liability_determined(责任认定) → approved(核赔通过)/rejected(拒赔) → paid(已赔付) → closed(已结案)
-- 可从任意状态转为 disputed(争议中) 进入仲裁流程
