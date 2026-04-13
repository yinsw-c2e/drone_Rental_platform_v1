# 无人机服务平台字段字典

## 1. 文档目的

本文件是 [BUSINESS_ROLE_REDESIGN.md](./BUSINESS_ROLE_REDESIGN.md) 的配套字段字典。

它的作用不是定义数据库语法细节，而是统一后续重构时的：

- 核心实体命名
- 关键字段语义
- 状态枚举口径
- 前后端共享的字段解释

当前阶段的边界约束：

- 暂不引入 `服务商/团队` 这一层
- 暂不将 `需求类型` 拆成复杂主分支
- 角色判断不再依赖单一 `user_type`
- 平台当前只承接 `heavy_cargo_lift_transport`，不承接城市即时配送和通用无人机服务

## 2. 全局命名规则

### 2.1 主键与关联键

- 所有主键统一为 `id`
- 用户关联统一使用 `*_user_id`
- 业务对象关联统一使用 `*_id`
- 所有编号字段统一使用 `*_no`

### 2.2 状态字段

- 流程状态统一使用 `status`
- 审核状态统一使用 `verification_status`
- 在线状态统一使用 `availability_status`
- 删除统一使用软删除，不用业务字段表达删除

### 2.3 时间字段

- 创建时间：`created_at`
- 更新时间：`updated_at`
- 删除时间：`deleted_at`
- 业务动作时间：按语义命名，如 `paid_at`、`accepted_at`、`takeoff_at`

### 2.4 快照字段

凡是进入履约阶段的对象，尽量保存快照，不依赖运行时拼装。

建议统一命名：

- `*_snapshot`

例如：

- `cargo_snapshot`
- `pricing_snapshot`
- `client_snapshot`
- `execution_snapshot`
- `departure_address_snapshot`
- `destination_address_snapshot`
- `service_address_snapshot`

### 2.5 来源追溯字段

为了同时支持 `需求转单` 和 `供给直达下单` 两种订单来源，建议统一约束：

- 订单来源字段统一使用 `order_source`
- 来源业务对象字段统一使用 `source_*_id`

当前阶段约定：

- `order_source = demand_market` 时，`demand_id` 必填，`source_supply_id` 可为空
- `order_source = supply_direct` 时，`source_supply_id` 必填，`demand_id` 为空

### 2.6 重载准入规则

当前平台的市场准入门槛建议固定为：

- `drones.mtow_kg >= 150`
- `drones.max_payload_kg >= 50`

只有同时满足上述门槛，且资质有效的无人机，才允许进入主匹配池与生效中的供给。

补充规则：

- 关键资质重新提交并进入 `pending` 时，对应 `owner_supplies` 必须立即降级为 `paused`
- legacy `rental_offers.status = active` 的历史供给，在关联无人机重新满足门槛与资质要求后，可自动恢复为 `active`

### 2.7 地址快照统一结构

`departure_address_snapshot / destination_address_snapshot / service_address_snapshot` 建议统一使用同一结构：

```json
{
  "text": "广东省清远市连山壮族瑶族自治县某吊运点",
  "latitude": 24.123456,
  "longitude": 112.123456,
  "city": "清远市",
  "district": "连山壮族瑶族自治县"
}
```

字段约束建议：

- `text`：必填，完整地址描述
- `latitude / longitude`：强烈建议填写，用于匹配、距离估算和轨迹展示
- `city / district`：用于市场筛选和运营统计

## 3. 账号与档案实体

### 3.1 `users`

账号基础表，只承担登录和通用资料，不承担完整业务角色判断。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| phone | varchar | 手机号，唯一 |
| password_hash | varchar | 密码哈希 |
| nickname | varchar | 昵称 |
| avatar_url | varchar | 头像 |
| real_name | varchar | 真实姓名，可选 |
| id_verified | varchar | 实名状态 |
| status | varchar | 账号状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |
| deleted_at | datetime | 软删除时间 |

约束说明：

- `users` 不再作为客户/机主/飞手角色的唯一判定来源
- 原有 `user_type` 可作为历史兼容字段保留迁移期，但不参与新逻辑判断

### 3.2 `client_profiles`

客户档案表。注册后自动创建。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| user_id | bigint | 对应账号 |
| status | varchar | 档案状态 |
| default_contact_name | varchar | 默认联系人 |
| default_contact_phone | varchar | 默认联系电话 |
| preferred_city | varchar | 常用城市 |
| remark | text | 备注 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `active`
- `disabled`

### 3.3 `owner_profiles`

