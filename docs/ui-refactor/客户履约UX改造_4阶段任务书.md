# 重载吊运平台 UX 改造任务书（4 阶段）

> 编写背景：2026-06-01 全链路 UX 走查后产出。Phase 1 批次 1a 已上线 commit `949b6c2`，本任务书覆盖剩余的 Phase 1（1b/1c）+ Phase 2/3/4。

---

## 0. 给执行 agent 的硬性要求

本会话之前由我（claude）边写边改，codex 三次复核都抓到端到端漏洞，问题模式有共性。**所有任务在写代码之前先把下面 6 条对照一遍**：

### A. 数据契约必须 grep 后端 builder

**症状**：前端读 `detail.service_latitude` 拼地址预填，结果后端 `buildOrderSummary()` 根本没把 lat/lng 序列化进 response。`types/index.ts` 里有这个字段不等于运行时拿得到。

**强制要求**：
- 任何新增"前端读 X 字段"的任务，先 `grep -rn "func buildOrderSummary\|func buildOrderDetail\|func buildDemandDetail\|func buildDemandSummary"` 找到对应后端 builder 函数，确认 X 字段在 `gin.H{}` 里被序列化。
- 类型定义文件 `mini-program/src/types/index.ts` 只算"声明"不算"合同"。
- 如果后端 builder 没返回需要的字段，**先改 builder 加上、跑测试通过，再写前端**。

### B. catch 块禁止静默吞错

**症状**：`fetchDemands` 接口失败 catch `{}`，UI 显示"还没有发布过任务"+ "回首页发布"CTA，用户被误导。

**强制要求**：每个 `catch (e)` 块至少做以下之一：
1. `setError(friendlyErrorMessage(e, '加载失败，请检查网络'))` 并在 UI 渲染 error state + 重试按钮
2. `Taro.showToast({ title: friendlyErrorMessage(e, ...), icon: 'none' })`

**禁止**：`catch {}`、`catch { /* 忽略 */ }`、`catch { return [] }` 等任何形式的静默。

### C. 状态机所有边界态必须显式处理

**症状**：demand 进度条对 `draft` 状态返回 currentStep=0（即"已发布"），与同页"发布任务"按钮文字冲突。

**强制要求**：任何"进度条 / 状态徽章 / 流程节点"组件，**枚举所有可能的 status**：
- draft / pending / in-progress / done / terminal（cancelled / expired / closed）
- 每个 status 要么映射到具体步骤，要么显式隐藏组件、要么显示独立的"已结束"标签。
- 边界态在 PR 描述里列出来 → reviewer 才能对照检查。

### D. "预填"/"传递"动作必须端到端 trace

**症状**：声称"改成议价单按钮一键带入地点"，但前端读的字段后端没返回 → hasPickup 永远 false → 实际只是"重填地点"。

**强制要求**：任何 storage 写入 / URL 参数 / 接口字段传递，必须 trace 完整链路：
1. **源**：数据从哪里来？字段名、类型确认。
2. **传输**：storage key 名称 / URL param 名称 / 接口字段名一致？类型转换正确？
3. **接收**：接收端代码确实读取了？读取后做了什么？
4. **可观察**：用户能看到接收成功（toast / UI 变化）？

每步看代码，不假设。

### E. dev / 测试 / 诊断页必须 env gate

**症状**：`pages/dev/subscribe-test/index` 无条件注册到 `app.config.ts` → 生产包里也有这个页。

**强制要求**：所有 dev-only 资源（页面、按钮、入口）必须用：
```ts
const isProduction = process.env.NODE_ENV === 'production';
const devOnlyPages = isProduction ? [] : ['pages/dev/xxx/index'];
```
跟现有约定保持一致：`mini-program/src/pages/settings/index.tsx:29` 用的 `isDevMode = process.env.NODE_ENV !== 'production'` 是参考。

### F. mini-program 改完必跑 build

**强制要求**：任何 `mini-program/` 下代码改动完成后，**在汇报完成前**跑：
```bash
cd mini-program && npm run build:weapp:e2e
```
exit=0 才算完。只允许既有的 Sass `@import` deprecation 警告（在 `cargo/accept` 和 `drone/edit` 两页），其他警告/错误要修。

---

## 1. 业务术语统一表（不许再造词）

| 客户端术语（用户能看见） | 服务商端术语 | 后端字段 | 含义 |
|---|---|---|---|
| 立即吊运 / 立即下单 | 派单 / 抢单 | OrderMode=instant, Status=pending_dispatch | 平台计价、A→B 货运、广播池抢单 |
| 预约吊运 | 预约派单 | OrderMode=reservation | 同上但定时 |
| 议价单 / 发布吊运任务 | 接单需求 / 报价 | OrderMode=negotiated, OrderSource=demand_market/supply_direct | 客户发 demand → 服务商报价 → 选定 → 生成 order |
| 我的任务 | 接单需求 | demand 实体 | 客户已发布、未成单的 demand |
| 我的订单 | 我的订单 | order 实体 | 已生成 order，无论模式 |
| 上线接单 | — | presence.online | 服务商加入广播池等派单 |
| 服务商上门报价 | 主动报价 | 进 demand 列表手动 createQuote | 不需要 presence.online |

**严禁使用**：复杂 / 非标 / 工单 / 广播 / 派单中 / dispatch_failed / auto_assigning（这些是系统视角，对用户没意义）。

**遇到旧文案出现这些词**：替换为术语表里的对应客户端术语。

---

## 2. Storage key 中央登记

每次新加 storage key 要登记到本表，避免乱起名 / 重复。

