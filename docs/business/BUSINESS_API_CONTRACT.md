# 无人机服务平台接口契约

## 1. 文档目的

本文件用于把以下三份业务文档落到接口层：

- [BUSINESS_ROLE_REDESIGN.md](./BUSINESS_ROLE_REDESIGN.md)
- [BUSINESS_FIELD_DICTIONARY.md](./BUSINESS_FIELD_DICTIONARY.md)
- [BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](./BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)

这份文档的目标不是覆盖所有实现细节，而是先定清：

- 后续重构应暴露哪些核心接口
- 每个接口服务哪个业务对象
- request / response 的主体结构应该如何统一
- 前端哪些页面应该调用哪些接口

## 2. 全局接口规则

### 2.1 版本建议

后续重构建议新接口统一挂到：

- `/api/v2`

当前项目已有 `/api/v1`，建议迁移期并存：

- `v1`：仅用于历史页面和数据比对
- `v2`：后续新页面、新服务层、新状态机统一使用

### 2.2 认证方式

除登录注册外，所有接口统一使用：

- `Authorization: Bearer <token>`

### 2.3 统一响应结构

建议所有接口统一返回以下结构：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "meta": {},
  "trace_id": "req_xxx"
}
```

约束如下：

- `code`：业务错误码，不直接暴露底层异常
- `message`：给客户端展示或调试使用
- `data`：主业务数据
- `meta`：分页、统计、附加元信息
- `trace_id`：链路追踪 id

### 2.4 列表响应结构

列表接口统一为：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": []
  },
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 100
  },
  "trace_id": "req_xxx"
}
```

### 2.5 分页规则

统一使用：

- `page`
- `page_size`

默认：

- `page=1`
- `page_size=20`

### 2.6 状态返回原则

状态必须直接由后端返回，不允许前端自行拼装真实业务状态。

例如：

- 订单状态由 `orders.status` 返回
- 派单状态由 `dispatch_tasks.status` 返回
- 页面只负责映射文案和样式，不自行推导状态机

### 2.7 平台边界约束

当前 v2 接口默认服务于 `heavy_cargo_lift_transport`。

约束如下：

- 需求与供给的服务类型当前固定为 `heavy_cargo_lift_transport`
- 供给市场只返回满足平台重载门槛的生效供给
- 不为城市即时配送、外卖、同城闪送、干线物流提供单独接口语义
- 当前阶段前端可以不传 `service_type`，后端默认写入 `heavy_cargo_lift_transport`

## 3. 公共 DTO 约定

### 3.1 `AddressSnapshot`

用于 `departure_address / destination_address / service_address` 以及对应快照字段。

```json
{
  "text": "广东省清远市连山壮族瑶族自治县某吊运点",
  "latitude": 24.123456,
  "longitude": 112.123456,
  "city": "清远市",
  "district": "连山壮族瑶族自治县"
}
```

约束：

- `text` 必填
- `latitude / longitude` 强烈建议填写
- `city / district` 用于筛选和统计

### 3.2 `RoleSummary`

用于首页、我的页、鉴权初始化。

```json
{
  "has_client_role": true,
  "has_owner_role": false,
  "has_pilot_role": true,
  "can_publish_supply": false,
  "can_accept_dispatch": true,
  "can_self_execute": false
}
```

### 3.3 `DemandSummary`

```json
{
  "id": 1001,
  "demand_no": "DM202603110001",
  "title": "电网塔材山区吊运",
  "status": "published",
  "service_type": "heavy_cargo_lift_transport",
  "cargo_scene": "power_grid_material",
  "service_address_text": "广东省清远市连山壮族瑶族自治县...",
  "scheduled_start_at": "2026-03-12T09:00:00+08:00",
  "scheduled_end_at": "2026-03-12T11:00:00+08:00",
  "budget_min": 50000,
  "budget_max": 80000,
  "allows_pilot_candidate": true,
  "quote_count": 2,
  "candidate_pilot_count": 3
}
```

### 3.4 `SupplySummary`

```json
{
  "id": 1501,
  "supply_no": "SP202603110001",
  "title": "山区电网物资重载吊运服务",
  "owner_user_id": 23,
  "service_types": ["heavy_cargo_lift_transport"],
  "cargo_scenes": ["power_grid_material", "mountain_agri"],
  "mtow_kg": 180,
  "max_payload_kg": 60,
  "base_price_amount": 68000,
  "pricing_unit": "per_trip",
  "accepts_direct_order": true,
  "status": "active"
}
```

