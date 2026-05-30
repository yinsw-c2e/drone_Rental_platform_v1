# 两个人手测 E2E 脚本：客户 A + 服务商 B

日期：2026-05-28
范围：微信小程序真实手机手测，支付环节按 mock/已完成处理。
角色：手机 A = 客户；手机 B = 服务商。

## 0. 准备

### 0.1 启动后端并保留日志

建议把本轮日志 tee 到固定文件，后续每个异常都能 grep：

```bash
cd /Users/yinswc2e/Code/drone_Rental_platform_v1/backend
go run cmd/server/main.go 2>&1 | tee /tmp/wurenji-backend-e2e.log
```

如果已经在 Terminal 窗口直接运行后端，本脚本里的日志路径就改为“当前后端 Terminal stdout”。推荐还是用上面的 tee 方式重启一次，便于截图和 grep。

### 0.2 命令变量

在 Mac 终端准备这些变量。真实手机可以走 cpolar 域名，小程序实际请求哪个域名以 `mini-program/src/constants` 当前配置为准；本机验证命令默认打本机后端。
下面的 curl 校验命令使用 `jq` 格式化响应；如果本机没有 `jq`，先只看原始 JSON 或安装后再跑。

```bash
export BASE_URL="http://127.0.0.1:8080/api/v2"
export MYSQL='docker exec -i wurenji-mysql mysql -uroot -proot wurenji'

export A_PHONE="13900010001"
export A_PASSWORD="123456"
export B_PHONE="13900010002"
export B_PASSWORD="123456"

export E2E_TAG="two-phone-e2e-$(date +%m%d%H%M)"
```

如果使用 curl 补查 token：

```bash
# Token 有效期可能 < 2 小时。
# 第 8 节 hydrate 验证前请重新跑这两行获取新 token。
export A_TOKEN=$(curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$A_PHONE\",\"password\":\"$A_PASSWORD\"}" | jq -r '.data.token.access_token')

export B_TOKEN=$(curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$B_PHONE\",\"password\":\"$B_PASSWORD\"}" | jq -r '.data.token.access_token')
```

### 0.3 手测关键约束

- A 下单起点必须在 B 当前 GPS 位置的服务半径内。最稳做法：A 起吊点选 B 手机附近地址，B 服务半径选 `30km`。
- B 上线前必须勾选与 A 下单一致的机型档，例如 `light_heavy` / 轻型重载。
- B 如果是全新账号，必须先完成服务商入驻并通过审核；否则可能进不了正式工作台。若本轮重点是主链路，建议使用一个已审核服务商账号，或先在后台/DB 确认 B 已具备服务商工作台权限。
- 支付真实回调不测。若页面出现支付边界，按 mock 支付或“支付已完成”路径继续。
- 实测前先在 admin 后台或直接 `UPDATE owner_profiles/pilots`
  把 B 的服务商和履约审核状态置为 `approved`；否则 B 进不了正式工作台，
  本轮主链路无法启动。也可以复用一个之前已审核过的服务商账号。

### 0.4 失败证据采集规范

每个失败都保留三类证据：

```text
截图：手机 A/B 当前页面截图，文件名建议 A_stepxx_xxx.png / B_stepxx_xxx.png
后端日志：/tmp/wurenji-backend-e2e.log 中该时间点前后 80 行
DB 快照：按步骤里的 SQL 输出保存到 docs/testing/e2e-evidence-YYYYMMDD.txt
```

通用日志 grep：

```bash
grep -nE "panic|ERROR|WARN|订单|broadcast|presence|settlement|client_request|duplicate|conflict" /tmp/wurenji-backend-e2e.log | tail -80
```

## 1. A 注册客户并保持客户模式

### 1.1 手机 A：进入小程序，选择“我要吊运”

操作：

- A 打开小程序。
- 如果进入模式选择页，点“我要吊运”。
- 点“新账号注册”。

期望前端：

- 进入 `/pages/auth/register/index?roleMode=customer`。
- 页面显示注册表单，不应跳到服务商入驻或工作台。

后端/DB 验证：

```bash
$MYSQL -e "SELECT id, phone, nickname, user_type, status, created_at FROM users WHERE phone='$A_PHONE';"
```

期望：注册前查不到记录。

异常 catch：

```bash
grep -nE "auth/register|invalid register|missing user|panic|ERROR" /tmp/wurenji-backend-e2e.log | tail -50
```

若页面跳错入口，截图 A 当前页面，并记录当前页面路径。

### 1.2 手机 A：注册客户账号

操作：

- 手机号：`$A_PHONE`
- 密码：`$A_PASSWORD`
- 昵称：`客户A-$E2E_TAG`
- 点注册。

期望前端：

