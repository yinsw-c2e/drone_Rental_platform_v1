-- 107_rebuild_flight_records.sql
-- R1.07: 重建 flight_records，并把 flight_positions / flight_alerts 挂到履约架次记录
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS flight_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    flight_no VARCHAR(50) NOT NULL COMMENT '飞行记录编号',
    order_id BIGINT NOT NULL COMMENT '对应订单ID',
    dispatch_task_id BIGINT NULL COMMENT '对应正式派单ID',
    pilot_user_id BIGINT NOT NULL DEFAULT 0 COMMENT '执行飞手账号ID',
    drone_id BIGINT NOT NULL COMMENT '执行设备ID',
    takeoff_at DATETIME NULL COMMENT '起飞时间',
    landing_at DATETIME NULL COMMENT '降落时间',
    total_duration_seconds INT NOT NULL DEFAULT 0 COMMENT '飞行总时长(秒)',
    total_distance_m DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '飞行总距离(米)',
    max_altitude_m DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最大高度(米)',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, executing, completed, aborted',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_flight_records_flight_no (flight_no),
    KEY idx_flight_records_order_id (order_id),
    KEY idx_flight_records_dispatch_task_id (dispatch_task_id),
    KEY idx_flight_records_pilot_user_id (pilot_user_id),
    KEY idx_flight_records_drone_id (drone_id),
    KEY idx_flight_records_status (status),
    KEY idx_flight_records_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单履约飞行记录表';

