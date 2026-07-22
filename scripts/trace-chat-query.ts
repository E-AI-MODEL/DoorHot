import { resolve } from "node:path";
import { createApplicationServices } from "../apps/api/src/bootstrap.js";
import {
  AdaptiveRetrievalAnswerDraftProvider,
  AnswerValidationPipeline
} from "@door010/knowledge";

// Read-only candidate trace for reported chat queries (audit Blok 1).
//
// It uses the REAL runtime stack: createApplicationServices() builds the same
// ingestion, search, learned reranker and retrieval pipeline the coaches use,
// and exposes that pipeline via services.retrievalPipeline. The trace calls
// exactly that object, so its top-3 is the runtime top-3 - no hand-rebuilt
// copy, no "this is basically the runtime" hand-waving. It changes no product
// behaviour; it only makes the current selection visible so a wrong-facet
// answer can be reproduced and explained.

const datasetsDir = resolve(process.cwd(), "datasets");
const services = await createApplicationServices(datasetsDir, {
  seedDemoAccounts: false
});
const pipeline = services.retrievalPipeline;

// The no-LLM general coach exactly as bootstrap runs it without an LLM: the
// same pipeline, a deterministic empty generator, and preferExtractiveAnswer.
const noLlmGeneralCoach = new AdaptiveRetrievalAnswerDraftProvider(
  pipeline,
  {
    async createDraft() {
      return { directAnswer: "" };
    }
  },
  new AnswerValidationPipeline(),
  { preferExtractiveAnswer: true }
);

const queries = process.argv.slice(2);
const traceQueries =
  queries.length > 0
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
  console.log("top-3 interne kandidaten (runtime pipeline):");
  retrieval.internal.slice(0, 3).forEach((item, index) => {
    const record = item.record;
    console.log(
      `  ${index + 1}. [${(item.combinedScore ?? 0).toFixed(4)}] ` +
        `id=${record.id} ` +
        `(${record.itemType ?? record.category ?? "?"}) ${record.title}`
    );
    console.log(
      `       ${record.body.slice(0, 90).replace(/\s+/g, " ")}…`
    );
  });

  const answer = await noLlmGeneralCoach.createDraft(
    "general-coach",
    { message: query },
    { slots: [] }
  );
  console.log("no-LLM algemene coach antwoord:");
  console.log(`  → ${answer.directAnswer}`);
  if (answer.verifiedLinks.length > 0) {
    console.log(
      `  bronchips: ${answer.verifiedLinks
        .map((link) => link.label)
        .join(" | ")}`
    );
  }
}

process.exit(0);
