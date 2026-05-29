#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$BACKEND_DIR/.." && pwd)"
REPORT_FILE="${REPORT_FILE:-$SCRIPT_DIR/instant_dispatch_acceptance_last_run.json}"

RAW_BASE="${BASE_URL:-http://127.0.0.1:8080}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      RAW_BASE="${2:-}"
      shift 2
      ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  cd backend && ./docs/instant_dispatch_acceptance.sh
  cd backend && ./docs/instant_dispatch_acceptance.sh --base http://127.0.0.1:8080/api/v2

Environment:
  CUSTOMER_PHONE, PROVIDER_PHONE, PILOT_PHONE, ADMIN_PHONE
  CUSTOMER_TOKEN, PROVIDER_TOKEN, PILOT_TOKEN, ADMIN_TOKEN
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASS, MYSQL_DB, MYSQL_CONTAINER
USAGE
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

RAW_BASE="${RAW_BASE%/}"
if [[ "$RAW_BASE" == */api/v2 ]]; then
  API_BASE="$RAW_BASE"
  ROOT_BASE="${RAW_BASE%/api/v2}"
else
  ROOT_BASE="$RAW_BASE"
  API_BASE="$RAW_BASE/api/v2"
fi

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-root}"
MYSQL_DB="${MYSQL_DB:-wurenji}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-wurenji-mysql}"
DEVTOKEN_CONFIG_PATH="${DEVTOKEN_CONFIG_PATH:-config.yaml}"
WAIT_SECONDS="${WAIT_SECONDS:-75}"

CUSTOMER_PHONE="${CUSTOMER_PHONE:-13800000004}"
PROVIDER_PHONE="${PROVIDER_PHONE:-13800000007}"
PILOT_PHONE="${PILOT_PHONE:-13900000016}"
ADMIN_PHONE="${ADMIN_PHONE:-13800000001}"

STEPS_FILE="$(mktemp)"
WARNINGS_FILE="$(mktemp)"
echo '[]' >"$STEPS_FILE"
echo '[]' >"$WARNINGS_FILE"

FAILURES=0
WARNINGS=0
LAST_BODY=""
LAST_STATUS="000"
LAST_OK=false

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required binary: $1" >&2
    exit 1
  fi
}

require_bin curl
require_bin jq
require_bin python3
require_bin go

epoch_ms() {
  python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

iso_now() {
  python3 - <<'PY'
from datetime import datetime, timezone
print(datetime.now(timezone.utc).astimezone().isoformat())
PY
}

iso_plus_seconds() {
  local seconds="$1"
  python3 - "$seconds" <<'PY'
from datetime import datetime, timedelta, timezone
import sys
seconds = int(sys.argv[1])
print((datetime.now(timezone.utc).astimezone() + timedelta(seconds=seconds)).isoformat())
PY
}

json_or_string() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    printf 'null'
    return
  fi
  if jq -e . >/dev/null 2>&1 <<<"$raw"; then
    jq -c . <<<"$raw"
  else
    jq -cn --arg raw "$raw" '$raw'
  fi
}

append_warning() {
  local message="$1"
  WARNINGS=$((WARNINGS + 1))
  local tmp
  tmp="$(mktemp)"
  jq -c --arg message "$message" '. + [$message]' "$WARNINGS_FILE" >"$tmp" && mv "$tmp" "$WARNINGS_FILE"
  printf '[WARN] %s\n' "$message" >&2
}

record_step() {
  local chain="$1"
  local step="$2"
  local method="$3"
  local path="$4"
  local status="$5"
  local duration_ms="$6"
  local ok="$7"
  local request_raw="$8"
  local response_raw="$9"
  local note="${10:-}"

  local request_json response_json tmp
  request_json="$(json_or_string "$request_raw")"
  response_json="$(json_or_string "$response_raw")"
  tmp="$(mktemp)"
  jq -c \
    --arg chain "$chain" \
    --arg step "$step" \
    --arg method "$method" \
    --arg path "$path" \
    --arg status "$status" \
    --argjson duration_ms "${duration_ms:-0}" \
    --argjson ok "$ok" \
    --argjson request "$request_json" \
    --argjson response "$response_json" \
    --arg note "$note" \
    '. + [{
      chain:$chain,
      step:$step,
      method:$method,
      path:$path,
      http_status:$status,
      duration_ms:$duration_ms,
      ok:$ok,
      request:$request,
      response:$response,
      note:$note
    }]' "$STEPS_FILE" >"$tmp" && mv "$tmp" "$STEPS_FILE"

  if [[ "$ok" == "true" ]]; then
    printf '[%s] %s ok (%sms)\n' "$chain" "$step" "$duration_ms" >&2
  else
    FAILURES=$((FAILURES + 1))
    printf '[%s] %s failed status=%s (%sms)\n' "$chain" "$step" "$status" "$duration_ms" >&2
  fi
}