### 3.5 `QuoteSummary`

```json
{
  "id": 2001,
  "quote_no": "QT202603110001",
  "demand_id": 1001,
  "owner_user_id": 23,
  "price_amount": 68000,
  "status": "submitted",
  "created_at": "2026-03-11T10:00:00+08:00"
}
```

### 3.6 `OrderSummary`

```json
{
  "id": 3001,
  "order_no": "OD202603110001",
  "order_source": "demand_market",
  "demand_id": 1001,
  "source_supply_id": null,
  "status": "in_transit",
  "needs_dispatch": true,
  "execution_mode": "dispatch_pool",
  "provider_user_id": 23,
  "executor_pilot_user_id": 51,
  "dispatch_task_id": 4001
}
```

### 3.7 `DispatchTaskSummary`

```json
{
  "id": 4001,
  "dispatch_no": "DP202603110001",
  "order_id": 3001,
  "status": "pending_response",
  "dispatch_source": "candidate_pool",
  "target_pilot_user_id": 51,
  "retry_count": 1
}
```

### 3.8 `FlightRecordSummary`

```json
{
  "id": 5001,
  "flight_no": "FL202603110001",
  "order_id": 3001,
  "status": "completed",
  "total_duration_seconds": 1800,
  "total_distance_m": 5600,
  "max_altitude_m": 120
}
```

### 3.9 `ReviewSummary`

```json
{
  "id": 6001,
  "order_id": 3001,
  "reviewer_user_id": 1,
  "reviewer_role": "client",
  "target_user_id": 23,
  "target_role": "owner",
  "rating": 5,
  "content": "按时完成山区吊运任务",
  "created_at": "2026-03-12T18:00:00+08:00"
}
```

## 4. 账号与初始化接口

### 4.1 注册

`POST /api/v2/auth/register`

作用：

- 注册平台账号
- 自动创建 `client_profile`

request:

```json
{
  "phone": "13800000000",
  "password": "password123",
  "nickname": "张三"
}
```

response `data`:

```json
{
  "user": {
    "id": 1,
    "phone": "13800000000",
    "nickname": "张三"
  },
  "token": {
    "access_token": "xxx",
    "refresh_token": "xxx"
  },
  "role_summary": {
    "has_client_role": true,
    "has_owner_role": false,
    "has_pilot_role": false
  }
}
```

### 4.2 登录

`POST /api/v2/auth/login`

### 4.3 获取当前用户初始化信息

`GET /api/v2/me`

作用：

- 前端应用启动后获取用户基础信息与角色摘要

response `data`:

```json
{
  "user": {
    "id": 1,
    "phone": "13800000000",
    "nickname": "张三",
    "avatar_url": ""
  },
  "role_summary": {
    "has_client_role": true,
    "has_owner_role": true,
    "has_pilot_role": false,
    "can_publish_supply": true,
    "can_accept_dispatch": false,
    "can_self_execute": false
  }
}
```

### 4.4 获取首页驾驶舱聚合数据

`GET /api/v2/home/dashboard`

作用：

- 首页统一读取这份聚合结果，不再页面侧并发拼装供给、需求、订单、派单等原始数据
- 首页角色切换只消费后端返回的 `role_summary`，不再根据 `user_type` 或页面临时规则推断

response `data`:

```json
{
  "role_summary": {
    "has_client_role": true,
    "has_owner_role": true,
    "has_pilot_role": false,
    "can_publish_supply": true,
    "can_accept_dispatch": false,
    "can_self_execute": false
  },
  "summary": {
    "in_progress_order_count": 3,
    "today_order_count": 1,
    "today_income_amount": 68000,
    "alert_count": 1
  },
  "market_totals": {
    "supply_count": 12,
    "demand_count": 7
  },
  "role_views": {
    "client": {
      "open_demand_count": 2,
      "quoted_demand_count": 1,
      "pending_provider_confirmation_order_count": 1,
      "pending_payment_order_count": 1,
      "in_progress_order_count": 1
    },
    "owner": {
      "recommended_demand_count": 4,
      "active_supply_count": 2,
      "pending_quote_count": 1,
      "pending_provider_confirmation_order_count": 1,
      "pending_dispatch_order_count": 1
    },
    "pilot": {
      "pending_response_dispatch_count": 0,
      "candidate_demand_count": 0,
      "active_dispatch_count": 0,
      "recent_flight_count": 0
    }
  },
  "in_progress_orders": [],
  "market_feed": []
}
```

