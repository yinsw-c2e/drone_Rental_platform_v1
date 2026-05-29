# 双手机 E2E 问题台账

创建时间：2026-05-28 17:21 CST

用途：记录双手机手测过程中暴露的问题、临时绕过方式、正式修改点和验证结果。后续每发现或修复一个问题，都追加到本文，不覆盖历史记录。

## 状态说明

- `待修`：确认是代码或业务规则问题，尚未修复。
- `待验证`：已经有修改或临时处理，需要重新手测确认。
- `已绕过`：为继续手测做了数据或环境绕过，不代表正式修复。
- `已修复`：代码修复并通过必要验证。
- `环境项`：测试配置或测试数据问题，不一定需要改业务代码。

## 当前问题清单

| ID | 等级 | 状态 | 现象 | 根因/证据 | 修改点 |
| --- | --- | --- | --- | --- | --- |
| E2E-001 | P0 | 环境项 | 真机登录请求打到 `http://127.0.0.1:8080`，手机端报 `ERR_CONNECTION_REFUSED` | 真机无法访问 Mac 本机 `127.0.0.1`；真机应走 cpolar 域名 | 构建真机包时必须使用 `MINI_PROGRAM_API_BASE="https://dronerentalplat.cpolar.top/api/v2" npm run build:weapp`；文档中继续强调 |
| E2E-002 | P0 | 待验证 | 点击“立即下单”时报 `Unknown column 'client_request_id'` | 本地库未执行 `backend/migrations/125_orders_client_request_id.sql`，但代码已写入 `orders.client_request_id` | 所有 E2E/测试/生产库必须执行 migration 125；验证 `orders.client_request_id` 和唯一索引 `idx_orders_client_request_id` 存在 |
| E2E-003 | P0 | 待验证 | 下单后进入“订单进度”空白，控制台报 `null is not an object (evaluating 'x.order_mode')` | `mini-program/src/pages/orders/live/index.tsx` 在订单详情未加载前读取 `order.order_mode` | 已加 `order` 空值保护；需要重新构建并真机验证 live 页不再白屏 |
| E2E-004 | P1 | 已绕过 | B 新注册/登录后不能直接进入正式服务商工作台 | 新账号只有 `users` 行，没有已审核的 `owner_profiles`/`pilot_profiles`/`pilots` 能力档案 | 手测主链路可复用已审核账号，或先通过 admin/SQL 置为 approved；正式产品需完善入驻审核闭环 |
| E2E-005 | P0 | 待修 | `13900010002` 在“接单需求”页提示“服务商设备能力未开通”，但理论上仍可能通过“上线接单”抢即时单 | `demand/list` 用 `can_quote` 拦截；广播上线/抢单只要求 `Provider.CanUseWorkbench`。`CanUseWorkbench` 当前只要设备能力或履约能力任一 approved 即可 | 统一服务商接单权限：即时单抢单也应要求 `can_self_execute` 或至少 `can_quote`；否则不能把订单写成 `self_execute` |
| E2E-006 | P1 | 环境项 | A 下单后等待过久，`order_broadcasts` 变成 `expired`，B 看不到广播 | 广播 TTL 已过期，`ListBroadcasts` 只返回 `open` 且未过期的广播 | 手测时需让 B 先上线再下单，或重新创建订单；临时续测可把广播更新为 `open` 并延长 `expires_at` |
| E2E-007 | P1 | 待修 | “设备能力未开通”文案容易让人误解：账号到底能不能接单不清楚 | 当前把“议价需求报价能力”和“即时广播接单能力”拆成不同权限，前端文案没有解释差异 | 权限统一后同步改文案；若保留两套能力，页面应明确区分“议价报价未开通”和“即时抢单可用/不可用” |

## 关键代码位置

- 服务商能力汇总：`backend/internal/service/user_service.go`
  - `buildProviderRoleSummary`：`CanUseWorkbench`、`CanQuote`、`CanAcceptDispatch`、`CanSelfExecute` 的来源。
- 即时单广播权限：`backend/internal/service/broadcast_service.go`
  - `requireProviderWorkbenchAccess`：目前只检查 `Provider.CanUseWorkbench`。
  - `providerCanGrabBroadcast`：目前只检查在线位置、服务半径、机型档。
