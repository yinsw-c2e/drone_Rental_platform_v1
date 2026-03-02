-- 任务2.1-2.3: 智能匹配与派单系统 - 数据库迁移
-- 创建派单相关表：dispatch_tasks, dispatch_candidates, dispatch_configs, dispatch_logs

-- ==================== 派单任务表 ====================
CREATE TABLE IF NOT EXISTS dispatch_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_no VARCHAR(50) NOT NULL UNIQUE COMMENT '任务编号',
    order_id BIGINT DEFAULT 0 COMMENT '关联订单ID',
    cargo_demand_id BIGINT DEFAULT 0 COMMENT '关联货运需求ID',
    client_id BIGINT NOT NULL COMMENT '业主ID',
    task_type VARCHAR(30) NOT NULL DEFAULT 'instant' COMMENT '任务类型: instant(即时), scheduled(预约), batch(批量)',
    priority INT DEFAULT 5 COMMENT '优先级1-10',
    status VARCHAR(30) DEFAULT 'pending' COMMENT '状态: pending, matching, dispatching, assigned, cancelled, expired',

    -- 货物信息
    cargo_weight DECIMAL(10,2) DEFAULT 0 COMMENT '货物重量(kg)',
    cargo_volume DECIMAL(10,2) DEFAULT 0 COMMENT '货物体积(立方厘米)',
    cargo_category VARCHAR(50) DEFAULT '' COMMENT '货物类别',
    is_hazardous TINYINT(1) DEFAULT 0 COMMENT '是否危险品',
    requires_special JSON COMMENT '特殊要求',

    -- 位置信息
    pickup_latitude DECIMAL(10,7) DEFAULT 0 COMMENT '取货点纬度',
    pickup_longitude DECIMAL(10,7) DEFAULT 0 COMMENT '取货点经度',
    pickup_address VARCHAR(255) DEFAULT '' COMMENT '取货地址',
    delivery_latitude DECIMAL(10,7) DEFAULT 0 COMMENT '送货点纬度',
    delivery_longitude DECIMAL(10,7) DEFAULT 0 COMMENT '送货点经度',
    delivery_address VARCHAR(255) DEFAULT '' COMMENT '送货地址',
    flight_distance DECIMAL(10,2) DEFAULT 0 COMMENT '飞行距离(km)',

    -- 时间约束
    required_pickup_time DATETIME NULL COMMENT '要求取货时间',
    required_delivery_time DATETIME NULL COMMENT '要求送达时间',
    time_window_start DATETIME NULL COMMENT '时间窗口开始',
    time_window_end DATETIME NULL COMMENT '时间窗口结束',
    dispatch_deadline DATETIME NULL COMMENT '派单截止时间',

    -- 预算约束
    budget_min BIGINT DEFAULT 0 COMMENT '最低预算(分)',
    budget_max BIGINT DEFAULT 0 COMMENT '最高预算(分)',
    offered_price BIGINT DEFAULT 0 COMMENT '业主出价(分)',

    -- 匹配要求
    required_license_type VARCHAR(30) DEFAULT '' COMMENT '要求的执照类型',
    min_pilot_rating DECIMAL(3,2) DEFAULT 0 COMMENT '飞手最低评分',
    min_drone_rating DECIMAL(3,2) DEFAULT 0 COMMENT '无人机最低评分',
    min_credit_score INT DEFAULT 0 COMMENT '最低信用分',

    -- 派单结果
    assigned_pilot_id BIGINT DEFAULT 0 COMMENT '分配的飞手ID',
    assigned_drone_id BIGINT DEFAULT 0 COMMENT '分配的无人机ID',
    assigned_owner_id BIGINT DEFAULT 0 COMMENT '分配的机主ID',
    assigned_at DATETIME NULL COMMENT '分配时间',
    final_price BIGINT DEFAULT 0 COMMENT '最终成交价(分)',
    match_score INT DEFAULT 0 COMMENT '匹配得分',
    match_details JSON COMMENT '匹配详情',

    -- 匹配尝试统计
    match_attempts INT DEFAULT 0 COMMENT '匹配尝试次数',
    max_attempts INT DEFAULT 3 COMMENT '最大尝试次数',
    last_match_time DATETIME NULL COMMENT '最后匹配时间',
    fail_reason TEXT COMMENT '失败原因',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_dispatch_tasks_task_no (task_no),
    INDEX idx_dispatch_tasks_order_id (order_id),
    INDEX idx_dispatch_tasks_cargo_demand_id (cargo_demand_id),
    INDEX idx_dispatch_tasks_client_id (client_id),
    INDEX idx_dispatch_tasks_status (status),
    INDEX idx_dispatch_tasks_task_type (task_type),
    INDEX idx_dispatch_tasks_priority (priority),
    INDEX idx_dispatch_tasks_assigned_pilot_id (assigned_pilot_id),
    INDEX idx_dispatch_tasks_assigned_drone_id (assigned_drone_id),
    INDEX idx_dispatch_tasks_deleted_at (deleted_at),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='派单任务表';

