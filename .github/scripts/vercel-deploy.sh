#!/usr/bin/env bash
set -euo pipefail

# Deploy to Vercel production and point the stable alias at the new deployment.
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, PRODUCTION_ALIAS

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN is not set."
  exit 1
fi

if [ -z "${PRODUCTION_ALIAS:-}" ]; then
  echo "PRODUCTION_ALIAS is not set."
  exit 1
fi

DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT

echo "Deploying to Vercel (production)..."
if ! npx vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN" 2>&1 | tee "$DEPLOY_LOG"; then
  echo "Vercel deploy failed."
  exit 1
fi

DEPLOY_URL="$(
  grep -Eo '"url"[[:space:]]*:[[:space:]]*"https://[^"]+\.vercel\.app"' "$DEPLOY_LOG" \
    | tail -1 \
    | sed -E 's/.*"url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
)"

if [ -z "$DEPLOY_URL" ]; then
  DEPLOY_URL="$(grep -Eo 'https://[a-zA-Z0-9._-]+-amr-hashem\.vercel\.app' "$DEPLOY_LOG" | tail -1)"
fi

if [ -z "$DEPLOY_URL" ]; then
  echo "Could not determine deployment URL from Vercel output:"
  cat "$DEPLOY_LOG"
  exit 1
fi

echo "Deployment URL: $DEPLOY_URL"
echo "Pointing $PRODUCTION_ALIAS → $DEPLOY_URL"
npx vercel@latest alias set "$DEPLOY_URL" "$PRODUCTION_ALIAS" --token "$VERCEL_TOKEN"

echo "Waiting for alias propagation..."
sleep 8

if [[ "$PRODUCTION_ALIAS" == alhabeed-api.vercel.app ]]; then
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "https://${PRODUCTION_ALIAS}/api/health" || true)"
  echo "Health check: https://${PRODUCTION_ALIAS}/api/health → HTTP ${STATUS}"
  if [ "$STATUS" != "200" ]; then
    echo "Production API health check failed."
    exit 1
  fi
else
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "https://${PRODUCTION_ALIAS}/" || true)"
  echo "Frontend check: https://${PRODUCTION_ALIAS}/ → HTTP ${STATUS}"
  if [ "$STATUS" != "200" ]; then
    echo "Production frontend check failed."
    exit 1
  fi
fi

echo "Live alias updated: https://${PRODUCTION_ALIAS}"