| Key | 写入位置 | 读取位置 | 用途 | 版本 |
|---|---|---|---|---|
| `customer_home_quick_order_prefill_v1` | CustomerHaulHome.openComplexService、orders/detail.switchToNegotiated | quick-order useEffect | 跳 quick-order 时的预填 | v1 |
| `customer_orders_default_segment` | quick-order.publishDemand | orders/index CustomerOrdersShell.useDidShow | 客户订单 tab 默认 segment hint | — |
| `customer_order_redispatch_hint_v1` | orders/detail.switchToNegotiated | quick-order useEffect | 标记本次进 quick-order 是 redispatch，决定 toast 文案 | v1 |
| `provider_orders_default_segment` | — | orders/index ProviderOrdersShell.useDidShow | 服务商订单 tab segment hint | — |
| `provider_workbench_onboarding_seen_v1` | ProviderWorkbench 首启浮层关闭、Settings 重看新手引导清除 | ProviderWorkbench useDidShow | 首启引导是否已显示 | v1（任务 1.5）|
| `customer_haul_home_onboarding_seen_v1` | CustomerHaulHome 首启提示关闭 | CustomerHaulHome 启动 | 客户首启引导是否已显示 | v1（如果加）|

---

## 3. 阶段任务清单

### Phase 1 — 关键路径打通

> 目标：让客户和服务商都能"知道自己在哪一步、下一步是什么"。

#### ✓ 批次 1a — 客户状态可见性（已完成，commit `949b6c2`）

工作区还有 8 个文件待 reviewer 确认无误后 commit。包含：

- ✓ **1.1** 客户订单 tab 加「我的任务 / 我的订单」segment（[mini-program/src/pages/orders/index.tsx](mini-program/src/pages/orders/index.tsx)）
- ✓ **1.2** demand 详情进度条 4 步：已发布 → 收到报价 → 已选定服务商 → 已成单（[mini-program/src/pages/demand/detail/index.tsx](mini-program/src/pages/demand/detail/index.tsx)）
- ✓ **1.3** demand 详情「预期管理」提示（同上）
- ✓ **1.7c** 派单失败页加失败原因卡 + 改成议价单按钮（[mini-program/src/pages/orders/detail/index.tsx](mini-program/src/pages/orders/detail/index.tsx)）
- ✓ **P1.1** dev/subscribe-test 改成 dev-only 注册（[mini-program/src/app.config.ts](mini-program/src/app.config.ts)）
- ✓ **P1.2** 改成议价单按钮真正预填订单（含地点坐标）
- ✓ **P2.1** demand draft 态隐藏进度条
- ✓ **P2.2** 我的任务接口失败 error state + 重试按钮
- ✓ **P1（坐标补丁）** 后端 buildOrderSummary 补 service_latitude/service_longitude/dest_latitude/dest_longitude（[backend/internal/api/v2/order/handler.go](backend/internal/api/v2/order/handler.go)）

---

#### ✓ 批次 1b — 立即下单等待 + 服务商履约（已完成，commit `bf153ad`）

##### ✓ 1.4 客户立即单下单后跳"派单进行中"等待页

**用户痛点**：客户下立即单后直接进 orders/detail 静态页，看到状态字符串 `等待服务商` 之后不知道在等什么、要等多久、要不要再操作。

**目标**：下单瞬间进入一个有动态反馈的等待页，看到"系统正在帮你广播 + 多少服务商可接单"。

**范围**：
- 新建 `mini-program/src/pages/dispatch/waiting/index.tsx` + `.scss` + `.config.ts`
- 在 [`mini-program/src/app.config.ts`](mini-program/src/app.config.ts) 注册新页
- 改 [`mini-program/src/pages/home/CustomerHaulHome.tsx`](mini-program/src/pages/home/CustomerHaulHome.tsx) `createOrder` 成功回调：`Taro.redirectTo({ url: '/pages/dispatch/waiting/index?orderId=' + id })`
- 后端新增 `GET /v2/orders/{id}/dispatch-state` 返回当前广播态（实现要点见下）

**数据契约**（**A 项要求**：先 verify 后端，再写前端）：
- 前端读 order 已有字段：`order.status`、`order.created_at`、`order.id`
- 前端读新接口 `dispatch_state` 返回：
  - `online_providers_count`（int，当前满足重量/机型/半径条件的在线服务商数）
  - `elapsed_seconds`（int，从 created_at 到现在）
  - `estimated_wait_seconds`（int，预估剩余等待时长，可为 0 表示未知）
  - `tried_providers_count`（int，已通知过的服务商数）

**后端要做**：
- 新增 handler `func GetDispatchState(c *gin.Context)` 在 [`backend/internal/api/v2/order/handler.go`](backend/internal/api/v2/order/handler.go) 附近
- 数据来源：`order_broadcasts` 表 + `provider_presence` 表
- 路由注册到 [`backend/internal/api/v2/router.go`](backend/internal/api/v2/router.go)
- 单测：`handler_test.go` 加 case

**前端实现要点**：
- 页面顶部：旋转加载动画 + 大字"正在为你匹配服务商"
- 中部：3 个数字（已广播 X 秒 / 通知了 N 家 / 当前 M 家在线）
- 底部："改成议价单"按钮（跳 quick-order，带 redispatch hint）
- 轮询：每 5 秒拉一次 order 详情 + dispatch_state
- 状态变更：
  - status → `assigned`：toast"已派单成功"→ `redirectTo` orders/detail
  - status → `dispatch_failed`：显示失败原因 + 三个按钮（加价 / 扩半径 / 改议价单），复用 1.7c 的逻辑
  - 超时（120 秒）：显示"耗时较长，建议改议价单" + 跳转入口

**验收标准**：
1. 立即下单后 0.5 秒内进入新页（无白屏）
2. 等待期间数字实时刷新（每 5 秒）
3. 派单成功 / 失败两种结局都有视觉反馈和明确下一步
4. 超时不会卡死，120 秒后显式引导

