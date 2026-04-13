# 手工测试前项目彻底测试任务总表

## 1. 目的

本文件用于在手工打开 App 前，把本次重构后的项目测试工作收成一份可执行、可复查、可持续回写的总表。

目标：

1. 先基于重构文档、迁移文档、验收文档和代码结构，准确理解当前项目状态
2. 提前发现会影响后续手工测试的问题，包括编译失败、构建失败、启动报错、路由断链、接口异常、状态错乱、依赖缺失、配置错误、重构遗留问题等
3. 把自动可执行的检查项尽量前置完成，减少手工测试阶段的低级阻塞
4. 为后续人工回归提供一份可直接跟进的稳定性基线

## 2. 使用规则

- 状态标记统一使用：`[ ]` 未开始、`[~]` 执行中、`[x]` 已完成、`[!]` 发现问题
- 每个小阶段完成后必须做一次复查，再进入下一小阶段
- 每个大阶段完成后必须做一次阶段复查，再进入下一大阶段
- 若发现问题，优先记录：现象、影响、定位线索、修复建议、是否阻塞
- 若问题可安全修复，可先修复并复验；若不适合当前回合直接修复，也必须明确记录
- 本文件既是测试任务总表，也是本轮自动执行记录

最近一次基线建立时间：`2026-03-15`

## 3. 当前项目状态理解

### 3.1 文档基线结论

基于以下文档整理：

- [REFACTOR_MASTER_TASKLIST.md](../planning/REFACTOR_MASTER_TASKLIST.md)
- [REFACTOR_TASK_TRACKER.md](../planning/REFACTOR_TASK_TRACKER.md)
- [ROLE_ACCEPTANCE_WALKTHROUGH.md](./ROLE_ACCEPTANCE_WALKTHROUGH.md)
- [MOBILE_REGRESSION_ACCEPTANCE.md](./MOBILE_REGRESSION_ACCEPTANCE.md)
- [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md)
- [PHASE9_MIGRATION_RUNBOOK.md](/Users/yinswc2e/Code/drone_Rental_platform_v1/backend/docs/PHASE9_MIGRATION_RUNBOOK.md)

当前共识：

1. 主业务模型已切换为 `客户 / 机主 / 飞手 / 复合身份`
2. 主对象已切换为 `需求 / 供给 / 订单 / 正式派单 / 飞行记录`
3. 移动端和后台默认主链路已指向 `/api/v2`
4. 阶段 10 已有角色验收脚本、移动端页面回归基线、演示账号说明
5. 阶段 9 已有独立迁移脚本、回填脚本和双读校验要求

### 3.2 当前项目结构

- 后端：`backend`，Go + Gin + Gorm + MySQL + Redis
- 移动端：`mobile`，React Native + React Native Web + Vite
- 后台：`admin`，React + Vite
- 演示预览：`mobile-preview`
- 自动验收脚本：`backend/scripts/phase10_role_acceptance.sh`

### 3.3 重点业务主链路

1. 客户链路：登录 -> `me` -> 首页 -> 供给市场 -> 供给详情 -> 直达下单 -> 机主确认 -> 支付 -> 订单详情
2. 需求链路：客户创建需求 -> 发布 -> 机主查看推荐需求 -> 提交报价 -> 客户选机主 -> 支付 -> 订单进入 `pending_dispatch`
3. 飞手链路：登录 -> `me` -> 飞手档案 -> 候选需求 -> 报名 -> 正式派单 -> 接受/拒绝 -> 飞行记录
4. 复合身份链路：登录 -> 综合首页 -> 机主入口 -> 飞手入口 -> 双角色能力入口都可达
5. 履约链路：订单详情 -> 发起正式派单 -> 飞手接受 -> 飞行监控 -> 飞行记录/统计

### 3.4 关键依赖

- MySQL `127.0.0.1:3306`
- Redis `127.0.0.1:6379`
- 后端服务 `http://127.0.0.1:8080`
- Node 依赖：`mobile/node_modules`、`admin/node_modules` 已存在
- 自动化工具：`go`、`npm`、`curl`、`jq`、`redis-cli`、`mysql`

### 3.5 当前高风险点

1. 项目仍处于 `v1/v2` 并存阶段，移动端存在旧常量、旧默认地址、旧语义残留风险
2. API v2 路由中仍有部分 `NotImplemented` 端点，可能导致页面入口可见但动作不可执行
3. 重载准入依赖 `mtow_kg / max_payload_kg / certification` 等数据，演示数据不足会直接导致供给或报价链路断裂
4. 验收脚本会整理样本数据，说明当前环境对样本质量有依赖
5. Web/RN 双入口并存，页面路由、导航参数和 Web 包装器容易出现断链
6. Token 刷新、并发请求、异步刷新列表、角色切换等地方存在竞态和状态回退风险

## 4. 测试阶段总览

