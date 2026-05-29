# 重载吊运即时调度重构任务书

> 基线日期：2026-05-26
> 适用范围：backend (Go/Gin) + mini-program (Taro/WeChat) + admin (React) + mobile (RN)
> 文档定位：作为 codex 执行的唯一指令源；每完成一项必须回写勾选并补充验收证据。

> Codex 执行备注（2026-05-26）：当前用户明确暂不推进 App / Web，本文中的 `mobile` 指 RN App，`admin` 指管理端 Web。本轮执行先聚焦 backend + mini-program 主链路；admin/mobile UI 任务保留到后续阶段。

---

## 0. 重构目标（Why）

把当前"重载末端货物吊运 + 需求市场 + 机主报价 + 派单"的撮合型平台，
改造为对货主**一键下单**、对服务商**抢单/秒接**、平台**自动算价**的**平台化即时（含预约）吊运服务**。

业务边界保持不变（仍为 ≥150kg 起飞重量 / ≥50kg 有效载荷的重载无人机吊运），
但**用户心智、下单链路、撮合机制、计价模型、履约可视化**全部对齐成熟即时调度产品的体验标准。

### 0.1 即时调度模型的核心特征（目标态）

| 维度 | 即时调度平台做法 | 当前项目做法 | 差距 |
|------|-----------|--------------|------|
| 下单心智 | 输入起点/终点 → 选车型 → 看到固定预估价 → 一键下单 | 客户写"需求"→ 等机主报价 → 比价 → 选机主 | 主路径过长，预算/价格由机主报，客户被动等待 |
| 计价 | 平台按 `车型基础价 + 公里 + 时长 + 附加项` **自动算价**，下单前可见 | 机主自由报价，或供给挂牌价 × 用量 | 没有平台计价引擎，无标准车型/机型价目表 |
| 匹配 | 附近司机**广播抢单** 或 系统**指派最近** | 机主主动浏览需求市场 / 派单给飞手 | 没有实时位置 + 自动广播池；机主仍要"看市场" |
| 角色 | 用户只感知 `货主` 与 `司机`，平台内部不暴露多层身份 | 用户面对 `客户 / 机主 / 飞手 / 复合` 四种身份 | 用户认知负担过重 |
| 订单类型 | 即时单（现在叫车）+ 预约单 + 企业月结 | 全部走"发布需求 → 报价 → 选定"，无即时单概念 | 缺少"即时单"主路径 |
| 司机侧 | 上线/下线开关，附近订单池，抢单按钮 | 飞手登录后看"派单列表"或"候选需求" | 没有"上线接单"模式与广播池 |
| 全程可视化 | 地图 + 车辆实时位置 + ETA + 状态条 | 仅有 v1 飞行轨迹页，v2 监控未接通 | 客户视角的位置/ETA 缺失 |
| 结算 | 行程后系统算实际金额，含加价、小费、改派 | 订单完成后 T+3 自动分账 | 缺少加价、小费、临时改派、超时改派 |
| 评价/责任 | 双向评价 + 投诉 + 取消规则 + 平台兜底 | 双向评价雏形，取消/责任在合约层模糊 | 取消规则与责任链需收紧 |

### 0.2 不变的边界

仍然守住以下硬约束，不要在重构中被即时调度模型"带偏"：

- 只服务**重载吊运**，禁止扩到航拍/植保/测绘/同城闪送
- 机型准入 `mtow_kg ≥ 150 且 max_payload_kg ≥ 50`
- 短距末端运输仅做**空域报备**，不做航线审批
- 涉及金融的链路（支付、结算、退款）必须有真实通道与幂等保障

---

## 1. 整体策略（How）

### 1.1 三条主链路在新模型下的定位

| 新链路 | 入口 | 适用场景 | 计价 | 撮合方式 |
|--------|------|----------|------|----------|
| **即时单**（核心） | 货主端"立即吊运" | 标准场景，参数齐全（起降点、重量、机型档） | 平台算价 | 附近服务商广播抢单 / 自动指派 |
| **预约单** | 货主端"预约吊运" | 未来 1-30 天的标准场景 | 平台算价 | 预约时段前 2 小时广播 |
| **议价单**（保留旧链路） | 货主端"复杂需求" | 非标场景（应急、特种货物、长时段、需勘察） | 服务商报价 | 现有"需求市场 + 报价"链路 |

> 即时单 + 预约单走平台自动算价 + 抢单；议价单作为旧链路保留，但**默认不再是首页主入口**。

### 1.2 角色对外可见性收敛

对外只暴露两个身份："货主" 和 "服务商"。
- 平台内部仍保留 `客户 / 机主 / 飞手 / 复合` 的能力档案模型（数据库与权限层）。
- 小程序、移动 App、货主端 UI 一律使用 `货主 / 服务商`，禁止再出现 `机主`、`飞手`、`派单`、`候选池`、`报价` 等术语。
- 管理后台保留全部内部术语用于运营治理。

> 这一条不重做角色模型（避免回头大重构），只做术语与 UI 收敛。已有 `provider` 工作台是好基础。

### 1.3 数据层最小改动原则

