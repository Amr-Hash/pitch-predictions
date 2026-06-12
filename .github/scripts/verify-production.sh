#!/usr/bin/env bash
# Local smoke test: production URLs respond and (when stamped) match a git SHA.
set -euo pipefail

EXPECTED_SHA="${1:-}"
API_URL="${PRODUCTION_API_URL:-https://alhabeed-api.vercel.app}"
FRONTEND_URL="${PRODUCTION_FRONTEND_URL:-https://alhabeed.vercel.app}"

api_sha="$(curl -fsS "${API_URL}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('git_sha') or '')")"
fe_sha="$(curl -fsS "${FRONTEND_URL}/api/build-info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('git_sha') or '')")"

echo "API git_sha: ${api_sha:-<empty>}"
echo "Frontend git_sha: ${fe_sha:-<empty>}"

if [ -n "$EXPECTED_SHA" ]; then
  test "$api_sha" = "$EXPECTED_SHA"
  test "$fe_sha" = "$EXPECTED_SHA"
fi

curl -fsS -o /dev/null -w "API health: %{http_code}\n" "${API_URL}/api/health"
curl -fsS -o /dev/null -w "Frontend home: %{http_code}\n" "${FRONTEND_URL}/"
echo "Production checks passed."