- 议价需求池前端拦截：`mini-program/src/pages/demand/list/index.tsx`
  - `can_quote` 为 false 时显示“服务商设备能力未开通”。
- 客户订单进度页：`mini-program/src/pages/orders/live/index.tsx`
  - 需保证订单未加载时不读取 `order.order_mode`。

## 当前建议优先级

1. 先修 E2E-005：统一“能否接单”的后端权限规则，避免无合格设备账号抢即时单。
2. 回归 E2E-003：真机确认订单进度页不再白屏。
3. 固化 E2E-002：确认所有测试库/部署库都执行 migration 125。
4. 优化 E2E-004/E2E-007：把新服务商入驻、审核、设备能力不足的前端状态讲清楚。

## 追加记录模板

```text
### YYYY-MM-DD HH:mm - E2E-XXX

- 操作：
- 现象：
- DB/日志证据：
- 判断：
- 临时绕过：
- 正式修改点：
- 验证结果：
```

### 2026-05-28 17:31 - E2E-008

- 操作：为继续手测，手动重置订单 88 的 `order_broadcasts.expires_at`。
- 现象：手机 B 已在线，机型 `light_heavy`、半径 30km、距离订单起点约 5.2km，但工作台“附近订单”一直为空。
- DB/日志证据：MySQL 容器 `NOW()` 是 UTC，Mac/后端是 CST；直接用 `DATE_ADD(NOW(), INTERVAL 30 MINUTE)` 写出的 `expires_at=09:57` 被后端按 CST 口径视为已过期，`GET /provider/broadcasts` 返回空。
- 判断：这是手测 SQL 的时区口径问题，不是本次业务代码新 bug。正常小程序下单由 Go 后端写 `expires_at`，返回为 `+08:00`。
- 临时绕过：手动重置广播时使用 `DATE_ADD(DATE_ADD(NOW(), INTERVAL 8 HOUR), INTERVAL 30 MINUTE)`，让 `expires_at` 与后端 CST 比较口径一致。
- 正式修改点：手测文档中所有手动延长 broadcast 的 SQL 都应避免直接用 MySQL 容器 UTC `NOW()`；统一写明 CST 口径。
- 验证结果：本地 `GET /api/v2/provider/broadcasts?limit=20` 返回 `count=1`，首条为 order_id=88，remaining_seconds≈1800。

### 2026-05-28 17:35 - E2E-009

- 操作：B 服务商在订单 88 推进到 `delivered` 后查看订单进度页。
- 现象：服务商视角出现“给个小费”按钮，语义错误；服务商不应该给客户小费。
- DB/日志证据：订单已由 provider 47 推进到 `delivered`，页面仍按订单状态 `delivered` 命中小费可见性。
- 判断：前端按钮可见性只按订单状态判断，漏掉 viewer role；同类风险还包括服务商看到客户侧“评价服务”。
- 临时绕过：无，避免点击该按钮。
- 正式修改点：`mini-program/src/pages/orders/detail/index.tsx` 中小费按钮增加 `!isProviderViewer` 条件，评价按钮复用 `canReview` 客户视角判断。
- 验证结果：待重新构建真机验证服务商详情页不再显示“给个小费”。

### 2026-05-28 17:38 - E2E-001

- 操作：修复服务商侧小费按钮后重新构建小程序。
- 现象：第一次使用普通 `npm run build:weapp`，导致真机包重新指向默认 `127.0.0.1:8080`，手机端再次登录失败。
- DB/日志证据：真机调试 Console 请求 `http://127.0.0.1:8080/api/v2/auth/login` 并报 `ERR_CONNECTION_REFUSED`。
- 判断：测试过程中所有给真机用的构建都必须带 cpolar API base；普通构建只适合本机模拟器。
- 临时绕过：已重新执行 `MINI_PROGRAM_API_BASE="https://dronerentalplat.cpolar.top/api/v2" npm run build:weapp`。
- 正式修改点：后续构建命令统一使用 cpolar；可考虑新增 `npm run build:weapp:e2e` 固化环境变量，避免人为漏传。
- 验证结果：待真机重新登录验证。

### 2026-05-28 17:55 - E2E-010