## 5. 客户域接口

### 5.1 获取客户档案

`GET /api/v2/client/profile`

说明：

- 返回客户基础档案、默认地址、常用场景、订单统计，以及嵌入式 `eligibility` 资格视图
- `verification_status` / `identity_verification_status` 统一表示“用户实名认证状态”
- `client_verification_status` 保留旧客户档案认证字段，仅作兼容展示，不再作为个人下单/发需求的默认判断依据

### 5.2 获取当前客户资格

`GET /api/v2/client/eligibility`

response `data`:

```json
{
  "eligible": true,
  "can_publish_demand": true,
  "can_create_direct_order": true,
  "account_active": true,
  "identity_verified": true,
  "credit_qualified": true,
  "enterprise_upgrade_optional": true,
  "summary": "个人实名认证通过后，可直接发布需求与直达下单；企业升级仅在需要企业主体出单时再补充。",
  "blockers": []
}
```

阻塞口径：

- 默认只收口 `账号状态`、`实名认证`、`平台信用分`
- 企业升级不是个人客户主链路的默认前置条件
- `blockers[].suggested_action=verify_identity` 时，移动端应直接引导去实名认证页

### 5.3 更新客户档案

`PATCH /api/v2/client/profile`

### 5.4 获取供给市场列表

`GET /api/v2/supplies`

query:

- `region`
- `cargo_scene`
- `service_type`
- `min_payload_kg`
- `accepts_direct_order`
- `page`
- `page_size`

返回对象：`SupplySummary`

说明：

- 仅返回满足平台重载门槛且 `status=active` 的供给
- `service_type` 当前固定为 `heavy_cargo_lift_transport`

### 5.5 获取供给详情

`GET /api/v2/supplies/{supply_id}`

作用：

- 给客户浏览供给详情
- 为直达下单页提供供给快照

### 5.6 从供给发起直达下单

`POST /api/v2/supplies/{supply_id}/orders`

request:

```json
{
  "service_type": "heavy_cargo_lift_transport",
  "cargo_scene": "island_supply",
  "departure_address": {
    "text": "广东省阳江市海陵岛补给点..."
  },
  "destination_address": {
    "text": "广东省阳江市外海养殖补给点..."
  },
  "service_address": null,
  "scheduled_start_at": "2026-03-12T09:00:00+08:00",
  "scheduled_end_at": "2026-03-12T11:00:00+08:00",
  "cargo_weight_kg": 8.5,
  "cargo_volume_m3": 0.3,
  "cargo_type": "设备箱",
  "cargo_special_requirements": "防震",
  "description": "希望当天完成"
}
```

response `data`:

```json
{
  "order_id": 3002,
  "order_no": "OD202603110002",
  "order_source": "supply_direct",
  "status": "pending_provider_confirmation"
}
```

资格说明：

- 个人实名认证通过且平台信用分合格时，可直接发起直达下单
- 企业升级不是此接口的默认前置条件

### 5.7 创建需求

`POST /api/v2/demands`

request:

```json
{
  "title": "山区竹材重载吊运",
  "service_type": "heavy_cargo_lift_transport",
  "cargo_scene": "mountain_agri",
  "description": "需要无人机完成山区竹材末端吊运",
  "departure_address": {
    "text": "福建省南平市建瓯市山脚集货点..."
  },
  "destination_address": {
    "text": "福建省南平市建瓯市山顶加工点..."
  },
  "service_address": null,
  "scheduled_start_at": "2026-03-12T09:00:00+08:00",
  "scheduled_end_at": "2026-03-12T11:00:00+08:00",
  "cargo_weight_kg": 8.5,
  "cargo_volume_m3": 0.3,
  "cargo_type": "设备箱",
  "cargo_special_requirements": "防震",
  "budget_min": 50000,
  "budget_max": 80000,
  "allows_pilot_candidate": true
}
```

资格说明：

- 当前实现会在创建需求前先校验客户资格；默认只看实名认证、账号状态、平台信用
- 企业升级、企业资质、复杂货物申报不作为默认阻塞项

### 5.8 更新需求（草稿状态）

