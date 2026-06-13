# Deploy the scheduler on Render

Production API (`alhabeed-api.vercel.app`) is serverless and cannot run crontab. The **alhabeed-scheduler** worker runs the same Django code with a system crontab inside the container.

| Job | Schedule | Command |
|-----|----------|---------|
| Live score sync | Every 15 min | `python manage.py sync_live_scores` |
| Kickoff reminders | Every 5 min | `python manage.py send_match_reminders` |

Crontab file: `backend/cron/crontab`

## One-time setup (~5 minutes)

### 1. Connect the Blueprint

1. Open [Render Dashboard → Blueprints](https://dashboard.render.com/blueprints)
2. Click **New Blueprint Instance**
3. Connect the **Amr-Hash/alhabeed** GitHub repository
4. Render reads `render.yaml` from the repo root
5. Click **Apply**

This creates **alhabeed-scheduler** (worker, Starter plan ~$7/mo) and optionally **alhabeed-backend** (web). If your API is already on Vercel, suspend or delete **alhabeed-backend** in Render to avoid a duplicate API.

### 2. Set required environment variables

Open **alhabeed-scheduler → Environment** and set:

| Variable | Where to copy it from |
|----------|------------------------|
| `DATABASE_URL` | Vercel **alhabeed-api** project → Settings → Environment Variables (Neon pooled URL) |
| `FOOTBALL_DATA_API_TOKEN` | Same Vercel project (football-data.org token) |

Optional (for Web Push reminders):

| Variable | Notes |
|----------|--------|
| `VAPID_PUBLIC_KEY` | Same as Vercel API |
| `VAPID_PRIVATE_KEY` | Same as Vercel API |

`SECRET_KEY` and `JWT_SECRET` are auto-generated on Render; they do not need to match Vercel for scheduled jobs.

### 3. Deploy

Click **Manual Deploy → Deploy latest commit** (or push to `main` — auto-deploy is enabled).

### 4. Verify

1. Open **alhabeed-scheduler → Logs**
2. Look for: `Starting Django scheduler (live scores every 15 min, reminders every 5 min).`
3. Within 15 minutes you should see `sync_live_scores` output in the logs
4. In admin → Live scores, check that sync window / health looks correct

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Worker exits immediately | Check logs for Django/DB errors; confirm `DATABASE_URL` is set |
| Live scores never update | Set `FOOTBALL_DATA_API_TOKEN`; confirm tournament uses **football-data.org** provider |
| Reminders not sent | Set VAPID keys; confirm users subscribed to tournaments |
| `alhabeed-backend` also running | Suspend it if you use Vercel for the API |

## Local alternative

```bash
docker compose up --build
```

Starts `backend` + `scheduler` against local Postgres.
