# 客户 / 服务商双入口跨端验收清单

## 1. 目的

本清单用于冻结当前两端主入口：

- `customer = 我要吊运`
- `provider = 我要接单`

验收重点不是页面是否能打开，而是同一个账号在小程序和 App 上看到的身份、入口、数据、拦截状态是否一致。小程序 P0 当前只验收服务商主体接单和自履约，不再把“执行人员确认派单”作为主流程。

## 2. 当前基线

最近一次接口级 P0 验收：

- 报告：`backend/docs/mini_program_p0_acceptance_last_run.json`
- 时间：`2026-05-25T18:44:42+08:00`
- 结果：`exit_status = 0`
- 产物：`demand_id=54`，`quote_id=29`，`order_id=57`，`dispatch_id=`，`settlement_id=21`
- 结算：`settlement_status=settled`

执行命令：

```bash
cd backend
PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh
```

本清单的人工验收应在该脚本通过后执行。脚本负责证明后端链路真实打通；人工验收负责证明小程序和 App 没有把同一状态展示错、绕过 gate、或回退到假数据。

## 3. 样本账号

| 账号 | 密码 | 产品身份 | 预期服务商状态 | 主要用途 |
|------|------|----------|----------------|----------|
| `13800000004` | `password123` | 客户 | `pending_review`，不能进入正式服务商工作台 | 客户链路、未审核服务商 gate |
| `13800000007` | `password123` | 服务商 | `approved`，设备能力通过 | 报价、服务商工作台、开始履约、财务入口 |
| `13800000002` | `password123` | 综合样本 | 非主验收账号，以 `/api/v2/me` 为准 | 双能力入口边界抽查 |

注意：前端展示只允许出现“客户 / 服务商”。接口、数据库和兼容字段中的 `owner/pilot/dispatch_tasks` 暂不作为本轮展示问题。

## 4. 构建门禁

小程序：

```bash
cd mini-program
npm run build:weapp
npm run build:weapp:prod
```

App：

```bash
cd mobile
npx tsc --noEmit --pretty false
npx eslint src --max-warnings=999
```

通过标准：

- 小程序两个构建都通过
- App 类型检查通过
- App ESLint 为 `0 errors`，既有 warning 可记录但不阻塞

## 5. 跨端验收矩阵

### A. 客户账号进入我要吊运

账号：`13800000004`

两端都要检查：

- [ ] 入口选择 `我要吊运`
- [ ] 登录后停留在客户上下文
- [ ] 底部导航为客户语义，不显示正式服务商工作台
- [ ] 首页是预约/发布吊运需求，不是服务商接单页
- [ ] 可以进入发布需求、我的订单、订单详情
- [ ] 不显示“机主端 / 飞手端 / 飞手工作台 / 机主工作台”

失败判定：

- 客户账号进入正式服务商工作台
- 展示服务商收入、报价、派单、钱包真实数据入口
- 接口失败时显示设计稿假数据或假成功态

### B. 客户账号进入我要接单

账号：`13800000004`

两端都要检查：

- [ ] 入口选择 `我要接单`
- [ ] 登录后仍保持 `provider` 上下文，不跳回 `customer`
- [ ] 首页显示服务商入驻 / 审核状态 / 能力未开通，而不是正式工作台
- [ ] 点击 `查看账号资料` 或 `我的` 后，仍保持服务商上下文
- [ ] 只能看到入驻资料、设备资质、账号资料
- [ ] 不能看到正式服务商待办、我的报价、我的服务、钱包、提现、人员协作真实列表
- [ ] 直达 `MyOffers / MyQuotes / PublishOffer / OwnerPilotBindings / Wallet / Withdrawal / WithdrawalList` 时显示 gate，不请求正式数据

失败判定：

- 从 `查看账号资料` 绕过 gate 进入正式工作台
- `我的` 页把当前模式切回 `我要吊运`
- 未审核账号能看到真实经营数据或设计稿假数据

### C. 正式服务商账号进入我要接单

账号：`13800000007`

两端都要检查：

- [ ] 入口选择 `我要接单`
- [ ] 首页进入正式服务商工作台
- [ ] 工作台数据来自接口；无后端数据时为空态，不显示设计稿公司名、假金额、假订单号
- [ ] `接单` 页显示真实可报价需求
- [ ] 可以对需求提交报价
- [ ] `我的报价 / 我的服务 / 发布服务 / 钱包` 入口可见且可进入
- [ ] 履约安排可读取真实 `order_id` 和结算信息
- [ ] 订单支付后可以由服务商直接开始履约，不需要另一个账号确认派单
- [ ] 不显示“机主端 / 飞手端”