机主档案表。用于表达“具备机主身份”，但不等于一定可供给。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| user_id | bigint | 对应账号 |
| verification_status | varchar | 机主档案审核状态 |
| status | varchar | 档案状态 |
| service_city | varchar | 常驻服务城市 |
| contact_phone | varchar | 业务联系电话 |
| intro | text | 机主介绍 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `status`: `active`, `disabled`
- `verification_status`: `pending`, `verified`, `rejected`

### 3.4 `pilot_profiles`

飞手档案表。用于表达“具备飞手身份”。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| user_id | bigint | 对应账号 |
| verification_status | varchar | 飞手审核状态 |
| availability_status | varchar | 接单状态 |
| service_radius_km | int | 服务半径 |
| service_cities | json | 服务城市列表 |
| skill_tags | json | 技能标签 |
| caac_license_no | varchar | 执照编号 |
| caac_license_expire_at | datetime | 执照过期时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `verification_status`: `pending`, `verified`, `rejected`
- `availability_status`: `online`, `busy`, `offline`

## 4. 设备与供给实体

### 4.1 `drones`

无人机资产表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| owner_user_id | bigint | 机主账号 |
| drone_no | varchar | 平台内部编号 |
| brand | varchar | 品牌 |
| model | varchar | 型号 |
| serial_no | varchar | 设备序列号 |
| mtow_kg | decimal | 最大起飞重量 |
| max_payload_kg | decimal | 最大载重 |
| max_distance_km | decimal | 最大航程 |
| max_flight_minutes | int | 最大飞行时长 |
| city | varchar | 所在城市 |
| address | varchar | 所在地址 |
| latitude | decimal | 纬度 |
| longitude | decimal | 经度 |
| availability_status | varchar | 设备可用状态 |
| certification_status | varchar | 综合资质状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `availability_status`: `available`, `busy`, `maintenance`, `offline`
- `certification_status`: `pending`, `verified`, `rejected`, `expired`

### 4.2 `drone_certifications`

无人机资质明细表，用于存 UOM、保险、适航、维护等具体记录。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| drone_id | bigint | 对应无人机 |
| cert_type | varchar | 资质类型 |
| cert_no | varchar | 资质编号 |
| status | varchar | 资质状态 |
| issued_at | datetime | 生效时间 |
| expire_at | datetime | 到期时间 |
| attachment_url | varchar | 附件地址 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

类型建议：

- `uom`
- `insurance`
- `airworthiness`
- `maintenance`

状态建议：

- `pending`
- `verified`
- `rejected`
- `expired`

### 4.3 `owner_supplies`

机主供给表。表达“机主当前可被撮合的服务能力”。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| supply_no | varchar | 供给编号 |
| owner_user_id | bigint | 机主账号 |
| drone_id | bigint | 关联无人机 |
| title | varchar | 供给标题 |
| description | text | 供给描述 |
| service_types | json | 可提供服务类型列表 |
| cargo_scenes | json | 可承接场景列表 |
| service_area_snapshot | json | 服务范围/区域快照 |
| mtow_kg | decimal | 机型最大起飞重量 |
| max_payload_kg | decimal | 最大载重能力 |
| max_range_km | decimal | 最大航程 |
| base_price_amount | bigint | 直达下单基础价格 |
| pricing_unit | varchar | 计价单位 |
| pricing_rule | json | 计价规则 |
| available_time_slots | json | 可服务时间段 |
| accepts_direct_order | tinyint | 是否接受客户直达下单 |
| status | varchar | 供给状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `draft`
- `active`
- `paused`
- `closed`

补充说明：

- `active` 仅表示当前可进入主市场匹配池
- 当关联无人机任一关键资质回到 `pending / rejected / expired`，或不再满足重载门槛时，供给应自动降级为 `paused`

### 4.4 `owner_pilot_bindings`

机主与飞手的长期协作关系表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| owner_user_id | bigint | 机主账号 |
| pilot_user_id | bigint | 飞手账号 |
| initiated_by | varchar | 发起方：`owner`（机主邀请）或 `pilot`（飞手申请） |
| status | varchar | 绑定状态 |
| is_priority | tinyint | 是否优先合作 |
| note | text | 协作备注 |
| confirmed_at | datetime | 对方确认时间 |
| dissolved_at | datetime | 解除时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `pending_confirmation`：等待对方确认（机主邀请等飞手确认，或飞手申请等机主确认）
- `active`：合作中
- `paused`：暂停合作（任一方可发起，恢复后回到 `active`）
- `rejected`：对方拒绝
- `expired`：超时未响应
- `dissolved`：已解除（任一方主动解除，或飞手认证失效自动解除）

## 5. 撮合阶段实体

### 5.1 `demands`