- 操作：订单 88 完成结算后，B 服务商查看工作台“今日收入”。
- 现象：工作台显示今日收入 ¥1084.00，但结算单中服务商实际入账为 `pilot_fee + owner_fee = 48780 + 43360 = 92140` 分，即 ¥921.40。
- DB/日志证据：`order_settlements.id=36` 显示 `platform_fee=10840`、`pilot_fee=48780`、`owner_fee=43360`；`wallet_transactions` 为 user_id=47 写入两笔 income，金额 48780 和 43360。
- 判断：`GET /api/v2/provider/me/stats` 的 `today_income_cents` 口径错误，当前通过 `CountTodayProviderOrders` 汇总 `orders.total_amount`，把客户实付总额当成服务商收入，未扣平台费。
- 临时绕过：手测以 `order_settlements` 和 `wallet_transactions` 为准，工作台“今日收入”暂不作为结算口径。
- 正式修改点：后端 stats 的 `today_income_cents` 应改为按 `order_settlements` / `wallet_transactions` 聚合服务商净收入；建议口径为今日结算/入账给该 user 的 `pilot_fee + owner_fee + partial_handover`，不要用 `orders.total_amount`。
- 验证结果：待修复后确认工作台今日收入显示 ¥921.40。

### 2026-05-28 18:00 - E2E-011

- 操作：A 手机杀掉并重新打开小程序，验证 token hydrate。
- 现象：小程序回到“我要吊运 / 我要接单”的模式选择页，没有自动回客户首页或上次页面。
- DB/日志证据：`authSlice` 已从 `haul_auth_token` / `haul_auth_user` 读取本地登录态；`app.config.ts` 首屏是 `pages/auth/mode-selection/index`，而该页面此前没有根据 `isAuthenticated` 自动跳转。
- 判断：这不一定代表 token 丢失，但冷启动路由没有消费已登录态，不符合手测脚本“重启后仍登录并回到业务页”的预期。
- 临时绕过：手动点登录或重新进入业务页继续测试。
- 正式修改点：`mini-program/src/pages/auth/mode-selection/index.tsx` 在检测到已登录后自动 `switchTab` 到 `/pages/home/index`，失败时 fallback `reLaunch`。
- 验证结果：已用 cpolar 构建真机包验证，A 手机重启小程序后进入客户首页“立即吊运”，不再停留在模式选择页。

### 2026-05-28 18:16 - E2E-012

- 操作：A 下单后退出 live 地图页，再从订单详情尝试回到地图进度页。
- 现象：订单详情页看不到“查看进度/查看路线”入口；`pending_dispatch` 状态只显示“取消订单”“运力紧张？加价”。
- DB/日志证据：订单 89 状态为 `pending_dispatch`；详情页 `canViewLive` 此前只覆盖 `assigned/preparing/in_transit/delivered`，且按钮文案为“实时位置（暂未启用）”，点击只 toast 不跳转。
- 判断：这是客户主链路 UX 漏项。地图进度页是下单后的主反馈页，用户退出后必须能从订单详情再次进入。
- 临时绕过：开发/测试可直接打开 `/pages/orders/live/index?orderId=89`。
- 正式修改点：`mini-program/src/pages/orders/detail/index.tsx` 将入口改为“查看路线进度”，覆盖 `pending_dispatch/assigned/preparing/in_transit/delivered/completed`，点击跳转到 live 页。
- 验证结果：待 cpolar 构建后真机验证订单详情能进入地图进度页。

### 2026-05-28 18:21 - E2E-006

- 操作：B 手机上线接单后查看“附近订单”，期望看到 A 新下的订单 89。
- 现象：B 工作台仍看不到订单 89。
- DB/日志证据：`order_broadcasts.id=12` 已变为 `expired`，原 `expires_at=2026-05-28 18:13:13.935`；B 的 `provider_presences` 在线，坐标距订单起点约 2.1km，半径 30km，`accepted_service_classes=["light_heavy"]`。
- 判断：不是 B 能力或距离问题，是订单广播 TTL 过期。即时单广播只有短窗口，B 必须先在线再由 A 下单，或者测试时手动续期。
- 临时绕过：已将订单 89 的广播重置为 `open`，`expires_at=2026-05-28 18:51:01.040`。
- 正式修改点：手测文档需更强调“B 先上线，A 再下单”；测试辅助 SQL 使用 CST 口径续期广播。
- 验证结果：本地 `GET /api/v2/provider/broadcasts?limit=20` 返回 `count=1`，首条 `order_id=89`、`broadcast_id=12`、`distance_km=2.1`、剩余约 29 分钟。

