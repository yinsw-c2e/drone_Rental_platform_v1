# 01-08 小程序与 App 端差距审计

审计日期：2026-05-24

审计目标：回答“小程序端和 App 端是否已经完善”。本文件只核对 01-08 设计页相关链路，不覆盖后台管理端。结论来自当前代码，不按设计稿观感推断。

## 总结论

小程序端的 01-08 主链路已经进入“可继续验收和生产收口”的阶段，但仍不能叫完全完善；App 端还没有达到小程序同等水平。

当前状态可以分成三层：

- 小程序端：主链路大部分已经接真实后端，特别是 03/04/05/06/07/08 的订单、需求、供给、派单、履约、签收、结算、钱包和提现链路。剩余重点是生产包隐藏开发入口、空态/异常态、真机视觉和少量业务口径收敛。
- App 端：有一批真实能力已经存在，例如合同签署、支付记录、评价、直达下单确认、派单创建/详情、钱包提现等；但很多能力没有接回 01-08 对应设计页，导致用户按这 8 张图走时仍会遇到静态兜底或断链。
- 后台管理端：最近连续补的是财务运营兜底能力，原因是用户侧链路打通后必须有平台侧处理结算、提现、异常、审计和回滚的入口；这不代表 App 端已经完成。

优先级判断：

1. P0：先补 App 端 08 履约安排页。它现在基本还是设计稿静态页，没有真实 `orderId`、订单详情、派单、现场复核、保险、结算。
2. P0：补 App 端 05 订单进度页。它会在无数据或接口失败时回退 `demoOrder`，时间线也不是 `/orders/:id/timeline`。
3. P0：补 App 端 04/07 列表页生产兜底问题。App 04 服务商方案、07 可接需求仍会在无真实数据时展示本地假方案/假需求。
4. P1：补 App 端 03 提交路径。现在 App 03 主要进入 `OfferList`，没有像小程序一样提供“发布真实需求等报价”和 `supplyId` 直达下单分支。
5. P1：小程序端做生产收口。主要是开发账号、角色能力校正、城市/服务区域口径、真机视觉验收。

## 逐页差距

### 01 模式选择 / 登录

小程序：

- `mini-program/src/pages/auth/mode-selection/index.tsx` 会写入 `role.selectedMode` 并带 `roleMode` 进入登录。
- `mini-program/src/store/slices/roleSlice.ts` 从本地存储恢复模式，刷新后不会总是回到客户模式。
- `mini-program/src/pages/auth/login/index.tsx` 支持密码、验证码、微信小程序登录，同时保留开发模式快速登录账号。

App：

- `mobile/src/screens/auth/ModeSelectionScreen.tsx` 和 `mobile/src/screens/auth/LoginScreen.tsx` 有同样的模式选择和登录入口。
- `mobile/src/store/slices/roleSlice.ts` 默认 `selectedMode: 'customer'`，没有看到小程序那种本地持久化恢复。
- `mobile/src/screens/auth/LoginScreen.tsx` 同样保留开发模式快速登录账号。

缺口：

- 两端生产包都需要隐藏开发快速登录。
- App 端角色模式需要持久化，否则用户重启 App 后可能回到客户模式。
- 两端登录后都还需要按真实 `role_summary` 校正入口，防止选了“我要接单”但账号没有服务商/执行人员能力。

优先级：P1。

### 02 客户首页 / 预约吊运

小程序：

- `mini-program/src/pages/home/CustomerHaulHome.tsx` 读取常用地址 `locationService.getAddressList()`。
- 读取最近订单 `orderV2Service.list({ role: 'client' })`。
- 点击获取方案后写入 `customer_home_quick_order_prefill_v1`，进入 03。

App：

- `mobile/src/screens/haul/CustomerHaulHomeScreen.tsx` 也读取 `locationService.getAddressList()` 和客户最近订单。
- 点击获取方案后通过导航参数传 `quickOrderDraft` 到 `QuickOrderEntry`。

缺口：