**依赖**：1.1 已完成（订单 tab segment）

**估时**：前端 1 天 + 后端 0.5 天 + 联调 0.5 天 = 2 天

---

##### ✓ 1.6 服务商履约 3 步按钮加 helper text

**用户痛点**：服务商在"我的订单"看到"开始准备 / 开始飞行 / 确认送达"，不知道每步对应什么物理动作、误操作能不能撤销。

**范围**：
- [`mini-program/src/pages/orders/index.tsx`](mini-program/src/pages/orders/index.tsx) 的 `advanceOrder` 函数（约 line 310）
- [`mini-program/src/pages/orders/detail/index.tsx`](mini-program/src/pages/orders/detail/index.tsx) 的对应按钮

**实现要点**：
- 在每个 advance 操作前加 `Taro.showModal` 确认对话框
- 文案：
  - **开始准备**：「确认你已到达起吊点、准备装载货物？\n此操作会通知客户"准备中"。可在下一步前撤销。」
  - **开始飞行**：「确认无人机即将起飞？\n此操作会启动飞行轨迹记录，客户能看到实时位置。」
  - **确认送达**：「确认货物已送达落放点？\n此操作不可撤销，会触发客户验收流程。」
- modal cancelText 默认"再想想"，confirmText 是按钮原文字

**数据契约**：无新字段

**验收标准**：
1. 每步操作前都有 modal 显示
2. 取消按钮真的能取消、不会推进
3. 文案准确、符合实际物理动作

**依赖**：无

**估时**：0.5 天

---

#### ✓ 批次 1c — 服务商首启 + 错误页（已完成，commit `c482dce`）

##### ✓ 1.5 服务商工作台首次进入加 onboarding 浮层

**用户痛点**：新服务商进 ProviderWorkbench 面对一堆配置（服务半径、可接机型、上线按钮、metric grid、接单需求 tab、快捷入口、待处理事项），不知道**第一步该做什么**。

**范围**：
- 新建 `mini-program/src/components/haul/ProviderOnboardingOverlay.tsx`
- 改 [`mini-program/src/pages/home/ProviderWorkbench.tsx`](mini-program/src/pages/home/ProviderWorkbench.tsx)（在主 ScrollView 之上 mount 浮层）
- storage key：`provider_workbench_onboarding_seen_v1`

**实现要点**：
- 三步浮层（每步 next 按钮 + 跳过整体）：
  1. **配置接单偏好**：圈出"服务半径"和"可接机型"配置区，文案"先选你能服务的范围"
  2. **了解上线含义**：圈出 CTA "上线接单"，文案"上线后平台会主动派单给你；下线时仍能去『接单』tab 主动报价"
  3. **看看接单方式**：圈出底部"接单"tab segment（如果服务商可见），文案"被动派单 + 主动报价两种姿态都在这里"
- 浮层结构：半透明黑色遮罩 + 高亮"洞" + 说明气泡 + 底部 next / 跳过按钮
- 关闭逻辑：tap 跳过 / 完成第三步 → 写 storage → 不再弹
- **重新触发**：Settings 页加一个"重看新手引导"按钮，清 storage 后重启

**验收标准**：
1. 首次登录后立刻显示
2. 三步流程可正常 next、跳过、关闭
3. 关闭后下次进入不再显示
4. 在 Settings 重置后能再次显示

**依赖**：无

**估时**：1 天

---

##### ✓ 1.7p 入驻审核失败页改成可执行

**用户痛点**：现在审核失败仅显示"服务商资质未通过或已暂停，请补充资料后重新提交审核"，没说**哪项不通过、改哪个字段**。

**范围**：
- 前端：[`mini-program/src/pages/provider/onboarding/index.tsx`](mini-program/src/pages/provider/onboarding/index.tsx) 的失败状态 UI
- 前端 `mini-program/src/pages/home/ProviderWorkbench.tsx` 的 `providerGateCopy` 在 `nextAction === 'fix_rejected'` 分支扩展

**数据契约**（**A 项要求**：先 grep 后端 builder，verify 这些字段是否已返回）：
- 需要前端拿到：
  - `owner.reject_reason`（string，整体原因）
  - `owner.asset_review_state`（"approved" | "rejected" | "pending"）
  - `owner.asset_reject_reason`（string）
  - `owner.executor_review_state` + `executor_reject_reason`
- 后端：grep `func buildOwnerSummary\|func buildOwnerWorkbench\|func buildRoleSummary` 找到 builder，确认上述字段被序列化。**若未返回，先补 builder，跑测试，再写前端**。

**前端实现要点**：
- 在 providerGateCopy 失败状态下加一个卡片：
  ```
  ┌─────────────────────────────────────┐
  │ 服务商资质待修复                       │
  │ ─────────────────────────────────── │
  │ • 设备资质：营业执照模糊，请重新上传  │
  │   [去修改 →]                          │
  │ • 履约资质：保险有效期不足 60 天      │
  │   [去修改 →]                          │
  └─────────────────────────────────────┘
  ```
- 每个失败项都要可点跳到对应编辑页

**验收标准**：
1. 被拒后能看到每项的具体原因
2. 点跳转能到对应编辑页（设备 / 履约 / 服务商档案）
3. 修复后重新提交，状态变化反馈正确

**依赖**：后端字段必须存在（**先 verify**）

**估时**：前端 0.5 天 + 后端 0.5 天（如果需要补字段）= 1 天

---

### ✓ Phase 2 — 决策辅助（已完成，commit `63ba576`）

> 目标：用户每个选择点都有依据，不再盲选。