record_check() {
  local chain="$1"
  local step="$2"
  local ok="$3"
  local detail="$4"
  record_step "$chain" "$step" "CHECK" "" "000" 0 "$ok" "null" "$(jq -cn --arg detail "$detail" '{detail:$detail}')" ""
}

response_ok() {
  local status="$1"
  local body="$2"
  [[ "$status" =~ ^2 ]] || return 1
  local code
  code="$(jq -r '.code // empty' <<<"$body" 2>/dev/null || true)"
  [[ "$code" == "OK" || "$code" == "0" || "$code" == "" ]]
}

api_request() {
  local chain="$1"
  local step="$2"
  local method="$3"
  local path="$4"
  local token="${5:-}"
  local payload="${6:-}"
  local optional="${7:-false}"

  local started ended duration raw curl_code status body ok
  started="$(epoch_ms)"
  if [[ "$method" == "GET" || "$method" == "DELETE" ]]; then
    if [[ -n "$token" ]]; then
      raw="$(curl -sS --max-time 30 -w $'\n%{http_code}' -X "$method" "$API_BASE$path" \
        -H "Authorization: Bearer $token" 2>&1)"
    else
      raw="$(curl -sS --max-time 30 -w $'\n%{http_code}' -X "$method" "$API_BASE$path" 2>&1)"
    fi
    curl_code=$?
  else
    if [[ -n "$token" ]]; then
      raw="$(curl -sS --max-time 30 -w $'\n%{http_code}' -X "$method" "$API_BASE$path" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "${payload:-{}}" 2>&1)"
    else
      raw="$(curl -sS --max-time 30 -w $'\n%{http_code}' -X "$method" "$API_BASE$path" \
        -H "Content-Type: application/json" \
        -d "${payload:-{}}" 2>&1)"
    fi
    curl_code=$?
  fi
  ended="$(epoch_ms)"
  duration=$((ended - started))

  if [[ "$curl_code" -eq 0 ]]; then
    status="$(tail -n 1 <<<"$raw")"
    body="$(sed '$d' <<<"$raw")"
  else
    status="000"
    body="$raw"
  fi

  ok=false
  if response_ok "$status" "$body"; then
    ok=true
  fi

  LAST_BODY="$body"
  LAST_STATUS="$status"
  LAST_OK="$ok"
  local record_ok="$ok"
  local note=""
  if [[ "$ok" != "true" && "$optional" == "true" ]]; then
    record_ok=true
    note="optional probe failed; recorded as warning"
    append_warning "$chain $step optional probe failed with status=$status"
  fi
  record_step "$chain" "$step" "$method" "$path" "$status" "$duration" "$record_ok" "${payload:-null}" "$body" "$note"
  [[ "$ok" == "true" ]]
}

login_token() {
  local role="$1"
  local phone="$2"
  local env_name="${role}_TOKEN"
  local env_token="${!env_name:-}"
  local role_key
  role_key="$(printf '%s' "$role" | tr '[:upper:]' '[:lower:]')"
  if [[ -n "$env_token" ]]; then
    record_check "auth" "${role_key}_token_env" true "$phone"
    printf '%s\n' "$env_token"
    return 0
  fi

  local token
  token="$(
    cd "$BACKEND_DIR" &&
      go run ./cmd/devtoken -phone "$phone" -config "$DEVTOKEN_CONFIG_PATH" 2>/dev/null | tail -n 1
  )"
  if [[ -z "$token" ]]; then
    record_check "auth" "${role_key}_devtoken" false "failed to mint token for $phone"
    return 1
  fi
  record_check "auth" "${role_key}_devtoken" true "$phone"
  printf '%s\n' "$token"
}

mysql_available() {
  if command -v mysql >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -Eq "^(${MYSQL_CONTAINER}|mysql-sql-practice)$"; then
    return 0
  fi
  return 1
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
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "mysql-sql-practice"; then
    docker exec -i mysql-sql-practice mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" "$@"
    return
  fi
  return 1
}

