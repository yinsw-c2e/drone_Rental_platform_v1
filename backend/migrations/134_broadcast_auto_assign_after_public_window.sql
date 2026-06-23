-- ============================================================
-- H3.04 广播公开倒计时结束后再进入自动指派
-- ============================================================

INSERT INTO system_configs (config_key, config_value, description, updated_at) VALUES
('broadcast.ttl_seconds', '120', '公开抢单倒计时(秒)', NOW(3)),
('broadcast.auto_assign.trigger_lead_seconds', '0', '公开倒计时结束后进入自动指派', NOW(3)),
('broadcast.auto_assign.accept_window_seconds', '60', '自动指派确认时限(秒)', NOW(3))
ON DUPLICATE KEY UPDATE
  config_value = VALUES(config_value),
  description = VALUES(description),
  updated_at = VALUES(updated_at);
