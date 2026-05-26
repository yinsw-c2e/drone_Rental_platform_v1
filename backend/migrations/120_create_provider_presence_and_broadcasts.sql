-- ============================================================
-- H3 服务商在线状态与抢单广播池
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_presences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    online TINYINT(1) NOT NULL DEFAULT 0,
    last_latitude DECIMAL(10,7) NOT NULL DEFAULT 0.0000000,
    last_longitude DECIMAL(10,7) NOT NULL DEFAULT 0.0000000,
    last_heartbeat_at DATETIME(3) NULL,
    accepted_service_classes JSON NULL,
    max_radius_km DECIMAL(8,2) NOT NULL DEFAULT 30.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE KEY uk_provider_presences_user_id (user_id),
    KEY idx_provider_presences_online_heartbeat (online, last_heartbeat_at),
    KEY idx_provider_presences_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务商在线接单状态';

CREATE TABLE IF NOT EXISTS order_broadcasts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    origin_latitude DECIMAL(10,7) NOT NULL DEFAULT 0.0000000,
    origin_longitude DECIMAL(10,7) NOT NULL DEFAULT 0.0000000,
    service_class_code VARCHAR(50) NOT NULL DEFAULT '',
    weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estimated_total_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    expires_at DATETIME(3) NOT NULL,
    grabbed_by_user_id BIGINT NOT NULL DEFAULT 0,
    grabbed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE KEY uk_order_broadcasts_order_id (order_id),
    KEY idx_order_broadcasts_status_expires (status, expires_at),
    KEY idx_order_broadcasts_service_class (service_class_code),
    KEY idx_order_broadcasts_origin (origin_latitude, origin_longitude),
    KEY idx_order_broadcasts_grabbed_by (grabbed_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='即时/预约订单抢单广播池';
