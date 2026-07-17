import {
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  LocalSemanticEmbeddingProvider
} from "../packages/knowledge/src/index.js";

interface BenchmarkCase {
  id: string;
  query: string;
  queryType: string;
  relevantQuestions: readonly string[];
}

interface FaqRecord {
  question: string;
  answer: string;
  category?: string;
  tags?: readonly string[];
  source_url?: string | null;
  peildatum?: string;
}

interface RankedItem {
  id: string;
  title: string;
  score: number;
  channel: "fts" | "fuzzy" | "embedding";
}

const root = process.cwd();
const outputDirectory = resolve(root, "reports/retrieval");
const reportSuffix =
  process.env.EMBEDDING_PROVIDER === "external"
    ? "external"
    : "hybrid";
const kValues = [1, 3, 5, 10];
const rankConstant = 60;
class ExternalEmbeddingProvider {
  readonly modelKey = process.env.EMBEDDING_MODEL ?? "external";
  readonly dimensions = Number(
    process.env.EMBEDDING_DIMENSIONS ?? 1536
  );

  async embed(
    texts: readonly string[]
  ): Promise<readonly number[][]> {
    const baseUrl = process.env.EMBEDDING_BASE_URL;
    const apiKey = process.env.EMBEDDING_API_KEY;

    if (!baseUrl || !apiKey) {
      throw new Error(
        "EMBEDDING_BASE_URL and EMBEDDING_API_KEY are required."
      );
    }

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/embeddings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.modelKey,
          input: texts,
          dimensions: this.dimensions
        }),
        signal: AbortSignal.timeout(
          Number(process.env.EMBEDDING_TIMEOUT_MS ?? 30_000)
        )
      }
    );

    if (!response.ok) {
      throw new Error(`embedding_http_${response.status}`);
    }

    const payload = await response.json() as {
      data?: readonly {
        index: number;
        embedding: readonly number[];
      }[];
    };

    return [...(payload.data ?? [])]
      .sort((left, right) => left.index - right.index)
      .map((item) => [...item.embedding]);
  }
}

const useExternalProvider =
  process.env.EMBEDDING_PROVIDER === "external";
const embeddingProvider = useExternalProvider
  ? new ExternalEmbeddingProvider()
  : new LocalSemanticEmbeddingProvider();