- 两端首页都只是草稿入口，本身不创建需求/订单，这个设计可以接受。
- 两端城市仍偏本地枚举/本地状态，不是后端服务覆盖城市或定位服务区。

优先级：P2。

### 03 确认吊运信息

小程序：

- `mini-program/src/pages/publish/quick-order/index.tsx` 已做空域检测。
- 普通进入时可选择匹配真实服务商方案，或调用 `demandV2Service.create` + `publish` 发布真实需求。
- 带 `supplyId` 进入时会调用 `supplyService.createDirectOrder` 创建真实订单。
- 缺重量时有补选入口。

App：

- `mobile/src/screens/demand/QuickOrderEntryScreen.tsx` 有空域检测和表单校验。
- 提交后只 `navigation.navigate('OfferList', { quickOrderDraft, selectedServicePlan })`。
- 没有看到 `demandV2Service.create/publish` 分支。
- 没有看到 `supplyId` 直达下单分支。

缺口：

- App 03 比小程序少了“发布真实需求等报价”。
- App 03 比小程序少了“从供给详情/市场带 supplyId 直接下单”。
- App 03 的服务方案仍更像设计稿意向选择，不是后端计价/供给结果。

优先级：P1。App 用户从 03 走，只能进入 04 方案列表，不能在 03 自己完成真实需求发布。

### 04 服务商方案列表

小程序：

- `mini-program/src/pages/supply/list/index.tsx` 调 `supplyService.list` 查询真实供给。
- 空结果显示空态，接口失败显示错误态。
- 选择真实供给后调用 `supplyService.createDirectOrder` 创建订单。
- 已用后端 owner/drone/stats/coverage/ETA 等真实摘要替代设计稿假字段。

App：

- `mobile/src/screens/demand/OfferListScreen.tsx` 会调用 `supplyService.list`。
- 但存在 `fallbackDraft`、`fallbackPlans`、`ratingByIndex`、`orderByIndex`、`etaByIndex` 等本地兜底。
- `plans = supplies.length > 0 ? real : fallbackPlans`，无真实供给或接口失败时仍展示假服务商。
- 真实供给进入 `OfferDetail` 后，`mobile/src/screens/supply/SupplyDirectOrderConfirmScreen.tsx` 可调用 `supplyService.createDirectOrder`，这部分能力是存在的。

缺口：

- App 04 最大问题是生产态仍展示假方案。
- App 04 真实供给卡片仍混用本地 logo、评分、订单量、ETA、价格兜底。
- App 的真实直达下单能力存在，但要先保证列表只展示真实供给，否则用户会选到无后端 ID 的假卡片。

优先级：P0。

### 05 客户订单进度

小程序：

- `mini-program/src/pages/orders/detail/index.tsx` 必须有 `orderId`，无登录/无订单会显示错误态。
- 调 `orderV2Service.get(orderId)` 获取真实订单。
- 优先调 `orderV2Service.getTimeline(orderId)` 获取真实时间线。
- 待支付时根据 `payment_ready` 进入合同或支付页。
- 完成态进入真实评价页。
- 完成态读取 `/orders/:id/settlement` 展示真实结算。

App：

- `mobile/src/screens/order/OrderDetailScreen.tsx` 会调 `orderV2Service.get(orderId)`。
- 但文件内有 `demoOrder`，`remoteDetail || demoOrder` 会在缺失或失败时回退设计稿静态订单。
- 时间线是本地数组推导，没有看到调用 `orderV2Service.getTimeline`。
- 合同、支付、评价页面本身存在且接了真实接口，但 App 05 设计页没有像小程序一样完整串起“签合同/支付/评价/结算明细”主按钮逻辑。

缺口：

- App 05 必须移除 `demoOrder` 兜底，改为错误态/空态。
- App 05 必须接真实 timeline。
- App 05 需要接 `payment_ready`、合同、支付、评价、结算摘要，不应只展示静态进度。
- App 05 当前甚至有重复 `dropoff` summary row，说明这页还没做完整代码清理。

优先级：P0。

### 06 服务商工作台

小程序：

