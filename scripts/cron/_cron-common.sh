# Shared setup for Alhabeed cron scripts. Source from other scripts in this directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${CRON_ENV_FILE:-${SCRIPT_DIR}/cron.env}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
fi

: "${CRON_SECRET:?Set CRON_SECRET in cron.env or the environment}"

ALHABEED_API_URL="${ALHABEED_API_URL:-https://alhabeed-api.vercel.app}"

cron_call() {
  local path="$1"
  local url="${ALHABEED_API_URL%/}${path}"
  curl -sf -X GET -H "Authorization: Bearer ${CRON_SECRET}" "${url}"
}