`PATCH /api/v2/demands/{demand_id}`

说明：

- 仅 `status=draft` 时可调用
- 支持部分更新，只传需要修改的字段

### 5.9 发布需求

`POST /api/v2/demands/{demand_id}/publish`

说明：

- 仅 `status=draft` 时可调用
- 发布后需求进入 `published`，对机主和飞手可见
- 发布时校验必填字段完整性
- 同时校验客户资格，口径与 `GET /api/v2/client/eligibility` 一致

### 5.10 取消需求

`POST /api/v2/demands/{demand_id}/cancel`

说明：

- `draft` 和 `published` 状态可直接取消
- `quoting` 状态取消时，所有未完成的报价自动作废，通知已报价机主
- 已转单的需求不可取消（应通过订单取消流程处理）

### 5.11 获取我的需求列表

`GET /api/v2/demands/my`

query:

- `status`
- `page`
- `page_size`

### 5.12 获取需求详情

`GET /api/v2/demands/{demand_id}`

### 5.13 获取某需求的报价列表

`GET /api/v2/demands/{demand_id}/quotes`

仅客户本人可看完整报价细节。

### 5.14 选择机主并转订单

`POST /api/v2/demands/{demand_id}/select-provider`

request:

```json
{
  "quote_id": 2001
}
```

response `data`:

```json
{
  "order_id": 3001,
  "order_no": "OD202603110001",
  "status": "pending_payment"
}
```

资格说明：

- 需求转单与直达下单使用同一套客户资格判断
- 个人实名认证通过即可继续转单，无需先升级企业客户

## 6. 机主域接口

### 6.1 获取机主档案

`GET /api/v2/owner/profile`

### 6.2 创建或更新机主档案

`PUT /api/v2/owner/profile`

### 6.2A 获取机主待处理工作台

`GET /api/v2/owner/workbench`

说明：

- 返回机主视角的统一待处理聚合，用于阶段 4 的“待处理线索”入口
- 聚合四类对象：
  - `recommended_demands`
  - `pending_provider_confirmation_orders`
  - `pending_dispatch_orders`
  - `draft_supplies`
- `summary` 会同时返回各分类数量，便于首页和机主中心做单入口提醒
- 这不是新的业务对象，只是把机主当前需要响应的线索集中展示

### 6.3 获取我的无人机列表

`GET /api/v2/owner/drones`

### 6.4 新增无人机

`POST /api/v2/owner/drones`

### 6.5 获取无人机详情

`GET /api/v2/owner/drones/{drone_id}`

### 6.6 提交无人机资质

`POST /api/v2/owner/drones/{drone_id}/certifications`

### 6.7 获取我的供给列表

`GET /api/v2/owner/supplies`

### 6.8 创建供给

`POST /api/v2/owner/supplies`

request:

```json
{
  "title": "海岛给养重载吊运服务",
  "description": "支持海岛给养与海鲜产品重载末端吊运",
  "drone_id": 88,
  "service_types": ["heavy_cargo_lift_transport"],
  "cargo_scenes": ["island_supply", "emergency_relief"],
  "service_area_snapshot": {
    "region": "粤西海岛"
  },
  "max_payload_kg": 60,
  "max_range_km": 25,
  "base_price_amount": 68000,
  "pricing_unit": "per_trip",
  "available_time_slots": [],
  "accepts_direct_order": true
}
```

说明：

- 所选 `drone_id` 必须满足平台重载门槛，否则接口直接拒绝创建生效供给

### 6.9 获取我的供给详情

`GET /api/v2/owner/supplies/{supply_id}`

### 6.10 更新供给内容

`PUT /api/v2/owner/supplies/{supply_id}`

说明：

- 用于编辑草稿、已暂停、已关闭或需要重新上架的供给
- 更新时会重新校验所选无人机、价格规则、时间段和是否接受直达下单
- 若提交状态为 `active`，仍会执行重载准入与关键资质校验

### 6.11 更新供给状态

`PATCH /api/v2/owner/supplies/{supply_id}/status`

request:

```json
{
  "status": "paused"
}
```

### 6.12 获取平台推荐需求

`GET /api/v2/owner/demands/recommended`

返回对象：`DemandSummary`

### 6.11 对需求报价/申请

`POST /api/v2/demands/{demand_id}/quotes`

request:

