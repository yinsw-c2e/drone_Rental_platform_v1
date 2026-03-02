-- 009_add_order_execution_tables.sql
-- 订单执行与飞行监控系统数据表

-- ==================== 扩展订单表 ====================
-- 添加订单执行相关字段

ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_task_id BIGINT DEFAULT NULL COMMENT '关联派单任务ID';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS airspace_status VARCHAR(20) DEFAULT 'not_required' COMMENT '空域申请状态: not_required, pending, approved, rejected';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS airspace_application_id BIGINT DEFAULT NULL COMMENT '空域申请ID';

-- 装载信息
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cargo_weight INT DEFAULT 0 COMMENT '货物实际重量(克)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cargo_volume VARCHAR(50) DEFAULT NULL COMMENT '货物体积(长x宽x高 cm)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cargo_photos JSON DEFAULT NULL COMMENT '货物照片';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_confirmed_at DATETIME DEFAULT NULL COMMENT '装载确认时间';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loading_confirmed_by BIGINT DEFAULT NULL COMMENT '装载确认人';

-- 卸载信息
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unloading_confirmed_at DATETIME DEFAULT NULL COMMENT '卸载确认时间';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unloading_confirmed_by BIGINT DEFAULT NULL COMMENT '卸载确认人';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_photos JSON DEFAULT NULL COMMENT '送达照片';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receiver_signature VARCHAR(500) DEFAULT NULL COMMENT '收货人签名图片';

-- 飞行信息
ALTER TABLE orders ADD COLUMN IF NOT EXISTS flight_start_time DATETIME DEFAULT NULL COMMENT '起飞时间';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS flight_end_time DATETIME DEFAULT NULL COMMENT '降落时间';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_flight_distance INT DEFAULT 0 COMMENT '实际飞行距离(米)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_flight_duration INT DEFAULT 0 COMMENT '实际飞行时长(秒)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS max_altitude INT DEFAULT 0 COMMENT '最大飞行高度(米)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS avg_speed INT DEFAULT 0 COMMENT '平均飞行速度(米/秒x100)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trajectory_id BIGINT DEFAULT NULL COMMENT '关联轨迹ID';

-- 目的地信息(终点)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dest_latitude DECIMAL(10,7) DEFAULT NULL COMMENT '目的地纬度';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dest_longitude DECIMAL(10,7) DEFAULT NULL COMMENT '目的地经度';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dest_address VARCHAR(255) DEFAULT NULL COMMENT '目的地地址';

-- 结算信息
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(20) DEFAULT 'pending' COMMENT '结算状态: pending, processing, settled, failed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_at DATETIME DEFAULT NULL COMMENT '结算时间';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pilot_amount BIGINT DEFAULT 0 COMMENT '飞手收益(分)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pilot_commission_rate DECIMAL(5,2) DEFAULT 45.00 COMMENT '飞手分成比例%';


-- ==================== 飞行监控数据表 ====================