- 注册成功后进入首页。
- 首页渲染“立即吊运”客户首页。
- 底部 Tab 是“首页 / 订单 / 消息 / 我的”。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, phone, nickname, user_type, id_verified, status, created_at
FROM users
WHERE phone='$A_PHONE';
"
```

可选 curl 验证登录：

```bash
curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$A_PHONE\",\"password\":\"$A_PASSWORD\"}" | jq '{code,message,user:.data.user,has_token:(.data.token.access_token != null)}'
```

期望：

- `users.phone=$A_PHONE` 存在。
- curl 返回 `code=0`，且有 `access_token`。

异常 catch：

```bash
grep -nE "$A_PHONE|auth/register|auth/login|conflict|验证码|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -80
```

## 2. A 创建即时单，验证 client_request_id

### 2.1 手机 A：选择起点、终点、机型、重量

操作：

- A 在首页点“从哪里起吊”，选择 B 手机附近地址。
- 点“送到哪里”，选择一个不同终点。
- 机型档选择“轻型重载”。
- 货物重量填 50-80kg 范围内，例如 `60kg`。
- 服务时间选“现在”。
- 等预估价出现。

期望前端：

- 起点/终点地址回填到首页。
- 预估价显示为具体金额，而不是 `--`。
- 底部 CTA 显示“预估价 ¥X 立即下单”。

后端/DB 验证：

坐标提示：示例坐标只是参考。实测时把 `origin` / `destination`
改为 B 手机当前 GPS 周边 `1km` 内，否则 B 的服务半径覆盖不到，第 4.1 看不到广播。

```bash
curl -s "$BASE_URL/orders/estimate" \
  -H 'Content-Type: application/json' \
  -d '{
    "origin": {"latitude": 22.5431, "longitude": 114.0579, "address": "E2E起点"},
    "destination": {"latitude": 22.5531, "longitude": 114.0679, "address": "E2E终点"},
    "cargo_weight_kg": 60,
    "service_class_code": "light_heavy"
  }' | jq '{code,message,data}'
```

期望：返回 `code=0`，`data.total_estimated_cents > 0`。

异常 catch：

```bash
grep -nE "orders/estimate|计价|service_class|AMAP|地图|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -80
```

若手机页面无预估价，截图 A 首页，并保存 Network/Console 日志。

### 2.2 手机 A：点“立即下单”

操作：

- A 点击底部 CTA。
- 不要连续点，本步骤先测单次下单。

期望前端：

- Toast 或页面反馈下单成功。
- 跳到订单详情或订单进度页。
- 能看到新订单，状态应接近“等待服务商 / 待接单 / pending_dispatch”。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  o.id, o.order_no, o.order_mode, o.order_source, o.status,
  o.client_user_id, o.provider_user_id, o.client_request_id,
  o.service_class_code, o.cargo_weight_kg, o.total_amount,
  o.service_latitude, o.service_longitude, o.dest_latitude, o.dest_longitude,
  o.created_at
FROM orders o
JOIN users u ON u.id = o.client_user_id
WHERE u.phone = '$A_PHONE'
ORDER BY o.id DESC
LIMIT 3;
"
```

设置后续变量：

```bash
export ORDER_ID=$($MYSQL -N -e "SELECT o.id FROM orders o JOIN users u ON u.id=o.client_user_id WHERE u.phone='$A_PHONE' ORDER BY o.id DESC LIMIT 1;")
export ORDER_NO=$($MYSQL -N -e "SELECT order_no FROM orders WHERE id=$ORDER_ID;")
echo "ORDER_ID=$ORDER_ID ORDER_NO=$ORDER_NO"
```

期望：

- `order_mode=instant`
- `order_source=instant`
- `status=pending_dispatch`
- `client_request_id` 非空
- `provider_user_id=0`
- `total_amount > 0`

异常 catch：

```bash
grep -nE "$ORDER_NO|orders/instant|client_request|duplicate|fk_orders|broadcast|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -120
```

### 2.3 验证广播已创建

操作：

- 手机 A 停在订单详情/进度页。

期望前端：

- A 看到订单等待服务商接单。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  b.id, b.order_id, b.status, b.service_class_code, b.weight_kg,
  b.estimated_total_cents, b.origin_latitude, b.origin_longitude,
  b.expires_at, b.grabbed_by_user_id, b.grabbed_at
FROM order_broadcasts b
WHERE b.order_id = $ORDER_ID;
"
```

设置广播变量：

```bash
export BROADCAST_ID=$($MYSQL -N -e "SELECT id FROM order_broadcasts WHERE order_id=$ORDER_ID ORDER BY id DESC LIMIT 1;")
echo "BROADCAST_ID=$BROADCAST_ID"
```

期望：

- 有 1 条 `order_broadcasts`。
- `status=open`
- `service_class_code` 与 A 选择机型一致。

异常 catch：

```bash
grep -nE "$ORDER_ID|createForOrder|order_broadcast|broadcast|pending_dispatch|ERROR" /tmp/wurenji-backend-e2e.log | tail -100
```

## 3. B 注册/登录服务商并上线

### 3.1 手机 B：注册服务商账号

操作：

- B 打开小程序。
- 选择“我要接单”。
- 点“新账号注册”。
- 手机号：`$B_PHONE`
- 密码：`$B_PASSWORD`
- 昵称：`服务商B-$E2E_TAG`
- 完成注册。

期望前端：

- 如果 B 是全新未审核账号，应看到服务商入驻/资质/审核状态。
- 如果 B 已审核，应进入服务商工作台。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, phone, nickname, user_type, id_verified, status, created_at
FROM users
WHERE phone='$B_PHONE';
"
```

可选 curl 验证：

```bash
curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$B_PHONE\",\"password\":\"$B_PASSWORD\"}" | jq '{code,message,user:.data.user,provider:.data.role_summary.provider}'
```

期望：

- `users.phone=$B_PHONE` 存在。
- 若 role_summary.provider.status 不是 `approved`，前端不应直接展示正式接单工作台。

异常 catch：

```bash
grep -nE "$B_PHONE|auth/register|role_summary|provider|onboarding|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -100
```

### 3.2 若 B 未通过服务商能力审核

操作：

- B 按页面提示完成服务商入驻。
- 如果当前测试目标是主链路，不验证审核后台，则切换到一个已审核服务商账号继续。

期望前端：

- 未审核时不能看到假订单池、假收入。
- 已审核后进入工作台，顶部有上线卡片。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT u.id, u.phone,
       op.status AS owner_status,
       pp.status AS pilot_profile_status,
       p.verification_status AS pilot_verification_status