```json
{
  "drone_id": 88,
  "price_amount": 68000,
  "execution_plan": "可在指定时间完成任务"
}
```

### 6.12 获取我的报价列表

`GET /api/v2/owner/quotes`

### 6.13 获取绑定飞手列表

`GET /api/v2/owner/pilot-bindings`

### 6.14 机主邀请绑定飞手

`POST /api/v2/owner/pilot-bindings`

request:

```json
{
  "pilot_user_id": 51,
  "is_priority": true,
  "note": "长期合作飞手"
}
```

说明：

- 创建 `initiated_by=owner` 的绑定记录，初始状态为 `pending_confirmation`
- 飞手收到绑定邀请通知后，通过飞手侧接口确认或拒绝

### 6.15 机主确认飞手申请

`POST /api/v2/owner/pilot-bindings/{binding_id}/confirm`

说明：

- 仅用于 `initiated_by=pilot` 且 `status=pending_confirmation` 的绑定记录
- 确认后绑定进入 `active`

### 6.16 机主拒绝飞手申请

`POST /api/v2/owner/pilot-bindings/{binding_id}/reject`

### 6.17 更新绑定状态（暂停/恢复/解除）

`PATCH /api/v2/owner/pilot-bindings/{binding_id}/status`

request:

```json
{
  "status": "paused"
}
```

说明：

- 可操作状态变更：`active → paused`、`paused → active`、`active → dissolved`、`paused → dissolved`

## 7. 飞手域接口

### 7.1 获取飞手档案

`GET /api/v2/pilot/profile`

说明：

- 响应中新增 `eligibility`，用于表达阶段 4 的飞手分级准入口径
- `eligibility.tier` 当前可能为：
  - `profile_setup`
  - `candidate_ready`
  - `verified_offline`
  - `dispatch_ready`
  - `needs_resubmission`
- 低风险链路使用 `eligibility.can_apply_candidate`
- 正式派单/执行链路使用 `eligibility.can_accept_dispatch` / `eligibility.can_start_execution`
- `eligibility.recommended_next_step` 和 `eligibility.blockers` 用于前端给出“还缺什么、下一步做什么”的说明

### 7.2 创建或更新飞手档案

`PUT /api/v2/pilot/profile`

### 7.3 更新飞手在线状态

`PATCH /api/v2/pilot/availability`

request:

```json
{
  "availability_status": "online"
}
```

### 7.4 获取我的绑定机主列表

`GET /api/v2/pilot/owner-bindings`

说明：

- 返回飞手视角的绑定关系列表，包含机主摘要、绑定状态、是否优先合作

### 7.5 飞手申请绑定机主

`POST /api/v2/pilot/owner-bindings`

request:

```json
{
  "owner_user_id": 23,
  "note": "希望长期合作"
}
```

说明：

- 创建 `initiated_by=pilot` 的绑定记录，初始状态为 `pending_confirmation`
- 机主收到绑定申请通知后，通过机主侧接口确认或拒绝

### 7.6 飞手确认机主邀请

`POST /api/v2/pilot/owner-bindings/{binding_id}/confirm`

说明：

- 仅用于 `initiated_by=owner` 且 `status=pending_confirmation` 的绑定记录
- 确认后绑定进入 `active`

### 7.7 飞手拒绝机主邀请

`POST /api/v2/pilot/owner-bindings/{binding_id}/reject`

### 7.8 飞手更新绑定状态（暂停/恢复/解除）

`PATCH /api/v2/pilot/owner-bindings/{binding_id}/status`

### 7.9 获取可报名的公开需求

`GET /api/v2/pilot/candidate-demands`

说明：

- 只返回 `allows_pilot_candidate=true` 的公开需求
- 只返回飞手当前可见的需求摘要
- 从阶段 4 开始，待审核但已补齐基础执照资料的飞手也可以先浏览并报名候选需求
- 正式派单与执行仍要求飞手认证通过

### 7.10 报名候选

`POST /api/v2/demands/{demand_id}/candidate`

### 7.11 取消候选报名

`DELETE /api/v2/demands/{demand_id}/candidate`

### 7.12 获取我的派单任务

`GET /api/v2/pilot/dispatch-tasks`

### 7.13 接受派单

`POST /api/v2/dispatch-tasks/{dispatch_id}/accept`

### 7.14 拒绝派单

