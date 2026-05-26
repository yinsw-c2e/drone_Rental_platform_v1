#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="${REPORT_FILE:-$BACKEND_DIR/docs/mini_program_dispatch_ui_fixture_last_run.json}"

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
EXECUTOR_PHONE="${EXECUTOR_PHONE:-13900000016}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-password123}"
PREPARE_DEMO_DATA="${PREPARE_DEMO_DATA:-1}"
DEVTOKEN_CONFIG_PATH="${DEVTOKEN_CONFIG_PATH:-config.yaml}"

MODE="${1:-prepare}"
RESULTS_JSON='[]'

CUSTOMER_USER_ID=""
PROVIDER_USER_ID=""
EXECUTOR_USER_ID=""
DEMAND_ID="${DEMAND_ID:-}"
QUOTE_ID="${QUOTE_ID:-}"
ORDER_ID="${ORDER_ID:-}"
DISPATCH_ID="${DISPATCH_ID:-}"

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
    --arg mode "$MODE" \
    --arg base_url "$BASE_URL" \
    --argjson exit_status "$exit_status" \
    --arg customer_phone "$CUSTOMER_PHONE" \
    --arg provider_phone "$PROVIDER_PHONE" \
    --arg executor_phone "$EXECUTOR_PHONE" \
    --arg customer_user_id "$CUSTOMER_USER_ID" \
    --arg provider_user_id "$PROVIDER_USER_ID" \
    --arg executor_user_id "$EXECUTOR_USER_ID" \
    --arg demand_id "$DEMAND_ID" \
    --arg quote_id "$QUOTE_ID" \
    --arg order_id "$ORDER_ID" \
    --arg dispatch_id "$DISPATCH_ID" \
    --argjson results "$RESULTS_JSON" \
    '{
      run_at:$run_at,
      mode:$mode,
      base_url:$base_url,
      exit_status:$exit_status,
      accounts:{
        customer:{phone:$customer_phone,user_id:$customer_user_id},
        provider:{phone:$provider_phone,user_id:$provider_user_id},
        executor:{phone:$executor_phone,user_id:$executor_user_id}
      },
      artifacts:{
        demand_id:$demand_id,
        quote_id:$quote_id,
        order_id:$order_id,
        dispatch_id:$dispatch_id
      },
      results:$results
    }' > "$REPORT_FILE"
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