FROM users u
LEFT JOIN owner_profiles op ON op.user_id = u.id
LEFT JOIN pilot_profiles pp ON pp.user_id = u.id
LEFT JOIN pilots p ON p.user_id = u.id
WHERE u.phone = '$B_PHONE';
"
```

异常 catch：

```bash
grep -nE "$B_PHONE|owner_profiles|pilot_profiles|verification|provider|onboarding|ERROR" /tmp/wurenji-backend-e2e.log | tail -100
```

如果这里无法让 B 进入工作台，本轮主链路阻塞，截图 B 的审核/入驻页面。

### 3.3 手机 B：选择机型并上线

操作：

- B 进入服务商工作台。
- 服务半径选 `30km`。
- 可接机型勾选“轻型重载”。
- 点“上线接单”。
- 首次弹定位授权时允许。

期望前端：

- 状态变成“已上线，等待接单”。
- CTA 变成“下线接单”。
- 附近订单 section 出现。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  p.user_id, u.phone, p.online, p.status,
  p.last_latitude, p.last_longitude, p.last_heartbeat_at,
  p.accepted_service_classes, p.max_radius_km, p.updated_at
FROM provider_presences p
JOIN users u ON u.id = p.user_id
WHERE u.phone = '$B_PHONE';
"
```

可选 curl 验证：

```bash
export B_TOKEN=$(curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$B_PHONE\",\"password\":\"$B_PASSWORD\"}" | jq -r '.data.token.access_token')

curl -s "$BASE_URL/provider/broadcasts?limit=20" \
  -H "Authorization: Bearer $B_TOKEN" | jq '.data.items[] | {id,order_id,status,distance_km,service_class_code,remaining_seconds}'
```

期望：

- `provider_presences.online=1`
- `accepted_service_classes` 包含 `light_heavy`
- `max_radius_km=30`
- `last_heartbeat_at` 有值并持续刷新

异常 catch：

```bash
grep -nE "$B_PHONE|provider/presence/online|heartbeat|位置|location|presence|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -120
```

如果 B 看不到广播，立即检查距离和机型是否匹配：

```bash
$MYSQL -e "
SELECT
  b.id AS broadcast_id, b.order_id, b.status AS broadcast_status,
  b.service_class_code AS broadcast_class,
  b.origin_latitude, b.origin_longitude,
  p.user_id AS provider_user_id, p.accepted_service_classes,
  p.max_radius_km, p.last_latitude, p.last_longitude, p.online
FROM order_broadcasts b
JOIN provider_presences p
JOIN users u ON u.id = p.user_id
WHERE b.order_id = $ORDER_ID
  AND u.phone = '$B_PHONE';
"
```

## 4. B 看到广播并抢单

### 4.1 手机 B：订单池出现 A 的订单

操作：

- B 保持在线。
- 等 5 秒左右，查看“附近订单”或“接单需求”页面。

期望前端：

- 出现 A 刚创建的订单卡片。
- 显示起点/终点、重量、预计金额、倒计时。
- 有“一键抢单/快速抢单”按钮。

后端/DB 验证：

```bash
curl -s "$BASE_URL/provider/broadcasts?limit=20" \
  -H "Authorization: Bearer $B_TOKEN" | jq --argjson oid "$ORDER_ID" '.data.items[] | select(.order_id==$oid)'
```

期望：能查到 `order_id=$ORDER_ID` 的广播。

异常 catch：

```bash
grep -nE "$ORDER_ID|provider/broadcasts|ListOpenForProvider|service_class|radius|broadcast|ERROR" /tmp/wurenji-backend-e2e.log | tail -120
```

### 4.2 手机 B：点击抢单

操作：

- B 在订单卡片点“一键抢单/抢单”。

期望前端：

- Toast 显示“抢单成功”。
- 跳到订单详情，或订单进入“我的订单/待服务订单”。
- 订单状态显示“服务商已接单 / assigned”。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  o.id, o.order_no, o.status, o.provider_user_id, o.owner_id,
  o.grabbed_by_user_id, o.grabbed_at, o.provider_confirmed_at,
  b.id AS broadcast_id, b.status AS broadcast_status, b.grabbed_by_user_id AS broadcast_grabbed_by, b.grabbed_at AS broadcast_grabbed_at
FROM orders o
LEFT JOIN order_broadcasts b ON b.order_id = o.id
WHERE o.id = $ORDER_ID;
"
```

期望：

- `orders.status=assigned`
- `orders.provider_user_id = B 的 user_id`
- `orders.grabbed_by_user_id = B 的 user_id`
- `order_broadcasts.status=grabbed`

补查提示：如果 `status` 还是 `pending_dispatch`，等 2 秒再查 DB；
后端事务提交到读取有微秒级延迟。

异常 catch：

```bash
grep -nE "$ORDER_ID|$BROADCAST_ID|grab|ErrBroadcastConflict|已被抢|409|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -120
```

如果前端提示“已被其他服务商抢走”，截图 B toast，并查：

```bash
$MYSQL -e "SELECT id, status, grabbed_by_user_id, grabbed_at FROM order_broadcasts WHERE id=$BROADCAST_ID;"
```

## 5. B 履约推进：开始准备 → 开始飞行 → 确认送达

### 5.1 手机 B：开始准备

操作：

- B 进入订单详情。
- 点“开始准备”。

期望前端：

- Toast “已推进”。
- 订单状态变为“准备起飞 / preparing”。
- 下一步按钮变成“开始飞行”。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, status, flight_start_time, flight_end_time, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT status, note, operator_type, created_at
FROM order_timelines
WHERE order_id=$ORDER_ID
ORDER BY id DESC
LIMIT 5;
"
```

