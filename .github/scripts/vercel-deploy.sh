#!/usr/bin/env bash
set -euo pipefail

# Deploy to Vercel production, point the stable alias at the new deployment,
# and verify the alias serves this commit.
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, PRODUCTION_ALIAS
# Optional: GITHUB_SHA, GITHUB_OUTPUT

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN is not set."
  exit 1
fi

if [ -z "${PRODUCTION_ALIAS:-}" ]; then
  echo "PRODUCTION_ALIAS is not set."
  exit 1
fi

GIT_SHA="${GITHUB_SHA:-${GIT_SHA:-}}"
DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT

DEPLOY_ARGS=(deploy --prod --yes --token "$VERCEL_TOKEN")
if [ -n "$GIT_SHA" ]; then
  DEPLOY_ARGS+=(--env "GIT_SHA=${GIT_SHA}")
  DEPLOY_ARGS+=(--build-env "NEXT_PUBLIC_BUILD_SHA=${GIT_SHA}")
fi

echo "Deploying to Vercel (production)${GIT_SHA:+ for commit ${GIT_SHA}}..."
if ! npx vercel@latest "${DEPLOY_ARGS[@]}" 2>&1 | tee "$DEPLOY_LOG"; then
  echo "Vercel deploy failed."
  exit 1
fi

extract_deploy_url() {
  local log_file=$1
  grep -Eo 'https://[a-zA-Z0-9._-]+\.vercel\.app' "$log_file" \
    | grep -v "${PRODUCTION_ALIAS}" \
    | tail -1
}

DEPLOY_URL="$(extract_deploy_url "$DEPLOY_LOG")"

if [ -z "$DEPLOY_URL" ]; then
  DEPLOY_URL="$(
    grep -Eo '"url"[[:space:]]*:[[:space:]]*"https://[^"]+\.vercel\.app"' "$DEPLOY_LOG" \
      | tail -1 \
      | sed -E 's/.*"url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
  )"
fi

if [ -z "$DEPLOY_URL" ]; then
  echo "Could not determine deployment URL from Vercel output:"
  cat "$DEPLOY_LOG"
  exit 1
fi

echo "Deployment URL: $DEPLOY_URL"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "deploy_url=${DEPLOY_URL}"
    echo "git_sha=${GIT_SHA}"
  } >> "$GITHUB_OUTPUT"
fi

echo "Pointing $PRODUCTION_ALIAS → $DEPLOY_URL"
npx vercel@latest alias set "$DEPLOY_URL" "$PRODUCTION_ALIAS" --token "$VERCEL_TOKEN"

read_git_sha() {
  local base_url=$1
  if [[ "$base_url" == *"alhabeed-api"* ]]; then
    curl -fsS "${base_url}/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('git_sha') or '')"
  else
    curl -fsS "${base_url}/api/build-info" | python3 -c "import sys,json; print(json.load(sys.stdin).get('git_sha') or '')"
  fi
}

wait_for_sha() {
  local base_url=$1
  local expected=$2
  local label=$3
  local i

  for i in $(seq 1 18); do
    actual="$(read_git_sha "$base_url" 2>/dev/null || true)"
    if [ -n "$expected" ] && [ "$actual" = "$expected" ]; then
      echo "${label} is serving commit ${expected}"
      return 0
    fi
    echo "Waiting for ${label} (attempt ${i}/18): got '${actual:-<empty>}' expected '${expected}'"
    sleep 10
  done

  echo "${label} did not serve commit ${expected} in time."
  return 1
}

if [[ "$PRODUCTION_ALIAS" == alhabeed-api.vercel.app ]]; then
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "https://${PRODUCTION_ALIAS}/api/health" || true)"
  echo "Health check: https://${PRODUCTION_ALIAS}/api/health → HTTP ${STATUS}"
  if [ "$STATUS" != "200" ]; then
    echo "Production API health check failed."
    exit 1
  fi
  if [ -n "$GIT_SHA" ]; then
    wait_for_sha "https://${DEPLOY_URL}" "$GIT_SHA" "Deployment URL"
    wait_for_sha "https://${PRODUCTION_ALIAS}" "$GIT_SHA" "Production alias"
  fi
else
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "https://${PRODUCTION_ALIAS}/" || true)"
  echo "Frontend check: https://${PRODUCTION_ALIAS}/ → HTTP ${STATUS}"
  if [ "$STATUS" != "200" ]; then
    echo "Production frontend check failed."
    exit 1
  fi
  if [ -n "$GIT_SHA" ]; then
    wait_for_sha "https://${DEPLOY_URL}" "$GIT_SHA" "Deployment URL"
    wait_for_sha "https://${PRODUCTION_ALIAS}" "$GIT_SHA" "Production alias"
  fi
fi

echo "Live alias updated: https://${PRODUCTION_ALIAS}"