- **新增表/字段** 优先，不要拆已有 `orders / dispatch_tasks` 表。
- 即时单产生的订单与议价单订单共用 `orders` 主表，新增字段标识下单模式。
- 抢单池作为独立表，不污染现有 `dispatch_tasks`（dispatch 在新模型下仅作内部派飞手用）。

---

## 2. 阶段总览

| 阶段 | 主题 | 估算 | 复杂度 | 依赖 |
|------|------|------|--------|------|
| H1 | 计价引擎与机型档（pricing） | 1 周 | M | - |
| H2 | 即时单/预约单模型与下单链路（order create） | 1.5 周 | L | H1 |
| H3 | 服务商上线接单 + 抢单广播池（dispatch broadcast） | 1.5 周 | L | H2 |
| H4 | 实时位置 + ETA + 全程可视化（tracking） | 1 周 | M | H3 |
| H5 | 行程后结算调整：加价/小费/超时（settlement v2） | 1 周 | M | H2、H4 |
| H6 | 取消、改派、责任链收紧（cancel & reassign） | 1 周 | M | H3、H5 |
| H7 | 货主端 UI 即时下单化（mini-program 主路径） | 1.5 周 | M | H1–H6 |
| H8 | 服务商端 UI 抢单化（mini-program / mobile） | 1 周 | M | H3、H4 |
| H9 | 管理端：机型档/广播策略/抢单监控配置 | 0.5 周 | S | H1、H3 |
| H10 | 端到端验收 + 文档回写 + 旧主入口降级 | 0.5 周 | S | H1–H9 |

总计：约 10 周（单人节奏）。codex 并发可压缩到 5–6 周。

---

## 3. 任务清单

### H1 计价引擎与机型档

**目标**：货主在下单前看到平台自动算出的固定预估价。

#### [x] H1.01 设计机型档（service_class）

- 在 `backend/internal/model/` 新增 `service_class.go`，定义 `ServiceClass` 表：
  - 字段：`id, code, display_name, mtow_min_kg, mtow_max_kg, payload_min_kg, payload_max_kg, base_price_cents, per_km_price_cents, per_minute_price_cents, min_charge_cents, night_surcharge_rate, plateau_surcharge_rate, emergency_surcharge_rate, status, sort_order, created_at, updated_at`
  - 初始档位建议（运营可改）：
    - `light_heavy`（150–300kg / 50–80kg）
    - `medium_heavy`（300–600kg / 80–150kg）
    - `super_heavy`（>600kg / >150kg）
- 新增迁移脚本 `backend/migrations/20260601_create_service_class.sql`
- 验收：本轮按后端优先范围完成 `service_classes` 表和 3 个默认档位，已在本地开发库查询确认；管理端改价 UI 延后到 H9。

#### [x] H1.02 实现计价 service

- 新增 `backend/internal/service/pricing_service.go`：
  - 入参：`origin/destination 经纬度`、`cargo_weight_kg`、`scheduled_start_at`、`service_class_code`、`cargo_scene`
  - 出参：`base_price`、`distance_km`、`duration_min`、`distance_fee`、`duration_fee`、`surcharges []{name, amount}`、`min_charge`、`total_estimated_cents`、`price_breakdown_json`
  - 距离用 Haversine（短距吊运直线距离即可，后续可换路径算法）
  - 时长按 `distance_km / 巡航速度 + 装卸预留` 估算（配置项默认 60km/h、装卸 15min）
  - 夜间附加：22:00–06:00 起飞 +20%
  - 高原/海岛/应急场景按 `cargo_scene` 加价（高原 +15%、海岛 +20%、应急 +30%）
- 单测 `pricing_service_test.go`：3 档 × 3 场景 = 9 个标准用例 + 边界用例（最短/最长距离、夜间叠加）

#### [x] H1.03 暴露报价接口

- 在 `backend/internal/api/v2/order/handler.go` 新增 `POST /api/v2/orders/estimate`
- 请求：origin、destination、weight、scheduled_at、service_class
- 响应：H1.02 出参
- 不写库、不限流到注册用户（允许游客先看预估价）
- 验收：相同入参多次调用返回同一价格；夜间用例附加费正确。

---

### H2 即时单/预约单模型与下单链路

**目标**：货主输入"起点 + 终点 + 重量 + 机型档"即可下单，跳过需求市场和机主报价。

#### [x] H2.01 扩展 orders 表

- 在 `backend/internal/model/order_misc.go` 给 `Order` 加字段：
  - `OrderMode string`（`instant` / `reservation` / `negotiated`，默认 `negotiated` 兼容旧）
  - `ServiceClassCode string`
  - `EstimatedDistanceM int`
  - `EstimatedDurationMin int`
  - `PriceBreakdownJSON datatypes.JSON`
  - `BroadcastPoolID *int64`（H3 用）
  - `ReservedStartAt *time.Time`
  - `GrabbedAt *time.Time`、`GrabbedByUserID int64`
- 新增迁移脚本。**不动既有字段**。
- 完成：新增迁移 119，`order_mode` 默认 `negotiated`，已对历史空值回填 `negotiated`。

#### [x] H2.02 创建即时单 / 预约单接口