期望：`orders.status=preparing`，timeline 新增准备阶段记录。

补查提示：timeline 表 `status` 字段值可能是 `preparing` 这类英文 raw 值，
也可能是后端做了本地化的中文。两种都正常，关键看 `order_id`
是否有新一条记录。

异常 catch：

```bash
grep -nE "$ORDER_ID|start-preparing|StartPreparing|准备|advance|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -100
```

### 5.2 手机 B：开始飞行

操作：

- B 点“开始飞行”。

期望前端：

- Toast “已推进”。
- 订单状态变为“飞行中 / in_transit”。
- 下一步按钮变成“确认送达”。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, status, flight_start_time, flight_end_time, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT status, note, operator_type, created_at
FROM order_timelines
WHERE order_id=$ORDER_ID
ORDER BY id DESC
LIMIT 5;
"
```

期望：`orders.status=in_transit`，`flight_start_time` 不为空。

异常 catch：

```bash
grep -nE "$ORDER_ID|start-flight|StartFlight|飞行|in_transit|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -100
```

### 5.3 手机 B：确认送达

操作：

- B 点“确认送达”。

期望前端：

- Toast “已推进”。
- 订单状态变为“等待签收 / delivered”。
- B 侧不应再显示履约推进按钮。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, status, flight_start_time, flight_end_time, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT status, note, operator_type, created_at
FROM order_timelines
WHERE order_id=$ORDER_ID
ORDER BY id DESC
LIMIT 8;
"
```

期望：`orders.status=delivered`，`flight_end_time` 不为空。

异常 catch：

```bash
grep -nE "$ORDER_ID|confirm-delivery|ConfirmDelivery|delivered|送达|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -100
```

## 6. A 观察状态变化并确认完成

### 6.1 手机 A：查看状态变化

操作：

- A 打开订单详情或订单列表。
- 如果页面未自动刷新，手动下拉刷新或重新进入订单详情。

期望前端：

- B 每推进一步，A 侧能看到对应状态变化：
  - `assigned`：服务商已接单
  - `preparing`：准备起飞
  - `in_transit`：飞行中
  - `delivered`：等待签收

后端/DB 验证：

```bash
curl -s "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $A_TOKEN" | jq '{status:.data.status, order_no:.data.order_no, provider:.data.provider_user_id, updated_at:.data.updated_at}'
```

期望：curl status 与 A 前端显示一致。

异常 catch：

```bash
grep -nE "$ORDER_ID|orders/$ORDER_ID|GetAuthorizedOrder|timeline|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -100
```

若 A 前端状态不更新但 DB 已更新，截图 A 页面，并记录是否手动刷新后恢复。

### 6.2 手机 A：确认完成

操作：

- A 在 delivered 状态下点“确认完成 / 确认签收”。

期望前端：

- Toast 或提示确认成功。
- 订单状态变为“已完成 / completed”。
- 可看到评价入口。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, order_no, status, completed_at, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT status, note, operator_type, created_at
FROM order_timelines
WHERE order_id=$ORDER_ID
ORDER BY id DESC
LIMIT 10;
"
```

期望：

- `orders.status=completed`
- `completed_at` 不为空
- timeline 包含 completed/settled 相关记录

异常 catch：

```bash
grep -nE "$ORDER_ID|confirm-receipt|ConfirmReceipt|completed|settlement|FinalizeOrderSettlement|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -160
```

## 7. A/B 查看 settlement 与钱包入账

### 7.1 DB 验证结算单

操作：

- A 确认完成后，B 打开“我的 / 钱包”或工作台收入。
- A 也可在订单详情查看结算信息入口。

期望前端：

- B 钱包/工作台收入能体现本单结算或收入变化。
- A 订单状态为已完成。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  s.id, s.settlement_no, s.order_id, s.order_no, s.status,
  s.total_amount, s.final_amount, s.platform_fee, s.pilot_fee, s.owner_fee,
  s.pilot_user_id, s.owner_user_id, s.payer_user_id,
  s.calculated_at, s.confirmed_at, s.settled_at, s.settled_by
FROM order_settlements s
WHERE s.order_id=$ORDER_ID;
"
```

期望：

- 有 1 条 `order_settlements`
- 正常路径下 `status=settled`
- `pilot_fee + owner_fee + platform_fee + insurance_deduction` 与 `final_amount` 口径匹配

异常 catch：

```bash
grep -nE "$ORDER_ID|settlement|FinalizeOrderSettlement|wallet|结算|入账|settlement_failed|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -160
```

注意：如果当前项目没有启用 `user_wallets` / `wallet_transactions`
（schema 里查不到表），跳过 7.2，只看 7.1 `order_settlements`
是否正常生成即可。结算单本身就代表入账。

### 7.2 DB 验证钱包流水

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  w.user_id, u.phone, w.available_balance, w.total_income, w.updated_at
FROM user_wallets w
JOIN users u ON u.id = w.user_id
WHERE u.phone IN ('$A_PHONE', '$B_PHONE')
ORDER BY u.phone;

SELECT
  wt.id, wt.user_id, u.phone, wt.type, wt.amount, wt.balance_before, wt.balance_after,
  wt.related_order_id, wt.related_settlement_id, wt.description, wt.created_at
