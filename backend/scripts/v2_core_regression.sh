#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
API_V1="$BASE_URL/api/v1"
API_V2="$BASE_URL/api/v2"

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

BASELINE_SCRIPT="${BASELINE_SCRIPT:-$SCRIPT_DIR/phase10_role_acceptance.sh}"
BASELINE_REPORT="${BASELINE_REPORT:-$BACKEND_DIR/docs/phase10_role_acceptance_last_run.json}"
REPORT_FILE="${REPORT_FILE:-$BACKEND_DIR/docs/v2_core_regression_last_run.json}"

PREPARE_BASELINE="${PREPARE_BASELINE:-0}"
PREPARE_DEMO_DATA="${PREPARE_DEMO_DATA:-1}"
DEVTOKEN_CONFIG_PATH="${DEVTOKEN_CONFIG_PATH:-config.yaml}"

RESULTS_JSON='[]'

BASELINE_RUN_AT=""
CUSTOMER_PHONE=""
OWNER_PHONE=""
PILOT_PHONE=""

DEMAND_ORDER_ID=""
DIRECT_ORDER_ID=""
SUPPLY_ID=""
CANCEL_ORDER_ID=""
DEMAND_DISPATCH_ID=""
DIRECT_DISPATCH_ID=""
DEMAND_FLIGHT_ID=""
CUSTOMER_OWNER_CONVERSATION_ID=""
TIMELINE_EVENT_COUNT="0"

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
  printf '[%s] %s -> %s\n' "$phase" "$step" "$status" >&2
}

write_report() {
  local exit_code="${1:-0}"
  mkdir -p "$(dirname "$REPORT_FILE")"
  jq -n \
    --arg run_at "$(date -Iseconds)" \
    --arg base_url "$BASE_URL" \
    --arg baseline_report "$BASELINE_REPORT" \
    --arg baseline_run_at "$BASELINE_RUN_AT" \
    --arg exit_code "$exit_code" \
    --arg customer_phone "$CUSTOMER_PHONE" \
    --arg owner_phone "$OWNER_PHONE" \
    --arg pilot_phone "$PILOT_PHONE" \
    --arg demand_order_id "$DEMAND_ORDER_ID" \
    --arg direct_order_id "$DIRECT_ORDER_ID" \
    --arg supply_id "$SUPPLY_ID" \
    --arg cancel_order_id "$CANCEL_ORDER_ID" \
    --arg demand_dispatch_id "$DEMAND_DISPATCH_ID" \
    --arg direct_dispatch_id "$DIRECT_DISPATCH_ID" \
    --arg demand_flight_id "$DEMAND_FLIGHT_ID" \
    --arg conversation_id "$CUSTOMER_OWNER_CONVERSATION_ID" \
    --arg timeline_event_count "$TIMELINE_EVENT_COUNT" \
    --argjson results "$RESULTS_JSON" \
    '{
      run_at:$run_at,
      base_url:$base_url,
      baseline_report:$baseline_report,
      baseline_run_at:$baseline_run_at,
      exit_code:($exit_code | tonumber),
      accounts:{
        customer:$customer_phone,
        owner:$owner_phone,
        pilot:$pilot_phone
      },
      timeline_event_count:($timeline_event_count | tonumber),
      artifacts:{
        demand_order_id:$demand_order_id,
        direct_order_id:$direct_order_id,
        supply_id:$supply_id,
        cancel_order_id:$cancel_order_id,
        demand_dispatch_id:$demand_dispatch_id,
        direct_dispatch_id:$direct_dispatch_id,
        demand_flight_id:$demand_flight_id,
        conversation_id:$conversation_id
      },
      results:$results
    }' > "$REPORT_FILE"
}

assert_ok() {
  local response="$1"
  local label="$2"
  local code
  code="$(jq -r '.code // empty' <<<"$response")"
  if [[ "$code" != "OK" ]]; then
    append_result "ERROR" "$label" "failed" "$(jq -c '.' <<<"$response")"
    exit 1
  fi
}

json_get() {
  local token="$1"
  local path="$2"
  curl -sS --max-time 20 "$API_V2$path" \
    -H "Authorization: Bearer $token"
}

