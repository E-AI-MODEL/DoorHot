import { describe, expect, it } from "vitest";
import {
  LearnedLinearKnowledgeReranker,
  type KnowledgeSearchResult,
  type LearnedRerankerModel
} from "../src/index.js";

const model: LearnedRerankerModel = {
  version: "test",
  featureNames: [
    "reciprocal_rank",
    "rrf_score",
    "title_token_overlap",
    "body_token_overlap",
    "tag_token_overlap",
    "title_trigram_similarity",
    "concept_overlap",
    "exact_title_match",
    "query_length_ratio",
    "channel_count"
  ],
  weights: [0, 0, 0, 0, 0, 0, 8, 0, 0, 0],
  bias: -1,
  trainedAt: "2026-01-01T00:00:00.000Z",
  trainingCases: 100,
  holdoutCases: 20
};

function candidate(
  id: string,
  title: string,
  body: string,
  tags: readonly string[]
): KnowledgeSearchResult {
  return {
    record: {
      id,
      title,
      body,
      tags,
      timeSensitive: false,
      requiresCitation: false,
      reviewStatus: "approved",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    lexicalScore: 0,
    semanticScore: 0,
    authorityScore: 0,
    freshnessScore: 1,
    combinedScore: 0,
    matchedTerms: []
  };
}

describe("learned linear reranker", () => {
  it("promotes candidates with matching domain concepts", () => {
    const reranker = new LearnedLinearKnowledgeReranker(model);

    const result = reranker.rerank(
      "Hoe word ik docent in het mbo zonder lerarenopleiding?",
      [
        candidate(
          "11111111-1111-4111-8111-111111111111",
          "Wat is de Pabo?",
          "Opleiding voor het basisonderwijs.",
          ["pabo"]
        ),
        candidate(
          "22222222-2222-4222-8222-222222222222",
          "Wat is een PDG?",
          "Pedagogisch didactisch traject voor lesgeven in het mbo.",
          ["pdg", "mbo"]
        )
      ]
    );

    expect(result[0]?.record.title).toBe("Wat is een PDG?");
  });
});
