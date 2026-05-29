# 退款 / 资金回滚链路审计

审计日期：2026-05-29

## 1. 状态机与写库点

### wallet_transactions type

当前钱包流水类型来自 `backend/migrations/011_add_settlement_tables.sql` 与 `backend/internal/model/finance_credit.go`：

| type | 方向 | 用途 |
| --- | --- | --- |
| `income` | 正数 | 服务商履约服务费、设备服务费、小费即时入账 |
| `withdraw` | 负数 | 提现申请语义，当前主要由提现记录承载 |
| `freeze` | 负数 | 提现时冻结可用余额 |
| `unfreeze` | 正数 | 提现驳回/失败后解冻 |
| `deduct` | 负数 | 提现成功后扣减冻结余额 |
| `refund` | 正数或业务退款语义 | 预留退款流水类型 |
| `income_reversal` | 负数 | 本次新增，冲正已入账 `income`，通过 `related_transaction_id` 追溯原流水 |

### order_settlements 状态机

| 状态 | 进入方式 | 可流转到 | 说明 |
| --- | --- | --- | --- |
| `pending` | 初始化/兼容老数据 | `confirmed` | `FinalizeSettlement` 会先确认再执行 |
| `calculated` | `CreateSettlement` 算价完成 | `confirmed` | 正常结算待确认 |
| `partial_handover` | 服务商履约中取消并改派 | `confirmed` | 改派前已履约部分结算 |
| `confirmed` | `ConfirmSettlement` | `settled` | 可执行钱包入账 |
| `settled` | `ExecuteSettlement` | 终态 | 幂等终态，重复执行直接返回 |
| `disputed` | `MarkSettlementDisputed` | 人工处理 | 阻止自动入账 |
| `pending_review` | 调价复核 | 人工处理 | 阻止自动入账 |

### 资金入口与写库点

| 入口 | 文件:行号 | 写库动作 | 风险结论 |
| --- | --- | --- | --- |
| 客户支付回调 | `backend/internal/service/payment_service.go:274` | `payments.status=paid`，推进 `orders.status/paid_at`，写 timeline/snapshot | 已有事务；重复回调会被 `p.Status == paid` 吸收 |
| 客户取消平台价订单 | `backend/internal/service/order_service.go:1654` | 按状态计算退款，`orders.status=cancelled`，创建 `refunds` | 订单状态与退款记录在同一事务内 |
| 客户取消议价订单 | `backend/internal/service/order_service.go:1629` | 按开工时间计算退款，创建 `refunds` | 仍使用老规则，需产品确认是否继续采用 24h/70% |
| 履约中客户取消 | `backend/internal/service/order_service.go:1669` | 不取消订单，创建 `dispute_records`，写 `dispute_opened` timeline | 不发生自动退款，避免飞行中资金误退 |
| 退款处理 | `backend/internal/service/payment_service.go:243` | 本次改为事务包裹；处理 `refunds`、`payments.status=refunded`、`orders.status=refunded` | 本次补幂等，重复处理不重复写 timeline |
| 服务商取消并改派 | `backend/internal/service/order_service.go:1788` | 释放 provider 字段、重开广播；`in_transit` 时创建 `partial_handover` 结算并即时入账 | 客户资金不在此处退回；改派继续履约 |
| 客户确认完成 | `backend/internal/service/settlement_service.go:630` | 创建/确认/执行结算，写 `wallet_transactions.income` | `AddWalletIncome` 已按结算单+描述幂等 |
| 加价 | `backend/internal/service/settlement_service.go:750` | 创建 `payments.price_adjustment`，更新 settlement surcharge 和广播展示金额 | 不改 `orders.total_amount`；取消时纳入可退支付金额 |
| 小费 | `backend/internal/service/settlement_service.go:665` | 创建 `payments.tip`，直接写 `wallet_transactions.income` | 不改 `orders.total_amount`；当前取消规则不退小费 |

## 2. 已知模式对照