- `POST /api/v2/orders/instant`：
  - 入参：origin、destination、weight、service_class、cargo_scene、scheduled_at（缺省=now）、备注
  - 业务：调用 H1.02 拿价 → 写 `orders` 行（`order_mode=instant`、`status=pending_dispatch`、`order_source=instant`）→ 写 OrderTimeline → 推送 H3 广播池
  - **不**生成 demand 记录、**不**等机主确认（除非配置项强制）
- `POST /api/v2/orders/reservation`：同上但 `order_mode=reservation`、`status=scheduled`、延迟入池
- 旧接口 `POST /api/v2/demands` 保留作为 `negotiated` 入口，不动。
- 验收：货主从一个新接口可在 < 5 秒生成 `pending_dispatch` 订单。
- 完成：新增 `POST /api/v2/orders/instant` 与 `POST /api/v2/orders/reservation`；金额只由 `PricingService.Estimate` 生成并写入 `orders.total_amount` 与 `price_breakdown_json`，请求体不接收金额。
- 说明：H3 广播池尚未落库，H2 只预留 `broadcast_pool_id`。

#### [x] H2.03 订单状态机扩展

- 在 `backend/internal/service/order_service.go` 增加合法转换：
  - `pending_dispatch → assigned`：服务商抢单或被指派
  - `scheduled → pending_dispatch`：预约单到时入池（由定时任务触发，见 H3.04）
  - `paid` 与 `assigned` 顺序不强约束：即时单允许"先抢单后支付"（先冻结预授权）
- 把 `pending_provider_confirmation` 路径限定为 `order_mode=negotiated` 才走，即时单不进入此状态。
- 单测覆盖：新增 `order_mode=instant` 的状态机用例 ≥ 6 个。
- 完成：`pending_provider_confirmation` 仅由 `negotiated + supply_direct` 进入，空 `order_mode` 按 `negotiated` 兼容；新增 8 个模式/状态兼容用例，并覆盖即时单误入确认路径的拒绝。

#### [x] H2.04 v1 接口冻结二次确认

- 确保 v1 `cargo/order` 写入仍由 `FreezeLegacyWriteMiddleware` 拦截。
- 若发现旧 cargo 入口仍有人能下单，加路由级 410。
- 完成：确认 v1 cargo/order/payment/dispatch 等写路径仍挂 `FreezeLegacyWriteMiddleware`，本次未放开旧入口写入。

---

### H3 服务商上线接单 + 抢单广播池

**目标**：服务商有"上线/下线"开关；上线后能在自己服务范围内看到附近即时单并抢单。

#### [x] H3.01 服务商在线状态表

- 新增 `backend/internal/model/provider_presence.go`：`ProviderPresence{ user_id, online, last_lat, last_lng, last_heartbeat_at, accepted_service_classes []string, max_radius_km, status }`
- 接口：
  - `POST /api/v2/provider/presence/online`
  - `POST /api/v2/provider/presence/offline`
  - `POST /api/v2/provider/presence/heartbeat`（含经纬度，10 秒一次）
- 服务商离线 60 秒以上自动视为下线（定时清理）。
- 完成：新增 `provider_presences` 表、在线/离线/心跳接口；列表查询前会把 60 秒未心跳的服务商视为离线。

#### [x] H3.02 抢单广播池

- 新增 `backend/internal/model/order_broadcast.go`：`OrderBroadcast{ id, order_id, origin_lat, origin_lng, service_class_code, weight_kg, est_total_cents, status(open|grabbed|closed|expired), created_at, expires_at, grabbed_by_user_id, grabbed_at }`
- H2.02 创建即时单时同步插入一条 broadcast，`expires_at = now + 120s`（可配）。
- 新增 service `broadcast_service.go`：
  - `ListOpenForProvider(userID)`：根据该服务商在线位置 + 服务半径 + 接单档位筛选附近 open broadcast
  - `Grab(orderID, userID)`：用 DB 行锁 (`SELECT ... FOR UPDATE`) + `status=open` CAS 保证只能被一个服务商抢到；成功后写 `orders.grabbed_by_user_id` 并把订单推进到 `assigned`
- 接口：
  - `GET /api/v2/provider/broadcasts`
  - `POST /api/v2/provider/broadcasts/:id/grab`
- 验收（关键）：并发 50 个服务商抢同一订单，**有且只有一个成功**；其余收到 409。
- 完成：新增 `order_broadcasts` 表、广播池列表和抢单接口；抢单用 DB 行锁保护，并回填 `orders.broadcast_pool_id / grabbed_by_user_id / grabbed_at`，订单推进为 `assigned`。抢单不重算价格，只读订单固化金额和计价快照。

#### [x] H3.03 自动指派回退

- 在 broadcast 创建后 30s 仍无人抢，触发自动指派：
  - 按"距离最近 + 评分最高 + 完单率最高"权重选一个在线服务商
  - 发推送、给该服务商 60s 接受时窗（接受才进入 `assigned`，拒绝/超时则继续选下一个）