FROM wallet_transactions wt
JOIN users u ON u.id = wt.user_id
WHERE wt.related_order_id=$ORDER_ID
ORDER BY wt.id;
"
```

期望：

- B 或服务商关联用户有 income 流水。
- `related_order_id=$ORDER_ID`
- `related_settlement_id` 指向本单 settlement。

异常 catch：

```bash
grep -nE "$ORDER_ID|wallet_transactions|AddWalletIncome|income|settlement_execute_failed|ERROR" /tmp/wurenji-backend-e2e.log | tail -160
```

## 8. A 重启小程序后仍登录：token hydrate

### 8.1 手机 A：杀掉并重启小程序

操作：

- A 从系统任务管理器彻底划掉微信小程序。
- 重新打开小程序。

期望前端：

- 不要求重新登录。
- 自动回到客户首页或上次页面。
- “我的”页能显示 A 用户信息。

后端/DB 验证：

```bash
curl -s "$BASE_URL/me" \
  -H "Authorization: Bearer $A_TOKEN" | jq '{code,message,user:.data.user,role_summary:.data.role_summary}'
```

前端本地 hydrate 无法直接从 DB 看，但可以用接口侧验证 token 仍有效。若手机重启后跳登录，说明前端 storage hydrate 或 refresh-token 流程有问题。

异常 catch：

```bash
grep -nE "$A_PHONE|/me|refresh-token|401|logout|登录已过期|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -120
```

截图：

- A 重启后的首页或登录页。
- 如果跳登录，截登录页和 Console/Network 中 401 请求。

## 9. 幂等验证：A 连续点两次下单

### 9.1 手机 A：准备第二个订单

操作：

- A 回首页。
- 起点/终点仍选 B 附近。
- 机型仍选轻型重载。
- 等预估价完成。

期望前端：

- CTA 可点击。
- 预估价显示正常。

后端/DB 验证：

```bash
export BEFORE_ORDER_COUNT=$($MYSQL -N -e "SELECT COUNT(*) FROM orders o JOIN users u ON u.id=o.client_user_id WHERE u.phone='$A_PHONE';")
echo "BEFORE_ORDER_COUNT=$BEFORE_ORDER_COUNT"
```

异常 catch：

```bash
grep -nE "$A_PHONE|orders/estimate|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -80
```

### 9.2 手机 A：故意快速连续点击两次 CTA

操作：

- A 快速连点“立即下单”两次。
- 保留录屏或截图，便于证明是双击场景。

期望前端：

- 最多成功创建一个订单。
- 不应出现两个新订单。
- 如果第二次请求被复用，最终看到的应是同一个订单。

后端/DB 验证：

```bash
export AFTER_ORDER_COUNT=$($MYSQL -N -e "SELECT COUNT(*) FROM orders o JOIN users u ON u.id=o.client_user_id WHERE u.phone='$A_PHONE';")
echo "BEFORE=$BEFORE_ORDER_COUNT AFTER=$AFTER_ORDER_COUNT DELTA=$((AFTER_ORDER_COUNT-BEFORE_ORDER_COUNT))"

$MYSQL -e "
SELECT
  o.id, o.order_no, o.status, o.order_mode, o.client_request_id, o.created_at
FROM orders o
JOIN users u ON u.id=o.client_user_id
WHERE u.phone='$A_PHONE'
ORDER BY o.id DESC
LIMIT 5;
"

$MYSQL -e "
SELECT
  o.client_request_id, COUNT(*) AS cnt, GROUP_CONCAT(o.id ORDER BY o.id) AS order_ids
FROM orders o
JOIN users u ON u.id=o.client_user_id
WHERE u.phone='$A_PHONE'
  AND o.client_request_id IS NOT NULL
  AND o.client_request_id <> ''
GROUP BY o.client_request_id
HAVING COUNT(*) > 1;
"
```

期望：

- `DELTA=1`
- 最近一条订单 `client_request_id` 非空
- 最后一条分组查询返回空结果。
  说明同一个 `client_request_id` 没有创建多条订单。

如果要用 curl 直接复现同一幂等键：

```bash
export IDEMPOTENCY_ID="manual-$E2E_TAG"

curl -s "$BASE_URL/orders/instant" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"origin\": {\"latitude\": 22.5431, \"longitude\": 114.0579, \"address\": \"幂等起点\"},
    \"destination\": {\"latitude\": 22.5531, \"longitude\": 114.0679, \"address\": \"幂等终点\"},
    \"cargo_weight_kg\": 60,
    \"service_class_code\": \"light_heavy\",
    \"client_request_id\": \"$IDEMPOTENCY_ID\"
  }" | jq '.data.order | {id, order_no, client_request_id}'

curl -s "$BASE_URL/orders/instant" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"origin\": {\"latitude\": 22.5431, \"longitude\": 114.0579, \"address\": \"幂等起点\"},
    \"destination\": {\"latitude\": 22.5531, \"longitude\": 114.0679, \"address\": \"幂等终点\"},
    \"cargo_weight_kg\": 60,
    \"service_class_code\": \"light_heavy\",
    \"client_request_id\": \"$IDEMPOTENCY_ID\"
  }" | jq '.data.order | {id, order_no, client_request_id}'

