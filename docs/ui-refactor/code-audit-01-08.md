# 01-08 设计页真实链路代码审计

审计日期：2026-05-23

审计范围：围绕已经落地的 8 张设计图，核对小程序主链路代码、已存在的移动端对照实现、前端服务层和后端接口能力。本文包含最初源码审计结论，以及 2026-05-23 本轮 P0 修复后的接口验收记录。

## 总结论

这 8 张图现在已经完成了视觉层还原，但业务链路不是同一水平：

- 客户首页、地址选择、空域检测、订单列表、正式报价页、订单详情等部分已经接了真实 `apiV2`。
- 03 已完成第一轮 P0 修正：普通进入时可选择“匹配真实服务商方案”或“发布真实需求等报价”；从供给详情/市场带 `supplyId` 进入时可直接创建真实订单。
- 小程序 04 已完成第一轮 P0 修正：接口失败/空结果不再显示假方案，选择真实供给会调用 `supplyService.createDirectOrder` 创建真实直达订单并进入 05。
- 服务商 07 已完成第一轮 P0 修正：接口空/失败不再显示假需求，“快速报价”只预填报价页，不再 toast 伪造成功；正式提交仍调用 `createQuote`。
- 06/08 已完成第一轮 P0 修正：服务商工作台指标和待办来自 `owner/workbench`，待办进入 08 时带 `orderId`；08 读取真实订单详情，服务商确认接单调用 `providerConfirm`。
- 05 已完成第一轮 P0 修正：无 `orderId`、未登录、接口失败或订单不存在时显示错误态，不再回退硬编码 `demoOrder`。
- 05 已完成第二轮链路修正：订单进度优先读取真实 `/orders/:id/timeline`；待支付订单会先进入真实合同签署页，合同 `fully_signed` 后再进入收银台。
- 08 已完成第二轮派单修正：履约页识别 `current_dispatch`，已有正式派单时进入“调整派单”；派单页读取合作飞手列表，已有派单走 `dispatchV2Service.reassign`，没有派单才走 `orderV2Service.dispatch`。
- `我要接单` 已补执行任务接收链路：工作台读取 `role=pilot` 的待响应派单，执行人员从同一模块进入任务详情并确认执行，不再作为第三个顶层模块处理。
- `我要接单` 已补执行状态推进链路：执行任务详情可按真实后端状态流转推进 `assigned -> preparing -> in_transit -> delivered`；客户侧 05 继续用真实 `confirmReceipt` 完成签收，订单最终进入 `completed`。
- 08 已补空域/现场复核与保险状态字段：后端订单摘要返回 `airspace_status`，无人机摘要返回保单字段；履约页不再用合同状态或固定文案伪装安全复核/保险状态。
- 支付页已补 mock/真实支付边界：小程序收银台不再把“创建支付单”直接提示成“支付成功”；后端新增 `payment.allow_mock`，生产校验会拒绝允许模拟支付的配置。
- 04 服务商卡片已补真实摘要字段：后端 `/supplies` 列表返回 `owner`、`drone`、服务区域、半径和更新时间；小程序不再使用本地三张静态服务商 logo、评分/接单量/ETA 假字段。
- 07 接单筛选已落到后端：`/owner/demands/recommended` 支持 region、weight range、schedule window、cargo_scene、sort；小程序筛选/价格排序会重新请求接口。
- 07 距离字段已补真实计算：后端按需求起吊点/服务点坐标与服务商可用供给无人机坐标计算 `distance_km`，`sort=distance` 可按距离排序；算不出坐标时继续显示“距离待计算”。
- 04 服务商方案卡已补真实距离标签：后端 `/supplies` 的 `drone` 摘要返回经纬度，小程序仅在快速下单草稿和无人机都有坐标时展示“距起吊点 Xkm”。
- 04/07 服务覆盖状态已补真实口径：后端用供给服务半径和无人机最大航程的保守值生成 `service_range_km` / `service_coverage_status`；小程序只在有坐标和半径依据时展示“可覆盖/超半径”或“可服务/超半径/待确认”。
- 04/07 ETA 与响应时长已补第一轮真实契约：后端/前端只在有距离、无人机最大航程和最大飞行时长且未超半径时展示 `estimated_arrival_minutes`；07 已报价需求返回 `my_quote` 和 `quote_response_seconds`，未报价时不伪造响应速度。
- 04 供给侧历史统计已补真实聚合：后端 `/supplies` 返回 `stats.total_order_count`、`completed_order_count`、`average_response_seconds`、`rating`、`rating_count`；小程序只在有真实订单/评价样本时展示评分、完成单量和平均响应。
- 05 已补真实评价入口：完成态订单的主按钮进入 `/pages/review/index`；评价页读取订单参与方和历史评价，提交时使用真实 `target_user_id/target_role`，不再写死评价对象。
- 08 已补现场复核/保单更新动作：后端新增订单现场复核接口，08 安全检查行可写入 `airspace_status=approved` 和订单时间线；08 保险行进入订单无人机保险表单，保单提交字段已对齐后端。
- 08 已补现场复核证据闭环：新增 `order_site_safety_checks` 记录表和复核清单/照片接口，小程序 08 安全检查行进入专门复核页，清单未全选或未上传照片时不能提交，提交后订单详情返回 `site_safety_check`。
- 08 已补保单审核留痕：无人机保险资料提交会重置旧审核结果；后台审核会记录审核人、审核时间和驳回原因；08 保险状态未通过时展示真实驳回原因。
- 08/05 已补结算明细真实链路：完成态订单会读取 `/orders/:id/settlement`，08 费用卡优先展示客户实付、平台服务费和真实服务方分账，05 完成态订单展示结算单号、飞手劳务、设备服务费和结算状态。
- 后端结算已修正派单参与方归属：`pilot_user_id` 使用 `executor_pilot_user_id`，`owner_user_id` 使用服务商/机主用户，`payer_user_id` 使用客户用户；旧的 `pending/calculated` 结算在读取时会按当前订单参与方自动修正，避免把飞手资料 ID 当用户 ID 分账。
- 订单完成后的结算入账闭环已补齐：客户签收完成后会自动确认并执行结算，飞手/机主钱包分别入账；已入账结算重复执行会直接返回当前状态，避免重复加钱。
- 结算后台操作已收紧到管理员路由；服务商/飞手/客户只保留结算查询、钱包流水和提现申请入口。
- 小程序个人中心已补“我的钱包”入口，服务商/执行人员可直接查看结算入账、钱包流水和提现记录。
- 结算入账通知已接入消息中心：签收后自动结算成功时会给客户、服务商/机主、执行飞手写入系统通知；服务商/飞手点击结算通知可直达钱包。
- 提现/对账状态机已完成代码加固并通过重启后 live smoke：提现申请、冻结余额、审核通过扣减冻结余额、审核驳回解冻余额均改为事务化处理；后端补提现方式和收款账号校验，最低提现调整为 2 元以避免扣完最低手续费后实际到账为 0。
- 异常结算人工处理已完成第一轮代码加固并通过重启后 live smoke：管理员可把未入账结算标记为 `disputed` 阻止执行，可解除争议并手工调整平台费、飞手费、设备服务费和保险代扣；系统校验分账合计必须等于订单实付金额。
- 对账导出已完成第一轮代码落地并通过 live smoke：管理员可按状态、日期范围和时间字段导出结算 CSV、提现 CSV，字段保留分为单位，避免财务对账时发生小数精度歧义；结算导出已验证 `time_field=settled_at` 口径，可按实际入账时间对账。
- 管理员侧财务可视化和动作闭环已完成第一轮落地：后台结算/提现页面读取真实列表，支持状态、日期和时间字段筛选，结算确认、争议、解除争议、执行入账，以及提现审核通过/驳回均已接真实接口并通过重启后 live smoke。
- 管理员财务动作审计已完成第一轮代码落地：`/settlement/admin/...` 真实财务路由会向 `admin_logs` 写入模块、动作、目标、管理员、来源 IP 和关键金额快照；后台操作日志页可按模块、动作、目标类型、目标 ID、管理员 ID 过滤。
- 结算入账幂等和事务边界已完成第一轮代码加固：飞手入账、机主入账和结算状态更新纳入同一个结算事务；钱包收入流水按结算单、用户、类型和描述做幂等保护，避免部分入账后重试重复打钱。
- 财务异常告警已完成第一轮代码落地并通过重启后 live 验证：结算入账失败、争议分账合计错误、提现审核事务失败会写入 `finance_anomaly_records`；后台新增“财务异常”列表，可按状态、级别、类型、结算 ID、提现 ID、用户 ID 查询并标记处理。
- 财务人工处理记录已完成第一轮代码落地并通过重启后 live 验证：争议标记、争议解除、财务异常处理会写入 `finance_manual_action_records`，保存处理前后快照；后台新增“人工处理”列表，未入账且未被后续变更覆盖的处理可回滚。
- 财务运营概览已完成第一轮代码落地并通过重启后 live 验证：后台新增“财务概览”，聚合结算待办、今日结算金额、提现待审、异常未处理和人工处理回滚指标，作为财务运营入口页。

因此，01-08 的主链路已经推进到“完成签收 -> 结算入账 -> 钱包可查 -> 消息可达 -> 提现可审 -> 异常结算可人工处理 -> 对账可导出 -> 管理员可视化处理 -> 财务动作可审计 -> 入账重试幂等 -> 财务异常可查询可处理 -> 人工处理可审计可回滚 -> 财务概览可观测”。下一步应继续做“生产化收口”，优先补真实支付以外的运营报表、权限收敛和生产配置检查。

## 本轮落地与验收

已完成代码落地：