### 2026-05-28 18:24 - E2E-013

- 操作：A 查看 live 地图进度页。
- 现象：底部面板下方留白较多，页面又不能整体滑动，用户误以为下方可能有内容被隐藏。
- DB/日志证据：无 DB 相关；前端样式 `orders/live/index.scss` 中页面 `overflow:hidden`，地图 `60vh`，底部面板 `min-height: calc(40vh + 28rpx)`。
- 判断：这是布局 UX 问题。蓝条只是服务进度条背景，不是隐藏内容提示，但强制 40vh 面板让空白过多。
- 临时绕过：无，当前页面内容已完整展示。
- 正式修改点：`mini-program/src/pages/orders/live/index.scss` 改为 flex 固定布局，地图占剩余空间，底部面板按内容高度展示并在极端情况下内部滚动。
- 验证结果：待 cpolar 构建后真机验证底部空白减少，且没有内容被截断。

### 2026-05-28 18:30 - E2E-014

- 操作：注册 003 服务商账号后观察首次进入服务商入驻链路。
- 现象：注册成功后先闪过蓝色工作台头图，再跳到“服务商入驻”页，但页面主体一片空白。
- DB/日志证据：`/api/v2/me` 返回 003 的 `provider.status=none`、`next_action=start_onboarding`，理论上应展示“开始服务商入驻”卡片，不是数据缺失。
- 判断：两个前端问题叠加：provider 注册后先 `switchTab` 到工作台再由工作台跳 onboarding，造成闪屏；onboarding 根部使用固定高度 `ScrollView`，真机上出现主体空白风险。
- 临时绕过：返回后重新进入服务商入驻，或从“我的”页进入相关资料页。
- 正式修改点：provider 注册成功后直接 `redirectTo('/pages/provider/onboarding/index?from=register')`；onboarding 根部改为普通 `View`，使用原生页面滚动。
- 验证结果：已用 cpolar API base 重新构建通过；待 003/新号真机重新进入验证不再闪工作台且 onboarding 主体可见。

### 2026-05-28 20:18 - E2E-015

- 操作：为 003 测试账号补齐服务商资质，便于继续走服务商工作台与接单链路。
- 现象：003 注册后只有普通客户账号，`/api/v2/me` 中 `provider.status=none`、`next_action=start_onboarding`。
- DB/日志证据：`users.id=48`；补写 `owner_profiles`、`pilot_profiles`、`pilots`、`drones` 后，`/api/v2/me` 返回 `provider.status=approved`、`asset_status=approved`、`executor_status=approved`、`can_use_workbench=true`、`can_quote=true`、`can_self_execute=true`。
- 判断：这是手测数据准备，不是产品逻辑修复。正式链路仍应通过 admin 审核或后台审核流开通能力。
- 临时绕过：本地 DB 直接把 003 置为测试可用服务商，并创建一台合规重载无人机 `E2E-DRONE-48-001`。
- 正式修改点：无代码修改；后续如需重复手测，可将该类测试账号初始化整理为 seed 脚本。
- 验证结果：003 已具备进入工作台和报价/自履约能力；上线接单仍需在小程序里点击“上线接单”写入 provider presence。

## 修复批次 II - 2026-05-28

### E2E-005 服务商接单权限统一

- 修复文件：`backend/internal/service/broadcast_service.go`、`backend/internal/api/v2/provider/handler.go`、`mini-program/src/pages/home/ProviderWorkbench.tsx`、`mini-program/src/pages/orders/index.tsx`
- 修复内容：即时单广播抢单和自动指派候选人改为要求 `CanSelfExecute`，不满足时返回 `provider_not_self_executable` 并由接口层转成 403；小程序抢单失败和服务商订单分段切换时统一提示“需要先完善设备和履约资质”。
- 待验证点：只有 owner 资质、没有合规 pilot/drone 的账号调用 `/provider/broadcasts/:id/grab` 返回 403；完整资质账号仍能正常抢单。

