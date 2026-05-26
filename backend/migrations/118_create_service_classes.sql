-- ============================================================
-- H1 货拉拉式平台计价：机型档与默认价目表
-- ============================================================

CREATE TABLE IF NOT EXISTS service_classes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    mtow_min_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    mtow_max_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payload_min_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payload_max_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    base_price_cents BIGINT NOT NULL DEFAULT 0,
    per_km_price_cents BIGINT NOT NULL DEFAULT 0,
    per_minute_price_cents BIGINT NOT NULL DEFAULT 0,
    min_charge_cents BIGINT NOT NULL DEFAULT 0,
    night_surcharge_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    plateau_surcharge_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    emergency_surcharge_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    island_surcharge_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE KEY uk_service_classes_code (code),
    KEY idx_service_classes_status_sort (status, sort_order),
    KEY idx_service_classes_payload (payload_min_kg, payload_max_kg)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='货拉拉式机型档与平台计价规则';

INSERT INTO service_classes (
    code,
    display_name,
    mtow_min_kg,
    mtow_max_kg,
    payload_min_kg,
    payload_max_kg,
    base_price_cents,
    per_km_price_cents,
    per_minute_price_cents,
    min_charge_cents,
    night_surcharge_rate,
    plateau_surcharge_rate,
    emergency_surcharge_rate,
    island_surcharge_rate,
    status,
    sort_order
) VALUES
    ('light_heavy', '轻型重载', 150.00, 300.00, 50.00, 80.00, 60000, 8000, 1200, 80000, 0.2000, 0.1500, 0.3000, 0.2000, 'active', 10),
    ('medium_heavy', '中型重载', 300.00, 600.00, 80.00, 150.00, 90000, 12000, 1600, 120000, 0.2000, 0.1500, 0.3000, 0.2000, 'active', 20),
    ('super_heavy', '超重载', 600.00, 0.00, 150.00, 0.00, 150000, 20000, 2500, 200000, 0.2000, 0.1500, 0.3000, 0.2000, 'active', 30)
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    mtow_min_kg = VALUES(mtow_min_kg),
    mtow_max_kg = VALUES(mtow_max_kg),
    payload_min_kg = VALUES(payload_min_kg),
    payload_max_kg = VALUES(payload_max_kg),
    base_price_cents = VALUES(base_price_cents),
    per_km_price_cents = VALUES(per_km_price_cents),
    per_minute_price_cents = VALUES(per_minute_price_cents),
    min_charge_cents = VALUES(min_charge_cents),
    night_surcharge_rate = VALUES(night_surcharge_rate),
    plateau_surcharge_rate = VALUES(plateau_surcharge_rate),
    emergency_surcharge_rate = VALUES(emergency_surcharge_rate),
    island_surcharge_rate = VALUES(island_surcharge_rate),
    status = VALUES(status),
    sort_order = VALUES(sort_order),
    updated_at = CURRENT_TIMESTAMP(3);
