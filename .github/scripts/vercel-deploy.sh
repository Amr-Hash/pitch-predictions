#!/usr/bin/env bash
set -euo pipefail

# Deploy to Vercel production and point the stable alias at the new deployment.
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
IS_API=false
if [[ "${PRODUCTION_ALIAS}" == *"-api."* ]]; then
  IS_API=true
fi

DEPLOY_ARGS=(deploy --prod --yes --token "$VERCEL_TOKEN")
if [ -n "$GIT_SHA" ]; then
  DEPLOY_ARGS+=(--env "GIT_SHA=${GIT_SHA}")
  DEPLOY_ARGS+=(--build-env "NEXT_PUBLIC_BUILD_SHA=${GIT_SHA}")
fi

echo "Deploying to Vercel (production)${GIT_SHA:+ for commit ${GIT_SHA}}..."
DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT

if ! npx vercel@latest "${DEPLOY_ARGS[@]}" 2>&1 | tee "$DEPLOY_LOG"; then
  if grep -q "token provided via \`--token\` argument is not valid" "$DEPLOY_LOG"; then
    echo "::error::VERCEL_TOKEN is invalid or expired. Create a new token at https://vercel.com/account/tokens and update the GitHub Actions secret VERCEL_TOKEN, then re-run the workflow."
  fi
  echo "Vercel deploy failed."
  exit 1
fi

DEPLOY_URL="$(
  python3 - <<'PY' "$DEPLOY_LOG"
import json
import re
import sys

log_path = sys.argv[1]
text = open(log_path, encoding="utf-8", errors="replace").read()

for line in reversed(text.splitlines()):
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        continue
    url = data.get("url") or (data.get("deployment") or {}).get("url")
    if url:
        print(url if url.startswith("http") else f"https://{url}")
        raise SystemExit(0)

match = re.findall(
    r"Production\s+https://[a-z0-9]+-[a-z0-9]{6,}-[a-zA-Z0-9._-]+\.vercel\.app",
    text,
)
if match:
    print(match[-1].split()[-1])
PY
)"

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

echo "Pointing ${PRODUCTION_ALIAS} → ${DEPLOY_URL}"
npx vercel@latest alias set "$DEPLOY_URL" "$PRODUCTION_ALIAS" --token "$VERCEL_TOKEN"

read_git_sha() {
  local base_url=$1
  if $IS_API; then
    curl -fsS "${base_url}/api/health" \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('git_sha') or '')"
  else
    curl -fsS "${base_url}/api/build-info" \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('git_sha') or '')"
  fi
}

ALIAS_URL="https://${PRODUCTION_ALIAS}"
if [ -n "$GIT_SHA" ]; then
  for i in $(seq 1 6); do
    actual="$(read_git_sha "$ALIAS_URL" 2>/dev/null || true)"
    if [ "$actual" = "$GIT_SHA" ]; then
      echo "Production alias serves commit ${GIT_SHA}"
      break
    fi
    if [ "$i" = "6" ]; then
      echo "Production alias git_sha is '${actual:-<empty>}' expected '${GIT_SHA}'"
      exit 1
    fi
    echo "Waiting for alias (attempt ${i}/6)..."
    sleep 5
  done
else
  if $IS_API; then
    curl -fsS "${ALIAS_URL}/api/health" >/dev/null
  else
    curl -fsS "${ALIAS_URL}/" >/dev/null
  fi
fi

echo "Live: ${ALIAS_URL}"
