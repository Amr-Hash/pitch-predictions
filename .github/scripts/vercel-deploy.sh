#!/usr/bin/env bash
set -euo pipefail

# Deploy to Vercel production and point the stable alias at the new deployment.
# Requires: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, PRODUCTION_ALIAS

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN is not set. Skipping deployment."
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

DEPLOY_URL="$(grep -Eo 'https://[a-zA-Z0-9._-]+\.vercel\.app' "$DEPLOY_LOG" | tail -1)"
if [ -z "$DEPLOY_URL" ]; then
  echo "Could not determine deployment URL from Vercel output:"
  cat "$DEPLOY_LOG"
  exit 1
fi

echo "Deployment URL: $DEPLOY_URL"
echo "Pointing $PRODUCTION_ALIAS → $DEPLOY_URL"
npx vercel@latest alias set "$DEPLOY_URL" "$PRODUCTION_ALIAS" --token "$VERCEL_TOKEN" --yes

echo "Live alias updated: https://$PRODUCTION_ALIAS"
