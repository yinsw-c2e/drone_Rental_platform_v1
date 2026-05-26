#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
API_V2="$BASE_URL/api/v2"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root}"
MYSQL_DB="${MYSQL_DB:-wurenji}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-wurenji-mysql}"

CUSTOMER_PHONE="${CUSTOMER_PHONE:-13800000004}"
PROVIDER_PHONE="${PROVIDER_PHONE:-13800000007}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-password123}"
PREPARE_DEMO_DATA="${PREPARE_DEMO_DATA:-1}"
DEVTOKEN_CONFIG_PATH="${DEVTOKEN_CONFIG_PATH:-config.yaml}"

REPORT_FILE="${REPORT_FILE:-$BACKEND_DIR/docs/mini_program_p1_reset_last_run.json}"
P0_REPORT_FILE="${P0_REPORT_FILE:-$BACKEND_DIR/docs/mini_program_p1_reset_p0_flow_last_run.json}"
ALLOW_NON_LOCAL="${ALLOW_NON_LOCAL:-0}"

RESULTS_JSON='[]'

CUSTOMER_USER_ID=""
PROVIDER_USER_ID=""
OPEN_DEMAND_ID=""
P0_DEMAND_ID=""
P0_QUOTE_ID=""
P0_ORDER_ID=""
P0_DISPATCH_ID=""
P0_SETTLEMENT_ID=""
P0_SETTLEMENT_STATUS=""
CLEANUP_DEMANDS="0"
CLEANUP_ORDERS="0"
CLEANUP_SETTLEMENTS="0"
CLEANUP_DISPATCHES="0"

STALE_VALUE_PATTERN="${STALE_VALUE_PATTERN:-飞手|机主|执行人员|执行人|派单|龙岗|坂田|坪山|安易|施工物料吊运|680~920|680-920|￥680}"

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required binary: $1" >&2
    exit 1
  }
}

append_result() {
  local phase="$1"
  local step="$2"
  local status="$3"
  local detail="$4"
  RESULTS_JSON="$(jq -c \
    --arg phase "$phase" \
    --arg step "$step" \
    --arg status "$status" \
    --arg detail "$detail" \
    '. + [{phase:$phase, step:$step, status:$status, detail:$detail}]' \
    <<<"$RESULTS_JSON")"
  printf '[%s] %s -> %s %s\n' "$phase" "$step" "$status" "$detail"
}

write_report() {
  local exit_status="$1"
  mkdir -p "$(dirname "$REPORT_FILE")"
  jq -n \
    --arg run_at "$(date -Iseconds)" \
    --arg base_url "$BASE_URL" \
    --argjson exit_status "$exit_status" \
    --arg customer_phone "$CUSTOMER_PHONE" \
    --arg provider_phone "$PROVIDER_PHONE" \
    --arg customer_user_id "$CUSTOMER_USER_ID" \
    --arg provider_user_id "$PROVIDER_USER_ID" \
    --arg open_demand_id "$OPEN_DEMAND_ID" \
    --arg p0_demand_id "$P0_DEMAND_ID" \
    --arg p0_quote_id "$P0_QUOTE_ID" \
    --arg p0_order_id "$P0_ORDER_ID" \
    --arg p0_dispatch_id "$P0_DISPATCH_ID" \
    --arg p0_settlement_id "$P0_SETTLEMENT_ID" \
    --arg p0_settlement_status "$P0_SETTLEMENT_STATUS" \
    --arg cleanup_demands "$CLEANUP_DEMANDS" \
    --arg cleanup_orders "$CLEANUP_ORDERS" \
    --arg cleanup_settlements "$CLEANUP_SETTLEMENTS" \
    --arg cleanup_dispatches "$CLEANUP_DISPATCHES" \
    --arg p0_report_file "$P0_REPORT_FILE" \
    --argjson results "$RESULTS_JSON" \
    '{
      run_at:$run_at,
      base_url:$base_url,
      exit_status:$exit_status,
      accounts:{
        customer:{phone:$customer_phone,user_id:$customer_user_id},
        provider:{phone:$provider_phone,user_id:$provider_user_id}
      },
      cleanup:{
        demands:($cleanup_demands | tonumber),
        orders:($cleanup_orders | tonumber),
        settlements:($cleanup_settlements | tonumber),
        dispatches:($cleanup_dispatches | tonumber)
      },
      artifacts:{
        open_demand_id:$open_demand_id,
        completed_flow:{
          demand_id:$p0_demand_id,
          quote_id:$p0_quote_id,
          order_id:$p0_order_id,
          dispatch_id:$p0_dispatch_id,
          settlement_id:$p0_settlement_id,
          settlement_status:$p0_settlement_status,
          report_file:$p0_report_file
        }
      },
      results:$results
    }' > "$REPORT_FILE"
}

