import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const report = JSON.parse(
  await readFile(
    resolve(root, "reports/retrieval/learned-reranker.json"),
    "utf8"
  )
);
const benchmark = JSON.parse(
  await readFile(
    resolve(root, "datasets/retrieval-benchmark.json"),
    "utf8"
  )
);

const thresholds = {
  minimumCases: Number(
    process.env.RERANKER_MIN_BENCHMARK_CASES ?? 300
  ),
  holdoutRecallAt5: Number(
    process.env.RERANKER_MIN_HOLDOUT_RECALL_AT_5 ?? 0.88
  ),
  holdoutMrr: Number(
    process.env.RERANKER_MIN_HOLDOUT_MRR ?? 0.78
  ),
  holdoutNdcgAt5: Number(
    process.env.RERANKER_MIN_HOLDOUT_NDCG_AT_5 ?? 0.8
  ),
  maximumBrierScore: Number(
    process.env.RERANKER_MAX_HOLDOUT_BRIER ?? 0.22
  ),
  maximumValidationHoldoutRecallGap: Number(
    process.env.RERANKER_MAX_VALIDATION_HOLDOUT_GAP ?? 0.08
  )
};

const groups = new Map();
for (const item of benchmark.cases) {
  const groupId = item.groupId;
  if (!groupId) {
    throw new Error(`Benchmark case ${item.id} has no groupId.`);
  }
  const values = groups.get(groupId) ?? [];
  values.push(item);
  groups.set(groupId, values);
}

const requiredTypes = [
  "exact",
  "alias",
  "paraphrase",
  "typo",
  "short",
  "conversational",
  "hard_negative",
  "multi_intent"
];
const actualTypes = new Set(
  benchmark.cases.map((item) => item.queryType)
);

const actual = {
  caseCount: benchmark.cases.length,
  groupCount: groups.size,
  holdoutRecallAt5: report.holdout.recallAt5,
  holdoutMrr: report.holdout.meanReciprocalRank,
  holdoutNdcgAt5: report.holdout.ndcgAt5,
  holdoutBrierScore: report.holdout.brierScore,
  validationHoldoutRecallGap: Math.abs(
    report.validation.recallAt5 -
    report.holdout.recallAt5
  ),
  missingQueryTypes: requiredTypes.filter(
    (queryType) => !actualTypes.has(queryType)
  )
};

const failures = [];
if (actual.caseCount < thresholds.minimumCases) {
  failures.push({
    metric: "caseCount",
    actual: actual.caseCount,
    threshold: thresholds.minimumCases
  });
}
if (actual.holdoutRecallAt5 < thresholds.holdoutRecallAt5) {
  failures.push({
    metric: "holdoutRecallAt5",
    actual: actual.holdoutRecallAt5,
    threshold: thresholds.holdoutRecallAt5
  });
}
if (actual.holdoutMrr < thresholds.holdoutMrr) {
  failures.push({
    metric: "holdoutMrr",
    actual: actual.holdoutMrr,
    threshold: thresholds.holdoutMrr
  });
}
if (actual.holdoutNdcgAt5 < thresholds.holdoutNdcgAt5) {
  failures.push({
    metric: "holdoutNdcgAt5",
    actual: actual.holdoutNdcgAt5,
    threshold: thresholds.holdoutNdcgAt5
  });
}
if (actual.holdoutBrierScore > thresholds.maximumBrierScore) {
  failures.push({
    metric: "holdoutBrierScore",
    actual: actual.holdoutBrierScore,
    threshold: thresholds.maximumBrierScore
  });
}
if (
  actual.validationHoldoutRecallGap >
  thresholds.maximumValidationHoldoutRecallGap
) {
  failures.push({
    metric: "validationHoldoutRecallGap",
    actual: actual.validationHoldoutRecallGap,
    threshold: thresholds.maximumValidationHoldoutRecallGap
  });
}
if (actual.missingQueryTypes.length > 0) {
  failures.push({
    metric: "missingQueryTypes",
    actual: actual.missingQueryTypes,
    threshold: []
  });
}

console.log(JSON.stringify({ thresholds, actual, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