### E2E-010 工作台“今日收入”口径错误

- 修复文件：`backend/internal/service/broadcast_service.go`、`backend/internal/service/user_service.go`
- 修复内容：`today_income_cents` 改为优先聚合今日 `wallet_transactions.type='income'`；钱包表不可用时按今日已结算 `order_settlements` 的 `pilot_fee + owner_fee + partial_handover_amount` 兜底，不再用 `orders.total_amount`。
- 待验证点：服务商完成一单后工作台今日收入应显示净入账，例如订单 88 应显示 ¥921.40，而不是客户实付 ¥1084.00。

### E2E-007 设备能力文案模糊

- 修复文件：`mini-program/src/pages/demand/list/index.tsx`、`mini-program/src/pages/demand/list/index.scss`
- 修复内容：需求市场能力提示拆成议价报价能力和即时自履约能力；仅能报价但不能自履约时显示“可议价报价；即时抢单需补履约资质”，完全未开通时显示“设备和履约资质都未开通”，并提供“去完善”入口。
- 待验证点：只有 owner 资质账号进入接单需求页能看到“可议价报价；即时抢单需补履约资质”；完整资质账号不显示拦截。

### E2E-001 cpolar API base 固化

- 修复文件：`mini-program/package.json`、`docs/build.md`、`docs/README.md`
- 修复内容：新增 `npm run build:weapp:e2e` 固定使用 `https://dronerentalplat.cpolar.top/api/v2`，并补充本地、E2E、生产构建脚本使用说明。
- 待验证点：真机调试包重新构建后 Console 不再请求 `http://127.0.0.1:8080/api/v2`。

### E2E-002 migration 125 部署 SOP

- 修复文件：`docs/deploy.md`、`docs/README.md`
- 修复内容：新增实测/部署前执行 `go run ./cmd/migrate -include 125` 或 `$MYSQL < migrations/125_orders_client_request_id.sql` 的 SOP，并补充 `client_request_id` 字段和唯一索引校验命令。
- 待验证点：新库执行 SOP 后 `orders.client_request_id` 与 `idx_orders_client_request_id` 均存在，创建即时单不再报 Unknown column。

### 2026-05-28 21:29 - E2E-016

- 操作：创建 X 测试账号 `13900010004`，用于验证“可报价但不可自履约”的服务商不能抢即时单。
- 现象：最初按 owner-only 创建后，`/api/v2/me` 返回 `can_quote=false`，无法覆盖 E2E-007 预期文案；随后补一台 marketplace eligible 测试无人机，但仍不创建 `pilot_profiles/pilots`。
- DB/日志证据：`users.id=49`；`owner_profiles.user_id=49` 已 approved；`drones.serial_number=E2E-DRONE-49-X-001` 已 approved/verified/available；`pilot_profiles/pilots` 对应记录数均为 0。
- 判断：当前代码要求至少一台 marketplace eligible drone 才会 `can_quote=true`，所以纯 owner-only 账号不能进入“可议价报价；即时抢单需补履约资质”分支；X 已调整为资产合规、履约执行人缺失。
- 临时绕过：使用 X 验证 E2E-005 / E2E-007；它能进入工作台和报价页，但 `can_self_execute=false`，抢即时单应返回 403。
- 正式修改点：暂无，先作为测试数据口径差异记录；后续确认产品口径后再决定 owner-only 是否应允许议价报价。
- 验证结果：X 登录 `/api/v2/me` 通过，返回 `can_quote=true`、`can_use_workbench=true`、`can_self_execute=false`、`executor_status=none`。

### 2026-05-28 23:10 - E2E-017

