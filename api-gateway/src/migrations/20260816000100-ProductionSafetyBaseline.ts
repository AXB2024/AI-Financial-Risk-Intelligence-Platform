import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionSafetyBaseline20260816000100 implements MigrationInterface {
  name = 'ProductionSafetyBaseline20260816000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await queryRunner.query(`
      ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash varchar(255) NOT NULL UNIQUE,
        token_family varchar(80) NOT NULL,
        replaced_by_token_hash varchar(255),
        reused_at timestamp,
        revoked_at timestamp,
        expires_at timestamp NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS api_keys
        ALTER COLUMN key_hash TYPE varchar(255),
        ADD COLUMN IF NOT EXISTS key_last_four varchar(4),
        ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 120
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS audit_logs
        ADD COLUMN IF NOT EXISTS api_key_id varchar(36),
        ADD COLUMN IF NOT EXISTS actor_type varchar(20) NOT NULL DEFAULT 'user'
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS risk_results
        ALTER COLUMN var_95 TYPE numeric(28,10),
        ALTER COLUMN volatility TYPE numeric(28,10),
        ALTER COLUMN expected_shortfall TYPE numeric(28,10),
        ALTER COLUMN portfolio_value TYPE numeric(28,10),
        ALTER COLUMN anomaly_score TYPE numeric(28,10),
        ALTER COLUMN anomaly_z_score TYPE numeric(28,10)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS portfolio_assets
        ALTER COLUMN weight TYPE numeric(28,10),
        ALTER COLUMN quantity TYPE numeric(28,10)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS position_ledger
        ALTER COLUMN quantity TYPE numeric(28,10),
        ALTER COLUMN market_value TYPE numeric(28,10)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS transaction_ledger
        ALTER COLUMN quantity TYPE numeric(28,10),
        ALTER COLUMN amount TYPE numeric(28,10)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS reconciliation_breaks
        ALTER COLUMN internal_quantity TYPE numeric(28,10),
        ALTER COLUMN custodian_quantity TYPE numeric(28,10),
        ALTER COLUMN difference_quantity TYPE numeric(28,10)
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS corporate_actions
        ALTER COLUMN ratio TYPE numeric(28,10),
        ALTER COLUMN cash_amount TYPE numeric(28,10)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_current_tenant_id()
      RETURNS uuid AS $$
        SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
      $$ LANGUAGE sql STABLE
    `);

    for (const table of [
      'portfolios',
      'risk_results',
      'api_keys',
      'integrations',
      'report_templates',
      'scheduled_exports',
      'position_ledger',
      'transaction_ledger',
      'ingestion_runs',
      'quarantine_records',
      'reconciliation_runs',
      'reconciliation_breaks',
    ]) {
      await queryRunner.query(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE IF EXISTS ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF to_regclass('${table}') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = '${table}' AND policyname = '${table}_tenant_isolation'
          ) THEN
            EXECUTE 'CREATE POLICY ${table}_tenant_isolation ON ${table}
              USING (tenant_id = app_current_tenant_id())
              WITH CHECK (tenant_id = app_current_tenant_id())';
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'portfolios',
      'risk_results',
      'api_keys',
      'integrations',
      'report_templates',
      'scheduled_exports',
      'position_ledger',
      'transaction_ledger',
      'ingestion_runs',
      'quarantine_records',
      'reconciliation_runs',
      'reconciliation_breaks',
    ]) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table}`);
      await queryRunner.query(`ALTER TABLE IF EXISTS ${table} DISABLE ROW LEVEL SECURITY`);
    }
    await queryRunner.query('DROP TABLE IF EXISTS refresh_tokens');
    await queryRunner.query('DROP FUNCTION IF EXISTS app_current_tenant_id');
  }
}
