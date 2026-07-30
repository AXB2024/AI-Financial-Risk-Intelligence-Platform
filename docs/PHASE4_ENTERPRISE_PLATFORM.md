# Phase 4 Enterprise Platform

Phase 4 adds the platform layer needed for enterprise SaaS: tenants, isolation, white-label configuration, public APIs, developer credentials, integrations, and scheduled reporting.

## 1. Multi-Tenant Architecture

Business value: sell to firms, funds, advisory teams, and enterprise departments instead of only individual users.

Architecture:
- `tenants` is the enterprise account boundary.
- `tenant_memberships` maps users to tenants with roles.
- JWTs include active `tenantId`, `tenantSlug`, and `tenantRole`.
- Tenant-owned tables carry `tenant_id`.

Database changes implemented:
- `tenants`
- `tenant_memberships`
- `tenant_branding`
- `api_keys`
- `integrations`
- `report_templates`
- `scheduled_exports`
- `tenant_id` on portfolios, risk results, and audit logs

Authentication and authorization:
- Email/password login still authenticates the user.
- Session creation selects the user's default tenant.
- Backend services scope portfolio and analysis access by `tenantId`.

API design:
- Existing product APIs remain for app compatibility.
- Enterprise APIs live under `/api/v1`.

Deployment and scaling:
- Start with shared API, worker, Redis, and Postgres.
- Offer dedicated schema/database tiers for regulated customers later.

Roadmap:
- Add tenant switcher.
- Add tenant invite acceptance flow.
- Add dedicated tenant deployment option.

## 2. Tenant Isolation

Business value: tenant isolation is required for enterprise procurement and security review.

Architecture:
- Application-level checks use `userId + tenantId`.
- Public API keys resolve directly to one tenant.
- Audit logs now include `tenant_id`.

Database recommendations:
- Add indexes:
  - `portfolios(tenant_id, updated_at)`
  - `risk_results(tenant_id, created_at)`
  - `audit_logs(tenant_id, created_at)`
  - `api_keys(key_hash)`

Authentication and authorization:
- Never trust `tenantId` from request bodies.
- Tenant context must come from JWT membership or API key lookup.

API design:
- App APIs use JWT tenant context.
- Public APIs use `x-api-key`.

Deployment and scaling:
- Use shared tenancy initially.
- Move strategic regulated customers to dedicated database or VPC deployments.

Roadmap:
- Add integration tests for cross-tenant denial.
- Add request-scoped DB tenant context.
- Enable PostgreSQL RLS.

## 3. Row-Level Security

Business value: RLS provides database-level defense if an application query is written incorrectly.

Recommended SQL:

