#!/usr/bin/env bash
#
# Travelog MVP1 — post-deployment smoke test.
#
# Usage:
#   ./scripts/smoke-test.sh [BASE_URL] [PHOTO_FOLDER]
#
#   BASE_URL      base URL of the API (default: http://localhost:3000/api)
#   PHOTO_FOLDER  optional folder to scan (relative to the configured photo
#                 root). If provided, a scan is started and polled until it
#                 reaches a terminal state.
#
# Exit codes: 0 = all checks passed, 1 = failure.

set -euo pipefail

BASE_URL="${1:-http://localhost:3000/api}"
PHOTO_FOLDER="${2-}"

fail() {
    echo "❌ $1" >&2
    exit 1
}

get() {
    curl -fsS -m 15 "$BASE_URL$1"
}

echo "========================================================"
echo " Travelog — Smoke test"
echo " Target: $BASE_URL"
echo "========================================================"
echo ""

# 1. Health
HEALTH=$(get /health || fail "GET /health failed — is the backend running on $BASE_URL?")
echo "$HEALTH" | grep -q "status" || fail "Unexpected /health response: $HEALTH"
echo "✅ Health: $HEALTH"

# 2. Settings
SETTINGS=$(get /settings || fail "GET /settings failed")
echo "$SETTINGS" | grep -q "minimumConsecutiveDaysWithPhotos" \
    || fail "Unexpected /settings payload: $SETTINGS"
echo "✅ Settings reachable"

# 3. Trips list
TRIPS=$(get "/trips?search=" || fail "GET /trips failed")
echo "$TRIPS" | grep -q "items" || fail "Unexpected /trips payload: $TRIPS"
TRIP_COUNT=$(echo "$TRIPS" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2 || echo "?")
echo "✅ Trips list reachable (${TRIP_COUNT:-?} trips)"

# 4. Optional scan smoke test (runs when the argument is provided, even if empty)
if [[ ${PHOTO_FOLDER+x} ]]; then
    echo ""
    echo "▶ Starting scan of folder '$PHOTO_FOLDER'…"
    BODY="{\"folder\":\"$PHOTO_FOLDER\"}"
    SCAN=$(curl -fsS -m 15 -X POST -H "Content-Type: application/json" -d "$BODY" "$BASE_URL/scans") \
        || fail "POST /scans failed"
    SCAN_ID=$(echo "$SCAN" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    [[ -n "$SCAN_ID" ]] || fail "Could not read scan id from: $SCAN"
    echo "  Scan id: $SCAN_ID"

    for _ in $(seq 1 600); do
        STATUS_JSON=$(get "/scans/$SCAN_ID" || fail "GET /scans/$SCAN_ID failed")
        STATUS=$(echo "$STATUS_JSON" | grep -o '"status":"[a-z_]*"' | head -1 | cut -d'"' -f4)
        case "$STATUS" in
            completed|completed_with_errors|failed|stopped)
                break ;;
        esac
        sleep 1
    done

    [[ -n "$STATUS" ]] || fail "Scan did not reach a terminal state within timeout"
    echo "$STATUS_JSON" | grep -q "filesAnalyzed" || fail "Unexpected scan payload: $STATUS_JSON"
    echo "✅ Scan finished with status: $STATUS"
    echo "   $STATUS_JSON"

    if [[ "$STATUS" == "failed" ]]; then
        fail "Scan ended with status 'failed'"
    fi
else
    echo ""
    echo "ℹ️  Skipped scan smoke test (no PHOTO_FOLDER supplied)"
fi

echo ""
echo "✅ Smoke test passed."
