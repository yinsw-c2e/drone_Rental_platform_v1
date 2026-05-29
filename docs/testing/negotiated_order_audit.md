# 议价单链路系统审计

审计时间：2026-05-29

范围：客户发布需求 -> 服务商报价 -> 客户选定报价 -> 生成议价订单 -> 履约推进 -> 结算。

## 1. 状态机与写库边界

### 1.1 Demand 状态机

模型与 schema：

- `backend/internal/model/demand_matching.go:71` 定义 `Demand`。
- `backend/migrations/103_create_demand_v2_tables.sql:5` 创建 `demands`。
- `status` schema 注释列出 `draft / published / quoting / selected / converted_to_order / expired / cancelled`。
- 前端列表额外把 `closed` 作为聚合分组展示，但后端主状态机未主动写 `closed`。

状态流：

```text
draft
  -> published                 ClientService.PublishDemand
published
  -> quoting                   OwnerService.CreateDemandQuote 首次报价
  -> cancelled                 ClientService.CancelDemand
  -> expired                   ClientService.CloseExpiredDemands
quoting
  -> selected                  ClientService.SelectProvider 选定报价事务中间态
  -> cancelled                 ClientService.CancelDemand
  -> expired                   ClientService.CloseExpiredDemands
selected
  -> converted_to_order        ClientService.SelectProvider 建单成功后
converted_to_order             终态：已生成订单
cancelled                      终态：客户取消需求
expired                        终态：需求过期
```

关键约束：

- `SelectProvider` 在同一事务内锁定 `demands` 和 `demand_quotes`，再写 `selected` 和 `converted_to_order`。
- `CancelDemand` 现在同样锁定 `demands`，避免取消和选定互相覆盖。
- `converted_to_order` 后重复选择同一报价返回既有订单，不重复建单。

### 1.2 Quote 状态机

模型与 schema：

- `backend/internal/model/demand_matching.go:110` 定义 `DemandQuote`。
- `backend/migrations/103_create_demand_v2_tables.sql:41` 创建 `demand_quotes`。
- `demand_id / owner_user_id / drone_id` 均为 `NOT NULL` FK，不属于“nullable FK + Go 零值”陷阱。

状态流：

```text
submitted
  -> submitted                 同一服务商重复报价，更新原报价
  -> selected                  客户选定该报价
  -> rejected                  客户选定其它报价或取消需求
  -> expired                   过期清理/扩展状态
withdrawn                      预留状态，当前未发现小程序报价撤回入口
selected                       终态：该报价已被选中
rejected                       终态：该报价未被选中或需求取消
expired                        终态：过期
```

### 1.3 选定报价到订单映射

入口：

- 后端路由：`backend/internal/api/v2/router.go:191` 和 `backend/internal/api/v2/router.go:232`
- handler：`backend/internal/api/v2/demand/handler.go:253`
- service：`backend/internal/service/client_demand_service.go:443`
- 建单函数：`backend/internal/service/order_service.go:287`

字段映射：

| Quote / Demand 字段 | Order 字段 | 说明 |
| --- | --- | --- |
| `quote.PriceAmount` | `orders.total_amount` | 客户选中的报价额就是订单总额 |
| `quote.OwnerUserID` | `provider_user_id / owner_id / drone_owner_user_id` | 服务商与设备归属必须一致 |
| `quote.DroneID` | `drone_id` | 再次校验设备 marketplace eligible |
| `demand.ID` | `demand_id` | 订单来源追溯 |
| `demand.ClientUserID` | `client_user_id / renter_id` | 客户侧所有权 |
| `demand address/schedule/cargo` | 地址、时间、货物字段 | 从 demand snapshot 解出 |

订单初始值：

- `order_source = demand_market`
- `order_mode = negotiated`
- `status = pending_payment`
- `provider_confirmed_at = now`
- 若服务商没有 verified pilot，`pilot_id` 经 `OrderRepo.Create` 的 `zeroNullableOrderOmits` 保持 SQL `NULL`。

### 1.4 权限模型

| 入口 | 文件:行号 | 权限 |
| --- | --- | --- |
| 客户创建/发布需求 | `backend/internal/service/client_demand_service.go:80` | `requireCurrentEligibility(...publish)` |
| 客户取消需求 | `backend/internal/service/client_demand_service.go:160` | demand owner 校验 |
| 客户查看报价列表 | `backend/internal/service/client_demand_service.go:373` | 只能需求 owner 查看 |
| 客户选定报价 | `backend/internal/service/client_demand_service.go:443` | 客户资格 + demand owner + quote 属于 demand |
| 服务商报价 | `backend/internal/service/owner_service.go:886` | `CanQuote` + owner profile + drone eligible |
| 订单履约推进 | 复用订单详情 / order service | 生成后进入普通订单链路 |

权限结论：

