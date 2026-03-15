-- 101_create_role_profile_tables.sql
-- R1.01: 创建 v2 角色档案基础表
-- 创建日期: 2026-03-13

CREATE TABLE IF NOT EXISTS client_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联 users.id',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '档案状态: active, disabled',
    default_contact_name VARCHAR(50) DEFAULT '' COMMENT '默认联系人',
    default_contact_phone VARCHAR(20) DEFAULT '' COMMENT '默认联系电话',
    preferred_city VARCHAR(50) DEFAULT '' COMMENT '常用城市',
    remark TEXT COMMENT '备注',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_client_profiles_status (status),
    INDEX idx_client_profiles_preferred_city (preferred_city),
    INDEX idx_client_profiles_deleted_at (deleted_at),
    CONSTRAINT fk_client_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 客户档案表';

CREATE TABLE IF NOT EXISTS owner_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联 users.id',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态: pending, verified, rejected',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '档案状态: active, disabled',
    service_city VARCHAR(50) DEFAULT '' COMMENT '常驻服务城市',
    contact_phone VARCHAR(20) DEFAULT '' COMMENT '业务联系电话',
    intro TEXT COMMENT '机主介绍',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_owner_profiles_verification_status (verification_status),
    INDEX idx_owner_profiles_status (status),
    INDEX idx_owner_profiles_service_city (service_city),
    INDEX idx_owner_profiles_deleted_at (deleted_at),
    CONSTRAINT fk_owner_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 机主档案表';

CREATE TABLE IF NOT EXISTS pilot_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE COMMENT '关联 users.id',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态: pending, verified, rejected',
    availability_status VARCHAR(20) NOT NULL DEFAULT 'offline' COMMENT '接单状态: offline, online, busy',
    service_radius_km INT NOT NULL DEFAULT 50 COMMENT '服务半径(公里)',
    service_cities JSON COMMENT '服务城市列表',
    skill_tags JSON COMMENT '技能标签',
    caac_license_no VARCHAR(50) DEFAULT '' COMMENT '执照编号',
    caac_license_expire_at DATETIME NULL COMMENT '执照到期时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,

    INDEX idx_pilot_profiles_verification_status (verification_status),
    INDEX idx_pilot_profiles_availability_status (availability_status),
    INDEX idx_pilot_profiles_caac_license_no (caac_license_no),
    INDEX idx_pilot_profiles_deleted_at (deleted_at),
    CONSTRAINT fk_pilot_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='v2 飞手档案表';

-- ==================== 历史数据回填 ====================
-- 说明：
-- 1. 所有现有账号默认补一条 client_profiles
-- 2. 已有无人机或供给的用户补 owner_profiles
-- 3. 已有 pilots 档案的用户补 pilot_profiles

INSERT INTO client_profiles (
    user_id,
    status,
    default_contact_name,
    default_contact_phone,
    preferred_city,
    remark
)
SELECT
    u.id,
    'active',
    COALESCE(NULLIF(u.nickname, ''), NULLIF(u.phone, ''), CONCAT('用户', u.id)),
    COALESCE(u.phone, ''),
    '',
    'backfilled_from_users'
FROM users u
LEFT JOIN client_profiles cp ON cp.user_id = u.id
WHERE cp.id IS NULL;

INSERT INTO owner_profiles (
    user_id,
    verification_status,
    status,
    service_city,
    contact_phone,
    intro
)
SELECT
    base.user_id,
    'pending',
    'active',
    COALESCE(base.service_city, ''),
    COALESCE(u.phone, ''),
    'backfilled_from_legacy_assets'
FROM (
    SELECT d.owner_id AS user_id, MAX(COALESCE(d.city, '')) AS service_city
    FROM drones d
    WHERE d.deleted_at IS NULL
    GROUP BY d.owner_id
    UNION
    SELECT ro.owner_id AS user_id, MAX('') AS service_city
    FROM rental_offers ro
    WHERE ro.deleted_at IS NULL
    GROUP BY ro.owner_id
) base
INNER JOIN users u ON u.id = base.user_id
LEFT JOIN owner_profiles op ON op.user_id = base.user_id
WHERE op.id IS NULL;

INSERT INTO pilot_profiles (
    user_id,
    verification_status,
    availability_status,
    service_radius_km,
    service_cities,
    skill_tags,
    caac_license_no,
    caac_license_expire_at
)
SELECT
    p.user_id,
    COALESCE(NULLIF(p.verification_status, ''), 'pending'),
    COALESCE(NULLIF(p.availability_status, ''), 'offline'),
    COALESCE(NULLIF(CAST(ROUND(p.service_radius) AS SIGNED), 0), 50),
    JSON_ARRAY(COALESCE(NULLIF(p.current_city, ''), '')),
    COALESCE(p.special_skills, JSON_ARRAY()),
    COALESCE(p.caac_license_no, ''),
    p.caac_license_expire_date
FROM pilots p
LEFT JOIN pilot_profiles pp ON pp.user_id = p.user_id
WHERE pp.id IS NULL
  AND p.deleted_at IS NULL;