- 03：`mini-program/src/pages/publish/quick-order/index.tsx` 复用同一份快速预约表单数据，新增真实需求发布分支和带 `supplyId` 的直达下单分支；原“匹配服务商方案”仍进入 04，但后续 04 已改为真实供给列表和真实下单；从服务市场直接进入且没有首页预填重量时，可在“载重匹配”格补选重量。
- 04：`mini-program/src/pages/supply/list/index.tsx` 移除生产态假方案回退，选择真实供给后构造 `DirectOrderInput` 并调用 `supplyService.createDirectOrder`。
- 05：`mini-program/src/pages/orders/detail/index.tsx` 移除 `demoOrder` 兜底，只展示真实 `orderV2Service.get(orderId)` 返回的订单。
- 05：`mini-program/src/pages/orders/detail/index.tsx` 新增真实 timeline 读取和“签署合同/去支付”入口判断；`mini-program/src/pages/orders/contract/index.tsx` 接入真实合同读取和签署接口；`mini-program/src/services/orderFinanceV2.ts` 新增 `getContract`、`signContract`。
- 06：`mini-program/src/pages/home/ProviderWorkbench.tsx` 改为同时读取 `homeService.getDashboard()` 和 `ownerService.getWorkbench()`；真实 0 不再被 fallback 假数覆盖，待办列表来自后端。
- 07：`mini-program/src/pages/demand/list/index.tsx` 移除 `fallbackDemands`，缺字段显示待补/待确认；`mini-program/src/pages/demand/quote/index.tsx` 支持快速报价预填；客户需求详情可展示报价并调用 `selectProvider` 生成订单。
- 08：`mini-program/src/pages/fulfillment/hub/index.tsx` 支持 `orderId`，无 `orderId` 时从 `owner/workbench` 取第一条待确认/待派单订单；订单号、地址、重量、时间、金额、无人机、执行人都来自订单详情；确认接单调用 `orderV2Service.providerConfirm(orderId)`。
- 08：`mini-program/src/pages/fulfillment/hub/index.tsx` 根据 `current_dispatch` 展示待飞手确认/已确认等真实派单状态；`mini-program/src/pages/dispatch/create/index.tsx` 读取合作飞手绑定，已有派单自动切到重派链路，不再要求用户手填目标飞手 ID。
- 06/执行任务：`mini-program/src/pages/home/ProviderWorkbench.tsx` 同时读取 `dispatchV2Service.list({ role: 'pilot' })`，把待确认执行任务并入 `我要接单` 工作台；`mini-program/src/pages/dispatch/list/index.tsx` 支持 `role=pilot` 显式进入“执行任务”；`mini-program/src/pages/dispatch/detail/index.tsx` 将响应动作改为“确认执行/拒绝”，确认后调用真实 `dispatchV2Service.accept`。
- 执行推进：`mini-program/src/pages/dispatch/detail/index.tsx` 在执行任务详情中按订单状态展示下一步按钮，分别调用 `updateExecutionStatus(orderId, 'preparing' | 'in_transit' | 'delivered')`。
- 08 空域/保险：`backend/internal/api/v2/order/handler.go` 在订单摘要中返回 `airspace_status`，在无人机摘要中返回 `insurance_policy_no`、`insurance_company`、`insurance_coverage`、`insurance_expire_date`、`insurance_verified`；`mini-program/src/pages/fulfillment/hub/index.tsx` 的“空域 / 安全检查”和“保险状态”改为根据这些字段生成状态标签与描述。
- 支付页：`mini-program/src/pages/payment/index.tsx` 只在微信开发版/体验版展示模拟支付；微信/支付宝创建待回调支付单后展示“支付单已创建”，只有后端返回 `paid/auto_completed` 才提示支付成功并回订单详情。
- 支付后端：`backend/internal/service/payment_service.go` 增加模拟支付开关，`backend/internal/config/config.go` 的生产校验禁止 `payment.allow_mock=true`，`backend/config.example.yaml` 默认关闭模拟支付。
- 评价入口：`mini-program/src/pages/orders/detail/index.tsx` 在订单 `completed` 后把主按钮改为“评价订单”；`mini-program/src/pages/review/index.tsx` 拉取 `orderV2Service.get(orderId)` 与 `orderFinanceV2Service.listReviews(orderId)`，按订单参与方生成客户、承接方、执行飞手评价对象，提交时调用真实 `createReview`。
- 08 动作：`backend/internal/api/v2/order/handler.go` 新增 `ConfirmSiteSafety`，`backend/internal/service/order_service.go` 新增 `ConfirmSiteSafetyCheck`；`mini-program/src/pages/fulfillment/hub/index.tsx` 的“空域 / 安全检查”改为确认现场复核，“保险状态”改为查看/更新订单无人机保单；`mini-program/src/pages/drone/certification/index.tsx` 支持直接打开保险 tab，并修正保险提交字段。
- 08 现场证据：`backend/internal/model/order_misc.go` 新增 `OrderSiteSafetyCheck`，`/api/v2/orders/:id/site-safety-checks` 支持提交清单、照片和备注，`/latest` 支持回看最近一次复核；`mini-program/src/pages/fulfillment/safety-check/index.tsx` 新增现场复核页，复用 `/drone/upload` 上传现场照片。
- 08 保单审核：`backend/internal/model/drone_supply.go` 新增 `insurance_reviewed_at`、`insurance_reviewed_by`、`insurance_reject_reason`；后台 `/api/v2/admin/drones/:id/insurance` 支持 `reason`，驳回时必须填写原因；订单无人机摘要和服务商 08 页面会透出驳回原因。
- 08/05 结算明细：`backend/internal/service/settlement_service.go` 将订单结算参与方改为真实用户 ID，并允许 `pending/calculated` 结算在读取时自动修正；`mini-program/src/pages/fulfillment/hub/index.tsx` 与 `mini-program/src/pages/orders/detail/index.tsx` 接入 `orderFinanceV2Service.getSettlement(orderId)`，完成态订单不再使用设计稿静态费用。
- 结算入账：`backend/internal/service/settlement_service.go` 新增 `FinalizeOrderSettlement` / `FinalizeSettlement`，订单完成后可创建、确认并执行同一张结算单；`backend/internal/service/order_service.go` 在客户签收完成后触发结算入账，并写入订单时间线。
- 钱包入口：`mini-program/src/pages/profile/index.tsx` 对服务商/执行人员展示“我的钱包”，进入已有 `/pages/settlement/wallet/index`，查看钱包余额、流水、关联结算和提现。
- 结算权限：`backend/internal/api/v2/router.go` 将创建、确认、执行、提现审核、计价配置等结算管理接口统一放到 `AdminMiddleware` 后；普通登录用户仅能访问自己的结算、钱包和提现申请。
- 结算通知：`backend/internal/service/event_service.go` 新增 `NotifySettlementSettled` 和推送 allowlist 事件 `settlement_settled`；`backend/internal/service/order_service.go` 在自动结算入账成功后触发消息；`mini-program/src/pages/messages/index.tsx` 新增“结算入账”分组，服务商/飞手结算通知点击进入钱包。
- 提现状态机：`backend/internal/repository/settlement_repo.go` 新增仓储事务入口；`backend/internal/service/settlement_service.go` 将 `RequestWithdrawal`、`ApproveWithdrawal`、`RejectWithdrawal` 改为资金状态和提现记录同事务更新；`mini-program/src/pages/settlement/withdrawal/index.tsx` 将最低提现提示与后端口径统一为 2 元。
- 异常结算：`backend/internal/service/settlement_service.go` 新增 `MarkSettlementDisputed` / `ResolveSettlementDispute`，`backend/internal/api/v2/longtail/settlement/handler.go` 暴露管理员争议处理接口，`backend/internal/api/v2/router.go` 增加 `/api/v2/settlement/admin/:id/dispute` 与 `/api/v2/settlement/admin/:id/resolve-dispute`；同时修复钱包流水号生成，避免同一结算内两条入账流水撞唯一索引。
- 对账导出：`backend/internal/repository/settlement_repo.go` 新增结算/提现导出查询；`backend/internal/service/settlement_service.go` 生成对账 CSV；`backend/internal/api/v2/longtail/settlement/handler.go` 与 `backend/internal/api/v2/router.go` 新增 `/api/v2/settlement/admin/export/settlements` 和 `/api/v2/settlement/admin/export/withdrawals`。
- 财务异常：`backend/migrations/116_create_finance_anomaly_records.sql` 新增异常记录表；`backend/internal/service/settlement_service.go` 在结算执行、争议解除和提现审核失败时写入异常记录；`backend/internal/api/v2/longtail/settlement/handler.go` 与 `backend/internal/api/v2/router.go` 新增 `/api/v2/settlement/admin/anomalies` 和 `/api/v2/settlement/admin/anomalies/:id/resolve`；`admin/src/pages/LongTail/AdminResourcePages.tsx` 和 `admin/src/App.tsx` 新增后台“财务异常”页面。
- 财务人工处理：`backend/migrations/117_create_finance_manual_action_records.sql` 新增人工处理记录表；`backend/internal/service/settlement_service.go` 在争议标记、争议解除、异常处理成功时写入处理前后快照，并新增 `RollbackFinanceManualAction`；`backend/internal/api/v2/longtail/settlement/handler.go` 与 `backend/internal/api/v2/router.go` 新增 `/api/v2/settlement/admin/manual-actions` 和 `/api/v2/settlement/admin/manual-actions/:id/rollback`；`admin/src/pages/LongTail/AdminResourcePages.tsx` 和 `admin/src/App.tsx` 新增后台“人工处理”页面。
- 财务概览：`backend/internal/repository/settlement_repo.go` 新增结算、提现、异常和人工处理聚合统计；`backend/internal/service/settlement_service.go` 新增 `GetFinanceOperationsOverview`；`backend/internal/api/v2/longtail/settlement/handler.go` 与 `backend/internal/api/v2/router.go` 新增 `/api/v2/settlement/admin/overview`；`admin/src/pages/LongTail/AdminResourcePages.tsx` 和 `admin/src/App.tsx` 新增后台“财务概览”页面。

接口验收记录：