| 阶段 | 目标 | 当前状态 |
|------|------|----------|
| 阶段 A | 文档、结构、风险基线复核 | `[!]` |
| 阶段 B | 依赖、配置、环境、样本基线检查 | `[x]` |
| 阶段 C | 编译、构建、静态质量检查 | `[!]` |
| 阶段 D | 启动、健康检查、路由与模块加载检查 | `[x]` |
| 阶段 E | 核心业务流程与接口链路验收 | `[x]` |
| 阶段 F | 异常、边界、重构残留与回归检查 | `[!]` |
| 阶段 G | 手工测试前稳定性确认与结论汇总 | `[x]` |

## 5. 测试任务总表

## 5.1 阶段 A：文档、结构、风险基线复核

- [x] A1.01 重构文档与验收文档一致性复核
目标：确认重构主线、阶段 9/10 结论、验收样本和当前代码口径一致。
检查内容：重构任务总表、阶段 10 验收文档、演示账号说明、迁移 runbook 是否互相矛盾。
执行方式：阅读并比对核心文档与代码入口。
风险点：文档口径已更新但代码未落地，导致测试范围误判。
预期结果：主对象、角色体系、API 默认版本、阶段 10 资产一致。
完成标准：可明确列出本轮自动测试的主链路、依赖和风险。
状态标记：`[ ]`

- [x] A1.02 项目结构与核心模块映射复核
目标：识别前后端入口、主要模块和业务域边界。
检查内容：后端路由、服务、仓储；移动端导航、页面、服务；后台路由与 API 入口。
执行方式：检查目录结构、入口文件、核心路由定义。
风险点：页面/服务存在入口但未接入或仍指向旧域。
预期结果：能建立“模块 -> 接口 -> 页面/流程”的映射。
完成标准：形成模块清单和风险清单。
状态标记：`[ ]`

- [!] A1.03 v2 主链路与未完成区域识别
目标：识别主链路、过渡逻辑和未实现动作。
检查内容：API v2 路由、`NotImplemented` 端点、移动端仍依赖 v1 的服务或常量。
执行方式：代码搜索、路由检查、服务基址检查。
风险点：页面能打开但动作点击后失败。
预期结果：列出高风险断链点和需重点关注的页面。
完成标准：形成后续阶段的重点测试清单。
状态标记：`[ ]`

## 5.2 阶段 B：依赖、配置、环境、样本基线检查

- [x] B1.01 本地依赖与工作区基线检查
目标：确认仓库可执行测试所需依赖已就绪。
检查内容：`node_modules`、Go 模块、脚本依赖、Git 工作区状态。
执行方式：读取目录、检查依赖存在、查看当前变更。
风险点：依赖缺失、脏工作区混入未完成改动、脚本工具不存在。
预期结果：能安全执行后续编译、构建和验收命令。
完成标准：依赖/工具缺失项被明确记录。
状态标记：`[ ]`

- [x] B1.02 后端配置与基础服务连通性检查
目标：确认后端配置、MySQL、Redis、端口约定和运行方式可支撑测试。
检查内容：`backend/config.yaml`、数据库/Redis 地址、服务监听端口、状态接口。
执行方式：读配置、调用状态接口、必要时检查 Docker/本地服务状态。
风险点：配置存在但真实服务未启动或连不上。
预期结果：本地环境满足自动验收前提。
完成标准：至少确认 MySQL、Redis、后端服务状态是否可用。
状态标记：`[ ]`

- [x] B1.03 阶段 9 / 阶段 10 样本与迁移前提检查
目标：确认角色验收依赖的数据基础存在。
检查内容：迁移执行假设、样本账号、演示数据整理要求、直达供给/需求转单产物前提。
执行方式：阅读 runbook、验收脚本、必要时通过接口或数据库验证。
风险点：自动验收脚本前提不成立导致误判为代码问题。
预期结果：确认是否需要样本整理、哪些数据是预期依赖。
完成标准：能解释当前自动验收对数据的依赖边界。
状态标记：`[ ]`

## 5.3 阶段 C：编译、构建、静态质量检查

- [x] C1.01 后端单元测试与编译检查
目标：提前发现后端编译错误、类型错误、测试失败。
检查内容：`go test ./...`、关键服务/仓储包测试、命令入口编译能力。
执行方式：执行 Go 测试与必要的构建命令。
风险点：重构后接口改名、仓储签名变化、隐藏的编译断裂。
预期结果：后端测试通过或得到明确失败点。
完成标准：完成 Go 自动化检查并记录结果。
状态标记：`[ ]`

- [x] C1.02 移动端 TypeScript 与 Web 构建检查
目标：提前发现 App 页面、导航、类型定义、Web 包装层的编译问题。
检查内容：`npx tsc --noEmit`、`npm run web:build`。
执行方式：在 `mobile` 目录执行类型检查和构建。
风险点：导航参数、服务 DTO、页面引用、资源路径和 Web 兼容层问题。
预期结果：移动端类型检查通过，Web 构建可完成。
完成标准：输出通过或失败原因，并记录阻塞程度。
状态标记：`[ ]`

- [x] C1.03 后台管理端构建检查
目标：确认阶段 8 / 阶段 9 的后台适配未在重构后失效。
检查内容：`admin` 的 TypeScript 编译和 Vite 构建。
执行方式：在 `admin` 目录执行 `npm run build`。
风险点：后台虽然不是 App 主链路，但迁移审计/运营页失效会影响问题定位。
预期结果：后台可成功构建。
完成标准：构建通过或记录明确失败点。
状态标记：`[ ]`

