-- ============================================================
-- 微信小程序订阅消息一次性授权额度
-- ============================================================

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE TABLE wechat_subscribe_grants (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL COMMENT ''用户ID'',
      template_id VARCHAR(128) NOT NULL COMMENT ''微信订阅消息模板ID'',
      remaining_count INT NOT NULL DEFAULT 0 COMMENT ''剩余可下发次数'',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_wechat_subscribe_user_template (user_id, template_id),
      KEY idx_wechat_subscribe_grants_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''微信订阅消息授权额度''',
    'SELECT 1'
  )
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'wechat_subscribe_grants'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
