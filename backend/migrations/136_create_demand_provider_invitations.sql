-- ============================================================
-- Demand provider invitations for targeted negotiated quotes
-- ============================================================

CREATE TABLE IF NOT EXISTS demand_provider_invitations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  demand_id BIGINT NOT NULL,
  client_user_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_quote',
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_demand_provider_invitation (demand_id, provider_user_id),
  KEY idx_demand_provider_invitations_demand_id (demand_id),
  KEY idx_demand_provider_invitations_client_user_id (client_user_id),
  KEY idx_demand_provider_invitations_provider_user_id (provider_user_id),
  KEY idx_demand_provider_invitations_status (status),
  KEY idx_demand_provider_invitations_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
