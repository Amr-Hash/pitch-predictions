#!/usr/bin/env bash
# Trigger kickoff reminders (~1 hour before scheduled matches).
#
# No football-data.org usage. Run every 5 minutes so reminders land close to
# one hour before kickoff (see notifications/services/match_reminders.py).
set -euo pipefail

# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_cron-common.sh"

cron_call "${ALHABEED_REMINDERS_PATH:-/api/cron/send-match-reminders}"
