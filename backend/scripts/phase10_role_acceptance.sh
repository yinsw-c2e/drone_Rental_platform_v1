#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="${REPORT_FILE:-$BACKEND_DIR/docs/phase10_role_acceptance_last_run.json}"

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
API_V1="$BASE_URL/api/v1"
API_V2="$BASE_URL/api/v2"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root}"
MYSQL_DB="${MYSQL_DB:-wurenji}"

PREPARE_DEMO_DATA="${PREPARE_DEMO_DATA:-0}"
DEVTOKEN_CONFIG_PATH="${DEVTOKEN_CONFIG_PATH:-config.yaml}"

CUSTOMER_PHONE="${CUSTOMER_PHONE:-13800000004}"
OWNER_PHONE="${OWNER_PHONE:-13800000007}"
PILOT_PHONE="${PILOT_PHONE:-13900000016}"
COMPOSITE_PHONE="${COMPOSITE_PHONE:-13800000002}"

RESULTS_JSON='[]'

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required binary: $1" >&2
    exit 1
  }
}

require_bin curl
require_bin jq
require_bin python3
require_bin go

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
  printf '[%s] %s -> %s\n' "$phase" "$step" "$status"
}

assert_ok() {
  local response="$1"
  local label="$2"
  local code
  code="$(jq -r '.code // empty' <<<"$response")"
  if [[ "$code" != "OK" ]]; then
    echo "assert_ok failed for $label" >&2
    echo "$response" >&2
    append_result "ERROR" "$label" "failed" "$(jq -c '.' <<<"$response")"
    exit 1
  fi
}

json_post() {
  local token="$1"
  local path="$2"
  local payload="$3"
  if [[ -n "$token" ]]; then
    curl -sS --max-time 20 -X POST "$API_V2$path" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$payload"
  else
    curl -sS --max-time 20 -X POST "$API_V2$path" \
      -H "Content-Type: application/json" \
      -d "$payload"
  fi
}

json_patch() {
  local token="$1"
  local path="$2"
  local payload="$3"
  curl -sS --max-time 20 -X PATCH "$API_V2$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

json_put() {
  local token="$1"
  local path="$2"
  local payload="$3"
  curl -sS --max-time 20 -X PUT "$API_V2$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

json_delete() {
  local token="$1"
  local path="$2"
  curl -sS --max-time 20 -X DELETE "$API_V2$path" \
    -H "Authorization: Bearer $token"
}

json_get() {
  local token="$1"
  local path="$2"
  curl -sS --max-time 20 "$API_V2$path" \
    -H "Authorization: Bearer $token"
}

send_code() {
  local phone="$1"
  curl -sS --max-time 10 -X POST "$API_V1/auth/send-code" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\"}" >/dev/null
}

read_code() {
  local phone="$1"
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET "sms:code:$phone" | tr -d '\r'
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
  local response code access_token

  if command -v redis-cli >/dev/null 2>&1; then
    send_code "$phone"
    code="$(read_code "$phone")"
    if [[ -n "$code" && "$code" != "(nil)" ]]; then
      response="$(curl -sS --max-time 15 -X POST "$API_V2/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"phone\":\"$phone\",\"code\":\"$code\"}")"
      if [[ "$(jq -r '.code // empty' <<<"$response")" == "OK" ]]; then
        jq -r '.data.token.access_token' <<<"$response"
        return
      fi
    fi
  fi

  if [[ -n "${LOGIN_PASSWORD:-}" ]]; then
    response="$(curl -sS --max-time 15 -X POST "$API_V2/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"phone\":\"$phone\",\"password\":\"$LOGIN_PASSWORD\"}")"
    if [[ "$(jq -r '.code // empty' <<<"$response")" == "OK" ]]; then
      jq -r '.data.token.access_token' <<<"$response"
      return
    fi
  fi

  access_token="$(mint_dev_token "$phone")"
  if [[ -n "$access_token" ]]; then
    echo "$access_token"
    return
  fi

  echo "failed to login for $phone via sms/password/devtoken" >&2
  exit 1
}