function stableId(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${hex.padStart(12, "0")}`;
}

function normalizeMigration(sql: string): string {
  return sql.replace(
    /CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/i,
    ""
  );
}

function cosine(
  left: readonly number[],
  right: readonly number[]
): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  return leftNorm === 0 || rightNorm === 0
    ? 0
    : dot / Math.sqrt(leftNorm * rightNorm);
}

function fuse(
  rankings: readonly (readonly RankedItem[])[]
): readonly RankedItem[] {
  const scores = new Map<string, RankedItem>();

  rankings.forEach((ranking) => {
    ranking.forEach((item, index) => {
      const current = scores.get(item.id);
      scores.set(item.id, {
        ...item,
        score:
          (current?.score ?? 0) +
          1 / (rankConstant + index + 1)
      });
    });
  });

  return [...scores.values()].sort(
    (left, right) => right.score - left.score
  );
}

function calculate(
  resultIds: readonly string[],
  relevantIds: readonly string[],
  k: number
) {
  const top = resultIds.slice(0, k);
  const hits = top.filter((id) => relevantIds.includes(id));
  const first = top.findIndex((id) => relevantIds.includes(id));
  const recall =
    relevantIds.length === 0 ? 0 : hits.length / relevantIds.length;
  const reciprocalRank = first >= 0 ? 1 / (first + 1) : 0;
  const dcg = top.reduce((sum, id, index) =>
    sum +
    (relevantIds.includes(id) ? 1 : 0) / Math.log2(index + 2), 0);
  const idealCount = Math.min(k, relevantIds.length);
  const idcg = Array.from(
    { length: idealCount },
    (_, index) => 1 / Math.log2(index + 2)
  ).reduce((sum, value) => sum + value, 0);

  return {
    recall,
    reciprocalRank,
    ndcg: idcg === 0 ? 0 : dcg / idcg,
    hit: hits.length > 0
  };
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) /
      values.length;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

const benchmark = JSON.parse(
  await readFile(
    resolve(root, "datasets/retrieval-benchmark.json"),
    "utf8"
  )
) as {
  version: string;
  queryTypes: readonly string[];
  cases: readonly BenchmarkCase[];
};

const faqDataset = JSON.parse(
  await readFile(resolve(root, "datasets/faq-seed.json"), "utf8")
) as { faqs: readonly FaqRecord[] };

const questionToId = new Map(
  faqDataset.faqs.map((faq) => [
    faq.question,
    stableId(`faq:${faq.question}`)
  ])
);
const faqById = new Map(
  faqDataset.faqs.map((faq) => [
    stableId(`faq:${faq.question}`),
    faq
  ])
);
const faqTexts = faqDataset.faqs.map((faq) =>
  [
    faq.question,
    faq.answer,
    faq.category ?? "",
    ...(faq.tags ?? [])
  ].join(" ")
);
const faqEmbeddings = await embeddingProvider.embed(faqTexts);

const database = new PGlite();

try {
  const migrations = (await readdir(resolve(root, "migrations")))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of migrations) {
    await database.exec(
      normalizeMigration(
        await readFile(
          resolve(root, "migrations", filename),
          "utf8"
        )
      )
    );
  }

  for (const faq of faqDataset.faqs) {
    const sourceKey = faq.source_url
      ? `external-${new URL(faq.source_url).hostname
          .replace(/^www\./, "")
          .replaceAll(".", "-")}`
      : "door010-internal";
    const now = new Date().toISOString();

    await database.query(
      `INSERT INTO trusted_sources (
         id, source_key, label, base_url, authority,
         active, allowed_domains, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 0.8, true, $5, $6, $6)
       ON CONFLICT (source_key) DO NOTHING`,
      [
        stableId(`source:${sourceKey}`),
        sourceKey,
        sourceKey,
        faq.source_url
          ? new URL(faq.source_url).origin
          : null,
        faq.source_url
          ? [new URL(faq.source_url).hostname]
          : [],
        now
      ]
    );

    await database.query(
      `INSERT INTO knowledge_items (
         id, external_id, item_type, title, body, category,
         tags, source_key, source_url, time_sensitive,
         requires_citation, review_status,
         version, created_at, updated_at
       ) VALUES (
         $1, $2, 'faq', $3, $4, $5, $6, $7, $8,
         false, false, 'approved', 1, $9, $9
       )`,
      [
        questionToId.get(faq.question),
        stableId(faq.question),
        faq.question,
        faq.answer,
        faq.category ?? null,
        faq.tags ?? [],
        sourceKey,
        faq.source_url ?? null,
        now
      ]
    );
  }

  const caseResults = [];

  for (const testCase of benchmark.cases) {
    const relevantIds = testCase.relevantQuestions.map((question) => {
      const id = questionToId.get(question);
      if (!id) throw new Error(`Unknown FAQ label: ${question}`);
      return id;
    });

    const [ftsResult, fuzzyResult, queryEmbeddings] =
      await Promise.all([
        database.query<{
          id: string;
          title: string;
          rank: number;
        }>(
          `SELECT id, title, rank
           FROM search_knowledge_fts($1, 20, NULL)`,
          [testCase.query]
        ),
        database.query<{
          id: string;
          title: string;
          similarity: number;
        }>(
          `SELECT id, title, similarity
           FROM search_knowledge_fuzzy($1, 20, 0.04, NULL)`,
          [testCase.query]
        ),
        embeddingProvider.embed([testCase.query])
      ]);

    const queryEmbedding = queryEmbeddings[0] ?? [];
    const embeddingRanking = faqEmbeddings
      .map((embedding, index) => {
        const faq = faqDataset.faqs[index]!;
        return {
          id: questionToId.get(faq.question)!,
          title: faq.question,
          score: cosine(queryEmbedding, embedding),
          channel: "embedding" as const
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 20);

    const fused = fuse([
      ftsResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        score: Number(row.rank),
        channel: "fts" as const
      })),
      fuzzyResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        score: Number(row.similarity),
        channel: "fuzzy" as const
      })),
      embeddingRanking
    ]).slice(0, 10);

    const metrics = Object.fromEntries(
      kValues.map((k) => [
        String(k),
        calculate(
          fused.map((item) => item.id),
          relevantIds,
          k
        )
      ])
    );

    caseResults.push({
      ...testCase,
      relevantIds,
      retrieved: fused,
      metrics
    });
  }

  function aggregate(items: typeof caseResults, k: number) {
    const metrics = items.map((item) => item.metrics[String(k)]!);
    return {
      recallAtK: round(mean(metrics.map((item) => item.recall))),
      meanReciprocalRank: round(
        mean(metrics.map((item) => item.reciprocalRank))
      ),
      ndcgAtK: round(mean(metrics.map((item) => item.ndcg))),
      hitRateAtK: round(
        mean(metrics.map((item) => item.hit ? 1 : 0))
      )
    };
  }

  const overall = Object.fromEntries(
    kValues.map((k) => [String(k), aggregate(caseResults, k)])
  );
  const byQueryType = Object.fromEntries(
    benchmark.queryTypes.map((queryType) => {
      const items = caseResults.filter(
        (item) => item.queryType === queryType
      );
      return [
        queryType,
        {
          caseCount: items.length,
          metrics: Object.fromEntries(
            kValues.map((k) => [String(k), aggregate(items, k)])
          )
        }
      ];
    })
  );
  const missesAt5 = caseResults.filter(
    (item) => !item.metrics["5"]!.hit
  );

  const baseline = JSON.parse(
    await readFile(
      resolve(root, "reports/retrieval/baseline.json"),
      "utf8"
    )
  );
  const report = {
    generatedAt: new Date().toISOString(),
    engine:
      "PostgreSQL FTS + fuzzy + " +
      `${embeddingProvider.modelKey} embeddings + RRF`,
    benchmarkVersion: benchmark.version,
    caseCount: caseResults.length,
    faqCount: faqDataset.faqs.length,
    overall,
    byQueryType,
    missesAt5: missesAt5.map((item) => ({
      id: item.id,
      query: item.query,
      queryType: item.queryType,
      relevantQuestions: item.relevantQuestions,
      retrievedTitles: item.retrieved.map(
        (result) => result.title
      )
    })),
    comparison: {
      baselineAt5: baseline.overall["5"],
      hybridAt5: overall["5"],
      recallDelta: round(
        overall["5"].recallAtK -
        baseline.overall["5"].recallAtK
      ),
      mrrDelta: round(
        overall["5"].meanReciprocalRank -
        baseline.overall["5"].meanReciprocalRank
      ),
      ndcgDelta: round(
        overall["5"].ndcgAtK -
        baseline.overall["5"].ndcgAtK
      )
    },
    cases: caseResults
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, `${reportSuffix}.json`),
    JSON.stringify(report, null, 2)
  );

  const markdown = [
    "# Door010 hybrid retrieval benchmark",
    "",
    `- Engine: ${report.engine}`,
    `- Testvragen: ${report.caseCount}`,
    "",
    "## Vergelijking bij k=5",
    "",
    "| Metric | FTS baseline | Hybrid | Delta |",
    "|---|---:|---:|---:|",
    `| Recall@5 | ${report.comparison.baselineAt5.recallAtK} | ` +
      `${report.comparison.hybridAt5.recallAtK} | ` +
      `${report.comparison.recallDelta} |`,
    `| MRR@5 | ${report.comparison.baselineAt5.meanReciprocalRank} | ` +
      `${report.comparison.hybridAt5.meanReciprocalRank} | ` +
      `${report.comparison.mrrDelta} |`,
    `| nDCG@5 | ${report.comparison.baselineAt5.ndcgAtK} | ` +
      `${report.comparison.hybridAt5.ndcgAtK} | ` +
      `${report.comparison.ndcgDelta} |`,
    "",
    "## Hybrid per querytype bij k=5",
    "",
    "| Type | Recall@5 | MRR | nDCG@5 |",
    "|---|---:|---:|---:|",
    ...benchmark.queryTypes.map((queryType) => {
      const metrics = byQueryType[queryType].metrics["5"];
      return `| ${queryType} | ${metrics.recallAtK} | ` +
        `${metrics.meanReciprocalRank} | ${metrics.ndcgAtK} |`;
    }),
    "",
    `Gemiste vragen bij k=5: ${missesAt5.length}`
  ].join("\n");

  await writeFile(
    resolve(outputDirectory, `${reportSuffix}.md`),
    markdown
  );
  console.log(markdown);
} finally {
  await database.close();
}
