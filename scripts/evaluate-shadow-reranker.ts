import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  HttpCrossEncoderReranker,
  LocalConceptCrossEncoder
} from "../packages/integrations/src/index.js";
import type {
  CrossEncoderReranker,
  KnowledgeRecord
} from "../packages/knowledge/src/index.js";

const root = process.cwd();
const hybrid = JSON.parse(
  await readFile(
    resolve(root, "reports/retrieval/hybrid.json"),
    "utf8"
  )
) as {
  cases: readonly {
    id: string;
    query: string;
    queryType: string;
    relevantIds: readonly string[];
    retrieved: readonly {
      id: string;
      title: string;
      score: number;
    }[];
  }[];
};
const faqDataset = JSON.parse(
  await readFile(
    resolve(root, "datasets/faq-seed.json"),
    "utf8"
  )
) as {
  faqs: readonly {
    question: string;
    answer: string;
    category?: string;
    tags?: readonly string[];
  }[];
};

const faqByTitle = new Map(
  faqDataset.faqs.map((faq) => [faq.question, faq])
);

const provider: CrossEncoderReranker =
  process.env.CROSS_ENCODER_ENDPOINT &&
  process.env.CROSS_ENCODER_MODEL
    ? new HttpCrossEncoderReranker({
        endpoint: process.env.CROSS_ENCODER_ENDPOINT,
        apiKey: process.env.CROSS_ENCODER_API_KEY,
        model: process.env.CROSS_ENCODER_MODEL,
        timeoutMs: Number(
          process.env.CROSS_ENCODER_TIMEOUT_MS ?? 20_000
        )
      })
    : new LocalConceptCrossEncoder();

function record(
  id: string,
  title: string
): KnowledgeRecord {
  const faq = faqByTitle.get(title);
  if (!faq) throw new Error(`Unknown FAQ title: ${title}`);

  return {
    id,
    title,
    body: faq.answer,
    category: faq.category,
    tags: faq.tags ?? [],
    timeSensitive: false,
    requiresCitation: false,
    reviewStatus: "approved",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function metrics(
  order: readonly string[],
  relevant: readonly string[],
  k = 5
) {
  const top = order.slice(0, k);
  const hits = top.filter((id) => relevant.includes(id)).length;
  const first = top.findIndex((id) => relevant.includes(id));
  const recall = hits / Math.max(relevant.length, 1);
  const reciprocalRank = first >= 0 ? 1 / (first + 1) : 0;
  const dcg = top.reduce(
    (sum, id, index) =>
      sum +
      (relevant.includes(id) ? 1 : 0) /
        Math.log2(index + 2),
    0
  );
  const idealCount = Math.min(k, relevant.length);
  const idcg = Array.from(
    { length: idealCount },
    (_, index) => 1 / Math.log2(index + 2)
  ).reduce((sum, value) => sum + value, 0);

  return {
    recall,
    reciprocalRank,
    ndcg: idcg === 0 ? 0 : dcg / idcg
  };
}

const cases = [];
let failures = 0;
let totalLatencyMs = 0;

for (const testCase of hybrid.cases) {
  const candidates = testCase.retrieved.slice(0, 10);
  const records = candidates.map((item) =>
    record(item.id, item.title)
  );
  const startedAt = Date.now();

  try {
    const providerScores = await provider.score(
      testCase.query,
      records
    );
    const shadow = candidates
      .map((candidate, index) => ({
        ...candidate,
        score:
          0.75 / (index + 1) +
          0.25 * (providerScores[index] ?? 0)
      }))
      .sort((left, right) => right.score - left.score);

    totalLatencyMs += Date.now() - startedAt;
    cases.push({
      id: testCase.id,
      queryType: testCase.queryType,
      baseline: metrics(
        candidates.map((item) => item.id),
        testCase.relevantIds
      ),
      shadow: metrics(
        shadow.map((item) => item.id),
        testCase.relevantIds
      ),
      changedTop:
        candidates[0]?.id !== shadow[0]?.id
    });
  } catch {
    failures += 1;
  }
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) /
      values.length;
}

function aggregate(key: "baseline" | "shadow") {
  return {
    recallAt5: Number(
      mean(cases.map((item) => item[key].recall)).toFixed(4)
    ),
    mrrAt5: Number(
      mean(
        cases.map((item) => item[key].reciprocalRank)
      ).toFixed(4)
    ),
    ndcgAt5: Number(
      mean(cases.map((item) => item[key].ndcg)).toFixed(4)
    )
  };
}

const baseline = aggregate("baseline");
const shadow = aggregate("shadow");
const report = {
  generatedAt: new Date().toISOString(),
  providerKey: provider.providerKey,
  mode: "shadow",
  caseCount: cases.length,
  failures,
  averageLatencyMs: Number(
    (totalLatencyMs / Math.max(cases.length, 1)).toFixed(2)
  ),
  changedTopRate: Number(
    mean(cases.map((item) => item.changedTop ? 1 : 0))
      .toFixed(4)
  ),
  baseline,
  shadow,
  delta: {
    recallAt5: Number(
      (shadow.recallAt5 - baseline.recallAt5).toFixed(4)
    ),
    mrrAt5: Number(
      (shadow.mrrAt5 - baseline.mrrAt5).toFixed(4)
    ),
    ndcgAt5: Number(
      (shadow.ndcgAt5 - baseline.ndcgAt5).toFixed(4)
    )
  }
};

await writeFile(
  resolve(root, "reports/retrieval/shadow-reranker.json"),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
