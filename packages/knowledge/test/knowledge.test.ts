import { describe, expect, it } from "vitest";
import {
  FaqIngestionService,
  HybridKnowledgeSearch,
  InMemoryKnowledgeRepository,
  InMemoryTrustedSourceRepository
} from "../src/index.js";

describe("FAQ ingestion and hybrid retrieval", () => {
  it("ingests approved FAQ records and ranks official sources", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    const ingestion = new FaqIngestionService(knowledge, sources);

    await ingestion.ingest({
      faqs: [
        {
          question: "Wat kost zij-instroom?",
          answer: "De school kan subsidie aanvragen.",
          category: "kosten",
          tags: [
            "zij-instroom",
            "kosten",
            "source:official",
            "requires_citation:true"
          ],
          source_url: "https://duo.nl/subsidie"
        },
        {
          question: "Wat is zij-instroom?",
          answer: "Een werken-en-lerenroute.",
          category: "route",
          tags: ["zij-instroom", "source:internal"],
          source_url: null
        }
      ]
    });

    const search = new HybridKnowledgeSearch(knowledge, sources);
    const results = await search.search(
      "Wat kost een zij-instroomtraject?"
    );

    expect(results[0]?.record.title).toBe(
      "Wat kost zij-instroom?"
    );
    expect(results[0]?.authorityScore).toBe(1);
    expect(results[0]?.record.requiresCitation).toBe(true);
  });
});