完成记录：
- 客户首页已补机型档自动推荐、档位说明弹层、重量变化自动切档 toast、预估价明细展开。
- quick-order 已补三种方案说明、选中方案价格提示、两种发布分叉的具体例子折叠区。
- 需求详情报价卡已改为真实服务商统计：近 30 天完单、平均响应、擅长场景、真实评分/暂无评分。
- 服务商入驻页已抽出 `mini-program/src/components/business/StepBar.tsx` 并接入 5 步进度条。
- 后端 `buildQuoteSummaryWithProviderStats` 返回报价服务商统计字段，新增单测 `TestBuildQuoteSummaryIncludesProviderDecisionStats`。

#### ✓ 2.1 机型档卡片加 helper text + 价目展开

**用户痛点**：客户看机型档卡片"轻型重载 50-80kg"不知道这是按重量自动推荐的，也看不到这档具体怎么定价。

**范围**：
- [`mini-program/src/pages/home/CustomerHaulHome.tsx`](mini-program/src/pages/home/CustomerHaulHome.tsx) 的机型档 grid 渲染
- 新增小弹层组件 `ServiceClassDetailModal`

**实现要点**：
- 卡片顶部加灰色小字："按你的 60kg 自动推荐此档"（如果是 auto-matched）
- 卡片右上角加 ⓘ 图标，点开 modal：
  - 显示该档的：mtow_min/max、payload_min/max、base_price_cents、per_km、per_minute、min_charge、各类附加费率
- 重量改动时若 service class 改变 → toast "已为你切换到 X 档"

**数据契约**：
- 前端读 `service_class.base_price_cents / per_km_price_cents / per_minute_price_cents / min_charge_cents / night_surcharge_rate / plateau_surcharge_rate / emergency_surcharge_rate / island_surcharge_rate`
- **verify** 后端 builder 已返回（看 `backend/internal/api/v2/pricing/handler.go` 或类似），若未返回则补

**估时**：0.5 天

---

#### ✓ 2.2 预估价加 breakdown 展开

**用户痛点**：CustomerHaulHome 显示一个绝对预估价数字，客户不知道怎么算的、贵不贵。

**范围**：CustomerHaulHome 的 estimate card

**实现要点**：
- estimate card 加"明细 ›" chevron，点击展开：
  ```
  基础费       ¥600
  距离费       ¥800（12.3 km × ¥65/km）
  时长费       ¥420（35 min × ¥12/min）
  夜间附加     ¥250（晚间 20:00-06:00，+20%）
  最低消费调整 +¥0
  ─────────────────
  预估总价     ¥2070
  ```
- 数据来源：`estimate.base_price_cents / distance_fee_cents / duration_fee_cents / surcharges[] / min_charge_adjustment_cents / total_estimated_cents`

**数据契约**：
- `mini-program/src/services/orderV2.ts` 的 `estimate()` 返回 `V2PricingEstimate`，type 在 `types/index.ts`
- **verify** 后端 `func ResolvePricingEstimate` 或类似在 builder 里返回这些字段

**估时**：0.5 天

---

#### ✓ 2.3 服务方案三选一加说明（标准 / 加急 / 现场勘查）

**用户痛点**：quick-order 显示"加急吊运 - 优先匹配服务商 - 服务商报价"，客户不知道加急多贵、勘查怎么算钱。

**范围**：[`mini-program/src/pages/publish/quick-order/index.tsx`](mini-program/src/pages/publish/quick-order/index.tsx) 的 servicePlans 渲染

**实现要点**：
- 每个方案旁加 ⓘ 图标，点击弹更长说明：
  - **标准**：「服务商按平台估价区间报价，正常匹配」
  - **加急**：「价格上浮 ~25%，平台标记紧急、优先广播给在线服务商」
  - **现场勘查**：「服务商上门免费看现场，给出详细方案后客户决定下单。勘查费用可抵扣后续服务费。适合工况复杂的吊装」
- 选中加急或勘查时，估价区间 hint 文案变化（"已含 25% 加急溢价"等）

**估时**：0.5 天

---

#### ✓ 2.4 服务商报价卡片信息加强

**用户痛点**：demand/detail 报价列表只显示价格 + 服务商名 + "评分 5.0"（假数据），客户挑报价没依据。

**范围**：
- 前端：[`mini-program/src/pages/demand/detail/index.tsx`](mini-program/src/pages/demand/detail/index.tsx) quote-card 渲染
- 后端：`func buildDemandQuoteSummary` 或类似（grep 找）

**数据契约**（**先 verify 后端**）：
- 删除假数据"评分 5.0"
- 需要 quote 返回：
  - `provider.recent_30d_completed_orders`（int）
  - `provider.avg_response_seconds`（int）
  - `provider.preferred_scenes`（string[]，e.g. ["power_grid", "mountain_agriculture"]）
  - `provider.rating`（float，真实评分，无评分时返回 0 / null）
- 后端来源：order 完单数（30 天聚合）+ quote 平均响应时间 + 服务商档案的 preferred_scenes 字段
- 如果后端没这些字段，**先在 OwnerService 加统计方法 + 加 migration（如需）+ 更新 builder + 测试**

**前端实现要点**：
- 报价卡片改成：
  ```
  ┌───────────────────────────────────┐
  │  服务商A    ⭐ 4.8（127 评）       │
  │  近 30 天 89 单 · 平均 12 分钟响应  │
  │  擅长：电网建设、山区吊运            │
  │                                    │
  │  ¥2,200                  [选定]    │
  └───────────────────────────────────┘
  ```
- 无评分（新服务商）显示"暂无评分"而不是假 5.0

**验收标准**：
1. 无假数据
2. 服务商档案不全时显示"暂无"
3. 评分可信

**依赖**：后端统计字段补全

**估时**：前端 1 天 + 后端 0.5 天 = 1.5 天

---

#### ✓ 2.5 议价单分叉卡片展开例子

