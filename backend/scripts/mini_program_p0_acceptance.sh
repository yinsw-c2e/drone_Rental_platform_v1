#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_FILE="${REPORT_FILE:-$BACKEND_DIR/docs/mini_program_p0_acceptance_last_run.json}"

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

RESULTS_JSON='[]'
CUSTOMER_USER_ID=""
PROVIDER_USER_ID=""
DEMAND_ID=""
QUOTE_ID=""
ORDER_ID=""
DISPATCH_ID=""
SETTLEMENT_ID=""
SETTLEMENT_STATUS=""

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
    --arg demand_id "$DEMAND_ID" \
    --arg quote_id "$QUOTE_ID" \
    --arg order_id "$ORDER_ID" \
    --arg dispatch_id "$DISPATCH_ID" \
    --arg settlement_id "$SETTLEMENT_ID" \
    --arg settlement_status "$SETTLEMENT_STATUS" \
    --argjson results "$RESULTS_JSON" \
    '{
      run_at:$run_at,
      base_url:$base_url,
      exit_status:$exit_status,
      accounts:{
        customer:{phone:$customer_phone,user_id:$customer_user_id},
        provider:{phone:$provider_phone,user_id:$provider_user_id}
      },
      artifacts:{
        demand_id:$demand_id,
        quote_id:$quote_id,
        order_id:$order_id,
        dispatch_id:$dispatch_id,
        settlement_id:$settlement_id,
        settlement_status:$settlement_status
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

assert_forbidden() {
  local response="$1"
  local label="$2"
  local code
  code="$(jq -r '.code // empty' <<<"$response")"
  if [[ "$code" != "FORBIDDEN" ]]; then
    echo "assert_forbidden failed for $label" >&2
    echo "$response" >&2
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

json_patch() {
  local token="$1"
  local path="$2"
  local payload="$3"
  curl -sS --max-time 20 -X PATCH "$API_V2$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

mysql_exec() {
  if command -v mysql >/dev/null 2>&1; then
    mysql --default-character-set=utf8mb4 -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASS" -D "$MYSQL_DB" "$@"
    return
  fi
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
    docker exec -i "$MYSQL_CONTAINER" mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" "$@"
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
    p.caac_license_no = COALESCE(NULLIF(p.caac_license_no, ''), CONCAT('CAAC-P0-', p.id)),
    p.caac_license_image = COALESCE(NULLIF(p.caac_license_image, ''), '/uploads/certifications/p0-caac-license.jpg'),
    p.verification_status = 'verified',
    p.availability_status = 'online',
    p.updated_at = NOW()
WHERE u.phone = '$PROVIDER_PHONE';

INSERT INTO pilots (
  user_id, caac_license_no, caac_license_type, caac_license_image,
  verification_status, availability_status, current_city,
  current_latitude, current_longitude, service_radius,
  verified_at, created_at, updated_at
)
SELECT u.id, CONCAT('CAAC-P0-', u.id), 'BVLOS', '/uploads/certifications/p0-caac-license.jpg',
       'verified', 'online', '深圳',
       22.5431, 114.0579, 80,
       NOW(), NOW(), NOW()
FROM users u
WHERE u.phone = '$PROVIDER_PHONE'
  AND NOT EXISTS (
    SELECT 1
    FROM pilots p
    WHERE p.user_id = u.id
      AND p.deleted_at IS NULL
  );

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

SQL
  then
    append_result "PREPARE" "demo_data" "skipped" "mysql unavailable or preparation failed"
    return
  fi

  append_result "PREPARE" "demo_data" "passed" "provider drones eligible and provider self-fulfillment ready"
}

assert_role() {
  local response="$1"
  local label="$2"
  local jq_filter="$3"
  if ! jq -e "$jq_filter" >/dev/null <<<"$response"; then
    append_result "ROLE" "$label" "failed" "$(jq -c '.data.role_summary // {}' <<<"$response")"
    exit 1
  fi
  append_result "ROLE" "$label" "passed" "$(jq -c '.data.role_summary' <<<"$response")"
}

assert_provider_role() {
  local response="$1"
  local label="$2"
  local jq_filter="$3"
  if ! jq -e '.data.role_summary.provider != null' >/dev/null <<<"$response"; then
    append_result "ROLE" "$label" "failed" "missing role_summary.provider; restart backend so the unified provider summary is served"
    exit 1
  fi
  if ! jq -e "$jq_filter" >/dev/null <<<"$response"; then
    append_result "ROLE" "$label" "failed" "$(jq -c '.data.role_summary.provider // {}' <<<"$response")"
    exit 1
  fi
  append_result "ROLE" "$label" "passed" "$(jq -c '.data.role_summary.provider' <<<"$response")"
}

pick_provider_drone_id() {
  local token="$1"
  local response
  response="$(json_get "$token" "/owner/drones?page=1&page_size=50")"
  assert_success "$response" "provider_drones"
  jq -r '.data.items[]? | select((.mtow_kg // .max_load // 0) >= 150 and ((.max_payload_kg // .max_load // 0) >= 50)) | .id' <<<"$response" | head -n1
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
    --arg title "小程序P0验收-客户真实需求-$(date +%H%M%S)" \
    --arg start "$start_iso" \
    --arg end "$end_iso" \
    --arg expiry "$expiry_iso" \
    '{
      title:$title,
      service_type:"heavy_cargo_lift_transport",
      cargo_scene:"power_grid",
      description:"mini program p0 acceptance demand",
      departure_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      destination_address:{text:"广东省佛山市南海区施工吊运点", city:"佛山", district:"南海区", latitude:23.0374, longitude:113.1428},
      service_address:{text:"广东省佛山市禅城区电力仓储基地", city:"佛山", district:"禅城区", latitude:23.0109, longitude:113.1227},
      scheduled_start_at:$start,
      scheduled_end_at:$end,
      cargo_weight_kg:52,
      cargo_volume_m3:1.8,
      cargo_type:"电力塔材",
      cargo_special_requirements:"小程序P0验收，需服务商报价后开始履约",
      estimated_trip_count:1,
      budget_min:120000,
      budget_max:200000,
      allows_pilot_candidate:true,
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
    execution_plan:"小程序P0验收：服务商报价，确认后由服务商主体履约。"
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

  response="$(json_get "$customer_token" "/demands/$DEMAND_ID/quotes")"
  assert_success "$response" "customer_demand_quotes"
  if ! jq -e --argjson quote_id "$QUOTE_ID" '.data.items[]? | select(.id == $quote_id)' >/dev/null <<<"$response"; then
    append_result "CUSTOMER" "quotes_contains_provider_quote" "failed" "quote_id=$QUOTE_ID not visible"
    exit 1
  fi
  append_result "CUSTOMER" "quotes_contains_provider_quote" "passed" "quote_id=$QUOTE_ID"

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

start_provider_fulfillment() {
  local provider_token="$1"
  local response order_status operator_user_id

  response="$(json_get "$provider_token" "/orders/$ORDER_ID")"
  assert_success "$response" "provider_order_before_fulfillment"
  order_status="$(jq -r '.data.status // empty' <<<"$response")"

  if [[ "$order_status" == "pending_dispatch" ]]; then
    response="$(json_post "$provider_token" "/orders/$ORDER_ID/dispatch" '{"dispatch_mode":"self_execute","reason":"mini program p0 provider self fulfillment"}')"
    assert_success "$response" "provider_start_self_fulfillment"
    DISPATCH_ID="$(jq -r '.data.dispatch_task.id // empty' <<<"$response")"
    append_result "PROVIDER" "start_self_fulfillment" "passed" "order_id=$ORDER_ID"
  else
    append_result "PROVIDER" "start_self_fulfillment" "passed" "order already in status=$order_status"
  fi

  response="$(json_get "$provider_token" "/orders/$ORDER_ID")"
  assert_success "$response" "provider_order_after_start"
  order_status="$(jq -r '.data.status // empty' <<<"$response")"
  operator_user_id="$(jq -r '.data.executor.user_id // .data.executor_pilot_user_id // empty' <<<"$response")"
  if [[ "$order_status" != "assigned" && "$order_status" != "preparing" && "$order_status" != "in_transit" && "$order_status" != "delivered" && "$order_status" != "completed" ]]; then
    append_result "ORDER" "assigned_after_provider_start" "failed" "status=$order_status"
    exit 1
  fi
  if [[ "$operator_user_id" != "$PROVIDER_USER_ID" ]]; then
    append_result "ORDER" "provider_operator_bound" "failed" "operator_user_id=$operator_user_id expected=$PROVIDER_USER_ID"
    exit 1
  fi
  append_result "ORDER" "assigned_after_provider_start" "passed" "status=$order_status provider=$operator_user_id"
}

advance_execution_and_settle() {
  local customer_token="$1"
  local provider_token="$2"
  local response status

  for next_status in preparing in_transit delivered; do
    response="$(json_post "$provider_token" "/orders/$ORDER_ID/execution-status" "$(jq -nc --arg status "$next_status" '{status:$status}')")"
    assert_success "$response" "execution_status:$next_status"
    append_result "PROVIDER" "advance_$next_status" "passed" "order_id=$ORDER_ID"
  done

  response="$(json_post "$customer_token" "/orders/$ORDER_ID/confirm-receipt" '{}')"
  assert_success "$response" "customer_confirm_receipt"
  response="$(json_get "$customer_token" "/orders/$ORDER_ID")"
  assert_success "$response" "customer_order_completed"
  status="$(jq -r '.data.status // empty' <<<"$response")"
  if [[ "$status" != "completed" ]]; then
    append_result "ORDER" "completed_after_receipt" "failed" "status=$status"
    exit 1
  fi
  append_result "ORDER" "completed_after_receipt" "passed" "order_id=$ORDER_ID"

  response="$(json_get "$customer_token" "/orders/$ORDER_ID/settlement")"
  assert_success "$response" "customer_order_settlement"
  SETTLEMENT_ID="$(jq -r '.data.id // empty' <<<"$response")"
  SETTLEMENT_STATUS="$(jq -r '.data.status // empty' <<<"$response")"

  local settlement_owner settlement_pilot settlement_payer
  settlement_owner="$(jq -r '.data.owner_user_id // empty' <<<"$response")"
  settlement_pilot="$(jq -r '.data.pilot_user_id // empty' <<<"$response")"
  settlement_payer="$(jq -r '.data.payer_user_id // empty' <<<"$response")"
  if [[ "$settlement_owner" != "$PROVIDER_USER_ID" || "$settlement_pilot" != "$PROVIDER_USER_ID" || "$settlement_payer" != "$CUSTOMER_USER_ID" ]]; then
    append_result "SETTLEMENT" "participants" "failed" "payer=$settlement_payer owner=$settlement_owner pilot=$settlement_pilot"
    exit 1
  fi

  response="$(json_get "$provider_token" "/orders/$ORDER_ID/settlement")"
  assert_success "$response" "provider_order_settlement"
  append_result "SETTLEMENT" "customer_provider_visible" "passed" "settlement_id=$SETTLEMENT_ID status=$SETTLEMENT_STATUS"

  response="$(json_get "$provider_token" "/settlement/wallet")"
  assert_success "$response" "provider_wallet"
  append_result "SETTLEMENT" "provider_wallet_visible" "passed" "provider wallet loaded"

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
}

main() {
  require_bin curl
  require_bin jq
  require_bin python3
  require_bin go
  trap 'code=$?; trap - EXIT; write_report "$code"; exit "$code"' EXIT

  local response customer_token provider_token customer_me provider_me drone_id

  response="$(curl -sS --max-time 10 "$API_V2/status")"
  assert_success "$response" "v2_status"
  append_result "BASE" "api_v2_status" "passed" "$(jq -r '.data.status // .message // "ok"' <<<"$response")"

  prepare_demo_data

  customer_token="$(login_token "$CUSTOMER_PHONE")"
  provider_token="$(login_token "$PROVIDER_PHONE")"
  append_result "AUTH" "customer_login" "passed" "$CUSTOMER_PHONE"
  append_result "AUTH" "provider_login" "passed" "$PROVIDER_PHONE"

  customer_me="$(json_get "$customer_token" "/me")"; assert_success "$customer_me" "customer_me"
  provider_me="$(json_get "$provider_token" "/me")"; assert_success "$provider_me" "provider_me"
  CUSTOMER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$customer_me")"
  PROVIDER_USER_ID="$(jq -r '.data.user.id // empty' <<<"$provider_me")"
  assert_role "$customer_me" "customer_can_haul" '.data.role_summary.has_client_role == true'
  assert_provider_role "$customer_me" "customer_provider_onboarding_state" '.data.role_summary.provider.can_use_workbench == false and .data.role_summary.provider.can_quote == false and .data.role_summary.provider.can_accept_dispatch == false and (.data.role_summary.provider.next_action == "start_onboarding" or .data.role_summary.provider.next_action == "wait_review" or .data.role_summary.provider.next_action == "fix_rejected")'
  response="$(json_get "$customer_token" "/owner/workbench")"
  assert_forbidden "$response" "customer_forbidden_owner_workbench"
  append_result "ROLE" "customer_forbidden_owner_workbench" "passed" "$(jq -r '.message // empty' <<<"$response")"
  assert_role "$provider_me" "provider_has_asset_identity" '(.data.role_summary.has_owner_role == true) or (.data.role_summary.provider.asset_status == "approved")'
  assert_provider_role "$provider_me" "provider_workbench_capability" '.data.role_summary.provider.status == "approved" and .data.role_summary.provider.can_use_workbench == true and .data.role_summary.provider.can_quote == true'

  response="$(json_get "$provider_token" "/owner/workbench")"
  assert_success "$response" "provider_workbench"
  append_result "PROVIDER" "workbench_load" "passed" "real provider dashboard loaded"

  drone_id="$(pick_provider_drone_id "$provider_token")"
  if [[ -z "$drone_id" ]]; then
    append_result "PROVIDER" "drone_pick" "failed" "no heavy-lift eligible provider drone"
    exit 1
  fi
  append_result "PROVIDER" "drone_pick" "passed" "drone_id=$drone_id"

  create_customer_demand "$customer_token"
  create_provider_quote "$provider_token" "$drone_id"
  select_provider_and_pay "$customer_token" "$provider_token"
  start_provider_fulfillment "$provider_token"
  advance_execution_and_settle "$customer_token" "$provider_token"

  append_result "FINAL" "mini_program_p0_acceptance" "passed" "order_id=$ORDER_ID settlement_id=$SETTLEMENT_ID"
}

main "$@"