失败判定：

- 正式服务商仍被拦在入驻页
- 真实 0 数据被伪装成假待办或假收入
- App 和小程序对同一订单状态展示不同

### D. 旧派单兼容边界

旧的 `dispatch_tasks` 数据和接口只作为兼容能力保留，不作为小程序 P0 主流程。

两端都要检查：

- [ ] 服务商工作台不展示 `待我确认派单`
- [ ] 可接需求页不展示 `待确认派单`
- [ ] 履约安排页不展示 `安排执行人员`
- [ ] 旧派单页面若被历史链接打开，不会被底部主导航作为核心入口突出展示

失败判定：

- 服务商接单后必须跳到另一个账号确认
- 主流程出现“飞手端 / 机主端 / 执行人员接单”
- 服务商不能自己开始履约

### E. 同一业务对象跨端一致性

使用最近一次脚本产物或重新生成的产物：

- `demand_id`
- `quote_id`
- `order_id`
- `settlement_id`

两端都要检查：

- [ ] 客户侧订单详情显示同一个 `order_id`
- [ ] 服务商侧履约安排显示同一个 `order_id`
- [ ] 状态文案一致：待确认、待开始履约、服务商已接单、履约中、待签收、已完成
- [ ] 结算金额和服务商口径一致
- [ ] 消息通知点击后回到对应真实对象，不绕到旧页面

失败判定：

- 一个端显示已完成，另一个端显示待确认
- 一个端能看到结算，另一个端显示假金额或空白
- 通知跳转进入旧 owner/pilot 页面并绕过 gate

## 6. 生产态假数据禁线

以下情况必须判失败：

- 后端无数据时展示设计稿里的静态公司、订单号、金额、距离
- 接口失败时显示假成功状态
- 未审核服务商看到正式经营收入、报价、服务列表、提现记录
- 用户可见文案出现“机主端 / 飞手端”
- App 和小程序同一账号、同一入口，进入不同业务模式

## 7. 回归命令和检查点

建议每轮人工验收前先执行：

```bash
cd backend
PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh

cd ../mini-program
npm run build:weapp
npm run build:weapp:prod
```

旧派单兼容专项如需排查历史数据，可单独执行：

```bash
cd backend
PREPARE_DEMO_DATA=1 ./scripts/mini_program_dispatch_ui_fixture.sh prepare
```

该脚本只用于证明旧 `dispatch_tasks` 兼容链路，不能作为小程序 P0 主流程验收依据。

人工验收记录模板：

| 日期 | 端 | 账号 | 入口 | 结果 | 问题 |
|------|----|------|------|------|------|
|  | 小程序 | `13800000004` | 我要吊运 |  |  |
|  | 小程序 | `13800000004` | 我要接单 |  |  |
|  | 小程序 | `13800000007` | 我要接单 |  |  |

最近一次人工验收记录：

| 日期 | 端 | 账号 | 入口 | 结果 | 问题 |
|------|----|------|------|------|------|
| `2026-05-25 12:20` | 小程序 / 微信开发者工具 | `13800000004` | 我要接单 | 通过 | 登录后进入 `pages/provider/onboarding/index`，显示“服务商资质审核中”；点击 `查看账号资料` 后回到底部 `工作台` 仍显示服务商审核 gate；点击 `接单` 只显示能力未开通空态，不展示假需求卡片或正式经营数据。 |
| `2026-05-25 12:22` | 小程序 / 微信开发者工具 | `13800000007` | 我要接单 | 通过 | 登录后进入正式服务商 `pages/home/index` 工作台，显示接口返回的待报价、待开始履约、收入和待处理事项；点击 `接单` 进入 `pages/orders/index`，读取真实可接需求卡片，没有回退到设计稿静态公司名、金额或订单号。 |

最近一次自动验收记录：