**目标**：quick-order 两张分叉卡片（让多家报价 vs 指定服务商）已经在 1a 完成基础形态。Phase 2 时给每张卡片加"适合举例"折叠区，进一步降低决策门槛。

**实现要点**：
- 每张卡片下方加可折叠的"看几个例子"链接
- 展开后列举 3-5 个具体场景（不是抽象描述）：
  - 让多家报价例：「家里盖房子要吊建材，不知道行情价」「农田要吊喷洒物资，多家比比」
  - 指定服务商例：「之前合作过 XX 服务商」「需要特定机型，已经问过对方」

**估时**：0.5 天

---

#### ✓ 2.6 服务商入驻进度条

**用户痛点**：入驻有多个子流程（服务商资料 / 设备资质 / 履约资质 / 审核），新服务商不知道一共几步、卡在哪步。

**范围**：[`mini-program/src/pages/provider/onboarding/index.tsx`](mini-program/src/pages/provider/onboarding/index.tsx)

**实现要点**：
- 顶部加 step bar：资料 → 设备 → 履约 → 审核中 → 已通过
- 复用 1.2 的 step-bar 样式（先抽出 `<StepBar>` 公共组件到 `mini-program/src/components/business/`，Phase 4 整体收尾时再标准化）
- 每步态色：完成 ✓ / 当前蓝 / 待开始灰
- 状态推断逻辑：依据 `roleSummary.has_owner_profile`、`owner_capabilities.assetStatus`、`owner_capabilities.executorStatus`、`owner_capabilities.nextAction` 综合判断

**数据契约**：
- 前端读 effectiveRoleSummary（已有）
- 无新后端字段

**验收标准**：
1. 进度条按真实状态推进
2. 每步可点跳转到对应编辑/查看页
3. 审核中状态有明确视觉（如脉动光圈）

**依赖**：1.2 step-bar 样式（已实现）

**估时**：0.5 天

---

### ✓ Phase 3 — 通知 / 客服 / 触达（已完成，commit `67f0c85`）

> 目标：用户不用反复回查、平台能主动找上门。

完成记录：
- TabBar 角标已从消息未读扩展到客户订单 tab / 服务商接单 tab：客户侧统计未结束需求 + 待操作订单，服务商侧统计可报价需求；消息 tab 保留未读通知 + 会话未读。
- 微信订阅消息事件白名单、env 模板装载、`config.example.yaml` 模板示例和小程序模板组已覆盖首条报价、选定、取消、运输中、送达、完成、自动匹配耗尽等关键事件；需求发布链路会在点击发布时申请客户侧模板授权。
- 新增独立平台客服页，并从客户首页、订单详情联系弹窗、我的页三处可达；客服微信支持复制并保留消息中心入口。
- 需求详情在客户自己的可接单需求且 `quote_count=0` 时显示分享按钮，分享标题为「{客户昵称}发布了一个吊运任务」，已结束/草稿需求从系统分享菜单落回首页。

#### ✓ 3.1 TabBar 红点

**用户痛点**：客户的 demand 收到首条报价、服务商收到新派单，UI 上没有任何提示，要靠用户主动进 tab 查。

**范围**：
- [`mini-program/src/custom-tab-bar/index.js`](mini-program/src/custom-tab-bar/index.js)：支持 setBadge 或自定义 setData 字段渲染红点
- [`mini-program/src/utils/tabBar.ts`](mini-program/src/utils/tabBar.ts)（需 verify 路径）：暴露 `setTabBadge(index, count)` 方法
- 在每个 useDidShow 时（客户端 orders + 消息 tab、服务商端工作台 + 接单 + 消息）触发 badge 刷新

**实现要点**：
- 客户端：
  - 订单 tab：未结束 demand 数 + 待操作 order 数（如待付款）
  - 消息 tab：未读 notification 数
- 服务商端：
  - 接单 tab：可报价 demand 数（按地区匹配）
  - 消息 tab：未读 notification 数
- count > 99 显示 "99+"
- count 为 0 时清掉 badge

**数据契约**：
- 客户：`demandV2Service.listMyDemands` + `orderV2Service.list`（已有）
- 服务商：`demandV2Service.listOpenDemands` + `notification` 接口
- 都是已有接口，不需要后端改动

**验收标准**：
1. 进 tab 时角标更新
2. 后端状态变化、再次进 tab 角标会刷新
3. 视觉清晰（数字易读、不被遮挡）

**依赖**：无

**估时**：0.5 天

---

#### ✓ 3.2 关键事件订阅消息模板

**用户痛点**：核心状态变化（首条报价、被选定、派单成功 / 失败、订单送达）应该主动 push 给用户，目前只有部分模板。

**范围**：
- 后端 [`backend/internal/api/v2/push/handler.go`](backend/internal/api/v2/push/handler.go)：缺哪些事件 push（需 grep 现有 push 触发点）
- 前端 [`mini-program/src/constants/subscribeTemplates.ts`](mini-program/src/constants/subscribeTemplates.ts)（需 verify 路径）：注册新模板 ID

**实现要点**：
- 新增触达事件（先列清单，再 grep 现有 push 看哪些已有）：
  - 客户：demand 收到首条报价 / 被选定后客户得知 / 立即单派单成功 / 派单失败 / 订单 in_transit 开始 / 已送达
  - 服务商：被客户选定 / 立即单广播命中 / 客户取消订单 / 订单完成结算
- 微信模板需要先在公众平台申请，提交审核（**预留 3-5 天审核时间**）
- 后端 push handler 对每个事件构造模板 payload
- 前端登录后调用 `requestSubscribe` 申请用户授权

**验收标准**：
1. 关键事件触发后 1 分钟内收到微信通知
2. 通知点击能跳到对应详情页
3. 用户拒绝订阅后不报错

**依赖**：微信审核（**单独流程，不阻塞前端 ui**）

