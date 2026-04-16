# 阶段 10 演示账号说明

## 1. 适用范围

本文件服务 `R10.04`，用于说明当前开发测试环境下可直接用于联调、演示、验收的账号。

说明：

1. 这些账号仅用于本地 / 测试环境
2. 推荐使用短信验证码登录
3. 角色能力以 `/api/v2/me` 返回的 `role_summary` 为准，不再以旧 `user_type` 为准

## 2. 当前推荐演示账号

| 视角 | 手机号 | 当前定位 | 当前验收用途 |
|------|--------|----------|--------------|
| 客户 | `13800000004` | 客户能力账号 | 供给市场、创建需求、需求转单、支付 |
| 机主 | `13800000007` | 机主样本账号 | 无人机、供给、报价、直达订单确认 |
| 飞手 | `13900000016` | 飞手样本账号 | 候选报名、正式派单、飞行记录 |
| 飞手备用 | `13900000017` | 陈飞手样本账号 | 智能派单、飞手通知、双端互测 |
| 复合身份 | `13800000002` | 机主 + 飞手能力账号 | 综合首页、双角色入口、档案切换 |

## 3. 当前已验证的角色摘要

基于 `2026-03-15` 的阶段 10 自动验收结果：

### 3.1 客户 `13800000004`

- `has_client_role = true`
- `has_owner_role = false`
- `has_pilot_role = false`
- `can_publish_supply = false`
- `can_accept_dispatch = false`
- `can_self_execute = false`

### 3.2 机主 `13800000007`

- `has_client_role = true`
- `has_owner_role = true`
- `has_pilot_role = false`
- `can_publish_supply = true`
- `can_accept_dispatch = false`
- `can_self_execute = false`

### 3.3 飞手 `13900000016`

- `has_client_role = true`
- `has_owner_role = true`
- `has_pilot_role = true`
- `can_publish_supply = true`
- `can_accept_dispatch = true`
- `can_self_execute = true`

说明：

- 当前开发库没有长期维护的“纯飞手无机主档案”样本
- 因此飞手视角验收使用 `13900000016`
- 该账号在角色摘要上会同时拥有机主能力，但飞手主链路已经实测可用
- 如需验证智能派单命中陈飞手或双设备互测，可使用备用账号 `13900000017`

### 3.4 复合身份 `13800000002`

- `has_client_role = true`
- `has_owner_role = true`
- `has_pilot_role = true`
- `can_publish_supply = false`
- `can_accept_dispatch = false`
- `can_self_execute = false`

说明：

- 该账号用于验证“综合首页 + 机主入口 + 飞手入口”的双能力导航
- 它当前不是主经营/履约样本账号

## 4. 推荐演示顺序

1. 客户登录，查看首页驾驶舱、供给市场、我的需求、订单
2. 机主登录，查看机主档案、无人机、我的供给、我的报价
3. 飞手登录，查看飞手档案、可报名需求、正式派单、飞行记录
4. 复合身份登录，验证首页综合视图和双角色入口

## 5. 自动验收脚本

脚本位置：

- [backend/scripts/phase10_role_acceptance.sh](./backend/scripts/phase10_role_acceptance.sh)

推荐执行：

```bash
cd backend
PREPARE_DEMO_DATA=1 ./scripts/phase10_role_acceptance.sh
```

报告输出：

- [backend/docs/phase10_role_acceptance_last_run.json](./backend/docs/phase10_role_acceptance_last_run.json)

## 6. 当前最近一次通过产物

最近一次稳定通过时间：

- `2026-03-15 12:13:06 +08:00`

对应产物：

- `demand_id = 17`
- `quote_id = 7`
- `demand_order_id = 19`
- `direct_order_id = 20`
- `supply_id = 8`

## 7. 注意事项

1. 阶段 10 验收脚本会整理少量开发演示数据，并重置样本无人机状态
2. 该行为只适用于开发测试环境，不适用于生产环境
3. 如需重复演示，优先重新执行自动验收脚本，而不是手工拼装测试数据
