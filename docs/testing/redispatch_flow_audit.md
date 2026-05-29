# 改派 / 自动重派状态机审计

审计日期：2026-05-29

## 1. 状态机与写库点

### order_broadcasts 状态

| 状态 | 进入方式 | 下一步 |
| --- | --- | --- |
| `open` | 订单创建广播、服务商 decline/timeout 后重开、服务商取消后重开 | `grabbed` / `auto_assigning` / `expired` |
| `auto_assigning` | `AttemptAutoAssign` 创建 `broadcast_assignments.pending_accept` | `grabbed` / `open` |
| `grabbed` | 服务商抢单或接受自动指派 | 终态 |
| `expired` | 广播过期、候选耗尽、自动指派达到上限 | 终态；本次候选耗尽时同步订单 `dispatch_failed` |
| `closed` | 预留 | 终态 |

### broadcast_assignments 状态

| 状态 | 进入方式 | 下一步 |
| --- | --- | --- |
| `pending_accept` | 自动指派候选人 | `accepted` / `declined` / `expired` / `superseded` |
| `accepted` | 服务商接受 | 触发 `grabWithRepos`，订单 `assigned` |
| `declined` | 服务商拒绝 | 本次写入排除表并重开广播 |
| `expired` | 超时未响应 | 本次写入排除表并重开广播 |
| `superseded` | 其它 assignment 接受后覆盖 | 终态 |

### 写库点

| 入口 | 文件:行号 | 写库动作 | 风险结论 |
| --- | --- | --- | --- |
| 服务商 decline | `backend/internal/service/broadcast_service.go:540` | assignment `declined`，broadcast `open`，本次新增 exclusion | 修复前可被同单再次候选/手动抢 |
| assignment 超时 | `backend/internal/service/broadcast_service.go:582` | assignment `expired`，broadcast `open`，本次新增 exclusion | 修复前超时服务商仍能再看到/抢 |
| 自动指派候选 | `backend/internal/service/broadcast_service.go:727` | 创建 assignment，broadcast `auto_assigning`，timeline `auto_assigning` | 事务内锁 broadcast/order |
| 接受自动指派 | `backend/internal/service/broadcast_service.go:835` | assignment `accepted`，调用 `grabWithRepos`，其它 pending superseded | 接近截止时用行锁保证单次成功 |
| 广播耗尽/无候选 | `backend/internal/service/broadcast_service.go:963` | broadcast `expired`，本次同步 order `dispatch_failed` | 修复前客户只看到 `pending_dispatch` |
| 手动抢单 | `backend/internal/service/broadcast_service.go:1222` | broadcast `grabbed`，order `assigned` | 已过滤 exclusion 和 `CanSelfExecute` |
| 服务商取消后改派 | `backend/internal/service/order_service.go:1788` | 释放 provider 字段、重开 broadcast、写 exclusion | 批次 III 已覆盖 |

## 2. 已知模式对照

| 模式 | 命中 | 位置 | 影响 | 处理 |
| --- | --- | --- | --- | --- |
| A nullable FK 零值回写 | 低 | provider 释放字段走 `OrderRepo.UpdateFields` | 批次 III 已转 NULL/omit | 复用已有封装 |
| B 权限不一致 | 低 | 手动抢单/自动指派候选均调 `requireProviderSelfExecutableAccess` | 只有完整资质服务商能接即时单 | 保持现状 |
| C 金额口径错 | 中 | 改派前 `partial_handover` 结算 + 新广播剩余金额 | 仍需真实业务确认部分履约比例 | 保持现有 `remainingAmount` 规则 |
| D 缺 migration | 低 | 排除表已有 126 | decline/timeout 复用同表 | 无新增表 |
| E 成功后再查误判 403 | 低 | 服务商取消后释放访问权 | 批次 III handler 已返回摘要 | 保持现状 |
| F 幂等缺失 | 中 | timeout cron 重复跑 | assignment 状态锁定为非 pending 后 no-op | 测试覆盖一次过期只推进一次 |
| G 并发竞态 | 中 | accept 与 timeout 同时发生 | 两边都锁 assignment；先写者成功，后写者看到状态变化 | 保持行锁策略 |
| H 状态机环路 | 高 | A cancel/decline/timeout 后又回到 A | 修复前 decline/timeout 未写 exclusion | 本次统一写 exclusion |
| I 金额方向错 | 低 | 改派本身不直接退款 | 资金动作在 partial settlement | 退款链路另文处理 |

## 3. 本次修复清单

| 修复项 | 文件 | 说明 |
| --- | --- | --- |
| decline 排除 | `backend/internal/service/broadcast_service.go` | `declineAssignmentWithRepos` 写入 `order_broadcast_exclusions`，reason=`assignment_declined` |
| timeout 排除 | `backend/internal/service/broadcast_service.go` | `expireAssignmentWithRepos` 写入 `order_broadcast_exclusions`，reason=`assignment_timeout` |
| 派单失败状态 | `backend/internal/service/broadcast_service.go` | 候选耗尽/达到上限时，broadcast `expired` 并把订单置为 `dispatch_failed` |
| 前端状态文案 | `mini-program/src/pages/orders/detail/index.tsx`、`mini-program/src/pages/orders/index.tsx`、`mini-program/src/utils/index.ts`、`mini-program/src/pages/home/CustomerHaulHome.tsx` | 新增 `dispatch_failed` 标签、详情说明和可取消入口 |
| decline/timeout 测试 | `backend/internal/service/broadcast_service_test.go` | 断言 decline/timeout 服务商进入排除表 |
| 上限失败测试 | `backend/internal/service/broadcast_service_test.go` | 断言自动指派上限后订单为 `dispatch_failed` |

## 4. 状态对客户/服务商的表现

- 客户侧：`dispatch_failed` 显示“暂无服务商 / 暂未匹配到合适服务商”，仍可点“取消订单”。
- 服务商侧：已取消、拒绝或超时的服务商不会在同一订单的列表、手动抢单、自动指派候选中再次命中。
- 平台侧：`order_broadcast_exclusions` 保留原因，便于排查为什么某服务商未被再次派单。

## 5. 校验命令

```bash
cd backend
go test ./internal/service -run 'TestAutoAssignDeclineTriggersNextAttempt|TestAutoAssignExpiresAfterMaxAttempts|TestAutoAssignAcceptDeadlinePassedTransitionsToExpiredAssignment'
go test ./internal/...
go build ./...
```
