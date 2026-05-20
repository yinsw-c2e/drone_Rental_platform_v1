# 重载吊运 UI 改造执行计划

更新时间：2026-05-20

## 1. 当前结论

本次改造不推倒重写后端，也不删除旧页面。核心策略是：在现有业务能力上，重组移动端和小程序端的信息架构，把外部体验简化为两类用户：

- 客户：我要吊运，发布需求、选择服务商方案、查看订单进度。
- 服务商：我要接单，报价接单、管理设备与人员、安排履约。

内部仍可保留机主、飞手、无人机、派单、履约等领域模型，但客户侧页面不直接暴露这些内部概念。服务商侧可以出现无人机、执行人员、资质保险、空域、安全检查、报价、履约安排。

## 2. 版本保护状态

已完成重构前保护：

- 基线 tag：`pre-ui-refactor-base-20260520`
- 快照分支：`cc-drone/pre-ui-refactor-snapshot-20260520`
- 快照 tag：`pre-ui-refactor-snapshot-20260520`
- 快照提交：`2af3e22 chore: snapshot before UI refactor`
- 当前开发分支：`cc-drone/ui-refactor-two-role-flow`

说明：

- 基线 tag 指向开始重构前的 `main` 最后提交。
- 快照分支和快照 tag 包含当时工作区里的异常订单中心改动、8 张 UI 设计图、6 个生成资产和透明化后的资源。
- 后续所有 UI 改造在 `cc-drone/ui-refactor-two-role-flow` 上进行。

## 3. 设计图与资产来源

设计图位于：

```txt
gptimage/
```

目标 8 页：

```txt
01_模式选择_登录入口.png
02_客户首页_预约吊运.png
03_确认吊运信息.png
04_服务商方案列表.png
05_客户订单进度.png
06_服务商工作台.png
07_服务商接单列表.png
08_服务商履约安排.png
```

生成资产位于：

```txt
gptimage/assets/
gptimage/assets/clean/
gptimage/assets/ready/
```

使用规则：

- `gptimage/assets/` 是原始生成图，文件大，且不是真透明背景，禁止直接进入生产资源目录。
- `gptimage/assets/clean/` 是高清透明中间产物，可以作为重新导出的母版，禁止直接进入小程序生产包。
- `gptimage/assets/ready/` 是当前可用于工程接入的轻量透明 PNG。
- `_preview_*` 文件只是检查预览图，禁止进入 `mobile/src/assets` 或 `mini-program/src/assets`。

当前可用生产候选资源：

```txt
gptimage/assets/ready/logo_haul_square.png
gptimage/assets/ready/ill_mode_customer_lift.png
gptimage/assets/ready/ill_mode_provider_order.png
gptimage/assets/ready/logo_provider_anyi.png
gptimage/assets/ready/logo_provider_yunling.png
gptimage/assets/ready/logo_provider_qihang.png
```

资源体积约束：

- 小程序端只允许拷贝 `ready` 中实际用到的 6 个资产，不拷贝原始图、clean 图、preview 图。
- 首批生产新增图片资源目标控制在 200KB 以内。
- 单个小程序入口插画目标小于 50KB。
- 服务商 logo 单个目标小于 25KB。
- 如果后续资源增多，优先 SVG/代码图标，其次压缩 PNG，最后才使用 AI 位图。

## 4. 产品术语边界

客户侧禁止出现：

```txt
机主
飞手
供给
派单
派单任务
抢单大厅
调度中心
运力池
```

客户侧推荐用词：

```txt
客户
吊运需求
服务商
服务商方案
订单进度
联系服务商
服务商负责履约
服务团队
```

服务商侧推荐用词：

```txt
服务商
接单
报价
履约安排
无人机
执行人员
设备与人员
资质保险
空域 / 安全检查
```

旧内部术语映射：

| 内部概念 | 客户侧展示 | 服务商侧展示 |
| --- | --- | --- |
| owner / 机主 | 不展示 | 设备资源 / 服务商内部资源 |
| pilot / 飞手 | 服务团队 | 执行人员 |
| supply / 供给 | 服务商方案 | 报价 / 方案 |
| dispatch / 派单 | 不展示 | 履约安排 |
| capacity / 运力 | 不展示 | 设备与人员 |
| demand / 需求 | 吊运需求 | 可接吊运需求 |

## 5. 新信息架构

客户侧底部导航：

```txt
首页 / 订单 / 消息 / 我的
```

服务商侧底部导航：

```txt
工作台 / 接单 / 消息 / 我的
```

页面归属：

