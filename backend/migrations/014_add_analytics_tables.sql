-- ============================================================
-- 阶段八：数据分析与决策支持
-- 创建分析统计相关表
-- ============================================================

-- 每日统计数据表
CREATE TABLE IF NOT EXISTS daily_statistics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    stat_date DATE NOT NULL UNIQUE COMMENT '统计日期',
    
    -- 订单统计
    total_orders INT DEFAULT 0 COMMENT '总订单数',
    new_orders INT DEFAULT 0 COMMENT '新建订单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    cancelled_orders INT DEFAULT 0 COMMENT '取消订单数',
    in_progress_orders INT DEFAULT 0 COMMENT '进行中订单数',
    completion_rate DECIMAL(5,2) DEFAULT 0 COMMENT '完成率(%)',
    cancellation_rate DECIMAL(5,2) DEFAULT 0 COMMENT '取消率(%)',
    
    -- 收入统计(分)
    total_revenue BIGINT DEFAULT 0 COMMENT '总收入',
    platform_fee BIGINT DEFAULT 0 COMMENT '平台服务费',
    pilot_income BIGINT DEFAULT 0 COMMENT '飞手收入',
    owner_income BIGINT DEFAULT 0 COMMENT '机主收入',
    insurance_fee BIGINT DEFAULT 0 COMMENT '保险费',
    avg_order_amount BIGINT DEFAULT 0 COMMENT '平均订单金额',
    
    -- 用户统计
    total_users INT DEFAULT 0 COMMENT '总用户数',
    new_users INT DEFAULT 0 COMMENT '新增用户数',
    active_users INT DEFAULT 0 COMMENT '活跃用户数',
    new_pilots INT DEFAULT 0 COMMENT '新增飞手数',
    new_owners INT DEFAULT 0 COMMENT '新增机主数',
    new_clients INT DEFAULT 0 COMMENT '新增业主数',
    online_pilots INT DEFAULT 0 COMMENT '在线飞手数(峰值)',
    
    -- 运力统计
    total_drones INT DEFAULT 0 COMMENT '总无人机数',
    available_drones INT DEFAULT 0 COMMENT '可用无人机数',
    busy_drones INT DEFAULT 0 COMMENT '忙碌无人机数',
    total_pilots INT DEFAULT 0 COMMENT '总飞手数',
    available_pilots INT DEFAULT 0 COMMENT '可接单飞手数',
    
    -- 飞行统计
    total_flights INT DEFAULT 0 COMMENT '总飞行次数',
    total_flight_hours DECIMAL(10,2) DEFAULT 0 COMMENT '总飞行时长(小时)',
    total_distance DECIMAL(10,2) DEFAULT 0 COMMENT '总飞行距离(公里)',
    total_cargo_weight DECIMAL(10,2) DEFAULT 0 COMMENT '总货运重量(公斤)',
    avg_flight_time DECIMAL(10,2) DEFAULT 0 COMMENT '平均飞行时长(分钟)',
    
    -- 风控统计
    alerts_triggered INT DEFAULT 0 COMMENT '触发告警数',
    violations_count INT DEFAULT 0 COMMENT '违规数',
    claims_count INT DEFAULT 0 COMMENT '理赔数',
    disputes_count INT DEFAULT 0 COMMENT '纠纷数',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日统计数据表';

