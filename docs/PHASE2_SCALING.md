# Phase 2 Scaling Architecture

Phase 2 shifts the platform from request/response ML execution to horizontally scalable, job-driven risk intelligence.

## 1. Scaling the API Gateway

Problem solved: synchronous ML calls tie up API workers and make user traffic sensitive to slow model execution.

Architecture: run multiple stateless NestJS API Gateway replicas behind a load balancer. Keep auth in JWT, move shared state to PostgreSQL and Redis, and make long-running work asynchronous.

Microservice changes:
- API Gateway: owns auth, portfolio APIs, analysis job creation, status reads, rate limiting, and cache lookups.
- ML Service: remains stateless and horizontally scalable.
- PostgreSQL: durable source of truth for users, portfolios, and analysis state.
- Redis: low-latency cache and future distributed queue backend.

API flow:
- `POST /analyses` creates a durable `risk_results` row with `pending` status.
- The API returns immediately with an analysis ID.
- A worker processes the ML calls and updates status to `completed` or `failed`.

Frontend communication: poll `GET /analyses/:id` every 1-2 seconds for Phase 2. Move to SSE or WebSockets when real-time monitoring becomes central.

Production cloud: AWS ALB + ECS Fargate or EKS for API Gateway replicas, CloudWatch logs, autoscaling on CPU, request count, and p95 latency.

## 2. Asynchronous ML Processing

Problem solved: users should not wait on VaR, anomaly, and lexicon-screen calls inside a single HTTP request.

Architecture: the gateway creates analysis records and enqueues background jobs. Workers execute ML calls, persist result snapshots, and mark jobs complete.

Microservice changes:
- API Gateway: new `/analyses` APIs.
- Worker: currently implemented in-process through `BackgroundJobService`; production should split this into a separate worker deployment.
- ML Service: no user session knowledge; accepts model payloads and returns model outputs.

API flow:
- `POST /analyses { portfolioId }`
- `GET /analyses/:id`
- `GET /portfolios/:id/analyses`

Frontend communication: polling is reliable and simple. Use exponential backoff after 30 seconds.

Production cloud: SQS or BullMQ on ElastiCache Redis for queues, separate ECS service for workers, autoscaling on queue depth.

## 3. Job Queues and Background Workers

Problem solved: traffic spikes should queue work instead of dropping requests or overloading ML services.

Architecture: durable job metadata lives in PostgreSQL. Queue transport should be Redis/BullMQ or SQS in production. Workers are independently scalable.

Microservice changes:
- API Gateway: enqueues jobs and serves status.
- Worker: claims jobs, retries failures, writes final status.
- ML Service: scales based on worker throughput.

API flow:
- Client creates analysis.
- Worker processes analysis out of band.
- Client reads status and result by analysis ID.

Frontend communication: polling now; SSE later for portfolio monitoring and alerts.

Production cloud: SQS with DLQ for maximum reliability, or ElastiCache Redis + BullMQ for lower latency and richer job controls.

## 4. Redis Caching

Problem solved: repeated analysis on identical portfolio inputs wastes model capacity.

Architecture: hash portfolio inputs and cache completed analysis payloads for a short TTL. The current implementation uses Redis when `REDIS_URL` exists and falls back to memory locally.

Microservice changes:
- API Gateway: `RedisCacheService` caches `risk:<inputHash>`.
- ML Service: no changes.
- PostgreSQL: still stores every user-visible analysis record.

API flow:
- `POST /analyses` checks cache.
- Cache hit: result is stored immediately as completed.
- Cache miss: background job runs ML.

Frontend communication: unchanged. Cached analyses can return `completed` immediately.

Production cloud: ElastiCache Redis cluster with encryption in transit, private subnets, reserved memory policy, and CloudWatch alarms.

## 5. Database Optimization

Problem solved: historical analyses and growing users can make portfolio and result queries slow.

Architecture: keep PostgreSQL as the transactional system. Add indexes around ownership, recency, status, and portfolio history.

Microservice changes:
- API Gateway: query by authenticated `user_id`.
- Worker: writes analysis status transitions.
- ML Service: no database access.

Recommended indexes:
- `portfolios(user_id, updated_at)`
- `risk_results(portfolio_id, created_at)`
- `risk_results(status, created_at)`
- `risk_results(input_hash)`

API flow: list endpoints should paginate as data grows.

