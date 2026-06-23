-- ============================================================
-- H3.04 广播调度器轮询间隔
-- ============================================================

INSERT INTO system_configs (config_key, config_value, description, updated_at) VALUES
('broadcast.scheduler.tick_seconds', '15', '广播调度器轮询间隔(秒)', NOW(3))
ON DUPLICATE KEY UPDATE
  config_value = VALUES(config_value),
  description = VALUES(description),
  updated_at = VALUES(updated_at);
