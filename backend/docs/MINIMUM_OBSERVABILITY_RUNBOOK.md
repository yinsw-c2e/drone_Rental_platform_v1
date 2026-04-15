# 最小可观测性运行说明

## 1. 目的

本说明对应 `N5.03`。

目标不是一次把监控平台补齐，而是先让开发和部署阶段能快速回答这 3 个问题：

1. 服务是不是活着
2. 服务是不是已经准备好接请求
3. 有没有明显慢查询或关键依赖异常

## 2. 当前已落地能力

截至 `2026-04-15`，后端已经具备：

- `GET /healthz`
  - 只表示 HTTP 进程存活
- `GET /readyz`
  - 会同时检查数据库和 Redis
  - 任一依赖失败时返回 `503`
- 请求日志中间件
  - 已接在 Gin 全局中间件上
- 基础限流中间件
  - 当前为 `180 req/min`
- GORM 慢查询告警
  - `SlowThreshold = 300ms`
  - 忽略 `record not found`

## 3. 使用方式

### 3.1 存活检查

```bash
curl http://127.0.0.1:8080/healthz
```

期望返回：

```json
{
  "status": "ok",
  "time": "2026-04-15T01:23:45+08:00"
}
```

### 3.2 就绪检查

```bash
curl http://127.0.0.1:8080/readyz
```

健康时：

```json
{
  "status": "ready",
  "time": "...",
  "components": {
    "database": "ok",
    "redis": "ok"
  }
}
```

依赖异常时：

- 返回 `503`
- `status = degraded`
- `components.database` 或 `components.redis` 会标成 `error`

## 4. 推荐排查顺序

出现“接口跑不通 / 回归脚本失败 / 本地环境不稳”时，优先按下面顺序排：

1. `healthz` 是否正常
2. `readyz` 是否返回 `ready`
3. 查看服务启动日志里是否有数据库连接失败、Redis 连接失败
4. 查看 GORM 慢查询或 SQL 报错
5. 再回到具体业务接口排查

## 5. 与回归脚本的关系

当前主链路回归脚本：

- [backend/scripts/v2_core_regression.sh](/Users/yinswc2e/Code/drone_Rental_platform_v1/backend/scripts/v2_core_regression.sh)

推荐在运行 smoke 前先确认：

```bash
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/readyz
```

这样可以先排掉“服务根本没起来”或“Redis/数据库没就绪”的假故障。

## 6. 当前已知缺口

本轮只补“最小可用”，以下仍是后续项：

- 还没有 Prometheus / Grafana 之类的指标采集
- 还没有外部告警通道
- 还没有按业务域拆分的结构化错误统计
- `flight_monitor_configs` 仍缺默认种子数据，旧库启动时可能继续出现配置缺失日志

## 7. 建议后续增强

下一步建议按优先级补：

1. 给 `v2_core_regression.sh` 增加 `healthz/readyz` 前置检查
2. 为 `flight_monitor_configs` 增加默认种子
3. 引入基础指标采集
4. 把关键错误按业务域聚合