| 模式 | 命中 | 位置 | 影响 | 处理 |
| --- | --- | --- | --- | --- |
| A nullable FK 零值回写 | 低 | `OrderRepo.Update` 高频路径 | 取消/退款依赖订单更新 | 复用批次 III 的 `zeroNullableOrderOmits`，本批未新增整行订单保存 |
| B 权限不一致 | 低 | `RefundPayment` 仅客户可发起 | 服务商无法误触客户退款 | 保持现状 |
| C 金额口径错 | 中 | 加价/小费/退款/结算分流 | 小费即时入账且不随取消退款，需产品确认 | 文档标明；测试覆盖平台价取消退款矩阵 |
| D 缺 migration | 高 | `wallet_transactions/refunds` 缺原流水追溯字段 | 后续冲正无法审计资金来源 | 新增 `127_wallet_refund_traceability.sql` |
| E 成功后再查误判 403 | 低 | 退款处理仍以客户权限查订单 | 状态变 `refunded` 后客户仍有订单所有权 | 无需额外处理 |
| F 幂等缺失 | 高 | `RefundPayment` 重复调用 | 可能重复写退款 timeline / 状态更新 | 本次事务化并对已成功退款做幂等返回 |
| G 并发竞态 | 中 | 退款处理与外部退款通道 | provider 调用仍在事务内，生产外部通道应补 outbox | 本次先保证 DB 原子性 |
| H 状态机环路 | 中 | `cancelled -> refunded` | 重复退款处理不应回写多条记录 | 本次补 `allRefundRecordsSuccessful` |
| I 金额方向错 | 高 | 已入账收入回滚 | 负向冲正没有原流水来源 | 本次新增 `income_reversal` 和 `related_transaction_id` |

## 3. 本次修复清单

| 修复项 | 文件 | 说明 |
| --- | --- | --- |
| 退款/冲正追溯字段 | `backend/migrations/127_wallet_refund_traceability.sql` | `wallet_transactions`、`refunds` 新增 `related_transaction_id` |
| 模型补字段 | `backend/internal/model/finance_credit.go`、`backend/internal/model/order_misc.go` | 让 Go model 与 schema 对齐 |
| 收入冲正 helper | `backend/internal/repository/settlement_repo.go` | `ReverseWalletIncome` 生成 `income_reversal`，金额为负，幂等指向原 `income` |
| 退款事务与幂等 | `backend/internal/service/payment_service.go` | `RefundPayment` 包事务；订单已 `refunded` 且退款记录成功时直接返回 |
| 取消状态矩阵测试 | `backend/internal/service/order_service_test.go` | 覆盖 `pending_dispatch/dispatch_failed/scheduled/preparing/in_transit` 已支付取消 |
| 退款幂等测试 | `backend/internal/service/payment_service_test.go` | 重复处理同一退款只保留一条 `refunded` timeline |
| 资金守恒测试 | `backend/internal/repository/settlement_repo_test.go` | `income + income_reversal = 0`，钱包余额和累计收入回零 |

## 4. 仍需产品确认

- 小费当前即时入账且取消不退，适合“服务中/服务后打赏”语义；如果小费允许在未履约前支付，需要单独定义退款规则。
- 议价单取消仍沿用 `StartTime` 的 24h/70% 规则，未区分平台价的接单后 5 分钟免费取消。
- 生产支付退款建议改为 outbox/异步补偿，避免外部退款调用长时间占用 DB 事务。

## 5. 校验命令

```bash
cd backend
go test ./internal/repository ./internal/service -run 'TestReverseWalletIncome|TestRefundPaymentIsIdempotent|TestPlatformPricedPaidCancelRefundMatrix'
go test ./internal/...
go build ./...
```

Migration 校验：

```bash
$MYSQL < backend/migrations/127_wallet_refund_traceability.sql
$MYSQL -e "SHOW COLUMNS FROM wallet_transactions LIKE 'related_transaction_id'; SHOW COLUMNS FROM refunds LIKE 'related_transaction_id';"
```