客户公开需求表。撮合阶段的核心对象。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| demand_no | varchar | 需求编号 |
| client_user_id | bigint | 客户账号 |
| title | varchar | 需求标题 |
| service_type | varchar | 服务类型 |
| cargo_scene | varchar | 场景类型 |
| description | text | 需求描述 |
| departure_address_snapshot | json | 出发地址快照 |
| destination_address_snapshot | json | 目的地址快照 |
| service_address_snapshot | json | 作业地址快照 |
| scheduled_start_at | datetime | 预约开始时间 |
| scheduled_end_at | datetime | 预约结束时间 |
| cargo_weight_kg | decimal | 货物重量 |
| cargo_volume_m3 | decimal | 货物体积 |
| cargo_type | varchar | 货物类型 |
| cargo_special_requirements | text | 货物特殊要求 |
| estimated_trip_count | int | 预计架次/往返次数 |
| cargo_snapshot | json | 货物/任务补充快照 |
| budget_min | bigint | 预算下限 |
| budget_max | bigint | 预算上限 |
| allows_pilot_candidate | tinyint | 是否开放飞手候选 |
| selected_quote_id | bigint | 被选中的报价 |
| selected_provider_user_id | bigint | 被选中的机主 |
| expires_at | datetime | 需求有效期截止时间，过期自动关闭 |
| status | varchar | 需求状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `draft`
- `published`
- `quoting`
- `selected`
- `converted_to_order`
- `expired`：到达 `expires_at` 仍未转单，系统自动关闭
- `cancelled`：客户主动取消

### 5.2 `demand_quotes`

机主对需求发起的报价/申请记录。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| quote_no | varchar | 报价编号 |
| demand_id | bigint | 对应需求 |
| owner_user_id | bigint | 报价机主 |
| drone_id | bigint | 拟投入设备 |
| price_amount | bigint | 报价金额 |
| pricing_snapshot | json | 报价快照 |
| execution_plan | text | 执行说明 |
| status | varchar | 报价状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `submitted`
- `withdrawn`
- `rejected`
- `selected`
- `expired`

### 5.3 `demand_candidate_pilots`

飞手对公开需求表达执行意愿的候选池记录。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| demand_id | bigint | 对应需求 |
| pilot_user_id | bigint | 报名飞手 |
| status | varchar | 候选状态 |
| availability_snapshot | json | 飞手报名时的能力摘要 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `active`
- `withdrawn`
- `expired`
- `converted`
- `skipped`

字段说明：

- `converted` 表示该候选飞手已进入后续派单选择流程
- `skipped` 表示该飞手在重派或筛选时被跳过
- 候选飞手池数量变化不会直接改变 `demands.status`，需求主状态仍按 `draft / published / quoting / selected / converted_to_order / expired / cancelled` 流转

### 5.4 `matching_logs`

记录平台自动推荐、排序、筛选过程的日志表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| demand_id | bigint | 对应需求 |
| actor_type | varchar | 触发方 |
| action_type | varchar | 动作类型 |
| result_snapshot | json | 结果快照 |
| created_at | datetime | 创建时间 |

类型建议：

- `actor_type`: `system`, `client`, `owner`, `pilot`
- `action_type`: `recommend_owner`, `quote_rank`, `candidate_rank`, `auto_push`

## 6. 履约阶段实体

### 6.1 `orders`

履约订单主表。必须是快照对象。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| order_no | varchar | 订单编号 |
| order_source | varchar | 订单来源 |
| demand_id | bigint | 来源需求，需求转单时必填 |
| source_supply_id | bigint | 来源供给，直达下单时必填 |
| client_user_id | bigint | 客户 |
| provider_user_id | bigint | 承接机主 |
| drone_owner_user_id | bigint | 无人机所属机主 |
| executor_pilot_user_id | bigint | 实际执行飞手 |
| drone_id | bigint | 执行设备 |
| dispatch_task_id | bigint | 当前生效派单任务 |
| needs_dispatch | tinyint | 是否需要派单 |
| execution_mode | varchar | 执行模式 |
| status | varchar | 订单状态 |
| demand_snapshot | json | 需求快照 |
| supply_snapshot | json | 供给快照 |
| pricing_snapshot | json | 价格快照 |
| execution_snapshot | json | 执行快照 |
| provider_confirmed_at | datetime | 机主确认时间 |
| provider_rejected_at | datetime | 机主拒绝时间 |
| provider_reject_reason | text | 机主拒绝原因 |
| paid_at | datetime | 支付时间 |
| completed_at | datetime | 完成时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

执行模式建议：

- `self_execute`
- `bound_pilot`
- `dispatch_pool`

状态建议：