json_post() {
  local token="$1"
  local path="$2"
  local payload="$3"
  curl -sS --max-time 20 -X POST "$API_V2$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

verify_service_health() {
  local health_response ready_response ready_status

  health_response="$(curl -sS --max-time 10 "$BASE_URL/healthz")"
  if [[ "$(jq -r '.status // empty' <<<"$health_response")" != "ok" ]]; then
    append_result "HEALTH" "healthz" "failed" "$(jq -c '.' <<<"$health_response")"
    exit 1
  fi
  append_result "HEALTH" "healthz" "passed" "$(jq -c '.components // {}' <<<"$health_response")"

  ready_response="$(curl -sS --max-time 10 "$BASE_URL/readyz")"
  ready_status="$(jq -r '.status // empty' <<<"$ready_response")"
  if [[ "$ready_status" != "ready" ]]; then
    append_result "HEALTH" "readyz" "failed" "$(jq -c '.' <<<"$ready_response")"
    exit 1
  fi
  append_result "HEALTH" "readyz" "passed" "$(jq -c '.components // {}' <<<"$ready_response")"
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

  append_result "AUTH" "login:$phone" "failed" "unable to login with sms, password or dev token fallback"
  exit 1
}

future_iso() {
  local day_offset="$1"
  local hour_offset="$2"
  python3 - "$day_offset" "$hour_offset" <<'PY'
from datetime import datetime, timedelta, timezone
import sys

day_offset = int(sys.argv[1])
hour_offset = int(sys.argv[2])
tz = timezone(timedelta(hours=8))
print((datetime.now(tz) + timedelta(days=day_offset, hours=hour_offset)).isoformat())
PY
}

prepare_baseline() {
  if [[ "$PREPARE_BASELINE" == "1" || ! -f "$BASELINE_REPORT" ]]; then
    PREPARE_DEMO_DATA="$PREPARE_DEMO_DATA" REPORT_FILE="$BASELINE_REPORT" "$BASELINE_SCRIPT"
    append_result "PREPARE" "phase10_baseline" "passed" "baseline suite refreshed"
    return
  fi
  append_result "PREPARE" "phase10_baseline" "skipped" "using existing baseline report"
}

load_baseline_context() {
  if [[ ! -f "$BASELINE_REPORT" ]]; then
    append_result "BASELINE" "report_file" "failed" "baseline report not found"
    exit 1
  fi

  BASELINE_RUN_AT="$(jq -r '.run_at // empty' "$BASELINE_REPORT")"
  CUSTOMER_PHONE="$(jq -r '.accounts.customer // empty' "$BASELINE_REPORT")"
  OWNER_PHONE="$(jq -r '.accounts.owner // empty' "$BASELINE_REPORT")"
  PILOT_PHONE="$(jq -r '.accounts.pilot // empty' "$BASELINE_REPORT")"
  DEMAND_ORDER_ID="$(jq -r '.artifacts.demand_order_id // empty' "$BASELINE_REPORT")"
  DIRECT_ORDER_ID="$(jq -r '.artifacts.direct_order_id // empty' "$BASELINE_REPORT")"
  SUPPLY_ID="$(jq -r '.artifacts.supply_id // empty' "$BASELINE_REPORT")"

  if [[ -z "$CUSTOMER_PHONE" || -z "$OWNER_PHONE" || -z "$PILOT_PHONE" || -z "$DEMAND_ORDER_ID" || -z "$DIRECT_ORDER_ID" || -z "$SUPPLY_ID" ]]; then
    append_result "BASELINE" "context_load" "failed" "missing accounts or artifacts in baseline report"
    exit 1
  fi

  append_result "BASELINE" "context_load" "passed" "run_at=$BASELINE_RUN_AT demand_order=$DEMAND_ORDER_ID direct_order=$DIRECT_ORDER_ID supply=$SUPPLY_ID"
}

create_direct_order() {
  local token="$1"
  local supply_id="$2"
  local description="$3"
  local start_iso end_iso
  start_iso="$(future_iso 2 4)"
  end_iso="$(future_iso 2 6)"

  local payload response
  payload="$(jq -nc \
    --arg start "$start_iso" \
    --arg end "$end_iso" \
    --arg description "$description" \
    '{
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:"power_grid",
      departure_address:{text:"广东省佛山市禅城区电网仓库", city:"佛山", district:"禅城区"},
      destination_address:{text:"广东省佛山市南海区施工吊运点", city:"佛山", district:"南海区"},
      service_address:{text:"广东省佛山市禅城区电网仓库", city:"佛山", district:"禅城区"},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:55,
      cargo_volume_m3:2.0,
      cargo_type:"输电线缆",
      cargo_special_requirements:"v2 core regression smoke",
      description:$description,
      estimated_trip_count:1
    }')"
  response="$(json_post "$token" "/supplies/$supply_id/orders" "$payload")"
  echo "$response"
}

