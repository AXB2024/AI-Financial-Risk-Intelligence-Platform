# AI Financial Risk & Intelligence Platform

Microservices platform for portfolio risk analytics and intelligence.

## Stack

- Frontend: React + TypeScript (Vite, Tailwind, Recharts)
- API Gateway: NestJS + TypeORM
- ML Service: FastAPI (VaR, anomaly, sentiment)
- Database: PostgreSQL

## Architecture

```text
React Frontend (http://localhost:5173)
        |
        v
NestJS API Gateway (http://localhost:4000)
        |
        v
FastAPI ML Service (http://localhost:8000)
        |
        v
PostgreSQL (localhost:5432)
```

Flow: `React -> API Gateway -> ML Service -> API Gateway -> React`

## Endpoints

### API Gateway
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /portfolio` (requires JWT)
- `GET /portfolios` (requires JWT)
- `GET /portfolios/:id` (requires JWT)
- `GET /risk/:id` (requires JWT)
- `POST /analyses` (requires JWT)
- `GET /analyses/:id` (requires JWT)
- `GET /portfolios/:id/analyses` (requires JWT)
- `GET /portfolios/:id/analyses/compare` (requires JWT)
- `GET /portfolios/:id/backtest` (requires JWT)
- `GET /api/v1/tenants` (requires JWT)
- `GET /api/v1/branding/current` (requires JWT)
- `PATCH /api/v1/admin/branding` (requires JWT, tenant admin)
- `GET /api/v1/admin/members` (requires JWT, tenant admin)
- `POST /api/v1/admin/members` (requires JWT, tenant admin)
- `POST /api/v1/developer/api-keys` (requires JWT, developer access)
- `GET /api/v1/developer/api-keys` (requires JWT, developer access)
- `DELETE /api/v1/developer/api-keys/:id` (requires JWT, developer access)
- `GET /api/v1/public/portfolios` (requires `x-api-key`)
- `GET /api/v1/integrations` (requires JWT)
- `POST /api/v1/integrations` (requires JWT, tenant admin)
- `POST /api/v1/integrations/:id/sync` (requires JWT, tenant admin)
- `POST /api/v1/reports/templates` (requires JWT, analyst access)
- `GET /api/v1/reports/templates` (requires JWT)
- `POST /api/v1/reports/schedules` (requires JWT, analyst access)
- `GET /api/v1/reports/schedules` (requires JWT)

### ML Service
- `GET /`
- `GET /health`
- `GET /docs`
- `POST /risk`
- `POST /anomaly`
- `POST /sentiment`
- `POST /advanced-risk`
- `POST /regime`
- `POST /optimize`
- `POST /financial-sentiment`

## Local Setup (macOS, No Docker)

### 1) Install and start PostgreSQL

```bash
brew update
brew install postgresql@16
brew services start postgresql@16
brew services list | grep postgresql
```

### 2) Create DB user and database

```bash
psql postgres
```

```sql
CREATE ROLE postgres WITH LOGIN PASSWORD 'postgres';
CREATE DATABASE finance_db OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE finance_db TO postgres;
\q
```

If the `postgres` role already exists, just run:

```sql
ALTER USER postgres WITH PASSWORD 'postgres';
```

### 3) Configure environment variables

`api-gateway/.env`

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=finance_db
DB_RETRY_ATTEMPTS=8
DB_RETRY_DELAY=3000
DB_LOGGING=true
ML_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173
TYPEORM_SYNC=true
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
REDIS_URL=redis://localhost:6379
JOB_WORKER_CONCURRENCY=2
JOB_MAX_ATTEMPTS=3
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_MAX=120
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
```

`frontend/.env`

```env
VITE_API_URL=http://localhost:4000
```

### 4) Run ML service

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 5) Run API Gateway

```bash
cd api-gateway
npm install
npm run start:dev
```

The gateway reads DB config from env via `ConfigService` in [database.config.ts](/Users/abhinavbinu/AI-Financial-Risk-Intelligence-Platform/AI-Financial-Risk-Intelligence-Platform/api-gateway/src/config/database.config.ts).

### 6) Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Authentication Guide

The platform uses email/password authentication with JWT access tokens.

Current Phase 1 behavior:

- Users register or log in through the React frontend.
- The API Gateway returns a JWT access token.
- The frontend stores the token in `localStorage`.
- Protected API requests send the token with `Authorization: Bearer <token>`.
- Portfolios are scoped to the authenticated user.

