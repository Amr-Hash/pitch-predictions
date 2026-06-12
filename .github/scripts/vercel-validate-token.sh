#!/usr/bin/env bash
set -euo pipefail

# Validate VERCEL_TOKEN for GitHub Actions deploys.
# Requires: VERCEL_TOKEN
# Optional: VERCEL_ORG_ID, VERCEL_TEAM_SLUG

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "::error::VERCEL_TOKEN is not set. Run: node scripts/sync-vercel-ci-secret.mjs"
  exit 1
fi

TEAM_SCOPE="${VERCEL_ORG_ID:-${VERCEL_TEAM_SLUG:-}}"

if ! USER="$(npx vercel@latest whoami --token "$VERCEL_TOKEN" 2>/dev/null | tail -n1)"; then
  echo "::error::VERCEL_TOKEN is invalid or expired."
  echo "Create a classic token at https://vercel.com/account/tokens (OAuth session tokens from the CLI may not work in CI)."
  echo "Then run: node scripts/sync-vercel-ci-secret.mjs"
  exit 1
fi

echo "Vercel token valid for: ${USER}"

if [ -n "$TEAM_SCOPE" ]; then
  if ! npx vercel@latest whoami --token "$VERCEL_TOKEN" --scope "$TEAM_SCOPE" >/dev/null 2>&1; then
    echo "::error::VERCEL_TOKEN cannot access team scope '${TEAM_SCOPE}'."
    echo "Create a new classic token at https://vercel.com/account/tokens while logged in as the team owner, then run:"
    echo "  node scripts/sync-vercel-ci-secret.mjs"
    exit 1
  fi
  echo "Team access verified for: ${TEAM_SCOPE}"
fi
