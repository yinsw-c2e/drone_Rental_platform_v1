# 无人机租赁平台 v2 二次启动任务总表

## 1. 目的

本文件用于把 [PROJECT_ANALYSIS_AND_ROADMAP.md](./PROJECT_ANALYSIS_AND_ROADMAP.md) 中的问题、建议和后续规划，收敛成一份适合当前项目阶段的执行总表。

这份总表的目标不是继续铺大而全的上线清单，而是先围绕“当前可落地、可验证、可持续推进”的范围，重新建立一条能逐步完成、逐步回写的开发主线。

本轮主目标：

1. 先补齐 v2 当前真正阻塞主链路的断点
2. 先跑通不依赖企业资质的个人/开发环境 MVP
3. 先把 `mock` 支付当成正式开发联调路径，而不是半成品占位
4. 先把“流程完整”和“用户轻松完成”同时作为目标，重做用户可感知链路
5. 先建立新的任务与验收基线，后续每完成一项就直接回写本文件

## 2. 使用规则

- 状态标记统一使用：`[ ]` 未开始、`[~]` 执行中、`[x]` 已完成、`[!]` 发现问题/阻塞
- 只有真正完成并通过对应验收标准后，才能把任务改成 `[x]`
- 若执行中拆出子任务，优先补充到本文件对应阶段，不另起零散待办
- 若范围变化，先更新“本轮范围与暂缓项”，再调整任务顺序
- 每完成一个任务，除了勾选本文件，也要同步更新受影响的接口文档、验收脚本或页面说明
- 当前默认按“个人用户 + 开发/测试环境 + mock 三方能力”推进，不以真实企业资质接入为前置条件

最近一次基线建立时间：`2026-04-13`

## 3. 当前基线结论

基于 [PROJECT_ANALYSIS_AND_ROADMAP.md](./PROJECT_ANALYSIS_AND_ROADMAP.md)、[REFACTOR_MASTER_TASKLIST.md](../planning/REFACTOR_MASTER_TASKLIST.md)、[PRE_MANUAL_TEST_MASTER_TASKLIST.md](../testing/PRE_MANUAL_TEST_MASTER_TASKLIST.md) 以及当前代码现状，先确认以下共识：

1. v1 到 v2 的大重构已经完成，当前问题不再是“缺结构”，而是“v2 主链路仍有断点”
2. `backend/internal/api/v2/router.go` 中以下 10 个端点仍然是 `NotImplemented`
   - 订单执行推进：`cancel / start-preparing / start-flight / confirm-delivery`
   - 飞行记录闭环：`GET /flight-records/:id`、`positions`、`alerts`、`complete`
   - 消息体系：`GET /conversations`、`GET /conversations/:id/messages`
3. 当前支付并非完全不可用，但真实支付回调验签仍未完成；开发阶段可用的主路径其实是 `mock`
4. 推送、征信、地理围栏精细判断、微信/支付宝正式回调等第三方能力仍有 TODO 或生产凭据依赖
5. 如果现在继续按“真实支付 + 企业资质 + 全量第三方接入”推进，会把开发节奏卡死
6. 因此本轮应该先定义为“个人可用 MVP + mock 联调 + v2 主链路补齐”，把企业资质依赖项移到暂缓清单

## 4. 本轮范围与暂缓项

### 4.1 本轮纳入执行范围

- v2 订单生命周期断链补全
- v2 飞行记录闭环补全
- v2 会话列表与消息列表补全
- `mock` 支付路径稳定化
- 个人用户可以完成发需求、直达下单、支付联调、派单、执行
- 客户、机主、飞手三条链路的心智负担压缩
- 前台对象收口、导航收口、术语收口
- 测试、安全、配置、CI 的最低基线
- 影响主链路理解和转化的流程/文案优化

### 4.2 本轮暂不纳入执行

以下内容保留在后续 backlog，但本轮不作为阻塞项：

- 真实微信支付 / 支付宝支付接入
- 真实支付回调验签与商户号联调
- 企业客户认证闭环作为默认前置门槛
- 第三方征信真实接入
- 官方空域/UOM 平台真实对接
- 极光/个推等正式推送服务联调
- 需要企业主体或正式生产证书才能完成的外部能力

### 4.3 本轮成功标准

- [x] 需求转单链路在 v2 下可完整走通，支付使用 `mock`
- [x] 直达下单链路在 v2 下可完整走通，支付使用 `mock`
- [x] 订单可以取消、开始准备、开始飞行、确认交付
- [x] 飞行记录可以查看详情、写入位置、写入告警、完成飞行
- [x] 会话列表与消息列表可读取
- [x] 个人实名认证用户不需要企业升级即可完成核心下单路径
- [x] 标准化场景下，客户从首页到提交订单控制在 `3-4` 个可感知步骤内
- [x] 非标需求场景下，客户从首页到发布任务控制在 `4-5` 个可感知步骤内
- [x] 客户视角不再需要理解“派单任务”“候选飞手池”等内部执行对象
- [x] 每个关键页面只有一个主动作，用户始终知道“下一步该做什么”
- [x] 至少有一组自动化测试覆盖主链路关键状态变更
- [x] `.env`、上传校验、限流等最低安全项已补齐

### 4.4 本轮体验设计原则

本轮不是简单删流程，而是按下面原则做减负：

1. 必要环节保留，但优先改成系统代办、后台并行或后置补齐，不再全部前置阻断
2. 优先压缩“用户可感知步骤”，而不是只压缩后端真实状态数
3. 用户前台只看到少量对象
   - 客户主要看到：`服务`、`任务`、`订单进度`
   - 机主主要看到：`机队`、`待处理线索`、`订单`
   - 飞手主要看到：`可接任务`、`执行中`、`资质进度`
4. 优先给用户“下一步”，不要要求用户先理解整套业务结构
5. 默认先走最短路径
   - 标准化场景走“快速下单”
   - 非标准场景走“发布任务”
6. 内部流程对象尽量内聚
   - `派单任务`、`候选飞手池`、`飞行留痕` 是系统内部过程，前台尽量折叠到 `订单进度`
7. 所有等待态都必须有预期管理
   - 当前在等谁
   - 大概等多久
   - 如果超时怎么办

## 5. 阶段总览

| 阶段 | 目标 | 当前状态 |
|---|---|---|
| 阶段 0 | 收口本轮范围与验收基线 | `[x]` |
| 阶段 1 | 补齐 v2 主链路断点 | `[x]` |
| 阶段 2 | 重做客户主链路，降低可感知步骤 | `[x]` |
| 阶段 3 | 建立质量与安全最低基线 | `[x]` |
| 阶段 4 | 优化机主/飞手链路与运营支撑 | `[x]` |
| 阶段 5 | 处理技术债与下线准备 | `[x]` |

## 6. 任务总表

## 6.1 阶段 0：范围重置与基线冻结

- [x] N0.01 建立二次启动任务总表
关联文档：[PROJECT_ANALYSIS_AND_ROADMAP.md](./PROJECT_ANALYSIS_AND_ROADMAP.md)、[REFACTOR_MASTER_TASKLIST.md](../planning/REFACTOR_MASTER_TASKLIST.md)
依赖：无
验收标准：存在一份新的总表，明确本轮范围、暂缓项、阶段顺序、状态标记和完成标准。