assert_dev_target() {
  if [[ "$ALLOW_NON_LOCAL" == "1" ]]; then
    append_result "GUARD" "target_check" "passed" "ALLOW_NON_LOCAL=1"
    return
  fi

  case "$BASE_URL" in
    http://127.0.0.1:*|http://localhost:*|https://dronerentalplat.cpolar.top)
      ;;
    *)
      echo "Refusing to reset acceptance data against non-local BASE_URL=$BASE_URL" >&2
      echo "Set ALLOW_NON_LOCAL=1 only for a disposable dev database." >&2
      exit 2
      ;;
  esac

  if [[ "$MYSQL_DB" != "wurenji" ]]; then
    echo "Refusing to reset acceptance data against MYSQL_DB=$MYSQL_DB" >&2
    echo "Set ALLOW_NON_LOCAL=1 only for a disposable dev database." >&2
    exit 2
  fi

  append_result "GUARD" "target_check" "passed" "base_url=$BASE_URL db=$MYSQL_DB"
}

assert_success() {
  local response="$1"
  local label="$2"
  local code
  code="$(jq -r '.code // empty' <<<"$response")"
  if [[ "$code" != "OK" && "$code" != "0" ]]; then
    echo "assert_success failed for $label" >&2
    echo "$response" >&2
    append_result "ERROR" "$label" "failed" "$(jq -c '.' <<<"$response")"
    exit 1
  fi
}

json_get() {
  local token="$1"
  local route="$2"
  curl -sS --max-time 20 "$API_V2$route" \
    -H "Authorization: Bearer $token"
}

json_post() {
  local token="$1"
  local route="$2"
  local payload="$3"
  curl -sS --max-time 20 -X POST "$API_V2$route" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

mysql_exec() {
  if command -v mysql >/dev/null 2>&1; then
    mysql --default-character-set=utf8mb4 \
      -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASS" -D "$MYSQL_DB" "$@"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
    docker exec -i -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 "$MYSQL_CONTAINER" \
      mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" "$@"
    return
  fi
  return 1
}

mint_dev_token() {
  local phone="$1"
  (
    cd "$BACKEND_DIR"
    go run ./cmd/devtoken -phone "$phone" -config "$DEVTOKEN_CONFIG_PATH"
  )
}

login_token() {
  local phone="$1"
  local response access_token

  response="$(curl -sS --max-time 15 -X POST "$API_V2/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\",\"password\":\"$LOGIN_PASSWORD\"}")"
  if [[ "$(jq -r '.code // empty' <<<"$response")" == "OK" ]]; then
    jq -r '.data.token.access_token' <<<"$response"
    return
  fi

  access_token="$(mint_dev_token "$phone")"
  if [[ -n "$access_token" ]]; then
    echo "$access_token"
    return
  fi

  echo "failed to login for $phone via password/devtoken" >&2
  echo "$response" >&2
  exit 1
}