get_order_detail() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_get "$token" "/orders/$order_id")"
  assert_ok "$response" "order_detail:$order_id"
  echo "$response"
}

assert_order_status() {
  local token="$1"
  local order_id="$2"
  local expected="$3"
  local label="$4"
  local response status
  response="$(get_order_detail "$token" "$order_id")"
  status="$(jq -r '.data.status // empty' <<<"$response")"
  if [[ "$status" != "$expected" ]]; then
    append_result "ORDER" "$label" "failed" "expected=$expected actual=$status order_id=$order_id"
    exit 1
  fi
  append_result "ORDER" "$label" "passed" "status=$status order_id=$order_id"
}

assert_mock_payment_record() {
  local token="$1"
  local order_id="$2"
  local label="$3"
  local response matched_count
  response="$(json_get "$token" "/orders/$order_id/payments")"
  assert_ok "$response" "order_payments:$order_id"
  matched_count="$(jq -r '[.data.items[]? | select(.payment_method == "mock" and .status == "paid")] | length' <<<"$response")"
  if [[ "$matched_count" == "0" ]]; then
    append_result "PAYMENT" "$label" "failed" "missing mock paid record for order_id=$order_id"
    exit 1
  fi
  append_result "PAYMENT" "$label" "passed" "mock_paid_records=$matched_count order_id=$order_id"
}

execution_stage_rank() {
  case "$(normalize_status "$1")" in
    assigned|confirmed|airspace_applying|airspace_approved)
      echo 1
      ;;
    preparing)
      echo 2
      ;;
    in_transit)
      echo 3
      ;;
    delivered|completed|refunded)
      echo 4
      ;;
    *)
      echo 0
      ;;
  esac
}

normalize_status() {
  case "$1" in
    loading)
      echo "preparing"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

find_owner_dispatch_id() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_get "$token" "/dispatch-tasks?role=owner&page=1&page_size=200")"
  assert_ok "$response" "owner_dispatch_list"
  jq -r --argjson order_id "$order_id" '.data.items[]? | select(((.order_id // .order.id) == $order_id) and (.status != "rejected") and (.status != "expired")) | .id' <<<"$response" | head -n1
}

find_pilot_dispatch_id() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_get "$token" "/pilot/dispatch-tasks?page=1&page_size=200")"
  assert_ok "$response" "pilot_dispatch_list"
  jq -r --argjson order_id "$order_id" '.data.items[]? | select(((.order_id // .order.id) == $order_id) and (.status != "rejected") and (.status != "expired")) | .id' <<<"$response" | head -n1
}

get_dispatch_status_for_pilot() {
  local token="$1"
  local dispatch_id="$2"
  local response
  response="$(json_get "$token" "/dispatch-tasks/$dispatch_id")"
  assert_ok "$response" "dispatch_detail:$dispatch_id"
  jq -r '.data.dispatch_task.status // empty' <<<"$response"
}