- 配置项：广播超时、自动指派启用开关、最多自动尝试次数（默认 3）
- 完成：新增 `broadcast_assignments` 表和迁移 121，支持 `pending_accept / accepted / declined / expired / superseded` 指派状态；广播新增 `auto_assigning` 状态，仍归属广播池但不再对外抢单。
- 完成：自动指派默认 3 轮、60s 接受时窗；候选按距离、评分、完单率加权，当前评分/完单率 getter 先稳定返回默认值，后续可接真实评价和履约统计。
- 完成：配置项支持 `broadcast.auto_assign.enabled`、`broadcast.auto_assign.trigger_lead_seconds`、`broadcast.auto_assign.accept_window_seconds`、`broadcast.auto_assign.max_attempts`、`broadcast.ttl_seconds`、`broadcast.presence.stale_timeout_seconds`、`broadcast.reservation.lead_time_seconds`、`broadcast.auto_assign.weight_distance`、`broadcast.auto_assign.weight_rating`、`broadcast.auto_assign.weight_completion`。
- 完成：新增接口 `GET /api/v2/provider/broadcast-assignments`、`POST /api/v2/provider/broadcast-assignments/:id/accept`、`POST /api/v2/provider/broadcast-assignments/:id/decline`；接受自动指派复用 H3.02 抢单落单逻辑但跳过在线位置二次校验，不重算 H2 价格快照。
- 后续注意：当前 `defaultBroadcastTTL=120s`、scheduler tick=60s、`trigger_lead=90s`，实际最早约 60s 后触发自动指派；若运营要严格 30s 触发，需要调小 tick 或调大 `broadcast.auto_assign.trigger_lead_seconds`。
- 后续注意：`ExpireOverdueAssignments` 当前逐条同步触发下一轮自动指派，现阶段可接受，规模化后可改为队列批处理。
- 后续注意：`broadcast_assignments` 当前无数据库外键级联，误删 `order_broadcasts` 可能留下孤儿记录，H10 运营清理脚本需要覆盖。

#### [x] H3.04 预约单到点入池

- 新增定时任务（cron 或 ticker）：每分钟扫描 `scheduled` 订单，`scheduled_at - 2h ≤ now` 的批量推入广播池并切到 `pending_dispatch`。
- 完成：`BroadcastService` 每分钟扫描 `reservation + scheduled` 订单，`reserved_start_at <= now + 2h` 时推进到 `pending_dispatch` 并创建广播。

#### [x] H3.05 与旧 dispatch_tasks 的边界

- 旧 `dispatch_tasks` 仅用于"服务商已接单 → 在自己组织内部指派飞手"。
- 即时单 + 预约单**不**生成 `dispatch_tasks`，直到服务商在订单详情手动点"安排飞手"才生成。
- 文档里明确写：抢单 ≠ 派单。
- 完成：H3 新增独立 `order_broadcasts`，抢单不写旧 `dispatch_tasks`。

---

### H4 实时位置与全程可视化

**目标**：货主在订单页能看到机/车的实时位置 + ETA + 已飞距离。

#### [x] H4.01 v2 飞行记录接口补齐

- 实现 `PROJECT_ANALYSIS_AND_ROADMAP.md` 标的 P11.02 全部接口：
  - `GET /flight-records/:id`
  - `POST /flight-records/:id/positions`
  - `POST /flight-records/:id/alerts`
  - `POST /flight-records/:id/complete`
- 客户端订阅：`GET /api/v2/orders/:id/live`（SSE 或长轮询，复用 v1 WS 也可）
- 完成：确认 v2 已暴露 `GET /api/v2/flight-records/:id`、`POST /api/v2/flight-records/:id/positions`、`POST /api/v2/flight-records/:id/alerts`、`POST /api/v2/flight-records/:id/complete`，并新增订单侧轻量 live 订阅接口 `GET /api/v2/orders/:id/live`。

#### [x] H4.02 ETA 计算

- 在 `flight_service.go` 增加 ETA 推算（剩余距离 / 实时速度，无速度时回退到机型档巡航速度）。
- 订单详情接口返回 `live.eta_seconds, live.progress_pct, live.last_position`。
- 完成：`FlightService.GetOrderLive` 返回 `eta_seconds / progress_pct / last_position`，位置速度缺失时优先读取机型档 `cruise_speed_kmh`，当前表无该列则回退 60km/h；订单详情复用同一 live 结果。

#### [x] H4.03 货主端地图组件

- mini-program：`src/pages/order/live/index.tsx`（新建或复用已有飞行监控页降级版）
- 显示：起点、终点、当前位置、ETA、状态时间线（已下单 / 已接单 / 准备中 / 飞行中 / 已送达）
- 失败态：定位丢失 ≥ 30s 显示"信号弱"提示，不阻塞页面。
- 完成：新增 `mini-program/src/pages/orders/live/`，5s 轮询 `GET /api/v2/orders/:id/live`，显示起点/终点/实时位置/ETA/进度/信号弱提示；订单详情页对即时/预约单增加"查看实时位置"入口。

---

### H5 行程后结算调整

**目标**：实际距离/时长产生差异时支持多退少补；支持小费、加价、改派分账。

#### H5.01 结算单字段补齐 [x]

- `Settlement` 表新增：
  - `EstimatedAmount`（下单时预估）
  - `ActualDistanceFee`、`ActualDurationFee`、`SurchargeAmount`、`TipAmount`、`PriceAdjustReason`
  - `AdjustReviewed bool`、`AdjustReviewedBy`、`AdjustReviewedAt`