- `pending_provider_confirmation`：直达下单待机主确认
- `pending_payment`：待支付
- `paid`：已支付
- `pending_dispatch`：待派单
- `assigned`：已指派执行人
- `preparing`：执行人准备中（飞手上报）
- `in_transit`：飞行中（飞手起飞后上报或系统自动检测）
- `delivered`：已投送（飞手到达后上报）
- `completed`：已完成（客户确认签收或超时自动确认）
- `cancelled`：已取消
- `provider_rejected`：机主拒绝直达订单（终态，不可复活，客户需重新下单）
- `refunding`：退款中
- `refunded`：已退款

来源建议：

- `demand_market`
- `supply_direct`

### 6.2 `order_snapshots`

如需把快照与订单主表分离，可用该表存大字段快照。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| order_id | bigint | 对应订单 |
| snapshot_type | varchar | 快照类型 |
| snapshot_data | json | 快照内容 |
| created_at | datetime | 创建时间 |

快照类型建议：

- `client`
- `demand`
- `supply`
- `pricing`
- `execution`

### 6.3 `dispatch_tasks`

派单任务表。用于表达“某笔订单发给某个飞手的正式执行指令”。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| dispatch_no | varchar | 派单编号 |
| order_id | bigint | 对应订单 |
| provider_user_id | bigint | 发起派单的机主 |
| target_pilot_user_id | bigint | 目标飞手 |
| dispatch_source | varchar | 派单来源 |
| retry_count | int | 当前重派次数 |
| status | varchar | 派单状态 |
| reason | text | 派单说明 |
| sent_at | datetime | 发出时间 |
| responded_at | datetime | 响应时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

来源建议：

- `bound_pilot`
- `candidate_pool`
- `general_pool`

状态建议：

- `pending_response`
- `accepted`
- `rejected`
- `expired`
- `executing`
- `finished`
- `exception`

### 6.4 `dispatch_logs`

派单过程日志表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| dispatch_task_id | bigint | 对应派单 |
| action_type | varchar | 动作类型 |
| operator_user_id | bigint | 操作人 |
| note | text | 备注 |
| created_at | datetime | 创建时间 |

动作类型建议：

- `created`
- `accepted`
- `rejected`
- `expired`
- `reassign`
- `exception_reported`

### 6.5 `flight_records`

飞行记录主表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| flight_no | varchar | 飞行记录编号 |
| order_id | bigint | 对应订单 |
| dispatch_task_id | bigint | 对应派单任务 |
| pilot_user_id | bigint | 执行飞手 |
| drone_id | bigint | 执行设备 |
| takeoff_at | datetime | 起飞时间 |
| landing_at | datetime | 降落时间 |
| total_duration_seconds | int | 飞行总时长 |
| total_distance_m | decimal | 飞行总距离 |
| max_altitude_m | decimal | 最大高度 |
| status | varchar | 飞行记录状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `pending`
- `executing`
- `completed`
- `aborted`

补充说明：

- 一个 `order_id` 可以对应多条 `flight_records`
- 每条 `flight_records` 表示一个独立架次
- 订单级飞行统计由多条飞行记录聚合计算

### 6.6 `flight_positions`

飞行轨迹点表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| flight_record_id | bigint | 对应飞行记录 |
| latitude | decimal | 纬度 |
| longitude | decimal | 经度 |
| altitude_m | decimal | 高度 |
| speed_mps | decimal | 速度 |
| battery_percent | int | 电量 |
| recorded_at | datetime | 记录时间 |

### 6.7 `flight_alerts`

飞行告警表。

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| flight_record_id | bigint | 对应飞行记录 |
| alert_type | varchar | 告警类型 |
| severity | varchar | 严重级别 |
| message | text | 告警内容 |
| created_at | datetime | 创建时间 |

类型建议：

- `low_battery`
- `route_deviation`
- `signal_loss`
- `weather_risk`
- `airspace_risk`

级别建议：

- `info`
- `warning`
- `critical`

## 7. 财务与争议实体

### 7.1 `payments`

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| payment_no | varchar | 支付编号 |
| order_id | bigint | 对应订单 |
| payer_user_id | bigint | 付款人 |
| amount | bigint | 金额 |
| payment_method | varchar | 支付方式 |
| status | varchar | 支付状态 |
| paid_at | datetime | 支付时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `pending`
- `paid`
- `failed`
- `refunded`

### 7.2 `refunds`

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| refund_no | varchar | 退款编号 |
| order_id | bigint | 对应订单 |
| payment_id | bigint | 对应支付 |
| amount | bigint | 退款金额 |
| reason | text | 退款原因 |
| status | varchar | 退款状态 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `pending`
- `processing`
- `success`
- `failed`

