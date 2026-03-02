-- ============================================================
-- 阶段五：支付结算与分账系统
-- ============================================================

-- 订单结算表
CREATE TABLE IF NOT EXISTS order_settlements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    settlement_no VARCHAR(50) NOT NULL UNIQUE,
    order_id BIGINT NOT NULL UNIQUE,
    order_no VARCHAR(30),

    -- 金额明细(单位:分)
    total_amount BIGINT DEFAULT 0 COMMENT '订单总额',
    base_fee BIGINT DEFAULT 0 COMMENT '基础服务费',
    mileage_fee BIGINT DEFAULT 0 COMMENT '里程费',
    duration_fee BIGINT DEFAULT 0 COMMENT '时长费',
    weight_fee BIGINT DEFAULT 0 COMMENT '重量费',
    difficulty_fee BIGINT DEFAULT 0 COMMENT '难度附加费',
    insurance_fee BIGINT DEFAULT 0 COMMENT '保险费',
    surge_pricing BIGINT DEFAULT 0 COMMENT '溢价/折扣',
    coupon_discount BIGINT DEFAULT 0 COMMENT '优惠券折扣',
    final_amount BIGINT DEFAULT 0 COMMENT '最终支付金额',

    -- 分账明细
    platform_fee_rate DECIMAL(5,4) DEFAULT 0.1000 COMMENT '平台费率',
    platform_fee BIGINT DEFAULT 0 COMMENT '平台服务费',
    pilot_fee_rate DECIMAL(5,4) DEFAULT 0.4500 COMMENT '飞手分成比例',
    pilot_fee BIGINT DEFAULT 0 COMMENT '飞手劳务费',
    owner_fee_rate DECIMAL(5,4) DEFAULT 0.4000 COMMENT '机主分成比例',
    owner_fee BIGINT DEFAULT 0 COMMENT '机主设备费',
    insurance_deduction BIGINT DEFAULT 0 COMMENT '保险费代扣',

    -- 参与方
    pilot_user_id BIGINT DEFAULT 0,
    owner_user_id BIGINT DEFAULT 0,
    payer_user_id BIGINT DEFAULT 0 COMMENT '付款方(业主)',

    -- 定价参数
    flight_distance DECIMAL(10,2) DEFAULT 0 COMMENT '飞行距离(km)',
    flight_duration DECIMAL(10,2) DEFAULT 0 COMMENT '飞行时长(分钟)',
    cargo_weight DECIMAL(10,2) DEFAULT 0 COMMENT '货物重量(kg)',
    difficulty_factor DECIMAL(3,1) DEFAULT 1.0 COMMENT '难度系数(1.0-2.0)',
    cargo_value BIGINT DEFAULT 0 COMMENT '货物申报价值(分)',
    insurance_rate DECIMAL(5,4) DEFAULT 0.0100 COMMENT '保险费率',

    -- 状态管理
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/calculated/confirmed/settled/disputed',
    calculated_at DATETIME NULL,
    confirmed_at DATETIME NULL,
    settled_at DATETIME NULL,
    settled_by VARCHAR(20) DEFAULT '' COMMENT 'system/admin',
    notes TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_settlement_status (status),
    INDEX idx_settlement_pilot (pilot_user_id),
    INDEX idx_settlement_owner (owner_user_id),
    INDEX idx_settlement_payer (payer_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单结算记录';

-- 用户钱包表
CREATE TABLE IF NOT EXISTS user_wallets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    wallet_type VARCHAR(20) DEFAULT 'general' COMMENT 'general/pilot/owner',
    available_balance BIGINT DEFAULT 0 COMMENT '可用余额(分)',
    frozen_balance BIGINT DEFAULT 0 COMMENT '冻结余额(分)',
    total_income BIGINT DEFAULT 0 COMMENT '累计收入(分)',
    total_withdrawn BIGINT DEFAULT 0 COMMENT '累计提现(分)',
    total_frozen BIGINT DEFAULT 0 COMMENT '累计冻结(分)',
    status VARCHAR(20) DEFAULT 'active' COMMENT 'active/frozen/closed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX idx_wallet_user (user_id, wallet_type),
    INDEX idx_wallet_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户钱包';

-- 钱包流水表
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_no VARCHAR(50) NOT NULL UNIQUE,
    wallet_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    type VARCHAR(30) NOT NULL COMMENT 'income/withdraw/freeze/unfreeze/deduct/refund',
    amount BIGINT NOT NULL COMMENT '交易金额(分)',
    balance_before BIGINT DEFAULT 0 COMMENT '交易前余额(分)',
    balance_after BIGINT DEFAULT 0 COMMENT '交易后余额(分)',
    related_order_id BIGINT DEFAULT 0,
    related_settlement_id BIGINT DEFAULT 0,
    description VARCHAR(255) DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tx_wallet (wallet_id),
    INDEX idx_tx_user (user_id),
    INDEX idx_tx_order (related_order_id),
    INDEX idx_tx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钱包流水记录';

-- 提现记录表
CREATE TABLE IF NOT EXISTS withdrawal_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    withdrawal_no VARCHAR(50) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    wallet_id BIGINT NOT NULL,
    amount BIGINT NOT NULL COMMENT '提现金额(分)',
    service_fee BIGINT DEFAULT 0 COMMENT '手续费(分)',
    actual_amount BIGINT NOT NULL COMMENT '实际到账(分)',

    -- 收款方式
    withdraw_method VARCHAR(20) NOT NULL COMMENT 'bank_card/alipay/wechat',
    bank_name VARCHAR(50) DEFAULT '',
    bank_branch VARCHAR(100) DEFAULT '',
    account_no VARCHAR(255) DEFAULT '' COMMENT '加密存储',
    account_name VARCHAR(50) DEFAULT '',
    alipay_account VARCHAR(100) DEFAULT '',
    wechat_account VARCHAR(100) DEFAULT '',

    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/processing/completed/rejected/failed',
    reviewed_by BIGINT DEFAULT 0,
    reviewed_at DATETIME NULL,
    review_notes VARCHAR(255) DEFAULT '',
    completed_at DATETIME NULL,
    third_party_no VARCHAR(100) DEFAULT '' COMMENT '第三方转账流水号',
    fail_reason VARCHAR(255) DEFAULT '',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_withdraw_user (user_id),
    INDEX idx_withdraw_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提现记录';

-- 定价配置表
CREATE TABLE IF NOT EXISTS pricing_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(50) NOT NULL UNIQUE,
    config_value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) DEFAULT '',
    description VARCHAR(255) DEFAULT '',
    category VARCHAR(30) DEFAULT '' COMMENT 'base/mileage/duration/weight/difficulty/insurance/split/surge',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定价配置';