- [!] C1.04 静态残留风险扫描
目标：提前发现显式未实现、旧语义残留、潜在断链点。
检查内容：`NotImplemented`、`TODO`、`FIXME`、移动端 `api/v1` 使用残留、硬编码地址。
执行方式：代码搜索与人工归类。
风险点：构建通过但运行期动作失败或请求打错地址。
预期结果：形成需重点验证或后续修复的残留问题列表。
完成标准：残留风险被记录并按阻塞性分类。
状态标记：`[ ]`

- [x] C1.05 React Native Android 原生构建检查
目标：确认移动端不仅能做 Web 构建，也能满足 Android 原生运行前提。
检查内容：`react-native doctor` Android 项、JDK/SDK 版本、Gradle Wrapper、`assembleDebug` 或等价构建。
执行方式：诊断环境后执行 Android 原生构建命令，必要时定位 JDK/SDK/Gradle 问题。
风险点：Web 正常但 Android 真机/模拟器完全无法编译。
预期结果：Android 原生工程可解释地通过，或得到明确阻塞点。
完成标准：形成可执行的 Android 运行结论。
状态标记：`[ ]`

- [x] C1.06 React Native iOS 原生构建检查
目标：确认移动端满足 iOS 原生运行前提。
检查内容：`react-native doctor` iOS 项、Pods、workspace、Xcode 构建。
执行方式：检查 iOS 工程依赖并执行模拟器构建或等价验证。
风险点：Web 正常但 iOS 原生工程无法编译或依赖残缺。
预期结果：iOS 原生工程可解释地通过，或得到明确阻塞点。
完成标准：形成可执行的 iOS 运行结论。
状态标记：`[ ]`

## 5.4 阶段 D：启动、健康检查、路由与模块加载检查

- [x] D1.01 服务健康与基础接口检查
目标：确认系统最基础的可启动性和响应性。
检查内容：后端 `/api/v2/status`、认证发码、登录、`/api/v2/me`。
执行方式：调用状态接口与最小认证链路。
风险点：服务虽然进程存在，但认证、Redis、JWT 或 DB 仍不可用。
预期结果：基础状态、登录和角色摘要接口正常。
完成标准：至少一个账号可成功完成登录并拉取 `me`。
状态标记：`[ ]`

- [x] D1.02 角色入口与首页数据加载检查
目标：确认重构后的角色识别与首页驾驶舱不会第一屏就断。
检查内容：客户、机主、飞手、复合身份的 `/api/v2/me` 与 `/api/v2/home/dashboard`。
执行方式：使用演示账号逐个调用接口并检查角色摘要字段。
风险点：角色能力错位、入口展示错误、首页混入错误模块。
预期结果：4 类角色都能返回合理能力摘要与首页数据。
完成标准：角色摘要与文档基线一致。
状态标记：`[ ]`

- [x] D1.03 移动端 Web 路由与关键页面加载检查
目标：确认 Web 预览对应的关键页面路由至少可以被打通。
检查内容：首页、市场、履约、我的，以及关键详情页包装路由是否存在。
执行方式：静态检查 Web 路由定义，必要时启动本地预览服务做基础探测。
风险点：RN 页面存在但 Web 路由缺失或参数包装器失效。
预期结果：关键页面均有对应路由入口和包装逻辑。
完成标准：主页面和关键详情路由清单完整。
状态标记：`[ ]`

- [x] D1.04 模块加载与依赖引用检查
目标：确认页面、服务、资源、导航和上传等模块引用完整。
检查内容：入口组件、服务导入、上传目录、图片/地图/推送等配置依赖。
执行方式：结合构建结果与代码抽查。
风险点：运行时模块找不到、图片地址错误、资源路径失效。
预期结果：关键模块加载链路完整。
完成标准：无新的阻塞性资源/模块缺失。
状态标记：`[ ]`

## 5.5 阶段 E：核心业务流程与接口链路验收

- [x] E1.01 客户主链路自动验收
目标：验证客户从登录到下单/支付/看订单的主流程。
检查内容：供给市场、供给详情、直达下单、需求创建、需求发布、查看报价、选择机主、支付、订单详情。
执行方式：优先使用阶段 10 角色验收脚本和补充接口调用。
风险点：对象混页、状态不一致、支付后不进派单、订单来源错乱。
预期结果：至少一条需求转单链路和一条直达下单链路成功。
完成标准：客户主链路通过，编号与状态一致。
状态标记：`[ ]`

- [x] E1.02 机主主链路自动验收
目标：验证机主经营侧关键动作。
检查内容：机主档案、无人机列表、推荐需求、提交报价、供给创建、直达订单确认。
执行方式：角色验收脚本 + 针对性接口复查。
风险点：重载准入导致供给创建失败、报价接口异常、经营页混入旧语义。
预期结果：机主经营主链路可用。
完成标准：至少一个供给、一个报价、一个直达确认动作成功。
状态标记：`[ ]`

