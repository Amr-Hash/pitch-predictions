# Scheduled jobs via cron-job.org (free)

Production API: `https://alhabeed-api.vercel.app` (Vercel, serverless).

cron-job.org calls these endpoints on a schedule with `Authorization: Bearer <CRON_SECRET>`:

| Job | Schedule | URL |
|-----|----------|-----|
| Alhabeed Live Scores | Every 15 min | `/api/cron/sync-live-scores` |
| Alhabeed Match Reminders | Every 5 min | `/api/cron/send-match-reminders` |
| Alhabeed Background Jobs | Every 1 min | `/api/cron/process-jobs?limit=50` |

## One-time setup

```bash
# 1. cron-job.org API key → scripts/cron/cron-job-org.env
cp scripts/cron/cron-job-org.env.example scripts/cron/cron-job-org.env

# 2. Ensure CRON_SECRET on Vercel (generates scripts/cron/cron.env if missing)
VERCEL_TOKEN=... node scripts/cron/set-cron-secret-vercel.mjs

# Or add the same value as GitHub repo secret CRON_SECRET (Deploy workflow syncs it after push).

# 3. Redeploy API so CRON_SECRET is active (GitHub Deploy workflow or Vercel dashboard)

# 4. Register jobs on cron-job.org
node scripts/cron/setup-cron-job-org.mjs

# 5. Verify latest runs return HTTP 200
node scripts/cron/verify-cron-job-org.mjs
```

## Verify

1. [cron-job.org Console](https://console.cron-job.org/) → all three jobs enabled
2. Run **Run now** on a job → history should show HTTP **200**
3. If **401**, `CRON_SECRET` on Vercel does not match `scripts/cron/cron.env`

## Notes

- Free tier: 100 API requests/day to cron-job.org (job runs are separate).
- football-data.org is only called during match sync windows (see README).
- Do not commit `cron-job-org.env` or `cron.env`.