- 操作：A/001 在订单详情页点击“取消订单”。
- 现象：前端 toast 显示 `cannot add or update...`，后端 `/api/v2/orders/89/cancel` 返回 400。
- DB/日志证据：`/tmp/wurenji-backend-e2e.log` 记录 `Error 1452 (23000): Cannot add or update a child row`，失败 SQL 在更新 `orders` 时写入 `drone_id=0`；订单 89 在 DB 中 `drone_id` 实际为 `NULL`。
- 判断：`OrderRepo.Update` 整行保存时只保护了 `pilot_id=0`，没有保护 `drone_id/owner_id=0`；SQL NULL 被 Go 的 `int64` 零值读出后又写回 0，触发外键约束。
- 临时绕过：无，必须修代码后重启后端再测。
- 正式修改点：`backend/internal/repository/order_repo.go` 的 `Update` 一次性 omit `drone_id/owner_id/pilot_id` 的零值引用；新增仓储回归测试覆盖 SQL NULL 读回零值后再更新仍保持 NULL。
- 验证结果：`go test ./internal/repository -run 'TestUpdatePreservesNullableOrderReferences|TestUnsupportedOrderOptionalColumnOmissions' -count=1` 通过；`go build ./...` 通过。待重启后端后真机复测取消订单。

### 2026-05-28 23:32 - E2E-018

- 操作：003 服务商抢单后进入订单详情，点击“取消订单/取消接单”。
- 现象：点击取消时“开始准备”按钮显示为“推进中…”，取消后页面仍停留在旧详情，按钮没有随订单释放状态变化。
- DB/日志证据：`/tmp/wurenji-backend-e2e.log` 中 `/api/v2/orders/90/cancel` 返回 403；DB 中订单实际已从 003 名下释放回 `pending_dispatch`，说明业务操作成功但接口后置查询按新权限失败。
- 判断：两个问题叠加：前端取消和履约推进共用 `actionLoading`，导致按钮 loading 文案串线；后端服务商取消成功后再用当前权限查订单，此时服务商已失去订单访问权，于是把成功操作误返回为 403。
- 临时绕过：取消后返回订单列表刷新；DB 已释放订单，但前端会误以为失败。
- 正式修改点：`mini-program/src/pages/orders/detail/index.tsx` 拆出 `providerAdvanceLoading`，服务商取消文案改为“取消接单”，取消成功后回到订单 Tab；`backend/internal/api/v2/order/handler.go` 对服务商/飞手取消后失去访问权的场景返回订单摘要成功响应。
- 验证结果：已本地构建验证；待重启后端并用 cpolar 包真机复测。

### 2026-05-28 23:39 - E2E-019

- 操作：服务商抢到即时单后又取消接单，观察该单是否重新广播及是否会再次展示给原服务商。
- 现象：代码会把订单重新置为 `pending_dispatch` 并重开同一个广播池，但没有记录或过滤“刚取消过该单的服务商”。
- DB/日志证据：`reassignOrderAfterProviderCancel` 会清空 `provider_user_id/grabbed_by_user_id` 并调用 `reopenBroadcastForReassign`；`reopenBroadcastForReassign` 把 `order_broadcasts.status` 改回 `open`、`grabbed_by_user_id=0`。`order_broadcasts` / `broadcast_assignments` schema 没有 provider exclusion 字段；`ListOpenForProvider` 和 `grabWithRepos` 只按在线、半径、机型和自履约能力过滤。
- 判断：业务逻辑风险。按当前实现，原服务商取消后理论上还能再次看到并再次抢同一单；自动指派也未必能排除原手动抢单人。
- 临时绕过：手测时换另一个服务商账号抢；或用 SQL 把该广播先给目标服务商验证。
- 正式修改点：需要增加订单广播排除机制，例如 `order_broadcast_exclusions(order_id,broadcast_id,provider_user_id,reason)` 或在重派时写入原服务商并在列表、抢单、自动指派候选人选择处统一过滤。
- 验证结果：待修复。

## 修复批次 III - 2026-05-29

### E2E-017 OrderRepo nullable FK 根治

- 修复文件：`backend/internal/model/order_misc.go`、`backend/internal/repository/order_repo.go`、`backend/internal/repository/order_repo_test.go`
- 修复内容：`OrderRepo.Create/Update` 统一走零值 nullable 字段 omit 封装，覆盖 `drone_id/owner_id/pilot_id/renter_id` 四个实际外键列；`UpdateFields` 对同列 0 值统一转 `NULL`；`client_request_id` 标记为 `default:null` 并在空值更新时转 `NULL`，避免 nullable unique 字段被空字符串击穿。
- 待验证点：订单取消、加价、小费、履约推进等走 `OrderRepo.Update` 的路径不会再把 DB NULL 外键写成 0；仓储测试 `TestUpdatePreservesNullableOrderReferences` 覆盖四个高危外键。
- 验证结果：`go test ./internal/repository/...` 通过；`go build ./...` 通过。