prepare_demo_data() {
  if [[ "$PREPARE_DEMO_DATA" != "1" ]]; then
    append_result "PREPARE" "demo_data" "skipped" "PREPARE_DEMO_DATA != 1"
    return
  fi

  require_bin mysql

  mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASS" -D "$MYSQL_DB" <<'SQL'
UPDATE dispatch_tasks dt
JOIN orders o ON o.id = dt.order_id
SET dt.status = 'cancelled',
    dt.reason = 'phase10 prepare reset',
    dt.updated_at = NOW()
WHERE o.drone_id IN (5, 13)
  AND dt.status NOT IN ('finished', 'cancelled', 'rejected', 'expired', 'exception');

UPDATE orders
SET status = 'cancelled',
    cancel_reason = 'phase10 prepare reset',
    cancel_by = 'system',
    updated_at = NOW()
WHERE drone_id IN (5, 13)
  AND status IN (
    'created',
    'accepted',
    'confirmed',
    'pending_provider_confirmation',
    'pending_payment',
    'paid',
    'pending_dispatch',
    'assigned',
    'preparing',
    'in_progress',
    'delivered'
  );

UPDATE drones
SET mtow_kg = 150,
    max_payload_kg = 50,
    certification_status = 'approved',
    uom_verified = 'verified',
    insurance_verified = 'verified',
    airworthiness_verified = 'verified',
    availability_status = 'available'
WHERE id = 5;

UPDATE drones
SET mtow_kg = 150,
    max_payload_kg = 50,
    certification_status = 'approved',
    uom_verified = 'verified',
    insurance_verified = 'verified',
    airworthiness_verified = 'verified',
    availability_status = 'available'
WHERE id = 13;

UPDATE drones
SET mtow_kg = 150
WHERE id = 18;
SQL

  append_result "PREPARE" "demo_data" "passed" "reset active demo orders/dispatches and patched drones 5, 13 and 18 for heavy-lift acceptance"
}

force_drone_available() {
  local drone_id="$1"
  if [[ -z "$drone_id" || "$drone_id" == "0" ]]; then
    return
  fi
  if ! command -v mysql >/dev/null 2>&1; then
    append_result "PREPARE" "force_drone_available" "skipped" "mysql not found, skipped drone availability patch for drone_id=$drone_id"
    return
  fi
  mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASS" -D "$MYSQL_DB" \
    -e "UPDATE drones SET availability_status='available' WHERE id = ${drone_id};" >/dev/null
}

pick_owner_drone_ids() {
  local token="$1"
  local response
  response="$(json_get "$token" "/owner/drones?page=1&page_size=50")"
  assert_ok "$response" "owner_drones"
  jq -r '.data.items[] | select((.mtow_kg // 0) >= 150 and (.max_payload_kg // 0) >= 50) | .id' <<<"$response"
}

ensure_owner_supply() {
  local token="$1"
  local drone_id="$2"
  local list
  list="$(json_get "$token" "/owner/supplies?page=1&page_size=50")"
  assert_ok "$list" "owner_supply_list"

  local existing_id
  existing_id="$(jq -r --argjson drone_id "$drone_id" '.data.items[] | select(.drone_id == $drone_id and .status == "active" and .accepts_direct_order == true) | .id' <<<"$list" | head -n1)"
  if [[ -n "$existing_id" ]]; then
    echo "$existing_id"
    return
  fi

  local payload response
  payload="$(jq -nc \
    --argjson drone_id "$drone_id" \
    --arg title "阶段10自动验收重载供给" \
    --arg description "阶段10 AUTO RUN 直达供给验收样本" \
    --argjson cargo_scenes '["grid_power_material_transport"]' \
    --argjson service_area '{"text":"广东省佛山市南海区","city":"佛山","district":"南海区"}' \
    --argjson pricing_rule '{"mode":"fixed_trip"}' \
    --argjson available_time_slots '[{"weekday":"all","start":"08:00","end":"18:00"}]' \
    '{
      drone_id:$drone_id,
      title:$title,
      description:$description,
      cargo_scenes:$cargo_scenes,
      service_area_snapshot:$service_area,
      base_price_amount:168000,
      pricing_unit:"per_trip",
      pricing_rule:$pricing_rule,
      available_time_slots:$available_time_slots,
      accepts_direct_order:true,
      status:"active"
    }')"
  response="$(json_post "$token" "/owner/supplies" "$payload")"
  assert_ok "$response" "create_owner_supply"
  jq -r '.data.id' <<<"$response"
}