- 议价报价入口要求 `CanQuote`，不强制 `CanSelfExecute`。这是和即时广播不同的入口语义：议价单可以先由资产方报价，后续再按订单执行方式履约。
- 即时广播抢单上一轮已要求 `CanSelfExecute`；议价报价和即时抢单不能混用同一权限。

### 1.5 客户查看报价列表与前端入口

后端：

- `GET /demands/:id/quotes`：`backend/internal/api/v2/demand/handler.go:209`
- 只返回需求 owner 的报价列表，字段由 `buildQuoteSummary` 输出。

前端：

- service：`mini-program/src/services/demandV2.ts:68`
- 我的需求入口：`mini-program/src/pages/profile/my-demands/index.tsx:102`
- 需求详情报价列表与“选定”按钮：`mini-program/src/pages/demand/detail/index.tsx:154`
- 选定后跳订单详情：`mini-program/src/pages/demand/detail/index.tsx:76`

结论：前端“客户查看多家报价并选定”入口存在，不是完全缺失。但转换后 `ListDemandQuotes` 返回空列表，若产品要求“已转订单后仍能回看全部历史报价”，需要另开历史报价视图。

### 1.6 写库点清单

| 文件:行号 | 操作 | 保存方式 | 风险等级 | 说明 |
| --- | --- | --- | --- | --- |
| `backend/internal/service/client_demand_service.go:96` | 创建需求 | `CreateDemand` -> `Create` | 低 | 新增 draft demand |
| `backend/internal/service/client_demand_service.go:122` | 修改需求 | `UpdateDemand` -> `Save` 全字段 | 中 | 无 nullable FK，但全字段 Save 仍容易覆盖并发字段 |
| `backend/internal/service/client_demand_service.go:152` | 发布需求 | `UpdateDemand` -> `Save` 全字段 | 中 | 状态改为 published |
| `backend/internal/service/client_demand_service.go:171` | 取消需求事务 | `LockDemandByID` + quote 批量 `Updates` + demand `Save` | 中 | 已补行锁；仍是 full Save |
| `backend/internal/service/client_demand_service.go:220` | 过期需求清理 | `UpdateDemandFields` | 中 | 定时/手动清理，未逐条锁 quote |
| `backend/internal/service/owner_service.go:917` | 创建/更新报价事务 | `LockDemandByID` + `UpdateDemandQuoteFields` / `CreateDemandQuote` | 低 | 已锁 demand；重复报价更新原行 |
| `backend/internal/repository/demand_domain_client_repo.go:217` | 创建报价 | `Create` | 低 | `demand_id/owner_user_id/drone_id` 均 NOT NULL FK |
| `backend/internal/repository/demand_domain_client_repo.go:257` | 更新报价字段 | `Updates(map)` | 低 | 白名单字段更新 |
| `backend/internal/repository/demand_domain_client_repo.go:264` | 拒绝其它报价 | `Updates(map)` | 低 | 选定一家后关闭其它 submitted/selected |
| `backend/internal/service/client_demand_service.go:463` | 选定报价事务 | `LockDemandByID` + `LockDemandQuoteByID` + order create | 高 -> 已修 | 原风险为重复选定/并发双建单 |
| `backend/internal/service/order_service.go:330` | 议价订单创建 | `OrderRepo.Create` | 中 -> 已验证 | `pilot_id` 可为 NULL；复用 `zeroNullableOrderOmits` |
| `backend/internal/service/settlement_service.go:504` | 结算计算 | 创建/更新 settlement + wallet | 中 | 金额必须使用 order.total_amount，即选中报价额 |
| `backend/internal/service/pilot_service.go:641` | 飞手候选报名 | candidate `Create` / `Updates(map)` | 低 | 不直接生成订单 |
| `backend/internal/service/pilot_service.go:719` | 飞手候选撤回 | `Updates(map)` | 低 | 不直接生成订单 |

## 2. 已知 bug 模式对照

| 模式 | 是否命中 | 位置 | 结论 |
| --- | --- | --- | --- |
| A nullable FK + Go 零值 + full update | 部分命中 | `order_service.go:328` 议价单无 verified pilot 时 `pilot_id=0` | `OrderRepo.Create/Update` 已有 `zeroNullableOrderOmits`，本次补测试确保 SQL NULL 保持 |
| B 权限入口不一致 | 未作为 bug | `owner_service.go:258` / 即时广播 CanSelfExecute | 议价报价按 CanQuote，和即时抢单按 CanSelfExecute 是不同语义 |
| C 金额口径错 | 风险命中 | `order_service.go:364`，`settlement_service.go:515` | 已补测试：quote amount -> order total -> settlement final 一致 |
| D migration 缺失 | 未命中 | `migrations/103` + 后续 cargo dimension migration | `demand_quotes` / `demands` 主链路字段存在；本次无新 migration |
| E 成功后权限变化误判失败 | 未命中 | `client_demand_service.go:492` | 选定成功后重复调用返回既有订单，不因 status 已变而误报失败 |
| F 幂等缺失 | 命中并修 | `client_demand_service.go:492` | 同一 demand 重复选择同一 quote 返回既有 order，不再重复建单 |
| G 并发竞态 | 命中并修 | `client_demand_service.go:471` / `owner_service.go:919` | 选定、报价、取消均锁 demand；选定同时锁 quote |