`POST /api/v2/dispatch-tasks/{dispatch_id}/reject`

request:

```json
{
  "reason": "当前时间冲突"
}
```

### 7.15 获取我的飞行记录

`GET /api/v2/pilot/flight-records`

## 8. 订单与履约接口

### 8.1 获取我的订单列表

`GET /api/v2/orders`

query:

- `status`
- `role`
- `page`
- `page_size`

规则：

- `role=client` 返回客户订单
- `role=owner` 返回机主承接订单
- `role=pilot` 返回飞手参与执行的订单

补充：

- `status=pending_provider_confirmation` 主要用于客户直达下单后等待机主确认
- 订单列表必须返回 `order_source`，便于页面区分“需求转单”与“直达订单”

### 8.2 获取订单详情

`GET /api/v2/orders/{order_id}`

该接口必须返回：

- 基本信息
- 来源信息（需求或供给）
- 参与方信息
- 执行状态摘要
- 当前派单摘要
- 财务摘要
- 若订单已取消，补充 `cancel_reason / cancel_by`
- 前端默认应基于该接口渲染“订单主视图”，把执行安排折叠为订单进度的子状态

### 8.3 机主确认直达订单

`POST /api/v2/orders/{order_id}/provider-confirm`

说明：

- 仅 `order_source=supply_direct` 且 `status=pending_provider_confirmation` 时可调用
- 调用成功后订单进入 `pending_payment`

### 8.4 机主拒绝直达订单

`POST /api/v2/orders/{order_id}/provider-reject`

request:

```json
{
  "reason": "当前时间段无可用设备"
}
```

### 8.5 支付订单

`POST /api/v2/orders/{order_id}/pay`

request:

```json
{
  "method": "mock"
}
```

说明：

- 当前支持 `mock / wechat / alipay`
- 当前开发/测试阶段的正式联调路径是 `mock`
- `mock` 会在开发测试环境直接回调支付成功，便于联调
- `wechat / alipay` 当前只创建待回调支付单作为占位，不会发起真实扣款
- 返回体会额外包含 `payment_flow`，用于说明当前渠道是否会自动完成支付，以及前端应给出的提示文案

### 8.6 取消订单

`POST /api/v2/orders/{order_id}/cancel`

说明：

- 支持可选 `reason`
- 已支付订单取消后会自动生成退款记录，前端应在订单详情中展示取消原因、退款状态和预计到账时间

### 8.7 执行人上报"开始准备"

`POST /api/v2/orders/{order_id}/start-preparing`

说明：

- 仅 `status=assigned` 时可调用
- 调用方为执行飞手（自执行场景下为机主本人）
- 调用成功后订单进入 `preparing`

### 8.8 执行人上报"已起飞"

`POST /api/v2/orders/{order_id}/start-flight`

说明：

- 仅 `status=preparing` 时可调用
- 调用成功后订单进入 `in_transit`，同时创建飞行记录（若尚未创建）

### 8.9 执行人上报"已投送"

`POST /api/v2/orders/{order_id}/confirm-delivery`

说明：

- 仅 `status=in_transit` 时可调用
- 调用成功后订单进入 `delivered`，通知客户确认签收

### 8.10 客户确认签收

`POST /api/v2/orders/{order_id}/confirm-receipt`

说明：

- 仅 `status=delivered` 时可调用
- 调用成功后订单进入 `completed`，触发结算流程
- 若客户 24 小时内未操作，系统自动确认

### 8.11 查看订单监控数据

`GET /api/v2/orders/{order_id}/monitor`

### 8.12 获取订单统一时间线

`GET /api/v2/orders/{order_id}/timeline`

说明：

- 聚合返回 `order_timeline`、`payment`、`refund`、`dispatch_task`、`flight_record` 等事件源
- 事件按 `occurred_at` 倒序排列
- 每条事件包含 `event_type / title / description / status / source_type / source_id / payload`
- 用于前端统一渲染订单进度，不再分别请求支付、派单、飞行节点后自行拼接
- 客户侧应优先使用订单统一时间线理解执行过程，而不是暴露独立“派单任务”对象

### 8.13 机主发起派单

`POST /api/v2/orders/{order_id}/dispatch`

request:

```json
{
  "dispatch_mode": "bound_pilot",
  "target_pilot_user_id": 51,
  "reason": "优先指派合作飞手"
}
```

说明：