create_customer_demand() {
  local token="$1"
  local now_iso start_iso end_iso expiry_iso
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

  local title="阶段10佛山电网塔材吊运验收 $(date +%H%M%S)"
  local payload response demand_id
  payload="$(jq -nc \
    --arg title "$title" \
    --arg cargo_scene "grid_power_material_transport" \
    --arg start "$start_iso" \
    --arg end "$end_iso" \
    --arg expiry "$expiry_iso" \
    '{
      title:$title,
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:$cargo_scene,
      description:"阶段10 AUTO RUN 客户需求验收样本",
      departure_address:{text:"广东省佛山市南海区电力仓储基地", city:"佛山", district:"南海区"},
      destination_address:{text:"广东省佛山市高明区电网建设工地", city:"佛山", district:"高明区"},
      service_address:{text:"广东省佛山市南海区电力仓储基地", city:"佛山", district:"南海区"},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:52,
      cargo_volume_m3:1.8,
      cargo_type:"电力塔材",
      cargo_special_requirements:"山地工况，需重载吊运",
      estimated_trip_count:1,
      budget_min:120000,
      budget_max:200000,
      allows_pilot_candidate:true,
      expires_at:$expiry
    }')"
  response="$(json_post "$token" "/demands" "$payload")"
  assert_ok "$response" "create_demand"
  demand_id="$(jq -r '.data.id' <<<"$response")"

  response="$(json_post "$token" "/demands/$demand_id/publish" '{}')"
  assert_ok "$response" "publish_demand"
  echo "$demand_id"
}

create_owner_quote() {
  local token="$1"
  local demand_id="$2"
  local drone_id="$3"
  local response payload
  payload="$(jq -nc --argjson drone_id "$drone_id" '{
      drone_id:$drone_id,
      price_amount:158000,
      execution_plan:"阶段10 AUTO RUN：机主报价，预计 1 架次完成电网塔材吊运。"
    }')"
  response="$(json_post "$token" "/demands/$demand_id/quotes" "$payload")"
  assert_ok "$response" "create_quote"
  jq -r '.data.id' <<<"$response"
}

customer_select_provider() {
  local token="$1"
  local demand_id="$2"
  local quote_id="$3"
  local response payload
  payload="{\"quote_id\":$quote_id}"
  response="$(json_post "$token" "/demands/$demand_id/select-provider" "$payload")"
  assert_ok "$response" "select_provider"
  jq -r '.data.order_id' <<<"$response"
}

mock_pay_order() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_post "$token" "/orders/$order_id/pay" '{"method":"mock"}')"
  assert_ok "$response" "mock_pay_order:$order_id"
  jq -r '.data.order.status // empty' <<<"$response"
}

apply_candidate() {
  local token="$1"
  local demand_id="$2"
  local response
  response="$(json_post "$token" "/demands/$demand_id/candidate" '{}')"
  assert_ok "$response" "apply_candidate"
}

create_direct_order() {
  local token="$1"
  local supply_id="$2"
  local start_iso end_iso
  start_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=1, hours=5)).isoformat())
PY
)"
  end_iso="$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=1, hours=7)).isoformat())
PY
)"
  local payload response
  payload="$(jq -nc \
    --arg start "$start_iso" \
    --arg end "$end_iso" \
    '{
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:"grid_power_material_transport",
      departure_address:{text:"广东省佛山市南海区电网仓库", city:"佛山", district:"南海区"},
      destination_address:{text:"广东省佛山市三水区施工吊运点", city:"佛山", district:"三水区"},
      service_address:{text:"广东省佛山市南海区电网仓库", city:"佛山", district:"南海区"},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:55,
      cargo_volume_m3:2.0,
      cargo_type:"输电线缆",
      cargo_special_requirements:"直达供给验收样本",
      description:"阶段10 AUTO RUN 直达下单验收样本",
      estimated_trip_count:1
    }')"
  response="$(json_post "$token" "/supplies/$supply_id/orders" "$payload")"
  assert_ok "$response" "create_direct_order"
  jq -r '.data.order_id' <<<"$response"
}

