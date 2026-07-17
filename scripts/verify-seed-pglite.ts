import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { seedKnowledgeBase } from "./seed-postgres.mjs";

// Proves the seed process against an in-memory PostgreSQL: a fresh
// database is migrated and seeded, and a second seed run changes no
// row counts (idempotency).

const root = process.cwd();
const database = new PGlite();

const executor = {
  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<{ rows: Row[]; rowCount: number }> {
    const result = await database.query<Row>(
      sql,
      [...parameters]
    );
    return {
      rows: result.rows,
      rowCount: result.rows.length
    };
  }
};

const migrationDirectory = resolve(root, "migrations");
const migrations = (await readdir(migrationDirectory))
  .filter((filename) => filename.endsWith(".sql"))
  .sort();

await database.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    checksum_sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

for (const filename of migrations) {
  const sql = (await readFile(
    resolve(migrationDirectory, filename),
    "utf8"
  )).replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i, "");
  await database.exec(sql);
  await database.query(
    `INSERT INTO schema_migrations (filename, checksum_sha256)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
    [filename, "pglite-verify"]
  );
}

try {
  const first = await seedKnowledgeBase(executor);
  const second = await seedKnowledgeBase(executor);

  const stable =
    JSON.stringify(first.knowledgeItems) ===
      JSON.stringify(second.knowledgeItems) &&
    first.trustedSources === second.trustedSources &&
    first.embeddings === second.embeddings;

  if (!stable) {
    console.error(
      JSON.stringify(
        { status: "failed", reason: "seed is niet idempotent", first, second },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      { status: "ok", idempotent: true, ...second },
      null,
      2
    )
  );
} finally {
  await database.close();
}