json_patch() {
  local token="$1"
  local route="$2"
  local payload="$3"
  curl -sS --max-time 20 -X PATCH "$API_V2$route" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

mysql_exec() {
  if command -v mysql >/dev/null 2>&1; then
    mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASS" -D "$MYSQL_DB" "$@"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
    docker exec -i "$MYSQL_CONTAINER" mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" "$@"
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

prepare_demo_data() {
  if [[ "$PREPARE_DEMO_DATA" != "1" ]]; then
    append_result "PREPARE" "demo_data" "skipped" "PREPARE_DEMO_DATA != 1"
    return
  fi

  if ! mysql_exec <<SQL
UPDATE pilots p
JOIN users u ON u.id = p.user_id
SET p.caac_license_type = COALESCE(NULLIF(p.caac_license_type, ''), 'BVLOS'),
    p.caac_license_no = COALESCE(NULLIF(p.caac_license_no, ''), CONCAT('CAAC-UI-', p.id)),
    p.caac_license_image = COALESCE(NULLIF(p.caac_license_image, ''), '/uploads/certifications/ui-caac-license.jpg'),
    p.verification_status = 'verified',
    p.availability_status = 'online',
    p.updated_at = NOW()
WHERE u.phone = '$EXECUTOR_PHONE';

UPDATE drones d
JOIN users u ON u.id = d.owner_id
SET d.mtow_kg = GREATEST(COALESCE(d.mtow_kg, 0), 150),
    d.max_payload_kg = GREATEST(COALESCE(d.max_payload_kg, 0), 50),
    d.max_load = GREATEST(COALESCE(d.max_load, 0), 50),
    d.certification_status = 'approved',
    d.uom_verified = 'verified',
    d.insurance_verified = 'verified',
    d.airworthiness_verified = 'verified',
    d.availability_status = 'available',
    d.updated_at = NOW()
WHERE u.phone = '$PROVIDER_PHONE';

UPDATE owner_pilot_bindings b
JOIN users provider_user ON provider_user.id = b.owner_user_id
JOIN users executor_user ON executor_user.id = b.pilot_user_id
SET b.initiated_by = 'owner',
    b.status = 'active',
    b.is_priority = 1,
    b.note = 'mini program dispatch UI fixture binding',
    b.confirmed_at = COALESCE(b.confirmed_at, NOW()),
    b.dissolved_at = NULL,
    b.updated_at = NOW()
WHERE provider_user.phone = '$PROVIDER_PHONE'
  AND executor_user.phone = '$EXECUTOR_PHONE'
  AND b.deleted_at IS NULL;

INSERT INTO owner_pilot_bindings (
  owner_user_id, pilot_user_id, initiated_by, status, is_priority,
  note, confirmed_at, created_at, updated_at
)
SELECT provider_user.id, executor_user.id, 'owner', 'active', 1,
       'mini program dispatch UI fixture binding', NOW(), NOW(), NOW()
FROM users provider_user
JOIN users executor_user ON executor_user.phone = '$EXECUTOR_PHONE'
WHERE provider_user.phone = '$PROVIDER_PHONE'
  AND NOT EXISTS (
    SELECT 1
    FROM owner_pilot_bindings b
    WHERE b.owner_user_id = provider_user.id
      AND b.pilot_user_id = executor_user.id
      AND b.deleted_at IS NULL
      AND b.status IN ('pending_confirmation', 'active', 'paused')
  );
SQL
  then
    append_result "PREPARE" "demo_data" "skipped" "mysql unavailable or preparation failed"
    return
  fi

  append_result "PREPARE" "demo_data" "passed" "executor online, provider drone eligible, binding active"
}

load_report_artifacts() {
  if [[ ! -f "$REPORT_FILE" ]]; then
    echo "missing report file: $REPORT_FILE" >&2
    exit 1
  fi
  DEMAND_ID="${DEMAND_ID:-$(jq -r '.artifacts.demand_id // empty' "$REPORT_FILE")}"
  QUOTE_ID="${QUOTE_ID:-$(jq -r '.artifacts.quote_id // empty' "$REPORT_FILE")}"
  ORDER_ID="${ORDER_ID:-$(jq -r '.artifacts.order_id // empty' "$REPORT_FILE")}"
  DISPATCH_ID="${DISPATCH_ID:-$(jq -r '.artifacts.dispatch_id // empty' "$REPORT_FILE")}"
  CUSTOMER_USER_ID="${CUSTOMER_USER_ID:-$(jq -r '.accounts.customer.user_id // empty' "$REPORT_FILE")}"
  PROVIDER_USER_ID="${PROVIDER_USER_ID:-$(jq -r '.accounts.provider.user_id // empty' "$REPORT_FILE")}"
  EXECUTOR_USER_ID="${EXECUTOR_USER_ID:-$(jq -r '.accounts.executor.user_id // empty' "$REPORT_FILE")}"
}

pick_provider_drone_id() {
  local token="$1"
  local response
  response="$(json_get "$token" "/owner/drones?page=1&page_size=50")"
  assert_success "$response" "provider_drones"
  jq -r '
    .data.items[]?
    | select((.availability_status // "") == "available")
    | select((.certification_status // "") == "approved")
    | select((.uom_verified // "") == "verified")
    | select((.insurance_verified // "") == "verified")
    | select((.airworthiness_verified // "") == "verified")
    | select((.mtow_kg // .max_load // 0) >= 150 and ((.max_payload_kg // .max_load // 0) >= 50))
    | .id
  ' <<<"$response" | head -n1
}

create_customer_demand() {
  local token="$1"
  local start_iso end_iso expiry_iso payload response
  start_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=1, hours=1)).isoformat())
PY
)"
  end_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=1, hours=4)).isoformat())
PY
)"
  expiry_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=2)).isoformat())
PY
)"

  payload="$(jq -nc \
    --arg title "小程序人工验收-服务商待履约-$(date +%H%M%S)" \
    --arg start "$start_iso" \
    --arg end "$end_iso" \
    --arg expiry "$expiry_iso" \
    '{
      title:$title,
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:"power_grid",
      description:"mini program provider workflow fixture: keep order pending for manual fulfillment review",
      departure_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      destination_address:{text:"广东省佛山市南海区履约验收点", city:"佛山", district:"南海区", latitude:23.0374, longitude:113.1428},
      service_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:52,
      cargo_volume_m3:1.8,
      cargo_type:"电力塔材",
      cargo_special_requirements:"小程序人工验收：服务商需在小程序里推进履约",
      estimated_trip_count:1,
      budget_min:120000,
      budget_max:200000,
      allows_pilot_candidate:false,
      expires_at:$expiry
    }')"
  response="$(json_post "$token" "/demands" "$payload")"
  assert_success "$response" "create_demand"
  DEMAND_ID="$(jq -r '.data.id' <<<"$response")"

  response="$(json_post "$token" "/demands/$DEMAND_ID/publish" '{}')"
  assert_success "$response" "publish_demand"
  append_result "CUSTOMER" "create_publish_demand" "passed" "demand_id=$DEMAND_ID"
}

create_provider_quote() {
  local token="$1"
  local drone_id="$2"
  local payload response
  payload="$(jq -nc --argjson drone_id "$drone_id" '{
    drone_id:$drone_id,
    price_amount:158000,
    execution_plan:"小程序人工验收：服务商报价后进入待履约状态。"
  }')"
  response="$(json_post "$token" "/demands/$DEMAND_ID/quotes" "$payload")"
  assert_success "$response" "create_quote"
  QUOTE_ID="$(jq -r '.data.id' <<<"$response")"
  append_result "PROVIDER" "quote_demand" "passed" "quote_id=$QUOTE_ID drone_id=$drone_id"
}