soft_hide_old_acceptance_data() {
  local cleanup_output cleanup_line

  cleanup_output="$(mysql_exec --batch --raw --skip-column-names <<'SQL'
CREATE TEMPORARY TABLE p1_reset_demands (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE p1_reset_orders (id BIGINT PRIMARY KEY);

INSERT IGNORE INTO p1_reset_demands (id)
SELECT id
FROM demands
WHERE
  title LIKE '%小程序P0验收%'
  OR title LIKE '%小程序P1验收%'
  OR title LIKE '%小程序人工验收%'
  OR title LIKE '%重启复核%'
  OR title LIKE '%龙岗区坂田仓库%'
  OR title LIKE '%南山区仓储点%'
  OR title LIKE '%宝安临时堆场%'
  OR title LIKE '%坪山区施工点%'
  OR title LIKE '%光明作业点%'
  OR title LIKE '%施工物料吊运%'
  OR description LIKE '%mini program p0%'
  OR description LIKE '%mini program p1%'
  OR description LIKE '%mini program provider workflow fixture%'
  OR cargo_special_requirements LIKE '%小程序P0验收%'
  OR cargo_special_requirements LIKE '%小程序P1验收%'
  OR cargo_special_requirements LIKE '%小程序人工验收%'
  OR CAST(COALESCE(departure_address_snapshot, JSON_OBJECT()) AS CHAR) LIKE '%龙岗%'
  OR CAST(COALESCE(destination_address_snapshot, JSON_OBJECT()) AS CHAR) LIKE '%坪山%'
  OR CAST(COALESCE(destination_address_snapshot, JSON_OBJECT()) AS CHAR) LIKE '%光明%'
  OR CAST(COALESCE(service_address_snapshot, JSON_OBJECT()) AS CHAR) LIKE '%龙岗%';

INSERT IGNORE INTO p1_reset_orders (id)
SELECT id
FROM orders
WHERE
  demand_id IN (SELECT id FROM p1_reset_demands)
  OR title LIKE '%小程序P0验收%'
  OR title LIKE '%小程序P1验收%'
  OR title LIKE '%小程序人工验收%'
  OR title LIKE '%重启复核%'
  OR title LIKE '%龙岗%'
  OR title LIKE '%坂田%'
  OR title LIKE '%坪山%'
  OR title LIKE '%施工物料吊运%'
  OR service_address LIKE '%龙岗%'
  OR dest_address LIKE '%坪山%'
  OR dest_address LIKE '%光明%';

UPDATE demands d
JOIN p1_reset_demands t ON t.id = d.id
SET
  d.title = REPLACE(REPLACE(REPLACE(REPLACE(d.title, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排'),
  d.description = REPLACE(REPLACE(REPLACE(REPLACE(d.description, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排'),
  d.cargo_special_requirements = REPLACE(REPLACE(REPLACE(REPLACE(d.cargo_special_requirements, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排'),
  d.status = 'cancelled',
  d.expires_at = COALESCE(d.expires_at, NOW()),
  d.updated_at = NOW();

UPDATE demand_quotes q
JOIN p1_reset_demands t ON t.id = q.demand_id
SET
  q.execution_plan = REPLACE(REPLACE(REPLACE(REPLACE(q.execution_plan, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排'),
  q.status = CASE WHEN q.status IN ('submitted', 'selected') THEN 'cancelled' ELSE q.status END,
  q.updated_at = NOW();

UPDATE orders o
JOIN p1_reset_orders t ON t.id = o.id
SET
  o.title = REPLACE(REPLACE(REPLACE(REPLACE(o.title, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排'),
  o.status = 'cancelled',
  o.cancel_reason = '小程序P1验收数据重置：隐藏旧演示样本',
  o.cancel_by = 'system',
  o.deleted_at = COALESCE(o.deleted_at, NOW()),
  o.updated_at = NOW();

UPDATE dispatch_tasks dt
JOIN p1_reset_orders t ON t.id = dt.order_id
SET
  dt.reason = REPLACE(REPLACE(REPLACE(REPLACE(dt.reason, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排'),
  dt.status = CASE WHEN dt.status IN ('pending_response', 'accepted') THEN 'cancelled' ELSE dt.status END,
  dt.deleted_at = COALESCE(dt.deleted_at, NOW()),
  dt.updated_at = NOW();

UPDATE order_settlements s
JOIN p1_reset_orders t ON t.id = s.order_id
SET
  s.notes = CONCAT(COALESCE(NULLIF(s.notes, ''), ''), CASE WHEN COALESCE(s.notes, '') = '' THEN '' ELSE '\n' END, '小程序P1验收数据重置：旧演示结算已隐藏'),
  s.deleted_at = COALESCE(s.deleted_at, NOW()),
  s.updated_at = NOW();

UPDATE order_timelines tl
JOIN p1_reset_orders t ON t.id = tl.order_id
SET tl.note = REPLACE(REPLACE(REPLACE(REPLACE(tl.note, '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '派单', '履约安排');

SET @p1_reset_demand_count = (SELECT COUNT(*) FROM p1_reset_demands);
SET @p1_reset_order_count = (SELECT COUNT(*) FROM p1_reset_orders);
SET @p1_reset_settlement_count = (SELECT COUNT(*) FROM order_settlements s JOIN p1_reset_orders t ON t.id = s.order_id);
SET @p1_reset_dispatch_count = (SELECT COUNT(*) FROM dispatch_tasks dt JOIN p1_reset_orders t ON t.id = dt.order_id);

SELECT @p1_reset_demand_count, @p1_reset_order_count, @p1_reset_settlement_count, @p1_reset_dispatch_count;
SQL
)"
  cleanup_line="$(tail -n1 <<<"$cleanup_output")"
  read -r CLEANUP_DEMANDS CLEANUP_ORDERS CLEANUP_SETTLEMENTS CLEANUP_DISPATCHES <<<"$cleanup_line"
  append_result "CLEANUP" "soft_hide_old_demo_data" "passed" "demands=$CLEANUP_DEMANDS orders=$CLEANUP_ORDERS settlements=$CLEANUP_SETTLEMENTS dispatches=$CLEANUP_DISPATCHES"
}

run_completed_flow_fixture() {
  REPORT_FILE="$P0_REPORT_FILE" \
  BASE_URL="$BASE_URL" \
  MYSQL_HOST="$MYSQL_HOST" \
  MYSQL_PORT="$MYSQL_PORT" \
  MYSQL_USER="$MYSQL_USER" \
  MYSQL_PASS="$MYSQL_PASS" \
  MYSQL_DB="$MYSQL_DB" \
  MYSQL_CONTAINER="$MYSQL_CONTAINER" \
  CUSTOMER_PHONE="$CUSTOMER_PHONE" \
  PROVIDER_PHONE="$PROVIDER_PHONE" \
  LOGIN_PASSWORD="$LOGIN_PASSWORD" \
  PREPARE_DEMO_DATA="$PREPARE_DEMO_DATA" \
  DEVTOKEN_CONFIG_PATH="$DEVTOKEN_CONFIG_PATH" \
  "$SCRIPT_DIR/mini_program_p0_acceptance.sh"

  P0_DEMAND_ID="$(jq -r '.artifacts.demand_id // empty' "$P0_REPORT_FILE")"
  P0_QUOTE_ID="$(jq -r '.artifacts.quote_id // empty' "$P0_REPORT_FILE")"
  P0_ORDER_ID="$(jq -r '.artifacts.order_id // empty' "$P0_REPORT_FILE")"
  P0_DISPATCH_ID="$(jq -r '.artifacts.dispatch_id // empty' "$P0_REPORT_FILE")"
  P0_SETTLEMENT_ID="$(jq -r '.artifacts.settlement_id // empty' "$P0_REPORT_FILE")"
  P0_SETTLEMENT_STATUS="$(jq -r '.artifacts.settlement_status // empty' "$P0_REPORT_FILE")"
  append_result "FIXTURE" "completed_flow" "passed" "order_id=$P0_ORDER_ID settlement_id=$P0_SETTLEMENT_ID"
}

create_open_customer_demand() {
  local customer_token="$1"
  local start_iso end_iso expiry_iso payload response

  start_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=1, hours=2)).isoformat())
PY
)"
  end_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=1, hours=5)).isoformat())
PY
)"
  expiry_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=2, hours=1)).isoformat())
PY
)"

  payload="$(jq -nc \
    --arg title "小程序P1验收-客户发布待报价-$(date +%H%M%S)" \
    --arg start "$start_iso" \
    --arg end "$end_iso" \
    --arg expiry "$expiry_iso" \
    '{
      title:$title,
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:"power_grid",
      description:"mini program p1 clean customer demand for provider quote acceptance",
      departure_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      destination_address:{text:"广东省佛山市南海区履约验收点", city:"佛山", district:"南海区", latitude:23.0374, longitude:113.1428},
      service_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:56,
      cargo_volume_m3:1.8,
      cargo_type:"电力塔材",
      cargo_special_requirements:"小程序P1验收：客户发布后等待服务商报价",
      estimated_trip_count:1,
      budget_min:120000,
      budget_max:200000,
      allows_pilot_candidate:false,
      expires_at:$expiry
    }')"

  response="$(json_post "$customer_token" "/demands" "$payload")"
  assert_success "$response" "p1_create_open_demand"
  OPEN_DEMAND_ID="$(jq -r '.data.id' <<<"$response")"

  response="$(json_post "$customer_token" "/demands/$OPEN_DEMAND_ID/publish" '{}')"
  assert_success "$response" "p1_publish_open_demand"
  append_result "FIXTURE" "open_customer_demand" "passed" "demand_id=$OPEN_DEMAND_ID"
}

load_accounts() {
  local customer_token="$1"
  local provider_token="$2"
  local customer_me provider_me

  customer_me="$(json_get "$customer_token" "/me")"
  assert_success "$customer_me" "customer_me"
  provider_me="$(json_get "$provider_token" "/me")"
  assert_success "$provider_me" "provider_me"
  CUSTOMER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$customer_me")"
  PROVIDER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$provider_me")"
  append_result "AUTH" "load_accounts" "passed" "customer=$CUSTOMER_USER_ID provider=$PROVIDER_USER_ID"
}

assert_no_stale_values() {
  local label="$1"
  local response="$2"
  local stale
  stale="$(jq -r '.. | strings' <<<"$response" | rg -n "$STALE_VALUE_PATTERN" || true)"
  if [[ -n "$stale" ]]; then
    append_result "VERIFY" "$label" "failed" "$(head -n3 <<<"$stale" | tr '\n' ';')"
    echo "$stale" >&2
    exit 1
  fi
  append_result "VERIFY" "$label" "passed" "no stale design/demo values"
}

verify_clean_visibility() {
  local provider_token="$1"
  local response

  response="$(json_get "$provider_token" "/owner/demands/recommended?page=1&page_size=20&sort=price")"
  assert_success "$response" "provider_recommended_demands"
  if ! jq -e --argjson demand_id "$OPEN_DEMAND_ID" '.data.items[]? | select(.id == $demand_id)' >/dev/null <<<"$response"; then
    append_result "VERIFY" "open_demand_visible_to_provider" "failed" "demand_id=$OPEN_DEMAND_ID not in provider recommended list"
    exit 1
  fi
  append_result "VERIFY" "open_demand_visible_to_provider" "passed" "demand_id=$OPEN_DEMAND_ID"
  assert_no_stale_values "provider_recommended_values" "$response"

  response="$(json_get "$provider_token" "/owner/workbench")"
  assert_success "$response" "provider_workbench"
  assert_no_stale_values "provider_workbench_values" "$response"
}

soft_hide_account_history_except_current() {
  local keep_open_demand_id="${OPEN_DEMAND_ID:-0}"
  local keep_p0_demand_id="${P0_DEMAND_ID:-0}"
  local keep_p0_order_id="${P0_ORDER_ID:-0}"
  local keep_p0_quote_id="${P0_QUOTE_ID:-0}"
  local cleanup_output cleanup_line account_demands account_orders account_settlements account_dispatches

  cleanup_output="$(mysql_exec --batch --raw --skip-column-names <<SQL
CREATE TEMPORARY TABLE p1_account_demands (id BIGINT PRIMARY KEY);
CREATE TEMPORARY TABLE p1_account_orders (id BIGINT PRIMARY KEY);

SET @customer_user_id = ${CUSTOMER_USER_ID:-0};
SET @provider_user_id = ${PROVIDER_USER_ID:-0};
SET @keep_open_demand_id = ${keep_open_demand_id:-0};
SET @keep_p0_demand_id = ${keep_p0_demand_id:-0};
SET @keep_p0_order_id = ${keep_p0_order_id:-0};
SET @keep_p0_quote_id = ${keep_p0_quote_id:-0};

INSERT INTO users (
  phone,
  password_hash,
  nickname,
  user_type,
  id_verified,
  status,
  created_at,
  updated_at
)
VALUES (
  '19900000998',
  '',
  '小程序P1验收归档账号',
  'client',
  'unverified',
  'inactive',
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id),
  nickname = VALUES(nickname),
  status = 'inactive',
  updated_at = NOW(3);

SET @archive_user_id = LAST_INSERT_ID();

INSERT IGNORE INTO p1_account_demands (id)
SELECT id
FROM demands
WHERE client_user_id = @customer_user_id
  AND id NOT IN (@keep_open_demand_id, @keep_p0_demand_id);

INSERT IGNORE INTO p1_account_orders (id)
SELECT id
FROM orders
WHERE (
    client_user_id = @customer_user_id
    OR renter_id = @customer_user_id
    OR provider_user_id = @provider_user_id
    OR owner_id = @provider_user_id
    OR drone_owner_user_id = @provider_user_id
    OR executor_pilot_user_id = @provider_user_id
  )
  AND id <> @keep_p0_order_id;

INSERT IGNORE INTO p1_account_demands (id)
SELECT demand_id
FROM orders
WHERE id IN (SELECT id FROM p1_account_orders)
  AND demand_id > 0
  AND demand_id NOT IN (@keep_open_demand_id, @keep_p0_demand_id);

UPDATE demands d
JOIN p1_account_demands t ON t.id = d.id
SET
  d.client_user_id = @archive_user_id,
  d.status = 'cancelled',
  d.expires_at = COALESCE(d.expires_at, NOW()),
  d.updated_at = NOW();

UPDATE demand_quotes q
JOIN p1_account_demands t ON t.id = q.demand_id
SET
  q.status = CASE WHEN q.status IN ('submitted', 'selected') THEN 'cancelled' ELSE q.status END,
  q.updated_at = NOW();

UPDATE demand_quotes q
SET
  q.status = CASE WHEN q.status IN ('submitted', 'selected') THEN 'cancelled' ELSE q.status END,
  q.updated_at = NOW()
WHERE q.owner_user_id = @provider_user_id
  AND q.id <> @keep_p0_quote_id
  AND q.demand_id NOT IN (@keep_open_demand_id, @keep_p0_demand_id);

UPDATE orders o
JOIN p1_account_orders t ON t.id = o.id
SET
  o.status = 'cancelled',
  o.cancel_reason = '小程序P1验收数据重置：隐藏账号旧历史样本',
  o.cancel_by = 'system',
  o.deleted_at = COALESCE(o.deleted_at, NOW()),
  o.updated_at = NOW();

UPDATE dispatch_tasks dt
JOIN p1_account_orders t ON t.id = dt.order_id
SET
  dt.status = CASE WHEN dt.status IN ('pending_response', 'accepted') THEN 'cancelled' ELSE dt.status END,
  dt.deleted_at = COALESCE(dt.deleted_at, NOW()),
  dt.updated_at = NOW();

UPDATE order_settlements s
JOIN p1_account_orders t ON t.id = s.order_id
SET
  s.notes = CONCAT(COALESCE(NULLIF(s.notes, ''), ''), CASE WHEN COALESCE(s.notes, '') = '' THEN '' ELSE '\n' END, '小程序P1验收数据重置：账号旧历史结算已隐藏'),
  s.deleted_at = COALESCE(s.deleted_at, NOW()),
  s.updated_at = NOW();

SET @p1_account_demand_count = (SELECT COUNT(*) FROM p1_account_demands);
SET @p1_account_order_count = (SELECT COUNT(*) FROM p1_account_orders);
SET @p1_account_settlement_count = (SELECT COUNT(*) FROM order_settlements s JOIN p1_account_orders t ON t.id = s.order_id);
SET @p1_account_dispatch_count = (SELECT COUNT(*) FROM dispatch_tasks dt JOIN p1_account_orders t ON t.id = dt.order_id);

SELECT @p1_account_demand_count, @p1_account_order_count, @p1_account_settlement_count, @p1_account_dispatch_count;
SQL
)"
  cleanup_line="$(tail -n1 <<<"$cleanup_output")"
  read -r account_demands account_orders account_settlements account_dispatches <<<"$cleanup_line"
  CLEANUP_DEMANDS="$((CLEANUP_DEMANDS + account_demands))"
  CLEANUP_ORDERS="$((CLEANUP_ORDERS + account_orders))"
  CLEANUP_SETTLEMENTS="$((CLEANUP_SETTLEMENTS + account_settlements))"
  CLEANUP_DISPATCHES="$((CLEANUP_DISPATCHES + account_dispatches))"
  append_result "CLEANUP" "soft_hide_account_history" "passed" "demands=$account_demands orders=$account_orders settlements=$account_settlements dispatches=$account_dispatches"
}

reset_account_wallet_history_except_current() {
  local keep_p0_order_id="${P0_ORDER_ID:-0}"
  local keep_p0_settlement_id="${P0_SETTLEMENT_ID:-0}"
  local wallet_output wallet_line removed_txs removed_withdrawals kept_txs wallet_income

  wallet_output="$(mysql_exec --batch --raw --skip-column-names <<SQL
SET @provider_user_id = ${PROVIDER_USER_ID:-0};
SET @keep_p0_order_id = ${keep_p0_order_id:-0};
SET @keep_p0_settlement_id = ${keep_p0_settlement_id:-0};

UPDATE wallet_transactions
SET description = REPLACE(REPLACE(REPLACE(REPLACE(description, '飞手劳务费', '履约服务费'), '机主', '服务商'), '执行人员', '服务商'), '设备使用费', '设备服务费')
WHERE user_id = @provider_user_id
  AND related_order_id = @keep_p0_order_id
  AND related_settlement_id = @keep_p0_settlement_id;

SET @p1_wallet_removed_tx_count = (
  SELECT COUNT(*)
  FROM wallet_transactions
  WHERE user_id = @provider_user_id
    AND NOT (
      related_order_id = @keep_p0_order_id
      AND related_settlement_id = @keep_p0_settlement_id
    )
);

DELETE FROM wallet_transactions
WHERE user_id = @provider_user_id
  AND NOT (
    related_order_id = @keep_p0_order_id
    AND related_settlement_id = @keep_p0_settlement_id
  );

SET @running_balance = 0;
UPDATE wallet_transactions wt
JOIN (
  SELECT
    ordered.id,
    @running_balance AS balance_before,
    @running_balance := @running_balance + ordered.amount AS balance_after
  FROM (
    SELECT id, amount
    FROM wallet_transactions
    WHERE user_id = @provider_user_id
    ORDER BY created_at ASC, id ASC
  ) ordered
) balances ON balances.id = wt.id
SET
  wt.balance_before = balances.balance_before,
  wt.balance_after = balances.balance_after;

SET @p1_wallet_removed_withdrawal_count = (
  SELECT COUNT(*)
  FROM withdrawal_records
  WHERE user_id = @provider_user_id
);

DELETE FROM withdrawal_records
WHERE user_id = @provider_user_id;

SET @p1_wallet_kept_tx_count = (
  SELECT COUNT(*)
  FROM wallet_transactions
  WHERE user_id = @provider_user_id
);

SET @p1_wallet_income = (
  SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
  FROM wallet_transactions
  WHERE user_id = @provider_user_id
);

UPDATE user_wallets
SET
  available_balance = @p1_wallet_income,
  frozen_balance = 0,
  total_income = @p1_wallet_income,
  total_withdrawn = 0,
  total_frozen = 0,
  status = 'active',
  updated_at = NOW()
WHERE user_id = @provider_user_id
  AND wallet_type = 'general';

SELECT @p1_wallet_removed_tx_count, @p1_wallet_removed_withdrawal_count, @p1_wallet_kept_tx_count, @p1_wallet_income;
SQL
)"
  wallet_line="$(tail -n1 <<<"$wallet_output")"
  read -r removed_txs removed_withdrawals kept_txs wallet_income <<<"$wallet_line"
  append_result "CLEANUP" "reset_account_wallet_history" "passed" "removed_txs=$removed_txs removed_withdrawals=$removed_withdrawals kept_txs=$kept_txs income_fen=$wallet_income"
}

reset_account_message_history_except_current() {
  local keep_open_demand_id="${OPEN_DEMAND_ID:-0}"
  local keep_p0_demand_id="${P0_DEMAND_ID:-0}"
  local keep_p0_order_id="${P0_ORDER_ID:-0}"
  local message_output message_line removed_messages kept_messages removed_states

  message_output="$(mysql_exec --batch --raw --skip-column-names <<SQL
SET @customer_user_id = ${CUSTOMER_USER_ID:-0};
SET @provider_user_id = ${PROVIDER_USER_ID:-0};
SET @keep_open_demand_id = ${keep_open_demand_id:-0};
SET @keep_p0_demand_id = ${keep_p0_demand_id:-0};
SET @keep_p0_order_id = ${keep_p0_order_id:-0};

CREATE TEMPORARY TABLE p1_keep_messages (id BIGINT PRIMARY KEY);

INSERT IGNORE INTO p1_keep_messages (id)
SELECT id
FROM messages
WHERE (sender_id IN (@customer_user_id, @provider_user_id) OR receiver_id IN (@customer_user_id, @provider_user_id))
  AND (
    COALESCE(CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(extra_data, '$.order_id')), 'null') AS UNSIGNED), 0) = @keep_p0_order_id
    OR COALESCE(CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(extra_data, '$.demand_id')), 'null') AS UNSIGNED), 0) IN (@keep_open_demand_id, @keep_p0_demand_id)
  );

UPDATE messages
SET
  content = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content, '正式派单', '履约任务'), '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '执行人', '服务商'), '派单', '履约安排'),
  extra_data = CASE
    WHEN JSON_EXTRACT(extra_data, '$.title') IS NULL THEN extra_data
    ELSE JSON_SET(
      extra_data,
      '$.title',
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(extra_data, '$.title')), '正式派单', '履约任务'), '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '执行人', '服务商'), '派单', '履约安排')
    )
  END
WHERE id IN (SELECT id FROM p1_keep_messages);

SET @p1_removed_message_count = (
  SELECT COUNT(*)
  FROM messages
  WHERE (sender_id IN (@customer_user_id, @provider_user_id) OR receiver_id IN (@customer_user_id, @provider_user_id))
    AND id NOT IN (SELECT id FROM p1_keep_messages)
);

DELETE FROM messages
WHERE (sender_id IN (@customer_user_id, @provider_user_id) OR receiver_id IN (@customer_user_id, @provider_user_id))
  AND id NOT IN (SELECT id FROM p1_keep_messages);

SET @p1_removed_state_count = (
  SELECT COUNT(*)
  FROM conversation_user_states s
  WHERE s.user_id IN (@customer_user_id, @provider_user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM messages m
      WHERE m.conversation_id = s.conversation_id
    )
);

DELETE s
FROM conversation_user_states s
WHERE s.user_id IN (@customer_user_id, @provider_user_id)
  AND NOT EXISTS (
    SELECT 1
    FROM messages m
    WHERE m.conversation_id = s.conversation_id
  );

SET @p1_kept_message_count = (SELECT COUNT(*) FROM p1_keep_messages);

SELECT @p1_removed_message_count, @p1_kept_message_count, @p1_removed_state_count;
SQL
)"
  message_line="$(tail -n1 <<<"$message_output")"
  read -r removed_messages kept_messages removed_states <<<"$message_line"
  append_result "CLEANUP" "reset_account_message_history" "passed" "removed_messages=$removed_messages kept_messages=$kept_messages removed_states=$removed_states"
}

normalize_current_visible_text() {
  local keep_p0_order_id="${P0_ORDER_ID:-0}"
  local normalize_output normalize_line normalized_timelines normalized_dispatches

  normalize_output="$(mysql_exec --batch --raw --skip-column-names <<SQL
SET @keep_p0_order_id = ${keep_p0_order_id:-0};

UPDATE order_timelines
SET note = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(note, '正式派单', '履约任务'), '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '执行人', '服务商'), '派单', '履约安排')
WHERE order_id = @keep_p0_order_id;

UPDATE dispatch_tasks
SET reason = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(reason, '正式派单', '履约任务'), '飞手', '服务商'), '机主', '服务商'), '执行人员', '服务商'), '执行人', '服务商'), '派单', '履约安排')
WHERE order_id = @keep_p0_order_id;

