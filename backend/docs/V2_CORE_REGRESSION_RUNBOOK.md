# V2 核心断链回归脚本说明

## 1. 目的

本说明对应二次启动任务 `N1.05`。

用于在本地开发环境中快速复验这一轮已经补齐的 v2 主链路断点：

- `mock` 支付样本是否仍可稳定生成
- `cancel / start-preparing / start-flight / confirm-delivery` 是否可用
- `GET /flight-records/{id}`、`positions`、`alerts`、`complete` 是否可用
- `GET /conversations` 与 `GET /conversations/{id}/messages` 是否可读
- 需求转单 / 直达下单生成的合同是否存在、可查看、可签署

## 2. 脚本位置

- 主链路样本重建脚本：`backend/scripts/phase10_role_acceptance.sh`
- v2 核心断链 smoke 脚本：`backend/scripts/v2_core_regression.sh`

## 3. 运行前提

默认依赖下面这些本地服务和工具：

- 后端服务已启动，默认读取 `BASE_URL=http://127.0.0.1:8080`
- 本机存在 `curl`、`jq`、`python3`、`go`
- 如果要走短信验证码登录，需额外提供 `redis-cli`
- 如果要刷新 `phase10` 基线样本，需确保 MySQL、Redis 和演示数据前置都可用

说明：

- `v2_core_regression.sh` 现在默认 `PREPARE_BASELINE=0`
- 也就是默认优先复用现有 `phase10` 样本，只做 v2 核心断点 smoke
- 登录顺序为：`redis-cli` 验证码 -> `LOGIN_PASSWORD` -> `go run ./cmd/devtoken`
- 如果本机同时跑着多个后端实例，建议显式传入 `BASE_URL`，避免误连旧进程

## 4. 推荐执行方式

日常开发优先用“复用样本”的快速 smoke：

```bash
cd backend
PREPARE_BASELINE=0 ./scripts/v2_core_regression.sh
```

如果当前代码实例不在默认 8080，例如临时跑在 18080：

```bash
cd backend
BASE_URL=http://127.0.0.1:18080 PREPARE_BASELINE=0 ./scripts/v2_core_regression.sh
```

只有在环境完整、需要从头重建样本时，再执行：

```bash
cd backend
PREPARE_BASELINE=1 PREPARE_DEMO_DATA=1 ./scripts/v2_core_regression.sh
```

## 5. 默认验证范围

脚本默认会依次做这些事：

1. 按需刷新 phase10 基线样本
2. 读取样本产物中的 `demand_order_id / direct_order_id / supply_id`
3. 重新登录客户、机主、飞手账号
4. 校验需求单和直达单都已有 `mock + paid` 支付记录
5. 尝试新建一个临时直达单并验证取消接口
   如果当前供给关联无人机不满足准入条件，会记为 `skipped`，不阻塞整套 smoke
6. 确保需求单进入已分配状态
7. 对需求单验证：
   - `start-preparing`
   - `start-flight`
   - `GET /flight-records/{id}`
   - `POST /positions`
   - `POST /alerts`
   - `confirm-delivery`
   - `POST /complete`
8. 验证 `GET /orders/{id}/timeline` 能聚合 `order_timeline / payment / dispatch_task / flight_record`
9. 验证需求转单与直达下单两条链路都已自动生成合同，并且客户/机主都能读取合同
10. 对两条链路分别验证合同签署，最终状态应为 `fully_signed`
11. 验证客户与机主会话可读，且消息里能看到本轮订单事件
12. 如果复用的是已推进过的旧样本，已完成阶段会自动记为 `skipped`，便于重复执行 smoke

## 6. 产物文件

样本重建脚本会写：

- `backend/docs/phase10_role_acceptance_last_run.json`

v2 核心断链 smoke 会写：

- `backend/docs/v2_core_regression_last_run.json`

`v2_core_regression_last_run.json` 重点关注：

- `timeline_event_count`
- `results` 中 `CONTRACT` 相关步骤
- `artifacts.cancel_order_id`
- `artifacts.demand_dispatch_id`
- `artifacts.direct_dispatch_id`
- `artifacts.demand_flight_id`
- `artifacts.conversation_id`
- `results`

从阶段 3 开始，这份脚本也承担 restart 主链路的 API 集成回归基线角色，对应 `N3.02`。后续只要涉及订单推进、飞行记录、时间线聚合、消息会话或 `mock` 支付改动，都应优先复验这份报告。

## 7. 失败排查建议

优先按这个顺序看：

1. `GET /api/v2/status` 是否正常
2. `BASE_URL` 是否指向当前代码实例，而不是旧进程
3. 如果依赖短信登录，Redis 中是否能读到验证码
4. `phase10_role_acceptance.sh` 或现有 baseline report 是否可用
5. 目标订单是否仍停留在 `pending_dispatch`，或已经被旧 smoke 推进到更后状态
6. 飞手账号是否仍具备 `verified` 资质
7. 当前供给关联无人机是否仍满足直达下单准入
8. 会话列表里是否存在客户与机主的有效会话
9. 合同是否已被旧样本签成终态，如果是，脚本应记录为 `skipped`

## 8. 与 restart 文档的关系

这套脚本对应：

- [RESTART_MASTER_TASKLIST.md](/Users/yinswc2e/Code/drone_Rental_platform_v1/docs/restart/RESTART_MASTER_TASKLIST.md)
- [RESTART_ACCEPTANCE_SAMPLE_BASELINE.md](/Users/yinswc2e/Code/drone_Rental_platform_v1/docs/restart/RESTART_ACCEPTANCE_SAMPLE_BASELINE.md)

推荐口径是：

1. 先跑 `phase10` 样本基线
2. 再跑 `v2_core_regression`
3. 改完后端主链路断点后，优先复验这两份报告
