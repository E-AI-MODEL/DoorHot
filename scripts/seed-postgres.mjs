import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FaqIngestionService,
  RegionalDeskIngestionService,
  RouteStepIngestionService,
  PostgresKnowledgeRepository,
  PostgresTrustedSourceRepository,
  PostgresFuzzyKnowledgeRepository,
  PostgresKnowledgeEmbeddingRepository,
  LocalSemanticEmbeddingProvider,
  ReciprocalRankFusionKnowledgeSearch
} from "../packages/knowledge/dist/index.js";
import {
  createPgExecutorFromEnvironment
} from "../packages/postgres/dist/index.js";

// Idempotent reference-data seed for a migrated PostgreSQL database.
// Loads the FAQ and regional-desk datasets through the same ingestion
// services the API uses at startup; every record is an upsert, so a
// second run changes no row counts.

const root = process.cwd();

export async function seedKnowledgeBase(executor) {
  const migrationFiles = (await readdir(resolve(root, "migrations")))
    .filter((filename) => filename.endsWith(".sql"));
  const applied = await executor.query(
    "SELECT count(*)::int AS count FROM schema_migrations"
  ).catch(() => null);

  if (applied === null) {
    throw new Error(
      "schema_migrations ontbreekt; voer eerst npm run migrate uit."
    );
  }
  if ((applied.rows[0]?.count ?? 0) < migrationFiles.length) {
    throw new Error(
      `database heeft ${applied.rows[0]?.count ?? 0} van ` +
      `${migrationFiles.length} migraties; voer eerst ` +
      "npm run migrate uit."
    );
  }

  const knowledge = new PostgresKnowledgeRepository(executor);
  const sources = new PostgresTrustedSourceRepository(executor);
  const indexer = new ReciprocalRankFusionKnowledgeSearch(
    knowledge,
    new PostgresFuzzyKnowledgeRepository(executor),
    new PostgresKnowledgeEmbeddingRepository(executor),
    new LocalSemanticEmbeddingProvider(),
    sources
  );

  const faqDataset = JSON.parse(
    await readFile(
      resolve(root, "datasets", "faq-seed.json"),
      "utf8"
    )
  );
  const deskDataset = JSON.parse(
    await readFile(
      resolve(root, "datasets", "regional-education-desks.json"),
      "utf8"
    )
  );

  const faqResult = await new FaqIngestionService(
    knowledge,
    sources,
    indexer
  ).ingest(faqDataset);

  const deskResult = await new RegionalDeskIngestionService(
    knowledge,
    sources,
    indexer
  ).ingest({ desks: deskDataset });

  const routeStepDataset = JSON.parse(
    await readFile(
      resolve(root, "datasets", "route-steps.json"),
      "utf8"
    )
  );
  const routeStepResult = await new RouteStepIngestionService(
    knowledge,
    sources,
    indexer
  ).ingest({ steps: routeStepDataset });

  const counts = await executor.query(
    `SELECT item_type, count(*)::int AS count
     FROM knowledge_items
     GROUP BY item_type
     ORDER BY item_type`
  );
  const sourceCount = await executor.query(
    "SELECT count(*)::int AS count FROM trusted_sources"
  );
  const embeddingCount = await executor.query(
    "SELECT count(*)::int AS count FROM knowledge_embeddings"
  );

  return {
    faqsImported: faqResult.imported,
    desksImported: deskResult.imported,
    routeStepsImported: routeStepResult.imported,
    knowledgeItems: Object.fromEntries(
      counts.rows.map((row) => [row.item_type, row.count])
    ),
    trustedSources: sourceCount.rows[0]?.count ?? 0,
    embeddings: embeddingCount.rows[0]?.count ?? 0
  };
}

const isDirectRun = process.argv[1]?.endsWith("seed-postgres.mjs");

if (isDirectRun) {
  const executor = createPgExecutorFromEnvironment();
  try {
    const summary = await seedKnowledgeBase(executor);
    console.log(JSON.stringify({ status: "ok", ...summary }, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      })
    );
    process.exitCode = 1;
  } finally {
    await executor.close();
  }
}
