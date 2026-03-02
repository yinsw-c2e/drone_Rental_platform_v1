-- ============================================================
-- 阶段六：信用评价与风控系统
-- 创建信用评分、风控、违规、黑名单、保证金等表
-- ============================================================

-- 1. 用户信用分表 (1000分制)
CREATE TABLE IF NOT EXISTS credit_scores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) NOT NULL COMMENT 'pilot, owner, client',
    
    -- 总分
    total_score INT DEFAULT 600 COMMENT '总信用分 0-1000',
    score_level VARCHAR(20) DEFAULT 'normal' COMMENT 'excellent(>=800), good(>=700), normal(>=600), poor(>=400), bad(<400)',
    
    -- 飞手维度 (满分1000)
    pilot_qualification INT DEFAULT 0 COMMENT '基础资质分 0-200',
    pilot_service INT DEFAULT 0 COMMENT '服务质量分 0-300',
    pilot_safety INT DEFAULT 0 COMMENT '安全记录分 0-300',
    pilot_activity INT DEFAULT 0 COMMENT '活跃度分 0-200',
    
    -- 机主维度 (满分1000)
    owner_compliance INT DEFAULT 0 COMMENT '设备合规分 0-250',
    owner_service INT DEFAULT 0 COMMENT '服务质量分 0-300',
    owner_fulfillment INT DEFAULT 0 COMMENT '履约能力分 0-250',
    owner_attitude INT DEFAULT 0 COMMENT '合作态度分 0-200',
    
    -- 业主/客户维度 (满分1000)
    client_identity INT DEFAULT 0 COMMENT '身份认证分 0-200',
    client_payment INT DEFAULT 0 COMMENT '支付能力分 0-300',
    client_attitude INT DEFAULT 0 COMMENT '合作态度分 0-300',
    client_order_quality INT DEFAULT 0 COMMENT '订单质量分 0-200',
    
    -- 统计数据
    total_orders INT DEFAULT 0 COMMENT '总订单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    cancelled_orders INT DEFAULT 0 COMMENT '取消订单数',
    dispute_orders INT DEFAULT 0 COMMENT '纠纷订单数',
    average_rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '平均评分',
    total_reviews INT DEFAULT 0 COMMENT '评价总数',
    positive_reviews INT DEFAULT 0 COMMENT '好评数',
    negative_reviews INT DEFAULT 0 COMMENT '差评数',
    violation_count INT DEFAULT 0 COMMENT '违规次数',
    last_violation_at DATETIME COMMENT '最后违规时间',
    
    -- 状态
    is_frozen TINYINT(1) DEFAULT 0 COMMENT '是否冻结',
    frozen_reason VARCHAR(255) COMMENT '冻结原因',
    frozen_at DATETIME COMMENT '冻结时间',
    is_blacklisted TINYINT(1) DEFAULT 0 COMMENT '是否黑名单',
    blacklisted_reason VARCHAR(255) COMMENT '拉黑原因',
    blacklisted_at DATETIME COMMENT '拉黑时间',
    
    last_calculated_at DATETIME COMMENT '最后计算时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_user_id (user_id),
    INDEX idx_user_type (user_type),
    INDEX idx_score_level (score_level),
    INDEX idx_is_frozen (is_frozen),
    INDEX idx_is_blacklisted (is_blacklisted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信用分表';

-- 2. 信用分变动日志表
CREATE TABLE IF NOT EXISTS credit_score_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    change_type VARCHAR(30) NOT NULL COMMENT 'order_complete, review_received, violation, bonus, penalty, recalculate',
    change_reason VARCHAR(255) COMMENT '变动原因',
    dimension VARCHAR(30) COMMENT '变动维度: qualification, service, safety, activity, compliance, fulfillment, attitude, identity, payment, order_quality',
    score_before INT COMMENT '变动前分数',
    score_after INT COMMENT '变动后分数',
    score_change INT COMMENT '变动分数(正为增加负为减少)',
    related_order_id BIGINT COMMENT '关联订单ID',
    related_review_id BIGINT COMMENT '关联评价ID',
    operator_id BIGINT COMMENT '操作人ID(0表示系统)',
    operator_type VARCHAR(20) COMMENT 'system, admin, auto',
    notes TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_change_type (change_type),
    INDEX idx_related_order_id (related_order_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='信用分变动日志表';

-- 3. 风控记录表
CREATE TABLE IF NOT EXISTS risk_controls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    risk_no VARCHAR(50) NOT NULL COMMENT '风控编号',
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) COMMENT 'pilot, owner, client',
    order_id BIGINT COMMENT '关联订单ID',
    
    -- 风控类型
    risk_phase VARCHAR(20) NOT NULL COMMENT 'pre(事前), during(事中), post(事后)',
    risk_type VARCHAR(30) NOT NULL COMMENT 'identity_fraud, payment_risk, behavior_abnormal, dispute, violation, blacklist',
    risk_level VARCHAR(20) DEFAULT 'low' COMMENT 'low, medium, high, critical',
    risk_score INT DEFAULT 0 COMMENT '风险评分 0-100',
    
    -- 风控详情
    trigger_rule VARCHAR(100) COMMENT '触发规则',
    trigger_data TEXT COMMENT '触发数据(JSON)',
    description TEXT COMMENT '风险描述',
    
    -- 处理状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, reviewing, resolved, dismissed',
    action VARCHAR(30) COMMENT 'none, warn, freeze, blacklist, block_order, require_deposit',
    action_detail TEXT COMMENT '处置详情',
    reviewed_by BIGINT COMMENT '审核人ID',
    reviewed_at DATETIME COMMENT '审核时间',
    review_notes TEXT COMMENT '审核备注',
    resolved_at DATETIME COMMENT '解决时间',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_risk_no (risk_no),
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_risk_phase (risk_phase),
    INDEX idx_risk_type (risk_type),
    INDEX idx_risk_level (risk_level),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风控记录表';

-- 4. 违规记录表
CREATE TABLE IF NOT EXISTS violations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    violation_no VARCHAR(50) NOT NULL COMMENT '违规编号',
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) COMMENT 'pilot, owner, client',
    order_id BIGINT COMMENT '关联订单ID',
    
    -- 违规类型
    violation_type VARCHAR(30) NOT NULL COMMENT 'cancel_abuse, no_show, delay, damage, fraud, unsafe_flight, policy_violation',
    violation_level VARCHAR(20) DEFAULT 'minor' COMMENT 'minor(轻微), moderate(中等), serious(严重), critical(重大)',
    description TEXT COMMENT '违规描述',
    evidence TEXT COMMENT '证据(JSON: 图片/视频/日志)',
    
    -- 处罚
    penalty VARCHAR(30) COMMENT 'warning, score_deduct, freeze_temp, freeze_perm, blacklist',
    penalty_detail TEXT COMMENT '处罚详情',
    score_deduction INT DEFAULT 0 COMMENT '扣除信用分',
    freeze_days INT DEFAULT 0 COMMENT '冻结天数',
    fine_amount BIGINT DEFAULT 0 COMMENT '罚款金额(分)',
    
    -- 申诉
    appeal_status VARCHAR(20) DEFAULT 'none' COMMENT 'none, pending, approved, rejected',
    appeal_content TEXT COMMENT '申诉内容',
    appeal_at DATETIME COMMENT '申诉时间',
    appeal_reviewed_by BIGINT COMMENT '申诉审核人',
    appeal_reviewed_at DATETIME COMMENT '申诉审核时间',
    appeal_result TEXT COMMENT '申诉结果',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, confirmed, appealing, revoked',
    confirmed_by BIGINT COMMENT '确认人ID',
    confirmed_at DATETIME COMMENT '确认时间',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_violation_no (violation_no),
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_violation_type (violation_type),
    INDEX idx_violation_level (violation_level),
    INDEX idx_status (status),
    INDEX idx_appeal_status (appeal_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='违规记录表';

-- 5. 黑名单表
CREATE TABLE IF NOT EXISTS blacklists (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) COMMENT 'pilot, owner, client',
    blacklist_type VARCHAR(20) DEFAULT 'permanent' COMMENT 'temporary, permanent',
    reason TEXT NOT NULL COMMENT '拉黑原因',
    related_violation_id BIGINT COMMENT '关联违规记录ID',
    expire_at DATETIME COMMENT '临时黑名单到期时间',
    added_by BIGINT COMMENT '添加人ID',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
    removed_by BIGINT COMMENT '移除人ID',
    removed_at DATETIME COMMENT '移除时间',
    removed_reason VARCHAR(255) COMMENT '移除原因',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否生效',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_user_id (user_id),
    INDEX idx_blacklist_type (blacklist_type),
    INDEX idx_is_active (is_active),
    INDEX idx_expire_at (expire_at),
    INDEX idx_related_violation_id (related_violation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='黑名单表';

-- 6. 保证金表
CREATE TABLE IF NOT EXISTS deposits (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    deposit_no VARCHAR(50) NOT NULL COMMENT '保证金编号',
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) COMMENT 'pilot, owner, client',
    
    -- 金额
    required_amount BIGINT DEFAULT 0 COMMENT '应缴金额(分)',
    paid_amount BIGINT DEFAULT 0 COMMENT '已缴金额(分)',
    frozen_amount BIGINT DEFAULT 0 COMMENT '冻结金额(分, 用于赔付)',
    refunded_amount BIGINT DEFAULT 0 COMMENT '已退还金额(分)',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, paid, partial, frozen, refunding, refunded',
    paid_at DATETIME COMMENT '缴纳时间',
    refunded_at DATETIME COMMENT '退还时间',
    payment_id BIGINT COMMENT '关联支付记录ID',
    
    -- 原因
    require_reason VARCHAR(255) COMMENT '要求缴纳原因',
    refund_reason VARCHAR(255) COMMENT '退还原因',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_deposit_no (deposit_no),
    INDEX idx_user_id (user_id),
    INDEX idx_user_type (user_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保证金表';

-- ============================================================
-- 初始化信用评分配置数据
-- ============================================================

-- 信用等级阈值说明:
-- excellent (优秀): >= 800分
-- good (良好): >= 700分  
-- normal (正常): >= 600分
-- poor (较差): >= 400分
-- bad (极差): < 400分

-- 违规处罚标准:
-- minor (轻微): 扣5-20分, 警告
-- moderate (中等): 扣20-50分, 冻结1-7天
-- serious (严重): 扣50-100分, 冻结7-30天
-- critical (重大): 扣100-200分, 永久拉黑

-- 风险等级说明:
-- low: 风险评分 0-25
-- medium: 风险评分 26-50
-- high: 风险评分 51-75
-- critical: 风险评分 76-100
