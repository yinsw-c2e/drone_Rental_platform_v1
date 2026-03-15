-- 106_split_dispatch_pool_and_formal_dispatch.sql
-- R1.06: 将旧“任务池”语义显式迁移到 dispatch_pool_*，并把 dispatch_tasks / dispatch_logs 重新定义为正式派单对象
-- 创建日期: 2026-03-13

SET @has_dispatch_tasks := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_tasks'
);
SET @has_dispatch_pool_tasks := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_tasks'
);
SET @sql := IF(
    @has_dispatch_tasks > 0 AND @has_dispatch_pool_tasks = 0,
    'RENAME TABLE dispatch_tasks TO dispatch_pool_tasks',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dispatch_candidates := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_candidates'
);
SET @has_dispatch_pool_candidates := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_candidates'
);
SET @sql := IF(
    @has_dispatch_candidates > 0 AND @has_dispatch_pool_candidates = 0,
    'RENAME TABLE dispatch_candidates TO dispatch_pool_candidates',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dispatch_logs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_logs'
);
SET @has_dispatch_pool_logs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_logs'
);
SET @sql := IF(
    @has_dispatch_logs > 0 AND @has_dispatch_pool_logs = 0,
    'RENAME TABLE dispatch_logs TO dispatch_pool_logs',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dispatch_configs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_configs'
);
SET @has_dispatch_pool_configs := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_configs'
);
SET @sql := IF(
    @has_dispatch_configs > 0 AND @has_dispatch_pool_configs = 0,
    'RENAME TABLE dispatch_configs TO dispatch_pool_configs',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS dispatch_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dispatch_no VARCHAR(50) NOT NULL COMMENT '正式派单编号',
    order_id BIGINT NOT NULL COMMENT '对应订单ID',
    provider_user_id BIGINT NOT NULL COMMENT '发起派单的机主账号ID',
    target_pilot_user_id BIGINT NOT NULL COMMENT '目标飞手账号ID',
    dispatch_source VARCHAR(30) NOT NULL COMMENT '派单来源: bound_pilot, candidate_pool, general_pool',
    retry_count INT NOT NULL DEFAULT 0 COMMENT '当前重派次数',
    status VARCHAR(20) NOT NULL DEFAULT 'pending_response' COMMENT 'pending_response, accepted, rejected, expired, executing, finished, exception',
    reason TEXT NULL COMMENT '派单说明',
    sent_at DATETIME NULL COMMENT '发出时间',
    responded_at DATETIME NULL COMMENT '响应时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_dispatch_tasks_dispatch_no (dispatch_no),
    KEY idx_dispatch_tasks_order_id (order_id),
    KEY idx_dispatch_tasks_provider_user_id (provider_user_id),
    KEY idx_dispatch_tasks_target_pilot_user_id (target_pilot_user_id),
    KEY idx_dispatch_tasks_dispatch_source (dispatch_source),
    KEY idx_dispatch_tasks_status (status),
    KEY idx_dispatch_tasks_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='正式派单任务表';

CREATE TABLE IF NOT EXISTS dispatch_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dispatch_task_id BIGINT NOT NULL COMMENT '正式派单任务ID',
    action_type VARCHAR(30) NOT NULL COMMENT 'created, accepted, rejected, expired, reassign, exception_reported',
    operator_user_id BIGINT NOT NULL DEFAULT 0 COMMENT '操作人账号ID',
    note TEXT NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dispatch_logs_dispatch_task_id (dispatch_task_id),
    KEY idx_dispatch_logs_action_type (action_type),
    KEY idx_dispatch_logs_operator_user_id (operator_user_id),
    KEY idx_dispatch_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='正式派单日志表';

-- 补齐旧任务池的 order_id 关联。历史上有一部分数据只在 orders.related_id 中可追溯。
SET @has_pool_task_order_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatch_pool_tasks' AND COLUMN_NAME = 'order_id'
);
SET @sql := IF(
    @has_pool_task_order_col = 0,
    'ALTER TABLE dispatch_pool_tasks ADD COLUMN order_id BIGINT DEFAULT 0 COMMENT ''关联订单ID'' AFTER task_no',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE dispatch_pool_tasks pt
JOIN orders o
  ON o.order_type = 'dispatch'
 AND o.related_id = pt.id
SET pt.order_id = o.id
WHERE COALESCE(pt.order_id, 0) = 0;

INSERT INTO dispatch_tasks (
    dispatch_no,
    order_id,
    provider_user_id,
    target_pilot_user_id,
    dispatch_source,
    retry_count,
    status,
    reason,
    sent_at,
    responded_at,
    created_at,
    updated_at
)
SELECT
    CONCAT('DPLEGACY', LPAD(pt.id, 10, '0')),
    COALESCE(NULLIF(pt.order_id, 0), o.id),
    COALESCE(NULLIF(pt.assigned_owner_id, 0), dc.owner_id, 0),
    COALESCE(NULLIF(p.user_id, 0), 0),
    CASE
        WHEN opb.id IS NOT NULL THEN 'bound_pilot'
        ELSE 'candidate_pool'
    END,
    GREATEST(COALESCE(pt.match_attempts, 1) - 1, 0),
    CASE
        WHEN o.status IN ('in_progress', 'delivered') THEN 'executing'
        WHEN o.status IN ('completed', 'refunded') THEN 'finished'
        WHEN pt.status = 'expired' THEN 'expired'
        ELSE 'accepted'
    END,
    CASE
        WHEN pt.fail_reason IS NOT NULL AND pt.fail_reason <> '' THEN CONCAT('历史任务池迁移：', pt.fail_reason)
        ELSE CONCAT('历史任务池 ', pt.task_no, ' 迁移')
    END,
    COALESCE(dc.notified_at, pt.assigned_at, pt.created_at),
    COALESCE(dc.responded_at, pt.assigned_at, pt.updated_at),
    pt.created_at,
    pt.updated_at
FROM dispatch_pool_tasks pt
LEFT JOIN orders o
  ON o.id = pt.order_id
LEFT JOIN dispatch_pool_candidates dc
  ON dc.task_id = pt.id
 AND dc.pilot_id = pt.assigned_pilot_id
 AND dc.status = 'accepted'
LEFT JOIN pilots p
  ON p.id = pt.assigned_pilot_id
LEFT JOIN owner_pilot_bindings opb
  ON opb.owner_user_id = COALESCE(NULLIF(pt.assigned_owner_id, 0), dc.owner_id)
 AND opb.pilot_user_id = p.user_id
 AND opb.status = 'active'
LEFT JOIN dispatch_tasks ft
  ON ft.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'))
WHERE COALESCE(NULLIF(pt.order_id, 0), o.id, 0) > 0
  AND COALESCE(NULLIF(pt.assigned_owner_id, 0), dc.owner_id, 0) > 0
  AND COALESCE(NULLIF(p.user_id, 0), 0) > 0
  AND ft.id IS NULL;

INSERT INTO dispatch_logs (dispatch_task_id, action_type, operator_user_id, note, created_at)
SELECT
    ft.id,
    'created',
    ft.provider_user_id,
    CONCAT('由历史任务池 ', pt.task_no, ' 创建正式派单'),
    COALESCE(ft.sent_at, ft.created_at)
FROM dispatch_tasks ft
JOIN dispatch_pool_tasks pt
  ON ft.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'))
LEFT JOIN dispatch_logs fl
  ON fl.dispatch_task_id = ft.id
 AND fl.action_type = 'created'
WHERE fl.id IS NULL;

INSERT INTO dispatch_logs (dispatch_task_id, action_type, operator_user_id, note, created_at)
SELECT
    ft.id,
    CASE
        WHEN ft.status = 'expired' THEN 'expired'
        ELSE 'accepted'
    END,
    CASE
        WHEN ft.status = 'expired' THEN ft.provider_user_id
        ELSE ft.target_pilot_user_id
    END,
    CASE
        WHEN ft.status = 'expired' THEN '历史正式派单已过期'
        ELSE '历史飞手已接受正式派单'
    END,
    COALESCE(ft.responded_at, ft.updated_at, ft.created_at)
FROM dispatch_tasks ft
LEFT JOIN dispatch_logs fl
  ON fl.dispatch_task_id = ft.id
 AND fl.action_type IN ('accepted', 'expired')
WHERE ft.dispatch_no LIKE 'DPLEGACY%'
  AND fl.id IS NULL
  AND ft.status IN ('accepted', 'executing', 'finished', 'expired');

UPDATE orders o
JOIN dispatch_tasks ft
  ON ft.order_id = o.id
SET o.dispatch_task_id = ft.id
WHERE o.order_type = 'dispatch';

-- 说明：
-- 1. 旧 dispatch_pool_* 保留任务池语义，继续服务 v1 匹配/候选逻辑
-- 2. 新 dispatch_tasks / dispatch_logs 专用于“订单 -> 飞手”的正式派单指令与状态历史
-- 3. 历史正式派单只回填“已明确接单/已有关联订单”的记录；其余仍保留在任务池，后续由 R1.08 迁移审计补齐
