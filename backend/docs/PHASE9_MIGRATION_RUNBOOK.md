# 阶段 9 迁移执行说明

## 1. 目的

本说明服务阶段 `R9.01 / R9.05`，把之前开发期的 `101-109` 混合脚本，整理成真正面向切流的执行方案。

- `901_phase9_prepare_v2_schema.sql`
- `911_phase9_backfill_v2_data.sql`

两者职责必须分离：

1. `901` 只做结构准备
2. `911` 只做数据回填

## 2. 推荐执行顺序

1. 备份数据库或做快照
2. 执行 `901_phase9_prepare_v2_schema.sql`
3. 验证新表、新列、新索引已就绪
4. 执行 `911_phase9_backfill_v2_data.sql`
5. 查看 `migration_audit_records`
6. 运行双读校验工具
7. 切移动端和后台默认入口到 `v2`
8. 冻结 `v1` 核心写入，仅保留只读兼容

## 3. 推荐命令

在 `backend` 目录执行：

```bash
go run ./cmd/migrate -config config.yaml -dir migrations -include 901
go run ./cmd/migrate -config config.yaml -dir migrations -include 911
```

仅预览将执行的文件：

```bash
go run ./cmd/migrate -config config.yaml -dir migrations -include 901,911 -dry-run
```

执行双读校验：

```bash
go run ./cmd/check_v2_parity -config config.yaml -limit 3
```

注意：

- `check_v2_parity` 依赖 `901_phase9_prepare_v2_schema.sql` 和 `911_phase9_backfill_v2_data.sql` 已对当前数据库执行完成
- 如果直接对尚未迁移的开发库运行，出现 `missing_v2_tables` 属于预期现象，说明当前库还没有进入阶段 9 的迁移执行态，而不是代码已经回退

## 4. 回滚策略

阶段 9 的结构迁移涉及：

- 新表创建
- 旧派单表重命名
- 旧表新增列/索引

这类操作不适合依赖“通用反向 SQL”直接回滚。推荐策略：

1. 执行前做数据库快照
2. 若 `901` 执行失败：
   - 先停止继续执行 `911`
   - 评估失败点是否可补丁修复
   - 若无法快速修复，直接恢复执行前快照
3. 若 `911` 执行失败：
   - 保留 `901` 的结构结果
   - 通过 `migration_audit_records` 识别已处理和未处理数据
   - 修复脚本后重跑 `911`

## 5. 验证重点

执行 `901` 后至少确认：

- `client_profiles / owner_profiles / pilot_profiles` 已存在
- `owner_supplies / owner_pilot_bindings` 已存在
- `demands / demand_quotes / demand_candidate_pilots / matching_logs` 已存在
- `dispatch_tasks / dispatch_logs` 已存在
- `flight_records / migration_entity_mappings / migration_audit_records` 已存在
- `orders` 已具备新字段

执行 `911` 后至少确认：

- 历史账号已补齐到三类档案
- 历史需求已回填到 `demands`
- 历史订单已补齐来源和执行字段
- 正式派单、飞行记录、快照、退款已建立映射
- 未能稳定迁移的数据进入 `migration_audit_records`

执行双读校验后至少确认：

- 输出中不存在阻塞性 `missing_v2_tables`
- 首页、订单、正式派单、飞行统计都能得到新旧对比结果
- 差异项可回落到 `migration_audit_records` 或异常订单看板解释

## 6. 与阶段 8 的联动

管理后台的“迁移审计/异常”看板直接消费：

- `migration_audit_records`
- 异常订单查询

因此阶段 9 每次执行回填脚本后，都应优先查看后台看板，而不是只看 SQL 输出。

## 7. 切流顺序

阶段 9 的默认切流顺序固定为：

1. 移动端默认走 `v2`
2. 管理后台默认走 `v2`
3. 冻结 `v1` 核心写入
4. 仅保留 `v1` 只读兼容与尚未迁移的边缘域

当前代码口径已经落实：

- 移动端认证、首页、市场、履约、我的主链路默认走 `v2`
- 管理后台默认 API 前缀切到 `/api/v2`
- 后端已提供 `/api/v2/admin`、`/api/v2/analytics`、`/api/v2/client/admin/cargo/*` 兼容别名
- `/api/v1` 核心业务组的写入已冻结，返回明确提示引导改走 `v2`