extract() {
  local expr="$1"
  jq -r "$expr // empty" <<<"$LAST_BODY"
}

service_class_code() {
  api_request "bootstrap" "list_service_classes" "GET" "/service-classes" "" "" || return 1
  local code
  code="$(jq -r '.data[0].code // .data.items[0].code // "light_heavy"' <<<"$LAST_BODY")"
  printf '%s\n' "$code"
}

order_payload() {
  local service_class="$1"
  local scheduled_at="$2"
  jq -nc \
    --arg service_class "$service_class" \
    --arg scheduled_at "$scheduled_at" \
    '{
      origin:{latitude:22.5440, longitude:114.0580, address:"深圳市龙岗区坂田仓库"},
      destination:{latitude:22.5485, longitude:114.0665, address:"深圳市坪山区施工点"},
      cargo_weight_kg:65,
      service_class_code:$service_class,
      cargo_scene:"power_grid",
      note:"H10 自动验收样本"
    } + (if $scheduled_at == "" then {} else {scheduled_at:$scheduled_at} end)'
}

provider_online() {
  local chain="$1"
  local provider_token="$2"
  local service_class="$3"
  local payload
  payload="$(jq -nc --arg service_class "$service_class" '{
    latitude:22.5442,
    longitude:114.0582,
    accepted_service_classes:[$service_class],
    max_radius_km:30
  }')"
  api_request "$chain" "provider_online" "POST" "/provider/presence/online" "$provider_token" "$payload"
}

wait_for_broadcast() {
  local chain="$1"
  local provider_token="$2"
  local order_id="$3"
  local attempts=$((WAIT_SECONDS / 3))
  local broadcast_id=""
  local i
  for ((i=1; i<=attempts; i++)); do
    api_request "$chain" "provider_list_broadcasts_attempt_$i" "GET" "/provider/broadcasts?limit=20" "$provider_token" "" >/dev/null || true
    broadcast_id="$(jq -r --argjson order_id "$order_id" '.data.items[]? | select(.order_id == $order_id) | .id' <<<"$LAST_BODY" | head -n 1)"
    if [[ -n "$broadcast_id" && "$broadcast_id" != "null" ]]; then
      record_check "$chain" "broadcast_visible" true "broadcast_id=$broadcast_id order_id=$order_id"
      printf '%s\n' "$broadcast_id"
      return 0
    fi
    sleep 3
  done
  record_check "$chain" "broadcast_visible" false "timeout waiting for order_id=$order_id"
  return 1
}

advance_order_to_completed() {
  local chain="$1"
  local customer_token="$2"
  local provider_token="$3"
  local order_id="$4"

  api_request "$chain" "start_preparing" "POST" "/orders/$order_id/start-preparing" "$provider_token" "{}" || return 1
  api_request "$chain" "start_flight" "POST" "/orders/$order_id/start-flight" "$provider_token" "{}" || return 1
  api_request "$chain" "confirm_delivery" "POST" "/orders/$order_id/confirm-delivery" "$provider_token" "{}" || return 1
  api_request "$chain" "confirm_receipt" "POST" "/orders/$order_id/confirm-receipt" "$customer_token" "{}" || return 1
  api_request "$chain" "order_detail_completed" "GET" "/orders/$order_id" "$customer_token" "" || return 1
  local status
  status="$(extract '.data.status')"
  [[ "$status" == "completed" ]] && record_check "$chain" "final_status_completed" true "status=$status" || {
    record_check "$chain" "final_status_completed" false "status=$status"
    return 1
  }
}

maybe_sign_contract() {
  local chain="$1"
  local customer_token="$2"
  local provider_token="$3"
  local order_id="$4"
  api_request "$chain" "contract_sign_customer" "POST" "/orders/$order_id/contract/sign" "$customer_token" "{}" true >/dev/null || true
  api_request "$chain" "contract_sign_provider" "POST" "/orders/$order_id/contract/sign" "$provider_token" "{}" true >/dev/null || true
}

maybe_pay_order() {
  local chain="$1"
  local customer_token="$2"
  local order_id="$3"
  api_request "$chain" "order_detail_before_payment" "GET" "/orders/$order_id" "$customer_token" "" || return 1
  local status
  status="$(extract '.data.status')"
  if [[ "$status" == "pending_payment" || "$status" == "accepted" ]]; then
    api_request "$chain" "mock_pay_order" "POST" "/orders/$order_id/pay" "$customer_token" '{"method":"mock"}' || return 1
    return 0
  fi
  append_warning "$chain order_id=$order_id skipped payment check because current status is $status"
  record_check "$chain" "mock_pay_order_skipped" true "status=$status"
}