### E2E-018 服务商取消后返回语义收口

- 修复文件：`backend/internal/api/v2/order/handler.go`、`mini-program/src/pages/orders/detail/index.tsx`
- 修复内容：确认上一批已拆分 `providerAdvanceLoading`，服务商取消成功后即使释放订单导致当前服务商失去访问权，也由后端返回订单摘要成功响应，不再把成功操作误报 403。
- 待验证点：服务商抢单后点击“取消接单”，按钮 loading 不串到“开始准备”，取消成功后前端能刷新/返回而不是停留旧按钮。
- 验证结果：本批次后端 `go build ./...` 通过；真机仍需用 cpolar 包复测 UI 行为。

### E2E-019 取消后重广播排除原服务商

- 修复文件：`backend/internal/model/order_broadcast.go`、`backend/internal/repository/order_broadcast_repo.go`、`backend/internal/service/order_service.go`、`backend/internal/service/broadcast_service.go`、`backend/internal/service/order_service_test.go`、`backend/internal/service/broadcast_service_test.go`、`backend/migrations/126_order_broadcast_exclusions.sql`
- 修复内容：新增 `order_broadcast_exclusions` 排除表；服务商取消后重开广播时写入原服务商；`ListOpenForProvider`、`Grab`、自动指派候选人三处统一过滤排除名单，防止原服务商再次看到、抢到或被自动指派同一单。
- 待验证点：原服务商取消接单后看不到该单且抢单返回冲突；其它完整资质服务商仍能看到并抢单。
- 验证结果：`go test ./internal/service -run 'TestBroadcastExclusionFiltersListAndGrab|TestProviderCancelTriggersAutoReassign' -count=1` 通过；`go build ./...` 通过。

## 修复批次 IV：议价单链路 - 2026-05-29

### NEG-001 议价单全链路审计落档

- 修复文件：`docs/testing/negotiated_order_audit.md`
- 修复内容：按“取消链路三步法”梳理 demand / quote 状态机、写库点、权限入口、金额流转、前端报价列表入口，并逐项对照 A-G 已知 bug 模式。
- 待验证点：后续议价单手测按该文档确认边界，不再只靠前端页面观察。
- 验证结果：文档已落档；无需运行时验证。

### NEG-002 选定报价幂等与并发锁

- 修复文件：`backend/internal/repository/demand_domain_client_repo.go`、`backend/internal/repository/order_repo.go`、`backend/internal/service/client_demand_service.go`
- 修复内容：新增 demand / quote 行锁读取；`SelectProvider` 在事务内锁 demand 和 quote，先查既有 `demand_market + negotiated` 订单，同一报价重复选定直接返回既有订单；选定其它报价返回明确错误。
- 待验证点：客户重复点击同一报价“选定”只生成一条订单；两个选定请求并发时最终只有一个订单。
- 验证结果：`go test ./internal/service -run 'TestSelectProvider|TestCreateDemandQuoteRepeated|TestNegotiatedOrderSettlement' -count=1` 通过。

### NEG-003 报价/取消与选定的竞态收口

- 修复文件：`backend/internal/service/owner_service.go`、`backend/internal/service/client_demand_service.go`
- 修复内容：`CreateDemandQuote` 和 `CancelDemand` 均改为先 `LockDemandByID`，避免服务商更新报价、客户取消需求和客户选定报价互相覆盖状态。
- 待验证点：服务商更新报价时客户选定同一需求不会插入重复 quote 或生成错误订单；客户取消与选定互斥。
- 验证结果：重复报价更新测试通过；取消并发需手测或后续补压力测试。

### NEG-004 议价金额与 nullable FK 回归测试

- 修复文件：`backend/internal/service/negotiated_order_service_test.go`
- 修复内容：新增议价链路 service 测试，覆盖 quote amount -> order total -> settlement final 的金额一致性；覆盖无 verified pilot 时 `orders.pilot_id` 保持 SQL `NULL`；覆盖选定后其它 quote 变 `rejected`。
- 待验证点：真实议价单完成后结算金额与报价一致，服务商无飞手资质时不会触发 FK 1452。
- 验证结果：`go test ./internal/...` 通过；`go build ./...` 通过。

