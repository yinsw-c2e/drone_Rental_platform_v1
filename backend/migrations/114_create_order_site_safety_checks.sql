-- 114_create_order_site_safety_checks.sql
-- 08 服务商履约安排：现场安全复核证据表

CREATE TABLE IF NOT EXISTS order_site_safety_checks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL COMMENT '关联订单ID',
  operator_user_id BIGINT NOT NULL COMMENT '复核操作用户ID',
  operator_role VARCHAR(20) DEFAULT '' COMMENT 'owner / pilot',
  status VARCHAR(20) NOT NULL DEFAULT 'completed' COMMENT 'completed',
  checklist JSON NULL COMMENT '现场复核清单',
  photos JSON NULL COMMENT '现场照片URL数组',
  note TEXT NULL COMMENT '复核备注',
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '复核时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_site_safety_order_id (order_id),
  KEY idx_site_safety_operator_user_id (operator_user_id),
  KEY idx_site_safety_operator_role (operator_role),
  KEY idx_site_safety_status (status),
  KEY idx_site_safety_checked_at (checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单现场安全复核证据表';