- [x] N0.02 把“个人可用 MVP”写成统一业务口径
目标：把当前路线从“企业/正式接入优先”改成“个人用户 + mock 联调优先”。
影响范围：本总表、相关业务文档、验收脚本说明
依赖：N0.01
关联文档：[RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)
验收标准：文档中明确个人用户最短主链路；企业资质、真实支付、正式推送不再作为当前阶段阻塞条件。

- [x] N0.03 建立本轮主链路验收样本清单
目标：固定本轮要反复验证的 3 条链路。
建议样本：
1. 客户发需求 -> 机主报价 -> 客户选机主 -> mock 支付 -> 派单 -> 飞行 -> 完成
2. 客户浏览服务 -> 直达下单 -> 机主确认 -> mock 支付 -> 派单 -> 飞行 -> 完成
3. 订单中途取消 / 异常告警 / 售后退款的边界链路
影响范围：`backend/scripts`、测试文档、演示账号说明
依赖：N0.02
关联文档：[RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)
验收标准：至少形成固定账号、固定前置数据和固定验收顺序，后续任务都围绕该样本复验。

- [x] N0.04 输出“真实业务步骤”与“用户可感知步骤”双清单
目标：先把哪些环节必须保留、哪些只是展示方式过重拆清楚。
建议拆法：
1. 客户链路：注册/认证/下单/支付/等待确认/等待派单/执行跟进
2. 机主链路：建档/加设备/补资质/发服务/报价/确认订单/派单
3. 飞手链路：注册/实名/资质/接单/执行/留痕
影响范围：本总表、后续 UX 设计文档
依赖：N0.03
关联文档：[USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)
验收标准：每条链路都明确区分“业务必要步骤”和“用户必须亲自操作的步骤”，后续优化以压缩后者为主。

- [x] N0.05 冻结新的前台对象模型与主入口策略
目标：统一前台到底展示哪些对象，以及首页应该先把用户导向哪里。
建议口径：
1. 客户首页双入口：`快速下单` / `发布任务`
2. 前台隐藏内部对象：`派单任务` 对客户折叠为 `订单进度`
3. 首页不再要求用户先理解“供给市场/需求市场”的平台术语
影响范围：`mobile/src/screens/home`、`mobile/src/navigation`、任务文档
依赖：N0.04
关联文档：[USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)
验收标准：形成统一对象模型和入口策略，后续页面改造都按这个口径推进。

## 6.2 阶段 1：补齐 v2 主链路断点

- [x] N1.01 实现 v2 订单状态推进接口
目标：补齐 `POST /orders/:id/cancel`、`start-preparing`、`start-flight`、`confirm-delivery`。
影响范围：`backend/internal/api/v2/order`、`backend/internal/service/order_*`、`backend/internal/repository`
依赖：N0.03
验收标准：4 个端点不再返回 `NotImplemented`；订单状态机、时间戳、操作者信息、退款/取消联动逻辑正确落库。

- [x] N1.02 实现 v2 飞行记录闭环接口
目标：补齐 `GET /flight-records/:id`、`positions`、`alerts`、`complete`。
影响范围：`backend/internal/api/v2/flight`、`backend/internal/service/flight_*`、`backend/internal/repository`
依赖：N1.01
验收标准：飞手与机主可查看单次飞行详情；位置与告警可写入；飞行完成后订单执行状态可正确推进。

- [x] N1.03 实现 v2 会话与消息读取接口
目标：补齐 `GET /conversations` 与 `GET /conversations/:id/messages`，优先复用现有 v1 消息基础设施或底层数据。
影响范围：`backend/internal/api/v2/message`、`backend/internal/service/message_*`、`mobile/src/screens/message`
依赖：N0.03
验收标准：移动端”消息/会话”页不再是空壳；能看到会话列表、未读数、消息明细。
补充要求：关键状态变更（订单确认、支付成功、派单分配、飞行完成等）应自动往关联会话写入系统消息，确保用户不依赖主动刷新即可感知进度变化。

- [x] N1.04 把 `mock` 支付路径固化为当前正式联调方案
目标：明确本阶段支付方案不是“等真实微信/支付宝接入”，而是“先把 mock 走顺”。
影响范围：`backend/internal/api/v2/payment`、`backend/internal/service/payment_service.go`、`mobile/src/screens/order/PaymentScreen.tsx`、相关文档
依赖：N1.01
验收标准：`method=mock` 能稳定创建支付单、回写支付成功、更新订单状态；界面文案清楚提示真实支付暂缓。

- [x] N1.05 建立 v2 核心断链回归脚本
目标：把订单推进、飞行记录、消息读取至少做成可重复执行的接口级回归。
影响范围：`backend/scripts`、`backend/docs`
依赖：N1.01、N1.02、N1.03、N1.04
验收标准：存在一组脚本或测试命令，可在每次改动后快速确认核心断点没有回归。

- [x] N1.06 实现订单事件时间线聚合接口
目标：提供 `GET /orders/:id/timeline` 聚合接口，把报价、确认、支付、派单、飞行、交付等散落在不同表里的事件按时间排序统一返回。
影响范围：`backend/internal/api/v2/order`、`backend/internal/service/order_*`、`backend/internal/repository`
依赖：N1.01
验收标准：接口能聚合订单关联的关键事件（状态变更、支付记录、派单记录、飞行记录节点）并按时间倒序返回；前端可基于该接口渲染统一时间线，不再需要分别请求多个对象。
说明：这是 N2.08（订单统一时间线）的数据基础，放在阶段 1 完成可以避免阶段 2 落地时被卡住。

## 6.3 阶段 2：重做客户主链路，降低可感知步骤

- [x] N2.01 收口“个人用户可直接下单/发需求”的资格规则
目标：避免把“企业升级、企业资质、复杂货物申报”当成所有客户的默认前置条件。
影响范围：`backend/internal/service/client_*`、`mobile/src/screens/client`、`mobile/src/screens/publish`、相关文案
依赖：N1.04
验收标准：个人实名认证用户可以在开发环境完成核心发单/下单；企业相关字段改为可选增强能力，而非默认阻塞项。

- [x] N2.02 建立客户双路径入口：`快速下单` / `发布任务`
目标：不要让所有客户一上来都进入复杂需求流。
设计原则：
1. 标准化场景先走 `快速下单`
2. 非标、复杂、需要比价的场景再走 `发布任务`
3. 首页 CTA 和市场入口都围绕这两条路径收口
影响范围：`mobile/src/screens/home/HomeScreen.tsx`、`mobile/src/screens/market`、`mobile/src/navigation/MainNavigator.tsx`
依赖：N0.05、N2.01
验收标准：客户在首页不需要先理解平台结构，只需要回答“我要直接找服务”还是“我要发一个任务”。

- [x] N2.03 设计并落地”快速下单”最短路径
目标：把标准化场景压缩成接近网约车式的最短体验。
建议目标链路：
1. 输入起点/终点/货物核心信息
2. 系统推荐可用服务
3. 确认方案并提交
4. 等机主确认或进入支付
影响范围：`mobile/src/screens/demand/QuickOrderEntryScreen.tsx`、`mobile/src/screens/demand/OfferListScreen.tsx`、`mobile/src/screens/demand/OfferDetailScreen.tsx`、`mobile/src/screens/supply/SupplyDirectOrderConfirmScreen.tsx`、`mobile/src/screens/publish/PublishCargoScreen.tsx`
依赖：N2.02
后端前置：需要后端提供按起终点、货物类型、时间窗口筛选可用服务的匹配接口（可作为 N2.03 的子任务或在开始前先补齐）。
验收标准：标准场景下用户无需先发布完整需求、再看报价、再选机主，能直接走最短购买路径。
降级要求：当系统推荐不出可用服务时，应引导用户一键转为”发布任务”，并自动带入已填信息，避免重复填写。