SET @has_flight_positions_record_col := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_positions'
      AND COLUMN_NAME = 'flight_record_id'
);
SET @sql := IF(
    @has_flight_positions_record_col = 0,
    'ALTER TABLE flight_positions ADD COLUMN flight_record_id BIGINT NULL COMMENT ''对应飞行记录ID'' AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_flight_alerts_record_col := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_alerts'
      AND COLUMN_NAME = 'flight_record_id'
);
SET @sql := IF(
    @has_flight_alerts_record_col = 0,
    'ALTER TABLE flight_alerts ADD COLUMN flight_record_id BIGINT NULL COMMENT ''对应飞行记录ID'' AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_positions_record := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_positions'
      AND INDEX_NAME = 'idx_flight_positions_record_id'
);
SET @sql := IF(
    @has_idx_positions_record = 0,
    'ALTER TABLE flight_positions ADD INDEX idx_flight_positions_record_id (flight_record_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_alerts_record := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'flight_alerts'
      AND INDEX_NAME = 'idx_flight_alerts_record_id'
);
SET @sql := IF(
    @has_idx_alerts_record = 0,
    'ALTER TABLE flight_alerts ADD INDEX idx_flight_alerts_record_id (flight_record_id)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 第一类回填：以订单执行与位置点为依据，重建每个历史订单的首个履约飞行记录。
INSERT INTO flight_records (
    flight_no,
    order_id,
    dispatch_task_id,
    pilot_user_id,
    drone_id,
    takeoff_at,
    landing_at,
    total_duration_seconds,
    total_distance_m,
    max_altitude_m,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT(o.order_no, '-F1') AS flight_no,
    o.id AS order_id,
    NULLIF(o.dispatch_task_id, 0) AS dispatch_task_id,
    COALESCE(NULLIF(o.executor_pilot_user_id, 0), NULLIF(p.user_id, 0), 0) AS pilot_user_id,
    o.drone_id,
    COALESCE(o.flight_start_time, pos.first_recorded_at) AS takeoff_at,
    COALESCE(o.flight_end_time, pos.last_recorded_at) AS landing_at,
    COALESCE(
        NULLIF(o.actual_flight_duration, 0),
        CASE
            WHEN COALESCE(o.flight_start_time, pos.first_recorded_at) IS NOT NULL
             AND COALESCE(o.flight_end_time, pos.last_recorded_at) IS NOT NULL
             AND COALESCE(o.flight_end_time, pos.last_recorded_at) > COALESCE(o.flight_start_time, pos.first_recorded_at)
            THEN TIMESTAMPDIFF(
                SECOND,
                COALESCE(o.flight_start_time, pos.first_recorded_at),
                COALESCE(o.flight_end_time, pos.last_recorded_at)
            )
            ELSE 0
        END
    ) AS total_duration_seconds,
    COALESCE(NULLIF(o.actual_flight_distance, 0), 0) AS total_distance_m,
    COALESCE(NULLIF(o.max_altitude, 0), pos.max_altitude, 0) AS max_altitude_m,
    CASE
        WHEN o.status = 'cancelled' AND COALESCE(o.flight_start_time, pos.first_recorded_at) IS NOT NULL THEN 'aborted'
        WHEN o.flight_end_time IS NOT NULL OR o.status IN ('delivered', 'completed', 'refunded') THEN 'completed'
        WHEN o.flight_start_time IS NOT NULL OR pos.order_id IS NOT NULL OR o.status = 'in_transit' THEN 'executing'
        ELSE 'pending'
    END AS status,
    o.created_at,
    o.updated_at
FROM orders o
LEFT JOIN pilots p
  ON p.id = o.pilot_id
LEFT JOIN (
    SELECT
        order_id,
        MIN(recorded_at) AS first_recorded_at,
        MAX(recorded_at) AS last_recorded_at,
        MAX(altitude) AS max_altitude
    FROM flight_positions
    GROUP BY order_id
) pos
  ON pos.order_id = o.id
LEFT JOIN flight_records fr
  ON fr.order_id = o.id
 AND fr.deleted_at IS NULL
WHERE o.deleted_at IS NULL
  AND o.drone_id > 0
  AND fr.id IS NULL
  AND (
      pos.order_id IS NOT NULL
      OR o.flight_start_time IS NOT NULL
      OR o.flight_end_time IS NOT NULL
      OR COALESCE(o.actual_flight_distance, 0) > 0
      OR COALESCE(o.actual_flight_duration, 0) > 0
      OR COALESCE(o.max_altitude, 0) > 0
  );

-- 第二类回填：只有飞手历史日志、但订单执行表证据不足的订单，也补一条履约飞行记录。
INSERT INTO flight_records (
    flight_no,
    order_id,
    dispatch_task_id,
    pilot_user_id,
    drone_id,
    takeoff_at,
    landing_at,
    total_duration_seconds,
    total_distance_m,
    max_altitude_m,
    status,
    created_at,
    updated_at
)
SELECT
    CONCAT(o.order_no, '-F1') AS flight_no,
    pl.order_id,
    NULLIF(o.dispatch_task_id, 0) AS dispatch_task_id,
    COALESCE(NULLIF(o.executor_pilot_user_id, 0), NULLIF(pp.user_id, 0), 0) AS pilot_user_id,
    COALESCE(NULLIF(pl.drone_id, 0), o.drone_id) AS drone_id,
    COALESCE(o.flight_start_time, pl.flight_date) AS takeoff_at,
    COALESCE(
        o.flight_end_time,
        DATE_ADD(pl.flight_date, INTERVAL CAST(ROUND(COALESCE(pl.flight_duration, 0) * 60) AS SIGNED) SECOND)
    ) AS landing_at,
    CAST(ROUND(COALESCE(pl.flight_duration, 0) * 60) AS SIGNED) AS total_duration_seconds,
    ROUND(COALESCE(pl.flight_distance, 0) * 1000, 2) AS total_distance_m,
    COALESCE(pl.max_altitude, 0) AS max_altitude_m,
    CASE
        WHEN o.status = 'cancelled' THEN 'aborted'
        ELSE 'completed'
    END AS status,
    COALESCE(pl.created_at, o.created_at),
    COALESCE(pl.created_at, o.updated_at)
FROM pilot_flight_logs pl
JOIN orders o
  ON o.id = pl.order_id
 AND o.deleted_at IS NULL
LEFT JOIN pilots pp
  ON pp.id = pl.pilot_id
LEFT JOIN flight_records fr
  ON fr.order_id = pl.order_id
 AND fr.deleted_at IS NULL
WHERE pl.order_id > 0
  AND COALESCE(NULLIF(pl.drone_id, 0), o.drone_id, 0) > 0
  AND fr.id IS NULL;

-- 把历史位置点和告警挂到新的飞行记录上。迁移期每个历史订单最多先挂到其首条履约飞行记录。
UPDATE flight_positions fp
JOIN (
    SELECT order_id, MIN(id) AS flight_record_id
    FROM flight_records
    WHERE deleted_at IS NULL
    GROUP BY order_id
) fr
  ON fr.order_id = fp.order_id
SET fp.flight_record_id = fr.flight_record_id
WHERE fp.flight_record_id IS NULL;

UPDATE flight_alerts fa
JOIN (
    SELECT order_id, MIN(id) AS flight_record_id
    FROM flight_records
    WHERE deleted_at IS NULL
    GROUP BY order_id
) fr
  ON fr.order_id = fa.order_id
SET fa.flight_record_id = fr.flight_record_id
WHERE fa.flight_record_id IS NULL;

-- 反向同步订单汇总字段，确保旧页面也能读取到真实履约飞行汇总。
UPDATE orders o
JOIN (
    SELECT
        order_id,
        COALESCE(SUM(total_duration_seconds), 0) AS total_duration_seconds,
        COALESCE(ROUND(SUM(total_distance_m)), 0) AS total_distance_m,
        COALESCE(ROUND(MAX(max_altitude_m)), 0) AS max_altitude_m,
        MIN(takeoff_at) AS first_takeoff_at,
        MAX(landing_at) AS last_landing_at
    FROM flight_records
    WHERE deleted_at IS NULL
    GROUP BY order_id
) frs
  ON frs.order_id = o.id
SET o.actual_flight_duration = frs.total_duration_seconds,
    o.actual_flight_distance = frs.total_distance_m,
    o.max_altitude = frs.max_altitude_m,
    o.flight_start_time = COALESCE(o.flight_start_time, frs.first_takeoff_at),
    o.flight_end_time = COALESCE(o.flight_end_time, frs.last_landing_at)
WHERE o.deleted_at IS NULL;
