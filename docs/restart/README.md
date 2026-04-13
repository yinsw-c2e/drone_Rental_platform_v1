# 当前重启专题文档

这组文档是本轮“二次启动 / 主链路补齐 / 体验减负”任务的核心工作区。

如果后面进入开发、验收、补文档或回头查设计依据，优先从这个目录开始，不要再去根目录或旧分类目录里分散地找。

## 当前专题范围

本轮专题主要围绕 4 件事展开：

1. 补齐 v2 当前主链路断点
2. 以 `mock` 支付跑通个人可用 MVP
3. 降低客户、机主、飞手三条链路的心智负担
4. 用固定样本持续回归，而不是每次临时拼数据

## 当前核心文档

| 文档 | 用途 | 什么时候先看 |
|---|---|---|
| [PROJECT_ANALYSIS_AND_ROADMAP.md](./PROJECT_ANALYSIS_AND_ROADMAP.md) | 问题总盘点、优先级和为什么要重启 | 想先理解“为什么现在这样改” |
| [RESTART_MASTER_TASKLIST.md](./RESTART_MASTER_TASKLIST.md) | 当前唯一执行总表 | 想知道“现在做到哪、下一步做什么” |
| [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md) | 当前固定账号、样本对象、验收顺序 | 改代码前后要复验主链路 |
| [USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md) | 用户心智、前台对象模型、入口策略 | 改首页、市场、订单、流程体验前 |
| [MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md](./MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md) | 移动端信息架构和页面减负执行细则 | 真正开始做移动端页面改造时 |

## 推荐阅读顺序

第一次进入本专题，按下面顺序读最省时间：

1. [PROJECT_ANALYSIS_AND_ROADMAP.md](./PROJECT_ANALYSIS_AND_ROADMAP.md)
2. [RESTART_MASTER_TASKLIST.md](./RESTART_MASTER_TASKLIST.md)
3. [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)
4. [USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)
5. [MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md](./MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md)

## 按任务查文档

### 想补后端主链路断点

先看：

- [RESTART_MASTER_TASKLIST.md](./RESTART_MASTER_TASKLIST.md)
- [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)
- [业务 API 契约](../business/BUSINESS_API_CONTRACT.md)

适用任务：

- `N1.01` 订单状态推进
- `N1.02` 飞行记录闭环
- `N1.03` 会话与消息
- `N1.04` mock 支付稳定化
- `N1.05` 回归脚本
- `N1.06` 订单时间线聚合

### 想改客户体验和前台流程

先看：

- [USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)
- [MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md](./MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md)
- [页面信息架构](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
- [RESTART_MASTER_TASKLIST.md](./RESTART_MASTER_TASKLIST.md)

适用任务：

- `N2.02` 双路径入口
- `N2.03` 快速下单
- `N2.04` 分段式发布任务
- `N2.05` 订单吸收派单过程
- `N2.06` 术语统一
- `N2.07` 等待态预期管理
- `N2.08` 订单统一时间线

### 想改机主/飞手体验

先看：

- [USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)
- [RESTART_MASTER_TASKLIST.md](./RESTART_MASTER_TASKLIST.md)
- [页面信息架构](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)

适用任务：

- `N4.01` 飞手分级准入
- `N4.02` 机主先草稿后资质
- `N4.03` 资质并行总览
- `N4.05` 飞手任务视角首页

### 想做验收、回归或补测试

先看：

- [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)
- [角色视角业务验收走查](../testing/ROLE_ACCEPTANCE_WALKTHROUGH.md)
- [手工测试前总表](../testing/PRE_MANUAL_TEST_MASTER_TASKLIST.md)
- [移动端关键页面回归与截图验收标准](../testing/MOBILE_REGRESSION_ACCEPTANCE.md)

适用任务：

- `N0.03`
- `N1.05`
- `N3.01`
- `N3.02`

## 当前开发前 5 分钟检查

开始做本轮任务前，默认先确认这几件事：

1. 先在 [RESTART_MASTER_TASKLIST.md](./RESTART_MASTER_TASKLIST.md) 找到当前任务编号和依赖
2. 再在 [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](./RESTART_ACCEPTANCE_SAMPLE_BASELINE.md) 确认这次改动会影响哪条样本链路
3. 如果涉及流程或页面，再看 [USER_JOURNEY_REDESIGN.md](./USER_JOURNEY_REDESIGN.md)
4. 如果是移动端页面改造，再补看 [MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md](./MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md)
5. 如果需要业务口径、字段或接口细节，再回到上游基础文档

## 本轮最常引用的上游基础文档

这些文档不是本轮专题文档的一部分，但会频繁作为设计基线引用：

- [页面信息架构](../business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
- [业务角色重构总纲](../business/BUSINESS_ROLE_REDESIGN.md)
- [业务 API 契约](../business/BUSINESS_API_CONTRACT.md)
- [字段字典](../business/BUSINESS_FIELD_DICTIONARY.md)
- [历史重构任务总表](../planning/REFACTOR_MASTER_TASKLIST.md)
- [手工测试前总表](../testing/PRE_MANUAL_TEST_MASTER_TASKLIST.md)

## 目录迁移说明

为避免后续开发时继续在不同目录里来回找，本轮核心文档已经统一移动到 `docs/restart/`。

如果你在 IDE 里还看到旧路径，例如：

- `docs/planning/RESTART_MASTER_TASKLIST.md`
- `docs/planning/PROJECT_ANALYSIS_AND_ROADMAP.md`
- `docs/ux/USER_JOURNEY_REDESIGN.md`
- `docs/ux/MOBILE_UX_SIMPLIFICATION_EXECUTION_PLAN.md`

请以 `docs/restart/` 下的新位置为准。

