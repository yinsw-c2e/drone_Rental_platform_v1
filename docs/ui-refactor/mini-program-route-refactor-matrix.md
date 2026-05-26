# 小程序路由级重构矩阵

审计日期：2026-05-24

目标：把小程序从旧的客户 / 机主 / 飞手多入口，收敛为 `我要吊运(customer)` 和 `我要接单(provider)` 两个产品入口。后端字段里的 `client`、`owner`、`pilot` 暂不迁移，前端展示层统一为客户、服务商。P0 主流程采用服务商主体自履约，旧 `dispatch_tasks` 仅保留兼容。

## 状态定义

- `KEEP`：保留为主链路页面，必须接真实数据、空态和失败态。
- `REWIRE`：页面保留，但入口、角色判断或数据源需要重接。
- `MERGE`：旧机主/飞手能力合入服务商能力，不再作为独立产品入口表达。
- `REDIRECT`：旧入口不再直接展示，后续应跳转到新入口。
- `DEFER`：非 01-08 主链路，先记录，等小程序 P0 和 App 01-08 冻结后处理。

## 全页面矩阵

| 路由 | 归属 | 状态 | 处理要求 |
| --- | --- | --- | --- |
| `pages/auth/mode-selection/index` | shared | KEEP | 两入口选择页，继续写入 `HaulRoleMode`。 |
| `pages/auth/login/index` | shared | KEEP | 生产包隐藏开发快速登录，登录后按 `role_summary` 校正入口。 |
| `pages/auth/register/index` | shared | KEEP | 注册后保留 `roleMode`，不要新增第三入口。 |
| `pages/home/index` | shared | KEEP | 根据 `customer/provider` 渲染客户首页或服务商工作台。 |
| `pages/messages/index` | shared | KEEP | 消息入口共享，provider tab 不显示客户消息角标。 |
| `pages/chat/index` | shared | KEEP | 聊天详情共享。 |
| `pages/profile/index` | shared | REWIRE | 我的页按客户/服务商能力展示，清理旧机主/飞手端文案。 |
| `pages/profile/my-demands/index` | customer | KEEP | 客户需求历史。 |
| `pages/profile/my-offers/index` | customer | REWIRE | 客户收到的方案/报价，确认真实后端来源。 |
| `pages/profile/my-quotes/index` | provider | KEEP | 服务商报价历史。 |
| `pages/profile/owner/index` | provider | MERGE | 作为服务商设备/供给资料页，不再叫独立机主端。 |
| `pages/profile/pilot/index` | provider | MERGE | 作为服务商履约资质兼容页，不再叫独立飞手端。 |
| `pages/profile/drones/index` | provider | KEEP | 服务商设备管理。 |
| `pages/demand/detail/index` | provider | REWIRE | 服务商查看需求和报价入口，文案改为服务商。 |
| `pages/supply/detail/index` | customer | REWIRE | 客户查看服务商方案，联系对象改为服务商。 |
| `pages/demand/list/index` | provider | KEEP | 05 可接吊运需求，必须要求 provider 能力。 |
| `pages/demand/quote/index` | provider | KEEP | 服务商真实报价入口。 |
| `pages/market/index` | shared | DEFER | 旧市场聚合页，主链路先不用它承接 01-08。 |
| `pages/supply/list/index` | customer | KEEP | 04 服务商方案列表，只展示真实供给。 |
| `pages/orders/index` | shared | KEEP | customer 显示订单，provider tab 切到接单页。 |
| `pages/orders/detail/index` | shared | KEEP | 订单详情共享，按角色展示可操作项。 |
| `pages/orders/anomaly-list/index` | provider | DEFER | 异常运营辅助，主链路冻结后再收口。 |
| `pages/orders/contract/index` | customer | KEEP | 合同/支付边界。 |
| `pages/dispatch/list/index` | provider | DEFER | 旧正式派单兼容页，不再作为 P0 主导航入口。 |
| `pages/dispatch/detail/index` | provider | DEFER | 旧正式派单详情兼容页，不再要求另一个账号确认接单。 |
| `pages/dispatch/create/index` | provider | DEFER | 旧派单创建兼容页，P0 改为服务商直接开始履约。 |
| `pages/payment/index` | customer | KEEP | 支付边界，模拟支付只允许开发/体验环境。 |
| `pages/after-sale/index` | customer | KEEP | 订单后服务入口。 |
| `pages/review/index` | customer | KEEP | 完成后评价入口。 |
| `pages/publish/demand/index` | customer | REDIRECT | 后续重定向到快速吊运发布，不再作为主入口。 |
| `pages/publish/supply/index` | provider | MERGE | 合入服务商供给/设备资料。 |
| `pages/publish/cargo/index` | legacy | DEFER | 旧货运发布，先不纳入 01-08 主链路。 |
| `pages/publish/quick-order/index` | customer | KEEP | 03 确认吊运信息，发布真实需求或直达下单。 |
| `pages/flight/monitor/index` | provider | REWIRE | 履约推进能力后续合入服务商履约，不再表达为独立执行人员端。 |
| `pages/flight/records/index` | provider | DEFER | 履约记录，主链路后补。 |
| `pages/pilot/workbench/index` | provider | REDIRECT | 旧飞手工作台，后续跳转 `pages/home/index?mode=provider`。 |
| `pages/pilot/register/index` | provider | MERGE | 历史资质页，后续只作为服务商履约资质兼容入口。 |
| `pages/settings/index` | shared | KEEP | 设置共享。 |
| `pages/edit-profile/index` | shared | KEEP | 资料编辑共享。 |
| `pages/verification/index` | shared | KEEP | 认证入口共享。 |
| `pages/certification/index` | shared | KEEP | 认证详情共享。 |
| `pages/credit/score/index` | shared | DEFER | 信用体系后续统一。 |
| `pages/credit/deposit/index` | shared | DEFER | 保证金/押金口径后续统一。 |
| `pages/credit/violation/index` | shared | DEFER | 违规记录后续统一。 |
| `pages/insurance/policy/index` | provider | REWIRE | 服务商保险资料，主链路只保留履约页入口。 |
| `pages/insurance/claim/index` | shared | DEFER | 理赔后续处理。 |
| `pages/fulfillment/hub/index` | provider | KEEP | 08 履约安排，P0 主链路。 |
| `pages/fulfillment/safety-check/index` | provider | KEEP | 现场安全复核，P0 主链路。 |
| `pages/cargo/list/index` | legacy | DEFER | 旧货运列表。 |
| `pages/cargo/detail/index` | legacy | DEFER | 旧货运详情。 |
| `pages/cargo/accept/index` | legacy | DEFER | 旧货运接单。 |
| `pages/airspace/index` | provider | REWIRE | 服务商空域辅助，清理飞手文案。 |
| `pages/airspace/no-fly/index` | provider | DEFER | 禁飞区查询。 |
| `pages/compliance/index` | provider | REWIRE | 合规检查，清理飞手文案。 |
| `pages/client/profile/index` | customer | REDIRECT | 旧客户档案，后续合入 `profile/index`。 |
| `pages/client/register/index` | customer | REDIRECT | 旧客户注册，后续合入认证/注册。 |
| `pages/owner/bind-pilot/index` | provider | DEFER | 旧协作人员绑定能力，P0 主流程隐藏。 |
| `pages/pilot/bind-drone/index` | provider | DEFER | 旧设备协作绑定能力，P0 主流程隐藏。 |
| `pages/address/index` | customer | KEEP | 吊运地址选择。 |
| `pages/flight/trajectory/index` | provider | DEFER | 飞行轨迹后续接履约记录。 |
| `pages/flight/multi-point/index` | provider | DEFER | 多点轨迹后续接履约记录。 |
| `pages/drone/add/index` | provider | KEEP | 服务商设备新增。 |
| `pages/drone/edit/index` | provider | KEEP | 服务商设备编辑。 |
| `pages/drone/detail/index` | provider | KEEP | 服务商设备详情。 |
| `pages/drone/certification/index` | provider | KEEP | 服务商设备认证。 |
| `pages/drone/maintenance/index` | provider | DEFER | 设备维护后续收口。 |
| `pages/drone/nearby/index` | customer | DEFER | 旧附近无人机，主链路已由供给列表承接。 |
| `pages/settlement/wallet/index` | provider | KEEP | 服务商结算和钱包。 |
| `pages/settlement/withdrawal/index` | provider | KEEP | 提现申请。 |
| `pages/settlement/withdrawal-list/index` | provider | KEEP | 提现记录。 |

## P0 冻结清单

1. `customer/provider` helper 已作为前端产品入口判断的唯一标准：`canEnterMode` 和 `resolveProviderCapabilities`。
2. provider 主入口必须在未登录或未开通服务商能力时显示明确门禁，不继续展示 0 数据伪工作台。
3. 05 可接需求、08 履约安排必须只展示真实后端结果；接口失败显示失败态，空数据显示空态。
4. 生产包不得展示开发快速登录和 mock 成功数据；开发/体验环境可以保留联调用入口。
5. 用户可见一层入口统一为客户、服务商；不再出现“机主端/飞手端/执行人员接单”这种三端产品表达。

## 下一批执行顺序

1. 小程序：继续清理 `profile/index`、`profile/owner`、`profile/pilot`、`owner/bind-pilot`、`pilot/bind-drone` 的旧身份文案。
2. 小程序：把 `pilot/workbench`、`client/profile`、`client/register` 等旧入口改为显式跳转。
3. 小程序：跑通三个验收场景：客户直达下单、客户发需求等报价、服务商接单并自履约。
4. App：小程序 P0 冻结后，按 08 -> 05 -> 04/07 -> 03 顺序对齐真实数据链路。