- [x] E1.03 飞手主链路自动验收
目标：验证飞手履约侧关键动作。
检查内容：飞手档案、在线状态、候选需求、报名候选、正式派单、接受/拒绝、飞行记录。
执行方式：角色验收脚本 + 接口复查。
风险点：候选池、正式派单和订单对象混淆；飞行记录统计不一致。
预期结果：至少一条正式派单可见并可响应。
完成标准：飞手主链路通过。
状态标记：`[ ]`

- [x] E1.04 复合身份导航与双能力入口验收
目标：验证复合身份不会被错误降级为单角色视图。
检查内容：综合首页、机主入口、飞手入口、双能力导航。
执行方式：角色验收脚本 + `me/dashboard` 响应复查。
风险点：角色判断仍依赖旧 `user_type`，导致入口消失或错位。
预期结果：复合身份能同时进入经营与履约入口。
完成标准：双入口可见且可达。
状态标记：`[ ]`

- [x] E1.05 订单、正式派单、飞行监控对象边界验收
目标：确认订单、派单、飞行监控对象边界清晰，避免重构回退。
检查内容：订单列表/详情、正式派单列表/详情、监控入口、飞行记录统计。
执行方式：接口检查 + 路由/页面实现抽查。
风险点：需求/订单/派单对象混页，编号或状态口径不一致。
预期结果：三个对象的编号、状态、来源、动作边界清晰。
完成标准：找不到明显对象错位和断链。
状态标记：`[ ]`

## 5.6 阶段 F：异常、边界、重构残留与回归检查

- [x] F1.01 错误处理与容错检查
目标：确认服务不可用、未授权、空数据、异常数据时系统表现可控。
检查内容：认证失败、权限不足、空列表、接口错误、未实现动作的返回格式。
执行方式：构造最小失败请求、检查统一响应格式。
风险点：页面崩溃、前端无提示、错误对象结构不一致。
预期结果：错误返回结构稳定，关键异常可识别。
完成标准：主要异常类场景有明确记录。
状态标记：`[ ]`

- [x] F1.02 空值、边界条件与状态流转检查
目标：尽量提前发现空值、边界状态、状态跳变异常。
检查内容：无数据列表、空报价、已报名后重复报名、状态终态、无派单时飞行监控入口等。
执行方式：接口响应抽查、静态逻辑检查、自动验收结果复核。
风险点：边界条件只在手工测试时爆雷。
预期结果：高频边界场景已覆盖并有结论。
完成标准：形成边界问题清单或确认无阻塞发现。
状态标记：`[ ]`

- [!] F1.03 异步、竞态与刷新一致性检查
目标：识别登录刷新、支付后刷新、派单重派、候选报名后列表变化等异步问题。
检查内容：Token 刷新队列、状态刷新、列表去重、角色切换与页面刷新逻辑。
执行方式：代码检查 + 自动链路结果比对。
风险点：重复提交、页面状态滞后、竞态导致旧数据覆盖新状态。
预期结果：识别出明显竞态或确认关键路径设计合理。
完成标准：异步风险得到记录和分级。
状态标记：`[ ]`

- [!] F1.04 重构影响面回归检查
目标：检查重构是否遗留旧入口、旧接口、旧文案和旧语义。
检查内容：移动端 `api/v1` 残留、硬编码 cpolar 地址、旧业务常量、后台 `/api/v2` 切换、v1 写入冻结口径。
执行方式：代码搜索、配置检查、接口抽查。
风险点：手工测试时命中旧接口或旧文案，导致假回归。
预期结果：明确哪些是已知过渡逻辑，哪些是应修复残留。
完成标准：输出一份重构残留风险清单。
状态标记：`[ ]`

## 5.7 阶段 G：手工测试前稳定性确认与结论汇总

- [x] G1.01 全阶段复查
目标：对前述阶段结果做一次总复盘，避免遗漏阻塞项。
检查内容：所有已执行结果、问题清单、复验结果、未覆盖风险。
执行方式：逐阶段回看记录并校正状态。
风险点：单项通过但全局仍存在阻塞性组合问题。
预期结果：形成可信的“可手工测试 / 不建议手工测试”结论。
完成标准：阶段状态、阻塞项和建议清晰。
状态标记：`[ ]`

- [x] G1.02 手工测试前最终建议输出
目标：给出后续人工测试的进入建议、优先顺序和注意事项。
检查内容：阻塞项、非阻塞项、推荐先测页面、推荐账号、推荐复现场景。
执行方式：汇总输出。
风险点：用户进入手工测试时仍踩到已知坑但没有预警。
预期结果：得到可直接执行的手工测试前说明。
完成标准：最终结论和建议完整。
状态标记：`[ ]`

## 6. 执行记录

## 6.1 阶段 A 执行记录