-- ==================== 定价配置默认值 ====================
INSERT INTO pricing_configs (config_key, config_value, unit, description, category) VALUES
    -- 基础服务费
    ('base_fee_min', 5000, '分', '基础服务费最低(50元)', 'base'),
    ('base_fee_max', 20000, '分', '基础服务费最高(200元)', 'base'),
    ('base_fee_default', 8000, '分', '基础服务费默认(80元)', 'base'),
    -- 里程费
    ('mileage_rate_0_5', 1500, '分/km', '0-5km里程单价(15元/km)', 'mileage'),
    ('mileage_rate_5_15', 1000, '分/km', '5-15km里程单价(10元/km)', 'mileage'),
    ('mileage_rate_15_50', 800, '分/km', '15-50km里程单价(8元/km)', 'mileage'),
    ('mileage_rate_50_plus', 500, '分/km', '50km+里程单价(5元/km)', 'mileage'),
    -- 时长费
    ('duration_rate', 300, '分/min', '时长单价(3元/min)', 'duration'),
    ('duration_free_minutes', 10, 'min', '免费时长(10分钟)', 'duration'),
    -- 重量费
    ('weight_rate_0_5', 1000, '分/10kg', '0-5kg重量单价(10元/10kg)', 'weight'),
    ('weight_rate_5_20', 3000, '分/10kg', '5-20kg重量单价(30元/10kg)', 'weight'),
    ('weight_rate_20_plus', 5000, '分/10kg', '20kg+重量单价(50元/10kg)', 'weight'),
    -- 难度系数
    ('difficulty_normal', 1.0, '倍', '普通任务难度系数', 'difficulty'),
    ('difficulty_complex', 1.3, '倍', '复杂任务(城区/多停靠)', 'difficulty'),
    ('difficulty_hazardous', 1.5, '倍', '危险品运输难度系数', 'difficulty'),
    ('difficulty_emergency', 1.8, '倍', '紧急任务难度系数', 'difficulty'),
    ('difficulty_night', 2.0, '倍', '夜间飞行难度系数', 'difficulty'),
    -- 保险费率
    ('insurance_rate_normal', 0.0100, '比例', '普通货物保险费率(1%)', 'insurance'),
    ('insurance_rate_fragile', 0.0200, '比例', '易碎品保险费率(2%)', 'insurance'),
    ('insurance_rate_hazardous', 0.0300, '比例', '危险品保险费率(3%)', 'insurance'),
    -- 分账比例
    ('split_platform_rate', 0.1000, '比例', '平台抽成比例(10%)', 'split'),
    ('split_pilot_rate', 0.4500, '比例', '飞手分成比例(45%)', 'split'),
    ('split_owner_rate', 0.4000, '比例', '机主分成比例(40%)', 'split'),
    ('split_insurance_rate', 0.0500, '比例', '保险代扣比例(5%)', 'split'),
    -- 高峰溢价
    ('surge_peak_rate', 1.3, '倍', '高峰时段溢价(30%)', 'surge'),
    ('surge_idle_rate', 0.8, '倍', '空闲时段折扣(20%)', 'surge'),
    ('surge_holiday_rate', 1.5, '倍', '节假日溢价(50%)', 'surge')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);
