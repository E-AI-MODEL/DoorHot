import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActiveLearningKnowledgeSearch,
  AdaptiveRetrievalAnswerDraftProvider,
  AdaptiveRetrievalPipeline,
  AnswerValidationPipeline,
  ConditionalFaqReranker,
  FaqIngestionService,
  InMemoryFuzzyKnowledgeRepository,
  InMemoryKnowledgeEmbeddingRepository,
  InMemoryKnowledgeRepository,
  InMemoryRetrievalLabelQueueRepository,
  InMemoryShadowEvaluationRepository,
  InMemoryTrustedSourceRepository,
  IntentRouter,
  LearnedRerankedKnowledgeSearch,
  LocalSemanticEmbeddingProvider,
  ReciprocalRankFusionKnowledgeSearch,
  RegionalDeskIngestionService,
  RouteStepIngestionService,
  ShadowCrossEncoderKnowledgeSearch,
  type FaqSeedDataset,
  type LearnedRerankerModel,
  type RegionalDeskRecord,
  type RouteStepContentRecord
} from "@door010/knowledge";
import { LocalConceptCrossEncoder } from "@door010/integrations";

// Read-only candidate trace for reported chat queries (audit Blok 1). It
// rebuilds the exact runtime retrieval chain from bootstrap.ts, ingests the
// three chat-indexed datasets (faq-seed + regional desks + route steps) and,
// for each query, prints the top-3 internal candidates with scores and the
// actual no-LLM general-coach answer. It changes no product behaviour; it
// only makes the current selection visible so a wrong-facet answer can be
// reproduced and explained.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const datasetsDir = resolve(root, "datasets");
const load = async (name: string) =>
  JSON.parse(await readFile(resolve(datasetsDir, name), "utf8"));

const knowledgeRepository = new InMemoryKnowledgeRepository();
const trustedSourceRepository = new InMemoryTrustedSourceRepository();
const embeddingRepository = new InMemoryKnowledgeEmbeddingRepository(
  knowledgeRepository
);
const baseKnowledgeSearch = new ReciprocalRankFusionKnowledgeSearch(
  knowledgeRepository,
  new InMemoryFuzzyKnowledgeRepository(knowledgeRepository),
  embeddingRepository,
  new LocalSemanticEmbeddingProvider(),
  trustedSourceRepository
);

await new FaqIngestionService(
  knowledgeRepository,
  trustedSourceRepository,
  baseKnowledgeSearch
).ingest((await load("faq-seed.json")) as FaqSeedDataset);
await new RegionalDeskIngestionService(
  knowledgeRepository,
  trustedSourceRepository,
  baseKnowledgeSearch
).ingest({
  desks: (await load("regional-education-desks.json")) as readonly RegionalDeskRecord[]
});
await new RouteStepIngestionService(
  knowledgeRepository,
  trustedSourceRepository,
  baseKnowledgeSearch
).ingest({
  steps: (await load("route-steps.json")) as readonly RouteStepContentRecord[]
});

const learnedKnowledgeSearch = new LearnedRerankedKnowledgeSearch(
  baseKnowledgeSearch,
  (await load("learned-reranker-model.json")) as LearnedRerankerModel
);
const knowledgeSearch = new ActiveLearningKnowledgeSearch(
  new ShadowCrossEncoderKnowledgeSearch(
    learnedKnowledgeSearch,
    new LocalConceptCrossEncoder(),
    new InMemoryShadowEvaluationRepository()
  ),
  new InMemoryRetrievalLabelQueueRepository()
);

const pipeline = new AdaptiveRetrievalPipeline(
  knowledgeSearch,
  trustedSourceRepository,
  new IntentRouter(),
  new ConditionalFaqReranker()
);

// No-LLM general coach exactly as bootstrap runs it without an LLM.
const provider = new AdaptiveRetrievalAnswerDraftProvider(
  pipeline,
  { async createDraft() {
      return { directAnswer: "" };
    } },
  new AnswerValidationPipeline(),
  { preferExtractiveAnswer: true }
);

const queries = process.argv.slice(2);
const traceQueries = queries.length > 0
  ? queries
  : [
      "Hoeveel verdient een leraar?",
      "Wat is het salaris van een startende docent?",
      "Hoeveel uur werkt een leraar per week?"
    ];

for (const query of traceQueries) {
  const retrieval = await pipeline.retrieve(query, {
    allowWebFallback: true
  });
  console.log("\n" + "=".repeat(72));
  console.log(`QUERY: ${query}`);
  console.log(`intent: ${retrieval.intent}`);
  console.log("top-3 interne kandidaten:");
  retrieval.internal.slice(0, 3).forEach((item, index) => {
    const r = item.record;
    console.log(
      `  ${index + 1}. [${(item.combinedScore ?? 0).toFixed(4)}] ` +
        `(${r.itemType ?? r.category ?? "?"}) ${r.title}`
    );
    console.log(`       ${r.body.slice(0, 90).replace(/\s+/g, " ")}…`);
  });

  const answer = await provider.createDraft(
    "general-coach",
    { message: query },
    { slots: [] }
  );
  console.log("no-LLM algemene coach antwoord:");
  console.log(`  → ${answer.directAnswer}`);
  if (answer.verifiedLinks.length > 0) {
    console.log(
      `  bronchips: ${answer.verifiedLinks.map((l) => l.label).join(" | ")}`
    );
  }
}