- [x] N2.04 把复杂需求发布改造成“分段式、可保存、可后补”的专业路径
目标：复杂任务仍保留必要信息，但不再要求一次填完全部字段。
设计原则：
1. 第一段只收最小成单信息
2. 第二段按需补充运输细节、附件、货物声明
3. 支持自动保存草稿和事后补充
影响范围：`mobile/src/screens/publish/PublishCargoScreen.tsx`、`mobile/src/screens/publish/PublishDemandScreen.tsx`、`mobile/src/screens/publish/EditDemandScreen.tsx`、`mobile/src/screens/profile/MyDemandsScreen.tsx`、`mobile/src/screens/demand/DemandDetailScreen.tsx`
依赖：N2.02
验收标准：复杂需求不再是“长表单一次提交”，而是“先发起、后完善”的渐进式流程。

- [x] N2.05 收口订单详情与派单详情的对外呈现
目标：前台尽量少暴露“派单任务”这个内部概念，把执行状态聚合进订单详情。
影响范围：`mobile/src/screens/order`、`mobile/src/screens/dispatch`、`mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx`、订单详情接口聚合结构
依赖：N1.01、N1.02
验收标准：普通客户视角主要围绕“订单”；派单只作为执行子状态存在，不再让用户理解两套对象。

- [x] N2.06 统一术语、导航名和对象说明
目标：降低“供给/需求市场/候选飞手池”等内部术语的理解门槛。
建议统一方向：
1. `供给` -> `服务`
2. `供给市场` -> `找服务`
3. `需求市场` -> `任务大厅` 或 `发布任务`
4. `派单任务` -> 客户侧隐藏，飞手侧显示为 `待接任务`
影响范围：`mobile/src`、`admin/src`、业务文档
依赖：N0.05、N2.02
验收标准：前台文案统一为用户语言；用户不需要学习内部业务名词才能操作。

- [x] N2.07 增加等待状态的预期管理与单一主动作
目标：解决”发完需求后不知道等多久””下单后不知道下一步是什么”的黑洞感。
设计原则：
1. 每个状态都显示正在等谁
2. 每个状态都显示预计等待时间
3. 每个状态都给一个明确主动作
预计等待时间数据来源策略（按优先级）：
1. 第一版使用固定经验值：机主确认 ≤ 2h、报价响应 ≤ 24h、派单分配 ≤ 1h、飞手接受 ≤ 30min
2. 后续迭代可基于历史数据计算动态均值
3. 机主/飞手自填的承诺时间作为补充（如有）
影响范围：首页、订单详情、需求详情、消息页
依赖：N1.03、N2.03、N2.04、N2.05
验收标准：关键等待态都能展示预计响应时间、当前责任方、下一步动作提示，不再出现”卡住但看不懂”的体验。

- [x] N2.08 建立”订单统一时间线”而不是多对象跳转
目标：把报价、确认、支付、派单、准备、飞行、交付这些事件尽量汇总进一个时间线心智。
影响范围：`mobile/src/screens/order/OrderDetailScreen.tsx`、`mobile/src/screens/message`、相关聚合接口
依赖：N1.06、N2.05、N2.07
验收标准：用户跟进一个订单时，主要在一个详情页就能理解历史、当前状态和下一步，而不是来回跳市场、派单、消息多个页面。

- [x] N2.09 设计并落地订单取消的用户侧体验
目标：确保取消不只是后端接口能调通，用户侧也能清楚理解取消流程和后果。
设计要求：
1. 取消前有确认弹窗，说明取消后果（是否产生费用、退款方式）
2. 已支付订单取消后展示退款说明和预计退款时间
3. 取消后订单详情页展示取消原因和退款记录
4. 订单列表中已取消订单有明确视觉区分
影响范围：`mobile/src/screens/order/OrderDetailScreen.tsx`、`mobile/src/screens/order/OrderListScreen.tsx`、相关弹窗组件
依赖：N1.01、N2.05
验收标准：用户取消订单时能清楚知道后果；取消完成后能在订单详情里看到退款状态；不会出现”取消了但不知道钱去哪了”的困惑。

## 6.4 阶段 3：建立质量与安全最低基线

- [x] N3.01 补后端核心状态机单测
目标：优先覆盖订单、支付、派单、飞行记录、消息聚合这些最容易断的核心服务。
影响范围：`backend/internal/service/**/*_test.go`
依赖：N1.01、N1.02、N1.03、N1.04
验收标准：关键状态推进、取消、mock 支付、飞行完成、消息读取有稳定单测。

- [x] N3.02 补 API 集成测试
目标：覆盖两条成单链路和主要边界动作。
建议覆盖：
1. 需求转单 -> mock 支付 -> 派单 -> 飞行完成
2. 直达下单 -> 机主确认 -> mock 支付 -> 派单 -> 飞行完成
3. 订单取消 / 部分退款 / 告警上报
影响范围：`backend/internal/api`、`backend/tests` 或脚本目录
依赖：N3.01
验收标准：至少一条自动化链路能端到端验证状态闭环，而不是只依赖手工点击。

- [x] N3.03 完成最低安全加固
目标：先补最低成本、最高收益的安全项。
重点内容：
1. 请求频率限制
2. 文件上传类型/大小校验
3. `admin/.env` 等敏感配置清理出仓库并补 `.gitignore`
4. 关键接口错误信息和权限校验复查
影响范围：`backend/internal/middleware`、上传相关接口、`admin/.env`、`.gitignore`
依赖：N0.03
验收标准：安全基线问题有明确落地，至少不再把明显敏感配置与弱校验继续留在主分支。

- [x] N3.04 建立基础 CI 检查链路
目标：把“后端测试 + 前端构建 + 基本 lint/类型检查”接入统一流水线。
影响范围：`.github/workflows`、`backend`、`mobile`、`admin`
依赖：N3.01、N3.02
验收标准：代码提交后至少能自动检查编译、构建和核心测试，不再只构建 Android APK。

## 6.5 阶段 4：优化机主/飞手链路与运营支撑

- [x] N4.01 飞手改为分级准入
目标：避免让飞手必须一次补齐全部资质才能开始参与平台。
影响范围：飞手档案、资格判断、首页引导、接单权限控制
依赖：N2.01
验收标准：基础认证完成后即可参与低风险/低门槛链路，其余资质按等级渐进补全。

- [x] N4.02 机主入驻改造成“先发服务草稿，后补资质”
目标：减少机主从“想接活”到“能开始配置服务”的前置阻力。
设计原则：
1. 先建机主档案
2. 先添加无人机并保存草稿
3. 先创建服务草稿
4. 关键资质补齐后再上架到公开市场
影响范围：`mobile/src/screens/owner`、`mobile/src/screens/drone`、`mobile/src/screens/publish/PublishOfferScreen.tsx`
依赖：N2.06
验收标准：机主可以先进入经营准备状态，而不是被多重资质步骤挡在入口外。

- [x] N4.03 无人机资质改为并行提交与统一进度总览
目标：减少机主面对多种认证时的等待与迷失。
影响范围：`mobile/src/screens/drone`、机主首页、后台审核页
依赖：N4.02
验收标准：UOM/保险/适航/维护等状态可在一个总览里查看，不再依赖多入口、串行心智。