```sql
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_portfolios
ON portfolios
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_risk_results
ON risk_results
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_audit_logs
ON audit_logs
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

Backend design:
- Before tenant-scoped queries, set transaction-local tenant context:

```sql
SET LOCAL app.current_tenant_id = '<tenant-id>';
```

Deployment note:
- Use caution with PgBouncer transaction pooling. Prefer transaction-local settings.

Roadmap:
- Replace `TYPEORM_SYNC=true` with migrations.
- Add RLS migration scripts.
- Add RLS regression tests.

## 4. White-Label Capabilities

Business value: partner firms can expose a branded risk portal to their own clients.

Architecture:
- Branding settings are stored per tenant in `tenant_branding`.
- Frontend loads `/api/v1/branding/current`.

API:
- `GET /api/v1/branding/current`
- `PATCH /api/v1/admin/branding`

Auth:
- All members can read branding.
- `owner` and `admin` can update branding.

Deployment:
- Store logos in S3 or equivalent object storage.
- Serve assets through CDN.
- Map custom domains to tenant slugs.

Roadmap:
- Add custom domain verification.
- Add branded email/report templates.
- Add tenant-specific legal disclaimers in exports.

## 5. Public REST APIs

Business value: enterprise customers can integrate risk intelligence into internal systems.

Architecture:
- Public APIs live under `/api/v1/public`.
- API keys are hashed at rest and scoped.

Implemented API:
- `GET /api/v1/public/portfolios`

Auth:
- Requires `x-api-key`.
- Requires scope `portfolios:read`.

Deployment:
- Add WAF and stricter rate limits on public APIs.
- Add API usage metering per tenant.

Roadmap:
- Add public analysis creation and status endpoints.
- Publish OpenAPI spec.
- Add SDKs.

## 6. Developer Platform

Business value: API keys and webhooks make the platform sticky because customers build workflows around it.

Implemented API:
- `POST /api/v1/developer/api-keys`
- `GET /api/v1/developer/api-keys`
- `DELETE /api/v1/developer/api-keys/:id`

Auth:
- `owner`, `admin`, and `developer` roles can manage API keys.

Roadmap:
- Add usage dashboard.
- Add webhook endpoint registration.
- Add webhook delivery worker.
- Add sandbox keys.

## 7. Third-Party Integrations

Business value: integrations reduce manual workflow friction and increase switching costs.

Architecture:
- Generic `integrations` table stores provider, category, status, external account, and metadata.
- Credentials are intentionally not stored in this first slice.

Implemented API:
- `GET /api/v1/integrations`
- `POST /api/v1/integrations`
- `POST /api/v1/integrations/:id/sync`

Auth:
- Admins manage integrations.
- Members can list integrations.

Roadmap:
- Add encrypted credential storage.
- Add provider registry.
- Add sync job table and worker.

## 8. Brokerage Integrations

Business value: customers can import real holdings instead of manually creating portfolios.

Architecture:
- Brokerage providers plug into the generic integration model.
- Future normalized holdings tables should feed portfolio creation.

Recommended tables:
- `brokerage_accounts`
- `brokerage_holdings`
- `brokerage_sync_jobs`

Auth:
- OAuth tokens must be encrypted.
- Syncs must be tenant-scoped and audited.

Roadmap:
- Start with Plaid Investments or SnapTrade.
- Normalize holdings to portfolio snapshots.
- Add scheduled sync and drift alerts.

## 9. CRM Integrations

Business value: advisors and enterprise teams can push risk summaries into client workflows.

Architecture:
- CRM providers use `integrations` with category `crm`.
- Add mapping table later for external CRM object IDs.

Recommended table:
- `crm_mappings`

API roadmap:
- `POST /api/v1/crm/connect/:provider`
- `POST /api/v1/crm/mappings`
- `POST /api/v1/crm/sync-risk-summary`

Deployment:
- Queue CRM syncs and respect provider rate limits.

## 10. Reporting and Scheduled Exports

Business value: recurring exports support investment committee, compliance, and client reporting workflows.

Architecture:
- `report_templates` define what to generate.
- `scheduled_exports` define cadence and destination.
- Actual report generation should run in workers.

Implemented API:
- `POST /api/v1/reports/templates`
- `GET /api/v1/reports/templates`
- `POST /api/v1/reports/schedules`
- `GET /api/v1/reports/schedules`

Auth:
- `owner`, `admin`, and `analyst` can create templates and schedules.

Roadmap:
- Add report run records.
- Generate PDF/CSV artifacts.
- Store exports in S3 with signed URLs.
- Add email, S3, webhook, CRM, and SharePoint destinations.

## Current Implementation

Built in this phase:
- Tenant and membership model.
- Tenant creation during registration.
- Tenant-aware JWT/session context.
- Tenant-scoped portfolios, analyses, and audit logs.
- White-label branding storage and APIs.
- Hashed/scoped API keys.
- Public REST portfolio API.
- Generic integrations scaffold.
- Report template and scheduled export scaffold.
- Frontend tenant context display.

Recommended next engineering step:
- Convert all schema changes into explicit migrations and then disable `TYPEORM_SYNC` outside local development.
