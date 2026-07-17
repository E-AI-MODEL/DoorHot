import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const report = JSON.parse(
  await readFile(
    resolve(
      process.cwd(),
      "reports/retrieval/shadow-reranker.json"
    ),
    "utf8"
  )
);

const thresholds = {
  minimumCases: Number(
    process.env.SHADOW_MIN_CASES ?? 300
  ),
  maximumFailureRate: Number(
    process.env.SHADOW_MAX_FAILURE_RATE ?? 0.01
  ),
  minimumRecallDelta: Number(
    process.env.SHADOW_MIN_RECALL_DELTA ?? -0.01
  ),
  minimumMrrDelta: Number(
    process.env.SHADOW_MIN_MRR_DELTA ?? -0.01
  ),
  minimumNdcgDelta: Number(
    process.env.SHADOW_MIN_NDCG_DELTA ?? -0.01
  )
};

const actual = {
  caseCount: report.caseCount,
  failureRate:
    report.failures /
    Math.max(report.caseCount + report.failures, 1),
  recallDelta: report.delta.recallAt5,
  mrrDelta: report.delta.mrrAt5,
  ndcgDelta: report.delta.ndcgAt5
};

const failures = [];
if (actual.caseCount < thresholds.minimumCases) {
  failures.push({
    metric: "caseCount",
    actual: actual.caseCount,
    threshold: thresholds.minimumCases
  });
}
if (actual.failureRate > thresholds.maximumFailureRate) {
  failures.push({
    metric: "failureRate",
    actual: actual.failureRate,
    threshold: thresholds.maximumFailureRate
  });
}
for (const [metric, threshold] of [
  ["recallDelta", thresholds.minimumRecallDelta],
  ["mrrDelta", thresholds.minimumMrrDelta],
  ["ndcgDelta", thresholds.minimumNdcgDelta]
]) {
  if (actual[metric] < threshold) {
    failures.push({
      metric,
      actual: actual[metric],
      threshold
    });
  }
}

console.log(JSON.stringify({ thresholds, actual, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