- 本地后端健康检查通过：`http://127.0.0.1:8080/healthz`。
- 客户账号 `13800000004` 创建真实直达订单成功：`order_id=38`，`order_no=WRJ1779506792930`，供给 `supply_id=13`，初始状态 `pending_provider_confirmation`。
- 服务商账号 `13900000017` 的 `owner/workbench` 能看到该订单；调用 `/api/v2/orders/38/provider-confirm` 后订单推进到 `pending_payment`，`provider_confirmed_at=2026-05-23T11:31:42+08:00`。
- 客户账号 `13800000004` 创建并发布真实需求 `demand_id=38`；服务商账号 `13900000017` 在推荐需求接口能看到该需求，使用无人机 `19` 提交真实报价 `quote_id=15`；客户选中报价后生成订单 `order_id=39`、`order_no=WRJ1779507560266`，订单状态 `pending_payment`。
- 后端重启后复核通过：客户账号 `13800000004` 创建并发布真实需求 `demand_id=40`；服务商账号 `13800000007` 在 `/owner/demands/recommended` 能看到 `cargo_weight_kg=87`、`cargo_type=复核建材`、`cargo_special_requirements=重启后字段复核`、预算字段，说明新增推荐需求字段已在运行服务生效。
- 服务商账号 `13800000007` 使用无人机 `22` 提交真实报价 `quote_id=16`；客户选中报价生成订单 `order_id=40`、`order_no=WRJ1779509280646`、状态 `pending_payment`。
- 订单 `40` 直接模拟支付被后端拒绝，提示“请先完成双方合同签署后再支付”；随后客户签署合同、服务方签署合同，合同进入 `fully_signed`，订单 `payment_ready=true`；模拟支付成功后订单推进到 `pending_dispatch`，timeline 返回 8 条真实事件。
- 订单 `40` 的履约派单复核通过：支付后订单为 `pending_dispatch`，后端返回 `current_dispatch_id=15`、`target_pilot_user_id=16`、飞手“赵飞手”；调用 `/dispatch-tasks/15/reassign` 后生成新派单 `16`，订单仍为 `pending_dispatch`，`current_dispatch_id=16`，说明 08 的“已有派单 -> 调整派单/重派”链路可用。
- 执行任务接收复核通过：执行人员账号 `13900000016` 在 `/dispatch-tasks?role=pilot` 看到派单 `16`；调用 `/dispatch-tasks/16/accept` 后派单从 `pending_response` 变为 `accepted`，订单 `40` 从 `pending_dispatch` 推进到 `assigned`，`current_dispatch_status=accepted`。
- 执行状态推进复核通过：执行人员账号 `13900000016` 对订单 `40` 依次调用 `/orders/40/execution-status`，订单从 `assigned -> preparing -> in_transit -> delivered`；客户账号 `13800000004` 调用 `/orders/40/confirm-receipt` 后订单进入 `completed`，`current_dispatch_status=completed`。
- 05 订单进度 timeline 复核通过：`/orders/40/timeline` 返回 20 条事件，包含“执行人已开始准备”“无人机已起飞，订单执行中”“已到达目的地，完成投送”“客户已确认签收”等节点。
- `npm run build:weapp` 通过；仅剩既有 Sass `@import` 弃用警告，涉及 `cargo/accept` 和 `drone/edit`。
- 03 改造后再次执行 `npm run build:weapp` 通过；仍只有上述既有 Sass `@import` 弃用警告。
- 05 timeline/合同页改造后再次执行 `npm run build:weapp` 通过；仍只有上述既有 Sass `@import` 弃用警告。
- 08 派单页改造后再次执行 `npm run build:weapp` 通过；仍只有上述既有 Sass `@import` 弃用警告。
- `我要接单` 执行任务入口改造后再次执行 `npm run build:weapp` 通过；仍只有上述既有 Sass `@import` 弃用警告。
- 执行状态推进按钮改造后再次执行 `npm run build:weapp` 通过；仍只有上述既有 Sass `@import` 弃用警告。
- 08 空域/保险字段改造后再次执行 `npm run build:weapp` 通过；仍只有上述既有 Sass `@import` 弃用警告。
- `go test ./internal/api/v2/owner ./internal/service` 通过。
- 08 空域/保险字段改造后执行 `go test ./internal/api/v2/order ./internal/service` 通过。
- 支付 mock/真实边界改造后执行 `npm run build:weapp` 和 `npm run build:weapp:prod` 均通过；仍只有上述既有 Sass `@import` 弃用警告。
- 支付 mock/真实边界改造后执行 `go test ./internal/config ./internal/service ./internal/api/v2/payment ./cmd/server` 通过。
- 04/07 距离与覆盖状态改造后执行 `go test ./...`、`npm run build:weapp`、`npm run build:weapp:prod` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 04/07 ETA 与报价响应字段改造后执行 `go test ./internal/service -run TestOwnerServiceListRecommendedDemandsSortsByOwnerSupplyDistance`、`go test ./...`、`npm run build:weapp`、`npm run build:weapp:prod` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 04 供给侧历史统计改造后执行 `go test ./internal/repository -run TestOwnerDomainRepoGetMarketplaceSupplyStatsAggregatesOrdersAndReviews`、`go test ./...`、`npm run build:weapp`、`npm run build:weapp:prod` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 评价入口改造后执行 `npm run build:weapp`、`npm run build:weapp:prod`、`git diff --check` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 08 现场复核/保单更新动作改造后执行 `go test ./internal/service -run 'TestConfirmSiteSafetyCheck|TestBuildExecutionStatusUpdates|TestValidateExecutionStatusTransition'`、`go test ./...`、`npm run build:weapp`、`npm run build:weapp:prod`、`git diff --check` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 08 现场复核证据闭环改造后执行 `go test ./internal/service -run 'TestSubmitSiteSafetyCheck|TestConfirmSiteSafetyCheck'`、`go test ./...`、`npm run build:weapp`、`npm run build:weapp:prod`、`git diff --check` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 重启后现场复核证据接口 smoke 复核：`/api/v2/drone/upload` 成功返回 `/uploads/drone/1779524089813_d12a93b5.png`；订单 `37` 调用 `/api/v2/orders/37/site-safety-checks` 成功生成复核记录 `id=1`；随后 `/api/v2/orders/37` 返回 `airspace_status=approved` 且 `site_safety_check.id=1`、照片数 1、清单数 3。
- 本次复核发现 `AutoMigrate` 错误不可见且新表缺少正式 SQL 迁移，已补 `backend/migrations/114_create_order_site_safety_checks.sql`；随后重启暴露 GORM 会尝试删除被外键依赖的 `client_profiles.user_id` 索引，因此服务启动路径已停止执行全量 `AutoMigrate`，后续结构变更以 `backend/migrations` 的显式 SQL 迁移为准。
- 重启后“我要接单侧”执行人员接单 smoke 复核：执行人员账号 `13900000016` 调用 `/api/v2/dispatch-tasks/14/accept` 成功，正式派单 `14` 状态变为 `accepted`，订单 `37` 回查为 `status=assigned`、`dispatch_task_id=14`、`executor_pilot_user_id=16`、`current_dispatch.status=accepted`。
- 小程序“我要接单侧”已补执行人员待确认入口：接单首页顶部显示 `/api/v2/dispatch-tasks?role=pilot&status=pending_response` 的待确认派单数，进入 `dispatch/list` 后可直接接受或拒绝；接受成功后跳转 08 履约安排页，详情页底部也提供“履约安排”入口。
- 小程序开发者工具真实链路复核：服务商账号 `13800000007` 为订单 `35` 创建待确认派单 `17`（`DP20260523173515173000`），执行人员样本 `13900000016` 登录“我要接单”后看到待确认派单数 `1`，从“待确认派单”进入 `dispatch/list` 点击“接受并履约”后跳转 08 `fulfillment/hub`；后端回查派单 `17` 为 `status=accepted`，订单 `35` 为 `status=assigned`、`dispatch_task_id=17`、`executor_pilot_user_id=16`、`current_dispatch.status=accepted`。
- 订单 `35` 履约后半段 API 复核：执行人员 `13900000016` 依次调用 `/orders/35/execution-status` 将状态推进为 `preparing -> in_transit -> delivered`，订单写入 `flight_start_time/loading_confirmed_at` 和 `flight_end_time/unloading_confirmed_at`；客户 `13800000004` 调用 `/orders/35/confirm-receipt` 后订单进入 `completed`，派单 `17` 自动归档为 `completed`，订单时间线出现 `preparing`、`in_transit`、`delivered`、客户签收和派单完成事件；客户 completed 订单列表和执行人员 completed 派单列表均能查到订单/派单。
- 保单审核留痕改造后执行 `go run ./cmd/migrate -include 115` 成功，重复执行同一迁移也成功；`go test ./internal/service -run 'TestSubmitInsurance|TestApproveInsurance'`、`go test ./internal/api/v2/order ./internal/service`、`go test ./...`、`npm run build:weapp`、`npm run build:weapp:prod`、`git diff --check` 均通过；仍只有既有 Sass `@import` 弃用警告。
- 结算归属改造后新增单测覆盖：`TestCreateSettlementUsesExecutionUserIDs` 证明订单 `PilotID=5`、`ExecutorPilotUserID=16` 时结算写入 `pilot_user_id=16`；`TestCalculatedSettlementIsRepairedOnRead` 证明旧 `calculated` 结算会保留原结算单号并把 `pilot_user_id` 修回 16。
- 结算归属与前端接入改造后执行 `go test ./internal/service ./internal/api/v2/settlement ./cmd/server`、`npm run build:weapp` 均通过；小程序构建仍只有既有 Sass `@import` 弃用警告。
- 重启后结算 live smoke 通过：客户 `13800000004`、服务商 `13800000007`、执行人员 `13900000016` 查询订单 `35` 的 `/api/v2/orders/35/settlement` 均返回同一张结算单 `STL17795296590938000`；旧 `calculated` 结算已自动修正为 `pilot_user_id=16`、`owner_user_id=7`、`payer_user_id=4`，金额为 `final_amount=168000`、`platform_fee=16800`、`pilot_fee=75600`、`owner_fee=67200`、`insurance_deduction=8400`。
- 结算入账改造后新增单测覆盖：`TestFinalizeOrderSettlementCreditsWalletsOnce` 证明订单结算会给飞手钱包入账 `75600`、机主钱包入账 `67200`，重复执行不会重复生成流水；`TestConfirmReceiptFinalizesSettlementWalletIncome` 证明客户签收完成后会自动生成 settled 结算、写钱包并写入 `settled` 时间线。
- 结算入账改造后执行 `go test ./internal/service -run 'Test(FinalizeOrderSettlementCreditsWalletsOnce|ConfirmReceiptFinalizesSettlementWalletIncome|CreateSettlementUsesExecutionUserIDs|CalculatedSettlementIsRepairedOnRead)$'`、`go test ./internal/api/v2/settlement ./cmd/server`、`npm run build:weapp` 均通过；小程序构建仍只有既有 Sass `@import` 弃用警告。
- 重启前曾先用旧管理员接口完成订单 `35` 的结算执行 smoke：结算单 `STL17795296590938000` 已变为 `settled`；执行人员 `13900000016` 钱包 `available_balance=75600`、`total_income=75600`，服务商 `13800000007` 钱包 `available_balance=67200`、`total_income=67200`，两侧流水均关联订单 `35` 和结算 `4`。
- 重启后结算运行态复核通过：执行人员 `13900000016` 调用 `/api/v2/settlement/admin/execute/4` 返回 `403 admin access required`；管理员重复执行已入账结算 `4` 返回 `settled`，钱包余额和订单 `35` 的流水没有重复增加。
- 重启后自动入账 live smoke 通过：客户 `13800000004` 签收已有 `delivered` 订单 `36` 后，系统自动生成结算单 `STL17795315332519000`，状态 `settled`，`pilot_user_id=16`、`owner_user_id=7`、`payer_user_id=4`；执行人员钱包新增 `71100`，服务商钱包新增 `63200`，订单时间线写入 `settled` 节点“结算已入账：飞手¥711.00，机主¥632.00”。
- 结算通知改造后新增测试覆盖：`TestConfirmReceiptFinalizesSettlementWalletIncome` 继续证明签收后自动入账，并额外断言客户、服务商、执行飞手均收到 `settlement_settled` 系统通知；`TestShouldSendPushEvent` 覆盖 `settlement_settled` 会进入推送 allowlist。
- 结算通知改造后执行 `go test ./internal/service -run 'Test(ConfirmReceiptFinalizesSettlementWalletIncome|ShouldSendPushEvent)$'`、`go test ./internal/service ./internal/api/v2/notification ./cmd/server`、`npm run build:weapp`、`git diff --check` 均通过；小程序构建仍只有既有 Sass `@import` 弃用警告。
- 重启后结算通知 live smoke 通过：订单 `37` 由执行人员 `13900000016` 推进 `preparing -> in_transit -> delivered` 后，客户 `13800000004` 签收生成结算单 `STL17795360880684000`，状态 `settled`；客户收到“订单结算已完成”通知，执行飞手收到“飞手劳务费¥756.00已入账”，服务商/机主 `13800000007` 收到“设备服务费¥672.00已入账”，三条通知的 `business_type=settlement`、`event_type=settlement_settled`，服务商/飞手通知携带 `next_action=wallet`。
- 提现/对账改造后新增测试覆盖：`TestWithdrawalApproveDeductsFrozenBalanceAtomically` 证明申请提现会冻结余额、审核通过会扣减冻结余额并写 `deduct` 流水；`TestWithdrawalRejectUnfreezesBalance` 证明驳回会解冻余额并写回驳回原因；`TestWithdrawalValidation` 覆盖最低金额、非法方式和收款账号必填校验。
- 提现/对账改造后执行 `go test ./internal/service -run 'Test(Withdrawal|FinalizeOrderSettlementCreditsWalletsOnce|ConfirmReceiptFinalizesSettlementWalletIncome)$'`、`go test ./internal/service ./internal/api/v2/settlement ./cmd/server`、`npm run build:weapp`、`git diff --check` 均通过；小程序构建仍只有既有 Sass `@import` 弃用警告。
- 重启后提现 live smoke 通过：执行人员 `13900000016` 提现 `WD17795375896405000`，金额 `20000`、手续费 `100`、实际到账 `19900`；管理员审核通过后记录为 `completed`，`third_party_no=MOCK_WD17795375896405000`，钱包为 `available_balance=202300`、`frozen_balance=0`、`total_withdrawn=20000`，流水包含 `freeze` 和 `deduct`。服务商/机主 `13800000007` 提现 `WD17795376299634000`，金额 `30000`、手续费 `100`、实际到账 `29900`；管理员驳回后记录为 `rejected`，`review_notes=账户信息待复核`，钱包恢复为 `available_balance=197600`、`frozen_balance=0`、`total_withdrawn=0`，流水包含 `freeze` 和 `unfreeze`。
- 重启后提现权限与校验 live smoke 通过：执行人员访问 `/api/v2/settlement/admin/withdrawals/pending` 返回 `403`；最低提现 `100` 分返回“最低提现金额为2元”，非法提现方式返回“不支持的提现方式”，支付宝缺账号返回“请输入支付宝账号”，驳回缺原因返回“请填写驳回原因”。
- 异常结算改造后新增测试覆盖：`TestSettlementDisputeResolutionAllowsManualFeeAdjustment` 证明争议状态会阻止结算入账，错误分账合计会被拒绝，解除争议后可按人工复核金额给飞手/机主入账。
- 异常结算改造后执行 `go test ./internal/service -run 'TestSettlementDispute|TestFinalizeOrderSettlementCreditsWalletsOnce|TestWithdrawal'`、`go test ./internal/api/v2/settlement ./cmd/server` 通过。
- 重启后异常结算 live smoke 通过：历史结算 `STL17762594765099000` 先经 `/settlement/order/25` 修正参与方为 `pilot_user_id=17`、`owner_user_id=7`；执行人员访问 `/settlement/admin/3/dispute` 返回 `403`；管理员标记争议后结算进入 `disputed`，此时执行入账返回“结算存在争议”；错误人工分账合计 `199000` 对实付 `198000` 被拒；管理员解除争议并调整为 `platform_fee=20000`、`pilot_fee=90000`、`owner_fee=78000`、`insurance_deduction=10000` 后执行入账成功，结算状态变为 `settled`，飞手 `13900000017` 钱包从 `0` 入账到 `90000`，机主 `13800000007` 钱包从 `197600` 入账到 `275600`，两条入账流水均关联 `settlement_id=3` 且流水号不重复。
- 对账导出改造后新增测试覆盖：`TestReconciliationCSVExportsFilterByStatusAndDate` 证明结算 CSV 和提现 CSV 都会按状态、日期范围过滤，并输出财务对账所需金额字段；同测例额外覆盖 `time_field=settled_at` 可按实际入账时间导出结算。
- 对账导出改造后执行 `go test ./internal/service -run 'Test(ReconciliationCSVExports|SettlementDispute|Withdrawal)'`、`go test ./internal/service ./internal/api/v2/settlement ./cmd/server`、`git diff --check` 通过。
- 重启后对账导出基础 live smoke 通过：管理员导出 `/settlement/admin/export/settlements?status=settled&start_date=2026-04-01&end_date=2026-05-23&limit=20` 返回 `text/csv`，文件名 `settlements_*.csv`，共 4 行数据，包含结算 `STL17762594765099000`，状态 `settled`、飞手劳务 `90000`、设备服务费 `78000`；管理员导出 `/settlement/admin/export/withdrawals?status=completed&start_date=2026-05-01&end_date=2026-05-23&limit=20` 返回提现 `WD17795375896405000`，金额 `20000`、实际到账 `19900`、第三方流水 `MOCK_WD17795375896405000`；非法日期返回 `400 开始日期格式错误`，普通执行人员导出返回 `403`。
- 重启后 `time_field` 导出 live smoke 通过：管理员导出 `/settlement/admin/export/settlements?status=settled&time_field=settled_at&start_date=2026-05-23&end_date=2026-05-23&limit=20` 返回 4 行结算，包含 `STL17762594765099000`，其 `created_at=2026-04-15T21:24:36+08:00`、`settled_at=2026-05-23T20:39:48+08:00`、飞手劳务 `90000`、设备服务费 `78000`；同日期 `time_field=created_at` 导出不包含该旧创建结算，证明入账时间口径已生效。提现导出 `/settlement/admin/export/withdrawals?status=completed&time_field=completed_at&start_date=2026-05-23&end_date=2026-05-23&limit=20` 返回 `WD17795375896405000`，金额 `20000`、实际到账 `19900`、完成时间 `2026-05-23T20:00:29+08:00`；非法日期仍返回 `400 开始日期格式错误`，普通执行人员导出仍返回 `403`。
- 重启后管理员财务可视化 smoke 通过：`EXPECT_FINANCE_SAMPLE=1 ./scripts/admin_finance_smoke.sh` 验证管理员 `13800000001` 登录、结算列表、提现列表、结算/提现 CSV、非法日期 `400`、普通执行人员 `13900000016` 访问管理员导出和提现列表均返回 `403`；按 `time_field=settled_at/completed_at` 和日期 `2026-05-23` 查询到结算 `4` 条、提现 `1` 条，CSV 分别为 `5` 行和 `2` 行，报告写入 `backend/docs/admin_finance_smoke_last_run.json`。
- 管理员财务页面级验证通过：临时启动 admin dev 服务后，管理员登录进入 `/finance/settlements`，页面按“已结算 + 入账时间 + 2026-05-23”筛选后显示 `共 4 条`，点击“下载对账CSV”提示 `CSV 已生成`；进入 `/finance/withdrawals`，按“已完成 + 完成时间 + 2026-05-23”筛选后显示 `共 1 条` 且命中 `WD17795375896405000`，点击“下载对账CSV”提示 `CSV 已生成`。验证过程中发现本地 `admin/.env` 仍指向 `/api/v1` 会导致前端 CSV 请求 `404`，已将本机 `.env` 改为 `/api/v2`，并在 `admin/src/services/api.ts` 增加本地开发保护，避免 localhost 管理端误走 v1。
- 管理员财务动作级验证通过：创建两笔执行人员 `13900000016` 的 ¥2.00 测试提现，管理员通过 `WD17795852469512000` 后记录进入 `completed` 且生成 `MOCK_WD17795852469512000`，管理员拒绝 `WD17795852469691000` 后记录进入 `rejected` 且保留驳回原因 `admin page action smoke reject`。结算动作验证使用小金额旧测试结算 `STL17735837636554000` 时暴露 repository 边界问题：结算更新时会随预加载订单一起保存，旧订单的 `0000-00-00` 日期触发 MySQL `Incorrect datetime value`；已将 `UpdateSettlement` 改为 `Omit(clause.Associations).Save`，只保存结算表本身。后端重启后重跑结算确认、争议、解除争议、执行入账通过，结算进入 `settled`，飞手 `13800000005` 钱包新增 `3294` 分收入流水，机主 `13900000016` 钱包新增 `2928` 分收入流水，两条流水均关联 `settlement_id=1` 和订单 `DO20260307130637047938`。
- 管理员财务审计代码级和重启后 live 验证通过：`backend/internal/api/v2/longtail/settlement/handler_test.go` 覆盖真实管理路由写入 `admin_logs`，验证 `module=finance`、`action=mark_settlement_disputed`、`target_type=settlement`、`target_id`、`admin_id` 和详情 JSON；后端重启后执行 `EXPECT_FINANCE_SAMPLE=1 EXPECT_FINANCE_AUDIT=1 ./scripts/admin_finance_smoke.sh` 通过，抽样日志 `export_settlements_csv` 已落库，包含管理员、目标、来源 IP、筛选条件和导出字节数。
- 结算入账幂等代码级和重启后 live 验证通过：`TestExecuteSettlementIsIdempotentAfterPartialIncome` 构造“飞手收入流水已存在但结算仍为 confirmed”的部分入账场景，重试 `ExecuteSettlement` 后飞手钱包未重复增加、机主钱包补齐入账、结算状态进入 `settled`，同一结算只保留两条钱包收入流水。后端重启后使用测试结算 `STLIDEMP1779587663960009000` 复核：执行前飞手已有 `90` 分收入流水，调用真实 `/api/v2/settlement/admin/execute/9` 后飞手钱包仍为 `90`、机主钱包补入 `80`、结算状态为 `settled`；再次重复执行同一结算后钱包余额不变，关联流水数仍为 `2`。
- 财务异常告警代码级和重启后 live 验证通过：`TestExecuteSettlementConflictRecordsFinanceAnomaly` 构造同一结算飞手入账流水金额冲突，验证 `ExecuteSettlement` 返回失败并写入 `settlement_execute_failed`；`TestResolveSettlementDisputeFeeMismatchRecordsFinanceAnomaly` 验证错误人工分账合计写入 `settlement_split_mismatch` 且原结算保持 `disputed`。后端重启后使用测试结算 `STLFAN177958851207206400` 复核：调用 `/api/v2/settlement/admin/execute/10` 返回 `400`，错误为“飞手入账失败: 已存在结算入账流水但金额或订单不一致”；随后 `/api/v2/settlement/admin/anomalies?status=open&anomaly_type=settlement_execute_failed&settlement_id=10` 返回 `anomaly_id=1`，调用 `/api/v2/settlement/admin/anomalies/1/resolve` 返回 `200`，已处理列表返回 `resolved_total=1`。
- 财务人工处理记录代码级和重启后 live 验证通过：`TestSettlementDisputeResolveManualActionCanRollback` 验证争议解除会写入处理前后快照，回滚后结算恢复为处理前 `disputed` 状态和原分账金额；`TestFinanceAnomalyResolveManualActionCanRollback` 验证异常处理会写入快照，回滚后异常恢复为 `open` 且清空处理人/处理说明。后端重启后使用测试结算 `STLFMA177958984255286700` 复核：管理员标记争议后结算 `11` 进入 `disputed`，`/api/v2/settlement/admin/manual-actions?status=applied&action_type=settlement_dispute_mark&settlement_id=11` 返回 `action_id=1`，调用 `/api/v2/settlement/admin/manual-actions/1/rollback` 返回 `200`，结算状态恢复为 `calculated`，人工处理记录状态变为 `rolled_back`。
- 财务概览代码级和重启后 live 验证通过：`TestFinanceOperationsOverviewAggregatesRiskQueues` 构造结算、提现、财务异常和人工处理样本，验证 `/settlement/admin/overview` 的待办和今日指标按真实表聚合；执行 `go test ./cmd/server ./internal/api/v2/... ./internal/service`、`npm run build` 均通过。后端在 Terminal 前台窗口重启后，管理员调用 `/api/v2/settlement/admin/overview` 返回 `code=0`，当前库统计为 `calculated=2`、`confirmed=1`、`settled_today=2`、`total_settled_amount_today=7520`、`withdrawal.completed_today=1`、`withdrawal.rejected_today=1`、`anomaly.resolved_today=1`、`manual_action.rolled_back_today=1`。