$MYSQL -e "
SELECT client_request_id, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS order_ids
FROM orders
WHERE client_request_id='$IDEMPOTENCY_ID'
GROUP BY client_request_id;
"
```

期望：两次 curl 返回同一个 `order.id`；DB 中 `cnt=1`。

异常 catch：

```bash
grep -nE "client_request|duplicate|idx_orders_client_request_id|orders/instant|$IDEMPOTENCY_ID|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -160
```

## 10. 本轮结果记录模板

复制下面模板到测试记录里：

~~~markdown
## 两手机 E2E 结果

- 日期：
- 后端 base URL：
- 小程序版本/构建：
- A 手机/微信版本：
- B 手机/微信版本：
- A phone：
- B phone：
- ORDER_ID / ORDER_NO：
- BROADCAST_ID：

### 通过项
- [ ] A 注册客户
- [ ] A 下单，client_request_id 非空
- [ ] order_broadcasts 创建
- [ ] B 注册/登录服务商
- [ ] B 上线，presence 写入并 heartbeat
- [ ] B 看到广播
- [ ] B 抢单成功
- [ ] B 开始准备
- [ ] B 开始飞行
- [ ] B 确认送达
- [ ] A 看到状态变化
- [ ] A 确认完成
- [ ] settlement 生成并入账
- [ ] A 重启后仍登录
- [ ] 双击下单只生成一单
- [ ] dispatch_failed 触发后客户能取消
- [ ] 排除表三种 reason 都写入
- [ ] 退款 income_reversal 流水可追溯到原 income
- [ ] 资金守恒：每个 user 的 net = 0

### 异常
| 步骤 | 手机 | 现象 | 截图 | SQL/日志摘要 | 是否阻塞 |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

### 关键 SQL 输出
```text
粘贴订单、广播、presence、settlement、wallet_transactions 查询结果。
```
~~~

## 11. 快速清理 SQL（可选）

只在确认要清理本轮手测数据时执行。默认不要清理，方便复盘。

```bash
$MYSQL -e "
SELECT '将清理订单' AS note, id, order_no FROM orders WHERE id IN ($ORDER_ID);
"
```

如确需清理，请先确认相关外键和业务记录；建议保留数据用于后续回归，不提供默认删除脚本。

## 13. 派单失败 + 客户取消

目的：验证所有候选服务商拒绝或超时后，订单进入 `dispatch_failed`，A 能感知并取消。

### 13.1 准备多个服务商号

操作：

- 准备至少 2 个服务商号 X / Y，资质均为 approved。
- 确保 X / Y 服务半径覆盖 A 起吊点，且 accepted_service_classes 覆盖本单机型。
- 用 admin/SQL 或脚本把其它在线服务商先下线，避免被非目标账号接单。
- 建议先设置：

```bash
export X_PHONE="13900010004"
export Y_PHONE="13900010003"

export X_TOKEN=$(curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$X_PHONE\",\"password\":\"$B_PASSWORD\"}" | jq -r '.data.token.access_token')

export Y_TOKEN=$(curl -s "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$Y_PHONE\",\"password\":\"$B_PASSWORD\"}" | jq -r '.data.token.access_token')
```

期望前端：

- X / Y 进入服务商工作台后均可上线。
- X / Y 工作台状态显示在线或综合就绪。
- 其它服务商不会在工作台看到本轮订单。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, phone, nickname, status
FROM users
WHERE phone IN ('$X_PHONE', '$Y_PHONE');

UPDATE provider_presences p
LEFT JOIN users u ON u.id = p.user_id
SET p.online = 0, p.status = 'offline', p.last_offline_at = NOW(3), p.updated_at = NOW(3)
WHERE u.phone NOT IN ('$X_PHONE', '$Y_PHONE');

SELECT
  u.phone, p.online, p.status, p.accepted_service_classes,
  p.max_radius_km, p.last_latitude, p.last_longitude
FROM provider_presences p
JOIN users u ON u.id = p.user_id
WHERE u.phone IN ('$X_PHONE', '$Y_PHONE');
"
```

期望：只有 X / Y 处于在线候选范围，坐标和半径能覆盖 A 起吊点。

异常 catch grep：

```bash
grep -nE "provider_presences|online|offline|accepted_service_classes|radius|$X_PHONE|$Y_PHONE|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -160
```

### 13.2 A 下一单，所有服务商均拒绝

操作：

- A 按第 2 节重新下一单，记录新的 `ORDER_ID` / `BROADCAST_ID`。
- X 收到一对一指派时主动拒绝；下一轮到 Y 时 Y 也主动拒绝。
- 如果要走超时分支，让 X / Y 都不响应，等待 `accept_deadline_at` 超时。
- 手动 curl 拒绝时先查 assignment id，再调用 decline：

```bash
$MYSQL -e "
SELECT
  a.id, a.order_id, a.provider_user_id, a.status,
  a.assignment_seq, a.accept_deadline_at
FROM broadcast_assignments a
WHERE a.order_id=$ORDER_ID
ORDER BY a.id DESC;
"

export X_ASSIGNMENT_ID="替换为 X 的 assignment id"

curl -s "$BASE_URL/provider/broadcast-assignments/$X_ASSIGNMENT_ID/decline" \
  -H "Authorization: Bearer $X_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"E2E 主动拒绝"}' | jq '{code,message,data}'
```

期望前端：

- A 订单详情/列表逐渐变成“暂无服务商”状态。
- A 仍停留在订单详情或订单列表，不应白屏。
- X / Y 拒绝后不应再次收到同一单指派。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, order_no, status, provider_user_id, grabbed_by_user_id, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT id, order_id, status, expires_at, grabbed_by_user_id, grabbed_at
FROM order_broadcasts
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT
  e.order_id, e.broadcast_id, e.provider_user_id, u.phone,
  e.reason, e.created_at
FROM order_broadcast_exclusions e
JOIN users u ON u.id = e.provider_user_id
WHERE e.order_id=$ORDER_ID
ORDER BY e.id;

SELECT
  id, provider_user_id, status, assignment_seq,
  accept_deadline_at, responded_at