- 当前状态：`已完成，发现问题`
- 记录：
  - 当前在检查什么：对齐重构主文档、阶段 9/10 验收文档、前后端入口与 v2 路由，确认当前测试边界
  - 为什么检查这一项：如果文档口径和实际代码不一致，后续所有自动测试都会失焦
  - 检查结果：
    - 文档主线一致，当前主模型已明确为 `角色能力 + v2 业务对象`
    - 阶段 10 已有可执行资产：角色验收脚本、移动端关键页面回归基线、演示账号说明
    - 项目结构清晰，后端 `backend`、移动端 `mobile`、后台 `admin` 分工明确
    - 移动端原生导航与 Web 路由都覆盖首页、市场、履约、我的以及主要详情/动作页
  - 发现的问题：
    - `backend/internal/api/v2/router.go` 仍有 11 个 `NotImplemented` 入口，集中在订单取消/履约推进、飞行记录写入、会话消息查询
    - `mobile/src/constants/index.ts` 和 `mobile/src/utils/config.web.ts` 仍默认硬编码 `cpolar` 的 `/api/v1` 地址，并启用了 `USE_CPOLAR_FOR_TESTING = true`
    - 移动端仍同时保留 `api`(v1) 与 `apiV2` 客户端，说明旧接口残留风险仍在
  - 修复建议或处理动作：
    - 后续重点验证所有可能命中 `NotImplemented` 的页面入口，避免手工测试时点击即失败
    - 手工测试前优先确认移动端实际运行环境是否已通过 `.env` 或打包配置覆盖掉旧 `cpolar/v1` 默认值
    - 对保留 v1 客户端的页面做一次重点回归，确认不会误走旧写接口
  - 复查结果：
    - 阶段 A 的目标已经完成，当前自动测试范围可确定为“以 v2 主链路为主，兼顾 v1 过渡残留排查”
    - 风险点已足够明确，可进入环境与构建阶段
  - 当前状态 / 当前进度：`阶段 A 完成，整体进度约 15%`

## 6.2 阶段 B 执行记录

- 当前状态：`已完成`
- 记录：
  - 当前在检查什么：本地依赖、服务连通性、阶段 10 样本基线和自动验收前提
  - 为什么检查这一项：编译和流程测试的结论必须建立在真实可运行的环境之上
  - 检查结果：
    - `mobile/node_modules`、`admin/node_modules`、`backend` 目录均存在
    - `go`、`npm`、`jq`、`redis-cli`、`mysql` 均可用；`node -v` 为 `v22.22.0`
    - Docker 中 `wurenji-mysql` 与 `wurenji-redis` 均处于运行状态
    - `curl http://127.0.0.1:8080/api/v2/status` 返回 `{"status":"ready","version":"v2"}`
    - `redis-cli PING` 返回 `PONG`
    - MySQL 查询 `SELECT 1` 成功
    - `backend/docs/phase10_role_acceptance_last_run.json` 与文档一致，最近一次稳定验收时间为 `2026-03-15T12:13:06+08:00`
  - 发现的问题：
    - 当前 Git 工作区存在大量未提交改动，后续结果需要避免误把在途重构改动当作测试引入问题
    - 阶段 10 脚本默认可整理演示数据并重置样本无人机/订单状态，属于测试前提的一部分
  - 修复建议或处理动作：
    - 后续执行自动验收时，明确把“脚本会整理样本数据”记入结果解释
    - 对任何失败项都先区分为“环境/数据前提失败”还是“代码逻辑失败”
  - 复查结果：
    - 环境满足继续执行阶段 C、D、E 的前提
    - 当前没有阻塞性依赖缺失或基础服务不可用问题
  - 当前状态 / 当前进度：`阶段 B 完成，整体进度约 28%`

## 6.3 阶段 C 执行记录

