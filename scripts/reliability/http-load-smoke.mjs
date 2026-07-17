import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const baseUrl = process.env.LOAD_TEST_BASE_URL;
const path = process.env.LOAD_TEST_PATH ?? "/health/live";
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 10);
const maximumP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 500);
const minimumSuccessRate = Number(
  process.env.LOAD_TEST_MIN_SUCCESS_RATE ?? 0.99
);
const reportPath = process.env.LOAD_TEST_REPORT_PATH;

if (!baseUrl) {
  console.error("LOAD_TEST_BASE_URL is required.");
  process.exit(2);
}

const durations = [];
let successes = 0;
let cursor = 0;

async function worker() {
  while (cursor < requests) {
    cursor += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl));
      if (response.ok) successes += 1;
    } catch {
      // Counted through the success-rate gate.
    } finally {
      durations.push(performance.now() - startedAt);
    }
  }
}

await Promise.all(
  Array.from(
    { length: Math.max(1, concurrency) },
    () => worker()
  )
);

durations.sort((left, right) => left - right);
const p95Index = Math.min(
  durations.length - 1,
  Math.ceil(durations.length * 0.95) - 1
);
const result = {
  requests,
  concurrency,
  successes,
  successRate: successes / requests,
  p50Ms: durations[Math.floor(durations.length * 0.5)] ?? 0,
  p95Ms: durations[p95Index] ?? 0,
  maximumMs: durations.at(-1) ?? 0
};

const report = {
  ...result,
  path,
  maximumP95Ms,
  minimumSuccessRate,
  passed:
    result.successRate >= minimumSuccessRate &&
    result.p95Ms <= maximumP95Ms,
  generatedAt: new Date().toISOString()
};

console.log(JSON.stringify(report, null, 2));

if (reportPath) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
}

if (
  !report.passed
) {
  process.exit(1);
}
