import { describe, expect, it } from "vitest";
import {
  FaqIngestionService,
  InMemoryFuzzyKnowledgeRepository,
  InMemoryKnowledgeEmbeddingRepository,
  InMemoryKnowledgeRepository,
  InMemoryTrustedSourceRepository,
  LocalSemanticEmbeddingProvider,
  ReciprocalRankFusionKnowledgeSearch,
  RegionalDeskIngestionService,
  RouteStepIngestionService
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

  it("finds regional education desks by region", async () => {
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
    const ingestion = new RegionalDeskIngestionService(
      knowledge,
      sources,
      search
    );

    const result = await ingestion.ingest({
      desks: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "VOTA",
          status: "published",
          slug: "vota",
          email: "info@vota.example",
          website: "https://vota.example",
          regions: ["VOTA (Twente Achterhoek Oost-Salland)"],
          cities_municipalities: "Almelo, Enschede, Hengelo",
          description: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text:
                      "Loket voor wie een overstap naar het " +
                      "onderwijs in Twente overweegt."
                  }
                ]
              }
            ]
          }
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Conceptloket",
          status: "draft",
          slug: "conceptloket"
        }
      ]
    });

    expect(result.imported).toBe(1);

    const byRegion = await search.search(
      "onderwijsloket regio Twente",
      { limit: 3 }
    );

    expect(byRegion[0]?.record.title).toBe(
      "VOTA (regionaal onderwijsloket)"
    );
    expect(byRegion[0]?.record.itemType).toBe("regional_desk");
    expect(byRegion[0]?.record.body).toContain("Twente");
  });

  it("finds route step explanations as knowledge", async () => {
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
    const ingestion = new RouteStepIngestionService(
      knowledge,
      sources,
      search
    );

    const result = await ingestion.ingest({
      steps: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          unique_name: "educatieve-master",
          slug: "educatieve-master",
          status: "published",
          short_title: "Educatieve master",
          long_title:
            "Word eerstegraads leraar met een educatieve master",
          duration_in_months: 24,
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text:
                      "Met een educatieve master behaal je een " +
                      "eerstegraads bevoegdheid voor alle " +
                      "niveaus van het voortgezet onderwijs."
                  }
                ]
              }
            ]
          }
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          unique_name: "concept-stap",
          status: "draft",
          short_title: "Conceptstap",
          long_title: "Conceptstap",
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "concept" }]
              }
            ]
          }
        }
      ]
    });

    expect(result.imported).toBe(1);

    const results = await search.search(
      "educatieve master eerstegraads bevoegdheid",
      { limit: 3 }
    );

    expect(results[0]?.record.title).toBe(
      "Word eerstegraads leraar met een educatieve master"
    );
    expect(results[0]?.record.itemType).toBe("route_step");
    expect(results[0]?.record.body).toContain(
      "Indicatieve duur: 24 maanden."
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