## 目标链路

### 我要吊运

期望闭环：

1. 01 选择“我要吊运”并登录。
2. 02 填起吊点、落放点、重量、时间。
3. 03 校验空域、载重、距离、时间。
4. 04 选择真实服务商方案。
5. 创建真实订单或真实需求。
6. 进入合同/支付/订单进度。
7. 05 展示真实订单进度。

当前状态：

- 02 到 03 是本地 storage 草稿。
- 03 到 04 仍使用 storage 传递快速预约草稿，但 04 会读取真实供给并创建真实直达订单。
- 03 自身已补真实需求发布分支；带 `supplyId` 时也可直接创建真实直达订单。
- 04 到真实直达订单的最小闭环已在小程序端打通；后续可补单独确认页和正式计价/合同页。
- 支付页已区分模拟支付与待回调支付：模拟支付只在开发/体验版入口展示，正式发布版隐藏；真实渠道创建支付单后不再伪装成功。

### 我要接单

期望闭环：

1. 01 选择“我要接单”并登录服务商账号。
2. 06 工作台展示真实待处理、待报价、待履约、收入。
3. 07 读取真实可接需求。
4. 服务商提交真实报价。
5. 客户选择报价后生成/推进订单。
6. 08 服务商安排无人机、执行人员、安全复核、保险。
7. 执行人员在 `我要接单` 模块内接收/拒绝任务。
8. 派单/履约状态进入订单进度。

当前状态：

- 07 列表、报价页、客户选报价已完成第一轮真实链路修复。
- 06 指标与待办已读取真实 dashboard/workbench，真实 0 不再被假数覆盖。
- 08 已绑定真实 `orderId` 并可调用服务商确认接单；派单入口已带 `orderId` 和 `dispatchId`，已有派单可重派。
- 执行任务已并入 `我要接单`：工作台可显示待确认执行任务，执行人员确认派单后订单从 `pending_dispatch` 进入 `assigned`。
- 执行人员可在任务详情继续推进 `preparing`、`in_transit`、`delivered`，客户在 05 订单进度确认签收后订单进入 `completed`。
- 空域/现场复核和保单状态已接入订单详情字段；现场复核动作和订单无人机保单更新入口已补齐，待后端服务手动重启后可在真实接口返回中复核新增字段和新增路由。

## 逐页审计

### 01 模式选择 / 登录入口

代码位置：

- 小程序：`mini-program/src/pages/auth/mode-selection/index.tsx`
- 小程序登录：`mini-program/src/pages/auth/login/index.tsx`
- 移动端：`mobile/src/screens/auth/ModeSelectionScreen.tsx`、`mobile/src/screens/auth/LoginScreen.tsx`

真实链路：

- 模式选择会写入 `role.selectedMode`，登录页根据 `roleMode` 保持“我要吊运/我要接单”上下文。
- 密码登录和微信小程序登录会走 `authService.login` / `authService.wechatMiniLogin`。

问题：

- 登录页保留了“开发模式快速登录”样本账号，适合内测，不适合生产包。
- 微信登录入口是真实调用，但实际能否完成取决于后端 OAuth 配置和小程序 appid 环境。

建议：

