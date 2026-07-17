import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const report = JSON.parse(
  await readFile(
    resolve(process.cwd(), "reports/retrieval/hybrid.json"),
    "utf8"
  )
);

const actual = {
  recallAt5: report.overall["5"].recallAtK,
  mrrAt5: report.overall["5"].meanReciprocalRank,
  paraphraseRecallAt5:
    report.byQueryType.paraphrase.metrics["5"].recallAtK,
  typoRecallAt5:
    report.byQueryType.typo.metrics["5"].recallAtK
};

const thresholds = {
  recallAt5: Number(
    process.env.HYBRID_MIN_RECALL_AT_5 ?? 0.90
  ),
  mrrAt5: Number(
    process.env.HYBRID_MIN_MRR_AT_5 ?? 0.76
  ),
  paraphraseRecallAt5: Number(
    process.env.HYBRID_MIN_PARAPHRASE_RECALL_AT_5 ?? 0.70
  ),
  typoRecallAt5: Number(
    process.env.HYBRID_MIN_TYPO_RECALL_AT_5 ?? 0.90
  )
};

const failures = Object.entries(thresholds)
  .filter(([key, threshold]) => actual[key] < threshold)
  .map(([key, threshold]) => ({
    metric: key,
    actual: actual[key],
    threshold
  }));

console.log(JSON.stringify({ thresholds, actual, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
