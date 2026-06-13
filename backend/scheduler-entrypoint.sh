#!/bin/bash
set -euo pipefail

# Pass container env vars to cron jobs.
env >> /etc/environment

if [ -f /etc/cron.d/alhabeed ]; then
  chmod 0644 /etc/cron.d/alhabeed
fi

echo "Starting Django scheduler (live scores every 15 min, reminders every 5 min)."
exec cron -f