- 当前状态：`已完成，发现问题并已补齐 Android 原生运行前提`
- 记录：
  - 当前在检查什么：后端自动化测试、移动端类型与 Web 构建、后台构建、静态残留风险扫描、React Native 双端原生构建
  - 为什么检查这一项：这是手工测试前最直接的“代码能不能跑、资源能不能出包、重构残留是否会偷袭”的拦截层
  - 检查结果：
    - `backend` 执行 `go test ./...` 通过
    - `mobile` 执行 `npx tsc --noEmit` 通过
    - `mobile` 在修复异步刷新问题后再次执行 `npx tsc --noEmit` 仍通过
    - `mobile` 执行 `npm run web:build` 通过，最新产物 `dist/assets/index-c4lcoJ3c.js` 约 `849.18 kB`
    - `admin` 执行 `npm run build` 通过，`antd` chunk 约 `1,240.73 kB`
    - 初次执行 `mobile` 的 `npx react-native doctor` 时，Android 侧提示 `JDK 1.8.0_201`、`Android SDK 29.0.2` 与项目要求不匹配
    - `mobile/ios` 执行 `xcodebuild -workspace ios/WurenjiMobile.xcworkspace -scheme WurenjiMobile -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build` 成功，`** BUILD SUCCEEDED **`
    - `mobile/android` 初次执行 `./gradlew assembleDebug --stacktrace` 失败，报错根因为 `org.gradle.toolchains.foojay-resolver-convention 0.5.0` 触发 `NoSuchFieldError: IBM_SEMERU`
    - 已在当前机器补齐并切换 `JDK 17.0.18`，安装 Android `cmdline-tools latest`、`platforms;android-36`、`build-tools;36.0.0`、`emulator`、`system-images;android-36;google_apis;arm64-v8a`
    - 已创建并启动 Android 模拟器 `Wurenji_API_36_ARM`，`adb devices -l` 可见 `emulator-5554 device`
    - 复验 `mobile` 的 `npx react-native doctor` 后，Android 项仅剩 `Android Studio` 缺失；`Adb / JDK / ANDROID_HOME / Gradlew / Android SDK` 全部通过
    - 复验 `mobile/android` 的 `./gradlew assembleDebug --stacktrace` 成功，`BUILD SUCCESSFUL`
    - 已执行 `adb install -r app-debug.apk` 并启动 `com.wurenjimobile/.MainActivity`
    - Metro 收到 Android 端真实 `index.js` 打包请求并完成 bundle；`logcat` 未出现 `FATAL EXCEPTION`
    - `uiautomator dump` 与 `dumpsys activity` 确认应用已在 Android 模拟器前台展示登录页，页面标题为“无人机租赁平台 / 登录 / 注册”
    - 静态扫描再次确认移动端仍保留 v1/v2 双客户端与 `cpolar/api/v1` 默认值
  - 发现的问题：
    - 移动端与后台构建均出现 `chunk > 500k` 告警，虽不阻塞功能，但说明首屏体积与拆包仍有优化空间
    - `backend/internal/api/v2/router.go` 中 11 个入口仍直接返回 `NotImplemented`
    - `mobile/src/constants/index.ts`、`mobile/src/utils/config.web.ts` 保留强制 `cpolar` 和 `api/v1` 默认值，属于高风险运行期残留
    - `backend/internal/service/dispatch_service.go`、`flight_service.go`、`client_service.go` 仍留有 TODO，分别涉及推送、多边形判断、第三方征信
    - `react-native doctor` 仍会提示本机未安装 `Android Studio`，这会影响 IDE 侧设备管理，但已不阻塞命令行构建、安装和模拟器运行
    - `react-native-amap3d` 在 `doctor` 中提示 `dependency.platforms.ios.project` 非法配置，当前未阻塞 iOS 构建，但属于后续升级风险
  - 修复建议或处理动作：
    - 对移动端实际运行环境增加显式 `VITE_API_BASE_URL` 或等价配置，避免误打到旧公网地址
    - 手工测试时暂时回避会直接命中 `NotImplemented` 的履约推进与会话读取动作，或优先补齐这些端点
    - 后续可把移动端/后台做动态拆包，降低构建警告和首包压力
    - 本轮已将当前用户 shell 默认 `JAVA_HOME` 切到 `JDK 17.0.18`，后续 Android 命令行构建可直接沿用
    - 本轮已补齐 `Android SDK Platform 36`、`Build-Tools 36.0.0`、`adb/emulator` 与 ARM64 模拟器镜像，Android 手工测试可直接使用现有 AVD
    - 本轮排查中对 `node_modules/@react-native/gradle-plugin` 的临时探针修改已全部撤回，未把试探性 workaround 留在工程里
  - 复查结果：
    - iOS 原生工程已达到可进入手工测试的编译前提
    - Android 原生工程已达到“可构建、可安装、可启动到首屏”的手工测试前提
    - 阶段 C 已从“仅 Web 可构建”收敛为“iOS/Android 原生均可进入手工测试，过渡残留明确”
  - 当前状态 / 当前进度：`阶段 C 完成，整体进度约 60%`

## 6.4 阶段 D 执行记录

- 当前状态：`已完成`
- 记录：
  - 当前在检查什么：后端健康状态、认证链路、角色首页、Web 路由和模块加载基础可达性
  - 为什么检查这一项：构建通过不代表一打开 App 就能进入第一屏，启动阶段最容易暴露配置、鉴权和页面装配断链
  - 检查结果：
    - `curl http://127.0.0.1:8080/api/v2/status` 返回 `ready`
    - 4 个演示账号均可完成 `send-code -> login -> /api/v2/me`
    - 客户、机主、飞手、复合身份的 `/api/v2/home/dashboard` 均正常返回，关键顶层字段稳定为 `in_progress_orders / market_feed / market_totals / role_summary / role_views / summary`
    - 先前启动 `mobile` Web 预览后，`/`、`/dispatch-tasks`、`/order/20`、`/pilot-profile`、`/owner-profile` 均返回 HTML shell 且 HTTP 200
    - 后端在应用 `JSON.Scan` 修复后已重启并成功监听 `:8080`
  - 发现的问题：
    - 后端启动日志中出现 `Cannot drop index 'user_id': needed in a foreign key constraint`，说明自动迁移仍有非致命 DDL 冲突
    - 启动时多次查询 `flight_monitor_configs` 返回 `record not found`，说明飞行监控阈值配置未种入数据库
    - `owner` 与 `composite` 账号的 `can_publish_supply` 会随演示无人机是否处于 `available/rented` 改变，能力摘要具备数据依赖性，不能单纯当作登录口径判断错误
  - 修复建议或处理动作：
    - 若后续要重点测飞行告警，先补齐 `flight_monitor_configs` 样本
    - 自动迁移不应在每次服务启动时尝试做高风险索引调整，建议单独梳理相关 migration
    - 手工测试角色能力时，结合当前无人机/供给状态一起判断，不要把 `can_publish_supply=false` 直接视为接口故障
  - 复查结果：
    - 启动、认证、首页和基础页面加载链路都已打通
    - 阶段 D 未发现“打开 App 第一屏就报错/登不上/页面白屏”的阻塞问题
  - 当前状态 / 当前进度：`阶段 D 完成，整体进度约 72%`