**估时**：前端 1 天 + 后端 1 天 + 审核缓冲

---

#### ✓ 3.3 客服入口独立

**用户痛点**：客户首页右上角"客服"按钮跳消息 tab，但消息 tab 没有显式的客服会话入口，新用户找不到。

**范围**：
- 新建 `mini-program/src/pages/customer-service/index.tsx`
- 改 [`mini-program/src/pages/home/CustomerHaulHome.tsx`](mini-program/src/pages/home/CustomerHaulHome.tsx) 的"客服"按钮 → 跳新页
- 在 orders/detail 联系服务商的 modal 的"去消息" 也改成"找平台客服"

**实现要点**（最小版）：
- 客服会话页显示：
  - 平台客服微信号（可一键复制）
  - 工作时间
  - 常见问题 FAQ（3-5 条最常问的，例如"如何取消订单"）
  - 跳转客服小程序内会话按钮（如果接 IM，否则暂时占位）

**数据契约**：无

**验收标准**：
1. 客服入口 3 个以内 tap 可达（home / orders / profile）
2. 一键复制能用、有 toast
3. FAQ 列表可读

**依赖**：无（IM 接入是后续 Phase）

**估时**：0.5 天

---

#### ✓ 3.4 demand 没人报时分享按钮

**用户痛点**：客户发了 demand 没人报，想分享给认识的服务商但没入口。

**范围**：
- [`mini-program/src/pages/demand/detail/index.tsx`](mini-program/src/pages/demand/detail/index.tsx)：在 1.3 已加的"预期管理"卡片里、quote_count=0 时加分享按钮
- 微信 onShareAppMessage / 小程序码

**实现要点**：
- 分享按钮 → 调用 wx 原生分享，分享卡片内容：
  - 标题：「{客户昵称}发布了一个吊运任务」
  - 路径：`/pages/demand/detail/index?id={demandId}`
  - 图：从模板生成或固定 banner
- 服务商打开链接 → 落地到 demand 详情 → 可直接报价

**数据契约**：无

**验收标准**：
1. 分享出去的卡片显示正确（标题、缩略图）
2. 服务商打开能直接到 demand 详情
3. 已售出 / 已撤销 的 demand 分享落地有友好提示

**依赖**：无

**估时**：0.5 天

---

### ✓ Phase 4 — 文案 / 命名 / 视觉收尾（已完成，commit `a4b7fe6`）

> 目标：消除所有"系统术语"，统一品牌语言。

**完成记录**

- 用户可见文案已清理：小程序页面、后端错误消息、通知内容中的"广播 / 自动指派 / 复杂工况 / 暂无..."等系统视角表达已替换为面向客户或服务商可理解的下一步。
- 组件收口：`StatusBadge` 补齐 `info / success / warning / muted / error` 语义 tone；`StepBar` 支持 `<StepBar steps={[...]} currentIndex={n} />` 与浅色主题，需求详情页已改用公共组件。
- 角色切换：个人中心与设置页接入 `RoleModeCard`，兼具客户/服务商身份时可切换，单身份用户展示开通另一身份入口。

**替换前 → 替换后对照**

| 替换前 | 替换后 |
|---|---|
| 广播单 / 广播池 / 重发广播 | 派单记录 / 派单信息 / 重新匹配 |
| 抢单广播依赖未初始化 | 抢单服务暂不可用 |
| 收到自动指派订单 | 收到派单订单 |
| 自动指派已超时 | 接单确认已超时 |
| 复杂工况 / 复杂或不急 | 需要先看现场 / 路线或时间还需要商量 |
| 暂无系统通知 / 暂无会话消息 | 还没有系统通知，新报价和订单进度会在这里提醒 / 还没有会话消息，可从订单详情联系对方或找平台客服 |
| 暂无报价 | 还没有服务商报价，你可以分享给认识的服务商 |

#### ✓ 4.1 全应用术语扫描 + 替换

**范围**：grep 全应用，按 § 1 业务术语表替换

**实现要点**：
- `grep -rn` 搜：广播、派单中、auto_assigning、dispatch_failed、复杂、非标、工单、broadcast、provider、customer
- 对每个出现位置：
  - 后端 enum / status 名保留（API 层）
  - 前端展示给用户的文案替换为术语表对应词
  - error / toast 文案 review fallback 文本
- 出一份"替换前 → 替换后"对照表给 reviewer

**估时**：1 天（grep + 替换 + review）

---

#### ✓ 4.2 空状态 / toast 全部加可执行下一步

**用户痛点**：所有空状态显示"暂无 XX"，所有 catch 显示"操作失败"，没告诉用户怎么办。

**范围**：grep 全应用 `empty-state` / `empty-text` / `showToast.*失败`

**实现要点**：每个空状态 + toast 按以下模板改：
| 当前 | 改成 |
|---|---|
| "当前没有订单" | "还没下过单？回首页发起一笔吊运任务 →" |
| "暂无需求" | "首页可以立即下单或发布吊运任务 →" |
| "暂无报价" | "通常 30 分钟内会有 1-3 家服务商报价，你也可以分享给认识的服务商 →" |
| "操作失败" | 用 friendlyErrorMessage 解析具体原因 + 可执行下一步 |

**估时**：1 天

---

#### ✓ 4.3 统一进度条 / 状态徽章视觉规范

**范围**：
- 抽 `<StepBar steps={[...]} currentIndex={n} />` 公共组件
- 抽 `<StatusBadge tone="info|success|warning|muted|error" label="..." />` 组件
- 全应用替换

**实现要点**：
- 基于 1.2 已经写的 step-bar 样式抽到 `mini-program/src/components/business/StepBar/`
- 颜色 / 字号 / 间距统一
- 文档化每种 tone 的语义

**估时**：1 天

---

#### ✓ 4.4 角色切换 UI

