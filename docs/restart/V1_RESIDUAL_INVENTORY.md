# v1 残留清单

## 1. 目的

本清单对应 `N5.02`。

用于回答 3 个问题：

1. 当前哪些能力仍主要依赖 `v1`
2. 哪些残留是“暂时保留”而不是“继续扩散”
3. 后续迁移应该先动哪里，避免新开发再挂回旧链路

本文件只记录“当前有效判断”，不是历史回顾。

## 2. 当前结论

截至 `2026-04-15`，当前项目已经形成明确边界：

- 客户主链路、订单推进、飞行记录闭环、会话读取、`mock` 支付、时间线聚合，默认以 `v2` 为主
- `v1` 仍然保留，但应该被视为“兼容层 / 边缘域 / 尚未完成迁移的能力”，而不是新功能默认入口
- 本轮已经额外收口了两类高风险残留：
  - 移动端默认 API 地址不再硬编码到 `cpolar + /api/v1`，而是先落到 `/api` 根路径，再按客户端切到 `v1 / v2`
  - [AirspaceApplicationScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/airspace/AirspaceApplicationScreen.tsx) 不再通过 `v1 pilot profile` 取飞手身份，已改用 `v2`
  - [PilotOrderExecutionScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/dispatch/PilotOrderExecutionScreen.tsx) 不再通过 legacy `dispatch.ts` 取派单关联订单，已切到 `dispatchV2`

## 3. 保留原则

- 不再给 `v1` 新增业务入口
- 如果某能力已有稳定 `v2` 对口实现，新页面只能走 `v2`
- 如果某能力当前只有 `v1`，允许继续保留，但必须在本清单中明确标注“保留原因”
- `admin` 侧当前仍允许继续走 `v1/admin` 与 `v1/analytics`，直到独立后台域完成迁移

## 4. 当前残留分类

### 4.1 已迁到 v2 的主链路域

这些域默认不应再新增 `v1` 依赖：

| 域 | 当前主入口 |
|---|---|
| 客户资格 / 客户档案主视图 | `mobile/src/services/client.ts` 中 `apiV2` 能力 |
| 需求发布 / 需求详情 / 报价选择 | `v2 demands` |
| 直达下单 / 支付 / 订单详情 / 时间线 | `v2 orders/payment/timeline` |
| 正式派单 | `v2 dispatch-tasks` |
| 飞手档案主视图 / 飞手资格 / 飞行记录列表 | `v2 pilot` |
| 消息会话读取 | `v2 conversations` |
| 合同查看 / 签署 | `v2 orders/{id}/contract` |

### 4.2 暂时保留的 v1-only 或 v1-heavy 域

这些域本轮不强行迁空，但要明确停止扩散：

| 域 | 当前文件/入口 | 保留原因 | 后续动作 |
|---|---|---|---|
| 空域报备详情能力 | [mobile/src/services/airspace.ts](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/services/airspace.ts) | 空域域还没有完整 `v2` 对口 | 保留，后续单独做 airspace v2 化 |
| 飞行轨迹 / 航路模板 / 多点任务 | [mobile/src/services/flight.ts](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/services/flight.ts) | 属于保留能力，本轮主链路不依赖 | 保留，并在产品上弱化入口 |
| 钱包 / 提现 / 结算钱包页 | [mobile/src/services/settlement.ts](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/services/settlement.ts) | 当前结算明细已有 v2，但钱包侧仍是 v1 | 后续按“订单结算 -> 钱包 -> 提现”顺序迁移 |
| 信用 / 保险 / 分析后台 | `backend/internal/api/v1/credit|insurance|analytics` | 暂无对应 v2 域 | 保留 |
| 后台列表与统计 | [admin/src/services/api.ts](/Users/yinswc2e/Code/drone_Rental_platform_v1/admin/src/services/api.ts) | 当前后台仍挂在 `v1/admin` 与 `v1/analytics` | 保留，等后台域重构时再整体迁移 |

### 4.3 仍然依赖 v1 的移动端服务切片

| 服务 | 主要使用页面 | 处理建议 |
|---|---|---|
| `pilot.ts` | `PilotRegister`、`CertificationUpload`、`BindDrone`、`BoundDrones` | 先保留；飞手主视图已切到 `pilotV2Service`，后续再迁认证附件和绑定细项 |
| `flight.ts` | `TrajectoryScreen`、`MultiPointTaskScreen` | 保留为远距/高级能力预留，不作为当前主链路依赖 |
| `airspace.ts` | `AirspaceApplication`、`ComplianceCheck`、`NoFlyZone` | 当前仍保留 |
| `client.ts` 内部少量 legacy 能力 | 企业升级、货物申报、征信历史 | 与“个人可用 MVP”主线解耦，继续保留 |

## 5. 本轮已经完成的减量动作

- `cpolar/api/v1` 默认地址已收口到 `/api` 根路径，避免新客户端默认打回 `v1`
- Web 预览演示登录已切到 `v2 auth/login`
- 机主/飞手/客户主视图优先读 `v2`
- 空域报备页的飞手身份读取已从 `v1` 切到 `v2`
- 飞手执行页的订单读取已从 legacy `dispatch.ts` 切到 `dispatchV2`

## 6. 推荐后续迁移顺序

建议按这个顺序继续减量，而不是到处零散替换：

1. `pilot.ts` 中仍被高频页面使用的认证/绑定能力
2. `settlement.ts` 的钱包与提现视图
3. `airspace.ts` 完整 v2 化
4. `admin` 从 `v1/admin` 与 `v1/analytics` 迁出

## 7. 当前开发约束

从本清单生效开始，新增开发默认遵守：

- 新接口默认加到 `v2`
- 新页面默认优先找 `apiV2` 客户端
- 如果必须复用 `v1`，要在 PR 或任务日志里说明原因