- P1：按构建环境隐藏开发账号。
- P1：登录后按角色能力校正 tab 和首页入口，防止选择“我要接单”但账号没有服务商能力时进入空工作台。

### 02 客户首页 / 预约吊运

代码位置：

- 小程序：`mini-program/src/pages/home/CustomerHaulHome.tsx`

真实链路：

- 常用地址来自本地历史和 `locationService.getAddressList()`。
- 最近订单来自 `orderV2Service.list({ role: 'client', page: 1, page_size: 1 })`。
- 点“获取吊运方案”会把起吊点、落放点、重量、时间写入 `customer_home_quick_order_prefill_v1`，再跳到 03。

代码证据：

- `refreshCommonAddresses` 合并本地历史和远端地址：`mini-program/src/pages/home/CustomerHaulHome.tsx:274`
- `refreshRecentOrder` 读取客户订单：`mini-program/src/pages/home/CustomerHaulHome.tsx:285`
- `requestPlan` 只写 storage 再跳转：`mini-program/src/pages/home/CustomerHaulHome.tsx:399`

问题：

- 首页表单本身不创建需求/订单，只是进入本地草稿流程。
- 城市选择是固定枚举和本地 storage，不是定位/服务覆盖城市接口。

建议：

- P1：保留首页为轻量入口可以，但后续 03 必须落到真实订单/需求创建。
- P2：城市选择接服务区域或定位结果，避免与供给列表 region 查询不一致。

### 03 确认吊运信息

代码位置：

- 小程序：`mini-program/src/pages/publish/quick-order/index.tsx`
- 移动端：`mobile/src/screens/demand/QuickOrderEntryScreen.tsx`

真实链路：

- 起落点空域检测调用 `airspaceService.checkAirspaceAvailability`。
- 距离和预计时长前端计算。
- 普通提交会让用户选择“匹配服务商方案”或“发布需求等服务商报价”。
- 匹配服务商方案时仍写入 `quick_order_offer_draft_v1` 并进入 04，04 负责真实供给查询和直达下单。
- 发布需求时调用 `demandV2Service.create` + `publish`，进入真实需求详情。
- 从供给详情/市场携带 `supplyId` 进入时，提交会调用 `supplyService.createDirectOrder` 创建真实订单。
- 没有首页预填重量时，“载重匹配”检测格可弹出重量选择，避免服务市场直达 03 后无法补重量。

代码证据：

- 读取 `supplyId` 参数：`mini-program/src/pages/publish/quick-order/index.tsx:327`
- 构造直达下单 payload：`mini-program/src/pages/publish/quick-order/index.tsx:189`
- 构造真实需求 payload：`mini-program/src/pages/publish/quick-order/index.tsx:221`
- 资格检查：`mini-program/src/pages/publish/quick-order/index.tsx:540`
- 直达下单分支：`mini-program/src/pages/publish/quick-order/index.tsx:552`
- 发布需求分支：`mini-program/src/pages/publish/quick-order/index.tsx:581`
- 重量补选入口：`mini-program/src/pages/publish/quick-order/index.tsx:607`
- 普通提交动作选择：`mini-program/src/pages/publish/quick-order/index.tsx:669`

原问题：

- 未调用 `demandV2Service.create/publish`。
- 未调用 `supplyService.createDirectOrder`。
- 页面里选的“服务方案”是前端静态方案，不是后端报价/供给/计价结果。
- 从供给详情带来的 `supplyId` 未被 03 读取，导致 04 选服务商后的“立即下单”会绕回 03 但无法创建这个供给的订单。

本轮修复进展：

- 已补 `demandV2Service.create` + `publish` 分支，发布成功后进入 `/pages/demand/detail/index?id=...`。
- 已补 `supplyId` 直达下单分支，创建成功后进入 `/pages/orders/detail/index?orderId=...`。
- 已补客户资格检查，分别检查 `can_publish_demand` 和 `can_create_direct_order`。
- 已补缺重量时的选择入口，兼容从服务市场/供给详情直接进入 03 的路径。
- 保留“匹配服务商方案”作为进入 04 的入口，但 04 已不再展示假服务商方案。

建议：

- P1：静态方案卡后续应改名为“客户意向/服务偏好”，或接真实计价接口；现在发布需求时只把它作为预算和要求写入 payload。
- P1：直达下单成功后应进入合同/支付确认链路，而不是只进入订单详情。

### 04 服务商方案列表

代码位置：

- 小程序：`mini-program/src/pages/supply/list/index.tsx`
- 小程序供给详情：`mini-program/src/pages/supply/detail/index.tsx`
- 移动端直达下单对照：`mobile/src/screens/supply/SupplyDirectOrderConfirmScreen.tsx`

真实链路：

- 有 token 时会调用 `supplyService.list('/supplies')`，带 region、cargo_scene、min_payload_kg、accepts_direct_order、service_type。
- 本轮修复后，真实供给被选中会直接创建直达订单并进入订单详情。
- 移动端已经有直达下单：调用 `supplyService.createDirectOrder(supply.id, payload)`，成功后进入订单和合同。

代码证据：

- 小程序查询供给：`mini-program/src/pages/supply/list/index.tsx:163`
- 查不到/失败时回退本地方案：`mini-program/src/pages/supply/list/index.tsx:194`
- 真实供给跳详情：`mini-program/src/pages/supply/list/index.tsx:210`
- 供给详情“立即下单”跳回 03：`mini-program/src/pages/supply/detail/index.tsx:130`
- 小程序服务层已有 `createDirectOrder`：`mini-program/src/services/supply.ts:29`
- 移动端已实际调用 `createDirectOrder`：`mobile/src/screens/supply/SupplyDirectOrderConfirmScreen.tsx:327`

原问题：

- 小程序存在真实接口能力，但页面没有使用 `createDirectOrder`。
- `plans = supplies.length > 0 ? real : fallbackPlans` 会把“无真实供给”和“接口失败”伪装成有服务商方案。
- 真实供给卡片的 logo、评分、接单量、到达时间仍来自前端数组，不一定是后端事实。

本轮修复进展：

- 已移除 `fallbackPlans`、`fallbackDraft`、`fallbackAddress`、`fallbackPriceByIndex`。
- 接口失败显示“无法加载真实方案”，空结果显示“暂无匹配服务商”。
- `handleSelectPlan` 已调用 `supplyService.createDirectOrder(plan.supply.id, payload)`，成功后清理本地草稿并跳转 `/pages/orders/detail/index?orderId=...`。
- 后端 `buildSupplySummary` 已在列表摘要里返回 `owner`、`drone`、`service_area_snapshot`、`max_range_km`、`updated_at`；`drone` 摘要包含经纬度用于本地距离展示。
- 小程序卡片已用真实服务商头像/简称、无人机品牌型号、真实载重、服务区域/半径、场景标签和可计算距离替代本地静态 logo、评分、接单量、ETA。
- 小程序供给卡片会在快速下单草稿和无人机坐标都存在时计算距起吊点距离；同时用真实 `max_range_km` 标记“可覆盖/超半径”，无依据时不硬造覆盖结论。
- 供给卡 ETA 已改为“预估到场”：只有同时具备距离、无人机 `max_distance` 和 `max_flight_time`，且距离未超过供给/无人机保守半径时按直线距离与机型参数估算分钟数；算不出或超半径时显示无人机型号，不继续使用设计稿静态 ETA。
- 后端供给列表/详情已聚合订单和评价：完成单量来自 `orders.status=completed`，平均响应来自 `orders.created_at -> provider_confirmed_at`，评分优先使用服务商用户评价，缺失时可退到无人机评价；小程序不再用本地静态评分/接单量。

建议：

- P0：移除生产态 fallback 方案。接口失败显示错误，空结果显示空态。
- P0：补小程序“确认直达下单”页，复用移动端 `SupplyDirectOrderConfirmScreen` 的 payload 逻辑，或让 03 在带 `supplyId` 时直接创建订单。
- P1：供给卡字段与后端字段对齐已完成第一轮；评分、完成单量、平均响应、距离、覆盖和 ETA 已有真实字段或明确估算口径。后续如要展示“复购率/准点率”等运营指标，必须先补真实聚合。

### 05 客户订单进度

代码位置：

- 小程序：`mini-program/src/pages/orders/detail/index.tsx`
- 移动端：`mobile/src/screens/order/OrderDetailScreen.tsx`

真实链路：

- 有 `orderId` 且已登录时调用 `orderV2Service.get(orderId)`。
- 优先调用 `orderV2Service.getTimeline(orderId)` 读取真实订单动态。
- `pending_payment` 订单按 `payment_ready` 决定先签合同还是进入支付页。
- `delivered` 状态下可调用 `confirmReceipt(orderId)`。

代码证据：

- 登录/缺 ID/不存在错误态：`mini-program/src/pages/orders/detail/index.tsx:131`
- 远端读取订单：`mini-program/src/pages/orders/detail/index.tsx:147`
- 远端读取 timeline：`mini-program/src/pages/orders/detail/index.tsx:157`
- 合同/支付入口判断：`mini-program/src/pages/orders/detail/index.tsx:232`
- 真实 timeline 渲染数据：`mini-program/src/pages/orders/detail/index.tsx:282`
- 合同页读取合同：`mini-program/src/pages/orders/contract/index.tsx:50`
- 合同页签署合同：`mini-program/src/pages/orders/contract/index.tsx:99`
- 合同服务层：`mini-program/src/services/orderFinanceV2.ts:13`
- 订单接口：`mini-program/src/services/orderV2.ts:23`
- 确认收货接口：`mini-program/src/services/orderV2.ts:51`

原问题：

- 无 `orderId`、未登录或接口失败时显示假订单 `DY202605200128`。
- 时间线是由订单 status 粗略推断，不读取 `/orders/:id/timeline`。
- 服务团队、到场评估、开始吊运等节点部分仍是静态文案。

本轮修复进展：

- 已移除 `demoOrder` 兜底；缺少 `orderId`、未登录、接口失败或订单不存在时只显示错误态。
- 订单摘要读取真实 `orderV2Service.get(orderId)` 响应，包括 `source_supply_id`、服务商、重量、起落点、状态。
- 订单进度优先读取真实 `orderV2Service.getTimeline(orderId)`，有真实事件时展示后端事件；接口不可用时才回退 status 推断。
- `pending_payment` 且 `payment_ready=false` 时，主按钮进入 `/pages/orders/contract/index?orderId=...`；合同页可读取 `/orders/:id/contract` 并调用 `/orders/:id/contract/sign`。
- 合同 `fully_signed` 且当前账号为客户时，合同页进入 `/pages/payment/index?orderId=...`。
- 支付页只有在后端返回 `paid`、`payment_flow.auto_completed` 或 `order.paid_at` 时才提示“支付成功”；微信/支付宝当前只创建待回调支付单，不会自动推进订单。
- 后端 `PaymentService` 通过 `payment.allow_mock` 控制模拟支付是否可用；生产配置校验会拒绝 `allow_mock=true`。

建议：

- P0：生产态禁止 fallback 到 `demoOrder`；改成登录态、加载失败、订单不存在三种状态。
- P1：支付页 mock/真实边界已完成第一轮；后续需要接微信/支付宝真实回调验签和小程序支付 SDK 调起。
- P1：从订单 detail 的 `current_dispatch`、payments、contract、artifacts 中拆更多真实状态。

### 06 服务商工作台

代码位置：

- 小程序：`mini-program/src/pages/home/ProviderWorkbench.tsx`
- 移动端：`mobile/src/screens/home/ProviderWorkbenchScreen.tsx`

真实链路：

- 已登录时调用 `homeService.getDashboard()` 和 `ownerService.getWorkbench()`。
- 工作台入口能跳接单页、我的报价、履约、设备人员、资质保险、钱包等页面；待履约入口会优先带真实 `orderId` 进入 08。

代码证据：

