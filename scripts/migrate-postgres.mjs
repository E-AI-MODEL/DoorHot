import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const MIGRATION_LOCK_ID = 10010;

function migrationChecksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export async function runMigrations(options = {}) {
  const connectionString =
    options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const migrationDirectory =
    options.migrationDirectory ??
    resolve(process.cwd(), "migrations");

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
  });

  const client = await pool.connect();

  try {
    await client.query(
      "SELECT pg_advisory_lock($1)",
      [MIGRATION_LOCK_ID]
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum_sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const filenames = (await readdir(migrationDirectory))
      .filter((filename) => /^\d+_.+\.sql$/.test(filename))
      .sort();

    for (const filename of filenames) {
      const sql = await readFile(
        resolve(migrationDirectory, filename),
        "utf8"
      );
      const checksum = migrationChecksum(sql);
      const existing = await client.query(
        `SELECT checksum_sha256
         FROM schema_migrations
         WHERE filename = $1`,
        [filename]
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0].checksum_sha256 !== checksum) {
          throw new Error(
            `Migration checksum mismatch: ${filename}`
          );
        }

        console.log(`SKIP ${filename}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (
             filename,
             checksum_sha256
           ) VALUES ($1, $2)`,
          [filename, checksum]
        );
        await client.query("COMMIT");
        console.log(`APPLY ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return {
      migrationCount: filenames.length,
      migrationDirectory
    };
  } finally {
    try {
      await client.query(
        "SELECT pg_advisory_unlock($1)",
        [MIGRATION_LOCK_ID]
      );
    } finally {
      client.release();
      await pool.end();
    }
  }
}

const isDirectExecution =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  runMigrations().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
