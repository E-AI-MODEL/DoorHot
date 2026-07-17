import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const migrationDirectory = resolve(root, "migrations");
const filenames = (await readdir(migrationDirectory))
  .filter((filename) => filename.endsWith(".sql"))
  .sort();

const database = new PGlite();
const results = [];

function normalizeForEmbeddedPostgres(sql) {
  return sql.replace(
    /CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i,
    ""
  );
}

try {
  for (const filename of filenames) {
    const originalSql = await readFile(
      resolve(migrationDirectory, filename),
      "utf8"
    );
    const sql = normalizeForEmbeddedPostgres(originalSql);
    const startedAt = Date.now();

    try {
      await database.exec(sql);
      results.push({
        filename,
        passed: true,
        durationMs: Date.now() - startedAt
      });
      console.log(`PASS ${filename}`);
    } catch (error) {
      results.push({
        filename,
        passed: false,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`FAIL ${filename}`);
      throw error;
    }
  }

  const tableResult = await database.query(`
    SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);

  const report = {
    passed: true,
    engine: "PGlite embedded PostgreSQL",
    compatibilityAdjustments: [
      "Skipped CREATE EXTENSION pgcrypto because PGlite ships gen_random_uuid in core."
    ],
    migrationCount: filenames.length,
    publicTableCount: tableResult.rows[0]?.count ?? 0,
    results
  };

  await writeFile(
    resolve(root, "docs/v1.4-migration-run.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
} finally {
  await database.close();
}