- [x] N4.04 增加报价比较视图
目标：让客户能更容易判断不同机主报价的差异。
影响范围：需求详情、报价列表、订单选择页
依赖：N2.04、N2.07
验收标准：至少能横向对比价格、机型、飞手经验、预计响应时间等关键信息。

- [x] N4.05 飞手首页与接单页改为“任务视角”
目标：飞手不需要理解平台全貌，只需要知道“我现在能接什么、缺什么资质、下一步做什么”。
影响范围：`mobile/src/screens/pilot`、`mobile/src/screens/dispatch`、`mobile/src/screens/home/HomeScreen.tsx`
依赖：N4.01、N2.07
验收标准：飞手首页围绕 `可接任务 / 执行中 / 资质进度` 三个核心模块组织，不再让飞手在多处页面来回寻找入口。

- [x] N4.06 补管理后台的运营深度能力
目标：先增强排障和运营所需的最小能力，而不是一步到位做完整后台平台。
建议优先：
1. 订单/需求/飞行记录详情抽屉或详情页
2. 基础导出能力
3. 关键审核与状态流转日志
影响范围：`admin/src/pages`、后台接口
依赖：N1.01、N1.02、N3.03
验收标准：运营可以在后台追问题、看详情、导出关键数据，不再只停留在浅列表页。

- [x] N4.07 实现机主"待处理线索"聚合视图
目标：把公开任务、报价机会、待确认直达单聚合到一个统一入口，让机主不再需要在多个页面来回找线索。
影响范围：`backend/internal/api/v2/owner`（新增聚合接口）、`mobile/src/screens/owner`、`mobile/src/screens/home/HomeScreen.tsx`
依赖：N1.01、N2.06
验收标准：机主首页或工作台有一个"待处理"入口，可以看到所有需要机主响应的线索（新需求、待确认订单、待报价任务），数量角标准确。

- [x] N4.08 改进需求发布的时间选择体验
目标：解决用户发布需求时不易发现可选时间、默认显示为"第二天"的体验问题。
现状：`PublishDemandScreen.tsx` 已有 `DateTimePicker` 和 `startDate`/`endDate` 字段，后端 `Demand` 模型已有 `scheduled_start_at`/`scheduled_end_at`，功能层面已具备。但默认值直接设为次日 9:00-17:00，用户如果不主动点击很容易忽略。
改进方向：
1. 在时间选择区域增加醒目标签提示"请选择期望执行时间"
2. 默认值改为空或待选状态，强制用户主动确认时间
3. 提交前校验时间合理性（不能早于当前时间、结束不能早于开始）
影响范围：`mobile/src/screens/publish/PublishDemandScreen.tsx`、`mobile/src/screens/publish/EditDemandScreen.tsx`
依赖：N2.04
验收标准：用户发布需求时能清楚看到时间选择入口，不会无意中使用默认时间；提交后显示的执行时间与用户选择一致。

- [x] N4.09 明确空域报备责任归属与流程集成
目标：把空域报备/申请流程的责任归属明确下来，并将报备状态集成到订单进度中。
业务场景澄清：
本平台定位为"重载末端物资吊运"，典型作业距离为几百米到 1 公里多的短距一次性吊运。这种场景**不涉及航线规划与航线审批**——航线规划/审批是支线干线物流（上百至上千公里远程物流）才需要的。短距吊运只需要向空域管理部门**报备（甚至部分场景不需报备）并申请临时空域**即可。
现状分析：
1. 后端已有 `AirspaceService`（空域申请、提交审核、合规检查），当前设计为飞手/机主负责提交空域申请，方向正确
2. 但文案和数据模型中混用了"航线审批"概念，需要纠正为"空域报备/申请"
3. 客户不应承担空域报备责任，但应能在订单进度中看到报备状态
适用规则：
- 短距吊运（≤数公里）：空域报备/临时空域申请，不需要航线规划
- 支线干线物流（上百公里以上）：才涉及航线规划与航线审批，本平台当前不涉及此场景
建议方案：
1. 空域报备责任归属机主/飞手（已有的设计方向正确）
2. 在订单时间线中增加"空域报备中 / 已通过 / 需调整"状态节点（替换原"航线审批中"）
3. 报备未通过时，机主需重新调整方案并通知客户
4. 本轮先把报备状态与订单关联跑通，正式 UOM 对接仍放暂缓清单
5. 数据模型中 `airspace_applications` 表的 `flight_plan` 字段语义调整为"飞行区域与作业参数"，不再称为"航线规划"
代码层面改动清单（排查完整）：
  N4.09-a 移动端文案修正：
  - `mobile/src/screens/airspace/AirspaceApplicationScreen.tsx`：表单标签"航线描述"→"飞行区域描述"，placeholder"描述计划飞行航线"→"描述计划飞行区域"
  - `mobile/src/components/business/visuals.ts`：状态标签 `airspace_applying` 的 label 保留"申请空域中"（已正确），`airspace_approved` 的 label 保留"空域已批准"（已正确）
  - `mobile/src/screens/dispatch/PilotOrderExecutionScreen.tsx`：确认步骤文案"申请空域"/"空域已批准"已正确，无需改动；但 desc 中如有"航线"字眼需修正
  N4.09-b 后端注释与文案修正：
  - `backend/internal/model/models.go`：注释"航线规划"→"飞行区域"，"航线途经点"→"途经点"（waypoints 字段在短距场景可用于标记起降点和障碍物绕飞点，保留字段但改注释）
  - `backend/internal/service/order_service.go`：状态推进消息保留"正在申请空域许可"/"空域许可已获批"（已正确，无"航线"字眼）
  - `backend/internal/service/airspace_service.go`：检查注释中是否有"航线审批"表述，统一改为"空域报备"
  N4.09-c 后端 SavedRoute/flight route API 评估：
  - `backend/internal/api/v1/flight/handler.go` 中有完整的 `SavedRoute` CRUD（创建、列表、附近搜索、评分、删除），对应 `/api/v1/flight/route/*` 系列接口
  - `mobile/src/services/flight.ts` 中有对应的前端调用
  - 这套"航路保存"功能属于远程物流场景能力，**本轮不删除不重构**，但在 H1.08 暂缓清单中已标注仅远程物流场景使用
  - 如果当前 UI 中有入口暴露此功能，建议隐藏或标注为"预留功能"
影响范围：`backend/internal/service/airspace_service.go`、`backend/internal/service/order_service.go`、`backend/internal/model/models.go`、`mobile/src/screens/airspace/AirspaceApplicationScreen.tsx`、`mobile/src/components/business/visuals.ts`、`mobile/src/screens/order/OrderDetailScreen.tsx`
依赖：N1.06、N2.08
验收标准：订单详情时间线能展示空域报备状态；飞手/机主提交报备后客户可见进度；报备未通过时有明确的处理流程；用户可见文案中不再出现"航线审批/航线规划"表述；后端代码注释统一使用"空域报备/飞行区域"表述。

- [x] N4.10 建立机主与飞手分离场景下的信任保障机制
目标：当平台上的机主（设备方）和飞手（操作方）不是同一人时，建立合理的信任保障措施。
现状：后端已有 `credit_service.go` 和 `DepositScreen.tsx`（保证金页面），数据库有信用控制表。但当前主要面向通用信用控制，缺少针对"设备托管"场景的专项保障。
建议方案（分阶段）：
1. 第一阶段：明确飞手操作他人设备时的责任协议条款（写入合同模板）
2. 第一阶段：飞手接单前需确认设备操作责任声明
3. 第二阶段：引入飞手保证金机制——接单时冻结一定额度，完成后释放
4. 第二阶段：设备损坏/丢失的争议处理流程
影响范围：`backend/internal/service/contract_service.go`（合同模板增加责任条款）、`backend/internal/service/credit_service.go`、`mobile/src/screens/dispatch/PilotOrderExecutionScreen.tsx`
依赖：N1.01、N4.01
验收标准：本轮按第一阶段收口——飞手接受他人设备的派单时能看到责任声明，合同中包含设备操作责任条款；第二阶段的保证金冻结/释放流程保留为后续专项任务，不计入本轮完成口径。

