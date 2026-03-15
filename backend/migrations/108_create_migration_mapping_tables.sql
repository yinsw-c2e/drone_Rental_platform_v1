-- 108_create_migration_mapping_tables.sql
-- R1.08: 建立迁移映射表与迁移审计表，集中记录旧表 -> 新表映射，以及不确定数据的审计清单
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS migration_entity_mappings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    legacy_table VARCHAR(100) NOT NULL COMMENT '旧表名',
    legacy_id VARCHAR(100) NOT NULL COMMENT '旧记录ID',
    new_table VARCHAR(100) NOT NULL COMMENT '新表名',
    new_id VARCHAR(100) NOT NULL COMMENT '新记录ID',
    mapping_type VARCHAR(20) NOT NULL DEFAULT 'migrated' COMMENT 'migrated, merged, derived',
    mapping_note VARCHAR(255) DEFAULT '' COMMENT '映射说明',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_migration_entity_mapping (legacy_table, legacy_id, new_table, new_id),
    KEY idx_migration_entity_legacy (legacy_table, legacy_id),
    KEY idx_migration_entity_new (new_table, new_id),
    KEY idx_migration_entity_mapping_type (mapping_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='迁移实体映射表';

CREATE TABLE IF NOT EXISTS migration_audit_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    audit_stage VARCHAR(50) NOT NULL COMMENT '审计阶段',
    legacy_table VARCHAR(100) NOT NULL COMMENT '旧表名',
    legacy_id VARCHAR(100) NOT NULL DEFAULT '' COMMENT '旧记录ID',
    related_table VARCHAR(100) NOT NULL DEFAULT '' COMMENT '关联新表名',
    related_id VARCHAR(100) NOT NULL DEFAULT '' COMMENT '关联新记录ID',
    issue_type VARCHAR(50) NOT NULL COMMENT '问题类型',
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' COMMENT 'info, warning, critical',
    issue_message TEXT NOT NULL COMMENT '问题描述',
    payload_json JSON NULL COMMENT '补充上下文',
    resolution_status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open, resolved, ignored',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_migration_audit_issue (audit_stage, legacy_table, legacy_id, related_table, related_id, issue_type),
    KEY idx_migration_audit_legacy (legacy_table, legacy_id),
    KEY idx_migration_audit_related (related_table, related_id),
    KEY idx_migration_audit_issue_type (issue_type),
    KEY idx_migration_audit_resolution_status (resolution_status),
    KEY idx_migration_audit_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='迁移审计记录表';

-- ==================== 关键映射回填 ====================

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'users',
    CAST(cp.user_id AS CHAR),
    'client_profiles',
    CAST(cp.id AS CHAR),
    'derived',
    'default_client_profile'
FROM client_profiles cp;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'users',
    CAST(op.user_id AS CHAR),
    'owner_profiles',
    CAST(op.id AS CHAR),
    'derived',
    'owner_profile_from_assets'
FROM owner_profiles op;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'pilots',
    CAST(p.id AS CHAR),
    'pilot_profiles',
    CAST(pp.id AS CHAR),
    'derived',
    'pilot_profile_from_legacy_pilot'
FROM pilots p
JOIN pilot_profiles pp ON pp.user_id = p.user_id;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'rental_offers',
    CAST(ro.id AS CHAR),
    'owner_supplies',
    CAST(os.id AS CHAR),
    'migrated',
    'legacy_offer_to_owner_supply'
FROM rental_offers ro
JOIN owner_supplies os
  ON os.supply_no = CONCAT('SPLEGACY', LPAD(ro.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'pilot_drone_bindings',
    CAST(pb.id AS CHAR),
    'owner_pilot_bindings',
    CAST(opb.id AS CHAR),
    'merged',
    'legacy_binding_merged_by_owner_user_and_pilot_user'
FROM pilot_drone_bindings pb
JOIN pilots p ON p.id = pb.pilot_id
JOIN owner_pilot_bindings opb
  ON opb.owner_user_id = pb.owner_id
 AND opb.pilot_user_id = p.user_id
 AND opb.deleted_at IS NULL;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'rental_demands',
    CAST(rd.id AS CHAR),
    'demands',
    CAST(d.id AS CHAR),
    'migrated',
    'legacy_rental_demand_to_v2_demand'
FROM rental_demands rd
JOIN demands d
  ON d.demand_no = CONCAT('DMRLEGACY', LPAD(rd.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'cargo_demands',
    CAST(cd.id AS CHAR),
    'demands',
    CAST(d.id AS CHAR),
    'migrated',
    'legacy_cargo_demand_to_v2_demand'
FROM cargo_demands cd
JOIN demands d
  ON d.demand_no = CONCAT('DMCLEGACY', LPAD(cd.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'dispatch_pool_tasks',
    CAST(pt.id AS CHAR),
    'dispatch_tasks',
    CAST(dt.id AS CHAR),
    'migrated',
    'legacy_dispatch_pool_to_formal_dispatch'
FROM dispatch_pool_tasks pt
JOIN dispatch_tasks dt
  ON dt.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'));

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'payments',
    CAST(p.id AS CHAR),
    'refunds',
    CAST(r.id AS CHAR),
    'derived',
    'legacy_refunded_payment_to_refund_record'
FROM payments p
JOIN refunds r ON r.payment_id = p.id;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'orders',
    CAST(o.id AS CHAR),
    'flight_records',
    CAST(fr.id AS CHAR),
    'derived',
    'order_execution_to_flight_record'
FROM orders o
JOIN flight_records fr ON fr.order_id = o.id AND fr.deleted_at IS NULL;

INSERT IGNORE INTO migration_entity_mappings (
    legacy_table, legacy_id, new_table, new_id, mapping_type, mapping_note
)
SELECT
    'pilot_flight_logs',
    CAST(pfl.id AS CHAR),
    'flight_records',
    CAST(fr.id AS CHAR),
    'merged',
    'order_linked_pilot_flight_log_to_flight_record'
FROM pilot_flight_logs pfl
JOIN flight_records fr ON fr.order_id = pfl.order_id AND fr.deleted_at IS NULL
WHERE pfl.order_id > 0;

-- ==================== 迁移审计回填 ====================

-- 1. 历史直达订单未能解析 source_supply_id
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'orders',
    'orders',
    CAST(o.id AS CHAR),
    'owner_supplies',
    '',
    'missing_source_supply',
    'warning',
    '历史直达订单未能回填 source_supply_id，需要人工补齐后再纳入 v2 直达链路统计',
    JSON_OBJECT(
        'order_no', o.order_no,
        'order_type', o.order_type,
        'owner_id', o.owner_id,
        'drone_id', o.drone_id
    )
FROM orders o
WHERE o.deleted_at IS NULL
  AND o.order_source = 'supply_direct'
  AND COALESCE(o.source_supply_id, 0) = 0;

-- 2. 历史退款支付未生成正式 refunds 记录
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'refunds',
    'payments',
    CAST(p.id AS CHAR),
    'orders',
    CAST(p.order_id AS CHAR),
    'missing_refund_record',
    'warning',
    '历史支付记录显示已退款，但 refunds 表中不存在对应记录，需要人工核对是否为部分退款或异常退款',
    JSON_OBJECT(
        'payment_no', p.payment_no,
        'amount', p.amount,
        'status', p.status
    )
FROM payments p
LEFT JOIN refunds r ON r.payment_id = p.id
WHERE p.status = 'refunded'
  AND p.order_id > 0
  AND r.id IS NULL;

-- 3. 历史任务池记录未能明确回填为正式派单
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'dispatch',
    'dispatch_pool_tasks',
    CAST(pt.id AS CHAR),
    'dispatch_tasks',
    '',
    'unmapped_formal_dispatch',
    'warning',
    '历史任务池记录未能明确回填为正式派单，需人工判断其是否应转入正式 dispatch_tasks',
    JSON_OBJECT(
        'task_no', pt.task_no,
        'status', pt.status,
        'order_id', COALESCE(pt.order_id, 0),
        'assigned_owner_id', COALESCE(pt.assigned_owner_id, 0),
        'assigned_pilot_id', COALESCE(pt.assigned_pilot_id, 0)
    )
FROM dispatch_pool_tasks pt
LEFT JOIN dispatch_tasks dt
  ON dt.dispatch_no = CONCAT('DPLEGACY', LPAD(pt.id, 10, '0'))
WHERE dt.id IS NULL
  AND (
      COALESCE(pt.order_id, 0) > 0
      OR COALESCE(pt.assigned_owner_id, 0) > 0
      OR COALESCE(pt.assigned_pilot_id, 0) > 0
      OR pt.status IN ('matched', 'assigned', 'accepted', 'expired', 'completed', 'failed')
  );

-- 4. 有订单归属的历史飞手飞行日志，未能挂到 flight_records
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'flight',
    'pilot_flight_logs',
    CAST(pfl.id AS CHAR),
    'orders',
    CAST(pfl.order_id AS CHAR),
    'unmapped_order_flight_log',
    'warning',
    '历史飞手飞行日志已关联订单，但未能生成履约 flight_record，需要人工核对订单与飞行数据',
    JSON_OBJECT(
        'pilot_id', pfl.pilot_id,
        'drone_id', pfl.drone_id,
        'flight_date', DATE_FORMAT(pfl.flight_date, '%Y-%m-%d %H:%i:%s')
    )
FROM pilot_flight_logs pfl
LEFT JOIN flight_records fr ON fr.order_id = pfl.order_id AND fr.deleted_at IS NULL
WHERE pfl.order_id > 0
  AND fr.id IS NULL;

-- 5. 仍未挂 flight_record_id 的位置点与告警，统一进入审计
INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'flight',
    'flight_positions',
    CAST(fp.id AS CHAR),
    'orders',
    CAST(fp.order_id AS CHAR),
    'missing_flight_record_link',
    'warning',
    '历史位置点未能挂到任何 flight_record，需要人工核对订单履约链路',
    JSON_OBJECT(
        'drone_id', fp.drone_id,
        'pilot_id', fp.pilot_id,
        'recorded_at', DATE_FORMAT(fp.recorded_at, '%Y-%m-%d %H:%i:%s')
    )
FROM flight_positions fp
WHERE COALESCE(fp.flight_record_id, 0) = 0
  AND COALESCE(fp.order_id, 0) > 0;

INSERT IGNORE INTO migration_audit_records (
    audit_stage,
    legacy_table,
    legacy_id,
    related_table,
    related_id,
    issue_type,
    severity,
    issue_message,
    payload_json
)
SELECT
    'flight',
    'flight_alerts',
    CAST(fa.id AS CHAR),
    'orders',
    CAST(fa.order_id AS CHAR),
    'missing_flight_record_link',
    'warning',
    '历史飞行告警未能挂到任何 flight_record，需要人工核对订单履约链路',
    JSON_OBJECT(
        'alert_type', fa.alert_type,
        'alert_level', fa.alert_level,
        'drone_id', fa.drone_id
    )
FROM flight_alerts fa
WHERE COALESCE(fa.flight_record_id, 0) = 0
  AND COALESCE(fa.order_id, 0) > 0;