provider_stats_check() {
  local chain="$1"
  local provider_token="$2"
  api_request "$chain" "provider_stats" "GET" "/provider/me/stats" "$provider_token" "" || return 1
  record_check "$chain" "provider_pending_settlement_observed" true "$(jq -c '{today_income_cents:.data.today_income_cents,pending_settlement_cents:.data.pending_settlement_cents}' <<<"$LAST_BODY")"
}

run_instant_chain() {
  local service_class="$1" customer_token="$2" provider_token="$3"
  local payload order_id broadcast_id
  payload="$(order_payload "$service_class" "")"
  api_request "instant" "guest_estimate" "POST" "/orders/estimate" "" "$payload" || return 1
  api_request "instant" "customer_create_instant" "POST" "/orders/instant" "$customer_token" "$payload" || return 1
  order_id="$(extract '.data.order.id')"
  [[ -n "$order_id" ]] || { record_check "instant" "created_order_id" false "missing order id"; return 1; }
  provider_online "instant" "$provider_token" "$service_class" || return 1
  broadcast_id="$(wait_for_broadcast "instant" "$provider_token" "$order_id")" || return 1
  api_request "instant" "grab_broadcast" "POST" "/provider/broadcasts/$broadcast_id/grab" "$provider_token" "{}" || return 1
  maybe_pay_order "instant" "$customer_token" "$order_id" || return 1
  advance_order_to_completed "instant" "$customer_token" "$provider_token" "$order_id" || return 1
  api_request "instant" "order_payments" "GET" "/orders/$order_id/payments" "$customer_token" "" true >/dev/null || true
  provider_stats_check "instant" "$provider_token" || return 1
}

force_reservation_due() {
  local order_id="$1"
  if ! mysql_available; then
    append_warning "reservation order_id=$order_id could not be patched to due state: mysql/docker unavailable"
    return 1
  fi
  mysql_exec <<SQL >/dev/null 2>&1
UPDATE orders
SET reserved_start_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE),
    start_time = DATE_SUB(NOW(), INTERVAL 1 MINUTE),
    updated_at = NOW()
WHERE id = ${order_id};
SQL
}

run_reservation_chain() {
  local service_class="$1" customer_token="$2" provider_token="$3"
  local scheduled payload order_id broadcast_id
  scheduled="$(iso_plus_seconds 3600)"
  payload="$(order_payload "$service_class" "$scheduled")"
  api_request "reservation" "customer_create_reservation" "POST" "/orders/reservation" "$customer_token" "$payload" || return 1
  order_id="$(extract '.data.order.id')"
  [[ -n "$order_id" ]] || { record_check "reservation" "created_order_id" false "missing order id"; return 1; }
  local status
  status="$(extract '.data.order.status')"
  [[ "$status" == "scheduled" ]] && record_check "reservation" "initial_status_scheduled" true "status=$status" || {
    record_check "reservation" "initial_status_scheduled" false "status=$status"
    return 1
  }
  force_reservation_due "$order_id" || true
  provider_online "reservation" "$provider_token" "$service_class" || return 1
  broadcast_id="$(wait_for_broadcast "reservation" "$provider_token" "$order_id")" || return 1
  api_request "reservation" "grab_broadcast" "POST" "/provider/broadcasts/$broadcast_id/grab" "$provider_token" "{}" || return 1
  maybe_pay_order "reservation" "$customer_token" "$order_id" || return 1
  advance_order_to_completed "reservation" "$customer_token" "$provider_token" "$order_id" || return 1
  provider_stats_check "reservation" "$provider_token" || return 1
}