| 页面 | 角色 | 导航归属 | 说明 |
| --- | --- | --- | --- |
| 01 模式选择_登录入口 | 未登录 / 入口 | 登录流程 | 选择客户或服务商模式 |
| 02 客户首页_预约吊运 | 客户 | 首页 | 快速填写吊运需求 |
| 03 确认吊运信息 | 客户 | 首页流程页 | 地址、检测结果、服务类型确认 |
| 04 服务商方案列表 | 客户 | 订单流程页 | 比较并选择服务商方案 |
| 05 客户订单进度 | 客户 | 订单 | 查看履约进度，联系服务商 |
| 06 服务商工作台 | 服务商 | 工作台 | 统计、快捷入口、待处理事项 |
| 07 服务商接单列表 | 服务商 | 接单 | 查看可接吊运需求并报价 |
| 08 服务商履约安排 | 服务商 | 接单 / 订单流程页 | 安排无人机、执行人员、安全检查和保险 |

## 6. 真实项目落地范围

本轮优先改造：

```txt
mobile/
mini-program/
```

暂不改造：

```txt
backend/
admin/
```

后端只在明确缺接口时单独开任务，不在 UI 第一阶段改动。

## 7. 推荐实施顺序

### P0：计划与保护线

目标：

- 完成重构前 tag / 分支 / 快照。
- 建立本执行计划。
- 明确资产使用边界，避免大图进入小程序包。

当前状态：

- 版本保护已完成。
- 本文档为 P0 输出物。

验收：

- 当前分支为 `cc-drone/ui-refactor-two-role-flow`。
- `gptimage/assets/ready` 资源存在且透明。
- 文档明确生产资源不能引用 `gptimage/assets` 原始大图。

### P1：资源压缩与设计基础层

目标：

- 将 6 个 `ready` 资产复制或派生到正式资源目录。
- 建立 UI token 和基础组件。
- 不改业务页面流程。

建议新增：

```txt
mobile/src/assets/haul/
mini-program/src/assets/haul/
mobile/src/theme/haulTokens.ts
mobile/src/components/haul/
mini-program/src/styles/haul-tokens.scss
mini-program/src/components/haul/
```

首批组件：

```txt
HaulCard
HaulButton
StatusBadge
AppGradientHeader
BottomActionBar
RoleAwareTabBar
```

资源处理要求：

- 只从 `gptimage/assets/ready` 取生产资源。
- 不复制 `_preview_ready_assets.png`。
- 小程序资源再次压缩后进入 `mini-program/src/assets/haul/`。
- 如果 PNG 仍偏大，优先通过 `magick -strip`、尺寸缩放或后续 SVG 重绘解决。

验收：

- 新增生产资源总量可控。
- 基础组件可单独被页面引用。
- 旧页面视觉不受影响。

### P2：模式选择页与角色状态

目标：

- 还原 `01_模式选择_登录入口`。
- 建立客户 / 服务商模式选择能力。
- 暂时可以只保存本地选择，不急于重构后端角色。

Mobile 关注文件：

```txt
mobile/src/navigation/AuthNavigator.tsx
mobile/src/navigation/MainNavigator.tsx
mobile/src/screens/auth/
mobile/src/store/
```

Mini Program 关注文件：

```txt
mini-program/src/app.config.ts
mini-program/src/pages/auth/
```

建议新增：

```txt
mobile/src/screens/auth/ModeSelectionScreen.tsx
mobile/src/store/slices/roleSlice.ts
mini-program/src/pages/auth/mode-selection/index.tsx
```

验收：

- 首屏能看到两个入口：`我要吊运`、`我要接单`。
- 两个入口使用准备好的插画资源。
- 登录区域不出现旧角色词。
- 选择角色后可进入对应体验入口。

### P3：客户首页与确认吊运信息

目标：

- 还原 `02_客户首页_预约吊运`。
- 还原 `03_确认吊运信息`。
- 先使用 mock 检测结果和 mock 估价跑通页面跳转。

Mobile 关注文件：

```txt
mobile/src/screens/demand/QuickOrderEntryScreen.tsx
mobile/src/screens/demand/ConfirmHaulInfoScreen.tsx
mobile/src/navigation/MainNavigator.tsx
```

Mini Program 关注文件：

```txt
mini-program/src/pages/publish/quick-order/index.tsx
mini-program/src/pages/publish/confirm-haul/index.tsx
mini-program/src/app.config.ts
```

建议新增组件：

```txt
QuickOrderFormCard
TrustBadgeRow
AddressRouteCard
DetectionResultGrid
ServicePlanSelector
```

验收：

- 客户首页一进来就能看懂要填起吊点、落放点、重量、时间。
- 点击 `获取吊运方案` 进入确认吊运信息页。
- 确认页展示智能检测结果和服务方案选择。
- 客户侧禁用词检查通过。

### P4：客户方案列表与订单进度

目标：

- 还原 `04_服务商方案列表`。
- 还原 `05_客户订单进度`。
- 先用 mock 服务商方案和 mock timeline。

Mobile 关注文件：

```txt
mobile/src/screens/demand/OfferListScreen.tsx
mobile/src/screens/order/OrderDetailScreen.tsx
```

Mini Program 关注文件：

```txt
mini-program/src/pages/demand/
mini-program/src/pages/orders/detail/index.tsx
```