| 日期 | 范围 | 命令 | 结果 | 产物 |
|------|------|------|------|------|
| `2026-05-25` | 后端 P0 主链路 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `order_id=48`，`dispatch_id=21`，`settlement_id=14` |
| `2026-05-25` | 重启后后端 P0 主链路 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `order_id=49`，`dispatch_id=22`，`settlement_id=15` |
| `2026-05-25` | 服务商入驻 gate 改造后后端 P0 主链路 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `demand_id=46`，`quote_id=22`，`order_id=50`，`dispatch_id=23`，`settlement_id=16` |
| `2026-05-25 13:32` | 执行人员接住正式派单专项 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `executor=13900000016/user_id=16`，`demand_id=47`，`quote_id=23`，`order_id=51`，`dispatch_id=24`；脚本确认 `pending_dispatch_visible`、`accept_dispatch=accepted`、`assigned_after_accept status=assigned executor=16`，最终 `settlement_id=17/status=settled` |
| `2026-05-25 13:45` | 小程序执行人员手动接单夹具 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_dispatch_ui_fixture.sh prepare` | 通过 | 已准备待响应派单：`executor=13900000016/user_id=16`，`demand_id=50`，`quote_id=25`，`order_id=53`，`dispatch_id=26`；小程序确认后运行 `./scripts/mini_program_dispatch_ui_fixture.sh verify` |
| `2026-05-25 16:55` | 小程序执行人员手动接单验证 | 微信开发者工具自动化点击第一条“接受并履约”，随后 `./scripts/mini_program_dispatch_ui_fixture.sh verify` | 通过 | `dispatch_id=26` 从 `pending_response` 变为 `accepted`；`order_id=53` 推进到 `assigned`；执行人员为 `user_id=16` |
| `2026-05-25 17:06` | 小程序履约推进与客户确认完成 | 微信开发者工具自动化：执行人员推进准备、吊运、送达；客户账号确认完成；随后 `./scripts/mini_program_dispatch_ui_fixture.sh verify-completed` | 通过 | `order_id=53` 进入 `completed`；`settlement_id=18/status=settled`；客户、服务商、执行人员三方均可读取结算；时间线包含完成事件 |
| `2026-05-25 17:53` | 小程序 P0 服务商自履约主链路 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `demand_id=52`，`quote_id=27`，`order_id=55`；支付后直接 `assigned`，服务商 `user_id=7` 推进 `preparing -> in_transit -> delivered`，客户确认完成后 `settlement_id=19/status=settled` |
| `2026-05-25 17:55` | 重启后小程序 P0 服务商自履约主链路 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `demand_id=53`，`quote_id=28`，`order_id=56`；支付后直接 `assigned`，服务商 `user_id=7` 推进 `preparing -> in_transit -> delivered`，客户确认完成后 `settlement_id=20/status=settled` |
| `2026-05-25 18:44` | 小程序 P1 冻结后后端主链路 | `PREPARE_DEMO_DATA=1 ./scripts/mini_program_p0_acceptance.sh` | 通过 | `demand_id=54`，`quote_id=29`，`order_id=57`；支付后直接 `assigned`，服务商 `user_id=7` 推进 `preparing -> in_transit -> delivered`，客户确认完成后 `settlement_id=21/status=settled` |
| `2026-05-25` | 未审核客户号直打正式服务商接口 | `/owner/workbench`、`/owner/supplies`、`/owner/quotes`、`/owner/pilot-bindings` | 通过 | 全部返回 `FORBIDDEN` |
| `2026-05-25` | 小程序服务商入驻 gate 代码级回归 | `rg "ProviderAccessNotice|provider/onboarding|profile/owner"` | 通过 | 正式经营页 gate 均跳 `pages/provider/onboarding/index`；未审核 `ProviderWorkbench` 首次进入跳入驻页 |
| `2026-05-25` | App 服务商入驻 gate 代码级回归 | `rg "ProviderAccessNotice|ProviderOnboarding|OwnerProfile"` | 通过 | 正式经营页 gate 均跳 `ProviderOnboarding`；未审核 `ProviderWorkbenchScreen` 首次进入跳入驻页 |
| `2026-05-25` | 小程序开发构建 | `npm run build:weapp` | 通过 | 仅既有 Sass `@import` 废弃警告 |
| `2026-05-25` | 小程序生产构建 | `npm run build:weapp:prod` | 通过 | 仅既有 Sass `@import` 废弃警告 |
| `2026-05-25` | App 类型检查 | `npx tsc --noEmit --pretty false` | 通过 | 无错误 |
| `2026-05-25` | App Lint | `npx eslint src --max-warnings=999` | 通过 | `0 errors / 106 warnings`，均为既有 warning |

## 8. 当前结论口径

只有同时满足以下条件，才能说“小程序 P0 双入口已冻结”：

1. 接口级 P0 脚本通过
2. 小程序开发和生产构建通过
3. 客户账号在 `我要接单` 只进入入驻 / 审核 gate
4. 正式服务商账号能看到真实接单、报价、履约、财务链路
5. 服务商账号能自己开始履约并推进状态
6. 生产态不展示任何设计稿假数据
