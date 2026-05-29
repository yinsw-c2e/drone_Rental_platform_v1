CREATE TABLE IF NOT EXISTS order_broadcast_exclusions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    broadcast_id BIGINT NOT NULL COMMENT '广播池ID',
    provider_user_id BIGINT NOT NULL COMMENT '被排除的服务商用户ID',
    reason VARCHAR(64) NOT NULL DEFAULT '' COMMENT '排除原因',
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_broadcast_exclusions_order_provider (order_id, provider_user_id),
    KEY idx_broadcast_exclusions_broadcast (broadcast_id),
    KEY idx_broadcast_exclusions_provider (provider_user_id),
    CONSTRAINT fk_broadcast_exclusions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_broadcast_exclusions_broadcast FOREIGN KEY (broadcast_id) REFERENCES order_broadcasts(id) ON DELETE CASCADE,
    CONSTRAINT fk_broadcast_exclusions_provider FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单重派广播排除名单';