FROM broadcast_assignments
WHERE order_id=$ORDER_ID
ORDER BY id;
"
```

期望：

- `orders.status = dispatch_failed`
- 最新 `order_broadcasts.status = expired`
- `order_broadcast_exclusions` 里 X / Y 都有记录。
- 拒绝分支 reason 为 `assignment_declined`，超时分支 reason 为 `assignment_timeout`。

异常 catch grep：

```bash
grep -nE "dispatch_failed|候选耗尽|exclusion|expired|assignment_declined|assignment_timeout|$ORDER_ID|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -200
```

### 13.3 客户在 dispatch_failed 状态下取消

操作：

- A 打开该订单详情。
- 确认状态显示“暂无服务商”。
- 点击“取消订单”。
- 如果前端不方便操作，可用 curl 验证同一路径：

```bash
curl -s "$BASE_URL/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"E2E dispatch_failed 后客户取消"}' | jq '{code,message,data}'
```

期望前端：

- 详情页能看到“取消订单”按钮，不再灰态。
- 点击后 toast 或弹层提示取消成功。
- 订单详情/列表状态变成“已取消 / cancelled”。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, order_no, status, cancel_by, cancel_reason, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT status, note, operator_type, created_at
FROM order_timelines
WHERE order_id=$ORDER_ID
ORDER BY id DESC
LIMIT 10;
"
```

期望：`orders.status=cancelled`，timeline 有 `cancelled` 记录；若订单已支付，继续按 13.4 验退款。

异常 catch grep：

```bash
grep -nE "$ORDER_ID|dispatch_failed|cancel|RefundPayment|refund|403|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -200
```

### 13.4 假支付场景下验取消触发的退款

操作：

- 因为支付是 mock，先用 SQL 把一张 `dispatch_failed` 订单标记为 paid。
- 同时写入一笔 mock payment 和一笔用户 wallet income 流水，记录原 income id。
- 再按 13.3 触发取消。

```bash
export MOCK_PAYMENT_NO="PAY-E2E-$ORDER_ID-$(date +%H%M%S)"
export MOCK_TX_NO="TX-E2E-$ORDER_ID-$(date +%H%M%S)"

$MYSQL -e "
INSERT INTO payments (
  payment_no, order_id, user_id, payment_type, payment_method,
  amount, status, third_party_no, paid_at, created_at, updated_at
)
SELECT
  '$MOCK_PAYMENT_NO', o.id, o.client_user_id, 'order', 'mock',
  o.total_amount, 'paid', '$MOCK_PAYMENT_NO', NOW(3), NOW(3), NOW(3)
FROM orders o
WHERE o.id=$ORDER_ID
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.order_id=o.id AND p.payment_type='order' AND p.status='paid'
  );

UPDATE orders SET paid_at=COALESCE(paid_at, NOW(3)), updated_at=NOW(3)
WHERE id=$ORDER_ID;

INSERT INTO user_wallets (
  user_id, wallet_type, available_balance, frozen_balance,
  total_income, total_withdrawn, total_frozen, status, created_at, updated_at
)
SELECT o.client_user_id, 'general', 0, 0, 0, 0, 0, 'active', NOW(3), NOW(3)
FROM orders o
WHERE o.id=$ORDER_ID
ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at);

INSERT INTO wallet_transactions (
  transaction_no, wallet_id, user_id, type, amount,
  balance_before, balance_after, related_order_id,
  related_settlement_id, related_transaction_id, description, created_at
)
SELECT
  '$MOCK_TX_NO', w.id, o.client_user_id, 'income', o.total_amount,
  0, o.total_amount, o.id, 0, 0, 'E2E mock paid income', NOW(3)
FROM orders o
JOIN user_wallets w ON w.user_id=o.client_user_id
WHERE o.id=$ORDER_ID
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.related_order_id=o.id AND wt.type='income' AND wt.transaction_no='$MOCK_TX_NO'
  );
"

export ORIGINAL_TX_ID=$($MYSQL -N -e "
SELECT id
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID AND type='income'
ORDER BY id DESC
LIMIT 1;
")

echo "$ORIGINAL_TX_ID"
```

期望前端：

- A 取消后看到订单取消成功。
- 退款处理后订单详情能看到退款或取消记录。
- 不应出现重复退款 toast 或页面卡死。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, refund_no, order_id, payment_id, related_transaction_id, amount, status, created_at, updated_at
FROM refunds
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT
  id, transaction_no, user_id, type, amount,
  related_order_id, related_transaction_id, description, created_at
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
ORDER BY id;

SELECT user_id,
       SUM(CASE WHEN type='income' THEN amount
                WHEN type='income_reversal' THEN amount
                ELSE 0 END) AS net_for_order
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
GROUP BY user_id;
"
```

期望：

- `wallet_transactions` 多一条 `type=income_reversal`。
- `income_reversal.amount` 是负数。
- `income_reversal.related_transaction_id = $ORIGINAL_TX_ID`。
- 每个 user 的 `net_for_order = 0`。

异常 catch grep：

```bash
grep -nE "$ORDER_ID|RefundPayment|income_reversal|related_transaction_id|wallet_transactions|refunds|资金守恒|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -240
```

## 14. 退款资金守恒专项

目的：单独把退款链路从端到端跑一次，覆盖取消和异常退款的 4 个状态场景。

### 14.1 pending_dispatch 取消（无服务商）

操作：

- A 下一张即时单，记录新的 `ORDER_ID`。
- 保持订单未被服务商抢到，确认 `orders.status=pending_dispatch`。
- 如需模拟已支付，复用 13.4 的 mock payment + income SQL。
- A 在订单详情点击“取消订单”。

期望前端：

- 取消按钮可用。
- 取消成功后订单状态变为“已取消 / cancelled”。
- 如果已支付，订单详情能看到退款记录或取消退款提示。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, order_no, status, paid_at, cancel_by, cancel_reason, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT id, refund_no, related_transaction_id, amount, status, created_at
FROM refunds
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT
  id, user_id, type, amount, related_order_id,
  related_transaction_id, created_at
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
ORDER BY id;

SELECT status, total_amount, final_amount, platform_fee, pilot_fee, owner_fee
FROM order_settlements
WHERE order_id=$ORDER_ID;

SELECT user_id,
       SUM(CASE WHEN type='income' THEN amount
                WHEN type='income_reversal' THEN amount
                ELSE 0 END) AS net_for_order
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
GROUP BY user_id;
"
```

