import {
  Pool,
  type PoolConfig
} from "pg";
import type {
  SqlExecutor,
  SqlQueryResult
} from "@door010/database";

export class PgSqlExecutor implements SqlExecutor {
  readonly pool: Pool;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
  }

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<SqlQueryResult<Row>> {
    const result = await this.pool.query(
      sql,
      parameters as unknown[]
    );
    return {
      rows: result.rows as Row[],
      rowCount: result.rowCount ?? result.rows.length
    };
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.pool.query<{ ok: number }>(
      "SELECT 1 AS ok"
    );
    return result.rows[0]?.ok === 1;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgExecutorFromEnvironment(): PgSqlExecutor {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required when APP_STORAGE_MODE=postgres."
    );
  }

  return new PgSqlExecutor({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(
      process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000
    ),
    ssl: process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined
  });
}