ensure_order_assigned() {
  local owner_token="$1"
  local pilot_token="$2"
  local order_id="$3"
  local target_pilot_user_id="$4"
  local label="$5"

  local response status executor_user_id dispatch_id dispatch_status dispatch_resp
  response="$(get_order_detail "$owner_token" "$order_id")"
  status="$(jq -r '.data.status // empty' <<<"$response")"

  if [[ "$status" == "pending_dispatch" ]]; then
    dispatch_resp="$(json_post "$owner_token" "/orders/$order_id/dispatch" "$(jq -nc --argjson pilot "$target_pilot_user_id" '{dispatch_mode:"bound_pilot", target_pilot_user_id:$pilot, reason:"v2 core regression smoke"}')")"
    assert_ok "$dispatch_resp" "manual_dispatch:$order_id"
    dispatch_id="$(jq -r '.data.dispatch_task.id // empty' <<<"$dispatch_resp")"
    append_result "DISPATCH" "${label}_manual_dispatch" "passed" "dispatch_id=$dispatch_id order_id=$order_id"
  fi

  if [[ -z "${dispatch_id:-}" ]]; then
    dispatch_id="$(find_owner_dispatch_id "$owner_token" "$order_id")"
  fi
  if [[ -z "$dispatch_id" ]]; then
    dispatch_id="$(find_pilot_dispatch_id "$pilot_token" "$order_id")"
  fi
  if [[ -z "$dispatch_id" ]]; then
    append_result "DISPATCH" "${label}_lookup" "failed" "no dispatch found for order_id=$order_id"
    exit 1
  fi

  dispatch_status="$(get_dispatch_status_for_pilot "$pilot_token" "$dispatch_id")"
  if [[ "$dispatch_status" == "pending_response" ]]; then
    dispatch_resp="$(json_post "$pilot_token" "/dispatch-tasks/$dispatch_id/accept" '{}')"
    assert_ok "$dispatch_resp" "accept_dispatch:$dispatch_id"
    append_result "DISPATCH" "${label}_accept" "passed" "dispatch_id=$dispatch_id"
  else
    append_result "DISPATCH" "${label}_accept" "skipped" "dispatch_id=$dispatch_id status=$dispatch_status"
  fi

  response="$(get_order_detail "$owner_token" "$order_id")"
  status="$(jq -r '.data.status // empty' <<<"$response")"
  executor_user_id="$(jq -r '.data.executor.user_id // .data.executor_pilot_user_id // empty' <<<"$response")"
  if [[ "$status" != "assigned" && "$status" != "preparing" && "$status" != "in_transit" && "$status" != "delivered" && "$status" != "completed" ]]; then
    append_result "DISPATCH" "${label}_assigned" "failed" "unexpected order status=$status order_id=$order_id"
    exit 1
  fi
  if [[ -z "$executor_user_id" ]]; then
    append_result "DISPATCH" "${label}_assigned" "failed" "missing executor user id for order_id=$order_id"
    exit 1
  fi
  if [[ "$executor_user_id" != "$target_pilot_user_id" ]]; then
    append_result "DISPATCH" "${label}_assigned" "failed" "executor_user_id=$executor_user_id expected=$target_pilot_user_id"
    exit 1
  fi

  append_result "DISPATCH" "${label}_assigned" "passed" "order_id=$order_id status=$status dispatch_id=$dispatch_id"
  echo "$dispatch_id"
}

advance_order_stage() {
  local token="$1"
  local order_id="$2"
  local endpoint="$3"
  local expected_status="$4"
  local label="$5"
  local current_response current_status current_rank target_rank response status
  current_response="$(get_order_detail "$token" "$order_id")"
  current_status="$(jq -r '.data.status // empty' <<<"$current_response")"
  current_rank="$(execution_stage_rank "$current_status")"
  target_rank="$(execution_stage_rank "$expected_status")"

  if (( current_rank >= target_rank && target_rank > 0 )); then
    append_result "ORDER" "$label" "skipped" "status=$current_status order_id=$order_id"
    return
  fi

  response="$(json_post "$token" "/orders/$order_id/$endpoint" '{}')"
  assert_ok "$response" "order_stage:$order_id:$endpoint"
  status="$(jq -r '.data.status // empty' <<<"$response")"
  if [[ "$status" != "$expected_status" ]]; then
    append_result "ORDER" "$label" "failed" "expected=$expected_status actual=$status order_id=$order_id"
    exit 1
  fi
  append_result "ORDER" "$label" "passed" "status=$status order_id=$order_id"
}

find_flight_record_id() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_get "$token" "/pilot/flight-records?page=1&page_size=200")"
  assert_ok "$response" "pilot_flight_records"
  jq -r --argjson order_id "$order_id" '.data.items[]? | select(.order_id == $order_id) | .id' <<<"$response" | head -n1
}

verify_flight_detail() {
  local token="$1"
  local flight_id="$2"
  local order_id="$3"
  local min_positions="$4"
  local min_alerts="$5"
  local label="$6"
  local response actual_order_id position_count alert_count
  response="$(json_get "$token" "/flight-records/$flight_id")"
  assert_ok "$response" "flight_detail:$flight_id"
  actual_order_id="$(jq -r '.data.flight_record.order_id // empty' <<<"$response")"
  position_count="$(jq -r '.data.position_count // 0' <<<"$response")"
  alert_count="$(jq -r '.data.alert_count // 0' <<<"$response")"

  if [[ "$actual_order_id" != "$order_id" ]]; then
    append_result "FLIGHT" "$label" "failed" "expected_order=$order_id actual_order=$actual_order_id"
    exit 1
  fi
  if (( position_count < min_positions )); then
    append_result "FLIGHT" "$label" "failed" "expected position_count>=$min_positions actual=$position_count"
    exit 1
  fi
  if (( alert_count < min_alerts )); then
    append_result "FLIGHT" "$label" "failed" "expected alert_count>=$min_alerts actual=$alert_count"
    exit 1
  fi

  append_result "FLIGHT" "$label" "passed" "flight_id=$flight_id positions=$position_count alerts=$alert_count"
}