**用户痛点**：老用户先注册成服务商再回头想下单，找不到入口。

**范围**：
- [`mini-program/src/pages/profile/index.tsx`](mini-program/src/pages/profile/index.tsx) 顶部加 "当前身份: 客户 [切换]"
- [`mini-program/src/pages/settings/index.tsx`](mini-program/src/pages/settings/index.tsx) 加同样切换入口

**实现要点**：
- 显示当前 selectedMode
- 点切换 → dispatch update + Taro.switchTab home → 切到对应 home（CustomerHaulHome / ProviderWorkbench）
- 兼具客户和服务商身份才显示切换；只有一个身份时显示"开通另一个身份"引导

**估时**：0.5 天

---

#### ✓ 4.5 替换所有"系统视角"文案

**目标**：和 4.1 配合。4.1 是关键字 grep，4.5 是更广泛的"系统化思维"扫描。

**范围**：
- error / toast 文案
- 帮助文本
- modal 标题 / 内容
- 文档/runbook

**估时**：包含在 4.1 工作量中

---

## 4. 工作量汇总

| 阶段 | 内容 | 估时 |
|---|---|---|
| Phase 1 - 1b（立即单等待 + 履约 helper） | 1.4 + 1.6 | 2.5 天 |
| Phase 1 - 1c（服务商首启 + 错误页） | 1.5 + 1.7p | 2 天 |
| Phase 2 - 决策辅助 | 2.1 - 2.6 | 4 天 |
| Phase 3 - 通知 / 客服（已完成） | 3.1 - 3.4 | 3 天 + 微信审核缓冲 |
| Phase 4 - 文案 / 命名 / 视觉收尾（已完成） | 4.1 - 4.5 | 3 天 |
| **合计** | | **约 14-17 工作日** |

---

## 5. 交付与复核流程

### 5.1 每个批次完成后，执行 agent 自查清单

按 § 0 的 6 条硬性要求逐条对照：

- [ ] A. 所有读字段在后端 builder 里 grep 到了？
- [ ] B. 所有 catch 块都有 error state 或 toast？
- [ ] C. 状态机所有边界态都列出来并显式处理了？
- [ ] D. 预填 / 传递动作端到端 trace 过了？
- [ ] E. dev-only 资源都加了 env gate？
- [ ] F. mini-program build:weapp:e2e 跑通了 (exit=0)？

### 5.2 提交内容

每个批次一个 commit / PR：
- commit subject 包含批次号（如 `feat(haul-1b-1.4): 立即单下单后跳派单进行中等待页`）
- commit body 列：
  - 涉及的文件路径
  - 涉及的后端 builder 函数（若改了）
  - 新增的 storage key（若新增，记得同步更新本文档 § 2）
  - 新增的接口（若新增）
  - 验收标准对照
  - 已知未覆盖的边界态（如有）

### 5.3 复核者职责

我（reviewer）端到端复核：
- **数据契约**：随机抽 1-2 个字段，从前端读取处 → grep 后端 builder → 验证字段被序列化
- **失败路径**：模拟接口 5xx / 网络断开，看 UI 反应
- **边界态**：随机抽 1-2 个状态（如 draft / cancelled / 过期）trigger，看 UI
- **文案**：按术语表对照，找系统视角词

任何一条不过 → 退回执行 agent。

---

## 6. 附录：会话中已确认的事实清单

避免执行 agent 重新踩坑，列出本会话期间已 verify 的事实：