- [x] N4.11 在订单确认页和详情页展示费用明细与佣金拆分
目标：让用户在下单流程中能看到费用构成和平台佣金。
现状：后端 `settlement_service.go` 已有完整定价引擎（基础费、里程费、时长费、重量费、难度系数、保险费、高峰溢价），v2 路由已有 `GET /orders/:order_id/settlement`。但前端下单确认页和订单详情页当前未展示费用明细。
改进方向：
1. 订单确认页展示价格明细（客户看总价和各项费用拆分）
2. 订单详情页可展开查看费用构成
3. 机主侧订单详情展示佣金扣除和实际到账金额
影响范围：`mobile/src/screens/supply/SupplyDirectOrderConfirmScreen.tsx`、`mobile/src/screens/order/OrderDetailScreen.tsx`、`mobile/src/screens/order/CreateOrderScreen.tsx`
依赖：N1.01、N2.05
验收标准：客户在确认下单时能看到费用明细；机主在订单详情中能看到佣金比例和实际到账金额。

- [x] N4.12 验证合同自动生成与签约流程通畅
目标：确保已实现的合同功能在当前 v2 主链路中正常工作。
现状：后端 `contract_service.go` 已有完整合同模板和自动生成逻辑（成交时调用 `GenerateContractForOrder`），包含合同编号、双方信息、服务内容、费用条款、权利义务、违约责任。前端有 `ContractScreen.tsx`，v2 路由有 `GET /contract` 和 `POST /contract/sign`。但在当前主链路验收中未覆盖合同环节。
验证内容：
1. 需求转单成交后是否自动生成合同
2. 直达下单成交后是否自动生成合同
3. 合同页面能否正常渲染和签署
4. 合同内容是否正确引用需求和报价参数
影响范围：`backend/internal/service/contract_service.go`、`mobile/src/screens/order/ContractScreen.tsx`、`backend/internal/api/v2/order/handler.go`
依赖：N1.01、N1.04
验收标准：两条成单链路成交后合同自动生成；客户和机主均可查看并签署合同；合同内容与订单参数一致。

## 6.6 阶段 5：技术债与下线准备

- [x] N5.01 拆分 `backend/internal/model/models.go`
目标：把巨型单文件按领域拆开，降低后续维护成本。
建议拆分方向：`user.go`、`client.go`、`owner.go`、`drone.go`、`demand.go`、`order.go`、`dispatch.go`、`flight.go`、`payment.go`
影响范围：`backend/internal/model`
依赖：N3.01
验收标准：模型按领域拆分完成；编译、迁移、序列化、关联关系保持不变。

- [x] N5.02 梳理并减少 v1 依赖残留
目标：明确哪些页面、接口、后台模块仍依赖 v1，并分批迁移或下线。
影响范围：`backend/internal/api/v1`、`admin/src/services`、`mobile/src/services`
依赖：N1.01、N1.02、N1.03、N1.04
验收标准：形成清晰的 v1 残留清单和迁移计划；新增开发默认不再继续挂靠 v1。

- [x] N5.03 建立最小可观测性方案
目标：先补健康检查、结构化日志、慢查询定位和关键告警入口。
影响范围：后端日志、监控脚本、健康检查接口、部署文档
依赖：N3.04
验收标准：至少能快速判断服务是否健康、关键错误在哪、数据库是否有明显慢点。

- [x] N5.04 统一移动端细节债务
目标：处理不会阻塞主链路、但会持续拉低体验和维护效率的问题。
建议优先：
1. Tab 图标改为矢量图标
2. Web/Native 导航差异梳理
3. 旧 `PublishOfferScreen` 等 v1 语义残留清理
影响范围：`mobile/src/navigation`、`mobile/src/screens`、`mobile-preview`
依赖：N5.02
验收标准：移动端核心导航和视觉表达更统一，旧语义残留继续减少。

## 7. 暂缓清单（需要企业资质或正式外部账号）

以下任务不删除，但明确标记为“后续条件成熟再开”：

- [ ] H1.01 真实微信支付接入与商户回调验签
- [ ] H1.02 真实支付宝接入与回调验签
- [ ] H1.03 企业客户认证闭环与企业资质审核全流程
- [ ] H1.04 第三方征信正式接入
- [ ] H1.05 官方空域/UOM 平台正式对接
- [ ] H1.06 极光/个推等正式推送服务接入
- [ ] H1.07 生产短信签名、模板和正式发送策略
- [ ] H1.08 无人机航路规划功能（仅远程物流场景）
说明：航路规划（含空域避障、航线优化、三维航迹）是支线干线远程物流（上百至上千公里）才需要的行业级专业功能。本平台当前定位为短距末端吊运（几百米至 1 公里多），此距离不需要航线规划，只需空域报备/临时空域申请。如后续平台拓展至远程物流场景，再调研现有市场方案（如大疆飞行规划、AirMap 等）后决定技术路线。暂列入后续 backlog。

这些项重新纳入前，需要先满足以下前提中的至少一项：

1. 已获得可用的企业主体资质
2. 已有真实生产环境接入计划
3. 当前“个人可用 MVP”已经稳定，并开始准备真实运营

## 8. 建议执行顺序

推荐按照下面顺序重新开始，而不是并行铺开：

1. 先完成阶段 1，把 v2 真正断链的接口补齐
2. 再完成阶段 2，把个人用户可用的最短业务路径收口
3. 再完成阶段 3，把测试、安全、CI 补到最低可维护水平
4. 之后再做阶段 4 的体验优化和后台支撑
5. 最后处理阶段 5 的技术债与 v1 下线准备

如果只选一个最小起点，建议从 `N1.01 -> N1.02 -> N1.04 -> N1.06 -> N1.03` 开始。

说明：N1.06（时间线聚合）插在 N1.04 之后，因为它依赖订单状态推进接口，同时是阶段 2 多个前端任务（N2.08）的数据基础。N1.03（消息）仍放最后，但建议先出只读最小版本以解除 N2.07 的阻塞。

## 9. 执行日志