### Required environment variables

Add these to `api-gateway/.env`:

```env
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
```

For local development, any long random string works for `JWT_SECRET`.
For production, store it in your deployment secret manager and rotate it carefully.

### Register a user

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo User",
    "email": "demo@example.com",
    "password": "password123"
  }'
```

Response:

```json
{
  "user": {
    "id": "user-id",
    "email": "demo@example.com",
    "name": "Demo User",
    "tier": "free"
  },
  "accessToken": "jwt-token"
}
```

### Log in

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "password123"
  }'
```

### Verify the current user

```bash
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### Use protected portfolio endpoints

Create portfolio:

```bash
curl -X POST http://localhost:4000/portfolio \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d @data/sample-portfolio.json
```

List saved portfolios:

```bash
curl http://localhost:4000/portfolios \
  -H "Authorization: Bearer <accessToken>"
```

Get risk:

```bash
curl http://localhost:4000/risk/<portfolioId> \
  -H "Authorization: Bearer <accessToken>"
```

Create async analysis:

```bash
curl -X POST http://localhost:4000/analyses \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"portfolioId":"<portfolioId>"}'
```

Poll analysis status:

```bash
curl http://localhost:4000/analyses/<analysisId> \
  -H "Authorization: Bearer <accessToken>"
```

List analysis history:

```bash
curl http://localhost:4000/portfolios/<portfolioId>/analyses \
  -H "Authorization: Bearer <accessToken>"
```

Run a backtest:

```bash
curl "http://localhost:4000/portfolios/<portfolioId>/backtest?periods=180" \
  -H "Authorization: Bearer <accessToken>"
```

### Frontend auth flow

Open [http://localhost:5173](http://localhost:5173).

The app shows a login/register screen first. After authentication, users can:

- Create a portfolio and run analysis.
- See saved portfolios for their account.
- Rerun analysis for a saved portfolio.
- Log out from the dashboard header.

## Phase 2 Scaling

Phase 2 adds asynchronous analysis processing, analysis history, comparison APIs, backtesting, Redis-compatible caching, gateway rate limiting, and database pool configuration.

See [PHASE2_SCALING.md](/Users/abhinavbinu/AI-Financial-Risk-Intelligence-Platform/AI-Financial-Risk-Intelligence-Platform/docs/PHASE2_SCALING.md) for the production architecture guide.

## Phase 3 Premium Features

Phase 3 adds premium analytics designed for enterprise value: tail risk, market regime detection, portfolio optimization, finance-specific sentiment, audit logging, and API version metadata.

See [PHASE3_PREMIUM_FEATURES.md](/Users/abhinavbinu/AI-Financial-Risk-Intelligence-Platform/AI-Financial-Risk-Intelligence-Platform/docs/PHASE3_PREMIUM_FEATURES.md) for the feature architecture, ML model plan, security implications, and milestones.

## Phase 4 Enterprise Platform

Phase 4 adds the enterprise SaaS platform layer: tenants, tenant-scoped data, white-label branding, hashed API keys, public REST APIs, integration scaffolding, and scheduled report definitions.

See [PHASE4_ENTERPRISE_PLATFORM.md](/Users/abhinavbinu/AI-Financial-Risk-Intelligence-Platform/AI-Financial-Risk-Intelligence-Platform/docs/PHASE4_ENTERPRISE_PLATFORM.md) for the multi-tenant architecture, RLS guidance, API design, and implementation roadmap.

### Security notes

This is Phase 1 authentication, built for local development and PMF validation.
Before production, add refresh tokens in secure HttpOnly cookies, rate limiting on auth routes, OAuth providers, password reset, and stricter secret management.

## Common Local Errors

### `ECONNREFUSED 127.0.0.1:5432`
PostgreSQL is not running or not listening on port 5432.

Check:

```bash
brew services list | grep postgresql
lsof -iTCP:5432 -sTCP:LISTEN
```

### `ENOTFOUND postgres`
`DB_HOST=postgres` is Docker-only hostname. For local native run, use `DB_HOST=localhost`.

## Optional Cleanup (if you never want Docker)

From project root:

```bash
rm docker-compose.yml
rm frontend/Dockerfile
rm api-gateway/Dockerfile
rm ml-service/Dockerfile
```
