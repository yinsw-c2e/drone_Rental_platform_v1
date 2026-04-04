-- 110_create_order_contracts.sql
-- 合同签约表：订单成交后自动生成合同，支持双方签署

CREATE TABLE IF NOT EXISTS order_contracts (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  contract_no     VARCHAR(50) NOT NULL UNIQUE COMMENT '合同编号',
  order_id        BIGINT NOT NULL COMMENT '关联订单ID',
  order_no        VARCHAR(30) DEFAULT '' COMMENT '冗余订单编号',
  template_key    VARCHAR(50) DEFAULT 'heavy_cargo_standard' COMMENT '模板标识',

  -- 合同参与方
  client_user_id   BIGINT NOT NULL COMMENT '甲方（客户）用户ID',
  provider_user_id BIGINT NOT NULL COMMENT '乙方（机主）用户ID',

  -- 合同核心条款（从需求+报价自动填充）
  title             VARCHAR(200) DEFAULT '' COMMENT '合同标题',
  service_description TEXT COMMENT '服务内容描述',
  service_address   TEXT COMMENT '服务地址',
  scheduled_start_at DATETIME NULL COMMENT '预约开始时间',
  scheduled_end_at   DATETIME NULL COMMENT '预约结束时间',
  cargo_weight_kg   DECIMAL(10,2) DEFAULT 0 COMMENT '货物重量(kg)',
  estimated_trip_count INT DEFAULT 1 COMMENT '预计架次',
  contract_amount   BIGINT DEFAULT 0 COMMENT '合同金额(分)',
  platform_commission BIGINT DEFAULT 0 COMMENT '平台佣金(分)',
  provider_amount   BIGINT DEFAULT 0 COMMENT '机主到手金额(分)',

  -- 签署状态
  status            VARCHAR(20) DEFAULT 'pending' COMMENT 'pending / client_signed / fully_signed',
  client_signed_at  DATETIME NULL COMMENT '甲方签署时间',
  provider_signed_at DATETIME NULL COMMENT '乙方签署时间',

  -- 合同文本（HTML 渲染）
  contract_html     MEDIUMTEXT COMMENT '合同完整HTML内容',

  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_contract_order (order_id),
  INDEX idx_contract_client (client_user_id),
  INDEX idx_contract_provider (provider_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单合同表';
