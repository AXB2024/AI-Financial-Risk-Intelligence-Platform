import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeyPrefixValidationPolicy20260816000200 implements MigrationInterface {
  name = 'ApiKeyPrefixValidationPolicy20260816000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('api_keys') IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'api_keys' AND policyname = 'api_keys_prefix_validation'
        ) THEN
          EXECUTE 'CREATE POLICY api_keys_prefix_validation ON api_keys
            FOR SELECT
            USING (key_prefix = current_setting(''app.api_key_prefix'', true))';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP POLICY IF EXISTS api_keys_prefix_validation ON api_keys');
  }
}