- dashboard 请求：`mini-program/src/pages/home/ProviderWorkbench.tsx:111`
- 指标 fallback：`mini-program/src/pages/home/ProviderWorkbench.tsx:55`
- 0 值时被 fallback 覆盖：`mini-program/src/pages/home/ProviderWorkbench.tsx:141`
- 待办列表为静态文案：`mini-program/src/pages/home/ProviderWorkbench.tsx:250`

原问题：

- `|| fallbackDashboard.xxx` 会把真实 0 值覆盖成假数，导致无待处理也显示 6/3/2/28600。
- 待办列表完全静态，点击都只是通用入口。
- 履约相关入口全部指向 08，但 08 没有订单上下文。

本轮修复进展：

- 已移除 `fallbackDashboard`，真实 0 值显示 0。
- 待办列表来自 `owner/workbench` 的 `recommended_demands`、`pending_provider_confirmation_orders`、`pending_dispatch_orders`。
- 待确认/待派单待办点击会进入 `/pages/fulfillment/hub/index?orderId=...`。

建议：

- P0：改掉 `|| fallback` 逻辑，只在未登录或开发演示模式显示假数；真实 0 必须显示 0。
- P1：待办列表来自 `homeService.getDashboard()`、`orderV2Service.list({ role:'owner' })`、`dispatchV2Service.list({ role:'owner' })` 组合。
- P1：点击待办必须带 `orderId` 或 `dispatchId` 进入 08/派单详情。

### 07 服务商接单列表

代码位置：

- 小程序：`mini-program/src/pages/demand/list/index.tsx`
- 小程序报价页：`mini-program/src/pages/demand/quote/index.tsx`
- 移动端：`mobile/src/screens/demand/DemandListScreen.tsx`

真实链路：

- 列表调用 `demandV2Service.listMarketplaceDemands('/owner/demands/recommended')`。
- “查看并报价”跳到报价页。
- 报价页读取服务商可用无人机，提交 `demandV2Service.createQuote(demandId, payload)`。

代码证据：

- fallback 假需求：`mini-program/src/pages/demand/list/index.tsx:48`
- 真实列表请求：`mini-program/src/pages/demand/list/index.tsx:161`
- 空列表时显示 fallback：`mini-program/src/pages/demand/list/index.tsx:199`
- 筛选只改本地文字：`mini-program/src/pages/demand/list/index.tsx:214`
- 快速报价只 toast 后跳转：`mini-program/src/pages/demand/list/index.tsx:239`
- 正式报价提交真实 API：`mini-program/src/pages/demand/quote/index.tsx:33`
- 服务层 quote/create/select provider：`mini-program/src/services/demandV2.ts:60`

原问题：

- 接口空/失败时显示假需求，服务商会误以为有真实单。
- 筛选项没有进入接口参数，价格排序是对展示字符串做正则排序。
- “快速报价”没有提交报价，用户看到“已选择 ¥680”但后端没有任何状态变化。

本轮修复进展：

- 已移除 `fallbackDemands`，接口失败显示“无法加载真实需求”，空列表显示“暂无可接需求”。
- 真实字段缺失时显示“重量待补”“距离待计算”“待确认”，不再用设计图假值补齐。
- “快速报价”改为进入报价页并预填预算价，只有在报价页点击“提交报价”才调用 `createQuote`。
- 客户需求详情页已能列出服务商报价，并调用 `selectProvider` 生成订单。
- 后端 `/owner/demands/recommended` 摘要补充了 `cargo_weight_kg`、体积、尺寸、货物类型和特殊要求字段，避免 07 卡片只能显示“重量待补”。
- 后端 `/owner/demands/recommended` 已支持 `region`、`min_weight_kg`、`max_weight_kg`、`start_from`、`start_to`、`cargo_scene`、`sort=price`。
- 小程序 07 筛选/排序会带查询参数重新拉取后端数据，同时保留本地过滤作为旧请求返回期间的展示保护。
- 后端已按服务商 active supply 的无人机坐标计算推荐需求 `distance_km`、`matched_supply_id`、`matched_drone_id`，并支持 `sort=distance`。
- 后端已按供给服务半径和无人机最大航程的保守值计算 `service_range_km` 与 `service_coverage_status`；小程序 07 距离行展示“可服务/超半径/待确认”，不再把未知覆盖能力伪装成可接。
- 后端推荐需求摘要已返回 `estimated_arrival_minutes`、`arrival_estimate_source`、`my_quote`、`quote_response_seconds`；小程序 07 距离行可展示预估到场分钟数，已报价需求会显示真实报价响应耗时。

建议：

- P0：移除生产态 `fallbackDemands`，空态明确显示“暂无可接需求”。状态：已完成。
- P0：快速报价要么删除，要么直接调用 `createQuote`；如果需要先选无人机，就不要叫快速报价。状态：已改为“预填报价页，显式提交后才创建报价”。
- P1：筛选参数、距离排序、服务覆盖状态和 ETA/响应字段已落到后端；后续如果要展示“平均响应时长/评分/接单量”，必须先补历史统计表或聚合接口。

### 08 服务商履约安排

代码位置：

- 小程序：`mini-program/src/pages/fulfillment/hub/index.tsx`
- 移动端：`mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx`
- 派单页：`mini-program/src/pages/dispatch/create/index.tsx`

真实链路：

- 派单页本身可调用 `orderV2Service.dispatch(orderId, payload)` 或 `dispatchV2Service.reassign(dispatchId, payload)`。
- 本轮修复后，08 支持读取 `orderId`，无 `orderId` 时从 `owner/workbench` 取第一条待确认/待派单订单；确认接单调用 `orderV2Service.providerConfirm(orderId)`。
- 第二轮修复后，08 会从订单详情识别 `current_dispatch`，执行人员行展示目标飞手和“待飞手确认/已确认”等状态；已有派单时，提交按钮和行点击进入“调整派单”而不是新建派单。
- 派单页会读取 `ownerService.listPilotBindings({ status: 'active' })`，合作飞手可直接选择；已有 `current_dispatch` 或 `dispatch_task_id` 时调用 `dispatchV2Service.reassign`，没有派单时才调用 `orderV2Service.dispatch`。
- 第三轮修复后，08 的“空域 / 安全检查”读取订单 `airspace_status` 和执行状态，“保险状态”读取订单无人机保单字段，不再把合同状态当作保险状态。

代码证据：

- 后端订单摘要返回 `airspace_status`：`backend/internal/api/v2/order/handler.go:668`
- 后端无人机摘要返回保单字段：`backend/internal/api/v2/order/handler.go:735`
- 类型层补充订单空域与无人机保单字段：`mini-program/src/types/index.ts:694`
- 08 状态文案识别 `current_dispatch`：`mini-program/src/pages/fulfillment/hub/index.tsx:98`
- 08 组装带 `dispatchId` 的派单入口：`mini-program/src/pages/fulfillment/hub/index.tsx:139`
- 08 空域状态映射：`mini-program/src/pages/fulfillment/hub/index.tsx:154`
- 08 保险状态映射：`mini-program/src/pages/fulfillment/hub/index.tsx:183`
- 08 无 `orderId` 时从 `owner/workbench` 找待办订单：`mini-program/src/pages/fulfillment/hub/index.tsx:278`
- 08 待派单提交进入派单页：`mini-program/src/pages/fulfillment/hub/index.tsx:393`
- 08 无人机/执行人员行都进入真实派单页，并展示当前派单目标飞手：`mini-program/src/pages/fulfillment/hub/index.tsx:466`
- 08 空域/保险行读取真实字段生成文案：`mini-program/src/pages/fulfillment/hub/index.tsx:487`
- 派单页加载订单和合作飞手绑定：`mini-program/src/pages/dispatch/create/index.tsx:52`
- 派单页根据现有 `current_dispatch` / `dispatch_task_id` 判断新派还是重派：`mini-program/src/pages/dispatch/create/index.tsx:96`
- 派单页提交时已有派单调用 `dispatchV2Service.reassign`，否则调用 `orderV2Service.dispatch`：`mini-program/src/pages/dispatch/create/index.tsx:100`
- 派单页合作飞手选择列表：`mini-program/src/pages/dispatch/create/index.tsx:229`

原问题：

- 这是当前 8 页中业务最虚的一页。
- 服务商从 06 进入 08 时没有订单列表选择，也没有 `orderId`。
- “选择无人机”跳附近无人机，“安排执行人员”跳派单页但未带 `orderId`，派单页会显示“订单不存在”。
- 费用与报价写死，未从订单 total、commission、owner_amount 或 settlement 数据读取。

本轮修复进展：

- 08 已读取真实 `orderV2Service.get(orderId)`，不再使用硬编码订单号、地址、重量、时间、电话、费用。
- “安排执行人员”和“选择无人机”入口已带 `orderId` 和现有 `dispatchId` 到派单页。
- “确认接单”已调用真实 `providerConfirm`，接口验收中订单 `38` 从 `pending_provider_confirmation` 推进到 `pending_payment`。
- 派单页已读取真实合作飞手绑定，已有正式派单时走 `reassign`；接口验收中订单 `40` 从派单 `15` 重派到 `16`。
- 空域/现场复核和保单状态已接入真实字段；没有后端字段时仍显示待复核/待确认，不再伪造“空域可飞/已保障”；现场复核和保单更新动作已补第一轮。
- 现场复核已补证据闭环：08 进入复核页后必须完成清单并上传照片，后端落 `order_site_safety_checks`，订单详情可回显最近一次复核结果。
- 保单审核已补留痕：提交保险资料会回到 `pending` 并清空旧驳回信息，后台通过/驳回会记录审核人和时间，驳回原因会回显到 08。

建议：

- P1：无人机选择要么读取订单关联供给/无人机，要么增加“更换无人机”接口；不能只跳附近无人机。
- P1：空域/现场复核已完成字段展示、动作和证据闭环；保单审核已完成第一轮留痕和驳回原因回显；后续重点转向履约结算规则和通知触达，而不是继续增加静态状态文案。
- P1：“安排履约”后续应继续拆成“确认接单”“发起/调整派单”“完成复核”“开始执行”等明确状态动作。

## 已有后端/服务能力

前端服务层已经具备不少真实接口：

- 供给列表/详情/直达下单：`mini-program/src/services/supply.ts`
- 需求列表/我的需求/报价/选择服务商/发布：`mini-program/src/services/demandV2.ts`
- 订单列表/详情/时间线/监控/服务商确认/派单/确认收货：`mini-program/src/services/orderV2.ts`
- 派单任务列表/详情/接受/拒绝/重派：`mini-program/src/services/dispatchV2.ts`
- 支付创建/支付列表：`mini-program/src/services/orderFinanceV2.ts`

后端也存在直达下单、选择服务商、支付、派单相关路由。问题主要不是“后端完全没有”，而是 8 张设计图落地时，小程序页面没有把这些能力串成闭环。

## P0 修复清单

1. 移除生产态假数据回退。

   状态：04、05、06、07、08 已完成第一轮修复。接口失败显示错误，空数据显示空态；只有开发演示模式可以展示 mock，并必须有明显标记。

2. 小程序打通客户直达下单。

   状态：已完成最小闭环。当前实现是在 04 选择真实供给后直接调用 `supplyService.createDirectOrder`，成功后进入订单详情；后续可再补单独确认页。

3. 小程序打通客户发布需求。

   如果业务选择撮合模式，则 03 不进入 04 供给列表，而是调用 `demandV2Service.create` + `publish`，进入需求详情/报价列表。现有 `mini-program/src/pages/publish/demand/index.tsx` 已有创建和发布逻辑，可抽取复用。

4. 服务商接单列表停止显示假需求。

   状态：已完成第一轮修复。07 无真实需求时显示空态；“快速报价”进入预填报价页，不再伪造成功。

5. 08 绑定真实订单。

   状态：已完成第二轮修复。06 待办进入 08 会带 `orderId`；08 读订单详情，派单入口带 `orderId` 和现有 `dispatchId`，确认接单调用真实接口，已有正式派单时走重派接口。