SET @p1_normalized_timeline_count = (SELECT COUNT(*) FROM order_timelines WHERE order_id = @keep_p0_order_id);
SET @p1_normalized_dispatch_count = (SELECT COUNT(*) FROM dispatch_tasks WHERE order_id = @keep_p0_order_id);

SELECT @p1_normalized_timeline_count, @p1_normalized_dispatch_count;
SQL
)"
  normalize_line="$(tail -n1 <<<"$normalize_output")"
  read -r normalized_timelines normalized_dispatches <<<"$normalize_line"
  append_result "CLEANUP" "normalize_current_visible_text" "passed" "timelines=$normalized_timelines dispatches=$normalized_dispatches"
}

main() {
  require_bin curl
  require_bin jq
  require_bin python3
  require_bin go
  require_bin rg
  trap 'code=$?; trap - EXIT; write_report "$code"; exit "$code"' EXIT

  local response customer_token provider_token

  assert_dev_target

  response="$(curl -sS --max-time 10 "$API_V2/status")"
  assert_success "$response" "v2_status"
  append_result "BASE" "api_v2_status" "passed" "$(jq -r '.data.status // .message // "ok"' <<<"$response")"

  soft_hide_old_acceptance_data
  run_completed_flow_fixture

  customer_token="$(login_token "$CUSTOMER_PHONE")"
  provider_token="$(login_token "$PROVIDER_PHONE")"
  append_result "AUTH" "customer_login" "passed" "$CUSTOMER_PHONE"
  append_result "AUTH" "provider_login" "passed" "$PROVIDER_PHONE"

  load_accounts "$customer_token" "$provider_token"
  create_open_customer_demand "$customer_token"
  soft_hide_account_history_except_current
  reset_account_wallet_history_except_current
  reset_account_message_history_except_current
  normalize_current_visible_text
  verify_clean_visibility "$provider_token"

  append_result "FINAL" "mini_program_p1_reset_acceptance_data" "passed" "open_demand_id=$OPEN_DEMAND_ID order_id=$P0_ORDER_ID settlement_id=$P0_SETTLEMENT_ID"
}

main "$@"