- `2026-04-13`：建立本任务总表；依据路线图文档与当前代码现状，确认本轮主线调整为“个人可用 MVP + mock 支付联调 + v2 主链路补齐”。
- `2026-04-13`：新增 [USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)，完成“真实业务步骤 vs 用户可感知步骤”双清单，以及新的前台对象模型和主入口策略冻结。
- `2026-04-13`：新增 [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)，固定本轮”个人可用 MVP”统一口径、样本账号、重建方式、样本对象和主链路验收顺序，完成 `N0.02` 与 `N0.03`。
- `2026-04-13`：审核补充——新增 N1.06（订单事件时间线聚合接口）、N2.09（订单取消用户侧体验）、N4.07（机主待处理线索聚合视图）；更新 N1.03 补充状态变更系统消息要求、N2.03 补充后端匹配前置与降级路径、N2.07 补充等待时间数据来源策略、N2.08 依赖更新为 N1.06；更新建议执行顺序。
- `2026-04-13`：根据用户反馈新增阶段 4 任务——N4.08（需求时间选择体验改进）、N4.09（航线审批责任归属与流程集成）、N4.10（机主飞手分离场景信任保障）、N4.11（费用明细与佣金前端展示）、N4.12（合同自动生成与签约流程验证）；暂缓清单新增 H1.08（无人机航路规划功能）。
- `2026-04-13`：根据用户反馈更新 N4.09——平台定位为短距末端吊运（几百米至 1 公里多），不涉及航线规划/审批（那是支线干线远程物流概念）。N4.09 标题从"航线审批"改为"空域报备"，明确短距场景只需空域报备/临时空域申请，补充业务场景澄清与适用规则。同步更新 H1.08 说明。
- `2026-04-13`：N4.09 补充代码层面改动清单（N4.09-a/b/c），排查全部 20 个涉及 airspace/航线 的代码文件，拆分为：移动端文案修正、后端注释与文案修正、SavedRoute API 评估。扩展影响范围至 `models.go`、`AirspaceApplicationScreen.tsx`、`visuals.ts`。同步更新 `TEST_CHECKLIST.md`（空域管理→空域报备模块）、`REFACTOR_TASK_TRACKER.md`（阶段四标题、字段注释、路线图）、`BUSINESS_ROLE_REDESIGN.md`（前置动作、底线约束）、`PROJECT_ANALYSIS_AND_ROADMAP.md`（合规风险描述）。
- `2026-04-13`：完成 `N1.01`。补齐 `POST /api/v2/orders/{order_id}/cancel`、`start-preparing`、`start-flight`、`confirm-delivery`；新增 v2 handler 接线与执行阶段快捷入口，收紧执行状态流转校验，补齐 `loading -> preparing` 兼容、`loading/unloading_confirmed_*` 与飞行时间字段回填、事件通知、飞行记录同步触发；修复无人机活跃订单状态集合遗漏 `loading/in_transit` 的问题，并新增订单执行状态规则单元测试。验证：`cd backend && go test ./internal/service ./internal/repository ./internal/api/v2/...` 通过；整仓 `go test ./...` 仍受既有 `internal/pkg/sms/sms.go` 的 `fmt.Errorf` 问题阻塞，未在本任务处理。
- `2026-04-13`：完成 `N1.02`。新增 `backend/internal/api/v2/flight/handler.go`，接通 `GET /api/v2/flight-records/{flight_id}`、`POST /positions`、`POST /alerts`、`POST /complete`；在 `router.go` 中正式注册 v2 飞行记录路由。补充 `flightRepo` / `flightService` 对单条飞行记录详情、按飞行记录查询位置/告警、手工告警写入、飞行记录完成的支持，并为位置上报增加 `recorded_at` 可选字段。`complete` 端点会在飞行中场景下联动订单推进到 `delivered`，再关闭飞行记录，满足“飞行完成后订单执行状态可正确推进”的验收口径。验证：`cd backend && go test ./internal/service ./internal/repository ./internal/api/v2/...` 通过；整仓 `go test ./...` 仍受既有 `internal/pkg/sms/sms.go` 第 116 行阻塞，未在本任务处理。
- `2026-04-13`：完成 `N1.03`。新增 `backend/internal/api/v2/message/handler.go`，接通 `GET /api/v2/conversations` 与 `GET /api/v2/conversations/{conversation_id}/messages`；在 `messageService` / `messageRepo` 中补充会话可见性过滤、分页、会话访问校验以及关联会话系统消息写入能力。同步改造 `eventService`，把订单确认、支付成功、派单分配、执行推进等关键状态变化写入关联双人会话，不再只落到 `system-*` 通知会话；同时把移动端消息读取从 v1 切到 v2（`mobile/src/services/message.ts`、消息列表页、聊天页），确保“会话消息”页可以直接读到真实会话与消息明细。补充更新 [BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md) 中消息接口说明。验证：`cd backend && go test ./internal/service ./internal/repository ./internal/api/v2/...` 通过；`cd mobile && npx eslint src/services/message.ts src/screens/message/ConversationListScreen.tsx src/screens/message/ChatScreen.tsx src/types/index.ts` 通过；整仓 `go test ./...` 仍受既有 `internal/pkg/sms/sms.go` 第 116 行阻塞，未在本任务处理。
- `2026-04-14`：完成 `N1.04`。将支付创建逻辑改为按请求 `method` 生成一致的内部支付单和联调参数，固定 `mock` 为当前正式联调路径，确保 `payment_no` 与返回 `pay_params` 对齐；同时在 v2 支付接口返回 `payment_flow`，明确区分“模拟支付自动完成”与“微信/支付宝仅创建待回调支付单”的能力状态。移动端支付页同步调整为默认优先 `mock`、主按钮文案随渠道切换、真实渠道给出“暂不发起真实扣款”的明确提示；补充更新 [BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md) 中支付接口说明，并新增支付方式/联调参数单元测试。验证：`cd backend && go test ./internal/service ./internal/repository ./internal/api/v2/...` 通过；`cd mobile && npx eslint src/screens/order/PaymentScreen.tsx src/types/index.ts` 通过；整仓 `go test ./...` 仍受既有 `internal/pkg/sms/sms.go` 第 116 行阻塞，未在本任务处理。
- `2026-04-14`：完成 `N1.05`。新增 `backend/scripts/v2_core_regression.sh` 与 `backend/cmd/devtoken`，把 v2 主链路断点收成一组可重复执行的 smoke 回归：验证 `mock` 支付产物、需求单执行推进、`GET /flight-records/{id}`、`positions`、`alerts`、`confirm-delivery`、`complete` 以及 `GET /conversations` / `GET /conversations/{conversation_id}/messages`。脚本默认复用 `phase10` 基线样本，支持 `redis-cli` 验证码 / `LOGIN_PASSWORD` / `devtoken` 三种登录回退，并允许已推进过的旧样本在重复执行时把对应阶段记为 `skipped`。同时补了订单执行留痕字段缺失时的兼容过滤，以及飞行记录保存时忽略关联对象写回，避免旧库缺列阻断回归；更新 [V2_CORE_REGRESSION_RUNBOOK.md](../../backend/docs/V2_CORE_REGRESSION_RUNBOOK.md) 与 [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md) 的脚本产物口径。验证：`bash -n backend/scripts/v2_core_regression.sh` 通过；`cd backend && go test ./internal/service ./internal/repository ./internal/api/v2/...` 通过；`cd backend && BASE_URL=http://127.0.0.1:18080 PREPARE_BASELINE=0 ./scripts/v2_core_regression.sh` 通过，并写入 [backend/docs/v2_core_regression_last_run.json](/Users/yinswc2e/Code/drone_Rental_platform_v1/backend/docs/v2_core_regression_last_run.json)；整仓 `go test ./...` 仍受既有 `internal/pkg/sms/sms.go` 第 116 行阻塞，未在本任务处理。
- `2026-04-14`：完成 `N1.06`。新增 `GET /api/v2/orders/{order_id}/timeline`，把 `order_timelines`、支付记录、退款记录、正式派单记录、飞行记录节点聚合成统一事件流，按 `occurred_at` 倒序返回，供后续订单详情时间线直接消费。同步补充时间线构建单测，更新 [BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md) 与 [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md) 的字段说明，并把 `v2_core_regression.sh` 扩展为校验统一时间线接口、写回 `timeline_event_count`。验证：`cd backend && go test ./internal/api/v2/order ./internal/api/v2/... ./internal/service ./internal/repository` 通过；`curl GET /api/v2/orders/21/timeline`（基于 18080 当前代码实例）返回 `OK` 且包含 `order_timeline / payment / dispatch_task / flight_record` 多源事件；`cd backend && BASE_URL=http://127.0.0.1:18080 PREPARE_BASELINE=0 ./scripts/v2_core_regression.sh` 通过。
- `2026-04-14`：完成 `N2.01`。后端新增统一客户资格视图与 `GET /api/v2/client/eligibility`，把“个人实名认证 + 账号正常 + 平台信用分合格”收口为个人客户发需求、直达下单、需求转单的统一判断依据；默认不再把企业升级、企业资质、复杂货物申报当成个人主链路阻塞项。`GET/PATCH /api/v2/client/profile` 同步扩展为返回默认地址、常用场景、统计字段和嵌入式 `eligibility`，移动端客户中心切到 v2 档案读取并明确展示“可发布需求 / 可直达下单 / 当前阻塞项”；发需求页与直达下单页在提交前会先检查资格，缺实名认证时直接引导去 `Verification`，不再继续用企业升级文案误导用户。补充更新 [BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md) 中客户域接口说明。验证：`cd backend && go test ./internal/service ./internal/api/v2/...` 通过；`cd mobile && npx eslint src/services/client.ts src/screens/client/ClientProfileScreen.tsx src/screens/publish/PublishDemandScreen.tsx src/screens/publish/PublishCargoScreen.tsx src/screens/supply/SupplyDirectOrderConfirmScreen.tsx` 通过。
- `2026-04-14`：完成 `N2.02`。移动端首页与市场入口已按客户双路径重组：`HomeScreen` 的客户首屏主 CTA 收口为 `快速下单 / 发布任务`，并补上首屏解释文案；客户“常用动作”区改为先展示这两条开始路径，再放 `我的任务 / 我的订单`。`MarketHubScreen` 为客户新增“先决定是快速下单还是发布任务”的顶部入口卡，默认文案和空状态统一改成客户语言；客户在该页优先看到 `找服务`，并始终保留 `发布任务` 的并行入口，不再要求先理解“看需求 / 看服务 / 市场”这些平台视角概念。`MainNavigator` 同步把底部 tab 标签从 `市场` 收口为 `发现`，并把 `PublishCargo` 栈标题改为 `发布任务`，保持入口文案一致。验证：`cd mobile && npx eslint src/screens/home/HomeScreen.tsx src/screens/market/MarketHubScreen.tsx src/navigation/MainNavigator.tsx` 通过（仅剩既有 `react-native/no-inline-styles` warning，无 error）。
- `2026-04-14`：完成 `N2.03`。移动端“快速下单”主链路已收口为 `QuickOrderEntry -> OfferList -> OfferDetail -> SupplyDirectOrderConfirm`：`QuickOrderEntryScreen` 先收起点、终点、货物摘要与时间窗口，再把信息以 `quickOrderDraft` 传入推荐页；`OfferListScreen` 只展示支持直达下单的重载服务，并在结果页保留“修改条件重新匹配 / 改为发布任务”两条退路，系统在无匹配时自动保留已填信息；`OfferDetailScreen` 会展示当前快速下单摘要并允许一键转为发布任务；`SupplyDirectOrderConfirmScreen` 自动带入起终点、货物和时间，减少重复填写；`PublishCargoScreen` 也支持接收同一份草稿作为降级承接页。验证：`cd mobile && npx eslint src/screens/demand/QuickOrderEntryScreen.tsx src/screens/demand/OfferListScreen.tsx src/screens/demand/OfferDetailScreen.tsx src/screens/supply/SupplyDirectOrderConfirmScreen.tsx src/screens/publish/PublishCargoScreen.tsx` 通过。
- `2026-04-14`：完成 `N2.04`。任务发布链路已改成“两段式 + 服务器草稿 + 自动保存/后补”：`PublishCargoScreen` 作为当前客户主入口，支持先填起终点、时间、重量等最小成单信息，再补预算、货物属性和现场说明；从 `quickOrderDraft` 降级进入时，会直接跳到第 2 步并保留已填核心信息。`PublishDemandScreen` 同步收口为同样的两段式节奏，只是保留“单地址作业点”模型；`EditDemandScreen` 则按任务状态区分“继续完善草稿”和“修改已发布任务”，对草稿启用自动保存，对已发布/询价中的任务保留手动保存。`MyDemandsScreen` 与 `DemandDetailScreen` 也补了“继续完善”入口文案，避免草稿在列表和详情页里仍表现成普通编辑。验证：`cd mobile && npx eslint src/screens/publish/demandComposerShared.ts src/screens/publish/PublishCargoScreen.tsx src/screens/publish/PublishDemandScreen.tsx src/screens/publish/EditDemandScreen.tsx src/screens/profile/MyDemandsScreen.tsx src/screens/demand/DemandDetailScreen.tsx` 通过。
- `2026-04-14`：完成 `N2.05 ~ N2.09`，阶段 2 收口完成。订单详情页改造成“订单进度主视图”：新增等待焦点卡、客户友好的执行安排摘要、统一时间线消费、取消后果说明和退款状态展示；客户不再通过“查看派单”理解执行过程，执行安排只在机主/飞手侧保留深入入口。订单列表同步增加进度提示、取消单视觉区分和“查看进度”主动作；任务详情页新增等待态说明；消息通知点击优先回到订单详情；履约工作台和导航标题同步把 `派单` 收口为 `执行安排`，`供给/需求` 标签收口为 `服务/任务`。后端订单摘要补充 `cancel_reason / cancel_by` 字段，移动端新增 `GET /orders/{id}/timeline` 与 `POST /orders/{id}/cancel` 的 v2 服务封装。验证：`cd mobile && npx eslint src/screens/order/OrderDetailScreen.tsx src/screens/order/OrderListScreen.tsx src/screens/message/ConversationListScreen.tsx src/screens/fulfillment/FulfillmentHubScreen.tsx src/screens/dispatch/DispatchTaskDetailScreen.tsx src/screens/demand/DemandDetailScreen.tsx src/navigation/MainNavigator.tsx src/components/business/visuals.ts src/services/orderV2.ts src/types/index.ts` 通过（仅剩仓库既有 `MainNavigator` inline-style warning）；`cd backend && go test ./internal/api/v2/order ./internal/api/v2/...` 通过。
- `2026-04-14`：完成 `N3.01 ~ N3.04`，阶段 3 收口完成。后端新增 sqlite 服务测试基座，并补齐订单取消退款、飞行完成、消息会话过滤与系统消息写入、支付方式归一化等核心单测；把 `v2_core_regression.sh` 明确收口为 restart 主链路 API 集成回归基线。安全层补充全局基础限流中间件、上传扩展名与 MIME 双重校验，并将 `admin/.env`、`mobile/.env*` 纳入忽略规则。CI 侧新增 `.github/workflows/ci.yml`，统一执行后端关键测试、`admin` 构建和 restart 关键移动端 lint；考虑到仓库存在历史移动端 lint 债务，本轮先以 `scripts/ci_mobile_restart_lint.sh` 收口“本次改造核心切片”的稳定检查，而不是直接把全量历史页面错误纳入阻塞。验证：`cd backend && go test ./internal/service ./internal/api/middleware ./internal/pkg/upload ./internal/api/v2/order ./internal/api/v2/... ./internal/repository` 通过；`bash scripts/ci_mobile_restart_lint.sh` 通过。
- `2026-04-15`：完成 `N4.01 ~ N4.05`。飞手侧新增 `eligibility` 分级准入口径，基础实名认证完成后即可参与候选需求，正式派单和执行能力按资料完整度渐进开放；飞手档案页、待接任务页和首页统一围绕“可接任务 / 执行中 / 资质进度”组织，不再要求飞手先理解整个平台。机主侧同步落地“先草稿、后资质”：机主档案页新增统一待处理工作台与服务草稿区，`PublishOfferScreen` 支持先保存草稿、等无人机基础资质、UOM、保险、适航达标后再上架；无人机详情页改成并行资质总览；需求详情页补上报价比较视图，方便客户横向比较价格、机型、响应时间。同步更新 [BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md) 中机主工作台与飞手分级准入说明。验证：`cd backend && GOCACHE=$(pwd)/.gocache go test ./internal/service -run 'Test(BuildPilotEligibilityViewAllowsCandidateDuringPendingVerification|BuildPilotEligibilityViewBlocksRejectedPilot|ApplyDemandCandidateAllowsPendingPilotWithBasicProfile)$'` 通过；`cd mobile && npx eslint src/screens/pilot/PilotProfileScreen.tsx src/screens/dispatch/PilotTaskListScreen.tsx src/screens/home/HomeScreen.tsx src/screens/owner/OwnerProfileScreen.tsx src/screens/drone/DroneDetailScreen.tsx src/screens/publish/PublishOfferScreen.tsx src/screens/demand/DemandDetailScreen.tsx` 通过。
- `2026-04-15`：完成 `N4.06 ~ N4.12`，阶段 4 收口完成。管理后台订单、需求、派单、飞行记录列表补上统计卡、导出能力和深度详情视图；机主工作台聚合新需求、待确认订单、待安排执行和服务草稿；需求发布时间选择改成显式选择并在编辑页沿用；空域相关用户可见文案与模型注释统一收口为“空域报备 / 飞行区域”；合同模板与签约页补入“设备操作责任条款”；订单确认页与详情页新增费用明细、平台佣金和实际到账展示；`v2_core_regression.sh` 扩展校验两条成单链路的合同自动生成、可见性与签署闭环。验证：`cd admin && npm run build` 通过；`cd backend && GOCACHE=$(pwd)/.gocache go test ./internal/service -run 'Test(GenerateContractForOrderCreatesContractAndIncludesTrustClause|ProviderAutoSignMarksContractFullySignedAfterClientSign|CompleteFlightRecordMarksRecordCompleted|CancelOrderWithRefundCreatesRefundRecord)$'` 通过；`cd mobile && npx eslint src/screens/order/ContractScreen.tsx src/screens/order/OrderDetailScreen.tsx src/screens/publish/PublishDemandScreen.tsx src/screens/publish/EditDemandScreen.tsx src/screens/airspace/AirspaceApplicationScreen.tsx src/screens/supply/SupplyDirectOrderConfirmScreen.tsx` 通过。
- `2026-04-15`：完成 `N5.01 ~ N5.04`，阶段 5 收口完成。`backend/internal/model/models.go` 已按领域拆分为多个模型文件；新增 [V1_RESIDUAL_INVENTORY.md](./V1_RESIDUAL_INVENTORY.md) 作为 v1 残留边界与迁移顺序清单，并把移动端默认 API 根路径切回 `/api`，避免新代码继续默认挂靠 v1；后端新增 `/healthz`、`/readyz`、数据库/Redis 就绪检查和慢查询日志收口，补充 [MINIMUM_OBSERVABILITY_RUNBOOK.md](../../backend/docs/MINIMUM_OBSERVABILITY_RUNBOOK.md)；移动端底部导航改为本地图形图标，统一 Web/Native 导航文案，并继续清理旧 `PublishOffer` 语义残留。验证：`bash -n backend/scripts/v2_core_regression.sh` 通过；`cd backend && GOCACHE=$(pwd)/.gocache go test ./internal/model ./cmd/server ./internal/api/v2/order ./internal/repository ./internal/service -run 'Test(BuildPilotEligibilityViewAllowsCandidateDuringPendingVerification|BuildPilotEligibilityViewBlocksRejectedPilot|ApplyDemandCandidateAllowsPendingPilotWithBasicProfile|GenerateContractForOrderCreatesContractAndIncludesTrustClause|ProviderAutoSignMarksContractFullySignedAfterClientSign|CompleteFlightRecordMarksRecordCompleted|BuildClientEligibilityViewAllowsVerifiedPersonalUser|BuildClientEligibilityViewBlocksPendingIdentityEvenIfLegacyClientVerified|BuildClientProfileViewUsesIdentityStatusAndExpandedFields|NormalizeExecutionStatusMapsLegacyLoading|ValidateExecutionStatusTransition|BuildExecutionStatusUpdates|FilterExecutionStatusUpdates|CancelOrderWithRefundCreatesRefundRecord)$'` 通过；`cd admin && npm run build` 通过；`cd mobile && npx eslint src/navigation/MainNavigator.tsx src/components/navigation/TabGlyph.tsx src/index.web.tsx src/screens/airspace/AirspaceApplicationScreen.tsx src/screens/drone/AddDroneScreen.tsx src/screens/drone/DroneCertificationScreen.tsx src/constants/index.ts` 通过（仅剩既有 inline-style warning，不阻塞）。
- `2026-04-15`：restart 复查补缺。修复 [backend/internal/pkg/sms/sms.go](../../backend/internal/pkg/sms/sms.go) 的编译阻塞后，整仓 `cd backend && GOCACHE=$(pwd)/.gocache go test ./...` 已通过；将 [PilotOrderExecutionScreen.tsx](../../mobile/src/screens/dispatch/PilotOrderExecutionScreen.tsx) 的派单关联订单读取从 legacy `dispatch.ts` 切到 `dispatchV2`，避免执行页与正式派单详情页继续分叉；同步收窄 `N4.10` 完成口径，仅按第一阶段责任条款与声明确认收口，并更新 [V1_RESIDUAL_INVENTORY.md](./V1_RESIDUAL_INVENTORY.md) 的残留描述。验证：`cd backend && GOCACHE=$(pwd)/.gocache go test ./...` 通过；`cd mobile && npx eslint src/screens/dispatch/PilotOrderExecutionScreen.tsx` 通过（仅剩 inline-style warning）；`cd admin && npm run build` 通过。
- `2026-04-15`：restart 复查补强。补齐 [owner_service_test.go](../../backend/internal/service/owner_service_test.go) 对机主工作台聚合视图的定向覆盖，验证推荐需求、待确认订单、待安排执行、服务草稿和机主档案自动创建都能稳定回归；新增 [main_test.go](../../backend/cmd/server/main_test.go) 覆盖 `/healthz`、`/readyz` 的 ready / degraded 场景；扩展 [ci_mobile_restart_lint.sh](../../scripts/ci_mobile_restart_lint.sh) 把阶段 4/5 关键页面纳入持续检查，包括机主档案、供给发布、飞手执行页、合同页和空域报备页。验证：`cd backend && GOCACHE=$(pwd)/.gocache go test ./internal/service ./cmd/server` 通过；`bash scripts/ci_mobile_restart_lint.sh` 通过（仅剩仓库既有 warning，不阻塞）；`cd admin && npm run build` 通过。
