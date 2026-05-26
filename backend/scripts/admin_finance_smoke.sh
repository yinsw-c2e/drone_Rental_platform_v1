#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
API_V2="$BASE_URL/api/v2"

ADMIN_PHONE="${ADMIN_PHONE:-13800000001}"
NON_ADMIN_PHONE="${NON_ADMIN_PHONE:-13900000016}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-password123}"
DEVTOKEN_CONFIG_PATH="${DEVTOKEN_CONFIG_PATH:-config.yaml}"

START_DATE="${START_DATE:-2026-05-23}"
END_DATE="${END_DATE:-2026-05-23}"
EXPECT_FINANCE_SAMPLE="${EXPECT_FINANCE_SAMPLE:-0}"
EXPECT_FINANCE_AUDIT="${EXPECT_FINANCE_AUDIT:-0}"
REPORT_FILE="${REPORT_FILE:-$BACKEND_DIR/docs/admin_finance_smoke_last_run.json}"

RESULTS_JSON='[]'
SETTLEMENT_TOTAL="0"
WITHDRAWAL_TOTAL="0"
SETTLEMENT_CSV_ROWS="0"
WITHDRAWAL_CSV_ROWS="0"
FINANCE_AUDIT_TOTAL="0"

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
    --arg admin_phone "$ADMIN_PHONE" \
    --arg non_admin_phone "$NON_ADMIN_PHONE" \
    --arg start_date "$START_DATE" \
    --arg end_date "$END_DATE" \
    --arg settlement_total "$SETTLEMENT_TOTAL" \
    --arg withdrawal_total "$WITHDRAWAL_TOTAL" \
    --arg settlement_csv_rows "$SETTLEMENT_CSV_ROWS" \
    --arg withdrawal_csv_rows "$WITHDRAWAL_CSV_ROWS" \
    --arg finance_audit_total "$FINANCE_AUDIT_TOTAL" \
    --arg exit_code "$exit_code" \
    --argjson results "$RESULTS_JSON" \
    '{
      run_at:$run_at,
      base_url:$base_url,
      exit_code:($exit_code | tonumber),
      accounts:{
        admin:$admin_phone,
        non_admin:$non_admin_phone
      },
      filters:{
        start_date:$start_date,
        end_date:$end_date
      },
      observed:{
        settlement_total:($settlement_total | tonumber),
        withdrawal_total:($withdrawal_total | tonumber),
        settlement_csv_rows:($settlement_csv_rows | tonumber),
        withdrawal_csv_rows:($withdrawal_csv_rows | tonumber),
        finance_audit_total:($finance_audit_total | tonumber)
      },
      results:$results
    }' > "$REPORT_FILE"
}

finish() {
  local exit_code="$?"
  write_report "$exit_code"
  exit "$exit_code"
}
trap finish EXIT

is_success_response() {
  jq -e '(.code == 0) or (.code == "OK")' >/dev/null
}

assert_json_success() {
  local response="$1"
  local label="$2"
  if ! jq -e . >/dev/null 2>&1 <<<"$response"; then
    append_result "ERROR" "$label" "failed" "non-json response: ${response:0:200}"
    exit 1
  fi
  if ! is_success_response <<<"$response"; then
    append_result "ERROR" "$label" "failed" "$(jq -c '.' <<<"$response")"
    exit 1
  fi
}

extract_total() {
  jq -r '
    if .total != null then
      .total
    elif .data.total != null then
      .data.total
    elif (.data.list | type) == "array" then
      (.data.list | length)
    elif (.data | type) == "array" then
      (.data | length)
    else
      0
    end
  '
}

extract_access_token() {
  jq -r '.data.token.access_token // .data.access_token // empty'
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

  if [[ -n "$LOGIN_PASSWORD" ]]; then
    response="$(curl -sS --max-time 15 -X POST "$API_V2/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"phone\":\"$phone\",\"password\":\"$LOGIN_PASSWORD\"}")"
    if jq -e . >/dev/null 2>&1 <<<"$response" && is_success_response <<<"$response"; then
      access_token="$(extract_access_token <<<"$response")"
      if [[ -n "$access_token" && "$access_token" != "null" ]]; then
        echo "$access_token"
        return
      fi
    fi
  fi

  access_token="$(mint_dev_token "$phone")"
  if [[ -n "$access_token" ]]; then
    echo "$access_token"
    return
  fi

  append_result "AUTH" "login:$phone" "failed" "unable to login with password or dev token"
  exit 1
}

json_get() {
  local token="$1"
  local path="$2"
  curl -sS --max-time 20 "$API_V2$path" \
    -H "Authorization: Bearer $token"
}

request_status() {
  local token="$1"
  local path="$2"
  local output="$3"
  curl -sS --max-time 20 -o "$output" -w "%{http_code}" "$API_V2$path" \
    -H "Authorization: Bearer $token"
}

download_csv() {
  local token="$1"
  local path="$2"
  local label="$3"
  local body_file headers_file status content_type row_count
  body_file="$(mktemp)"
  headers_file="$(mktemp)"

  status="$(curl -sS --max-time 30 -D "$headers_file" -o "$body_file" -w "%{http_code}" "$API_V2$path" \
    -H "Authorization: Bearer $token")"
  if [[ "$status" != "200" ]]; then
    append_result "CSV" "$label" "failed" "status=$status body=$(head -c 200 "$body_file")"
    exit 1
  fi

  content_type="$(tr -d '\r' < "$headers_file" | awk -F': ' 'tolower($1) == "content-type" {print $2; exit}')"
  if [[ "$content_type" != text/csv* ]]; then
    append_result "CSV" "$label" "failed" "unexpected content-type=$content_type"
    exit 1
  fi

  row_count="$(python3 - "$body_file" <<'PY'
import csv
import sys

with open(sys.argv[1], "r", encoding="utf-8-sig", newline="") as f:
    print(sum(1 for _ in csv.reader(f)))
PY
)"
  if [[ "$row_count" -lt 1 ]]; then
    append_result "CSV" "$label" "failed" "empty csv"
    exit 1
  fi

  append_result "CSV" "$label" "passed" "rows=$row_count content_type=$content_type"
  rm -f "$body_file" "$headers_file"
  echo "$row_count"
}

