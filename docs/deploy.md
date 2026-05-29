# 部署与实测前检查

## 部署 / 实测前必做：执行最新 migration

双手机 E2E 或本地联调前，先确认数据库已经执行到最新迁移。`125_orders_client_request_id.sql` 会给 `orders` 增加幂等字段，未执行时创建即时单会报 `Unknown column 'client_request_id'`。

```bash
cd backend

# 推荐：按编号执行 125
go run ./cmd/migrate -include 125

# 或直接导入当前 SQL
$MYSQL < migrations/125_orders_client_request_id.sql
```

快速校验：

```bash
$MYSQL -e "SHOW COLUMNS FROM orders LIKE 'client_request_id'; \
           SHOW INDEX FROM orders WHERE Key_name='idx_orders_client_request_id';"
```

期望能看到 `orders.client_request_id` 字段，以及唯一索引 `idx_orders_client_request_id`。
