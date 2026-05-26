# drone_Rental_platform_v1

重构后的 v2 项目当前聚焦重载末端货物吊运，产品侧固定为两个入口：

- `我要吊运`：货主发起吊运服务。
- `我要接单`：服务商上线、抢单、履约、结算。

## 业务模式

平台采用**货拉拉式即时调度模型**承接重载无人机吊运业务：

- **即时单**：货主输入起降点 + 重量 + 机型档，系统自动算价，一键下单后广播给附近在线服务商抢单。
- **预约单**：未来 1-30 天的标准场景，预约时段前进入广播池，后续同样走服务商抢单和履约。
- **议价单**：应急、特种、长时段等非标场景，保留传统“复杂服务 + 服务商报价”链路。

业务边界：服务于 `>=150kg` 最大起飞重量、`>=50kg` 有效载荷的重载无人机吊运，典型场景包括电网物资、山区农副、高原给养、海岛运送、应急救援；不做城市闪送或通用航拍。

详见 [货拉拉模式重构任务书](./docs/planning/HUOLALA_STYLE_REFACTOR_TASKBOOK.md)。

## 文档导航

- [项目文档总览](./docs/README.md)
- [当前重启专题文档](./docs/restart/README.md)

## API 文档

- [已实现的 API v2 OpenAPI](./backend/docs/openapi-v2.yaml)
- [API v1 / v2 差异对照](./backend/docs/API_V1_V2_DIFF.md)
- [业务 API 契约](./docs/business/BUSINESS_API_CONTRACT.md)

## 业务与重构文档

- [业务角色重构总纲](./docs/business/BUSINESS_ROLE_REDESIGN.md)
- [字段字典](./docs/business/BUSINESS_FIELD_DICTIONARY.md)
- [页面信息架构](./docs/business/BUSINESS_PAGE_INFORMATION_ARCHITECTURE.md)
- [数据库迁移方案](./docs/business/BUSINESS_DATABASE_MIGRATION_PLAN.md)
- [重构任务总表](./docs/planning/REFACTOR_MASTER_TASKLIST.md)

## 阶段 10 验收文档

- [移动端关键页面回归与截图验收标准](./docs/testing/MOBILE_REGRESSION_ACCEPTANCE.md)
- [角色视角业务验收走查](./docs/testing/ROLE_ACCEPTANCE_WALKTHROUGH.md)
- [演示账号说明](./docs/testing/DEMO_ACCOUNTS.md)
- [最近一次角色验收报告 JSON](./backend/docs/phase10_role_acceptance_last_run.json)
- [货拉拉式链路验收脚本](./backend/docs/huolala_acceptance.sh)
- [最近一次货拉拉式链路验收报告 JSON](./backend/docs/huolala_acceptance_last_run.json)