- `dispatch_mode=self_execute` 时，不创建派单任务，订单直接进入 `assigned`
- `dispatch_mode=bound_pilot` 时，目标飞手必填
- `dispatch_mode=candidate_pool` / `general_pool` 时，可由系统自动筛选目标飞手

### 8.14 获取正式派单列表

`GET /api/v2/dispatch-tasks`

query:

- `role=owner|pilot`
- `status`
- `page`
- `page_size`

说明：

- `role=owner` 返回当前机主发出的正式派单
- `role=pilot` 返回当前飞手收到的正式派单
- 只返回正式派单对象，不混旧任务池、需求候选或订单列表

### 8.15 获取派单详情

`GET /api/v2/dispatch-tasks/{dispatch_id}`

### 8.16 机主重派

`POST /api/v2/dispatch-tasks/{dispatch_id}/reassign`

## 9. 飞行接口

### 9.1 获取飞行监控详情

`GET /api/v2/flight-records/{flight_id}`

### 9.2 上报飞行位置

`POST /api/v2/flight-records/{flight_id}/positions`

### 9.3 上报告警

`POST /api/v2/flight-records/{flight_id}/alerts`

### 9.4 完成飞行记录

`POST /api/v2/flight-records/{flight_id}/complete`

## 10. 财务与争议接口

### 10.1 获取订单支付记录

`GET /api/v2/orders/{order_id}/payments`

### 10.2 发起退款

`POST /api/v2/orders/{order_id}/refund`

### 10.3 获取退款记录

`GET /api/v2/orders/{order_id}/refunds`

### 10.4 获取结算信息

`GET /api/v2/orders/{order_id}/settlement`

### 10.5 获取争议记录

`GET /api/v2/orders/{order_id}/disputes`

### 10.6 发起争议

`POST /api/v2/orders/{order_id}/disputes`

### 10.7 创建评价

`POST /api/v2/orders/{order_id}/reviews`

request:

```json
{
  "target_user_id": 23,
  "target_role": "owner",
  "rating": 5,
  "content": "按时完成山区吊运任务"
}
```

说明：

- 仅 `status=completed` 的订单允许评价
- 同一评价人对同一订单同一目标默认只允许提交一次
- `target_role` 当前支持 `client / owner / pilot`

### 10.8 获取订单评价列表

`GET /api/v2/orders/{order_id}/reviews`

返回对象：`ReviewSummary`

### 10.9 获取我的评价记录

`GET /api/v2/me/reviews`

## 11. 通知与消息接口

### 11.1 获取系统通知

`GET /api/v2/notifications`

### 11.2 标记通知已读

`POST /api/v2/notifications/{notification_id}/read`

### 11.3 获取会话列表

`GET /api/v2/conversations`

说明：

- 当前只返回用户与其他角色的有效会话，不返回 `system-*` 系统通知会话
- 关键业务状态变更会自动写入关联会话，确保用户在”会话消息”页也能看到订单推进提示
- 返回字段沿用 `conversation_id / last_message / last_time / last_type / peer_id / unread_count`

### 11.4 获取会话消息

`GET /api/v2/conversations/{conversation_id}/messages`

说明：

- 仅会话参与方可读取
- 消息列表中可能包含 `message_type=system` 的业务系统消息
- `extra_data` 中会补充 `event_type / title / business_type / order_id / dispatch_task_id` 等业务上下文

## 12. 错误码建议

建议至少定义以下业务错误码：

| 错误码 | 含义 |
|--------|------|
| `AUTH_REQUIRED` | 未登录 |
| `FORBIDDEN` | 无权限 |
| `PROFILE_REQUIRED` | 缺少身份档案 |
| `OWNER_PROFILE_REQUIRED` | 缺少机主档案 |
| `PILOT_PROFILE_REQUIRED` | 缺少飞手档案 |
| `PILOT_NOT_VERIFIED` | 飞手未认证 |
| `DRONE_NOT_AVAILABLE` | 无人机不可用 |
| `SUPPLY_NOT_ACTIVE` | 供给未生效 |
| `DEMAND_NOT_OPEN` | 需求不可操作 |
| `QUOTE_NOT_FOUND` | 报价不存在 |
| `ORDER_STATUS_INVALID` | 当前订单状态不允许该操作 |
| `DISPATCH_STATUS_INVALID` | 当前派单状态不允许该操作 |
