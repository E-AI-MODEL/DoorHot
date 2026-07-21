import { describe, expect, it } from "vitest";
import {
  AdaptiveRetrievalAnswerDraftProvider,
  AdaptiveRetrievalPipeline,
  AnswerValidationPipeline,
  ConditionalFaqReranker,
  HybridKnowledgeSearch,
  InMemoryKnowledgeRepository,
  InMemoryPipelineEventRepository,
  InMemoryTrustedSourceRepository,
  IntentRouter,
  evaluateRetrieval,
  heuristicIntent,
  type KnowledgeRecord,
  type RerankModel,
  type TrustedWebSearch
} from "../src/index.js";

function record(
  id: string,
  title: string,
  body: string,
  updatedAt = new Date().toISOString()
): KnowledgeRecord {
  return {
    id,
    title,
    body,
    tags: [],
    sourceKey: "official-example",
    sourceUrl: "https://example.nl",
    timeSensitive: false,
    requiresCitation: true,
    reviewStatus: "approved",
    version: 1,
    createdAt: updatedAt,
    updatedAt
  };
}

describe("AI parity pipeline", () => {
  it("routes intents with deterministic heuristics", () => {
    expect(heuristicIntent("Hoi")).toBe("greeting");
    expect(heuristicIntent("Hoe word ik docent?")).toBe("question");
    expect(heuristicIntent("Ja")).toBe("followup");
    expect(heuristicIntent("Ik wil het onderwijs verkennen")).toBe(
      "exploration"
    );
  });

  it("reranks only when lexical scores are close", async () => {
    const selected: number[][] = [];
    const model: RerankModel = {
      async select() {
        selected.push([2, 0, 1]);
        return [2, 0, 1];
      }
    };
    const events = new InMemoryPipelineEventRepository();
    const reranker = new ConditionalFaqReranker(model, events);
    const base = record(
      "11111111-1111-4111-8111-111111111111",
      "A",
      "A"
    );

    const result = await reranker.rerank(
      "vraag",
      [
        {
          record: base,
          lexicalScore: 0.8,
          semanticScore: 0,
          authorityScore: 0,
          freshnessScore: 0,
          combinedScore: 0.8,
          matchedTerms: []
        },
        {
          record: { ...base, id: "22222222-2222-4222-8222-222222222222" },
          lexicalScore: 0.7,
          semanticScore: 0,
          authorityScore: 0,
          freshnessScore: 0,
          combinedScore: 0.7,
          matchedTerms: []
        },
        {
          record: { ...base, id: "33333333-3333-4333-8333-333333333333" },
          lexicalScore: 0.6,
          semanticScore: 0,
          authorityScore: 0,
          freshnessScore: 0,
          combinedScore: 0.6,
          matchedTerms: []
        },
        {
          record: { ...base, id: "44444444-4444-4444-8444-444444444444" },
          lexicalScore: 0.5,
          semanticScore: 0,
          authorityScore: 0,
          freshnessScore: 0,
          combinedScore: 0.5,
          matchedTerms: []
        }
      ],
      3
    );

    expect(selected).toHaveLength(1);
    expect(result.map((item) => item.record.id)).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    ]);
  });

  it("uses trusted web fallback for time-sensitive questions", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    const now = new Date().toISOString();

    await sources.upsert({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sourceKey: "official-example",
      label: "Official",
      baseUrl: "https://example.nl",
      authority: 1,
      active: true,
      allowedDomains: ["example.nl"],
      createdAt: now,
      updatedAt: now
    });
    await knowledge.upsert(
      record(
        "11111111-1111-4111-8111-111111111111",
        "Salaris docent",
        "Het salaris staat in de cao."
      )
    );

    const calls: string[] = [];
    const web: TrustedWebSearch = {
      async search(query, domains) {
        calls.push(`${query}:${domains.join(",")}`);
        return [{
          title: "Actuele cao",
          text: "Actuele salarisinformatie",
          sourceUrl: "https://example.nl/cao",
          sourceKey: "web-example",
          retrievedAt: now
        }];
      }
    };

    const pipeline = new AdaptiveRetrievalPipeline(
      new HybridKnowledgeSearch(knowledge, sources),
      sources,
      new IntentRouter(),
      new ConditionalFaqReranker(),
      web
    );

    const result = await pipeline.retrieve(
      "Wat is het salaris in 2026?"
    );

    expect(result.webFallbackReason).toBe("time-sensitive");
    expect(result.external).toHaveLength(1);
    expect(result.sourceHierarchy[0]).toBe("external-fresh");
    expect(calls).toHaveLength(1);
  });

  it("never sends personal questions to the web fallback", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    const now = new Date().toISOString();

    await sources.upsert({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sourceKey: "official-example",
      label: "Official",
      baseUrl: "https://example.nl",
      authority: 1,
      active: true,
      allowedDomains: ["example.nl"],
      createdAt: now,
      updatedAt: now
    });
    await knowledge.upsert(
      record(
        "11111111-1111-4111-8111-111111111111",
        "Salaris docent",
        "Het salaris staat in de cao."
      )
    );

    const webQueries: string[] = [];
    const web: TrustedWebSearch = {
      async search(query) {
        webQueries.push(query);
        return [];
      }
    };
    const provider = new AdaptiveRetrievalAnswerDraftProvider(
      new AdaptiveRetrievalPipeline(
        new HybridKnowledgeSearch(knowledge, sources),
        sources,
        new IntentRouter(),
        new ConditionalFaqReranker(),
        web
      ),
      {
        async createDraft() {
          return { directAnswer: "Persoonlijke context." };
        }
      },
      new AnswerValidationPipeline(),
      { preferExtractiveAnswer: true }
    );

    await provider.createDraft(
      "personal-journey-coach",
      {
        message:
          "Wat verdien ik in 2026 met mijn medische situatie?"
      },
      { slots: [] }
    );

    expect(webQueries).toEqual([]);
  });

  it("answers extractively from the best record without an LLM", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    await knowledge.upsert(
      record(
        "11111111-1111-4111-8111-111111111111",
        "Wat is de Pabo?",
        "De pabo leidt op tot leraar in het basisonderwijs."
      )
    );

    const pipeline = new AdaptiveRetrievalPipeline(
      new HybridKnowledgeSearch(knowledge, sources),
      sources,
      new IntentRouter(),
      new ConditionalFaqReranker()
    );
    const genericGenerator = {
      async createDraft() {
        return {
          directAnswer: "Ik help je met algemene informatie.",
          supportingDetail: "generiek"
        };
      }
    };

    const extractive = new AdaptiveRetrievalAnswerDraftProvider(
      pipeline,
      genericGenerator,
      new AnswerValidationPipeline(),
      { preferExtractiveAnswer: true }
    );
    const generic = new AdaptiveRetrievalAnswerDraftProvider(
      pipeline,
      genericGenerator,
      new AnswerValidationPipeline()
    );

    const request = { message: "Wat is de pabo?" };
    const context = { slots: [] };

    const extracted = await extractive.createDraft(
      "general-coach",
      request,
      context
    );
    const canned = await generic.createDraft(
      "general-coach",
      request,
      context
    );

    expect(extracted.directAnswer).toContain(
      "leidt op tot leraar in het basisonderwijs"
    );
    expect(extracted.directAnswer).toContain("Bron: Wat is de Pabo?");
    expect(canned.directAnswer).toBe(
      "Ik help je met algemene informatie."
    );
  });

  it("declines off-topic questions and still answers in-scope ones", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    await knowledge.upsert(
      record(
        "11111111-1111-4111-8111-111111111111",
        "Wat is de Pabo?",
        "De pabo leidt op tot leraar in het basisonderwijs."
      )
    );

    const provider = new AdaptiveRetrievalAnswerDraftProvider(
      new AdaptiveRetrievalPipeline(
        new HybridKnowledgeSearch(knowledge, sources),
        sources,
        new IntentRouter(),
        new ConditionalFaqReranker()
      ),
      {
        async createDraft() {
          return {
            directAnswer: "Ik help je met algemene informatie.",
            supportingDetail: "generiek"
          };
        }
      },
      new AnswerValidationPipeline(),
      { preferExtractiveAnswer: true }
    );

    // Clearly off-topic questions are declined without sources, including
    // ones that only share a generic word ("beste") or a money word with
    // the domain, and ones whose phrasing brushes a two-letter abbreviation
    // ("vo" inside "voor"/"voetballer").
    for (const message of [
      "Wat is de hoofdstad van Frankrijk?",
      "Wat is het beste recept voor lasagne?",
      "Wie is de beste voetballer ter wereld?",
      "Hoeveel kost een nieuwe auto?"
    ]) {
      const declined = await provider.createDraft(
        "general-coach",
        { message },
        { slots: [] }
      );
      expect(declined.directAnswer).toContain(
        "werken en leren in het onderwijs"
      );
      expect(declined.sources).toEqual([]);
      expect(declined.verifiedLinks).toEqual([]);
      expect(declined.directAnswer).not.toContain("basisonderwijs");
    }

    // In-domain questions whose retrieved record actually relates to them
    // are answered.
    for (const message of [
      "Hoe lang duurt de pabo?",
      "Leidt de pabo op tot leraar?"
    ]) {
      const answered = await provider.createDraft(
        "general-coach",
        { message },
        { slots: [] }
      );
      expect(answered.directAnswer).not.toContain(
        "Waar kan ik je binnen dat onderwerp mee helpen"
      );
    }

    const inScope = await provider.createDraft(
      "general-coach",
      { message: "Wat is de pabo?" },
      { slots: [] }
    );
    expect(inScope.directAnswer).toContain(
      "leidt op tot leraar in het basisonderwijs"
    );

    // An in-domain question whose only retrieved record is unrelated is
    // declined too: retrieval always returns a nearest record, so grounding
    // the answer on it would present an irrelevant record as if it answered.
    const unrelated = await provider.createDraft(
      "general-coach",
      { message: "Welke subsidies zijn er voor omscholing?" },
      { slots: [] }
    );
    expect(unrelated.directAnswer).toContain(
      "werken en leren in het onderwijs"
    );
    expect(unrelated.sources).toEqual([]);
  });

  it("combines personal journey context with an extractive answer", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    await knowledge.upsert(
      record(
        "11111111-1111-4111-8111-111111111111",
        "Welke opleiding past?",
        "De pabo past bij een route naar het basisonderwijs."
      )
    );

    const provider = new AdaptiveRetrievalAnswerDraftProvider(
      new AdaptiveRetrievalPipeline(
        new HybridKnowledgeSearch(knowledge, sources),
        sources,
        new IntentRouter(),
        new ConditionalFaqReranker()
      ),
      {
        async createDraft() {
          return {
            directAnswer:
              "Op basis van je antwoorden lijkt pabo een passende route. " +
              "Je kunt nu verder met: vergelijk opleidingen. " +
              "Daarbij moeten we nog rekening houden met: " +
              "toelatingseisen controleren."
          };
        }
      },
      new AnswerValidationPipeline(),
      { preferExtractiveAnswer: true }
    );

    const draft = await provider.createDraft(
      "personal-journey-coach",
      { message: "Welke opleiding past bij mij?" },
      { slots: [] }
    );

    expect(draft.directAnswer).toContain("passende route");
    expect(draft.directAnswer).toContain(
      "Je kunt nu verder met: vergelijk opleidingen"
    );
    expect(draft.directAnswer).toContain(
      "rekening houden met: toelatingseisen controleren"
    );
    expect(draft.directAnswer).toContain(
      "De pabo past bij een route naar het basisonderwijs"
    );
    expect(draft.directAnswer).not.toMatch(/\bphase-[459]\b/i);
    expect(draft.directAnswer).not.toMatch(
      /\b(?:stap|fase|proces)\s*['"“”‘’]?(?:Interesseren|Oriënteren)/i
    );
  });

  it("repairs internal journey identifiers and status labels", async () => {
    const pipeline = new AnswerValidationPipeline();
    const result = await pipeline.validateAndRepair(
      "Je bevindt je in 'interesse' binnen phase-5. " +
        "Je bent nu bezig met de stap 'Interesseren'. " +
        "Dit is relevante informatie.",
      "question",
      {
        internalJourneyLabels: ["interesse", "Interesseren"]
      }
    );

    expect(result.answer).not.toContain("phase-5");
    expect(result.answer).not.toContain("'interesse'");
    expect(result.answer).not.toContain("'Interesseren'");
    expect(result.answer).toContain("je volgende stap");
    expect(result.pass).toBe(true);
  });

  it("repairs leakage and sentence overflow", async () => {
    const pipeline = new AnswerValidationPipeline();
    const result = await pipeline.validateAndRepair(
      "[Intern] Dit is dynamische context. Eerste zin. Tweede zin. " +
      "Derde zin. Vierde zin. Vijfde zin.",
      "question"
    );

    expect(result.pass).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.answer).not.toContain("dynamische context");
    expect(result.answer).not.toContain("[Intern]");
  });

  it("calculates recall, MRR and nDCG", async () => {
    const knowledge = new InMemoryKnowledgeRepository();
    const sources = new InMemoryTrustedSourceRepository();
    await knowledge.upsert(
      record(
        "11111111-1111-4111-8111-111111111111",
        "Pabo opleiding",
        "Via de pabo word je leraar."
      )
    );
    const search = new HybridKnowledgeSearch(knowledge, sources);

    const metrics = await evaluateRetrieval(
      search,
      [{
        query: "pabo leraar",
        relevantIds: [
          "11111111-1111-4111-8111-111111111111"
        ]
      }],
      3
    );

    expect(metrics.recallAtK).toBe(1);
    expect(metrics.meanReciprocalRank).toBe(1);
    expect(metrics.ndcgAtK).toBe(1);
  });
});
