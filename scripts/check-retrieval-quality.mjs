import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const report = JSON.parse(
  await readFile(
    resolve(
      process.cwd(),
      process.env.RETRIEVAL_BASELINE_REPORT ??
        "reports/retrieval/baseline.json"
    ),
    "utf8"
  )
);

const thresholds = {
  recallAt5: Number(
    process.env.RETRIEVAL_MIN_RECALL_AT_5 ?? 0.54
  ),
  mrrAt5: Number(
    process.env.RETRIEVAL_MIN_MRR_AT_5 ?? 0.52
  ),
  exactRecallAt5: Number(
    process.env.RETRIEVAL_MIN_EXACT_RECALL_AT_5 ?? 0.95
  ),
  aliasRecallAt5: Number(
    process.env.RETRIEVAL_MIN_ALIAS_RECALL_AT_5 ?? 0.95
  )
};

const actual = {
  recallAt5: report.overall["5"].recallAtK,
  mrrAt5: report.overall["5"].meanReciprocalRank,
  exactRecallAt5:
    report.byQueryType.exact.metrics["5"].recallAtK,
  aliasRecallAt5:
    report.byQueryType.alias.metrics["5"].recallAtK
};

const failures = Object.entries(thresholds)
  .filter(([key, threshold]) => actual[key] < threshold)
  .map(([key, threshold]) => ({
    metric: key,
    actual: actual[key],
    threshold
  }));

console.log(JSON.stringify({ thresholds, actual, failures }, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