1. 后端 `OrderMode` 只有 instant / negotiated / reservation 三种（[backend/internal/service/order_service.go](backend/internal/service/order_service.go) 第 41-43 行）
2. 后端 `ServiceType` 当前硬限制 `heavy_cargo_lift_transport`（[backend/internal/service/order_service.go](backend/internal/service/order_service.go) 第 745 行）
3. 后端 `service_classes` 表当前只有 light_heavy / medium_heavy / super_heavy 三档（[backend/migrations/118_create_service_classes.sql](backend/migrations/118_create_service_classes.sql)）
4. 后端立即单广播池逻辑入口：[backend/internal/service/broadcast_service.go](backend/internal/service/broadcast_service.go)（待 verify）
5. demand 状态：draft / open / published / quoting / selected / converted_to_order / cancelled / expired / closed（[mini-program/src/utils/index.ts](mini-program/src/utils/index.ts) 第 128 行 demandLabels）
6. order 状态见 [mini-program/src/utils/index.ts](mini-program/src/utils/index.ts) orderLabels（约 90 行起）
7. 后端 buildOrderSummary 已返回字段（截至 commit `949b6c2` + 工作区 P1 修复）见 [backend/internal/api/v2/order/handler.go:1114](backend/internal/api/v2/order/handler.go)，**任何前端依赖字段在此函数中存在才算 OK**
8. 自定义 tabbar 已实现 role-aware 切换（customer/provider 两套列表），代码在 [mini-program/src/custom-tab-bar/index.js](mini-program/src/custom-tab-bar/index.js)
9. 批次 1b 新增 `GET /api/v2/orders/:order_id/dispatch-state`，由 `BroadcastService.GetDispatchState` 返回 `online_providers_count / elapsed_seconds / estimated_wait_seconds / tried_providers_count`
10. 立即单创建成功进入 [mini-program/src/pages/dispatch/waiting/index.tsx](mini-program/src/pages/dispatch/waiting/index.tsx)，预约单仍进入 [mini-program/src/pages/orders/live/index.tsx](mini-program/src/pages/orders/live/index.tsx)
11. `cd backend && go test ./...` 截至 commit `c482dce` 仍有预存失败：`internal/service` 在 clean HEAD `946d849` 同样因 `finance_anomaly_records` 表缺失失败；批次 1c 直接覆盖的 `go build ./...`、`go test ./internal/service -run TestGetRoleSummaryIncludesProviderReviewReasons -count=1`、`go test ./internal/api/v2/order/...` 通过
12. 批次 1c 的服务商审核失败字段不在 `buildOwnerSummary/buildRoleSummary` builder 中；本仓库运行时契约来自 `UserService.GetRoleSummary()` 的 `role_summary.provider`，新增 `reject_reason / asset_review_state / asset_reject_reason / executor_review_state / executor_reject_reason`
13. 服务商工作台首启浮层在 [mini-program/src/components/haul/ProviderOnboardingOverlay.tsx](mini-program/src/components/haul/ProviderOnboardingOverlay.tsx)，由 [mini-program/src/pages/home/ProviderWorkbench.tsx](mini-program/src/pages/home/ProviderWorkbench.tsx) 读取/写入 `provider_workbench_onboarding_seen_v1`
14. Settings 的“重看新手引导”会清除 `provider_workbench_onboarding_seen_v1` 并切到服务商首页；审核失败可执行卡片复用 [mini-program/src/utils/providerReview.ts](mini-program/src/utils/providerReview.ts)
15. Phase 2 数据契约已确认：`service_classes` API 直接序列化 [backend/internal/model/service_class.go](backend/internal/model/service_class.go) 的价目字段；预估价接口返回 `base_price_cents / distance_fee_cents / duration_fee_cents / surcharges / min_charge_adjustment_cents / total_estimated_cents`；报价列表由 [backend/internal/api/v2/demand/handler.go](backend/internal/api/v2/demand/handler.go) 的 `buildQuoteSummaryWithProviderStats` 补充服务商决策统计。
16. Phase 2 验证通过：`cd mini-program && npx tsc --noEmit`、`cd mini-program && npm run build:weapp:e2e`、`cd backend && go build ./...`、`cd backend && go test ./internal/api/v2/demand -count=1`、`cd backend && go test ./internal/api/v2/order/...`、`cd backend && go test ./internal/service -run TestGetRoleSummaryIncludesProviderReviewReasons -count=1`。`go test ./...` 仍受第 11 条的 `finance_anomaly_records` 测试表缺失影响。
17. Phase 3 代码提交 `67f0c85` 已覆盖：TabBar 角标刷新 [mini-program/src/utils/tabBar.ts](mini-program/src/utils/tabBar.ts)、平台客服页 [mini-program/src/pages/customer-service/index.tsx](mini-program/src/pages/customer-service/index.tsx)、需求分享按钮 [mini-program/src/pages/demand/detail/index.tsx](mini-program/src/pages/demand/detail/index.tsx)、订阅模板常量 [mini-program/src/constants/subscribeTemplates.ts](mini-program/src/constants/subscribeTemplates.ts)、微信订阅事件白名单 [backend/internal/service/wechat_subscribe_service.go](backend/internal/service/wechat_subscribe_service.go) 和 push allowlist [backend/internal/service/event_service.go](backend/internal/service/event_service.go)。
18. Phase 3 验证通过：`cd mini-program && npx tsc --noEmit`、`cd mini-program && npm run build:weapp:e2e`、dist 检查确认 `mini-program/dist/common.js` 仍为 `https://dronerentalplat.cpolar.top/api/v2` 且新增客服/分享/订阅模板文案已入产物、`cd backend && go build ./...`、`cd backend && go test ./internal/service -run 'TestShouldSendPushEvent|TestEventService_WeChatSubscribe_Integration|TestWeChatSubscribeService_GrantAcceptedTemplates_PersistsAndDedupes|TestBuildWeChatSubscribeData' -count=1`。`go test ./...` 仍受第 11 条的 `finance_anomaly_records` 测试表缺失影响。
19. Phase 4 代码提交 `a4b7fe6` 已覆盖：角色切换卡片 [mini-program/src/components/business/RoleModeCard.tsx](mini-program/src/components/business/RoleModeCard.tsx)、个人中心/设置页入口 [mini-program/src/pages/profile/index.tsx](mini-program/src/pages/profile/index.tsx) / [mini-program/src/pages/settings/index.tsx](mini-program/src/pages/settings/index.tsx)、公共状态徽章与进度条 [mini-program/src/components/business/StatusBadge.tsx](mini-program/src/components/business/StatusBadge.tsx) / [mini-program/src/components/business/StepBar.tsx](mini-program/src/components/business/StepBar.tsx)、需求详情页公共组件替换 [mini-program/src/pages/demand/detail/index.tsx](mini-program/src/pages/demand/detail/index.tsx)、后端用户可见派单错误文案 [backend/internal/service/broadcast_service.go](backend/internal/service/broadcast_service.go)。
20. Phase 4 验证通过：`cd mini-program && npx tsc --noEmit`、`cd mini-program && npm run build:weapp:e2e`、dist 检查确认 `mini-program/dist/common.js` 仍为 `https://dronerentalplat.cpolar.top/api/v2` 且 `RoleModeCard / StepBar / 消息空状态 / 需求分享报价文案` 已入产物、`cd backend && go build ./...`、`cd backend && go test ./internal/service -run 'TestBroadcast|TestRedispatch|TestIncreaseOrderPrice|TestShouldSendPushEvent|TestEventService_WeChatSubscribe_Integration' -count=1`、`cd backend && go test ./internal/api/v2/order -run 'TestRedispatch|TestDispatchState' -count=1`、`git diff --check`。术语扫描中仅剩后端迁移注释和 `dispatch_failed: '暂无服务商'` 状态标签；`go test ./...` 仍受第 11 条的 `finance_anomaly_records` 测试表缺失影响。

---

文档版本：v1（2026-06-01）

后续修订：每完成一个批次更新 § 3 的状态、§ 2 的 storage key 表、§ 6 的事实清单。
