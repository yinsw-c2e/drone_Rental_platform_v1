# 无人机服务平台重构任务总表

## 1. 目的

本文件用于把以下业务设计文档，落成一份可长期维护、可逐项勾选、可持续更新的重构执行总表：

- [BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
- [BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
- [BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
- [BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
- [BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)

本表后续有两个用途：

1. 作为整项目重构的唯一执行清单
2. 每完成一个任务，立即回写本文件并标记为已完成，保证随时可追踪

## 2. 使用规则

- 状态标记统一使用：`[ ]` 未开始、`[x]` 已完成
- 真正完成并通过对应验收标准后，才允许勾选
- 若任务拆分出子任务，优先补充在本文件对应阶段，不另起零散待办
- 若业务方案发生变更，必须先更新业务文档，再更新本总表
- 每次完成任务时，除了勾选本文件，也要同步更新被影响文档、接口文档、测试清单
- 当前默认按“开发测试环境”处理：若旧测试数据、脏数据或阶段性结构明显阻碍新方案重构，可优先选择重置、删除或不迁移，而不是追加高成本兼容逻辑
- 但涉及真实数据库删改、清库、重灌种子数据等破坏性动作时，仍需在执行前单独确认

最近一次基线更新：`2026-03-13`

## 3. 当前基线结论

- 角色判定以 `账号 + 档案 + 能力状态` 为准，不再以 `user_type` 为真相源
- 业务对象固定为 `需求 / 供给 / 订单 / 派单任务 / 飞行记录`
- 订单来源固定支持两类：`demand_market`、`supply_direct`
- 直达下单已补齐待确认闭环：订单先进入 `pending_provider_confirmation`
- 调度优先级固定为：`自己执行 -> 绑定飞手 -> 候选飞手池 -> 普通飞手池`

### 3.1 阶段复杂度总览

| 阶段 | 复杂度 |
|------|--------|
| 阶段 0：文档基线与业务冻结 | M |
| 阶段 1：数据库与领域模型重建 | XL |
| 阶段 2：后端领域服务重构 | XL |
| 阶段 3：API v2 实现与路由切换 | L |
| 阶段 4：移动端基础重构 | M |
| 阶段 5：移动端市场域重构 | L |
| 阶段 6：移动端履约域重构 | XL |
| 阶段 7：移动端我的页、档案与消息域重构 | M |
| 阶段 8：后台管理与运营适配 | M |
| 阶段 9：数据迁移、双读校验与切流 | XL |
| 阶段 10：测试、验收与收尾 | L |

## 4. 阶段 0：文档基线与业务冻结

- [x] R0.01 复核主业务文档并修正角色、流程、状态机的逻辑漏洞
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
依赖：无
验收标准：角色体系、撮合链路、履约链路、候选机制、绑定飞手机制、异常处理、状态机已形成闭环。

- [x] R0.02 补齐字段字典并统一字段命名、状态枚举、来源追溯规则
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
依赖：R0.01
验收标准：核心实体字段、状态枚举、派生字段、来源追溯字段已统一；文档中不存在明显冲突命名。

- [x] R0.03 补齐页面信息架构，拆清首页、市场、履约、我的四大视角
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
依赖：R0.01
验收标准：页面对象边界明确，供给市场、需求市场、订单、派单任务、飞行记录不再混页。

- [x] R0.04 补齐 API v2 契约，统一 DTO、分页、响应结构和关键动作接口
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
依赖：R0.01、R0.02、R0.03
验收标准：存在明确的 `/api/v2` 契约；供给市场、直达下单、需求转单、派单、飞行接口均已定义。

- [x] R0.05 补齐数据库关系与迁移方案，明确目标模型与旧表映射
关联文档：[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
依赖：R0.02、R0.04
验收标准：目标表关系、历史表映射、迁移阶段、迁移验证清单已明确。

- [x] R0.06 收口直达下单闭环，补齐 `supply_direct` 来源和待确认状态
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
依赖：R0.01-R0.05
验收标准：直达下单不再依赖口头流程；订单来源、待确认状态、供给详情入口、API 与迁移规则全部一致。

- [x] R0.07 固定平台业务边界，补齐重载吊运场景、准入门槛、非目标场景和迁移约束
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
依赖：R0.01-R0.06
验收标准：平台定位明确为重载末端物资吊运；文档已统一 `heavy_cargo_lift_transport`、场景类型、机型门槛和非目标场景。

- [x] R0.08 收口绑定飞手机制，统一状态枚举、发起方字段和双向接口
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
依赖：R0.01-R0.07
验收标准：绑定关系状态、`initiated_by`、机主邀请、飞手申请、双方确认/拒绝、飞手查看绑定关系全部口径一致。

- [x] R0.09 收口需求生命周期，补齐 `expires_at`、草稿更新/发布/取消接口和自动过期规则
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
依赖：R0.01-R0.08
验收标准：需求草稿、发布、取消、过期自动关闭和通知规则已闭环。

- [x] R0.10 收口订单执行与飞行记录规则，明确拒单终态、执行阶段触发方、飞行记录创建时机和多架次处理
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
依赖：R0.01-R0.09
验收标准：`provider_rejected` 终态、执行状态推进、飞行记录创建、多架次聚合都已写成明确规则。

- [x] R0.11 收口价格、结算、评价、地址快照和候选/迁移细则
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
依赖：R0.01-R0.10
验收标准：直达下单价格规则、结算规则、评价模型、地址快照 DTO、候选飞手与需求状态关系、`dispatch_candidates` 迁移拆分规则均已明确。

## 5. 阶段 1：数据库与领域模型重建

- [x] R1.01 新建 `client_profiles / owner_profiles / pilot_profiles` 目标表，并定义唯一约束与状态字段
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`、`backend/internal/model`
依赖：R0.01-R0.07
验收标准：三类档案表完成建模；账号与档案可独立判断；注册自动补 `client_profile` 的前提已满足。

- [x] R1.02 重建 `owner_supplies` 与 `owner_pilot_bindings` 表，吸收历史 `rental_offers`、`pilot_drone_bindings` 语义
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`、`backend/internal/model`
依赖：R1.01
验收标准：供给能力、服务场景、价格规则、是否接受直达下单、绑定飞手生命周期都可落库，且供给能表达重载准入信息。

- [x] R1.03 创建 `demands / demand_quotes / demand_candidate_pilots / matching_logs` v2 表
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
影响范围：`backend/migrations`、`backend/internal/model`
依赖：R1.01
验收标准：需求、报价、候选飞手、匹配日志四类对象可独立建模，并支持后续 API v2 写入。

- [x] R1.04 扩展 `orders` 表，加入 `order_source / source_supply_id / provider_confirmed_at / provider_reject_reason / execution_mode / needs_dispatch`
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`、`backend/internal/model`
依赖：R1.01、R1.02、R1.03
验收标准：订单既能表达 `需求转单`，也能表达 `供给直达下单`，且来源追溯不丢失。

- [x] R1.05 新建 `order_snapshots / refunds / dispute_records`，把履约与财务辅助对象补齐
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
影响范围：`backend/migrations`、`backend/internal/model`
依赖：R1.04
验收标准：订单快照、退款、争议都有明确表结构，不再依赖松散历史字段；订单创建、支付、取消、派单转执行单链路会真实写入快照与退款记录。

- [x] R1.06 重定义 `dispatch_tasks / dispatch_logs`，确保其语义固定为“订单对飞手的一次正式派单”
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
影响范围：`backend/migrations`、`backend/internal/model`
依赖：R1.04
验收标准：派单状态、派单来源、重派次数、日志语义固定，和旧的“飞手任务池”彻底切开；旧任务池显式迁到 `dispatch_pool_*`，正式派单会随飞手接单真实写入新 `dispatch_tasks / dispatch_logs`。

- [x] R1.07 重建 `flight_records / flight_positions / flight_alerts` 与订单、派单的关联方式
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`、`backend/internal/model`、`backend/internal/repository`、`backend/internal/service`
依赖：R1.04、R1.06
验收标准：飞行记录只承接履约飞行；`flight_positions / flight_alerts` 已挂接 `flight_record_id`；飞行距离、时长、高度可由真实订单执行数据计算；飞手中心统计优先读取履约飞行记录而不是旧手工日志。

- [x] R1.08 建立迁移映射表与迁移审计表，专门记录旧表到新表映射关系
关联文档：[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`
依赖：R1.01-R1.07
验收标准：存在可回查的通用迁移映射表；存在通用迁移审计表；历史直达订单、正式派单、退款、飞行记录等不确定数据进入审计表而不是污染目标表。

- [x] R1.09 落地平台重载准入字段与校验规则，确保低于门槛的无人机和供给不进入主市场
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`、`backend/internal/model`、`backend/internal/repository`、`backend/internal/service`
依赖：R1.02、R1.08
验收标准：`mtow_kg` 与 `max_payload_kg` 门槛有统一校验；非目标历史数据不进入 v2 主匹配池。

## 6. 阶段 2：后端领域服务重构

- [x] R2.01 重构账号与初始化服务，输出统一的 `RoleSummary`
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/service`、`backend/internal/repository`、`backend/internal/api`
依赖：R1.01
验收标准：`/api/v2/me` 所需角色摘要可完全由后端计算，不依赖前端拼装。

- [x] R2.02 重构客户域服务，支持自动客户档案、需求创建、需求详情、需求转单
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/service/client_*`、`backend/internal/service/demand_*`
依赖：R1.01、R1.03、R1.04
验收标准：创建需求、查看我的需求、查看报价、选择机主转单全部走新服务。

- [x] R2.03 重构机主域服务，支持档案、无人机、供给、绑定飞手、机主报价
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/service/drone_*`、`backend/internal/service/owner_*`
依赖：R1.02、R1.03、R1.09
验收标准：供给与绑定飞手不再混用旧字段；报价、供给、设备能力统一口径，并落实重载准入校验。

- [x] R2.04 重构飞手域服务，支持认证、在线状态、候选报名、派单接受/拒绝、飞行记录聚合
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/service/pilot_*`、`backend/internal/service/flight_*`
依赖：R1.01、R1.03、R1.06、R1.07
验收标准：飞手身份与执行能力被拆清；候选报名与正式派单语义不再混淆。

- [x] R2.05 重构撮合服务，统一需求推荐、报价流转、候选飞手池、机主风险评估
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：`backend/internal/service/matching_*`、`backend/internal/repository`
依赖：R1.03、R2.02、R2.03、R2.04
验收标准：机主推荐、候选池、报价状态更新有统一入口，日志可追踪。

- [x] R2.06 重构订单服务，统一处理 `demand_market` 与 `supply_direct` 两条来源链路
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/service/order_*`
依赖：R1.04、R2.02、R2.03
验收标准：需求转单、直达下单、机主确认直达订单、支付后进入派单/自执行都能走通。

- [x] R2.07 重构派单服务，实现固定调度优先级、自动重派、异常回退
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：`backend/internal/service/dispatch_*`
依赖：R1.06、R2.04、R2.06
验收标准：调度优先级严格执行；拒绝/超时/异常会自动重派；超过上限后回退人工处理。

- [x] R2.08 重构飞行服务，按真实履约数据汇总飞行统计与飞行记录
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
影响范围：`backend/internal/service/flight_*`
依赖：R1.07、R2.04、R2.06、R2.07
验收标准：飞行次数、时长、距离、最大高度都来自订单履约记录，不再出现演示假数据。

- [x] R2.09 重构通知与事件服务，集中处理需求、报价、订单、派单、资质事件
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/service/message_*`、`backend/internal/pkg/push`、`backend/internal/pkg/sms`
依赖：R2.02-R2.08
验收标准：关键自动触发事件都有统一通知入口，不再散落在页面逻辑里。

## 7. 阶段 3：API v2 实现与路由切换

- [x] R3.01 建立 `/api/v2` 路由骨架、统一响应结构、错误码与分页中间件
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api`、`backend/internal/pkg/response`
依赖：R2.01
验收标准：存在独立 v2 路由与 handler 目录；响应结构和错误格式统一。

- [x] R3.02 落地认证与初始化接口：`register / login / me`
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api/v2/auth`、`backend/internal/api/v2/me`
依赖：R2.01、R3.01
验收标准：注册自动创建客户档案；`/api/v2/me` 能返回角色摘要和能力摘要。

- [x] R3.03 落地客户域接口：供给市场、供给详情、直达下单、需求管理、需求转单
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api/v2/client`、`backend/internal/api/v2/demand`、`backend/internal/api/v2/supply`
依赖：R2.02、R2.03、R2.06
验收标准：客户既能发布需求，也能从供给详情发起直达下单；接口不会返回不符合平台范围的供给。

- [x] R3.04 落地机主域接口：档案、无人机、供给、报价、绑定飞手
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api/v2/owner`、`backend/internal/api/v2/drone`
依赖：R2.03、R3.01
验收标准：机主全部经营类动作都能通过 v2 接口完成。

- [x] R3.05 落地飞手域接口：档案、在线状态、候选报名、派单响应、飞行记录
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api/v2/pilot`、`backend/internal/api/v2/flight`
依赖：R2.04、R3.01
验收标准：飞手接口不再混入订单承接语义，只处理候选、派单、执行。

- [x] R3.06 落地订单与派单接口：订单列表、订单详情、机主确认直达订单、派单、重派、监控
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api/v2/order`、`backend/internal/api/v2/dispatch`
依赖：R2.06、R2.07、R3.01
验收标准：订单详情能完整返回来源信息、承接方、执行方、当前派单和财务摘要。

- [x] R3.07 落地财务、通知、争议相关接口
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/internal/api/v2/payment`、`backend/internal/api/v2/notification`、`backend/internal/api/v2/settlement`
依赖：R2.08、R2.09、R3.01
验收标准：支付、退款、结算、通知、争议都具备 v2 查询和动作接口。

- [x] R3.08 生成 v2 OpenAPI 文档并建立 v1/v2 差异对照
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`backend/docs`
依赖：R3.02-R3.07
验收标准：开发与联调可直接参考 API 文档，v1 与 v2 切换边界清晰。

## 8. 阶段 4：移动端基础重构

- [x] R4.01 重构移动端应用初始化，接入 `RoleSummary` 与 v2 API 客户端
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`mobile/src` 全局状态、服务层、导航初始化
依赖：R3.02
验收标准：移动端不再用旧 `user_type` 做角色主判断；首页和我的页能读取统一角色摘要。

- [x] R4.02 重构一级导航为 `首页 / 市场 / 履约 / 消息 / 我的`
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：`mobile/src/navigation`、各 tab 容器
依赖：R4.01
验收标准：新导航结构稳定，旧的混合入口被移除或迁走。

- [x] R4.03 建立统一状态徽标、来源标签、卡片组件与空状态组件
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：`mobile/src/components`
依赖：R4.01
验收标准：需求、供给、订单、派单任务、飞行记录的视觉表达有统一组件，不再各页各写一套。

- [x] R4.04 清理旧的角色切换和首页临时判断逻辑，为新驾驶舱提供稳定数据入口
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：[HomeScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/home/HomeScreen.tsx) 及相关 hooks
依赖：R4.01、R4.03
验收标准：首页只消费后端返回的角色摘要和聚合数据，不再自己推断业务角色。

## 9. 阶段 5：移动端市场域重构

- [x] R5.01 重构首页驾驶舱，按综合/客户/机主/飞手四种视图展示优先动作
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[HomeScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/home/HomeScreen.tsx)
依赖：R4.02-R4.04、R3.03-R3.05
验收标准：首页不截断、不混角色；客户能立刻发需求/看供给，机主能看新需求，飞手能看待接派单。

- [x] R5.02 新建供给市场、供给详情、直达下单确认页面
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`mobile/src/screens` 新增 supply 相关页面或重构现有 offer 页面
依赖：R3.03、R4.02、R4.03
验收标准：客户可从供给市场进入供给详情并发起直达下单；提交后看到待机主确认状态；页面筛选与文案体现重载吊运场景而非同城配送。

- [x] R5.03 重构需求市场与需求详情，明确机主报价入口和飞手候选报名入口
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[DemandListScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/demand/DemandListScreen.tsx)、[DemandDetailScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/demand/DemandDetailScreen.tsx)
依赖：R3.03、R3.04、R3.05、R4.03
验收标准：机主与飞手在需求详情看到不同的合法动作，且不混入订单信息。

- [x] R5.04 重构我的需求、我的报价、我的供给页面
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：`mobile/src/screens/profile/MyDemandsScreen.tsx`、`mobile/src/screens/profile/MyOffersScreen.tsx`、供给相关页面
依赖：R3.03、R3.04、R4.02
验收标准：需求、报价、供给三类列表彻底分离，编号、状态、操作入口一致。

- [x] R5.05 重构供给发布与编辑流程，对接机主无人机与价格规则
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
影响范围：[PublishOfferScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/publish/PublishOfferScreen.tsx) 或对应替代页面
依赖：R3.04、R4.03
验收标准：供给创建时能设置服务能力、价格规则、时间段、是否接受直达下单。

## 10. 阶段 6：移动端履约域重构

- [x] R6.01 重构订单列表，按 `订单` 对象展示，并显示来源标签、状态、承接方/执行方摘要
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[OrderListScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/order/OrderListScreen.tsx)
依赖：R3.06、R4.03
验收标准：列表与详情页状态一致、编号一致；不再把飞手任务重复展示成另一套订单。

- [x] R6.02 重构订单详情，固定展示来源、参与方、执行状态、财务状态、当前派单
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[OrderDetailScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/order/OrderDetailScreen.tsx)
依赖：R3.06、R6.01
验收标准：订单详情能解释清楚“谁承接、谁执行、是否自执行、是否经过派单、来源于需求还是供给”。

- [x] R6.03 加入直达下单待确认流：客户看待确认状态，机主可确认/拒绝
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：订单列表、订单详情、机主页待办
依赖：R3.06、R6.01、R6.02
验收标准：直达订单从提交到机主确认、再到支付的页面路径完整闭环。

- [x] R6.04 重构派单任务列表与详情，确保其只表达正式派单
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[DispatchTaskListScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/dispatch/DispatchTaskListScreen.tsx)、[DispatchTaskDetailScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/dispatch/DispatchTaskDetailScreen.tsx)
依赖：R3.06、R4.02、R4.03
验收标准：派单页不再混需求和订单；机主、飞手看到的派单状态口径一致。

- [x] R6.05 接通机主发起派单、飞手接收/拒绝、自动重派的移动端交互
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：派单创建页、派单详情页、飞手待办入口
依赖：R3.06、R6.04
验收标准：机主可按三层来源发起派单；飞手可接受/拒绝；重派后 UI 自动刷新。

- [x] R6.06 重构飞行监控入口，确保从订单详情和派单任务都能进入正确监控页面
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[FlightMonitoringScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/flight/FlightMonitoringScreen.tsx)
依赖：R3.06、R3.05、R6.02、R6.04
验收标准：订单详情存在合法监控入口；飞手中心不再出现“请从订单详情进入”但详情页又找不到入口的断链问题。

- [x] R6.07 重构飞行记录页，完全切换到真实履约飞行数据
关联文档：[BUSINESS_FIELD_DICTIONARY.md](../business/BUSINESS_FIELD_DICTIONARY.md)
影响范围：[FlightLogScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/pilot/FlightLogScreen.tsx) 或替代页面
依赖：R2.08、R3.05、R6.06
验收标准：飞行次数、时长、距离、高度均与履约记录一致，不再出现统计和列表脱节。

- [x] R6.08 重构支付、退款、评价与售后页面
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：[PaymentScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/order/PaymentScreen.tsx)、[ReviewScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/order/ReviewScreen.tsx)
依赖：R3.07、R6.02
验收标准：支付、退款、评价动作都挂在订单对象上，状态流与后端一致。

## 11. 阶段 7：移动端我的页、档案与消息域重构

- [x] R7.01 重构“我的”首页，展示账号卡、身份卡、能力卡、快捷入口
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[ProfileScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/profile/ProfileScreen.tsx)
依赖：R4.01、R4.03
验收标准：页面不再显示模糊 `user_type`；能明确看出客户/机主/飞手持有情况与可用能力。

- [x] R7.02 重构客户档案与地址信息页，取消“再次注册为客户”的重复动作
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：[ClientProfileScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/client/ClientProfileScreen.tsx)、[ClientRegisterScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/client/ClientRegisterScreen.tsx)
依赖：R3.03、R7.01
验收标准：默认注册用户直接拥有个人客户档案，不再看到不合理的重复注册入口。

- [x] R7.03 重构机主档案、无人机、供给管理入口
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：`mobile/src/screens/drone/*`、机主档案相关页面
依赖：R3.04、R7.01
验收标准：机主页面能完整管理档案、无人机、资质、供给。

- [x] R7.04 重构飞手档案、认证、在线状态与可服务区域设置
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：`mobile/src/screens/pilot/*`
依赖：R3.05、R7.01
验收标准：飞手认证、在线状态、接单能力、服务区域设置统一接入新接口。

- [x] R7.05 重构绑定飞手管理页，支持邀请、申请、确认、解除
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：新增绑定飞手相关页面或改造现有页面
依赖：R3.04、R7.03、R7.04
验收标准：绑定关系生命周期完整，且不会自动赋予执行权限。

- [x] R7.06 重构系统通知与会话消息，按业务事件分类而不是杂乱流
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：[ConversationListScreen.tsx](/Users/yinswc2e/Code/drone_Rental_platform_v1/mobile/src/screens/message/ConversationListScreen.tsx)、通知页
依赖：R2.09、R3.07、R4.02
验收标准：通知流里可区分需求、报价、订单、派单、资质事件；聊天不再承担正式状态确认。

## 12. 阶段 8：后台管理与运营适配

- [x] R8.01 梳理后台管理端对新角色模型的适配范围
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：`admin/src`
依赖：R3.03-R3.07
验收标准：明确后台需要新增或改造的列表、详情、审核、查询入口。

- [x] R8.02 改造后台的需求、供给、订单、派单、飞行记录管理页
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)、[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：`admin/src`
依赖：R8.01
验收标准：后台可按新对象模型查询、审核、追踪，不再依赖旧混合语义字段。

- [x] R8.03 增加迁移审计与异常订单运营看板
关联文档：[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`admin/src`、后端统计接口
依赖：R1.08、R8.02
验收标准：运营可以看到未迁移成功数据、来源缺失订单、状态异常订单。

## 13. 阶段 9：数据迁移、双读校验与切流

- [x] R9.01 编写建表迁移脚本，按高位编号落到 `backend/migrations`
关联文档：[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`
依赖：R1.01-R1.08
验收标准：结构迁移脚本幂等、可回滚、和数据回填脚本分离。

- [x] R9.02 编写历史数据回填脚本，完成档案、需求、订单、派单、飞行记录映射
关联文档：[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/migrations`、辅助脚本目录
依赖：R9.01
验收标准：历史数据能批量回填；来源不清数据进入审计清单；不确定数据不静默写入主表；不符合平台范围的历史数据不进入主市场口径。

- [x] R9.03 建立双读校验工具，对比 v1/v2 在关键列表和详情页上的结果
关联文档：[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：后端服务、管理脚本、测试工具
依赖：R3.02-R3.07、R9.02
验收标准：首页、订单列表、派单列表、飞行统计都能输出新旧对比结果。

- [x] R9.04 先切移动端到 v2，再切后台到 v2，最后冻结 v1 写入
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)
影响范围：移动端、后台、后端网关
依赖：R3.08、R5.01-R7.06、R8.02、R9.03
验收标准：新页面默认走 v2；旧接口仅保留只读兼容或彻底下线计划。

- [x] R9.05 清理旧 `user_type` 主判断逻辑、旧订单混合展示逻辑、旧飞手任务兼容逻辑
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：后端服务、移动端页面、后台页面
依赖：R9.04
验收标准：系统主链路不再依赖旧字段和旧页面语义。

## 14. 阶段 10：测试、验收与收尾

- [x] R10.01 补齐后端单元测试、服务层测试、关键集成测试
关联文档：[BUSINESS_API_CONTRACT.md](../business/BUSINESS_API_CONTRACT.md)、[BUSINESS_DATABASE_MIGRATION_PLAN.md](../business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
影响范围：`backend/internal/service`、`backend/internal/repository`、测试目录
依赖：R2.01-R2.09、R3.01-R3.07
验收标准：需求转单、直达下单、派单重派、飞行统计、退款等关键流程都有自动化测试。

- [x] R10.02 补齐移动端关键页面回归清单与截图验收标准
关联文档：[BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
影响范围：`mobile/__tests__`、项目测试文档
依赖：R5.01-R7.06
验收标准：首页、供给市场、需求市场、订单、派单、飞行记录、我的页均有回归清单。

- [x] R10.03 做角色视角的业务验收：客户、机主、飞手、复合身份各跑一遍主链路
关联文档：[BUSINESS_ROLE_REDESIGN.md](../business/BUSINESS_ROLE_REDESIGN.md)
影响范围：全项目
依赖：R10.01、R10.02
验收标准：四种角色主链路均能跑通，且不存在角色误导、状态错位、编号错位、入口断链。

- [x] R10.04 更新项目总测试文档、部署清单、演示账号说明
关联文档：[TEST_CHECKLIST.md](../testing/TEST_CHECKLIST.md)
影响范围：项目根目录文档
依赖：R10.03
验收标准：测试与演示文档和新业务模型一致，后续接手人可直接按文档验收。

## 15. 当前建议执行顺序

1. 先做阶段 1 和阶段 2，锁死后端领域模型与状态机。
2. 再做阶段 3，保证 v2 API 可联调。
3. 然后做阶段 4 到阶段 7，按页面域分批切移动端。
4. 后台管理放在阶段 8，不阻塞第一版移动端主链路重构。
5. 最后做阶段 9 和阶段 10，完成数据切流与回归验收。

## 16. 后续更新要求

后续每次完成任务时，必须同步做三件事：

1. 勾选本文件对应任务
2. 更新被影响的业务文档或接口文档
3. 在最终汇报中注明完成的任务编号