6. `我要接单` 接住执行任务。

   状态：已完成第一轮修复。`ProviderWorkbench` 读取 `role=pilot` 执行任务并展示待办；`dispatch/list?role=pilot` 和 `dispatch/detail?role=pilot` 作为同一模块内的执行任务入口；执行人员确认派单调用真实 `accept` 接口，验收中订单 `40` 已推进到 `assigned`。

7. `我要接单` 推进执行状态。

   状态：已完成第一轮修复。执行任务详情页按订单状态展示“开始现场准备/开始吊运作业/确认送达”；验收中订单 `40` 已推进到 `completed`，05 timeline 可读到执行准备、执行中、送达、客户签收事件。

8. 05 禁止 demoOrder 兜底。

   状态：已完成第一轮修复。没有 `orderId`、未登录、接口失败、订单不存在分别显示正确状态，不能展示 `DY202605200128`。

## P1 修复清单

1. 07 筛选和排序改成接口参数。状态：已完成第一轮；距离排序已接后端 `distance_km`，服务覆盖已接 `service_range_km/service_coverage_status`，ETA 已接 `estimated_arrival_minutes`，已报价响应已接 `quote_response_seconds`。
2. 05 时间线改读 `/orders/:id/timeline`。状态：已完成。
3. 04 服务商卡片字段与后端字段对齐，去掉本地评分、接单量、ETA 假值。状态：已完成第一轮；评分、完成单量、平均响应来自后端真实聚合，距离、覆盖和预估到场只在有坐标/半径/机型续航依据时展示。
4. 08 空域/现场复核和保单状态接真实字段。状态：已完成第三轮；现场复核已有清单、照片、备注落库和订单详情回显，保单更新进入订单无人机保险表单，保单审核结果已有审核人/时间/驳回原因留痕。
5. 支付页明确区分 mock 支付和真实支付；生产态不默认 mock。状态：已完成第一轮，后端生产校验禁止 `payment.allow_mock=true`。
6. 补真实评价入口并让评分统计有真实来源。状态：已完成第一轮；05 完成态订单进入评价页，评价页使用真实订单参与方提交到 `/orders/:order_id/reviews`。
7. 完成态订单的结算入账和钱包展示。状态：已完成第一轮；客户签收后会自动执行结算并给飞手/机主钱包入账，服务商/执行人员可从个人中心进入钱包查看流水。
8. 结算入账消息触达。状态：已完成第一轮；自动结算成功后会写入客户、服务商/机主、执行飞手系统通知，消息页可归类为“结算入账”。
9. 提现/对账状态机。状态：已完成第一轮代码加固并通过重启后 live smoke；提现申请、审核通过、审核驳回的余额变化和记录状态已有测试和运行态证据。
10. 异常结算人工处理。状态：已完成第一轮代码加固并通过重启后 live smoke；管理员可标记争议、解除争议并手工调整分账。
11. 对账导出。状态：已完成第一轮代码落地并通过 live smoke；管理员可按创建/确认/入账等时间字段导出结算/提现 CSV。

## 建议实施顺序

我建议先做“链路闭环”，再继续 09/10 设计：

1. 已完成第一轮：04 -> 真实下单 -> 05。
2. 已完成第一轮：06 -> 08 真实订单履约确认。
3. 已完成第一轮：07 -> 真实报价 -> 客户选报价 -> 订单。
4. 已完成第一轮：03 的“直达下单/发布需求”业务分支。
5. 已完成第一轮：05 时间线、08 空域/保单真实字段。
6. 已完成第一轮：支付页明确 mock/真实支付边界，生产态不能默认走 mock。
7. 已完成第一轮：04 服务商卡片剩余假字段、真实距离/覆盖标签与 07 筛选参数。
8. 已完成第一轮：供给侧历史统计聚合接口，包括真实平均响应时长、完成单量、评分。
9. 已完成第一轮：补真实评价入口，评价记录写回订单并可作为供给侧评分统计来源。
10. 已完成第一轮：补 08 现场复核/保单更新动作，安全检查可落订单时间线，保单表单可更新无人机保险字段。
11. 已完成第二轮：补 08 现场复核照片、复核清单和最近一次复核结果回显。
12. 已完成第一轮：补保单审核留痕与驳回原因回显。
13. 已完成第一轮：补履约结算明细、结算归属修正、完成签收后自动入账和钱包入口。
14. 已完成第一轮：补结算入账通知触达和消息页归类。
15. 已完成第一轮代码加固：补提现申请冻结、审核通过扣减、审核驳回解冻和最低提现校验。
16. 已完成第一轮代码加固：补异常结算标记争议、解除争议、人工分账调整和分账合计校验。
17. 已完成第一轮代码落地并通过基础 live smoke：补结算/提现 CSV 对账导出。
18. 已完成第一轮并通过动作级 live smoke：补管理员侧结算/提现可视化；结算页接真实确认、入账、争议、解除争议接口，结算/提现列表和 CSV 导出共用状态与时间字段筛选，提现审核通过/驳回和结算入账均已验证真实落库。
19. 已完成第一轮代码落地：补管理员财务动作审计日志；结算创建、确认、入账、争议、解除争议、批处理、对账导出、提现审核和定价配置更新都会写入 `admin_logs`，操作日志页可按目标维度过滤。
20. 已完成第一轮代码加固：补结算入账幂等和事务边界；部分入账后重试不会重复打钱，结算双方入账和状态更新作为一个事务提交。

这比继续做新设计图更关键，因为当前 01-08 已经暴露出同一个问题：视觉还原速度超过了真实数据链路，继续往后画会把静态假链路越铺越长。

## 验收口径

后续每修一段，都按样本账号做最小闭环验收：

- 客户账号创建一次真实直达订单，能在订单列表和订单详情看到同一 `orderId/order_no`。
- 服务商账号看到真实推荐需求，提交报价后客户能看到报价。
- 客户选择报价后生成或推进真实订单。
- 服务商从工作台进入某个真实订单的履约页，能发起真实派单。
- 订单详情不再在异常路径显示 `DY202605200128`。

## 最新 P0 链路验收

2026-05-24 22:39 已新增并跑通 `backend/scripts/mini_program_p0_acceptance.sh`。

验收命令：

```bash
cd backend
./scripts/mini_program_p0_acceptance.sh
```

本次结果：30 项通过，0 项失败。真实链路产物为 `demand_id=42`、`quote_id=18`、`order_id=46`、`dispatch_id=19`、`settlement_id=12`，结算状态为 `settled`。

覆盖范围：

- 客户账号 `13800000004` 创建并发布真实吊运需求。
- 服务商账号 `13800000007` 在真实推荐需求中看到需求并提交报价。
- 客户选择报价、双方签约、客户 mock 支付，订单进入 `pending_dispatch`。
- 后端已自动生成正式派单时，脚本会读取已有待响应派单，不重复创建派单。
- 执行人员账号 `13900000016` 在 `role=pilot` 派单列表看到派单并接受，订单进入 `assigned`。
- 执行人员推进 `preparing -> in_transit -> delivered`，客户确认签收后订单进入 `completed`。
- 客户、服务商、执行人员均能读取结算；服务商和执行人员钱包可加载；订单时间线包含完成事件。

## App 08 首轮接入

2026-05-24 23:00 已将 `mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx` 从静态设计稿数据改为真实接口驱动。

覆盖范围：

- 进入页时优先读取路由 `orderId/id`，Web 预览也支持 `/fulfillment?orderId=...`；未带订单时读取服务商工作台待确认/待履约订单。
- 登录态、空后端、无权限或接口失败时显示空态/错误态，不再展示 `DY202605200128` 这类设计稿假订单。
- 订单号、地址、货物重量、作业时间、客户备注来自 `/api/v2/orders/:id`。
- 无人机、执行人员、正式派单状态、空域/现场复核、保险状态来自订单详情的真实字段。
- 完成态订单读取 `/api/v2/orders/:id/settlement`，费用区展示真实结算；未完成时只展示订单预估金额并明确为待生成结算。
- 主按钮按真实订单状态处理：待确认接单调用 `provider-confirm`，待派单进入正式派单/重派页面，待支付和其他状态不伪造成功。

验证命令：

```bash
cd mobile
npx eslint src/screens/fulfillment/FulfillmentHubScreen.tsx
npx tsc --noEmit --pretty false
npm run web:build
```

本地预览服务已验证可加载：`http://localhost:3100/fulfillment?orderId=46`。

## App 08 图标与 Web 预览收口

2026-05-25 00:26 已对 App 08 履约安排页做资源和 Web 预览修复。

覆盖范围：

- `08-assets` 中的图标资源经预览确认存在截断、拉伸和缺笔画问题，App 08 不再接入这些有缺陷的功能图标。
- `mobile/src/screens/fulfillment/FulfillmentHubScreen.tsx` 的头部、订单信息、履约安排、费用提示、底部 tab 图标改为代码绘制的干净图标，避免继续沿用坏的 Pro 拆解 PNG。
- 补齐 `mobile/src/assets/haul/*.web.ts` 资产入口，App Web 构建不再把 01-08 PNG 资产编译成浏览器不可用的 `require()`。
- 修复 `LinearGradient.web.tsx` 对样式数组的展开方式，避免 `[styleA, condition && styleB]` 被展开成 CSS 的 `0/1` 属性导致页面白屏。
- 修复 Web `TouchableOpacity` 的样式扁平化和点击/键盘触发，便于本地 Web 预览点击验证。
- `mobile/src/index.web.tsx` 增加仅开发态可用的 `?devAuth=customer|provider|executor|composite`，通过真实 `authService.login` 登录真实账号，不引入假数据。

验证记录：

- `VITE_API_BASE_URL=/api npm run web:build` 通过。
- 构建产物检查确认没有 `null?.55` 坏表达式；01-08 资产模块没有残留浏览器不可用的 PNG `require()`，仅剩 `react-native-image-picker` 自带受保护分支。
- 通过本地代理预览 `http://127.0.0.1:3120/fulfillment?orderId=46&devAuth=provider`，页面成功渲染真实订单 `WRJ1779633553708`、订单信息、履约安排和费用与报价。
- 代理日志确认请求真实后端：`POST /api/v2/auth/login`、`GET /api/v2/orders/46`、`GET /api/v2/orders/46/settlement` 均返回 `200`。
- 当前页不再出现 `Failed to set an indexed property [0] on CSSStyleDeclaration` 运行时报错。

## 小程序 08 图标资源收口

2026-05-25 08:45 已对小程序 08 履约安排页做产品端图标修复。

覆盖范围：

- `08-assets` 中的 `fulfillment-schedule` 图标存在截断、拉伸、缺笔画问题，小程序 08 不再 import 这批坏 PNG。
- `mini-program/src/pages/fulfillment/hub/index.tsx` 新增 `CleanIcon`，头部返回/客服/更多、状态、订单信息、履约安排、费用提示、联系客户和页内底部 tab 均改为样式绘制图标。
- `mini-program/src/pages/fulfillment/hub/index.scss` 将订单信息行的小图标从原来的 54/55 高度收回到正常比例，避免图标和文字不对齐、图标被拉长的问题。
- 真实订单、派单、现场复核、保险、结算数据链路保持不变，本次只替换坏资源表现层。

验证记录：

- `mini-program/src/pages/fulfillment/hub/index.tsx` 已无 `fulfillment-schedule` PNG import 和 `<Image>` 图标渲染。
- `npm run build:weapp` 通过。
- `npm run build:weapp:prod` 通过。
- 构建产物 `mini-program/dist/pages/fulfillment/hub` 已无 `fulfillment-schedule` 资源引用；仍只有既有 Sass `@import` 弃用警告。

## App 05 首轮接入

2026-05-24 23:15 已将 `mobile/src/screens/demand/DemandListScreen.tsx` 的可接吊运需求列表从静态 fallback 数据改为真实接口驱动，并补齐报价页预填逻辑。

覆盖范围：