assert_forbidden() {
  local token="$1"
  local path="$2"
  local label="$3"
  local body_file status
  body_file="$(mktemp)"
  status="$(request_status "$token" "$path" "$body_file")"
  if [[ "$status" != "403" ]]; then
    append_result "AUTHZ" "$label" "failed" "expected=403 actual=$status body=$(head -c 200 "$body_file")"
    exit 1
  fi
  append_result "AUTHZ" "$label" "passed" "status=403"
  rm -f "$body_file"
}

assert_bad_request() {
  local token="$1"
  local path="$2"
  local label="$3"
  local body_file status
  body_file="$(mktemp)"
  status="$(request_status "$token" "$path" "$body_file")"
  if [[ "$status" != "400" ]]; then
    append_result "VALIDATION" "$label" "failed" "expected=400 actual=$status body=$(head -c 200 "$body_file")"
    exit 1
  fi
  append_result "VALIDATION" "$label" "passed" "status=400"
  rm -f "$body_file"
}

verify_admin_finance() {
  local admin_token="$1"
  local settlement_response withdrawal_response
  local settlement_query withdrawal_query

  settlement_query="/settlement/admin/list?status=settled&time_field=settled_at&start_date=$START_DATE&end_date=$END_DATE&page=1&page_size=20"
  withdrawal_query="/settlement/admin/withdrawals?status=completed&time_field=completed_at&start_date=$START_DATE&end_date=$END_DATE&page=1&page_size=20"

  settlement_response="$(json_get "$admin_token" "$settlement_query")"
  assert_json_success "$settlement_response" "settlement admin list"
  SETTLEMENT_TOTAL="$(extract_total <<<"$settlement_response")"
  append_result "LIST" "settlements" "passed" "total=$SETTLEMENT_TOTAL"

  withdrawal_response="$(json_get "$admin_token" "$withdrawal_query")"
  assert_json_success "$withdrawal_response" "withdrawal admin list"
  WITHDRAWAL_TOTAL="$(extract_total <<<"$withdrawal_response")"
  append_result "LIST" "withdrawals" "passed" "total=$WITHDRAWAL_TOTAL"

  SETTLEMENT_CSV_ROWS="$(download_csv "$admin_token" "/settlement/admin/export/settlements?status=settled&time_field=settled_at&start_date=$START_DATE&end_date=$END_DATE&limit=20" "settlements")"
  WITHDRAWAL_CSV_ROWS="$(download_csv "$admin_token" "/settlement/admin/export/withdrawals?status=completed&time_field=completed_at&start_date=$START_DATE&end_date=$END_DATE&limit=20" "withdrawals")"

  if [[ "$EXPECT_FINANCE_SAMPLE" == "1" ]]; then
    if [[ "$SETTLEMENT_TOTAL" -lt 1 || "$SETTLEMENT_CSV_ROWS" -lt 2 ]]; then
      append_result "SAMPLE" "settlements" "failed" "expected settlement rows for $START_DATE..$END_DATE"
      exit 1
    fi
    if [[ "$WITHDRAWAL_TOTAL" -lt 1 || "$WITHDRAWAL_CSV_ROWS" -lt 2 ]]; then
      append_result "SAMPLE" "withdrawals" "failed" "expected withdrawal rows for $START_DATE..$END_DATE"
      exit 1
    fi
    append_result "SAMPLE" "finance rows" "passed" "settlements=$SETTLEMENT_TOTAL withdrawals=$WITHDRAWAL_TOTAL"
  fi
}

verify_finance_audit_logs() {
  local admin_token="$1"
  local response

  response="$(json_get "$admin_token" "/admin/admin-logs?module=finance&action=export_settlements_csv&page=1&page_size=5")"
  assert_json_success "$response" "finance audit logs"
  FINANCE_AUDIT_TOTAL="$(extract_total <<<"$response")"

  if [[ "$EXPECT_FINANCE_AUDIT" == "1" && "$FINANCE_AUDIT_TOTAL" -lt 1 ]]; then
    append_result "AUDIT" "finance admin logs" "failed" "expected finance audit logs after CSV export"
    exit 1
  fi
  append_result "AUDIT" "finance admin logs" "passed" "total=$FINANCE_AUDIT_TOTAL"
}

main() {
  require_bin curl
  require_bin jq
  require_bin python3
  require_bin go

  local admin_token non_admin_token
  admin_token="$(login_token "$ADMIN_PHONE")"
  append_result "AUTH" "admin login" "passed" "$ADMIN_PHONE"

  non_admin_token="$(login_token "$NON_ADMIN_PHONE")"
  append_result "AUTH" "non-admin login" "passed" "$NON_ADMIN_PHONE"

  verify_admin_finance "$admin_token"
  verify_finance_audit_logs "$admin_token"
  assert_bad_request "$admin_token" "/settlement/admin/export/settlements?start_date=bad-date" "invalid settlement export date"
  assert_forbidden "$non_admin_token" "/settlement/admin/export/settlements?limit=1" "non-admin settlement export"
  assert_forbidden "$non_admin_token" "/settlement/admin/withdrawals?page=1&page_size=1" "non-admin withdrawal list"

  append_result "DONE" "admin finance smoke" "passed" "report=$REPORT_FILE"
}

main "$@"
