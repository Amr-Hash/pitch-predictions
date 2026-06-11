# World Cup Prediction Competition Platform

A full-stack web application where users compete by predicting football match results during a World Cup-style tournament. Built with Django REST Framework, Next.js, PostgreSQL, and JWT authentication.

## Features

- User registration, login, and password reset
- Private prediction groups with invite codes/links
- Stage-by-stage prediction locking and progression rules
- Automatic scoring (exact score, goal difference, outcome, knockout winner bonus)
- Group and global leaderboards
- Admin panel for tournament, team, match, and result management
- OpenAPI/Swagger documentation at `/api/docs/`

## Tournament Structure (2026 format)

Knockout stages follow the expanded World Cup bracket:

1. Group Stage (Day 1–3)
2. **Round of 32** — 32 teams, 16 matches
3. Round of 16
4. Quarter Finals
5. Semi Finals
6. Third Place Match
7. Final

Stage progression rules apply in order: predictions for Round of 32 must be complete before Round of 16 unlocks.

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
| **App (frontend)** | https://worldcup-predictions-phi.vercel.app |
| **Backend API** | https://worldcup-predictions-api.vercel.app |
| **Django Admin** | https://worldcup-predictions-api.vercel.app/admin/ |

The frontend proxies `/api/*` to the backend using Next.js rewrites. Use the backend URL directly for Django admin (sessions and CSRF do not work reliably through the frontend proxy).

### Finish database setup (required)

1. Open [Vercel Storage → Neon](https://vercel.com/amr-hashem/worldcup-predictions-api/stores) and create a Postgres database for **worldcup-predictions-api**
2. Redeploy the backend: `cd backend && npx vercel deploy --prod`
3. Seed data locally:
   ```bash
   cd backend
   npx vercel env pull .env.local
   pip install -r requirements.txt
   python manage.py seed_data
   ```

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

**Demo accounts** (seeded automatically on deploy):
- Admin: `admin@worldcup.com` or username `admin` / password `admin12345`
- Demo user: `demo@worldcup.com` / `demo12345`

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

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:

**On pull requests and pushes (tests only):**
1. Backend tests with 80% coverage threshold
2. Frontend lint, tests, and production build
3. Docker image builds for both services

**On push to `main`/`master` (after tests pass):**
1. Deploy backend to Vercel (`worldcup-predictions-api`)
2. Deploy frontend to Vercel (`worldcup-predictions`)

### One-time GitHub secret setup

Add this secret in **GitHub → Repository → Settings → Secrets and variables → Actions**:

| Secret | How to get it |
|--------|----------------|
| `VERCEL_TOKEN` | [Vercel Account Tokens](https://vercel.com/account/tokens) → Create Token |

Project and team IDs are already configured in the workflow file. No other secrets are required for deployment.

Pull requests run tests only — production deploys happen when code is merged to `main`.

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
