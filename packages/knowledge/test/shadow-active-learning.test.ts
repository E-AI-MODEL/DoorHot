import { describe, expect, it } from "vitest";
import {
  ActiveLearningKnowledgeSearch,
  InMemoryRetrievalLabelQueueRepository,
  InMemoryShadowEvaluationRepository,
  ShadowCrossEncoderKnowledgeSearch,
  type CrossEncoderReranker,
  type KnowledgeSearch,
  type KnowledgeSearchResult
} from "../src/index.js";

function result(
  id: string,
  title: string,
  score: number
): KnowledgeSearchResult {
  return {
    record: {
      id,
      title,
      body: title,
      tags: [],
      timeSensitive: false,
      requiresCitation: false,
      reviewStatus: "approved",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    lexicalScore: score,
    semanticScore: score,
    authorityScore: 1,
    freshnessScore: 1,
    combinedScore: score,
    matchedTerms: []
  };
}

describe("shadow reranking and active learning", () => {
  it("records shadow order without changing production order", async () => {
    const baseline = [
      result(
        "11111111-1111-4111-8111-111111111111",
        "Eerste",
        0.8
      ),
      result(
        "22222222-2222-4222-8222-222222222222",
        "Tweede",
        0.7
      )
    ];
    const search: KnowledgeSearch = {
      async search() {
        return baseline;
      }
    };
    const reranker: CrossEncoderReranker = {
      providerKey: "test-cross-encoder",
      async score() {
        return [0.1, 0.9];
      }
    };
    const evaluations =
      new InMemoryShadowEvaluationRepository();
    const shadow = new ShadowCrossEncoderKnowledgeSearch(
      search,
      reranker,
      evaluations
    );

    const output = await shadow.search("test", { limit: 2 });
    const records = await evaluations.list();

    expect(output.map((item) => item.record.title)).toEqual([
      "Eerste",
      "Tweede"
    ]);
    expect(records[0]?.shadowTopId).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(records[0]?.status).toBe("completed");
  });

  it("queues uncertain results and supports human labeling", async () => {
    const queue = new InMemoryRetrievalLabelQueueRepository();
    const search: KnowledgeSearch = {
      async search() {
        return [
          result(
            "11111111-1111-4111-8111-111111111111",
            "Eerste",
            0.5
          ),
          result(
            "22222222-2222-4222-8222-222222222222",
            "Tweede",
            0.49
          )
        ];
      }
    };
    const active = new ActiveLearningKnowledgeSearch(
      search,
      queue,
      0.05
    );

    await active.search("onzekere vraag");
    const pending = await queue.list("pending");

    expect(pending).toHaveLength(1);
    const claimed = await queue.claim(
      pending[0]!.id,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
    expect(claimed?.status).toBe("claimed");

    const labeled = await queue.label({
      id: pending[0]!.id,
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      relevantIds: [
        "22222222-2222-4222-8222-222222222222"
      ],
      irrelevantIds: [
        "11111111-1111-4111-8111-111111111111"
      ],
      notes: "Menselijke beoordeling"
    });

    expect(labeled?.status).toBe("labeled");
    expect(labeled?.relevantIds).toEqual([
      "22222222-2222-4222-8222-222222222222"
    ]);
  });
});