### 7.3 `settlements`

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| order_id | bigint | 对应订单 |
| client_pay_amount | bigint | 客户支付金额 |
| provider_income_amount | bigint | 机主收入 |
| pilot_income_amount | bigint | 飞手收入（默认 0，机主线下结算给飞手） |
| platform_fee_amount | bigint | 平台服务费 |
| platform_fee_rate | decimal | 平台抽成比例（如 0.10 表示 10%） |
| adjustment_amount | bigint | 按量计价调整金额（正数补收，负数退还） |
| adjustment_reason | text | 调整原因 |
| status | varchar | 结算状态 |
| wait_until | datetime | 结算等待期截止时间（订单完成后 T+3） |
| settled_at | datetime | 结算时间 |
| frozen_at | datetime | 冻结时间（因争议冻结） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `pending`：等待结算（T+3 等待期内）
- `processing`：结算处理中
- `completed`：已结算到账
- `frozen`：因争议冻结
- `adjusted`：因按量计价差异已调整
- `partially_refunded`：部分退款
- `refunded`

### 7.4 `dispute_records`

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| order_id | bigint | 对应订单 |
| initiator_user_id | bigint | 发起人 |
| dispute_type | varchar | 争议类型 |
| status | varchar | 争议状态 |
| summary | text | 争议摘要 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

状态建议：

- `open`
- `processing`
- `resolved`
- `closed`

### 7.5 `reviews`

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| order_id | bigint | 对应订单 |
| reviewer_user_id | bigint | 评价人 |
| reviewer_role | varchar | 评价人角色：`client` / `owner` / `pilot` |
| target_user_id | bigint | 被评价人 |
| target_role | varchar | 被评价人角色 |
| rating | tinyint | 评分（1-5） |
| content | text | 评价内容 |
| is_anonymous | tinyint | 是否匿名 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

说明：

- 一个订单中，客户可评价机主/飞手，机主可评价客户/飞手，飞手可评价机主
- 同一评价人对同一订单只能提交一条评价
- 评价在订单 `completed` 后开放，结算等待期（T+3）内均可提交

### 7.6 `evidence_attachments`

| 字段 | 类型建议 | 含义 |
|------|----------|------|
| id | bigint | 主键 |
| related_type | varchar | 关联对象类型：`dispute` / `refund` / `review` |
| related_id | bigint | 关联对象 ID |
| uploader_user_id | bigint | 上传人 |
| file_url | varchar | 文件地址 |
| file_type | varchar | 文件类型：`image` / `video` / `document` |
| description | text | 说明 |
| created_at | datetime | 创建时间 |

## 8. 派生字段与页面态

下面这些字段建议作为服务层或接口层派生字段，不建议直接持久化：

| 字段 | 含义 | 来源 |
|------|------|------|
| has_client_role | 是否具备客户身份 | `client_profiles` |
| has_owner_role | 是否具备机主身份 | `owner_profiles` |
| has_pilot_role | 是否具备飞手身份 | `pilot_profiles` |
| can_publish_supply | 是否可发布供给 | `owner_profile + drones + certs` |
| can_accept_dispatch | 是否可接派单 | `pilot_profile + availability_status` |
| can_self_execute | 是否可自执行 | `owner_profile + pilot_profile + drone` |
| open_candidate_entry | 是否开放候选报名 | `demands.allows_pilot_candidate` |
| is_direct_order | 是否直达订单 | `orders.order_source == supply_direct` |
| meets_heavy_lift_threshold | 是否满足平台重载门槛 | `drones.mtow_kg >= 150 && drones.max_payload_kg >= 50` |
| eligible_for_marketplace | 是否可进入主市场匹配池 | `meets_heavy_lift_threshold + certs + availability` |

## 9. 当前阶段必须避免的设计

为了保证这轮大重构能顺利推进，当前阶段建议明确避免以下设计：

- 不要继续依赖 `user_type` 做业务主判断
- 不要让前端自己拼装订单真实状态
- 不要让“需求、订单、派单任务”共用一个列表语义
- 不要把飞手候选报名和正式派单混为一谈
- 不要把订单详情和飞行执行详情混成一个对象
- 不要把平台重新做成“同城即时配送”或“通用无人机服务市场”

## 10. 与主文档的关系

本字段字典与主文档的对应关系如下：

- 业务逻辑：看 [BUSINESS_ROLE_REDESIGN.md](./BUSINESS_ROLE_REDESIGN.md)
- 字段定义：看本文件
- 后续页面重构：建议补 `页面信息架构`
- 后续接口重构：建议补 `接口契约`
