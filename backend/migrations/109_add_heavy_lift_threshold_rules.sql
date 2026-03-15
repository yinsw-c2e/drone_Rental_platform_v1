-- 109_add_heavy_lift_threshold_rules.sql
-- R1.09: 落地平台重载准入字段与校验规则
-- 创建日期: 2026-03-13

ALTER TABLE drones
    ADD COLUMN IF NOT EXISTS mtow_kg DECIMAL(10,2) DEFAULT 0 COMMENT '最大起飞重量(kg)' AFTER serial_number,
    ADD COLUMN IF NOT EXISTS max_payload_kg DECIMAL(10,2) DEFAULT 0 COMMENT '最大载重能力(kg)' AFTER mtow_kg;

ALTER TABLE drones
    ADD INDEX IF NOT EXISTS idx_drones_mtow_kg (mtow_kg),
    ADD INDEX IF NOT EXISTS idx_drones_max_payload_kg (max_payload_kg);

-- 历史兼容：若尚未填写 max_payload_kg，则沿用 legacy max_load
UPDATE drones
SET max_payload_kg = COALESCE(NULLIF(max_payload_kg, 0), max_load, 0)
WHERE COALESCE(max_payload_kg, 0) = 0;

-- 同步 owner_supplies 的机型能力字段
UPDATE owner_supplies os
JOIN drones d ON d.id = os.drone_id
SET os.mtow_kg = d.mtow_kg,
    os.max_payload_kg = COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load, 0),
    os.max_range_km = d.max_distance,
    os.updated_at = CURRENT_TIMESTAMP
WHERE os.deleted_at IS NULL;

-- 对历史 legacy offer 供给，若当前机型已满足重载准入且 offer 仍为 active，则允许从此前的保守 paused 放开到 active
UPDATE owner_supplies os
JOIN drones d ON d.id = os.drone_id
JOIN rental_offers ro
  ON os.supply_no = CONCAT('SPLEGACY', LPAD(ro.id, 10, '0'))
SET os.status = 'active',
    os.updated_at = CURRENT_TIMESTAMP
WHERE os.deleted_at IS NULL
  AND os.status IN ('paused', 'active')
  AND ro.deleted_at IS NULL
  AND ro.status = 'active'
  AND d.availability_status = 'available'
  AND d.certification_status = 'approved'
  AND d.uom_verified = 'verified'
  AND d.insurance_verified = 'verified'
  AND d.airworthiness_verified = 'verified'
  AND d.mtow_kg >= 150
  AND COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load) >= 50;

-- 不满足平台准入的 active 供给统一降为 paused，禁止继续进入主市场
UPDATE owner_supplies os
JOIN drones d ON d.id = os.drone_id
SET os.status = 'paused',
    os.updated_at = CURRENT_TIMESTAMP
WHERE os.deleted_at IS NULL
  AND os.status = 'active'
  AND (
      d.availability_status <> 'available'
      OR d.certification_status <> 'approved'
      OR d.uom_verified <> 'verified'
      OR d.insurance_verified <> 'verified'
      OR d.airworthiness_verified <> 'verified'
      OR d.mtow_kg < 150
      OR COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load) < 50
  );

-- 审计：仍在 active 的 legacy offer 若机型不达标，应列入审计，防止旧公开市场继续暴露
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
    'heavy_lift_threshold',
    'rental_offers',
    CAST(ro.id AS CHAR),
    'drones',
    CAST(d.id AS CHAR),
    'ineligible_active_offer',
    'warning',
    '历史 active 供给对应无人机不满足平台重载准入，已从主市场过滤，需人工补齐机型能力或下架旧供给',
    JSON_OBJECT(
        'offer_title', ro.title,
        'drone_id', d.id,
        'mtow_kg', d.mtow_kg,
        'max_payload_kg', COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load, 0),
        'availability_status', d.availability_status,
        'certification_status', d.certification_status,
        'uom_verified', d.uom_verified,
        'insurance_verified', d.insurance_verified,
        'airworthiness_verified', d.airworthiness_verified
    )
FROM rental_offers ro
JOIN drones d ON d.id = ro.drone_id
WHERE ro.deleted_at IS NULL
  AND ro.status = 'active'
  AND (
      d.mtow_kg < 150
      OR COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load) < 50
      OR d.availability_status <> 'available'
      OR d.certification_status <> 'approved'
      OR d.uom_verified <> 'verified'
      OR d.insurance_verified <> 'verified'
      OR d.airworthiness_verified <> 'verified'
  );

-- 审计：仍未补齐 mtow_kg 的机型，后续不能进入主市场
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
    'heavy_lift_threshold',
    'drones',
    CAST(d.id AS CHAR),
    'owner_supplies',
    CAST(os.id AS CHAR),
    'missing_mtow_kg',
    'warning',
    '无人机未补齐 mtow_kg，无法判断是否满足平台重载准入，当前不纳入主市场匹配池',
    JSON_OBJECT(
        'owner_id', d.owner_id,
        'serial_number', d.serial_number,
        'max_payload_kg', COALESCE(NULLIF(d.max_payload_kg, 0), d.max_load, 0),
        'supply_status', COALESCE(os.status, '')
    )
FROM drones d
LEFT JOIN owner_supplies os
  ON os.drone_id = d.id
 AND os.deleted_at IS NULL
WHERE COALESCE(d.mtow_kg, 0) = 0;