select_provider_and_pay() {
  local customer_token="$1"
  local provider_token="$2"
  local response status

  response="$(json_get "$provider_token" "/owner/demands/recommended?page=1&page_size=50")"
  assert_success "$response" "provider_recommended_demands"
  if ! jq -e --argjson demand_id "$DEMAND_ID" '.data.items[]? | select(.id == $demand_id)' >/dev/null <<<"$response"; then
    append_result "PROVIDER" "recommended_contains_demand" "failed" "demand_id=$DEMAND_ID not in recommended list"
    exit 1
  fi
  append_result "PROVIDER" "recommended_contains_demand" "passed" "demand_id=$DEMAND_ID"

  response="$(json_post "$customer_token" "/demands/$DEMAND_ID/select-provider" "{\"quote_id\":$QUOTE_ID}")"
  assert_success "$response" "select_provider"
  ORDER_ID="$(jq -r '.data.order_id // .data.id' <<<"$response")"
  append_result "CUSTOMER" "select_provider" "passed" "order_id=$ORDER_ID"

  response="$(json_post "$customer_token" "/orders/$ORDER_ID/contract/sign" '{}')"
  assert_success "$response" "customer_sign_contract"
  response="$(json_post "$provider_token" "/orders/$ORDER_ID/contract/sign" '{}')"
  assert_success "$response" "provider_sign_contract"
  append_result "ORDER" "contract_signed" "passed" "order_id=$ORDER_ID"

  response="$(json_post "$customer_token" "/orders/$ORDER_ID/pay" '{"method":"mock"}')"
  assert_success "$response" "mock_pay_order"
  status="$(jq -r '.data.order.status // .data.status // empty' <<<"$response")"
  append_result "CUSTOMER" "mock_pay_order" "passed" "status=$status order_id=$ORDER_ID"
}