## 6.5 阶段 E 执行记录

- 当前状态：`已完成`
- 记录：
  - 当前在检查什么：客户、机主、飞手、复合身份的主业务链路，以及订单/派单/监控对象边界
  - 为什么检查这一项：这是重构的主价值所在，必须确认不仅能编译，而且核心业务真的跑得通
  - 检查结果：
    - 执行 `PREPARE_DEMO_DATA=1 ./scripts/phase10_role_acceptance.sh` 全量通过
    - 最新验收产物为：`demand_id=18`、`quote_id=8`、`demand_order_id=21`、`direct_order_id=22`、`supply_id=8`、`dispatch_id=9`
    - `go run ./cmd/check_v2_parity -config config.yaml -limit 3` 通过，`missing_v2_table_cnt=0`
    - `GET /api/v2/orders/21` 返回完整订单详情，`source_info.order_source=demand_market`，`current_dispatch.id=9`
    - `GET /api/v2/orders/21/monitor` 返回正常，当前无激活飞行记录，时间线 5 条，符合“已派单未起飞”状态
    - `GET /api/v2/dispatch-tasks/9` 返回 `accepted` 状态的正式派单详情
    - `GET /api/v2/notifications?page=1&page_size=5` 正常返回 5 条通知
  - 发现的问题：
    - 初次复查时，订单详情中的 `source_info.snapshots.client/demand` 被读成了脏字符串；最终定位为 `backend/internal/model/json.go` 的 `Scan` 复用了数据库驱动提供的 `[]byte`
    - `supply_id=8` 在阶段 10 脚本中的 `supply_market` 步骤可见，但在整条链路跑完后客户侧市场列表为空、详情 `NOT_FOUND`；进一步核实后发现并非数据丢失，而是该供给绑定的 `drone_id=5` 在直达订单履约后已变为 `rented`，被市场过滤条件排除
  - 修复建议或处理动作：
    - 已修复 `backend/internal/model/json.go`，改为复制数据库返回的 `[]byte`，并新增 `backend/internal/model/json_test.go` 防止回归
    - 已重启后端并复验 `GET /api/v2/orders/21`，确认 `client/demand/execution/pricing` 四类快照全部恢复为结构化对象
    - 把“供给市场为空”从疑似 bug 降级为状态流转结果，并记录到后续手工测试注意事项
  - 复查结果：
    - 角色主链路已经被自动脚本和接口补验双重覆盖
    - 订单、正式派单、飞行监控三类对象边界清晰，当前没有发现明显混页或编号错位
  - 当前状态 / 当前进度：`阶段 E 完成，整体进度约 86%`

## 6.6 阶段 F 执行记录

- 当前状态：`已完成，发现问题并已部分修复`
- 记录：
  - 当前在检查什么：错误返回、边界条件、异步刷新、重构残留和未实现端点
  - 为什么检查这一项：手工测试最容易被这些“不是主链路、但一碰就炸”的点拖慢
  - 检查结果：
    - 未登录访问 `GET /api/v2/me` 返回 `UNAUTHORIZED`
    - 非法参数访问 `GET /api/v2/supplies/0` 返回 `VALIDATION_ERROR`
    - `POST /api/v2/orders/21/cancel` 与 `GET /api/v2/conversations` 返回统一 `NOT_IMPLEMENTED`
    - 已确认 `backend/internal/api/v2/router.go` 中 11 个 `NotImplemented` 端点的骨架已接统一错误响应
    - 静态检查确认移动端 `mobile/src/services/api.ts` 里存在并发 401 刷新队列逻辑
  - 发现的问题：
    - `mobile/src/services/api.ts` 中若某次 refresh token 失败，`isRefreshing` 队列中的后续请求只会等待，不会被 reject，属于真实异步/竞态问题
    - `mobile/src/constants/index.ts` 与 `mobile/src/utils/config.web.ts` 仍把默认接口落到 `cpolar + /api/v1`
    - `react-native-amap3d` 的配置告警、v2 未实现端点、自动迁移启动告警都属于手工测试前需要显式预警的残留项
  - 修复建议或处理动作：
    - 已修复 `mobile/src/services/api.ts`，为并发刷新队列补齐失败拒绝路径，避免 refresh 失败时页面请求永久挂起
    - 修复后再次执行 `mobile` 的 `npx tsc --noEmit` 与 `npm run web:build`，均通过
    - 对 `cpolar/api/v1` 默认值暂未直接改动，避免误改用户当前演示环境，但已将其列为高风险配置项
  - 复查结果：
    - 错误返回结构已经具备统一性，接口异常可稳定识别
    - 异步刷新已补掉一个明确的竞态挂死问题
    - 阶段 F 仍有未关闭风险，但已从“隐藏雷”收敛为“显式已知项”
  - 当前状态 / 当前进度：`阶段 F 完成，整体进度约 94%`