report_position() {
  local token="$1"
  local flight_id="$2"
  local label="$3"
  local payload response
  payload="$(jq -nc '{
    latitude:23.1315,
    longitude:113.2644,
    altitude:68,
    speed:12,
    heading:180,
    vertical_speed:1,
    battery_level:86,
    signal_strength:92,
    gps_satellites:14
  }')"
  response="$(json_post "$token" "/flight-records/$flight_id/positions" "$payload")"
  assert_ok "$response" "report_position:$flight_id"
  append_result "FLIGHT" "$label" "passed" "flight_id=$flight_id"
}

report_alert() {
  local token="$1"
  local flight_id="$2"
  local label="$3"
  local payload response
  payload="$(jq -nc '{
    alert_type:"battery",
    alert_level:"warning",
    alert_code:"LOW_BATTERY_SMOKE",
    title:"电量预警",
    description:"v2 core regression smoke alert",
    latitude:23.1315,
    longitude:113.2644,
    altitude:68,
    threshold_value:"30",
    actual_value:"26"
  }')"
  response="$(json_post "$token" "/flight-records/$flight_id/alerts" "$payload")"
  assert_ok "$response" "report_alert:$flight_id"
  append_result "FLIGHT" "$label" "passed" "flight_id=$flight_id"
}

complete_flight_record() {
  local token="$1"
  local flight_id="$2"
  local expected_order_id="$3"
  local label="$4"
  local detail_response current_record_status response order_status record_status order_id
  detail_response="$(json_get "$token" "/flight-records/$flight_id")"
  assert_ok "$detail_response" "flight_detail:$flight_id"
  current_record_status="$(jq -r '.data.flight_record.status // empty' <<<"$detail_response")"
  if [[ "$current_record_status" == "completed" ]]; then
    append_result "FLIGHT" "$label" "skipped" "flight_id=$flight_id status=$current_record_status"
    return
  fi
  response="$(json_post "$token" "/flight-records/$flight_id/complete" '{}')"
  assert_ok "$response" "complete_flight:$flight_id"
  order_status="$(jq -r '.data.order.status // empty' <<<"$response")"
  record_status="$(jq -r '.data.flight_record.status // empty' <<<"$response")"
  order_id="$(jq -r '.data.order.id // empty' <<<"$response")"
  if [[ "$order_id" != "$expected_order_id" || "$order_status" != "delivered" || "$record_status" != "completed" ]]; then
    append_result "FLIGHT" "$label" "failed" "order_id=$order_id status=$order_status record_status=$record_status"
    exit 1
  fi
  append_result "FLIGHT" "$label" "passed" "flight_id=$flight_id order_status=$order_status"
}

cancel_order() {
  local token="$1"
  local order_id="$2"
  local label="$3"
  local response status
  response="$(json_post "$token" "/orders/$order_id/cancel" '{"reason":"v2 core regression smoke cancel"}')"
  assert_ok "$response" "cancel_order:$order_id"
  status="$(jq -r '.data.status // empty' <<<"$response")"
  if [[ "$status" != "cancelled" ]]; then
    append_result "ORDER" "$label" "failed" "expected=cancelled actual=$status order_id=$order_id"
    exit 1
  fi
  append_result "ORDER" "$label" "passed" "status=$status order_id=$order_id"
}