find_pending_dispatch_for_order() {
  local token="$1"
  local response
  response="$(json_get "$token" "/dispatch-tasks?role=owner&status=pending_response&page=1&page_size=100")"
  assert_success "$response" "owner_pending_dispatches"
  jq -r --argjson order_id "$ORDER_ID" '.data.items[]? | select(.order_id == $order_id) | .id' <<<"$response" | head -n1
}

ensure_pending_dispatch() {
  local provider_token="$1"
  local response

  response="$(json_post "$provider_token" "/orders/$ORDER_ID/dispatch" "$(jq -nc --argjson executor "$EXECUTOR_USER_ID" '{dispatch_mode:"bound_pilot", target_pilot_user_id:$executor, reason:"mini program dispatch UI fixture"}')")"
  if [[ "$(jq -r '.code // empty' <<<"$response")" == "OK" ]]; then
    DISPATCH_ID="$(jq -r '.data.dispatch_task.id // empty' <<<"$response")"
    append_result "PROVIDER" "dispatch_order" "passed" "dispatch_id=$DISPATCH_ID order_id=$ORDER_ID"
    return
  fi

  if jq -e '.message | test("已有生效中的正式派单")' >/dev/null <<<"$response"; then
    DISPATCH_ID="$(find_pending_dispatch_for_order "$provider_token")"
    if [[ -z "$DISPATCH_ID" ]]; then
      append_result "PROVIDER" "existing_dispatch_visible" "failed" "order_id=$ORDER_ID has active dispatch but no pending dispatch was listed"
      exit 1
    fi
    append_result "PROVIDER" "existing_dispatch_visible" "passed" "dispatch_id=$DISPATCH_ID order_id=$ORDER_ID"
    return
  fi

  assert_success "$response" "provider_dispatch_order"
}

assert_executor_pending_visible() {
  local executor_token="$1"
  local response

  response="$(json_get "$executor_token" "/dispatch-tasks?role=pilot&status=pending_response&page=1&page_size=100")"
  assert_success "$response" "executor_pending_dispatches"
  if ! jq -e --argjson dispatch_id "$DISPATCH_ID" '.data.items[]? | select(.id == $dispatch_id)' >/dev/null <<<"$response"; then
    append_result "EXECUTOR" "pending_dispatch_visible" "failed" "dispatch_id=$DISPATCH_ID not visible"
    exit 1
  fi
  append_result "EXECUTOR" "pending_dispatch_visible" "passed" "dispatch_id=$DISPATCH_ID"
}

prepare_fixture() {
  local response customer_token provider_token executor_token customer_me provider_me executor_me drone_id

  prepare_demo_data

  customer_token="$(login_token "$CUSTOMER_PHONE")"
  provider_token="$(login_token "$PROVIDER_PHONE")"
  executor_token="$(login_token "$EXECUTOR_PHONE")"
  append_result "AUTH" "customer_login" "passed" "$CUSTOMER_PHONE"
  append_result "AUTH" "provider_login" "passed" "$PROVIDER_PHONE"
  append_result "AUTH" "executor_login" "passed" "$EXECUTOR_PHONE"

  customer_me="$(json_get "$customer_token" "/me")"; assert_success "$customer_me" "customer_me"
  provider_me="$(json_get "$provider_token" "/me")"; assert_success "$provider_me" "provider_me"
  executor_me="$(json_get "$executor_token" "/me")"; assert_success "$executor_me" "executor_me"
  CUSTOMER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$customer_me")"
  PROVIDER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$provider_me")"
  EXECUTOR_USER_ID="$(jq -r '.data.user.id // empty' <<<"$executor_me")"

  response="$(json_patch "$executor_token" "/pilot/availability" '{"availability_status":"online"}')"
  assert_success "$response" "executor_online"
  append_result "EXECUTOR" "availability_online" "passed" "executor set online"

  drone_id="$(pick_provider_drone_id "$provider_token")"
  if [[ -z "$drone_id" ]]; then
    append_result "PROVIDER" "drone_pick" "failed" "no available heavy-lift eligible provider drone"
    exit 1
  fi
  append_result "PROVIDER" "drone_pick" "passed" "drone_id=$drone_id"

  create_customer_demand "$customer_token"
  create_provider_quote "$provider_token" "$drone_id"
  select_provider_and_pay "$customer_token" "$provider_token"
  ensure_pending_dispatch "$provider_token"
  assert_executor_pending_visible "$executor_token"

  append_result "FINAL" "mini_program_dispatch_ui_fixture" "passed" "order_id=$ORDER_ID dispatch_id=$DISPATCH_ID ready_for_manual_accept"
}

