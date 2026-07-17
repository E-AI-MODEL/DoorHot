import { describe, expect, it } from "vitest";
import {
  FaqIngestionService,
  InMemoryFuzzyKnowledgeRepository,
  InMemoryKnowledgeEmbeddingRepository,
  InMemoryKnowledgeRepository,
  InMemoryTrustedSourceRepository,
  LocalSemanticEmbeddingProvider,
  ReciprocalRankFusionKnowledgeSearch
} from "../src/index.js";

describe("hybrid retrieval", () => {
  it("finds semantic paraphrases and typo variants", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    const embeddings = new InMemoryKnowledgeEmbeddingRepository(
      knowledge
    );
    const provider = new LocalSemanticEmbeddingProvider();
    const search = new ReciprocalRankFusionKnowledgeSearch(
      knowledge,
      new InMemoryFuzzyKnowledgeRepository(knowledge),
      embeddings,
      provider,
      sources
    );
    const ingestion = new FaqIngestionService(
      knowledge,
      sources,
      search
    );

    await ingestion.ingest({
      faqs: [
        {
          question: "Wat is de Pabo?",
          answer:
            "De pabo leidt op tot leraar in het basisonderwijs.",
          category: "route",
          tags: [
            "pabo",
            "basisschool",
            "juf",
            "meester"
          ]
        },
        {
          question: "Wat is het salaris van een startende docent?",
          answer:
            "Een startende docent wordt meestal ingeschaald in LB.",
          category: "salaris",
          tags: ["salaris", "docent", "loon"]
        }
      ]
    });

    const paraphrase = await search.search(
      "Welke opleiding heb ik nodig om juf te worden?",
      { limit: 3 }
    );
    const typo = await search.search(
      "salaris startende dosent",
      { limit: 3 }
    );

    expect(paraphrase[0]?.record.title).toBe("Wat is de Pabo?");
    expect(typo[0]?.record.title).toBe(
      "Wat is het salaris van een startende docent?"
    );
  });

  it("finds records through their aliases", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    const embeddings = new InMemoryKnowledgeEmbeddingRepository(
      knowledge
    );
    const provider = new LocalSemanticEmbeddingProvider();
    const search = new ReciprocalRankFusionKnowledgeSearch(
      knowledge,
      new InMemoryFuzzyKnowledgeRepository(knowledge),
      embeddings,
      provider,
      sources
    );
    const ingestion = new FaqIngestionService(
      knowledge,
      sources,
      search
    );

    await ingestion.ingest({
      faqs: [
        {
          question: "Wat is een lio-stage en hoe werkt die?",
          aliases: [
            "Betaalde eindstage van de lerarenopleiding",
            "Leraar in opleiding stage"
          ],
          answer:
            "Een lio-stage is de afsluitende stage waarin je " +
            "zelfstandig lesgeeft, vaak met een leerarbeidsovereenkomst.",
          category: "route",
          tags: ["stage", "lio"]
        },
        {
          question: "Wat is de Pabo?",
          answer:
            "De pabo leidt op tot leraar in het basisonderwijs.",
          category: "route",
          tags: ["pabo", "basisschool"]
        }
      ]
    });

    const viaAlias = await search.search(
      "betaalde eindstage lerarenopleiding",
      { limit: 3 }
    );

    expect(viaAlias[0]?.record.title).toBe(
      "Wat is een lio-stage en hoe werkt die?"
    );
    expect(viaAlias[0]?.record.aliases).toContain(
      "Leraar in opleiding stage"
    );
  });

  it("returns normalized embeddings with stable dimensions", async () => {
    const provider = new LocalSemanticEmbeddingProvider(128);
    const [first, second] = await provider.embed([
      "juf op de basisschool",
      "leraar in het primair onderwijs"
    ]);

    expect(first).toHaveLength(128);
    expect(second).toHaveLength(128);
    expect(
      first?.reduce((sum, value) => sum + value * value, 0)
    ).toBeCloseTo(1, 5);
  });
});
