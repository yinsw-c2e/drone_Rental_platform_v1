# API v1 / v2 差异对照

最后更新：2026-03-15

本文档用于说明当前项目中 `v1` 与 `v2` 的边界、映射关系与切换建议。它是联调说明，不替代详细业务规则；业务口径以 [BUSINESS_ROLE_REDESIGN.md](../../docs/business/BUSINESS_ROLE_REDESIGN.md) 和 [BUSINESS_API_CONTRACT.md](../../docs/business/BUSINESS_API_CONTRACT.md) 为准。

## 1. 总体变化

### 1.1 路由前缀

- `v1`: `/api/v1`
- `v2`: `/api/v2`

### 1.2 响应结构

- `v1`: 使用旧 `response.Success/Error` 结构，字段口径不统一。
- `v2`: 统一使用 `V2Envelope`。

示例：

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "meta": {},
  "trace_id": "trace-12345"
}
```

### 1.3 鉴权与初始化

- `v1`: `GET /api/v1/me` 返回 legacy `user_type` 兼容信息。
- `v2`: `GET /api/v2/me` 返回后端计算后的初始化信息与 `RoleSummary`，不再依赖前端拼角色。

### 1.4 业务对象边界

`v2` 明确拆开：

- `demands`: 客户发布的公开需求
- `owner_supplies`: 机主可提供的供给
- `orders`: 成交后的订单
- `dispatch_tasks`: 正式派单任务
- `flight_records`: 履约飞行记录

`v1` 中这些语义经常混在：

- `rental demand / cargo demand`
- `rental offer`
- `dispatch task pool`
- `pilot flight logs`

## 2. 已完成迁移的主链路

### 2.1 认证与初始化

| 场景 | v1 | v2 | 说明 |
|---|---|---|---|
| 注册 | `POST /api/v1/auth/register` | `POST /api/v2/auth/register` | v2 会自动补默认客户档案 |
| 登录 | `POST /api/v1/auth/login` | `POST /api/v2/auth/login` | 保持 JWT 鉴权 |
| 刷新 token | `POST /api/v1/auth/refresh-token` | `POST /api/v2/auth/refresh-token` | 阶段 9 已补齐 |
| 登出 | `POST /api/v1/auth/logout` | `POST /api/v2/auth/logout` | 阶段 9 已补齐 |
| 初始化 | `GET /api/v1/me` | `GET /api/v2/me` | v2 返回统一角色摘要 |

### 2.2 客户链路

| 场景 | v1 | v2 | 说明 |
|---|---|---|---|
| 客户档案 | `/api/v1/client/profile` | `/api/v2/client/profile` | v2 保留客户档案，但不再要求先单独注册个人客户 |
| 发布需求 | `/api/v1/client/demands` | `/api/v2/demands` | v2 统一需求对象 |
| 我的需求 | `/api/v1/client/demands` | `/api/v2/demands/my` | v2 返回需求统计聚合 |
| 需求详情 | `/api/v1/client/demands/:id` | `/api/v2/demands/{demand_id}` | |
| 发布需求 | `/api/v1/client/demands/:id/publish` | `/api/v2/demands/{demand_id}/publish` | |
| 取消需求 | `/api/v1/client/demands/:id/cancel` | `/api/v2/demands/{demand_id}/cancel` | |
| 查看报价 | `/api/v1/client/demands/:id/quotes` | `/api/v2/demands/{demand_id}/quotes` | |
| 选择机主 | `/api/v1/client/demands/:id/select-provider` | `/api/v2/demands/{demand_id}/select-provider` | v2 会生成 `demand_market` 订单 |
| 供给市场 | 分散在 `/drone`、`/rental/offer` | `/api/v2/supplies` | v2 只暴露符合重载准入的供给 |
| 直达下单 | `/api/v1/supplies/:supply_id/orders` | `/api/v2/supplies/{supply_id}/orders` | v2 统一走 `supply_direct` |

### 2.3 机主链路

| 场景 | v1 | v2 | 说明 |
|---|---|---|---|
| 机主档案 | `/api/v1/owner/profile` | `/api/v2/owner/profile` | |
| 无人机管理 | `/api/v1/owner/drones`、`/api/v1/drone` | `/api/v2/owner/drones` | v2 面向机主经营视角 |
| 资质提交 | `/api/v1/drone/:id/*` | `/api/v2/owner/drones/{drone_id}/certifications` | v2 统一入口 |
| 供给管理 | `/api/v1/owner/supplies`、`/api/v1/rental/offer` | `/api/v2/owner/supplies` | v2 以 `owner_supplies` 为真相源 |
| 推荐需求 | `/api/v1/owner/demands/recommended` | `/api/v2/owner/demands/recommended` | v2 已接统一撮合服务 |
| 报价 | `/api/v1/demands/:demand_id/quotes` | `/api/v2/demands/{demand_id}/quotes` | |
| 绑定飞手 | `/api/v1/owner/pilot-bindings` | `/api/v2/owner/pilot-bindings` | 状态机已统一 |

### 2.4 飞手链路

| 场景 | v1 | v2 | 说明 |
|---|---|---|---|
| 飞手档案 | `/api/v1/pilot/profile` | `/api/v2/pilot/profile` | |
| 在线状态 | `/api/v1/pilot/availability` | `/api/v2/pilot/availability` | |
| 绑定机主 | `/api/v1/pilot/owner-bindings` | `/api/v2/pilot/owner-bindings` | |
| 候选需求 | `/api/v1/pilot/candidate-demands` | `/api/v2/pilot/candidate-demands` | |
| 报名候选 | `/api/v1/demands/:demand_id/candidate` | `/api/v2/demands/{demand_id}/candidate` | |
| 正式派单列表 | `/api/v1/pilot/dispatch-tasks` | `/api/v2/pilot/dispatch-tasks` | v2 只看正式派单，不再混任务池 |
| 派单响应 | `/api/v1/dispatch-tasks/:dispatch_id/accept/reject` | `/api/v2/dispatch-tasks/{dispatch_id}/accept/reject` | |
| 飞行记录 | `/api/v1/pilot/flight-records` | `/api/v2/pilot/flight-records` | v2 读真实 `flight_records` |

### 2.5 订单 / 财务 / 通知链路

| 场景 | v1 | v2 | 说明 |
|---|---|---|---|
| 订单列表 | `/api/v1/order` | `/api/v2/orders` | v2 支持 `role=status` 过滤 |
| 订单详情 | `/api/v1/order/:id` | `/api/v2/orders/{order_id}` | v2 补齐来源、参与方、派单、财务摘要 |
| 机主确认直达单 | `/api/v1/order/:id/provider-confirm` | `/api/v2/orders/{order_id}/provider-confirm` | |
| 机主拒绝直达单 | `/api/v1/order/:id/provider-reject` | `/api/v2/orders/{order_id}/provider-reject` | |
| 支付 | `/api/v1/payment/create` | `/api/v2/orders/{order_id}/pay` | v2 支持 `mock / wechat / alipay` |
| 支付记录 | `/api/v1/payment/history` | `/api/v2/orders/{order_id}/payments` | v2 改为按订单读 |
| 退款 | `/api/v1/payment/:id/refund` | `/api/v2/orders/{order_id}/refund` | |
| 退款记录 | 无统一接口 | `/api/v2/orders/{order_id}/refunds` | |
| 结算详情 | `/api/v1/settlement/order/:order_id` | `/api/v2/orders/{order_id}/settlement` | v2 走订单聚合视角 |
| 争议 | 无统一新模型接口 | `/api/v2/orders/{order_id}/disputes` | v2 已接入查询与创建 |
| 系统通知 | `/api/v1/message/*` 中混杂 | `/api/v2/notifications` | v2 只看系统通知，不混聊天会话 |
| 评价 | `/api/v1/review/*` | `/api/v2/orders/{order_id}/reviews`、`/api/v2/me/reviews` | v2 绑定订单上下文 |

## 3. 当前 v2 已实现、但仍是过渡期的点

这些接口已经能联调，但内部服务仍保留部分 legacy 兼容逻辑：

- `/api/v2/auth/*`
- `/api/v2/me`
- `/api/v2/client/*`
- `/api/v2/supplies/*`
- `/api/v2/demands/*`
- `/api/v2/owner/*`
- `/api/v2/pilot/*`
- `/api/v2/orders/*`
- `/api/v2/dispatch-tasks/*`
- `/api/v2/notifications/*`

这不影响联调，但说明：

- 当前尚未执行正式数据库迁移
- v1 入口仍可用
- 代码层是“新模型 + 兼容读写”的过渡状态

补充：

- 移动端主链路已默认切到 `v2`
- 管理后台默认 API 前缀已切到 `/api/v2`
- 后端已提供 `admin / analytics / client admin cargo` 的 v2 兼容别名
- `/api/v1` 的核心业务写入已冻结，主流程不应再依赖 v1 写接口

## 4. 当前 v2 仍未实现的路由

这些路由已经在 `router.go` 占位，但仍返回 `NOT_IMPLEMENTED`：

### 4.1 订单执行动作

- `POST /api/v2/orders/{order_id}/cancel`
- `POST /api/v2/orders/{order_id}/start-preparing`
- `POST /api/v2/orders/{order_id}/start-flight`
- `POST /api/v2/orders/{order_id}/confirm-delivery`
- `POST /api/v2/orders/{order_id}/confirm-receipt`

### 4.2 飞行记录明细动作

- `GET /api/v2/flight-records/{flight_id}`
- `POST /api/v2/flight-records/{flight_id}/positions`
- `POST /api/v2/flight-records/{flight_id}/alerts`
- `POST /api/v2/flight-records/{flight_id}/complete`

### 4.3 会话消息

- `GET /api/v2/conversations`
- `GET /api/v2/conversations/{conversation_id}/messages`

## 5. 当前仍主要停留在 v1 的域

以下领域还没有完成 v2 化，联调时仍应主要参考 v1：

- 地图与地址：`/api/v1/location`、`/api/v1/address`
- 空域合规：`/api/v1/airspace`
- 信用风控：`/api/v1/credit`
- 保险理赔：`/api/v1/insurance`
- 钱包、提现、管理员结算流程

说明：

- `admin / analytics` 当前已经能通过 `/api/v2` 兼容别名访问，但返回结构仍沿用旧后台口径
- 这属于切流兼容层，不代表后台领域已经完成完整 v2 DTO 重构

## 6. 切换建议

### 6.1 新功能开发

优先走 `v2`，不要再往 `v1` 新增业务入口。

### 6.2 旧页面迁移

建议按页面逐块切：

1. 登录与初始化
2. 首页角色摘要
3. 客户需求与供给市场
4. 机主经营链路
5. 飞手执行链路
6. 订单与监控
7. 通知与评价

### 6.3 联调建议

- 先使用 `GET /api/v2/me` 判断角色和能力
- 支付联调优先使用 `method=mock`
- 订单和飞行问题优先在 `v2` 看 `order detail / order monitor / flight_records`
- 阶段 9 执行迁移后，优先跑 `go run ./cmd/check_v2_parity -config config.yaml -limit 3`
- 需要查 legacy 数据时，再回到 `v1`

## 7. 参考文件

- [当前已实现的 OpenAPI v2](./openapi-v2.yaml)
- [业务角色重构文档](../../docs/business/BUSINESS_ROLE_REDESIGN.md)
- [字段字典](../../docs/business/BUSINESS_FIELD_DICTIONARY.md)
- [API 契约](../../docs/business/BUSINESS_API_CONTRACT.md)
- [数据库迁移方案](../../docs/business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