- 单据流：`completed` → `pending` → `processing`（自动结算）；调整幅度 > 预估 20% 强制 `pending_review`
- 完成：新增迁移 122，把调整字段落在 `order_settlements`；`settlement.adjust_review_threshold_pct` 接入 `system_configs`，超过阈值阻断自动入账进入 `pending_review`。

#### H5.02 货主可加小费 [x]

- `POST /api/v2/orders/:id/tip`：货主在"飞行中"或"已送达"前 24h 可加小费。
- 小费即时入服务商待结算余额，不走 T+3。
- 完成：新增 `POST /api/v2/orders/:id/tip`，小费以单事务写入 `payments(type=tip)`、`order_settlements.tip_amount`、服务商钱包流水；不修改 `orders.total_amount` 或 `orders.price_breakdown_json`。

#### H5.03 加价（货主主动） [x]

- 即时单无人抢 90s 后，提示货主"附近运力紧张，是否加价 X 元"，加价后写入结算调整并刷新广播。
- 完成：新增 `POST /api/v2/orders/:id/price-increase`，加价写入 `order_settlements.surcharge_amount` 并刷新 `order_broadcasts.estimated_total_cents/expires_at`；保留 H2 订单金额和价格明细快照不变。
- 完成：H7.01 在实时位置页检测 `instant + pending_dispatch + 创建超过 90s` 后展示"附近运力紧张，加价试试"引导，调用同一个加价接口。

---

### H6 取消、改派、责任链

**目标**：取消与责任规则向即时调度场景收紧，避免"卡单"。

#### H6.01 取消规则 [x]

- 货主取消：
  - `pending_dispatch` 阶段：免费取消
  - `assigned` 后 5 分钟内：免费
  - `assigned` 超过 5 分钟 / `preparing` 中：扣预估价 10%
  - `in_transit`：原则上不允许取消，进入争议流程
- 服务商取消：
  - `assigned` 后任何阶段取消都扣信用分（积累到阈值降权或封号）
  - 自动触发 H3.03 的重新指派
- 完成：客户即时/预约单取消接入 `cancel.grace_window_seconds` 与 `cancel.client_penalty_rate`；`pending_dispatch` 免费、`assigned` 5 分钟内免费、超时或 `preparing` 扣 10%、`in_transit` 自动创建争议记录；服务商取消记录信用扣减并触发自动重派。

#### H6.02 改派（reassign） [x]

- 服务商点"无法继续履约"→ 订单回到 `pending_dispatch`，进入广播池二次招募；
- 计费按已发生的距离/时长结算给原服务商，差额从平台抽成中扣减。
- 完成：新增迁移 123，在 `order_settlements` 增加 `partial_handover_*` 字段；服务商取消时按已发生距离/时长比例即时入账原服务商，订单回 `pending_dispatch`，广播池刷新剩余金额并调用 H3.03 自动指派。
- 待优化：当前部分结算按 `orders.actual_flight_distance / actual_flight_duration` 快照估算，`in_transit` 早期可能尚未由飞行完成流程写入；真实飞行数据接通后应改为从 `flight_records` 累计实时里程/时长。

#### H6.03 责任链字段 [x]

- 沿用 `BUSINESS_ROLE_REDESIGN.md §8` 的 `provider_user_id / drone_owner_user_id / executor_pilot_user_id` 三字段，**不**改名。
- 即时单首次创建时三个字段都填同一个服务商 user_id；服务商在订单详情指派飞手时才更新 `executor_pilot_user_id`。
- 完成：取消/改派逻辑只清理当前服务商责任字段并回到服务商接单池，数据库字段继续保留兼容命名，用户侧不新增"机主/飞手"主流程。

---

### H7 货主端 UI 即时下单化（mini-program）

**目标**：小程序首页突出立即吊运心智。

#### H7.01 首页改版 [x]

- 文件：`mini-program/src/pages/home/CustomerHaulHome.tsx`
- 顶部：地址选择条（起点自动定位 / 终点搜索）
- 中部：机型档选择卡片（H1.01 三档）
- 下部：备注、预约时间、立即/预约切换按钮
- 底部主 CTA：`预估价 ¥XXX  立即下单`
- 入口可见性：原"发布需求"降级到二级菜单"复杂服务/议价单"
- 完成：新增公开 `GET /api/v2/service-classes`，首页使用真实机型档和 `POST /api/v2/orders/estimate` 自动估价；主 CTA 调 `POST /api/v2/orders/instant|reservation`，成功后跳转实时位置页；H5.03 加价提示补到实时位置页。

#### H7.02 订单卡片改版 [x]

- 字段：当前状态条 + 服务商头像/电话/评分 + 实时位置缩略图 + 预计送达时间 + 取消/加价/小费按钮
- 不再展示"派单任务"、"候选飞手"、"机主报价" 等术语
- 完成：`mini-program/src/pages/orders/index.tsx` 与 `mini-program/src/pages/orders/detail/index.tsx` 改为即时履约订单卡片；按钮按状态精确控制取消、加价、小费、实时位置、联系、支付、评价；清理 `home/index.tsx` 不可达旧 dashboard 代码。

#### H7.03 地址簿 [x]