## 修复批次 V：退款链路 - 2026-05-29

### REF-001 退款/资金回滚审计落档

- 修复文件：`docs/testing/refund_flow_audit.md`
- 修复内容：梳理 `wallet_transactions` 类型、`order_settlements` 状态机、支付/取消/退款/结算/加价/小费全部资金写库点，并按 A-I 模式标注风险。
- 待验证点：后续退款手测按文档逐项核对，不再只看订单状态。
- 验证结果：文档已落档。

### REF-002 退款与收入冲正追溯

- 修复文件：`backend/migrations/127_wallet_refund_traceability.sql`、`backend/internal/model/finance_credit.go`、`backend/internal/model/order_misc.go`、`backend/internal/repository/settlement_repo.go`
- 修复内容：新增 `related_transaction_id`；新增 `income_reversal` 负向冲正流水，指向原 `income`，重复冲正同一原流水幂等返回。
- 待验证点：如果未来出现已入账后人工退款/冲正，钱包流水能追溯到原入账记录，且正负金额代数和为 0。
- 验证结果：`go test ./internal/repository -run TestReverseWalletIncomeCreatesTraceableNegativeTransaction -count=1` 通过。

### REF-003 退款处理幂等与取消退款矩阵

- 修复文件：`backend/internal/service/payment_service.go`、`backend/internal/service/payment_service_test.go`、`backend/internal/service/order_service_test.go`
- 修复内容：`RefundPayment` 包事务；订单已 `refunded` 且所有退款记录 `success` 时直接成功返回，不重复写 timeline；新增已支付平台价订单取消矩阵覆盖 `pending_dispatch/dispatch_failed/scheduled/preparing/in_transit`。
- 待验证点：客户重复点击退款处理不会重复写状态；履约中取消只进入争议，不直接退钱。
- 验证结果：`go test ./internal/service -run 'TestRefundPaymentIsIdempotent|TestPlatformPricedPaidCancelRefundMatrix' -count=1` 通过。

## 修复批次 VI：改派链路 - 2026-05-29

### REDISPATCH-001 改派/自动重派审计落档

- 修复文件：`docs/testing/redispatch_flow_audit.md`
- 修复内容：梳理 `order_broadcasts`、`broadcast_assignments` 状态机，列出 decline、timeout、accept、候选耗尽、手动抢单、服务商取消改派全部写库点，并按 A-I 模式标注风险。
- 待验证点：后续重派手测按文档核对“谁被排除、订单状态怎么展示”。
- 验证结果：文档已落档。

### REDISPATCH-002 decline/timeout 排除同一服务商

- 修复文件：`backend/internal/service/broadcast_service.go`、`backend/internal/service/broadcast_service_test.go`
- 修复内容：自动指派被拒绝写入 `order_broadcast_exclusions(reason=assignment_declined)`；超时未响应写入 `order_broadcast_exclusions(reason=assignment_timeout)`；同一服务商不会再次被列表、手动抢单或自动指派命中同一单。
- 待验证点：号 X/Y 多服务商轮换测试时，拒绝/超时服务商不再回到同一订单候选池。
- 验证结果：`go test ./internal/service -run 'TestAutoAssignDeclineTriggersNextAttempt|TestAutoAssignAcceptDeadlinePassedTransitionsToExpiredAssignment' -count=1` 通过。

### REDISPATCH-003 派单耗尽后的明确订单状态

- 修复文件：`backend/internal/service/broadcast_service.go`、`mini-program/src/pages/orders/detail/index.tsx`、`mini-program/src/pages/orders/index.tsx`、`mini-program/src/pages/home/CustomerHaulHome.tsx`、`mini-program/src/utils/index.ts`
- 修复内容：自动指派达到上限或无候选时把订单置为 `dispatch_failed`；前端新增“暂无服务商/暂未匹配到合适服务商”文案，并保留客户取消入口。
- 待验证点：客户不再长期看到 `pending_dispatch`；匹配失败后可取消订单。
- 验证结果：`go test ./internal/service -run TestAutoAssignExpiresAfterMaxAttempts -count=1` 通过；`npm run build:weapp` 待本批最终构建验证。