## 6.7 阶段 G 执行记录

- 当前状态：`已完成，结论为“iOS / Android / 后端主链路均可继续进入手工测试”`
- 记录：
  - 当前在检查什么：全阶段复盘、阻塞项分类、手工测试前优先顺序
  - 为什么检查这一项：需要给出一个能直接指导下一步动作的结论，而不是零散日志
  - 检查结果：
    - 文档、环境、后端构建、iOS/Android 原生构建、Web 包装页加载、阶段 10 主链路、核心 API 详情和错误响应均已覆盖
    - 已完成两处安全可修复问题并复验通过：`backend/internal/model/json.go` 的 JSON 扫描问题、`mobile/src/services/api.ts` 的刷新队列挂起问题
    - 已确认供给市场空列表是履约后的状态结果，不是供给丢失
    - Android 环境补齐后已完成 `doctor -> assembleDebug -> emulator -> install -> MainActivity/Metro bundle` 的整链路验证
  - 发现的问题：
    - 移动端默认 `cpolar/api/v1` 配置与 v2 主链路目标冲突，若不覆盖环境变量，真机手工测试存在高概率打错地址
    - 11 个 `NotImplemented` 端点意味着部分履约推进、飞行记录写入、会话读取动作仍不适合纳入手工主回归
    - `react-native doctor` 仍将 `Android Studio` 记为错误项，但当前命令行构建、安装和模拟器启动已全部通过
  - 修复建议或处理动作：
    - 手工测试前显式设置本地 `v2` API 地址，避免命中 `cpolar/api/v1` 默认值
    - Android 侧可直接复用当前模拟器 `Wurenji_API_36_ARM`，或接入真机继续测；若希望在 IDE 中管理模拟器，再额外安装 `Android Studio`
    - 手工测试优先顺序建议为：`iOS 原生 -> Android 原生 -> 后端主链路复核 / 针对性补测`
    - 页面动作上优先走阶段 10 已覆盖链路，暂时回避会命中 `NotImplemented` 的按钮
  - 复查结果：
    - 本轮自动测试与复查流程已闭环
    - 当前结论可以稳定指导后续人工测试，不需要再先做一轮盲试探
  - 当前状态 / 当前进度：`阶段 G 完成，整体进度 100%`

## 7. 当前问题清单与建议

### 7.1 阻塞项

- [x] 当前未发现新的手工测试前阻塞项
说明：后端、iOS、Android 的基础编译/构建/启动前提均已打通，本轮未保留“打开就报错或完全不能跑”的已知阻塞。

### 7.2 高风险项

- [!] 移动端默认接口仍指向 `cpolar/api/v1`
影响：iOS/Android 手工测试若未覆盖环境变量，可能直接打到旧地址或旧版本接口。
定位：`mobile/src/constants/index.ts`、`mobile/src/utils/config.web.ts`
建议：手工测试前显式设置本地 `v2` 地址。

- [!] v2 仍有 11 个 `NotImplemented` 端点
影响：相关页面按钮可能能点开但动作无法完成。
定位：`backend/internal/api/v2/router.go`
建议：手工主回归先避开这些动作，或优先补齐订单推进、飞行记录、会话消息接口。

### 7.3 非阻塞但应关注

- [ ] 后端启动时自动迁移仍有索引调整告警：`Cannot drop index 'user_id': needed in a foreign key constraint`
- [ ] 飞行监控阈值表 `flight_monitor_configs` 缺少默认配置，当前会在启动日志中出现多次 `record not found`
- [ ] `react-native doctor` 仍提示未安装 `Android Studio`；命令行构建和模拟器已可用，但 IDE 管理能力仍缺失
- [ ] `react-native-amap3d` 在 `doctor` 中有配置警告，但当前未阻塞 iOS 编译
- [ ] 移动端和后台构建存在大 chunk 警告，不阻塞功能，但影响包体与首屏负载

### 7.4 已处理并复验通过

- [x] Android 原生环境与启动链路已补齐并复验通过
处理：安装并切换 `JDK 17.0.18`，补齐 Android `cmdline-tools latest`、`platforms;android-36`、`build-tools;36.0.0`、`emulator`、`system-images;android-36;google_apis;arm64-v8a`，创建 `Wurenji_API_36_ARM` 模拟器
复验：`npx react-native doctor` 的 Android 项仅剩 `Android Studio`；`./gradlew assembleDebug` 成功；`adb install -r` 成功；应用已在 `emulator-5554` 前台启动到登录页，Metro bundle 完成且 `logcat` 未见 `FATAL EXCEPTION`

- [x] 订单详情快照脏数据问题已修复
处理：修复 `backend/internal/model/json.go` 的 `Scan` 字节复用问题，并新增 `backend/internal/model/json_test.go`
复验：`GET /api/v2/orders/21` 中 `source_info.snapshots.client/demand/execution/pricing` 均恢复为结构化对象

- [x] 移动端 refresh token 并发失败挂起问题已修复
处理：修复 `mobile/src/services/api.ts` 中刷新队列的失败 reject 路径
复验：`mobile` 的 `npx tsc --noEmit` 与 `npm run web:build` 再次通过