-- ==================== 派单候选人表 ====================
CREATE TABLE IF NOT EXISTS dispatch_candidates (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL COMMENT '任务ID',
    pilot_id BIGINT NOT NULL COMMENT '飞手ID',
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    owner_id BIGINT NOT NULL COMMENT '机主ID',

    -- 综合评分
    total_score INT DEFAULT 0 COMMENT '综合得分(0-100)',

    -- 各维度得分
    distance_score INT DEFAULT 0 COMMENT '距离得分(0-25)',
    load_score INT DEFAULT 0 COMMENT '载荷匹配得分(0-15)',
    qualification_score INT DEFAULT 0 COMMENT '资质匹配得分(0-20)',
    credit_score INT DEFAULT 0 COMMENT '信用得分(0-15)',
    price_score INT DEFAULT 0 COMMENT '价格得分(0-10)',
    time_score INT DEFAULT 0 COMMENT '时间匹配得分(0-10)',
    rating_score INT DEFAULT 0 COMMENT '服务评分得分(0-5)',

    -- 详细数据
    distance DECIMAL(10,2) DEFAULT 0 COMMENT '距离(km)',
    estimated_time INT DEFAULT 0 COMMENT '预计完成时间(分钟)',
    quoted_price BIGINT DEFAULT 0 COMMENT '报价(分)',

    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending, notified, accepted, rejected, timeout',
    notified_at DATETIME NULL COMMENT '通知时间',
    responded_at DATETIME NULL COMMENT '响应时间',
    response_note TEXT COMMENT '响应备注',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_dispatch_candidates_task_id (task_id),
    INDEX idx_dispatch_candidates_pilot_id (pilot_id),
    INDEX idx_dispatch_candidates_drone_id (drone_id),
    INDEX idx_dispatch_candidates_owner_id (owner_id),
    INDEX idx_dispatch_candidates_status (status),
    INDEX idx_dispatch_candidates_total_score (total_score),
    FOREIGN KEY (task_id) REFERENCES dispatch_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (pilot_id) REFERENCES pilots(id) ON DELETE CASCADE,
    FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='派单候选人表';

-- ==================== 派单配置表 ====================
CREATE TABLE IF NOT EXISTS dispatch_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT COMMENT '配置值',
    config_type VARCHAR(20) DEFAULT 'string' COMMENT '配置类型: int, float, string, json',
    description VARCHAR(255) DEFAULT '' COMMENT '配置说明',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_dispatch_configs_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='派单配置表';

-- ==================== 派单日志表 ====================
CREATE TABLE IF NOT EXISTS dispatch_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL COMMENT '任务ID',
    action VARCHAR(50) NOT NULL COMMENT '动作: created, matching_started, candidate_found, notified, accepted, rejected, assigned, cancelled',
    actor_type VARCHAR(20) DEFAULT 'system' COMMENT '操作者类型: system, pilot, client, admin',
    actor_id BIGINT DEFAULT 0 COMMENT '操作者ID',
    details JSON COMMENT '详情',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_dispatch_logs_task_id (task_id),
    INDEX idx_dispatch_logs_action (action),
    INDEX idx_dispatch_logs_created_at (created_at),
    FOREIGN KEY (task_id) REFERENCES dispatch_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='派单日志表';

-- ==================== 初始化派单配置 ====================
INSERT INTO dispatch_configs (config_key, config_value, config_type, description) VALUES
('matching_radius_km', '5', 'float', '默认匹配半径(公里)'),
('matching_extended_radius_km', '15', 'float', '扩展匹配半径(公里)'),
('matching_max_radius_km', '50', 'float', '最大匹配半径(公里)'),
('batch_window_seconds', '3', 'int', '批量匹配时间窗口(秒)'),
('candidate_response_timeout_seconds', '30', 'int', '候选人响应超时(秒)'),
('max_candidates_per_task', '10', 'int', '每个任务最大候选人数'),
('min_match_score', '40', 'int', '最低匹配分数'),
('distance_score_weight', '25', 'int', '距离得分权重'),
('load_score_weight', '15', 'int', '载荷匹配得分权重'),
('qualification_score_weight', '20', 'int', '资质匹配得分权重'),
('credit_score_weight', '15', 'int', '信用得分权重'),
('price_score_weight', '10', 'int', '价格得分权重'),
('time_score_weight', '10', 'int', '时间匹配得分权重'),
('rating_score_weight', '5', 'int', '服务评分得分权重'),
('platform_commission_rate', '0.10', 'float', '平台佣金比例'),
('pilot_share_rate', '0.45', 'float', '飞手分成比例'),
('owner_share_rate', '0.40', 'float', '机主分成比例'),
('insurance_rate', '0.05', 'float', '保险费率')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ==================== 更新匹配记录表 ====================
-- 为现有的matching_records表添加更多字段
ALTER TABLE matching_records ADD COLUMN IF NOT EXISTS pilot_id BIGINT DEFAULT 0 COMMENT '飞手ID' AFTER supply_type;
ALTER TABLE matching_records ADD COLUMN IF NOT EXISTS owner_id BIGINT DEFAULT 0 COMMENT '机主ID' AFTER pilot_id;
ALTER TABLE matching_records ADD COLUMN IF NOT EXISTS distance DECIMAL(10,2) DEFAULT 0 COMMENT '距离(km)' AFTER match_reason;
ALTER TABLE matching_records ADD COLUMN IF NOT EXISTS estimated_price BIGINT DEFAULT 0 COMMENT '估算价格(分)' AFTER distance;
ALTER TABLE matching_records ADD COLUMN IF NOT EXISTS estimated_time INT DEFAULT 0 COMMENT '估算时间(分钟)' AFTER estimated_price;
ALTER TABLE matching_records ADD INDEX IF NOT EXISTS idx_matching_records_pilot_id (pilot_id);
ALTER TABLE matching_records ADD INDEX IF NOT EXISTS idx_matching_records_owner_id (owner_id);
