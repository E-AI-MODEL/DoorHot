import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface BenchmarkCase {
  id: string;
  query: string;
  queryType: string;
  relevantQuestions: readonly string[];
}

describe("retrieval benchmark dataset", () => {
  it("contains valid labels for every supported query type", async () => {
    const root = resolve(process.cwd(), "../..");
    const benchmark = JSON.parse(
      await readFile(
        resolve(root, "datasets/retrieval-benchmark.json"),
        "utf8"
      )
    ) as {
      queryTypes: readonly string[];
      cases: readonly BenchmarkCase[];
    };
    const faqDataset = JSON.parse(
      await readFile(
        resolve(root, "datasets/faq-seed.json"),
        "utf8"
      )
    ) as {
      faqs: readonly { question: string }[];
    };
    const questions = new Set(
      faqDataset.faqs.map((faq) => faq.question)
    );

    expect(benchmark.cases.length).toBeGreaterThanOrEqual(150);
    expect(new Set(benchmark.cases.map((item) => item.id)).size)
      .toBe(benchmark.cases.length);

    for (const queryType of benchmark.queryTypes) {
      expect(
        benchmark.cases.some(
          (item) => item.queryType === queryType
        )
      ).toBe(true);
    }

    for (const item of benchmark.cases) {
      expect(item.query.trim().length).toBeGreaterThan(2);
      expect(item.relevantQuestions.length).toBeGreaterThan(0);
      for (const question of item.relevantQuestions) {
        expect(questions.has(question)).toBe(true);
      }
    }
  });
});