verify_conversation_messages() {
  local token="$1"
  local owner_user_id="$2"
  local demand_order_id="$3"
  local direct_order_id="$4"
  local cancel_order_id="$5"
  local response messages_response matched_count

  response="$(json_get "$token" "/conversations?page=1&page_size=100")"
  assert_ok "$response" "conversations"
  CUSTOMER_OWNER_CONVERSATION_ID="$(jq -r --argjson peer_id "$owner_user_id" '.data.items[]? | select(.peer_id == $peer_id) | .conversation_id' <<<"$response" | head -n1)"
  if [[ -z "$CUSTOMER_OWNER_CONVERSATION_ID" ]]; then
    append_result "MESSAGE" "conversation_lookup" "failed" "customer-owner conversation not found"
    exit 1
  fi
  append_result "MESSAGE" "conversation_lookup" "passed" "conversation_id=$CUSTOMER_OWNER_CONVERSATION_ID"

  messages_response="$(json_get "$token" "/conversations/$CUSTOMER_OWNER_CONVERSATION_ID/messages?page=1&page_size=100")"
  assert_ok "$messages_response" "conversation_messages:$CUSTOMER_OWNER_CONVERSATION_ID"
  matched_count="$(jq -r \
    --arg demand "$demand_order_id" \
    --arg direct "$direct_order_id" \
    --arg cancel "$cancel_order_id" \
    '[.data.items[]? | select((.extra_data.order_id | tostring) == $demand or (.extra_data.order_id | tostring) == $direct or (.extra_data.order_id | tostring) == $cancel)] | length' \
    <<<"$messages_response")"
  if [[ "$matched_count" == "0" ]]; then
    append_result "MESSAGE" "conversation_messages" "failed" "no order-linked messages found in customer-owner conversation"
    exit 1
  fi
  append_result "MESSAGE" "conversation_messages" "passed" "matched_order_messages=$matched_count conversation_id=$CUSTOMER_OWNER_CONVERSATION_ID"
}

verify_order_timeline() {
  local token="$1"
  local order_id="$2"
  local label="$3"
  local response total order_timeline_count payment_count dispatch_count flight_count

  response="$(json_get "$token" "/orders/$order_id/timeline")"
  assert_ok "$response" "order_timeline:$order_id"

  total="$(jq -r '.data.items | length' <<<"$response")"
  order_timeline_count="$(jq -r '[.data.items[]? | select(.source_type == "order_timeline")] | length' <<<"$response")"
  payment_count="$(jq -r '[.data.items[]? | select(.source_type == "payment")] | length' <<<"$response")"
  dispatch_count="$(jq -r '[.data.items[]? | select(.source_type == "dispatch_task")] | length' <<<"$response")"
  flight_count="$(jq -r '[.data.items[]? | select(.source_type == "flight_record")] | length' <<<"$response")"

  if [[ "$total" == "0" || "$order_timeline_count" == "0" || "$payment_count" == "0" || "$dispatch_count" == "0" || "$flight_count" == "0" ]]; then
    append_result "TIMELINE" "$label" "failed" "events=$total order_timeline=$order_timeline_count payment=$payment_count dispatch=$dispatch_count flight=$flight_count"
    exit 1
  fi

  TIMELINE_EVENT_COUNT="$total"
  append_result "TIMELINE" "$label" "passed" "events=$total order_timeline=$order_timeline_count payment=$payment_count dispatch=$dispatch_count flight=$flight_count"
}

get_contract_detail() {
  local token="$1"
  local order_id="$2"
  local response
  response="$(json_get "$token" "/orders/$order_id/contract")"
  assert_ok "$response" "order_contract:$order_id"
  echo "$response"
}

verify_contract_generated() {
  local token="$1"
  local order_id="$2"
  local label="$3"
  local response contract_no contract_html contract_amount provider_amount

  response="$(get_contract_detail "$token" "$order_id")"
  contract_no="$(jq -r '.data.contract_no // empty' <<<"$response")"
  contract_html="$(jq -r '.data.contract_html // empty' <<<"$response")"
  contract_amount="$(jq -r '.data.contract_amount // 0' <<<"$response")"
  provider_amount="$(jq -r '.data.provider_amount // 0' <<<"$response")"

  if [[ -z "$contract_no" || -z "$contract_html" ]]; then
    append_result "CONTRACT" "${label}_generated" "failed" "missing contract body or number for order_id=$order_id"
    exit 1
  fi
  if (( contract_amount <= 0 || provider_amount <= 0 )); then
    append_result "CONTRACT" "${label}_generated" "failed" "invalid amount contract=$contract_amount provider=$provider_amount order_id=$order_id"
    exit 1
  fi
  if ! grep -q "设备操作责任" <<<"$contract_html"; then
    append_result "CONTRACT" "${label}_generated" "failed" "missing trust clause in contract html for order_id=$order_id"
    exit 1
  fi

  append_result "CONTRACT" "${label}_generated" "passed" "contract_no=$contract_no contract_amount=$contract_amount provider_amount=$provider_amount"
  echo "$response"
}