建议新增组件：

```txt
ProviderOfferCard
OrderSummaryCard
OrderProgressTimeline
```

验收：

- 服务商方案卡展示 logo、评分、单量、到场时间、报价、保障标签。
- 点击 `选择此方案` 进入订单进度。
- 订单进度 timeline 状态清晰。
- 未完成前 `完成后可确认` 为禁用态。

### P5：服务商工作台与接单列表

目标：

- 还原 `06_服务商工作台`。
- 还原 `07_服务商接单列表`。
- 建立服务商侧底部导航。

Mobile 建议新增：

```txt
mobile/src/screens/provider/ProviderWorkbenchScreen.tsx
mobile/src/screens/provider/ProviderDemandListScreen.tsx
```

Mini Program 建议新增：

```txt
mini-program/src/pages/provider/workbench/index.tsx
mini-program/src/pages/provider/demands/index.tsx
```

建议新增组件：

```txt
ProviderMetricGrid
ProviderShortcutGrid
ProviderTodoList
DemandCard
```

验收：

- 服务商 tab 为 `工作台 / 接单 / 消息 / 我的`。
- 工作台展示统计、快捷入口、待处理事项。
- 接单列表展示筛选、排序、需求卡、快速报价和查看并报价。
- 服务商侧不出现 `飞手工作台`、`机主工作台`、`抢单大厅`、`派单中心`。

### P6：服务商履约安排

目标：

- 还原 `08_服务商履约安排`。
- 服务商可以看到订单信息、无人机、执行人员、空域安全、保险、费用结算。

Mobile 建议新增：

```txt
mobile/src/screens/provider/FulfillmentArrangementScreen.tsx
```

Mini Program 建议新增：

```txt
mini-program/src/pages/provider/fulfillment-arrangement/index.tsx
```

建议新增组件：

```txt
FulfillmentArrangementCard
PriceSettlementCard
```

验收：

- 页面标题为 `履约安排`。
- 文案使用 `执行人员`，不使用 `飞手`。
- 状态标签区分 `可用`、`已确认`、`待复核`、`已保障`。
- 缺无人机或执行人员时，`安排履约` 应禁用。

### P7：接口适配与 mock 收敛

目标：

- 将 mock 数据逐步替换为现有真实接口。
- 不强行改后端模型，只做前端 adapter 包装。

建议新增：

```txt
mobile/src/services/haul/customerHaulAdapter.ts
mobile/src/services/haul/providerHaulAdapter.ts
mobile/src/services/haul/terminology.ts
mini-program/src/services/haul/customerHaulAdapter.ts
mini-program/src/services/haul/providerHaulAdapter.ts
```

优先接真实接口：

- 登录 / 用户信息
- 地址选择
- 发布吊运需求
- 服务商方案列表
- 选择服务商方案
- 订单详情 / 订单进度
- 服务商可接需求列表
- 服务商提交报价
- 履约安排提交

可以继续 mock：

- 空域检测展示结果
- 预计距离
- 预计作业时长
- 服务商评分和完成单量
- 工作台统计
- 本月收入
- 部分保险 / 资质状态

## 8. 第一批实际执行范围

第一批建议只做：

```txt
P1 资源压缩与设计基础层
P2 模式选择页
P3 中的客户首页 02
```

暂不做：

```txt
03 确认吊运信息
04 服务商方案列表
05 客户订单进度
06 服务商工作台
07 服务商接单列表
08 服务商履约安排
真实接口改造
后端改造
```

原因：

- 01 和 02 足以验证整体设计语言、资源质量、底部导航方向和客户侧简化是否成立。
- 如果第一批视觉还原不满意，后续 6 页不需要返工太多。
- 先不接真实接口，可以避免 UI 还原阶段被业务字段拖慢。

第一批验收标准：

- 生产资源没有引用 `gptimage/assets` 原始大图。
- 入口页和客户首页截图接近设计图。
- 小程序新增资源体积受控。
- 客户侧禁用词不出现在新页面。
- 现有旧页面未删除，原业务入口可以保留为备用。

## 9. 验证命令

每批改造后至少执行：

```bash
cd mobile && npm run lint
cd mini-program && npm run lint
cd mini-program && npm run build:weapp
```

如涉及 TypeScript 或导航类型变化，追加：

```bash
cd mobile && npx tsc --noEmit
```

如涉及后端接口，追加对应 Go 测试。

## 10. 决策记录

- 不把 `gptimage` 原始图作为生产资产。
- 不把整张设计截图当 UI 背景。
- 蓝色顶部背景、卡片、按钮、tab、timeline 通过代码实现。
- 第一批优先做 Mobile 还是 Mini Program，需要在 P1 开始前确认；如果目标是微信小程序优先，则先做 `mini-program`，Mobile 只同步 token 思路。
- 服务商端内部仍可复用旧 pilot/owner/drone/dispatch 能力，但外部文案统一包装为服务商/无人机/执行人员/履约安排。