期望：未支付单无退款流水；已支付单有 `income_reversal`，每个 user 的 `net_for_order=0`。

异常 catch grep：

```bash
grep -nE "$ORDER_ID|pending_dispatch|cancel|RefundPayment|income_reversal|refunds|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -220
```

### 14.2 assigned 取消（服务商已接但未起飞）

操作：

- A 下一单，B 或 Y 抢单成功，确认 `orders.status=assigned`。
- 如需模拟已支付，复用 13.4 的 mock payment + income SQL。
- A 在服务商未点“开始准备”前取消订单。

期望前端：

- 免费取消期内应能取消成功。
- 超过免费取消期时，前端应显示扣费或取消失败提示，按当前规则记录。
- 取消成功后 B/Y 不应还能推进该订单。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT
  id, order_no, status, provider_user_id,
  grabbed_by_user_id, grabbed_at, cancel_by, cancel_reason, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT id, refund_no, related_transaction_id, amount, status, reason, created_at
FROM refunds
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT
  id, user_id, type, amount, balance_before, balance_after,
  related_order_id, related_transaction_id, created_at
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
ORDER BY id;

SELECT status, total_amount, final_amount, platform_fee, pilot_fee, owner_fee
FROM order_settlements
WHERE order_id=$ORDER_ID;

SELECT user_id,
       SUM(CASE WHEN type='income' THEN amount
                WHEN type='income_reversal' THEN amount
                ELSE 0 END) AS net_for_order
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
GROUP BY user_id;
"
```

期望：免费取消场景资金守恒为 0；扣费场景记录实际扣费原因，不能重复写退款。

异常 catch grep：

```bash
grep -nE "$ORDER_ID|assigned|cancel|grace_window|RefundPayment|income_reversal|403|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -240
```

### 14.3 in_transit 取消（飞行中进入争议）

操作：

- A 下一单，B/Y 抢单并推进到“开始飞行”，确认 `orders.status=in_transit`。
- A 在飞行中点击“取消订单”。
- 如果前端没有取消入口，用 curl 调接口验证后端行为：

```bash
curl -s "$BASE_URL/orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"E2E 飞行中取消争议验证"}' | jq '{code,message,data}'
```

期望前端：

- 不应直接取消成功并退款。
- 应提示服务已开始、进入争议或需要平台处理。
- 订单不应从 `in_transit` 直接变为 `cancelled`。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, order_no, status, cancel_by, cancel_reason, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT id, order_id, initiator_user_id, dispute_type, status, summary, created_at
FROM dispute_records
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT id, refund_no, related_transaction_id, amount, status, reason, created_at
FROM refunds
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT
  id, user_id, type, amount, related_order_id,
  related_transaction_id, created_at
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
ORDER BY id;

SELECT status, total_amount, final_amount, platform_fee, pilot_fee, owner_fee
FROM order_settlements
WHERE order_id=$ORDER_ID;

SELECT user_id,
       SUM(CASE WHEN type='income' THEN amount
                WHEN type='income_reversal' THEN amount
                ELSE 0 END) AS net_for_order
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
GROUP BY user_id;
"
```

期望：`orders.status` 保持 `in_transit`；`dispute_records` 有 `cancel_request`；不应新增直接退款。

异常 catch grep：

```bash
grep -nE "$ORDER_ID|in_transit|cancel_request|dispute|refund|income_reversal|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -240
```

### 14.4 completed 后申请退款（异常路径）

操作：

- 跑完一单到 `completed`，确认 settlement 已生成。
- A 在订单完成后尝试申请退款。
- 如果前端没有入口，用接口直接验证：

```bash
curl -s "$BASE_URL/orders/$ORDER_ID/refund" \
  -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"E2E completed 后异常退款验证"}' | jq '{code,message,data}'
```

期望前端：

- 如果当前版本没有售后退款入口，记录为前端入口缺失。
- 如果有入口，应进入售后/争议流程，不应直接扣回服务商钱包。
- 页面不能白屏，不能重复提交多笔退款。

后端/DB 验证：

```bash
$MYSQL -e "
SELECT id, order_no, status, completed_at, updated_at
FROM orders
WHERE id=$ORDER_ID;

SELECT
  id, order_id, status, total_amount, final_amount,
  platform_fee, pilot_fee, owner_fee, settled_at, updated_at
FROM order_settlements
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT id, refund_no, related_transaction_id, amount, status, reason, created_at
FROM refunds
WHERE order_id=$ORDER_ID
ORDER BY id DESC;

SELECT
  id, user_id, type, amount, balance_before, balance_after,
  related_order_id, related_settlement_id, related_transaction_id, created_at
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
ORDER BY id;

SELECT user_id,
       SUM(CASE WHEN type='income' THEN amount
                WHEN type='income_reversal' THEN amount
                ELSE 0 END) AS net_for_order
FROM wallet_transactions
WHERE related_order_id=$ORDER_ID
GROUP BY user_id;
"
```

期望：完成后退款不得绕过售后/争议规则；若创建退款，必须有 `related_transaction_id`，且资金守恒可解释。

异常 catch grep：

```bash
grep -nE "$ORDER_ID|completed|refund|RefundPayment|income_reversal|settlement|dispute|售后|ERROR|panic" /tmp/wurenji-backend-e2e.log | tail -260
```