- `mini-program/src/pages/home/ProviderWorkbench.tsx` 同时读取 `homeService.getDashboard()`、`ownerService.getWorkbench()` 和 `dispatchV2Service.list({ role: 'pilot' })`。
- 服务商待办、待派单订单、执行人员待确认派单都已并入“我要接单”模块。
- 钱包入口已接 `/pages/settlement/wallet/index`。

App：

- `mobile/src/screens/home/ProviderWorkbenchScreen.tsx` 读取 `homeService.getDashboard()`。
- 但有 `fallbackStats`，真实 0 会落回 6/3/2/28600 这类设计稿数字。
- 没有看到 `ownerService.getWorkbench()`。
- 没有看到 `dispatchV2Service.list({ role: 'pilot' })` 合并执行人员待确认派单。
- 待办列表更像静态 UI 项，只导航到 Fulfillment、Wallet、MyQuotes 等页面。

缺口：

- App 06 会把真实 0 伪装成假待办/假收入。
- App 06 没有合并“执行人员待确认派单”到 `我要接单`。
- App 06 与小程序的服务商工作台数据源不一致。

优先级：P0/P1。若先补 08，则 06 可跟着把待办跳转改到真实订单/派单。

### 07 可接吊运需求

小程序：

- `mini-program/src/pages/demand/list/index.tsx` 已接后端推荐需求筛选。
- 顶部有执行人员待确认派单入口，读取 `dispatchV2Service.list({ role: 'pilot', status: 'pending_response' })`。
- 快速报价进入报价页预填，正式提交仍调用真实 `createQuote`。

App：

- `mobile/src/screens/demand/DemandListScreen.tsx` 调 `demandV2Service.listMarketplaceDemands`。
- 但存在 `fallbackDemands`。
- `visualDemands = demands.length ? real : fallbackDemands`，空结果仍展示假需求。
- 筛选 UI 只更新本地 `filters`，没有把 region、weight、time、scene、sort 下发给后端查询。
- 价格排序在前端对展示文本做处理，不等于后端真实价格排序。

缺口：

- App 07 生产态仍会显示假需求。
- App 07 筛选未真正落到后端。
- App 07 没有小程序已有的“待确认派单”入口。

优先级：P0。

### 08 履约安排

小程序：

- `mini-program/src/pages/fulfillment/hub/index.tsx` 读取 `orderId`，无 `orderId` 时从 `ownerService.getWorkbench()` 找待办订单。
- 调 `orderV2Service.get(orderId)` 获取真实订单详情。
- 根据 `current_dispatch` 展示待确认/已确认/调整派单。
- 调 `orderFinanceV2Service.getSettlement(orderId)` 展示真实客户实付、平台服务费、飞手劳务、设备服务费。
- 现场复核进入 `/pages/fulfillment/safety-check/index`。
- 保险行进入无人机保险资料页。
- 服务商确认接单调用 `orderV2Service.providerConfirm(orderId)`。

App：

- `mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx` 没有引入 `orderV2Service`、`ownerService`、`dispatchV2Service`、`orderFinanceV2Service`。
- 文件内固定 `ORDER_NO = 'DY202605200128'`、`CUSTOMER_PHONE = '13800138000'`。
- 订单信息行写死“深圳市龙岗区坂田街道某仓库”“深圳市坪山区某施工点”“80kg”“今天 15:00 前”。
- 履约安排行写死 DJ-100、张师傅团队、空域可飞/现场待复核、作业保险有效。
- 费用写死 `¥720`、`¥36`、`¥684`。
- “安排履约”只是 `Alert.alert('已安排')`，没有调用真实接口。

缺口：

- App 08 是当前最不完善的页面，基本仍是设计稿静态壳。
- 它没有绑定真实订单、没有派单、没有现场复核、没有保险、没有结算、没有服务商确认接单。
- 这页直接影响“服务商侧已经派单，飞手端能不能接住”的验证闭环。

优先级：P0，建议第一个修。

## 非 01-08 但相关的 App 已有能力

为了避免误判，App 端不是所有能力都缺：

