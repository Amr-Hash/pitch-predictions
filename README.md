# الهبيد (Al-Habeed)

A full-stack football prediction platform where users compete by predicting match results across any tournament — World Cup, domestic leagues, Champions League, and more. Built with Django REST Framework, Next.js, PostgreSQL, and JWT authentication.

## Features

- User registration, login, and password reset
- Private prediction groups with invite codes/links
- Stage-by-stage prediction locking and progression rules
- Automatic scoring (exact score, goal difference, outcome; knockout draws scored by advancing-team pick)
- Group and global leaderboards
- Admin panel for tournament, team, match, and result management
- OpenAPI/Swagger documentation at `/api/docs/`

## Tournament Structure (2026 format)

Knockout stages follow the expanded World Cup bracket:

1. Group Stage (filter by matchday 1–3)
2. **Round of 32** — 32 teams, 16 matches
3. Round of 16
4. Quarter Finals
5. Semi Finals
6. Third Place Match
7. Final

Stage progression rules apply in order: predictions for a round unlock after all games in the previous round have finished (users are not required to have predicted earlier rounds).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Django 5, Django REST Framework |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Database | PostgreSQL |
| Auth | JWT (Simple JWT) |
| Docs | drf-spectacular (OpenAPI/Swagger) |

## Production URLs (Vercel)

| Service | URL |
|---------|-----|
| **App (frontend)** | https://alhabeed.vercel.app |
| **Backend API** | https://alhabeed-api.vercel.app |
| **Django Admin** | https://alhabeed-api.vercel.app/admin/ |

**Important:** After creating Vercel projects, disable **Deployment Protection → Vercel Authentication** so public users can access `*.vercel.app` URLs without a Vercel account:

```bash
npx vercel project protection disable alhabeed --sso
npx vercel project protection disable alhabeed-api --sso
```

Legacy URL `/world-cup-groups` redirects to `/tournament-groups`.

The frontend proxies `/api/*` to the backend using Next.js rewrites. Use the backend URL directly for Django admin (sessions and CSRF do not work reliably through the frontend proxy).

### Finish database setup (required)

Production Postgres database name: **`alhabeed`** (renamed from Neon default `neondb`).

