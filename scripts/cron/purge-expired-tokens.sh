#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cron.env.example
source "${SCRIPT_DIR}/cron.env"

curl -fsS -X GET \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${ALHABEED_API_URL}/api/cron/purge-expired-tokens"