pick_provider_drone_id() {
  local provider_token="$1"
  api_request "negotiated" "provider_list_drones" "GET" "/owner/drones?page=1&page_size=50" "$provider_token" "" || return 1
  jq -r '.data.items[]?
    | select((.mtow_kg // 0) >= 150 and (.max_payload_kg // 0) >= 50)
    | select((.availability_status // "available") == "available")
    | select((.certification_status // "") == "approved")
    | select((.uom_verified // "") == "verified")
    | select((.insurance_verified // "") == "verified")
    | select((.airworthiness_verified // "") == "verified")
    | .id' <<<"$LAST_BODY" | head -n 1
}

negotiated_demand_payload() {
  local start end expiry
  start="$(iso_plus_seconds 90000)"
  end="$(iso_plus_seconds 100800)"
  expiry="$(iso_plus_seconds 172800)"
  jq -nc \
    --arg start "$start" \
    --arg end "$end" \
    --arg expiry "$expiry" \
    --arg title "H10 议价单兼容验收 $(date +%H%M%S)" \
    '{
      title:$title,
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:"power_grid",
      description:"H10 自动验收议价单样本",
      departure_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      destination_address:{text:"广东省佛山市南海区电网建设工地", city:"佛山", district:"南海区", latitude:23.0374, longitude:113.1428},
      service_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:52,
      cargo_volume_m3:1.8,
      cargo_type:"电力塔材",
      cargo_special_requirements:"山地工况，需重载吊运",
      estimated_trip_count:1,
      budget_min:120000,
      budget_max:200000,
      allows_pilot_candidate:false,
      expires_at:$expiry
    }'
}

run_negotiated_chain() {
  local customer_token="$1" provider_token="$2"
  local drone_id payload demand_id quote_id order_id mode status
  drone_id="$(pick_provider_drone_id "$provider_token")"
  if [[ -z "$drone_id" ]]; then
    record_check "negotiated" "provider_drone_available" false "no eligible heavy-lift drone"
    return 1
  fi
  record_check "negotiated" "provider_drone_available" true "drone_id=$drone_id"

  payload="$(negotiated_demand_payload)"
  api_request "negotiated" "customer_create_demand" "POST" "/demands" "$customer_token" "$payload" || return 1
  demand_id="$(extract '.data.id')"
  [[ -n "$demand_id" ]] || { record_check "negotiated" "created_demand_id" false "missing demand id"; return 1; }
  api_request "negotiated" "customer_publish_demand" "POST" "/demands/$demand_id/publish" "$customer_token" "{}" || return 1
  payload="$(jq -nc --argjson drone_id "$drone_id" '{
    drone_id:$drone_id,
    price_amount:158000,
    execution_plan:"H10 自动验收：服务商报价，预计一架次完成。"
  }')"
  api_request "negotiated" "provider_quote" "POST" "/demands/$demand_id/quotes" "$provider_token" "$payload" || return 1
  quote_id="$(extract '.data.id')"
  [[ -n "$quote_id" ]] || { record_check "negotiated" "created_quote_id" false "missing quote id"; return 1; }
  payload="$(jq -nc --argjson quote_id "$quote_id" '{quote_id:$quote_id}')"
  api_request "negotiated" "customer_select_provider" "POST" "/demands/$demand_id/select-provider" "$customer_token" "$payload" || return 1
  order_id="$(extract '.data.order_id')"
  [[ -n "$order_id" ]] || { record_check "negotiated" "selected_order_id" false "missing order id"; return 1; }
  api_request "negotiated" "order_detail_after_select" "GET" "/orders/$order_id" "$customer_token" "" || return 1
  mode="$(extract '.data.order_mode')"
  status="$(extract '.data.status')"
  [[ "$mode" == "negotiated" ]] && record_check "negotiated" "order_mode_negotiated" true "mode=$mode status=$status" || {
    record_check "negotiated" "order_mode_negotiated" false "mode=$mode status=$status"
    return 1
  }
  maybe_sign_contract "negotiated" "$customer_token" "$provider_token" "$order_id"
  maybe_pay_order "negotiated" "$customer_token" "$order_id" || return 1
  api_request "negotiated" "provider_confirm_if_needed" "POST" "/orders/$order_id/provider-confirm" "$provider_token" "{}" true >/dev/null || true
  api_request "negotiated" "order_detail_before_fulfillment" "GET" "/orders/$order_id" "$provider_token" "" || return 1
  status="$(extract '.data.status')"
  if [[ "$status" != "assigned" && "$status" != "confirmed" && "$status" != "preparing" && "$status" != "in_transit" && "$status" != "delivered" ]]; then
    append_warning "negotiated order_id=$order_id did not enter executable status after payment/provider-confirm: $status"
    record_check "negotiated" "executable_after_payment" false "status=$status"
    return 1
  fi
  if [[ "$status" == "confirmed" ]]; then
    api_request "negotiated" "start_preparing_from_confirmed" "POST" "/orders/$order_id/start-preparing" "$provider_token" "{}" || return 1
    api_request "negotiated" "start_flight" "POST" "/orders/$order_id/start-flight" "$provider_token" "{}" || return 1
    api_request "negotiated" "confirm_delivery" "POST" "/orders/$order_id/confirm-delivery" "$provider_token" "{}" || return 1
    api_request "negotiated" "confirm_receipt" "POST" "/orders/$order_id/confirm-receipt" "$customer_token" "{}" || return 1
  else
    advance_order_to_completed "negotiated" "$customer_token" "$provider_token" "$order_id" || return 1
  fi
}

write_report() {
  local ended
  ended="$(iso_now)"
  local success
  if [[ "$FAILURES" -eq 0 ]]; then
    success=true
  else
    success=false
  fi
  jq -n \
    --arg run_at "$ended" \
    --arg root_base "$ROOT_BASE" \
    --arg api_base "$API_BASE" \
    --arg customer_phone "$CUSTOMER_PHONE" \
    --arg provider_phone "$PROVIDER_PHONE" \
    --arg pilot_phone "$PILOT_PHONE" \
    --arg admin_phone "$ADMIN_PHONE" \
    --argjson success "$success" \
    --argjson failure_count "$FAILURES" \
    --argjson warning_count "$WARNINGS" \
    --slurpfile steps "$STEPS_FILE" \
    --slurpfile warnings "$WARNINGS_FILE" \
    '{
      run_at:$run_at,
      root_base:$root_base,
      api_base:$api_base,
      demo_accounts_doc:"docs/testing/DEMO_ACCOUNTS.md",
      accounts:{
        customer_phone:$customer_phone,
        provider_phone:$provider_phone,
        pilot_phone:$pilot_phone,
        admin_phone:$admin_phone
      },
      summary:{
        success:$success,
        failure_count:$failure_count,
        warning_count:$warning_count,
        chains:(reduce ($steps[0][]?.chain) as $chain ({}; .[$chain] = (if ([ $steps[0][]? | select(.chain == $chain and .ok == false) ] | length) == 0 then "passed" else "failed" end)))
      },
      warnings:$warnings[0],
      known_debts:[
        "H9.0 StatsBetween 当前使用 Go 内存循环聚合，广播量上来后应改为 SQL GROUP BY 聚合。",
        "DEMO_ACCOUNTS.md 当前没有显式 admin 账号；脚本保留 ADMIN_PHONE/ADMIN_TOKEN 环境变量入口。"
      ],
      steps:$steps[0]
    }' >"$REPORT_FILE"
  printf 'report written: %s\n' "$REPORT_FILE" >&2
}

main() {
  local started service_class customer_token provider_token pilot_token admin_token
  started="$(iso_now)"
  record_check "bootstrap" "started_at" true "$started"

  api_request "bootstrap" "api_v2_status" "GET" "/status" "" "" || true
  service_class="$(service_class_code)" || service_class="light_heavy"
  record_check "bootstrap" "service_class_selected" true "$service_class"

  customer_token="$(login_token "CUSTOMER" "$CUSTOMER_PHONE")" || customer_token=""
  provider_token="$(login_token "PROVIDER" "$PROVIDER_PHONE")" || provider_token=""
  pilot_token="$(login_token "PILOT" "$PILOT_PHONE")" || pilot_token=""
  admin_token="$(login_token "ADMIN" "$ADMIN_PHONE")" || admin_token=""
  [[ -n "$pilot_token" ]] || append_warning "pilot token unavailable; H10 flow currently uses provider as executable service provider"
  [[ -n "$admin_token" ]] || append_warning "admin token unavailable; reservation due-state uses DB patch fallback when possible"

  if [[ -z "$customer_token" || -z "$provider_token" ]]; then
    record_check "auth" "required_tokens" false "customer/provider token required"
    write_report
    exit 1
  fi
  record_check "auth" "required_tokens" true "customer/provider tokens ready"

  run_instant_chain "$service_class" "$customer_token" "$provider_token" || append_warning "instant chain failed; see failed steps in JSON report"
  run_reservation_chain "$service_class" "$customer_token" "$provider_token" || append_warning "reservation chain failed; see failed steps in JSON report"
  run_negotiated_chain "$customer_token" "$provider_token" || append_warning "negotiated chain failed; see failed steps in JSON report"

  api_request "cleanup" "provider_offline" "POST" "/provider/presence/offline" "$provider_token" "{}" >/dev/null || true
  write_report

  if [[ "$FAILURES" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