## 3. 具体缺陷与修复

### 3.1 重复选定同一报价会重复建单

- 命中模式：F/G
- 现状：`SelectProvider` 原来只检查 `demand.Status == converted_to_order` 后直接报错；没有查询是否已生成过议价订单。
- 影响：客户重复点击“选定”或请求重试时可能生成两条订单。
- 修复：`OrderRepo.FindDemandMarketOrderByDemandID` 查询既有 `demand_market + negotiated` 订单；同一需求重复选同一报价直接返回既有订单。
- 测试：`TestSelectProviderCreatesNegotiatedOrderIdempotentlyAndPreservesNullablePilot`

### 3.2 选定报价并发缺行锁

- 命中模式：G
- 现状：`SelectProvider` 原来读 demand/quote 后再更新，没有 `SELECT ... FOR UPDATE`。
- 影响：两个选定请求可能分别通过状态检查并创建重复订单。
- 修复：新增 `LockDemandByID` 和 `LockDemandQuoteByID`；选定事务先锁 demand，再锁 quote。
- 测试：幂等测试覆盖最终只生成一条订单。

### 3.3 报价更新/创建与选定竞态

- 命中模式：G
- 现状：`CreateDemandQuote` 原来不锁 demand。
- 影响：服务商更新报价与客户选定同一需求时，报价状态/金额可能出现先后覆盖。
- 修复：报价事务改为先 `LockDemandByID`，再查/更新现有 quote。
- 测试：`TestCreateDemandQuoteRepeatedSubmissionUpdatesExistingQuote`

### 3.4 取消需求与选定报价竞态

- 命中模式：G
- 现状：`CancelDemand` 原来事务中普通读取 demand。
- 影响：客户两个端同时取消/选定时可能出现需求 cancelled 但订单已创建，或 quote 状态错乱。
- 修复：取消事务改为 `LockDemandByID`，和选定使用同一行锁边界。
- 测试：本次未单独增加取消并发测试，风险降到同一锁边界内。

### 3.5 议价订单 nullable pilot_id 需要保持 NULL

- 命中模式：A
- 现状：议价报价只要求资产合规，服务商没有 verified pilot 时 `resolveOrderExecutionWithRepo` 返回 `pilotID=0`。
- 影响：若 order create/update 写入 `pilot_id=0`，会触发 FK 1452 或污染 nullable 外键。
- 修复：复用上一轮 `OrderRepo.Create/Update` 的 `zeroNullableOrderOmits`，本次测试直接验证议价建单后 DB 原始 `pilot_id IS NULL`。
- 测试：`TestSelectProviderCreatesNegotiatedOrderIdempotentlyAndPreservesNullablePilot`

### 3.6 金额口径需要固定为“选中报价额”

- 命中模式：C
- 现状：代码已使用 `quote.PriceAmount -> order.TotalAmount -> settlement.FinalAmount`，但此前没有议价链路专项测试。
- 影响：若后续改动误用 demand budget 或即时估价，会让客户付款、服务商结算与前端展示不一致。
- 修复：补结算测试固定口径。
- 测试：`TestNegotiatedOrderSettlementUsesSelectedQuoteAmount`

## 4. 回归测试覆盖

新增测试文件：

- `backend/internal/service/negotiated_order_service_test.go`

覆盖点：

1. 选定报价生成 `order_source=demand_market`、`order_mode=negotiated`、`status=pending_payment`。
2. 同一需求重复选定同一报价只生成一个订单。
3. 选定一家后其它报价变成 `rejected`。
4. 服务商无 verified pilot 时，议价订单 `pilot_id` 保持 SQL `NULL`。
5. 同一服务商重复报价更新原 quote，不插入第二条。
6. 结算使用选中报价额作为 `total_amount/final_amount`，再按当前 10% 平台费、5% 保险、45/40 分账比例拆分。

## 5. 剩余阻塞与建议

- 无后端 P0 阻塞：选定、建单、金额、nullable FK、重复选择已经收口。
- 前端入口存在，但“已转订单后回看历史报价”能力不足；若运营需要复盘比价，需要增加只读历史报价入口。
- `UpdateDemand` / `PublishDemand` 仍使用 full `Save`。当前字段没有 nullable FK 爆点，但长期建议改为字段白名单 `Updates`。
- `CloseExpiredDemands` 与选定请求的极端并发仍依赖时间窗校验和状态更新；如要进一步严格，可改为逐条 `LockDemandByID` 后再过期。