- 新增 `mini-program/src/pages/address/book/` 页面
- 接口：`GET/POST/PUT/DELETE /api/v2/address`（实际后端路由，任务书原 `/api/v2/user/addresses` 为笔误）
- 完成：新增小程序云端地址簿 CRUD 页面和 `addressService`；首页"常用起吊点"优先读取云端地址簿，接口失败时保留本地 `addressHistory` 降级；地址选择器增加"云端地址簿 / 最近使用"切换和管理入口。

#### H7.04 文案/术语切换 [x]

- 全局搜索替换：`机主 → 服务商`，`飞手 → 执行人员`（仅在管理端保留），`派单 → 履约安排`（小程序隐藏入口），`需求市场 → 找服务`，`供给 → 可用方案`
- 完成：本轮只做货主主路径术语切换和旧入口审计，未做全局 sed；`pages/demand/detail`、`pages/profile/my-demands` 中的候选文案已弱化为报名承接语义。
- 完成：审计 `pages/home`、`pages/orders`、`pages/address`、`custom-tab-bar`、`services` 后，货主主路径不再直接跳转 `/pages/dispatch/*`、`/pages/fulfillment/*`、`/pages/profile/pilot/*`；原 `ProviderWorkbench` 待办入口临时落到订单详情/订单列表，异常列表也统一进订单详情。
- 保留：`pages/dispatch/`、`pages/fulfillment/hub/`、`pages/profile/pilot/`、`pages/supply/`、`pages/publish/supply/`、`pages/profile/owner/` 目录本轮不改文案、不删页面，H8 服务商端阶段统一重做。

---

### H8 服务商端 UI 抢单化

**目标**：服务商打开 App / 小程序就是"上线接单"，像滴滴司机端。

#### H8.0 在线状态基础设施 [x]

- 新增 providerPresence service / redux slice / useProviderPresence hook
- 微信小程序定位权限声明：`permission.scope.userLocation` + `requiredPrivateInfos`
- 上线/下线状态机，heartbeat 每 10s，离开页面自动停、回来自动续
- 冷启动不恢复在线状态，避免幽灵在线
- 完成：`ProviderWorkbench` dev 临时调试按钮可触发上线/下线和 heartbeat；H8.01 将替换为正式 UI 卡片。

#### H8.01 上线开关 [x]

- 顶部明显的 `上线接单` 切换；离线红色/上线绿色。
- 配套：今日已接单数、累计完单率、当前服务半径调节器。
- 完成：新增 `GET /api/v2/provider/me/stats` 返回评分、完单率、今日接单数、今日收入和累计完单数；删除 H8.0 临时调试块；`ProviderWorkbench` 顶部替换为正式上线卡片，支持 5/10/20/30km 服务半径 chip 和机型档勾选，上线前必须至少选择一个机型档。

#### H8.02 附近订单池 [x]

- 列表卡片：起点距离、终点、重量、预估金额、剩余抢单时间倒计时、`一键抢单` 按钮。
- 抢单成功后跳转订单履约页（沿用现有 provider 工作台履约组件）。
- 完成：`ProviderWorkbench` 在线态新增附近订单池，`GET /provider/broadcasts` 每 5s 轮询，倒计时前端每秒按 `expires_at` 实时计算；新增自动指派全屏 modal，`GET /provider/broadcast-assignments` 每 3s 轮询，支持接受/拒绝和 60s 倒计时；抢单 409 显示"已被其他服务商抢走"，指派 409 显示"指派已失效或超时"。

#### H8.03 收入与提现 [x]

- 沿用现有钱包，但新增"今日预估收入 + 待结算"两个数字置顶。
- 完成：`/api/v2/provider/me/stats` 新增 `pending_settlement_cents`，通过 settlement pending/calculated/pending_review 状态聚合待结算金额；`ProviderWorkbench` 上线卡片扩展为 5 项数字；钱包页概览顶部新增"今日预估收入 / 待结算"两块大数字。

---

### H9 管理端：机型档/广播策略/抢单监控

本轮仅完成 backend 配置接口暴露；admin UI 按任务书顶部约定延后到 H10 之后单独工单。

#### H9.01 机型档管理

- 新增 `admin/src/pages/Pricing/ServiceClassPage.tsx`，CRUD ServiceClass。
- 支持运营改价，改完即时生效（带版本号，订单冻结当时单价）。
- backend 部分完成：新增 `/api/v2/admin/service-classes` CRUD，删除为软归档 `status=archived`；本轮仍采用 UPDATE 改价并写 WARN，订单侧继续依赖 H2 的 `price_breakdown_json` 快照保证在途订单不受新价影响。

#### H9.02 广播/指派配置

- 新增 `admin/src/pages/Operations/BroadcastConfigPage.tsx`：
  - 广播超时（默认 120s）
  - 自动指派启用、最大尝试次数
  - 服务半径上限
- backend 部分完成：新增 `/api/v2/admin/system-configs` 查询/更新接口，写入 key 限定 `broadcast.` / `cancel.` / `settlement.` 前缀，并写入 admin log。

#### H9.03 抢单监控看板

