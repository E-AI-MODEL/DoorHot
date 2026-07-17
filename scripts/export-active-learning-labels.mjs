import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.ACCEPTANCE_DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const result = await client.query(
    `SELECT
       queue.query_hash,
       queue.candidate_ids,
       queue.candidate_titles,
       queue.relevant_ids,
       queue.irrelevant_ids,
       queue.label_notes,
       queue.labeled_at
     FROM retrieval_label_queue AS queue
     WHERE queue.status = 'labeled'
     ORDER BY queue.labeled_at ASC`
  );

  const exportData = {
    generatedAt: new Date().toISOString(),
    count: result.rows.length,
    labels: result.rows.map((row) => ({
      queryHash: row.query_hash,
      candidateIds: row.candidate_ids,
      candidateTitles: row.candidate_titles,
      relevantIds: row.relevant_ids ?? [],
      irrelevantIds: row.irrelevant_ids ?? [],
      notes: row.label_notes ?? undefined,
      labeledAt:
        row.labeled_at instanceof Date
          ? row.labeled_at.toISOString()
          : row.labeled_at
    }))
  };

  const output = resolve(
    process.cwd(),
    process.env.ACTIVE_LEARNING_EXPORT ??
      "reports/retrieval/active-learning-labels.json"
  );
  await writeFile(output, JSON.stringify(exportData, null, 2));
  console.log(JSON.stringify({
    output,
    count: exportData.count
  }, null, 2));
} finally {
  await client.end();
}