Frontend communication: request paginated histories rather than loading all analyses.

Production cloud: Amazon RDS PostgreSQL or Aurora PostgreSQL, automated backups, read replica for analytics-heavy reads, Performance Insights enabled.

## 6. Connection Pooling

Problem solved: many API and worker replicas can exhaust PostgreSQL connections.

Architecture: each service has a bounded local pool; production should add PgBouncer or RDS Proxy between services and PostgreSQL.

Microservice changes:
- API Gateway: TypeORM pool settings are configurable with `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, and `DB_POOL_CONNECTION_TIMEOUT_MS`.
- Worker: use a smaller pool than the API.

API flow: unchanged.

Frontend communication: unchanged.

Production cloud: RDS Proxy for managed pooling, with separate credentials for API and worker roles.

## 7. Rate Limiting

Problem solved: free-tier abuse, accidental loops, and burst traffic can overload the gateway and ML workers.

Architecture: global Nest throttling protects the gateway. Production should use Redis-backed distributed rate limits and tier-aware limits.

Microservice changes:
- API Gateway: `@nestjs/throttler` is enabled globally.
- Worker: enforce queue quotas per user/tier before accepting analysis jobs.
- ML Service: protected by private networking; not public.

API flow: requests beyond limit return `429`.

Frontend communication: show retry messaging and avoid tight polling loops.

Production cloud: AWS WAF rate rules at the edge, API Gateway/ALB protection, Redis-backed application limits.

## 8. Load Balancing

Problem solved: single-node deployment creates downtime and poor traffic distribution.

Architecture: place API Gateway and ML Service behind internal/external load balancers. API is public through ALB; ML is private/internal.

Microservice changes:
- API Gateway: stateless replicas.
- ML Service: stateless replicas behind internal load balancer.
- Worker: no inbound traffic; pulls from queue.

API flow: clients hit ALB, ALB routes to API Gateway replicas.

Frontend communication: no change.

Production cloud: CloudFront for frontend, ALB for API, internal ALB or service discovery for ML, health checks on `/health`.

## 9. Real-Time Portfolio Monitoring

Problem solved: retention improves when users are notified about risk changes instead of manually rerunning analysis.

Architecture: scheduled monitor jobs enqueue analyses for watched portfolios, compare with prior results, and create alerts.

Microservice changes:
- API Gateway: watch settings and alert APIs.
- Worker: scheduled portfolio monitoring jobs.
- ML Service: handles increased scheduled workload.
- PostgreSQL: alert and watch setting tables in a later migration.

API flow:
- User enables monitoring.
- Scheduler enqueues analysis.
- Worker computes and compares results.
- Client reads alerts or receives stream events.

Frontend communication: start with polling alerts. Use SSE for one-way live status updates; WebSockets only when users need bidirectional collaboration.

Production cloud: EventBridge scheduled rules, SQS queue, worker autoscaling, SES for digest emails.

## 10. Portfolio Comparisons and Historical Backtesting

Problem solved: users need to understand what changed, not just see one analysis snapshot.

Architecture: persist each completed analysis snapshot, compare two analysis IDs, and provide backtest series based on historical return generation.

Microservice changes:
- API Gateway: comparison and backtest endpoints.
- Worker: stores full result snapshots.
- ML Service: can later add model-backed scenario simulation.

API flow:
- `GET /portfolios/:id/analyses`
- `GET /portfolios/:id/analyses/compare?from=<id>&to=<id>`
- `GET /portfolios/:id/backtest?periods=180`

Frontend communication: history list plus selected comparison/backtest views. Poll only for running analyses.

Production cloud: keep backtests asynchronous once they use real market data or longer time windows.

## Current Phase 2 Implementation

Implemented now:
- Async `POST /analyses` workflow.
- Pollable `GET /analyses/:id`.
- Analysis history.
- Analysis comparison.
- Backtesting endpoint.
- Redis-compatible cache with local fallback.
- Configurable worker concurrency and retry attempts.
- Configurable PostgreSQL pool.
- Global gateway rate limiting.

Next production hardening:
- Replace in-process background jobs with SQS or BullMQ workers.
- Add migrations instead of `TYPEORM_SYNC=true`.
- Add Redis-backed distributed rate limiting.
- Add PgBouncer/RDS Proxy.
- Add structured logs, traces, and metrics.
