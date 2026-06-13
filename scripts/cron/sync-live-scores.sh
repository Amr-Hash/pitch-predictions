#!/usr/bin/env bash
# Trigger production live score sync (football-data.org → Alhabeed API).
#
# Install on any always-on Linux/macOS host with crontab (see crontab.example).
# The API only calls football-data.org when matches are in the sync window,
# so a 15-minute schedule keeps the free-tier quota low.
set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_cron-common.sh"

cron_call "${ALHABEED_SYNC_PATH:-/api/cron/sync-live-scores}"