sign_contract_if_needed() {
  local token="$1"
  local order_id="$2"
  local role="$3"
  local label="$4"
  local response signed_at status sign_response

  response="$(get_contract_detail "$token" "$order_id")"
  case "$role" in
    client)
      signed_at="$(jq -r '.data.client_signed_at // empty' <<<"$response")"
      ;;
    provider)
      signed_at="$(jq -r '.data.provider_signed_at // empty' <<<"$response")"
      ;;
    *)
      append_result "CONTRACT" "${label}_${role}_sign" "failed" "unsupported role=$role"
      exit 1
      ;;
  esac

  if [[ -n "$signed_at" && "$signed_at" != "null" ]]; then
    status="$(jq -r '.data.status // empty' <<<"$response")"
    append_result "CONTRACT" "${label}_${role}_sign" "skipped" "already_signed status=$status order_id=$order_id"
    return
  fi

  sign_response="$(json_post "$token" "/orders/$order_id/contract/sign" '{}')"
  assert_ok "$sign_response" "contract_sign:$order_id:$role"

  case "$role" in
    client)
      signed_at="$(jq -r '.data.client_signed_at // empty' <<<"$sign_response")"
      ;;
    provider)
      signed_at="$(jq -r '.data.provider_signed_at // empty' <<<"$sign_response")"
      ;;
  esac
  status="$(jq -r '.data.status // empty' <<<"$sign_response")"

  if [[ -z "$signed_at" || "$signed_at" == "null" ]]; then
    append_result "CONTRACT" "${label}_${role}_sign" "failed" "missing signed_at after signing order_id=$order_id status=$status"
    exit 1
  fi

  append_result "CONTRACT" "${label}_${role}_sign" "passed" "status=$status signed_at=$signed_at order_id=$order_id"
}

verify_contract_flow() {
  local customer_token="$1"
  local owner_token="$2"
  local order_id="$3"
  local label="$4"
  local customer_response owner_response customer_contract_no owner_contract_no final_response final_status

  customer_response="$(verify_contract_generated "$customer_token" "$order_id" "$label")"
  owner_response="$(verify_contract_generated "$owner_token" "$order_id" "$label")"
  customer_contract_no="$(jq -r '.data.contract_no // empty' <<<"$customer_response")"
  owner_contract_no="$(jq -r '.data.contract_no // empty' <<<"$owner_response")"
  if [[ "$customer_contract_no" != "$owner_contract_no" ]]; then
    append_result "CONTRACT" "${label}_visibility" "failed" "customer_contract=$customer_contract_no owner_contract=$owner_contract_no"
    exit 1
  fi
  append_result "CONTRACT" "${label}_visibility" "passed" "contract_no=$customer_contract_no order_id=$order_id"

  sign_contract_if_needed "$customer_token" "$order_id" "client" "$label"
  sign_contract_if_needed "$owner_token" "$order_id" "provider" "$label"

  final_response="$(get_contract_detail "$customer_token" "$order_id")"
  final_status="$(jq -r '.data.status // empty' <<<"$final_response")"
  if [[ "$final_status" != "fully_signed" ]]; then
    append_result "CONTRACT" "${label}_final_status" "failed" "expected=fully_signed actual=$final_status order_id=$order_id"
    exit 1
  fi

  append_result "CONTRACT" "${label}_final_status" "passed" "status=$final_status order_id=$order_id"
}