-- 1. 飞行实时位置记录表
CREATE TABLE IF NOT EXISTS flight_positions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    pilot_id BIGINT DEFAULT NULL COMMENT '飞手ID',
    
    -- 位置信息
    latitude DECIMAL(10,7) NOT NULL COMMENT '纬度',
    longitude DECIMAL(10,7) NOT NULL COMMENT '经度',
    altitude INT DEFAULT 0 COMMENT '高度(米)',
    
    -- 飞行状态
    speed INT DEFAULT 0 COMMENT '速度(米/秒x100)',
    heading INT DEFAULT 0 COMMENT '航向角(度, 0-360)',
    vertical_speed INT DEFAULT 0 COMMENT '垂直速度(米/秒x100, 正为上升)',
    
    -- 设备状态
    battery_level INT DEFAULT 100 COMMENT '电池电量(%)',
    signal_strength INT DEFAULT 100 COMMENT '信号强度(%)',
    gps_satellites INT DEFAULT 0 COMMENT 'GPS卫星数',
    
    -- 传感器数据
    temperature INT DEFAULT NULL COMMENT '环境温度(摄氏度x10)',
    wind_speed INT DEFAULT NULL COMMENT '风速(米/秒x10)',
    wind_direction INT DEFAULT NULL COMMENT '风向(度)',
    
    recorded_at DATETIME NOT NULL COMMENT '记录时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_order_id (order_id),
    INDEX idx_drone_id (drone_id),
    INDEX idx_recorded_at (recorded_at),
    INDEX idx_order_recorded (order_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='飞行实时位置记录';


-- 2. 飞行告警记录表
CREATE TABLE IF NOT EXISTS flight_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    pilot_id BIGINT DEFAULT NULL COMMENT '飞手ID',
    
    alert_type VARCHAR(50) NOT NULL COMMENT '告警类型: low_battery, geofence, deviation, signal_lost, altitude, speed, weather',
    alert_level VARCHAR(20) NOT NULL COMMENT '告警级别: info, warning, critical',
    alert_code VARCHAR(50) DEFAULT NULL COMMENT '告警代码',
    
    -- 告警详情
    title VARCHAR(200) NOT NULL COMMENT '告警标题',
    description TEXT COMMENT '告警描述',
    
    -- 触发位置
    latitude DECIMAL(10,7) DEFAULT NULL COMMENT '触发位置纬度',
    longitude DECIMAL(10,7) DEFAULT NULL COMMENT '触发位置经度',
    altitude INT DEFAULT NULL COMMENT '触发位置高度',
    
    -- 阈值信息
    threshold_value VARCHAR(50) DEFAULT NULL COMMENT '阈值',
    actual_value VARCHAR(50) DEFAULT NULL COMMENT '实际值',
    
    -- 处理状态
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active, acknowledged, resolved, dismissed',
    acknowledged_at DATETIME DEFAULT NULL COMMENT '确认时间',
    acknowledged_by BIGINT DEFAULT NULL COMMENT '确认人',
    resolved_at DATETIME DEFAULT NULL COMMENT '解决时间',
    resolution_note TEXT COMMENT '解决备注',
    
    triggered_at DATETIME NOT NULL COMMENT '触发时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_order_id (order_id),
    INDEX idx_drone_id (drone_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_status (status),
    INDEX idx_triggered_at (triggered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='飞行告警记录';


-- 3. 电子围栏定义表
CREATE TABLE IF NOT EXISTS geofences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '围栏名称',
    fence_type VARCHAR(30) NOT NULL COMMENT '围栏类型: no_fly(禁飞区), restricted(限飞区), alert(告警区), custom(自定义)',
    
    -- 区域定义
    geometry_type VARCHAR(20) NOT NULL COMMENT '几何类型: circle, polygon',
    center_latitude DECIMAL(10,7) DEFAULT NULL COMMENT '圆心纬度(圆形)',
    center_longitude DECIMAL(10,7) DEFAULT NULL COMMENT '圆心经度(圆形)',
    radius INT DEFAULT NULL COMMENT '半径(米, 圆形)',
    coordinates JSON DEFAULT NULL COMMENT '多边形顶点坐标',
    
    -- 高度限制
    min_altitude INT DEFAULT 0 COMMENT '最低限制高度(米)',
    max_altitude INT DEFAULT 500 COMMENT '最高限制高度(米)',
    
    -- 时间限制
    effective_from DATETIME DEFAULT NULL COMMENT '生效开始时间',
    effective_to DATETIME DEFAULT NULL COMMENT '生效结束时间',
    time_restrictions JSON DEFAULT NULL COMMENT '时间段限制(如仅白天)',
    
    -- 来源信息
    source VARCHAR(50) DEFAULT 'system' COMMENT '来源: system, uom, admin, custom',
    external_id VARCHAR(100) DEFAULT NULL COMMENT '外部系统ID',
    
    -- 规则
    violation_action VARCHAR(30) DEFAULT 'alert' COMMENT '违规动作: alert, block, force_land',
    alert_distance INT DEFAULT 100 COMMENT '预警距离(米)',
    
    description TEXT COMMENT '描述',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active, inactive',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_fence_type (fence_type),
    INDEX idx_status (status),
    INDEX idx_effective (effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='电子围栏定义';


-- 4. 围栏违规记录表
CREATE TABLE IF NOT EXISTS geofence_violations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    geofence_id BIGINT NOT NULL COMMENT '围栏ID',
    flight_alert_id BIGINT DEFAULT NULL COMMENT '关联告警ID',
    
    violation_type VARCHAR(30) NOT NULL COMMENT '违规类型: entered, exited, altitude',
    
    -- 违规位置
    latitude DECIMAL(10,7) NOT NULL COMMENT '违规位置纬度',
    longitude DECIMAL(10,7) NOT NULL COMMENT '违规位置经度',
    altitude INT DEFAULT NULL COMMENT '违规位置高度',
    
    -- 处理
    action_taken VARCHAR(30) DEFAULT NULL COMMENT '采取的动作: alert_sent, flight_paused, force_land',
    
    violated_at DATETIME NOT NULL COMMENT '违规时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_order_id (order_id),
    INDEX idx_geofence_id (geofence_id),
    INDEX idx_violated_at (violated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='围栏违规记录';


-- ==================== 轨迹录制与复用表 ====================

-- 5. 飞行轨迹表
CREATE TABLE IF NOT EXISTS flight_trajectories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT DEFAULT NULL COMMENT '关联订单ID(可为空,表示独立轨迹)',
    drone_id BIGINT NOT NULL COMMENT '无人机ID',
    pilot_id BIGINT DEFAULT NULL COMMENT '飞手ID',
    
    trajectory_no VARCHAR(30) NOT NULL COMMENT '轨迹编号',
    name VARCHAR(100) DEFAULT NULL COMMENT '轨迹名称',
    description TEXT COMMENT '轨迹描述',
    
    -- 起终点信息
    start_latitude DECIMAL(10,7) NOT NULL COMMENT '起点纬度',
    start_longitude DECIMAL(10,7) NOT NULL COMMENT '起点经度',
    start_address VARCHAR(255) DEFAULT NULL COMMENT '起点地址',
    end_latitude DECIMAL(10,7) NOT NULL COMMENT '终点纬度',
    end_longitude DECIMAL(10,7) NOT NULL COMMENT '终点经度',
    end_address VARCHAR(255) DEFAULT NULL COMMENT '终点地址',
    
    -- 轨迹统计
    total_distance INT DEFAULT 0 COMMENT '总距离(米)',
    total_duration INT DEFAULT 0 COMMENT '总时长(秒)',
    waypoint_count INT DEFAULT 0 COMMENT '航点数量',
    max_altitude INT DEFAULT 0 COMMENT '最大高度(米)',
    avg_altitude INT DEFAULT 0 COMMENT '平均高度(米)',
    avg_speed INT DEFAULT 0 COMMENT '平均速度(米/秒x100)',
    
    -- 轨迹数据
    waypoints_data JSON DEFAULT NULL COMMENT '航点数据(精简版,用于快速加载)',
    
    -- 状态
    recording_status VARCHAR(20) DEFAULT 'recording' COMMENT '录制状态: recording, completed, failed',
    started_at DATETIME NOT NULL COMMENT '开始时间',
    ended_at DATETIME DEFAULT NULL COMMENT '结束时间',
    
    -- 复用信息
    is_template TINYINT(1) DEFAULT 0 COMMENT '是否为模板路线',
    use_count INT DEFAULT 0 COMMENT '被复用次数',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    
    UNIQUE INDEX idx_trajectory_no (trajectory_no),
    INDEX idx_order_id (order_id),
    INDEX idx_drone_id (drone_id),
    INDEX idx_pilot_id (pilot_id),
    INDEX idx_is_template (is_template),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='飞行轨迹';


-- 6. 飞行航点表(详细轨迹点)
CREATE TABLE IF NOT EXISTS flight_waypoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trajectory_id BIGINT NOT NULL COMMENT '轨迹ID',
    sequence_no INT NOT NULL COMMENT '序号',
    
    -- 位置
    latitude DECIMAL(10,7) NOT NULL COMMENT '纬度',
    longitude DECIMAL(10,7) NOT NULL COMMENT '经度',
    altitude INT DEFAULT 0 COMMENT '高度(米)',
    
    -- 航点类型
    waypoint_type VARCHAR(20) DEFAULT 'normal' COMMENT '类型: start, normal, hover, action, end',
    
    -- 飞行参数
    speed INT DEFAULT NULL COMMENT '到达此点的速度(米/秒x100)',
    heading INT DEFAULT NULL COMMENT '航向角',
    
    -- 动作(如悬停、拍照等)
    action_type VARCHAR(30) DEFAULT NULL COMMENT '动作类型: hover, photo, video_start, video_stop',
    action_param JSON DEFAULT NULL COMMENT '动作参数',
    action_duration INT DEFAULT 0 COMMENT '动作持续时间(秒)',
    
    -- 时间戳
    recorded_at DATETIME NOT NULL COMMENT '记录时间',
    
    INDEX idx_trajectory_id (trajectory_id),
    INDEX idx_sequence (trajectory_id, sequence_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='飞行航点';


-- 7. 保存的路线模板表
CREATE TABLE IF NOT EXISTS saved_routes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT NOT NULL COMMENT '创建者ID',
    pilot_id BIGINT DEFAULT NULL COMMENT '飞手ID(如果是飞手创建)',
    source_trajectory_id BIGINT DEFAULT NULL COMMENT '来源轨迹ID',
    
    route_no VARCHAR(30) NOT NULL COMMENT '路线编号',
    name VARCHAR(100) NOT NULL COMMENT '路线名称',
    description TEXT COMMENT '路线描述',
    
    -- 起终点
    start_latitude DECIMAL(10,7) NOT NULL COMMENT '起点纬度',
    start_longitude DECIMAL(10,7) NOT NULL COMMENT '起点经度',
    start_address VARCHAR(255) DEFAULT NULL COMMENT '起点地址',
    end_latitude DECIMAL(10,7) NOT NULL COMMENT '终点纬度',
    end_longitude DECIMAL(10,7) NOT NULL COMMENT '终点经度',
    end_address VARCHAR(255) DEFAULT NULL COMMENT '终点地址',
    
    -- 路线特征
    total_distance INT DEFAULT 0 COMMENT '总距离(米)',
    estimated_duration INT DEFAULT 0 COMMENT '预计时长(秒)',
    waypoint_count INT DEFAULT 0 COMMENT '航点数量',
    recommended_altitude INT DEFAULT 100 COMMENT '建议飞行高度(米)',
    
    -- 航点数据
    waypoints JSON NOT NULL COMMENT '航点列表',
    
    -- 适用条件
    min_payload INT DEFAULT 0 COMMENT '最小载荷要求(克)',
    max_payload INT DEFAULT NULL COMMENT '最大载荷限制(克)',
    weather_restrictions JSON DEFAULT NULL COMMENT '天气限制条件',
    time_restrictions JSON DEFAULT NULL COMMENT '时间限制条件',
    
    -- 统计
    use_count INT DEFAULT 0 COMMENT '使用次数',
    success_rate DECIMAL(5,2) DEFAULT 100.00 COMMENT '成功率%',
    avg_actual_duration INT DEFAULT NULL COMMENT '平均实际时长(秒)',
    last_used_at DATETIME DEFAULT NULL COMMENT '最后使用时间',
    
    -- 评价
    rating DECIMAL(3,2) DEFAULT 5.00 COMMENT '评分',
    rating_count INT DEFAULT 0 COMMENT '评分次数',
    
    -- 状态
    visibility VARCHAR(20) DEFAULT 'private' COMMENT '可见性: private, shared, public',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active, inactive, deprecated',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    
    UNIQUE INDEX idx_route_no (route_no),
    INDEX idx_owner_id (owner_id),
    INDEX idx_pilot_id (pilot_id),
    INDEX idx_visibility (visibility),
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保存的路线模板';


-- 8. 多点任务表(多点装卸任务)
CREATE TABLE IF NOT EXISTS multi_point_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    
    task_no VARCHAR(30) NOT NULL COMMENT '任务编号',
    task_type VARCHAR(20) NOT NULL COMMENT '任务类型: pickup(取货), delivery(送货), mixed(混合)',
    
    -- 总体信息
    total_points INT DEFAULT 0 COMMENT '总站点数',
    completed_points INT DEFAULT 0 COMMENT '已完成站点数',
    current_point_index INT DEFAULT 0 COMMENT '当前站点索引',
    
    -- 规划信息
    planned_distance INT DEFAULT 0 COMMENT '规划总距离(米)',
    planned_duration INT DEFAULT 0 COMMENT '规划总时长(秒)',
    actual_distance INT DEFAULT 0 COMMENT '实际总距离(米)',
    actual_duration INT DEFAULT 0 COMMENT '实际总时长(秒)',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending, in_progress, completed, failed',
    started_at DATETIME DEFAULT NULL COMMENT '开始时间',
    completed_at DATETIME DEFAULT NULL COMMENT '完成时间',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_task_no (task_no),
    INDEX idx_order_id (order_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='多点任务';


-- 9. 多点任务站点表
CREATE TABLE IF NOT EXISTS multi_point_task_stops (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT NOT NULL COMMENT '多点任务ID',
    sequence_no INT NOT NULL COMMENT '站点序号',
    
    -- 站点类型
    stop_type VARCHAR(20) NOT NULL COMMENT '站点类型: pickup, delivery, transfer',
    
    -- 位置信息
    latitude DECIMAL(10,7) NOT NULL COMMENT '纬度',
    longitude DECIMAL(10,7) NOT NULL COMMENT '经度',
    address VARCHAR(255) DEFAULT NULL COMMENT '地址',
    contact_name VARCHAR(50) DEFAULT NULL COMMENT '联系人',
    contact_phone VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
    
    -- 货物信息
    cargo_description VARCHAR(255) DEFAULT NULL COMMENT '货物描述',
    cargo_weight INT DEFAULT 0 COMMENT '货物重量(克)',
    cargo_action VARCHAR(20) DEFAULT NULL COMMENT '货物操作: load(装载), unload(卸载)',
    
    -- 时间窗口
    expected_arrival DATETIME DEFAULT NULL COMMENT '预计到达时间',
    time_window_start DATETIME DEFAULT NULL COMMENT '时间窗口开始',
    time_window_end DATETIME DEFAULT NULL COMMENT '时间窗口结束',
    
    -- 实际执行
    actual_arrival DATETIME DEFAULT NULL COMMENT '实际到达时间',
    actual_departure DATETIME DEFAULT NULL COMMENT '实际离开时间',
    dwell_duration INT DEFAULT 0 COMMENT '停留时长(秒)',
    
    -- 确认信息
    confirmation_photos JSON DEFAULT NULL COMMENT '确认照片',
    confirmation_signature VARCHAR(500) DEFAULT NULL COMMENT '签名图片',
    confirmed_at DATETIME DEFAULT NULL COMMENT '确认时间',
    confirmed_by VARCHAR(50) DEFAULT NULL COMMENT '确认人',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态: pending, arrived, in_progress, completed, skipped',
    skip_reason VARCHAR(255) DEFAULT NULL COMMENT '跳过原因',
    notes TEXT COMMENT '备注',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_task_id (task_id),
    INDEX idx_sequence (task_id, sequence_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='多点任务站点';


-- ==================== 订单执行配置表 ====================

-- 10. 飞行监控配置表
CREATE TABLE IF NOT EXISTS flight_monitor_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(50) NOT NULL COMMENT '配置键',
    config_value VARCHAR(255) NOT NULL COMMENT '配置值',
    config_type VARCHAR(20) DEFAULT 'string' COMMENT '值类型: string, int, float, bool',
    description VARCHAR(255) DEFAULT NULL COMMENT '描述',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='飞行监控配置';

-- 插入默认配置
INSERT INTO flight_monitor_configs (config_key, config_value, config_type, description) VALUES
-- 告警阈值
('low_battery_warning', '30', 'int', '低电量预警阈值(%)'),
('low_battery_critical', '15', 'int', '低电量紧急阈值(%)'),
('signal_lost_timeout', '30', 'int', '信号丢失超时(秒)'),
('deviation_warning_distance', '200', 'int', '偏航预警距离(米)'),
('deviation_critical_distance', '500', 'int', '偏航紧急距离(米)'),
('max_altitude_warning', '120', 'int', '最大高度预警(米)'),
('max_speed_warning', '15', 'int', '最大速度预警(米/秒)'),
-- 位置上报
('position_report_interval', '3', 'int', '位置上报间隔(秒)'),
('position_report_min_distance', '5', 'int', '位置上报最小移动距离(米)'),
-- 围栏
('geofence_check_interval', '1', 'int', '围栏检查间隔(秒)'),
('geofence_alert_distance', '100', 'int', '围栏预警距离(米)'),
-- 轨迹
('trajectory_simplify_tolerance', '5', 'int', '轨迹简化容差(米)'),
('trajectory_max_points', '10000', 'int', '轨迹最大点数')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);


-- ==================== 索引优化 ====================

-- 为orders表添加新索引
CREATE INDEX IF NOT EXISTS idx_orders_airspace_status ON orders(airspace_status);
CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_dispatch_task ON orders(dispatch_task_id);