- 新增 `admin/src/pages/Operations/BroadcastMonitorPage.tsx`：实时显示 open / grabbed / expired 量、平均抢单耗时、未抢中率分布。
- backend 部分完成：新增 `/api/v2/admin/broadcasts/stats` 和 `/api/v2/admin/broadcasts/recent`，支持 24h 默认窗口、平均抢单秒数、过期未匹配率和最近广播列表。

#### H9.04 地址簿联系人字段补齐

- `UserAddress` 增加 `contact_name varchar(50)`、`contact_phone varchar(20)`，迁移建议编号 124。
- `backend/internal/api/v2/longtail/address/handler.go` 暴露联系人字段，小程序地址簿表单再补联系人和电话。
- 说明：H7.03 已发现当前模型无联系人/电话字段，前端未伪造数据；该缺口留到 H9 后端/管理端联动补齐。

---

### H10 端到端验收与旧入口降级

#### H10.01 自动化验收脚本 [x]

- 复制 `phase10_role_acceptance.sh` 思路新建 `instant_dispatch_acceptance.sh`，覆盖：
  - 即时单：游客估价 → 注册 → 下单 → 服务商上线 → 抢单 → 履约 → 完成 → 结算
  - 预约单：下单 → 到点入池 → 自动指派 → 履约
  - 议价单（旧链路）保留，跑通即可
- 输出 JSON 至 `backend/docs/instant_dispatch_acceptance_last_run.json`

完成：新增 `backend/docs/instant_dispatch_acceptance.sh`，支持 `--base` 指定 v2 API 地址，按即时单、预约单、议价单三条链路记录请求、响应、耗时并输出 `backend/docs/instant_dispatch_acceptance_last_run.json`。脚本不写死订单、广播、需求、报价 ID；预约单本地验收仅在可用时使用 DB patch 缩短等待 cron 的时间。

最近一次本地验收结果：议价单链路通过；即时单和预约单在 `POST /orders/instant|reservation` 创建阶段失败，原因是平台定价订单写入 `orders.drone_id = 0` 触发 `fk_orders_drone` 外键约束。按 H10 规则该问题已记录到 JSON 报告，未在验收脚本中绕过。

H10 验收暴露的 `fk_orders_drone` 已由 H11.01 修复（迁移 124 + 即时/预约单创建时 Omit `drone_id`/`pilot_id`/`owner_id`），三条链路重跑全通过。

#### H10.02 旧主入口降级 [x]

- mini-program 首页"发布需求"按钮移到二级页面或入口卡折叠。
- 小程序底部 Tab 不出现 "市场"、"派单"、"飞行"。

完成：审计 `mini-program/src/custom-tab-bar/` 与 `mini-program/src/pages/home/`，底部 Tab 不含“市场 / 派单 / 飞行”，首页主 CTA 为“立即下单”，复杂服务/议价单保留为二级入口；`需求市场|发布需求` 在首页目录无命中。

#### H10.03 文档回写 [x]

- 更新 `README.md`：业务定位补一句"采用重载吊运即时调度模型，议价单作为复杂场景兼容"
- 在 `docs/business/BUSINESS_ROLE_REDESIGN.md` 附录补 §11 即时单链路，并把本任务书链接进去。
- 把本文件改成全 `[x]` 状态；按用户要求，本任务书原地保留，不移动到 `docs/planning/done/`。

完成：`README.md` 新增业务模式说明；`BUSINESS_ROLE_REDESIGN.md` 因原文已有 §11-§13，顺延追加 §14“即时单链路（H 阶段重构后）”；本任务书 H10 与第 6 节完成记录已回写。

H10 性能监控欠账：`OrderBroadcastRepo.StatsBetween` 当前按区间取出广播后在 Go 内存中循环聚合；广播量达到几万条后应改为 `SELECT status, COUNT(*), AVG(...) GROUP BY status` 的 SQL 聚合。

---

## 4. 风险与硬约束

1. **机型档单价错误的金融风险**：H9.01 的改价必须是双人复核 + 不影响进行中订单（订单冻结下单时的单价快照）。
2. **抢单并发**：H3.02 必须用 DB 行锁 + 唯一约束兜底，不要只用 Redis 锁。一个订单只能有一个抢单成功。
3. **广播泄漏**：服务商在线/位置接口必须鉴权，否则会暴露货主地址。
4. **支付通道仍为 Mock**：本任务书不解决支付通道接入；那是 `PROJECT_ANALYSIS_AND_ROADMAP.md` 的 P11.04，必须并行启动，不能等本任务书完成。
5. **v1/v2 共存**：本次重构所有新接口走 `/api/v2/*`；不在 v1 上加任何即时单功能。

---

## 5. 给 codex 的工作约定

- **每个阶段先开 PR、再合并**。一个 PR 不要跨阶段。
- **优先后端 → 接口测试 → 前端**。前端不要在后端接口未通过单测前就动。
- 所有新表必须有迁移脚本；不要直接 GORM AutoMigrate。
- 文案改动用 ripgrep 全局检查：执行后 `rg -n '机主|飞手|派单|候选|需求市场|供给市场' mini-program/src` 应只在管理后台或被注释代码出现。
- 任务完成后必须在本文件对应行打 `[x]`，并在末尾"完成记录"小节追加一行 `H?.??  PR#xxx  yyyy-mm-dd  备注`。

---

## 6. 完成记录

