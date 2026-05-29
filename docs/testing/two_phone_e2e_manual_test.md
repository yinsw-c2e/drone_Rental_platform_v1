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
