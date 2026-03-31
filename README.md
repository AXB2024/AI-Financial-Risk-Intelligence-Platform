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
- `POST /portfolio`
- `GET /risk/:id`

### ML Service
- `GET /`
- `GET /health`
- `GET /docs`
- `POST /risk`
- `POST /anomaly`
- `POST /sentiment`

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

The gateway reads DB config from env via `ConfigService` in [database.config.ts](/Users/abhinavbinu/Documents/Playground/ai-financial-risk-intelligence-platform/api-gateway/src/config/database.config.ts).

### 6) Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Quick API Test

Create portfolio:

```bash
curl -X POST http://localhost:4000/portfolio \
  -H "Content-Type: application/json" \
  -d @data/sample-portfolio.json
```

Get risk:

```bash
curl http://localhost:4000/risk/<portfolioId>
```

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