- 需求列表只读取 `/api/v2/owner/demands/recommended`，不再在接口失败或无数据时展示 `7001/7002/7003` 这类设计稿假需求。
- 未登录、未开通服务商能力、接口失败、后端无数据、筛选无结果分别显示明确空态或错误态。
- 区域、货重、时间、场景筛选会转换为后端查询参数；距离/价格排序会带 `sort=distance|price` 请求后端，并在前端按真实字段兜底排序。
- 距离、服务覆盖、预估到场、已响应时长、重量、场景、预算、空域状态、已报价状态均来自后端字段。
- 快速报价不再伪造成功，只进入真实报价页；报价页会接收 `priceYuan/quick/existingQuote`，按预算或已有报价预填金额和执行方案。
- 报价页文案从“机主报价”统一为“服务商报价”，继续调用真实 `createQuote` 接口。

验证命令：

```bash
cd mobile
npx eslint src/screens/demand/DemandListScreen.tsx src/screens/demand/DemandQuoteComposeScreen.tsx src/services/demandV2.ts src/types/index.ts
npx tsc --noEmit --pretty false
npm run web:build
```

## App 生产 mock 门禁收口

2026-05-25 00:30 已补 App 端生产运行时的开发入口限制。

覆盖范围：

- `APP_CONFIG` 增加 `isProductionRuntime`、`devToolsEnabled`、`mockPaymentEnabled`，生产运行时默认关闭开发样本账号和模拟支付。
- 登录页的 `13800000004/13800000007/13900000016` 等样本账号只在 `devToolsEnabled=true` 时渲染，生产态不会出现在用户界面。
- 验证码提示在生产态不再显示“开发模式请查看控制台”。
- 支付页生产态不再提供“模拟支付”选项，默认只展示微信/支付宝待回调支付单；开发态仍可用模拟支付推进本地验收链路。
- 即使异常参数把支付方式设为 `mock`，生产态点击支付也会被前端拦截。

验证命令：

```bash
cd mobile
npx eslint src/constants/index.ts src/screens/auth/LoginScreen.tsx src/screens/order/PaymentScreen.tsx
npx tsc --noEmit --pretty false
npm run web:build
```

## App 04/07 首轮接入

2026-05-24 23:30 已将 `mobile/src/screens/order/OrderDetailScreen.tsx` 的订单进度页从 `demoOrder` 静态兜底改为真实订单、时间线、结算状态驱动。

覆盖范围：

- 移除 `DY202605200128`、`2026-05-20`、`安翼吊运服务` 等设计稿假订单兜底。
- 缺少订单 ID、未登录、订单不存在或接口失败时显示明确空态/错误态，不再展示假成功订单。
- 订单摘要读取 `/api/v2/orders/:id` 的服务商、货物重量、起吊点、落放点、预计服务、服务团队状态。
- 订单进度优先读取 `/api/v2/orders/:id/timeline`，失败时只使用订单详情自带 timeline，不再合成固定假时间。
- 完成态订单读取 `/api/v2/orders/:id/settlement`，时间线末尾展示结算状态和客户实付金额。
- 主操作按真实状态分流：待支付进入合同/支付，待确认收货调用 `confirm-receipt`，完成态进入评价，其余状态禁用确认按钮。
- 查看方案优先打开供给方案；撮合需求订单可回到需求详情。

验证命令：

```bash
cd mobile
npx eslint src/screens/order/OrderDetailScreen.tsx
npx tsc --noEmit --pretty false
npm run web:build
```

## App 03 首轮接入

2026-05-24 23:45 已将 `mobile/src/screens/demand/OfferListScreen.tsx` 的服务商方案页从静态兜底方案改为真实供给接口驱动。

覆盖范围：

- 移除 `坂田仓库`、`坪山施工点`、`安翼吊运服务`、`云岭重载吊运`、固定评分/单量/到场时间等设计稿假数据兜底。
- 缺少 `quickOrderDraft` 时显示明确错误态，并引导回发布任务，不再自动生成本地假需求。
- 未登录、接口失败、后端无供给、筛选无结果时显示空态/错误态，不再展示本地假服务商方案。
- 服务商卡片只来自 `/api/v2/supplies` 的真实返回；选择方案只带真实 `supply.id` 进入后续确认下单。
- 卡片展示字段改为真实供给 ID、最大载重、基础报价、直达下单/服务状态标签；后端没有的评分、历史单量、预计到场不再伪造。
- 03 快速预约入口仍负责采集起吊点、落放点、货重、时间和空域检测；下一页只按这些真实输入去匹配真实供给。

验证命令：

```bash
cd mobile
npx eslint src/screens/demand/OfferListScreen.tsx
npx tsc --noEmit --pretty false
npm run web:build
```

## App 入口 / Tab / 服务商工作台收口

2026-05-25 00:15 已将 App 的两大入口、tab 状态和服务商工作台进一步对齐小程序。

覆盖范围：

- App 端 `customer/provider` 模式写入本地存储，重启后保持上次选择；小程序和 App 不再出现“重启回到客户入口”的差异。
- App 新增并对齐 `canEnterMode(mode, roleSummary)`、`resolveProviderCapabilities(roleSummary)`，展示层统一把机主/执行人员能力合并为“服务商”。
- 服务商工作台不再用 `fallbackStats` 填充 6/3/2/28600 这类假统计，统计改为读取 dashboard、owner workbench 和正式派单列表。
- 服务商工作台待办不再展示 `龙岗区 -> 坪山区，80kg，今天15:00前`、空域待确认、保险即将到期等设计稿假任务；无真实待办时显示“暂无待处理事项”。
- 服务商能力未开通时显示门禁页，提示完善资质，不直接展示接单、派单和履约数据。
- App 主导航标题和 P0 链路文案从“机主/飞手端”收口为“服务商/执行人员/客户”；保留接口和内部角色字段里的 `owner/pilot` 兼容命名。
- App tab 继续复用完整的客户/服务商两套图标资源，不混用小程序胶囊导致的头部布局差异。
- App 可见层旧身份词已完成扩大扫尾：个人中心、服务商/执行人员资料、绑定关系、正式派单、履约、售后、结算、无人机、空域、飞行监控和首页不再展示“机主/飞手/飞手端/机主端”，展示统一为“服务商/执行人员”。

验证命令：

```bash
cd mobile
npx eslint src/store/slices/roleSlice.ts src/navigation/AppNavigator.tsx src/utils/roleSummary.ts src/screens/home/ProviderWorkbenchScreen.tsx src/navigation/MainNavigator.tsx src/screens/demand/OfferDetailScreen.tsx src/screens/demand/DemandDetailScreen.tsx src/screens/supply/SupplyDirectOrderConfirmScreen.tsx src/screens/order/OrderListScreen.tsx
npx tsc --noEmit --pretty false
npm run web:build
```

## App 可见身份文案扫尾

2026-05-25 01:20 已做 App 可见层角色命名收口。

覆盖范围：

- `mobile/src/screens/profile/ProfileScreen.tsx`、`OwnerProfileScreen.tsx`、`PilotProfileScreen.tsx`：身份卡、能力说明、资料页、认证页、保存提示统一为服务商/执行人员。
- `OwnerPilotBindingsScreen.tsx`、`PilotOwnerBindingsScreen.tsx`：绑定关系从机主/飞手改为服务商/执行人员，内部 `owner_user_id/pilot_user_id` 字段不改。
- `CreateDispatchTaskScreen.tsx`、`DispatchTaskListScreen.tsx`、`PilotTaskListScreen.tsx`、`DispatchTaskDetailScreen.tsx`、`PilotOrderExecutionScreen.tsx`：正式派单、拒绝、重派、履约推进文案统一为执行人员和服务商。
- `OrderAnomalyListScreen.tsx`、`ContractScreen.tsx`、`ReviewScreen.tsx`、`OrderAfterSaleScreen.tsx`、`WalletScreen.tsx`：异常、合同、评价、售后和结算分账展示统一为服务商/执行人员。
- `HomeScreen.tsx`、无人机、空域、飞行监控、路线、市场页同步扫尾，避免用户从非 P0 页面进入时看到旧三端模型。

验证命令：

```bash
rg -n "飞手端|机主端|机主|飞手" mobile/src/screens mobile/src/components mobile/src/constants --glob '!**/*.png'
cd mobile
npx eslint src/screens src/components src/constants --ext .ts,.tsx
npx tsc --noEmit --pretty false
npm run web:build
git diff --check
```

结果：旧身份词扫描无命中；lint 0 error，仅剩既有 inline-style / nested component warning；TypeScript、Web 构建和 diff check 均通过。

## 07 图标资源复核

2026-05-25 已对小程序/App 07 接单列表图标做资源复核。

覆盖范围：

- 当前项目内 07 指标类图标已规范为 48x48，不存在 08 那种截断/缺笔画问题。
- 小程序和 App 的空域状态图标原显示盒为 57x63，但实际资源约为 61x60，会造成轻微纵向拉伸；已改为 57x56 保持接近原始比例。
- 筛选箭头、路线定位、右箭头和消息红点的显示比例与资源/设计规格基本一致，暂不替换为代码图标。
- 原始 07-assets 里的 tab 预览仍有弱线/带文字问题，但 07 页面未直接接入这组 tab 图，底部导航继续走已统一的 provider shared tab 资源。

## 06 头部坏图标收口

2026-05-25 已对小程序/App 06 服务商工作台的头部图标做资源复核和替换。

覆盖范围：

- 原始 06-assets 和当前项目内 `provider-workbench` 的消息、设置图标都有浅色虚线、缺笔画问题，属于 Pro 拆图质量问题，不适合继续通过调尺寸修复。
- 小程序 06 当前头部只展示“设置”，已移除坏 PNG 依赖，改为 CSS 绘制的白色齿轮图标，文字仍由代码渲染。
- App 06 同步将“消息”和“设置”改为 React Native 代码绘制图标，保留原有点击入口和红点，不再使用坏的头部 PNG。
- 工作台 tab 图标不从 06 页面局部资源接入，继续使用统一 provider tab 资源，避免把 Pro 预览里带弱线/带文字的问题带进共享底栏。

## 双入口登录模式修正

2026-05-25 已修正小程序/App 登录页的 `customer/provider` 模式串入口问题。

覆盖范围：

- `我要接单` 入口进入登录页时，开发模式快速登录允许客户、服务商、执行人员和综合服务账号进入，用于覆盖新用户/普通客户申请成为服务商的路径。
- `我要吊运` 入口进入登录页时，开发模式快速登录只展示客户样本账号。
- 手输手机号、微信登录和开发快速登录都会保留当前入口模式；账号没有服务商能力时进入 `provider` 门槛/入驻页，不会静默切回客户预约页。
- 小程序登录页外层改为真正的 `ScrollView`，解决开发账号列表较长时只能看到部分身份、页面无法继续滑动的问题。

## 服务商入驻门槛修正

2026-05-25 已修正 `我要接单` 新用户/客户账号的服务商准入入口。

- 小程序和 App 的“服务商能力未开通”主按钮不再直接跳转实名认证；实名认证只是账号校验，不等于服务商准入。
- 小程序门禁按钮和“服务资质”快捷入口会打开入驻选择：服务商资料、执行人员认证、设备与资质、实名认证。
- App 同步改为服务商入驻选择，优先进入服务商资料、执行人员认证、设备与资质，不再把“完善资质”误导成只做实名认证。
- 文案同步改为“先完善服务商资料、设备资质或执行人员认证”，避免用户误解为只要实名即可接单。

2026-05-25 追加修正服务商门禁绕过问题。

- `has_owner_role/has_pilot_role` 只表示存在服务商/执行人员档案，不再直接解锁正式接单工作台。
- 正式 `provider` 工作台、接单列表和派单创建统一要求真实作业能力：`can_publish_supply`、`can_accept_dispatch` 或 `can_self_execute`。
- 小程序门禁页“查看账号资料”保持 `provider` 入口上下文，只进入账号资料页；返回工作台/接单时仍由服务商能力门禁拦截，不会切到“我要吊运”。
- 06 工作台头部去掉设计稿静态“安翼吊运服务 / 资质有效”，改为当前用户昵称或“服务商工作台”，能力标签按真实能力显示“设备就绪 / 执行就绪 / 综合就绪”。