- `mobile/src/screens/supply/SupplyDirectOrderConfirmScreen.tsx` 已能调用 `supplyService.createDirectOrder`。
- `mobile/src/screens/demand/DemandQuoteComposeScreen.tsx` 已能调用 `demandV2Service.createQuote`。
- `mobile/src/screens/demand/DemandDetailScreen.tsx` 已能调用 `selectProvider` 并生成订单。
- `mobile/src/screens/dispatch/CreateDispatchTaskScreen.tsx` 已能 `dispatch` / `reassign`。
- `mobile/src/screens/dispatch/DispatchTaskDetailScreen.tsx` 已能 `accept` / `reject`。
- `mobile/src/screens/order/ContractScreen.tsx`、`PaymentScreen.tsx`、`ReviewScreen.tsx` 都有真实接口调用。
- `mobile/src/screens/settlement/WalletScreen.tsx`、`WithdrawalScreen.tsx` 等钱包提现能力存在。

问题不是“App 完全没功能”，而是“01-08 对应设计页没有把这些真实能力串起来”。下一步应优先做设计页入口和真实链路对齐，而不是再做新的管理后台页面。

## 建议执行顺序

### Step A：App 08 履约安排真实化

目标：

- 读取 `route.params.orderId` / `dispatchId`。
- 无 `orderId` 时用 `ownerService.getWorkbench()` 取待处理订单。
- 接 `orderV2Service.get(orderId)`。
- 接 `orderFinanceV2Service.getSettlement(orderId)`。
- 派单行跳 `CreateDispatchTask` 并带 `orderId/dispatchId`。
- 安全检查行跳现场复核页；如果 App 没有现场复核页，先补最小页或跳通用合规页并说明缺口。
- 保险行跳无人机保险资料页。
- 主按钮按订单状态调用 `providerConfirm` 或进入派单。

验收：

- 不再出现固定订单号 `DY202605200128`。
- 不再出现固定地址、80kg、DJ-100、张师傅、¥720/¥36/¥684。
- 订单 `pending_provider_confirmation -> pending_payment/pending_dispatch` 可从 App 08 推进。
- 已有 `current_dispatch` 时 App 08 显示调整派单，不新建重复派单。

### Step B：App 05 订单进度真实化

目标：

- 移除 `demoOrder` 兜底。
- 无 `orderId` / 未登录 / 接口失败 / 订单不存在展示明确错误态。
- 接 `orderV2Service.getTimeline(orderId)`。
- 接合同/支付/评价/结算摘要主按钮。

验收：

- 断网或 404 时不显示设计稿订单。
- 待支付订单先进入合同，合同完成后进入支付。
- delivered 可确认签收，completed 可进入评价并展示结算。

### Step C：App 04 和 07 去假数据

目标：

- `OfferListScreen` 移除生产态 `fallbackPlans/fallbackDraft`。
- `DemandListScreen` 移除生产态 `fallbackDemands`。
- 筛选参数落到后端请求，而不是只改本地 UI。
- 空结果展示空态，接口失败展示错误态。

验收：

- 无 token / 接口失败 / 后端空列表时不显示假服务商或假需求。
- 07 的区域、重量、时间、场景、距离/价格排序会重新请求后端。

### Step D：App 03 补发布需求和 supplyId 直达

目标：

- 对齐小程序 03：普通提交给用户选择“匹配服务商方案 / 发布需求等报价”。
- 发布需求走 `demandV2Service.create` + `publish`。
- 带 `supplyId` 时直接 `supplyService.createDirectOrder`。

验收：

- 从服务市场进入 03 可生成该供给的真实订单。
- 从客户首页进入 03 可发布真实需求。

### Step E：小程序和 App 生产收口

目标：

- 隐藏开发快速登录。
- 角色模式和 tab 根据真实角色能力校正。
- 城市/服务区域口径统一。
- 两端跑真机/开发者工具视觉验收，重点看图标、文字截断、空态、长地址。

验收：

- 生产包不出现开发账号。
- 选择“我要接单”但账号无服务商/执行人员能力时，不进入空工作台。
- 小程序和 App 的 01-08 主路径状态文案一致。