verify_manual_accept() {
  local provider_token executor_token response dispatch_status order_status executor_user_id

  load_report_artifacts
  if [[ -z "$DISPATCH_ID" || -z "$ORDER_ID" ]]; then
    echo "missing DISPATCH_ID/ORDER_ID; pass env vars or run prepare first" >&2
    exit 1
  fi

  provider_token="$(login_token "$PROVIDER_PHONE")"
  executor_token="$(login_token "$EXECUTOR_PHONE")"
  append_result "AUTH" "provider_login" "passed" "$PROVIDER_PHONE"
  append_result "AUTH" "executor_login" "passed" "$EXECUTOR_PHONE"

  response="$(json_get "$executor_token" "/dispatch-tasks/$DISPATCH_ID")"
  assert_success "$response" "dispatch_detail"
  dispatch_status="$(jq -r '.data.dispatch_task.status // empty' <<<"$response")"
  if [[ "$dispatch_status" != "accepted" ]]; then
    append_result "EXECUTOR" "manual_accept_status" "failed" "dispatch_id=$DISPATCH_ID status=$dispatch_status; accept it in mini-program first"
    exit 1
  fi
  append_result "EXECUTOR" "manual_accept_status" "passed" "dispatch_id=$DISPATCH_ID status=$dispatch_status"

  response="$(json_get "$provider_token" "/orders/$ORDER_ID")"
  assert_success "$response" "provider_order_after_manual_accept"
  order_status="$(jq -r '.data.status // empty' <<<"$response")"
  executor_user_id="$(jq -r '.data.executor.user_id // .data.executor_pilot_user_id // empty' <<<"$response")"
  if [[ "$order_status" != "assigned" && "$order_status" != "preparing" && "$order_status" != "in_transit" && "$order_status" != "delivered" && "$order_status" != "completed" ]]; then
    append_result "ORDER" "assigned_after_manual_accept" "failed" "status=$order_status"
    exit 1
  fi
  append_result "ORDER" "assigned_after_manual_accept" "passed" "status=$order_status executor=$executor_user_id"

  append_result "FINAL" "mini_program_dispatch_ui_verify" "passed" "order_id=$ORDER_ID dispatch_id=$DISPATCH_ID"
}