1. Open [Vercel Storage → Neon](https://vercel.com/amr-hashem/alhabeed-api/stores) for **alhabeed-api**
2. Ensure `DATABASE_URL` points to the `alhabeed` database (updated automatically after rename)
3. **Build-time:** `DATABASE_URL` must be available during the Vercel **build** (not only runtime). `backend/build.py` runs migrations on deploy; if the variable is missing at build, the deployment fails. Check `/api/health` for `migration_head_ok: true` after deploy.
4. To rename locally or on another host: `python manage.py rename_database --from neondb --to alhabeed`
5. Redeploy the backend after any `DATABASE_URL` change: `cd backend && npx vercel deploy --prod`

## Quick Start (Docker)

```bash
# Clone and start all services
docker compose up --build

# In another terminal, run migrations and seed data
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_data
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/api/docs/ |
| Django Admin | http://localhost:8000/admin/ |

**Admin account** (seeded automatically on deploy):
- `admin@alhabeed.com` or username `admin` / password `admin12345`

To remove legacy demo/test data from an existing database:

```bash
cd backend
python manage.py purge_demo_data --dry-run   # preview
python manage.py purge_demo_data
```

Removes **Demo Test Cup** (كأس التجربة), **Demo Predictors**, and users:
`demo`, `testuser`, `test309`, `signupfix`, `admin_worldcup_legacy`, `demo_worldcup_legacy`
(plus `demo@alhabeed.com`, `demo@worldcup.com`, `admin@worldcup.com`). The real admin (`admin@alhabeed.com`) is kept.

This runs automatically on each backend deploy (`build.py` after migrations).

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy env file and configure PostgreSQL
cp .env.example .env

python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`.

## Running Tests

```bash
# Backend (uses in-memory SQLite)
cd backend
coverage run --source='.' manage.py test --settings=worldcup.test_settings
coverage report

# Frontend
cd frontend
npm test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register |
| POST | `/api/auth/login/` | Login (email + password) |
| POST | `/api/auth/refresh/` | Refresh JWT |
| POST | `/api/auth/logout/` | Logout (blacklist refresh token) |
| GET/POST | `/api/groups/` | List/create groups |
| POST | `/api/groups/join/` | Join via invite code |
| GET | `/api/tournaments/` | List tournaments |
| GET | `/api/tournaments/matches/` | List matches |
| GET/POST | `/api/predictions/` | List/create predictions |
| PATCH | `/api/predictions/{id}/` | Update prediction |
| GET | `/api/leaderboards/group/{id}/` | Group leaderboard |
| GET | `/api/leaderboards/global/` | Global leaderboard |
| GET | `/api/dashboard/` | User dashboard |

Admin endpoints are under `/api/tournaments/admin/` (staff only).

## Scoring Rules

| Result | Points |
|--------|--------|
| Exact score | 5 |
| Correct goal difference | 3 |
| Correct outcome (win/draw/loss) | 1 |
| Knockout winner bonus (tied match) | +1 |

Only the highest base score applies; winner bonus is additive.

## Production Deployment

### 1. Database — Neon PostgreSQL

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the connection string (enable connection pooling)
3. Use the pooled connection URL as `DATABASE_URL`

### 2. Backend — Render

1. Connect your GitHub repository on [render.com](https://render.com)
2. Create a **Web Service** using the `backend/Dockerfile`
3. Set environment variables:

```
SECRET_KEY=<generate-a-strong-secret>
DEBUG=False
DATABASE_URL=<neon-pooled-connection-string>
ALLOWED_HOSTS=your-app.onrender.com
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app
JWT_SECRET=<generate-a-strong-jwt-secret>
```

4. Add a **Release Command**: `python manage.py migrate --noinput`
5. Deploy — Render provides HTTPS automatically

**Alternative: Railway** — Create a project, deploy from Docker, set the same env vars, and run migrations via Railway CLI or a release command.

### 3. Frontend — Vercel

1. Import the repository on [vercel.com](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variable:

```
NEXT_PUBLIC_API_URL=https://your-app.onrender.com
```

4. Deploy — Vercel auto-deploys on every push to `main`

### 4. Post-Deploy Setup

```bash
# Create superuser on Render shell or locally against Neon
python manage.py createsuperuser

# Seed tournament data
python manage.py seed_data
```

Access Django admin at `https://your-app.onrender.com/admin/` to manage tournaments, teams, matches, and results.

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for dev, `False` for production |
| `DATABASE_URL` | PostgreSQL connection string |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend URLs |
| `JWT_SECRET` | JWT signing key |

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

## CI/CD

GitHub Actions runs on every push and pull request:

**CI/CD** (`.github/workflows/ci.yml`) — required on every push/PR:
1. Backend tests with 80% coverage threshold
2. Frontend lint, tests, and production build

**Deploy** (`.github/workflows/deploy.yml`) — runs after CI succeeds on `main`/`master`, or manually via **Actions → Deploy → Run workflow**:
1. Deploy backend to Vercel and alias `alhabeed-api.vercel.app`
2. Deploy frontend to Vercel and alias `alhabeed.vercel.app`

If `VERCEL_TOKEN` is missing or expired, **CI still passes** but deploy fails. Refresh the token with:

```bash
# Option A: sync from local Vercel CLI login (if it uses a classic token)
node scripts/sync-vercel-ci-secret.mjs

# Option B: paste a new classic token from https://vercel.com/account/tokens
VERCEL_TOKEN=<token> node scripts/sync-vercel-ci-secret.mjs
```

After each deploy, CI verifies that `alhabeed-api.vercel.app` and `alhabeed.vercel.app` serve the **same git commit** as the push (`/api/health` and `/api/build-info` return `git_sha`).

### One-time GitHub secret setup

Add this secret in **GitHub → Repository → Settings → Secrets and variables → Actions**:

| Secret | How to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [Vercel Account Tokens](https://vercel.com/account/tokens) → Create Token |

Project and team IDs are already configured in the workflow file. No other secrets are required for deployment.

```bash
# After creating a classic token at https://vercel.com/account/tokens:
VERCEL_TOKEN=<token> node scripts/sync-vercel-ci-secret.mjs
```

Pull requests run tests only — production deploys run from the **Deploy** workflow after CI passes on `main`.
You can also trigger deploy manually from **Actions → Deploy → Run workflow**.

### World Cup live score sync (API-Football)

Add these environment variables on the **alhabeed-api** Vercel project:

| Variable | Purpose |
|----------|---------|
| `API_FOOTBALL_KEY` | Key from [api-football.com](https://www.api-football.com/) |
| `CRON_SECRET` | Random secret; Vercel Cron sends `Authorization: Bearer …` |
| `LIVE_SCORE_SYNC_START` | Optional; ISO date e.g. `2026-06-11` |
| `LIVE_SCORE_SYNC_END` | Optional; ISO date e.g. `2026-06-28` (group stage) |

After deploy:

1. Set `CRON_SECRET` in GitHub Actions secrets (same value as on Vercel).
2. Run `python manage.py map_wc2026_fixtures` once against production (maps 72 group fixtures).
3. GitHub Actions (`.github/workflows/live-score-sync.yml`) calls `/api/cron/sync-live-scores` every 5 minutes. On Vercel Pro you can instead add a `crons` entry in `backend/vercel.json` with `*/2 * * * *`.
4. Admin can still use **Sync live scores now** on the tournaments page.

Live scores update match `status` and display scores; prediction points are awarded only when a match reaches `finished`.

## Project Structure

```
├── backend/
│   ├── accounts/          # User auth & JWT
│   ├── groups/            # Prediction groups
│   ├── tournaments/       # Tournaments, stages, teams, matches
│   ├── predictions/       # Predictions, scoring, leaderboards
│   └── worldcup/          # Django project settings
├── frontend/
│   └── src/
│       ├── app/           # Next.js pages
│       ├── components/    # React components
│       └── lib/           # API client & auth
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## License

MIT
