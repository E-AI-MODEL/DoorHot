import {
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = process.cwd();
const benchmarkPath = resolve(
  root,
  process.env.RETRIEVAL_BENCHMARK_DATASET ??
    "datasets/retrieval-benchmark.json"
);
const faqPath = resolve(root, "datasets/faq-seed.json");
const outputDirectory = resolve(
  root,
  process.env.RETRIEVAL_REPORT_DIRECTORY ?? "reports/retrieval"
);
const kValues = [1, 3, 5, 10];

function stableId(value) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${hex.padStart(12, "0")}`;
}

function normalizeMigration(sql) {
  return sql.replace(
    /CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i,
    ""
  );
}

function mean(values) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) /
      values.length;
}

function round(value) {
  return Number(value.toFixed(4));
}

function calculateCaseMetrics(resultIds, relevantIds, k) {
  const top = resultIds.slice(0, k);
  const hits = top.filter((id) => relevantIds.includes(id));
  const recall =
    relevantIds.length === 0 ? 0 : hits.length / relevantIds.length;
  const firstRelevant = top.findIndex((id) =>
    relevantIds.includes(id)
  );
  const reciprocalRank =
    firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0;
  const dcg = top.reduce((score, id, index) => {
    const relevance = relevantIds.includes(id) ? 1 : 0;
    return score + relevance / Math.log2(index + 2);
  }, 0);
  const idealHits = Math.min(k, relevantIds.length);
  const idcg = Array.from(
    { length: idealHits },
    (_, index) => 1 / Math.log2(index + 2)
  ).reduce((sum, value) => sum + value, 0);

  return {
    recall,
    reciprocalRank,
    ndcg: idcg === 0 ? 0 : dcg / idcg,
    hit: hits.length > 0
  };
}

function aggregate(caseResults, k) {
  const values = caseResults.map((item) => item.metrics[String(k)]);
  return {
    recallAtK: round(mean(values.map((item) => item.recall))),
    meanReciprocalRank: round(
      mean(values.map((item) => item.reciprocalRank))
    ),
    ndcgAtK: round(mean(values.map((item) => item.ndcg))),
    hitRateAtK: round(
      mean(values.map((item) => item.hit ? 1 : 0))
    )
  };
}

const benchmark = JSON.parse(
  await readFile(benchmarkPath, "utf8")
);
const faqDataset = JSON.parse(await readFile(faqPath, "utf8"));
const questionToId = new Map(
  faqDataset.faqs.map((faq) => [
    faq.question,
    stableId(`faq:${faq.question}`)
  ])
);

const database = new PGlite();

try {
  const migrationDirectory = resolve(root, "migrations");
  const migrations = (await readdir(migrationDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of migrations) {
    const sql = normalizeMigration(
      await readFile(resolve(migrationDirectory, filename), "utf8")
    );
    await database.exec(sql);
  }

  for (const faq of faqDataset.faqs) {
    const id = questionToId.get(faq.question);
    const tags = faq.tags ?? [];
    const sourceKey = faq.source_url
      ? `external-${new URL(faq.source_url).hostname
          .replace(/^www\./, "")
          .replaceAll(".", "-")}`
      : "door010-internal";
    const timestamp = new Date().toISOString();

    await database.query(
      `INSERT INTO trusted_sources (
         id, source_key, label, base_url, authority,
         active, allowed_domains, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, true, $6, $7, $7)
       ON CONFLICT (source_key) DO NOTHING`,
      [
        stableId(`source:${sourceKey}`),
        sourceKey,
        sourceKey.replaceAll("-", " "),
        faq.source_url
          ? new URL(faq.source_url).origin
          : null,
        faq.source_url ? 0.8 : 0.6,
        faq.source_url
          ? [new URL(faq.source_url).hostname]
          : [],
        timestamp
      ]
    );

    await database.query(
      `INSERT INTO knowledge_items (
         id, external_id, item_type, title, body, category,
         tags, source_key, source_url, time_sensitive,
         requires_citation, valid_from, review_status,
         version, created_at, updated_at
       ) VALUES (
         $1, $2, 'faq', $3, $4, $5, $6, $7, $8,
         $9, $10, $11, 'approved', 1, $12, $12
       )`,
      [
        id,
        stableId(faq.question),
        faq.question,
        faq.answer,
        faq.category ?? null,
        tags,
        sourceKey,
        faq.source_url ?? null,
        tags.includes("time_sensitive:true"),
        tags.includes("requires_citation:true"),
        faq.peildatum
          ? `${faq.peildatum}-01T00:00:00.000Z`
          : null,
        timestamp
      ]
    );
  }

  const caseResults = [];

  for (const testCase of benchmark.cases) {
    const relevantIds = testCase.relevantQuestions.map((question) => {
      const id = questionToId.get(question);
      if (!id) {
        throw new Error(
          `Benchmark references unknown FAQ question: ${question}`
        );
      }
      return id;
    });

    const queryResult = await database.query(
      `SELECT id, title, rank
       FROM search_knowledge_fts($1, 10, NULL)`,
      [testCase.query]
    );

    const retrieved = queryResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      rank: Number(row.rank)
    }));
    const resultIds = retrieved.map((item) => item.id);
    const metrics = Object.fromEntries(
      kValues.map((k) => [
        String(k),
        calculateCaseMetrics(resultIds, relevantIds, k)
      ])
    );

    caseResults.push({
      ...testCase,
      relevantIds,
      retrieved,
      metrics
    });
  }

  const overall = Object.fromEntries(
    kValues.map((k) => [String(k), aggregate(caseResults, k)])
  );
  const byQueryType = Object.fromEntries(
    benchmark.queryTypes.map((queryType) => {
      const subset = caseResults.filter(
        (item) => item.queryType === queryType
      );
      return [
        queryType,
        {
          caseCount: subset.length,
          metrics: Object.fromEntries(
            kValues.map((k) => [String(k), aggregate(subset, k)])
          )
        }
      ];
    })
  );

  const missesAt5 = caseResults
    .filter((item) => !item.metrics["5"].hit)
    .map((item) => ({
      id: item.id,
      query: item.query,
      queryType: item.queryType,
      relevantQuestions: item.relevantQuestions,
      retrievedTitles: item.retrieved.map(
        (result) => result.title
      )
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    engine: "PGlite PostgreSQL FTS",
    benchmarkVersion: benchmark.version,
    caseCount: caseResults.length,
    faqCount: faqDataset.faqs.length,
    kValues,
    overall,
    byQueryType,
    missesAt5,
    cases: caseResults
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, "baseline.json"),
    JSON.stringify(report, null, 2)
  );

  const markdown = [
    "# Door010 retrievalbaseline",
    "",
    `- Engine: ${report.engine}`,
    `- FAQ's: ${report.faqCount}`,
    `- Testvragen: ${report.caseCount}`,
    `- Benchmarkversie: ${report.benchmarkVersion}`,
    "",
    "## Totale scores",
    "",
    "| k | Recall@k | MRR | nDCG@k | Hit rate |",
    "|---:|---:|---:|---:|---:|",
    ...kValues.map((k) => {
      const metrics = overall[String(k)];
      return `| ${k} | ${metrics.recallAtK} | ` +
        `${metrics.meanReciprocalRank} | ${metrics.ndcgAtK} | ` +
        `${metrics.hitRateAtK} |`;
    }),
    "",
    "## Scores per querytype bij k=5",
    "",
    "| Type | Cases | Recall@5 | MRR | nDCG@5 | Hit rate |",
    "|---|---:|---:|---:|---:|---:|",
    ...benchmark.queryTypes.map((queryType) => {
      const group = byQueryType[queryType];
      const metrics = group.metrics["5"];
      return `| ${queryType} | ${group.caseCount} | ` +
        `${metrics.recallAtK} | ${metrics.meanReciprocalRank} | ` +
        `${metrics.ndcgAtK} | ${metrics.hitRateAtK} |`;
    }),
    "",
    `## Gemiste vragen bij k=5 (${missesAt5.length})`,
    "",
    ...(missesAt5.length === 0
      ? ["Geen."]
      : missesAt5.map(
          (item) =>
            `- **${item.queryType}** — ${item.query}\n` +
            `  - Verwacht: ${item.relevantQuestions.join("; ")}\n` +
            `  - Gevonden: ${
              item.retrievedTitles.join("; ") || "geen resultaten"
            }`
        ))
  ].join("\n");

  await writeFile(
    resolve(outputDirectory, "baseline.md"),
    markdown
  );

  console.log(markdown);
} finally {
  await database.close();
}