-- 小时级别实时指标表
CREATE TABLE IF NOT EXISTS hourly_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    metric_time DATETIME NOT NULL COMMENT '指标时间(整点)',
    
    -- 订单指标
    new_orders INT DEFAULT 0 COMMENT '新建订单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    cancelled_orders INT DEFAULT 0 COMMENT '取消订单数',
    
    -- 收入指标(分)
    revenue BIGINT DEFAULT 0 COMMENT '收入',
    
    -- 运力指标
    online_pilots INT DEFAULT 0 COMMENT '在线飞手数',
    available_drones INT DEFAULT 0 COMMENT '可用无人机数',
    active_flights INT DEFAULT 0 COMMENT '进行中飞行数',
    
    -- 用户指标
    active_users INT DEFAULT 0 COMMENT '活跃用户数',
    new_users INT DEFAULT 0 COMMENT '新增用户数',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_metric_time (metric_time),
    UNIQUE KEY uk_metric_time (metric_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小时级别实时指标表';

-- 区域统计数据表
CREATE TABLE IF NOT EXISTS region_statistics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    stat_date DATE NOT NULL COMMENT '统计日期',
    region_code VARCHAR(20) NOT NULL COMMENT '区域编码',
    region_name VARCHAR(50) COMMENT '区域名称',
    region_level VARCHAR(20) COMMENT '区域级别(province/city/district)',
    
    -- 订单统计
    total_orders INT DEFAULT 0 COMMENT '总订单数',
    completed_orders INT DEFAULT 0 COMMENT '完成订单数',
    revenue BIGINT DEFAULT 0 COMMENT '收入(分)',
    
    -- 运力统计
    total_drones INT DEFAULT 0 COMMENT '无人机数',
    total_pilots INT DEFAULT 0 COMMENT '飞手数',
    
    -- 用户统计
    total_clients INT DEFAULT 0 COMMENT '业主数',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_stat_date (stat_date),
    INDEX idx_region_code (region_code),
    UNIQUE KEY uk_date_region (stat_date, region_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='区域统计数据表';

-- 分析报表表
CREATE TABLE IF NOT EXISTS analytics_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    report_no VARCHAR(50) NOT NULL UNIQUE COMMENT '报表编号',
    report_type VARCHAR(20) NOT NULL COMMENT '报表类型(daily/weekly/monthly/quarterly/yearly/custom)',
    report_name VARCHAR(100) NOT NULL COMMENT '报表名称',
    
    -- 报表周期
    period_start DATETIME NOT NULL COMMENT '周期开始时间',
    period_end DATETIME NOT NULL COMMENT '周期结束时间',
    
    -- 报表内容(JSON)
    summary TEXT COMMENT '概要',
    order_analysis TEXT COMMENT '订单分析',
    revenue_analysis TEXT COMMENT '收入分析',
    user_analysis TEXT COMMENT '用户分析',
    flight_analysis TEXT COMMENT '飞行分析',
    risk_analysis TEXT COMMENT '风控分析',
    region_analysis TEXT COMMENT '区域分析',
    trend_analysis TEXT COMMENT '趋势分析',
    recommendations TEXT COMMENT '建议',
    
    -- 对比数据(JSON)
    previous_period_comparison TEXT COMMENT '环比数据',
    year_over_year_comparison TEXT COMMENT '同比数据',
    
    -- 附件(JSON)
    attachments TEXT COMMENT '导出文件',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'generating' COMMENT '状态(generating/completed/failed)',
    generated_by VARCHAR(20) DEFAULT 'system' COMMENT '生成方式(system/admin)',
    generated_at DATETIME COMMENT '生成时间',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_report_type (report_type),
    INDEX idx_period (period_start, period_end),
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析报表表';

-- 热力图数据表
CREATE TABLE IF NOT EXISTS heatmap_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    data_type VARCHAR(30) NOT NULL COMMENT '数据类型(order_density/drone_distribution/pilot_distribution/demand_hotspot)',
    stat_date DATE NOT NULL COMMENT '统计日期',
    
    -- 位置信息
    latitude DECIMAL(10,7) NOT NULL COMMENT '纬度',
    longitude DECIMAL(10,7) NOT NULL COMMENT '经度',
    grid_key VARCHAR(30) COMMENT '网格编号',
    
    -- 数值
    value INT DEFAULT 0 COMMENT '热度值',
    count INT DEFAULT 0 COMMENT '数量',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_data_type (data_type),
    INDEX idx_stat_date (stat_date),
    INDEX idx_grid_key (grid_key),
    INDEX idx_location (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='热力图数据表';

-- 实时看板数据缓存表
CREATE TABLE IF NOT EXISTS realtime_dashboard (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    metric_key VARCHAR(50) NOT NULL UNIQUE COMMENT '指标键',
    metric_value TEXT COMMENT '指标值(JSON)',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_metric_key (metric_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='实时看板数据缓存表';

-- 初始化实时看板指标键
INSERT INTO realtime_dashboard (metric_key, metric_value) VALUES
('today_orders', '{"new": 0, "completed": 0, "cancelled": 0, "in_progress": 0}'),
('today_revenue', '{"total": 0, "platform_fee": 0, "pilot_income": 0, "owner_income": 0}'),
('online_capacity', '{"pilots": 0, "drones": 0, "active_flights": 0}'),
('active_users', '{"total": 0, "pilots": 0, "owners": 0, "clients": 0}'),
('alerts_summary', '{"active": 0, "resolved_today": 0, "critical": 0}'),
('recent_orders', '[]'),
('top_regions', '[]'),
('system_health', '{"status": "healthy", "api_latency": 0, "db_connections": 0}')
ON DUPLICATE KEY UPDATE metric_key = metric_key;

-- ============================================================
-- 备注说明
-- ============================================================
-- 
-- 报表类型 (report_type):
--   - daily: 日报
--   - weekly: 周报
--   - monthly: 月报
--   - quarterly: 季报
--   - yearly: 年报
--   - custom: 自定义时间段
--
-- 热力图类型 (data_type):
--   - order_density: 订单密度分布
--   - drone_distribution: 无人机分布
--   - pilot_distribution: 飞手分布
--   - demand_hotspot: 需求热点
--
-- 数据更新策略:
--   - hourly_metrics: 每小时更新
--   - daily_statistics: 每日凌晨汇总前一天数据
--   - region_statistics: 每日更新
--   - heatmap_data: 每小时更新当天数据
--   - realtime_dashboard: 实时更新(缓存)
--   - analytics_reports: 按需生成或定时生成
-- ============================================================
