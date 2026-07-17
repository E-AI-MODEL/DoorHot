import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retrieval benchmark grouping", () => {
  it("keeps semantic variants in stable groups", async () => {
    const root = resolve(process.cwd(), "../..");
    const benchmark = JSON.parse(
      await readFile(
        resolve(root, "datasets/retrieval-benchmark.json"),
        "utf8"
      )
    ) as {
      cases: readonly {
        id: string;
        queryType: string;
        groupId?: string;
        relevantQuestions: readonly string[];
      }[];
    };

    expect(benchmark.cases.length).toBeGreaterThanOrEqual(300);

    const groups = new Map<string, Set<string>>();
    for (const item of benchmark.cases) {
      expect(item.groupId).toBeTruthy();
      const labels = groups.get(item.groupId!) ?? new Set<string>();
      for (const label of item.relevantQuestions) labels.add(label);
      groups.set(item.groupId!, labels);
    }

    expect(groups.size).toBeGreaterThanOrEqual(48);

    const queryTypes = new Set(
      benchmark.cases.map((item) => item.queryType)
    );
    for (const required of [
      "exact",
      "alias",
      "paraphrase",
      "typo",
      "short",
      "conversational",
      "hard_negative",
      "multi_intent"
    ]) {
      expect(queryTypes.has(required)).toBe(true);
    }
  });
});