provider_confirm_order() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_post "$token" "/orders/$order_id/provider-confirm" '{}')"
  assert_ok "$response" "provider_confirm_order"
}

main() {
  prepare_demo_data

  local status_response
  status_response="$(curl -sS --max-time 10 "$API_V2/status")"
  assert_ok "$status_response" "v2_status"
  append_result "BASE" "api_v2_status" "passed" "$(jq -r '.data.status' <<<"$status_response")"

  local customer_token owner_token pilot_token composite_token
  customer_token="$(login_token "$CUSTOMER_PHONE")"
  owner_token="$(login_token "$OWNER_PHONE")"
  pilot_token="$(login_token "$PILOT_PHONE")"
  composite_token="$(login_token "$COMPOSITE_PHONE")"
  append_result "AUTH" "customer_login" "passed" "$CUSTOMER_PHONE"
  append_result "AUTH" "owner_login" "passed" "$OWNER_PHONE"
  append_result "AUTH" "pilot_login" "passed" "$PILOT_PHONE"
  append_result "AUTH" "composite_login" "passed" "$COMPOSITE_PHONE"

  local customer_me owner_me pilot_me composite_me
  customer_me="$(json_get "$customer_token" "/me")"; assert_ok "$customer_me" "customer_me"
  owner_me="$(json_get "$owner_token" "/me")"; assert_ok "$owner_me" "owner_me"
  pilot_me="$(json_get "$pilot_token" "/me")"; assert_ok "$pilot_me" "pilot_me"
  composite_me="$(json_get "$composite_token" "/me")"; assert_ok "$composite_me" "composite_me"
  append_result "ROLE" "customer_me" "passed" "$(jq -c '.data.role_summary' <<<"$customer_me")"
  append_result "ROLE" "owner_me" "passed" "$(jq -c '.data.role_summary' <<<"$owner_me")"
  append_result "ROLE" "pilot_me" "passed" "$(jq -c '.data.role_summary' <<<"$pilot_me")"
  append_result "ROLE" "composite_me" "passed" "$(jq -c '.data.role_summary' <<<"$composite_me")"

  local customer_dashboard composite_dashboard
  customer_dashboard="$(json_get "$customer_token" "/home/dashboard")"; assert_ok "$customer_dashboard" "customer_dashboard"
  composite_dashboard="$(json_get "$composite_token" "/home/dashboard")"; assert_ok "$composite_dashboard" "composite_dashboard"
  append_result "HOME" "customer_dashboard" "passed" "dashboard loaded"
  append_result "HOME" "composite_dashboard" "passed" "dashboard loaded"

  local owner_profile owner_drones owner_recommended
  owner_profile="$(json_get "$owner_token" "/owner/profile")"; assert_ok "$owner_profile" "owner_profile"
  owner_drones="$(json_get "$owner_token" "/owner/drones?page=1&page_size=50")"; assert_ok "$owner_drones" "owner_drones"
  owner_recommended="$(json_get "$owner_token" "/owner/demands/recommended?page=1&page_size=20")"; assert_ok "$owner_recommended" "owner_recommended"
  append_result "OWNER" "profile" "passed" "owner profile loaded"
  append_result "OWNER" "drones" "passed" "owner drones loaded"
  append_result "OWNER" "recommended_demands" "passed" "$(jq -r '.data.total // 0' <<<"$owner_recommended") demands"

  local pilot_profile pilot_candidates_before pilot_dispatches_before pilot_flights
  pilot_profile="$(json_get "$pilot_token" "/pilot/profile")"; assert_ok "$pilot_profile" "pilot_profile"
  local pilot_online_resp
  pilot_online_resp="$(json_patch "$pilot_token" "/pilot/availability" '{"availability_status":"online"}')"
  assert_ok "$pilot_online_resp" "pilot_online"
  pilot_candidates_before="$(json_get "$pilot_token" "/pilot/candidate-demands?page=1&page_size=20")"; assert_ok "$pilot_candidates_before" "pilot_candidate_demands"
  pilot_dispatches_before="$(json_get "$pilot_token" "/pilot/dispatch-tasks?page=1&page_size=20")"; assert_ok "$pilot_dispatches_before" "pilot_dispatch_tasks"
  pilot_flights="$(json_get "$pilot_token" "/pilot/flight-records?page=1&page_size=20")"; assert_ok "$pilot_flights" "pilot_flight_records"
  append_result "PILOT" "profile" "passed" "pilot profile loaded"
  append_result "PILOT" "availability_online" "passed" "pilot set online"
  append_result "PILOT" "candidate_demands" "passed" "$(jq -r '.data.total // 0' <<<"$pilot_candidates_before") items"
  append_result "PILOT" "dispatch_tasks" "passed" "$(jq -r '.data.total // 0' <<<"$pilot_dispatches_before") items"
  append_result "PILOT" "flight_records" "passed" "$(jq -r '.data.total // 0' <<<"$pilot_flights") items"

  local composite_owner_profile composite_pilot_profile
  composite_owner_profile="$(json_get "$composite_token" "/owner/profile")"; assert_ok "$composite_owner_profile" "composite_owner_profile"
  composite_pilot_profile="$(json_get "$composite_token" "/pilot/profile")"; assert_ok "$composite_pilot_profile" "composite_pilot_profile"
  append_result "COMPOSITE" "owner_profile" "passed" "owner side loaded"
  append_result "COMPOSITE" "pilot_profile" "passed" "pilot side loaded"

  local demand_drone_id direct_drone_id supply_id demand_id quote_id demand_order_id direct_order_id pay_status direct_pay_status
  local owner_drone_ids_raw
  owner_drone_ids_raw="$(pick_owner_drone_ids "$owner_token")"
  demand_drone_id="$(printf '%s\n' "$owner_drone_ids_raw" | sed -n '1p')"
  direct_drone_id="$(printf '%s\n' "$owner_drone_ids_raw" | sed -n '2p')"
  if [[ -z "$direct_drone_id" ]]; then
    direct_drone_id="$demand_drone_id"
  fi
  if [[ -z "$demand_drone_id" ]]; then
    append_result "FLOW" "owner_drone_pick" "failed" "no heavy-lift eligible drone"
    exit 1
  fi
  append_result "FLOW" "owner_drone_pick" "passed" "quote_drone_id=$demand_drone_id direct_drone_id=$direct_drone_id"

  supply_id="$(ensure_owner_supply "$owner_token" "$direct_drone_id")"
  append_result "FLOW" "owner_supply_ready" "passed" "supply id=$supply_id"

  force_drone_available "$direct_drone_id"

  local supplies_resp
  supplies_resp="$(json_get "$customer_token" "/supplies?page=1&page_size=20&accepts_direct_order=true")"
  assert_ok "$supplies_resp" "customer_supply_market"
  local visible_supply_id visible_supply_count
  visible_supply_id="$(jq -r --argjson supply_id "$supply_id" '.data.items[]? | select(.id == $supply_id) | .id' <<<"$supplies_resp" | head -n1)"
  visible_supply_count="$(jq -r '(.data.items | length) // 0' <<<"$supplies_resp")"
  if [[ -z "$visible_supply_id" ]]; then
    append_result "CUSTOMER" "supply_market" "failed" "$(jq -c '.' <<<"$supplies_resp")"
    exit 1
  fi
  append_result "CUSTOMER" "supply_market" "passed" "${visible_supply_count} items, contains supply id=${visible_supply_id}"

  demand_id="$(create_customer_demand "$customer_token")"
  append_result "FLOW" "customer_create_publish_demand" "passed" "demand id=$demand_id"

  apply_candidate "$pilot_token" "$demand_id"
  append_result "FLOW" "pilot_apply_candidate" "passed" "demand id=$demand_id"

  local pilot_candidates_after
  pilot_candidates_after="$(json_get "$pilot_token" "/pilot/candidate-demands?page=1&page_size=20")"
  assert_ok "$pilot_candidates_after" "pilot_candidate_demands_after"
  append_result "PILOT" "candidate_demands_after_apply" "passed" "$(jq -r '.data.total // 0' <<<"$pilot_candidates_after") items"

  quote_id="$(create_owner_quote "$owner_token" "$demand_id" "$demand_drone_id")"
  append_result "FLOW" "owner_quote_demand" "passed" "quote id=$quote_id"

  local demand_quotes
  demand_quotes="$(json_get "$customer_token" "/demands/$demand_id/quotes")"
  assert_ok "$demand_quotes" "demand_quotes"
  append_result "CUSTOMER" "demand_quotes" "passed" "$(jq -r '.data.items | length' <<<"$demand_quotes") quotes"

  demand_order_id="$(customer_select_provider "$customer_token" "$demand_id" "$quote_id")"
  append_result "FLOW" "customer_select_provider" "passed" "order id=$demand_order_id"

  pay_status="$(mock_pay_order "$customer_token" "$demand_order_id")"
  append_result "FLOW" "customer_mock_pay_demand_order" "passed" "status=$pay_status"

  local demand_order_detail
  demand_order_detail="$(json_get "$customer_token" "/orders/$demand_order_id")"
  assert_ok "$demand_order_detail" "demand_order_detail"
  append_result "CUSTOMER" "demand_order_detail" "passed" "$(jq -r '.data.order.status // empty' <<<"$demand_order_detail")"

  direct_order_id="$(create_direct_order "$customer_token" "$supply_id")"
  append_result "FLOW" "customer_create_direct_order" "passed" "order id=$direct_order_id"

  provider_confirm_order "$owner_token" "$direct_order_id"
  append_result "FLOW" "owner_confirm_direct_order" "passed" "order id=$direct_order_id"

  direct_pay_status="$(mock_pay_order "$customer_token" "$direct_order_id")"
  append_result "FLOW" "customer_mock_pay_direct_order" "passed" "status=$direct_pay_status"

  local pilot_dispatches_after dispatch_id
  pilot_dispatches_after="$(json_get "$pilot_token" "/pilot/dispatch-tasks?page=1&page_size=20")"
  assert_ok "$pilot_dispatches_after" "pilot_dispatches_after"
  append_result "PILOT" "dispatch_tasks_after_flow" "passed" "$(jq -r '(.data.items | length) // 0' <<<"$pilot_dispatches_after") items"

  dispatch_id="$(jq -r --argjson order_id "$demand_order_id" '.data.items[] | select(.order.id == $order_id) | .id' <<<"$pilot_dispatches_after" | head -n1)"
  if [[ -n "$dispatch_id" ]]; then
    local accept_resp
    accept_resp="$(json_post "$pilot_token" "/dispatch-tasks/$dispatch_id/accept" '{}')"
    assert_ok "$accept_resp" "accept_dispatch_task"
    append_result "FLOW" "pilot_accept_dispatch" "passed" "dispatch id=$dispatch_id"
  else
    append_result "FLOW" "pilot_accept_dispatch" "skipped" "no dispatch generated for demand order"
  fi

  mkdir -p "$(dirname "$REPORT_FILE")"
  jq -n \
    --arg run_at "$(date -Iseconds)" \
    --arg base_url "$BASE_URL" \
    --arg customer_phone "$CUSTOMER_PHONE" \
    --arg owner_phone "$OWNER_PHONE" \
    --arg pilot_phone "$PILOT_PHONE" \
    --arg composite_phone "$COMPOSITE_PHONE" \
    --argjson results "$RESULTS_JSON" \
    --arg demand_id "$demand_id" \
    --arg quote_id "$quote_id" \
    --arg demand_order_id "$demand_order_id" \
    --arg direct_order_id "$direct_order_id" \
    --arg supply_id "$supply_id" \
    '{
      run_at:$run_at,
      base_url:$base_url,
      accounts:{
        customer:$customer_phone,
        owner:$owner_phone,
        pilot:$pilot_phone,
        composite:$composite_phone
      },
      artifacts:{
        demand_id:$demand_id,
        quote_id:$quote_id,
        demand_order_id:$demand_order_id,
        direct_order_id:$direct_order_id,
        supply_id:$supply_id
      },
      results:$results
    }' > "$REPORT_FILE"

  echo "phase10 acceptance report written to: $REPORT_FILE"
}

main "$@"