<!-- codex 每完成一个任务在此追加一行 -->
- H1.01-H1.03  local  2026-05-26  新增 `service_classes` 迁移 118、计价 service、`POST /api/v2/orders/estimate`；`go test ./... -count=1` 通过；迁移已应用到本地开发库；admin/mobile UI 按当前范围延后。
- H2.01-H2.04  local  2026-05-26  新增 `orders` 即时/预约模式字段迁移 119、`POST /api/v2/orders/instant`、`POST /api/v2/orders/reservation`；创建订单时服务端调用计价服务并写入 `total_amount`/`price_breakdown_json`；状态机保持历史空模式为 `negotiated`；`go test ./... -count=1` 通过；迁移已应用到本地开发库。
- H3.01-H3.02/H3.04-H3.05  local  2026-05-26  新增 `provider_presences`、`order_broadcasts` 迁移 120；新增服务商在线/心跳/离线、广播池列表、抢单接口；即时单创建同步广播，预约单定时入池；抢单推进 `pending_dispatch -> assigned` 并回填抢单字段；`go test ./... -count=1` 通过；迁移已应用到本地开发库。H3.03 自动指派接受时窗未完成。
- H3.03  local  2026-05-26  自动指派回退 + 配置化 + 7 个单测；新增 `broadcast_assignments` 迁移 121、自动指派接受/拒绝/超时重试接口、3 轮 60s 接受时窗、距离+评分+完单率打分；完整后端验收闸口已通过。
- H4.01-H4.02  local  2026-05-26  复核 v2 飞行记录详情/位置上报/告警/完成接口；新增 `GET /api/v2/orders/:id/live` 轻量 live 契约和订单详情 `live` 字段；ETA 使用实时速度或机型档巡航速度，缺字段回退 60km/h。
- H4.03  local  2026-05-26  mini-program 实时位置页 + 订单详情入口 + getLive service。
- H5.01-H5.03  local  2026-05-26  结算调整字段迁移 122 + 小费即时入账 + 客户加价刷新广播池；新增 `POST /api/v2/orders/:id/tip`、`POST /api/v2/orders/:id/price-increase`；H2 订单金额和价格明细快照保持只读。
- H6.01-H6.03  local  2026-05-26  取消阶梯 + 服务商取消自动重派 + 改派部分结算；新增迁移 123、`cancel.*` 配置、`partial_handover_*` 结算字段、服务商取消信用扣减；`go test ./internal/... -count=1`、`go build ./...`、`go vet ./...` 通过。
- H7.01/H5.03 UI  local  2026-05-26  mini-program 货主首页主路径改为地址条 + 机型档 + 服务端估价 CTA；新增 `GET /api/v2/service-classes`；即时/预约下单成功直达实时位置页；live 页补“附近运力紧张，加价试试”入口。
- H7.02  local  2026-05-26  mini-program 订单列表 + 订单详情卡片即时履约化；补 `addTip/priceIncrease` service 方法；清理 `home/index.tsx` 死代码和订单/home 主路径旧术语。
- H7.03  local  2026-05-26  地址簿 CRUD + 首页/选择器接入云端；实际接口使用 `/api/v2/address`，保留本地 `addressHistory` 作为降级。
- H7.04  local  2026-05-26  主路径术语切换 + 旧入口可达性审计；切断货主主路径到 dispatch/fulfillment/profile-pilot 旧页面的直接跳转，保留相关页面和 supply/owner 目录给 H8 服务商端重做。
- H8.0  local  2026-05-26  服务商在线/heartbeat 基础设施 + 临时调试按钮；新增 providerPresence service/slice/hook，冷启动不恢复在线态，离开页面停心跳、返回自动续。
- H8.01  local  2026-05-26  服务商上线卡片 + 4 项数字 + 半径/机型档 + 新增 `/provider/me/stats` 接口。
- H8.02  local  2026-05-26  附近订单池 + 自动指派 modal + 5s/3s 轮询；抢单/指派成功跳订单详情，409 冲突文案区分。
- H8.03  local  2026-05-26  stats 加 `pending_settlement_cents` + 工作台第 5 项 + 钱包页顶部今日预估收入/待结算数字。
- H9.0  local  2026-05-26  admin 配置接口 backend 部分：service-class CRUD + system_configs CRUD 白名单 + broadcast stats/recent 查询；admin UI 延后。
- H10.01  local  2026-05-26  新增 `backend/docs/instant_dispatch_acceptance.sh` 与 JSON 报告输出，覆盖即时单、预约单、议价单三条 H 阶段验收链路；记录请求、响应、耗时和失败点。
- H10.02  local  2026-05-26  旧主入口降级审计完成：首页主 CTA 保持“立即下单”，复杂服务/议价单为二级入口，底部 Tab 不出现市场/派单/飞行。
- H10.03  local  2026-05-26  README 业务模式、`BUSINESS_ROLE_REDESIGN.md` 即时单链路附录、任务书 H10 状态与完成记录已回写；任务书原地保留。
- H11.01  local  2026-05-26  hotfix：orders 三列改 NULL，即时/预约单创建时 Omit `drone_id`/`pilot_id`/`owner_id`，不再触发 `fk_orders_drone`；H10 三条链路重跑全通过。