verify_completed_settlement() {
  local customer_token provider_token executor_token response status settlement_id settlement_status
  local customer_me provider_me executor_me
  local settlement_owner settlement_pilot settlement_payer

  load_report_artifacts
  if [[ -z "$ORDER_ID" ]]; then
    echo "missing ORDER_ID; pass env var or run prepare first" >&2
    exit 1
  fi

  customer_token="$(login_token "$CUSTOMER_PHONE")"
  provider_token="$(login_token "$PROVIDER_PHONE")"
  executor_token="$(login_token "$EXECUTOR_PHONE")"
  append_result "AUTH" "customer_login" "passed" "$CUSTOMER_PHONE"
  append_result "AUTH" "provider_login" "passed" "$PROVIDER_PHONE"
  append_result "AUTH" "executor_login" "passed" "$EXECUTOR_PHONE"

  customer_me="$(json_get "$customer_token" "/me")"; assert_success "$customer_me" "customer_me"
  provider_me="$(json_get "$provider_token" "/me")"; assert_success "$provider_me" "provider_me"
  executor_me="$(json_get "$executor_token" "/me")"; assert_success "$executor_me" "executor_me"
  CUSTOMER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$customer_me")"
  PROVIDER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$provider_me")"
  EXECUTOR_USER_ID="$(jq -r '.data.user.id // empty' <<<"$executor_me")"

  response="$(json_get "$customer_token" "/orders/$ORDER_ID")"
  assert_success "$response" "customer_completed_order"
  status="$(jq -r '.data.status // empty' <<<"$response")"
  if [[ "$status" != "completed" ]]; then
    append_result "ORDER" "completed_after_customer_confirm" "failed" "status=$status"
    exit 1
  fi
  append_result "ORDER" "completed_after_customer_confirm" "passed" "order_id=$ORDER_ID"

  response="$(json_get "$customer_token" "/orders/$ORDER_ID/settlement")"
  assert_success "$response" "customer_order_settlement"
  settlement_id="$(jq -r '.data.id // empty' <<<"$response")"
  settlement_status="$(jq -r '.data.status // empty' <<<"$response")"
  settlement_owner="$(jq -r '.data.owner_user_id // empty' <<<"$response")"
  settlement_pilot="$(jq -r '.data.pilot_user_id // empty' <<<"$response")"
  settlement_payer="$(jq -r '.data.payer_user_id // empty' <<<"$response")"
  if [[ -z "$settlement_id" ]]; then
    append_result "SETTLEMENT" "generated" "failed" "missing settlement id"
    exit 1
  fi
  if [[ "$settlement_owner" != "$PROVIDER_USER_ID" || "$settlement_pilot" != "$EXECUTOR_USER_ID" || "$settlement_payer" != "$CUSTOMER_USER_ID" ]]; then
    append_result "SETTLEMENT" "participants" "failed" "payer=$settlement_payer owner=$settlement_owner pilot=$settlement_pilot"
    exit 1
  fi
  append_result "SETTLEMENT" "customer_visible" "passed" "settlement_id=$settlement_id status=$settlement_status"

  response="$(json_get "$provider_token" "/orders/$ORDER_ID/settlement")"
  assert_success "$response" "provider_order_settlement"
  response="$(json_get "$executor_token" "/orders/$ORDER_ID/settlement")"
  assert_success "$response" "executor_order_settlement"
  append_result "SETTLEMENT" "three_party_visible" "passed" "settlement_id=$settlement_id status=$settlement_status"

  response="$(json_get "$customer_token" "/orders/$ORDER_ID/timeline")"
  assert_success "$response" "order_timeline"
  if ! jq -e '[
    (.data.items // .data.events // [])[]?
    | select(((.event_type // "") + " " + (.status // "") + " " + (.title // "") + " " + (.note // "")) | test("delivered|completed|settled|送达|完成|结算|签收"))
  ] | length > 0' >/dev/null <<<"$response"; then
    append_result "TIMELINE" "completion_events" "failed" "no delivered/completed/settled events"
    exit 1
  fi
  append_result "TIMELINE" "completion_events" "passed" "order_id=$ORDER_ID"

  append_result "FINAL" "mini_program_dispatch_ui_completed_verify" "passed" "order_id=$ORDER_ID settlement_id=$settlement_id status=$settlement_status"
}

main() {
  require_bin curl
  require_bin jq
  require_bin python3
  require_bin go
  trap 'code=$?; trap - EXIT; write_report "$code"; exit "$code"' EXIT

  local response
  response="$(curl -sS --max-time 10 "$API_V2/status")"
  assert_success "$response" "v2_status"
  append_result "BASE" "api_v2_status" "passed" "$(jq -r '.data.status // .message // "ok"' <<<"$response")"

  case "$MODE" in
    prepare)
      prepare_fixture
      ;;
    verify)
      verify_manual_accept
      ;;
    verify-completed)
      verify_completed_settlement
      ;;
    *)
      echo "usage: $0 [prepare|verify|verify-completed]" >&2
      exit 2
      ;;
  esac
}

main "$@"