main() {
  require_bin curl
  require_bin jq
  require_bin python3
  require_bin go

  trap 'code=$?; trap - EXIT; write_report "$code"; exit "$code"' EXIT

  verify_service_health
  prepare_baseline
  load_baseline_context

  local customer_token owner_token pilot_token
  customer_token="$(login_token "$CUSTOMER_PHONE")"
  owner_token="$(login_token "$OWNER_PHONE")"
  pilot_token="$(login_token "$PILOT_PHONE")"
  append_result "AUTH" "customer_login" "passed" "$CUSTOMER_PHONE"
  append_result "AUTH" "owner_login" "passed" "$OWNER_PHONE"
  append_result "AUTH" "pilot_login" "passed" "$PILOT_PHONE"

  local customer_me owner_me pilot_me
  customer_me="$(json_get "$customer_token" "/me")"; assert_ok "$customer_me" "customer_me"
  owner_me="$(json_get "$owner_token" "/me")"; assert_ok "$owner_me" "owner_me"
  pilot_me="$(json_get "$pilot_token" "/me")"; assert_ok "$pilot_me" "pilot_me"

  local customer_user_id owner_user_id pilot_user_id
  customer_user_id="$(jq -r '.data.user.id // empty' <<<"$customer_me")"
  owner_user_id="$(jq -r '.data.user.id // empty' <<<"$owner_me")"
  pilot_user_id="$(jq -r '.data.user.id // empty' <<<"$pilot_me")"
  append_result "AUTH" "me_context" "passed" "customer=$customer_user_id owner=$owner_user_id pilot=$pilot_user_id"

  assert_mock_payment_record "$customer_token" "$DEMAND_ORDER_ID" "demand_order_mock_payment"
  assert_mock_payment_record "$customer_token" "$DIRECT_ORDER_ID" "direct_order_mock_payment"

  local cancel_order_response
  cancel_order_response="$(create_direct_order "$customer_token" "$SUPPLY_ID" "v2 core regression cancel sample")"
  if [[ "$(jq -r '.code // empty' <<<"$cancel_order_response")" == "OK" ]]; then
    CANCEL_ORDER_ID="$(jq -r '.data.order_id // empty' <<<"$cancel_order_response")"
    append_result "ORDER" "cancel_sample_create" "passed" "order_id=$CANCEL_ORDER_ID"
    cancel_order "$customer_token" "$CANCEL_ORDER_ID" "cancel_endpoint"
    assert_order_status "$customer_token" "$CANCEL_ORDER_ID" "cancelled" "cancel_endpoint_verify"
  else
    append_result "ORDER" "cancel_sample_create" "skipped" "$(jq -c '.' <<<"$cancel_order_response")"
  fi

  DEMAND_DISPATCH_ID="$(ensure_order_assigned "$owner_token" "$pilot_token" "$DEMAND_ORDER_ID" "$pilot_user_id" "demand_order")"

  advance_order_stage "$pilot_token" "$DEMAND_ORDER_ID" "start-preparing" "preparing" "demand_start_preparing"
  advance_order_stage "$pilot_token" "$DEMAND_ORDER_ID" "start-flight" "in_transit" "demand_start_flight"
  DEMAND_FLIGHT_ID="$(find_flight_record_id "$pilot_token" "$DEMAND_ORDER_ID")"
  if [[ -z "$DEMAND_FLIGHT_ID" ]]; then
    append_result "FLIGHT" "flight_record_lookup" "failed" "no flight record found for demand_order_id=$DEMAND_ORDER_ID"
    exit 1
  fi
  append_result "FLIGHT" "flight_record_lookup" "passed" "flight_id=$DEMAND_FLIGHT_ID order_id=$DEMAND_ORDER_ID"
  verify_flight_detail "$pilot_token" "$DEMAND_FLIGHT_ID" "$DEMAND_ORDER_ID" 0 0 "flight_detail_initial"
  report_position "$pilot_token" "$DEMAND_FLIGHT_ID" "flight_position_write"
  report_alert "$pilot_token" "$DEMAND_FLIGHT_ID" "flight_alert_write"
  verify_flight_detail "$pilot_token" "$DEMAND_FLIGHT_ID" "$DEMAND_ORDER_ID" 1 1 "flight_detail_after_writes"
  advance_order_stage "$pilot_token" "$DEMAND_ORDER_ID" "confirm-delivery" "delivered" "demand_confirm_delivery"
  assert_order_status "$pilot_token" "$DEMAND_ORDER_ID" "delivered" "demand_confirm_delivery_verify"
  complete_flight_record "$pilot_token" "$DEMAND_FLIGHT_ID" "$DEMAND_ORDER_ID" "flight_complete"
  assert_order_status "$pilot_token" "$DEMAND_ORDER_ID" "delivered" "flight_complete_verify"
  verify_order_timeline "$customer_token" "$DEMAND_ORDER_ID" "order_timeline"
  verify_contract_flow "$customer_token" "$owner_token" "$DEMAND_ORDER_ID" "demand_contract"
  verify_contract_flow "$customer_token" "$owner_token" "$DIRECT_ORDER_ID" "direct_contract"

  verify_conversation_messages "$customer_token" "$owner_user_id" "$DEMAND_ORDER_ID" "$DIRECT_ORDER_ID" "$CANCEL_ORDER_ID"

  append_result "FINAL" "v2_core_regression" "passed" "mock payment, execution stages, flight records, contracts and messages verified"
}

main "$@"
