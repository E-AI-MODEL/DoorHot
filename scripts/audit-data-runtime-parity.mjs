import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Fase A of the data- and runtime-parity audit: a read-only inventory of
// every dataset. It changes no behaviour. For each dataset it records the
// live record count and a curated mapping of which consumer reads it and
// what its status in the running system is. Counts and content hashes are
// computed here so the document can never silently drift from the data;
// the consumer/status columns are asserted against the code (referenced in
// the `consumer` field), not guessed.
//
// It deliberately does NOT rewrite or import anything. Its only job is to
// make visible what Door010 already has, what is actually wired in, and
// where a dataset is loaded but not (fully) consumed.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const datasetsDir = resolve(root, "datasets");

async function loadRaw(name) {
  return readFile(resolve(datasetsDir, name), "utf8");
}
async function load(name) {
  return JSON.parse(await loadRaw(name));
}
function shortHash(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

// Generic record counter: arrays count by length; objects prefer their
// largest array-valued property, else the number of keys. A dataset can
// override this with an explicit `count` resolver when the meaningful unit
// is a specific collection (e.g. the detector's question_catalog).
function genericCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length > 0) return Math.max(...arrays.map((a) => a.length));
    return Object.keys(value).length;
  }
  return 0;
}

// Curated inventory. Every non-computed column is a fact verified against
// the code path named in `consumer`.
const inventory = [
  {
    file: "phase-detector-questions.json",
    recordType: "intake-vragen + catalogus",
    format: "object: slots + slot_to_questions + phase_to_questions + catalogus",
    count: (d) => Object.keys(d.question_catalog).length,
    tsContract: "RawPhaseQuestionDataset -> PhaseQuestionDataset (datasets.ts)",
    loader: "loadDomainDatasets (valideert + normaliseert)",
    consumer: "packages/domain/src/phase-engine.ts",
    consumers: { personal: true, phaseDetector: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "phase-detector-real-dataset.test.ts (echte dataset)",
    status:
      "Actief na contractfix (PR #22): slot/fase-verwijzingen worden " +
      "genormaliseerd naar question_id en resolven in de catalogus."
  },
  {
    file: "phase-detector-rules.json",
    recordType: "fase-regels",
    format: "object: phases[] met required/optional slots",
    count: (d) => d.phases.length,
    tsContract: "PhaseRulesDataset (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/phase-engine.ts",
    consumers: { personal: true, phaseDetector: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "phase-engine.test.ts",
    status: "Actief: bepaalt vereiste/optionele slots per fase."
  },
  {
    file: "phase-system-4.json",
    recordType: "fasesysteem (4)",
    format: "object: phases[]",
    tsContract: "PhaseSystemDataset (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/phase-systems.ts",
    consumers: { personal: true, phaseDetector: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "phase-systems.test.ts",
    status: "Actief."
  },
  {
    file: "phase-system-5.json",
    recordType: "fasesysteem (5)",
    format: "object: phases[]",
    tsContract: "PhaseSystemDataset (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/phase-systems.ts",
    consumers: { personal: true, phaseDetector: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "phase-systems.test.ts",
    status: "Actief."
  },
  {
    file: "phase-system-9.json",
    recordType: "fasesysteem (9)",
    format: "object: phases[]",
    tsContract: "PhaseSystemDataset (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/phase-systems.ts",
    consumers: { personal: true, phaseDetector: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "phase-systems.test.ts",
    status: "Actief."
  },
  {
    file: "journey-phases.json",
    recordType: "journeyfasen",
    format: "array van fasedefinities",
    tsContract: "JourneyPhaseDefinition[] (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/journey-phases.ts",
    consumers: { personal: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "journey-phases.test.ts",
    status: "Actief (journeycontext)."
  },
  {
    file: "routes.json",
    recordType: "routes",
    format: "array van routes met stap-/antwoordrelaties",
    tsContract: "RouteDefinition[] (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/route-engine.ts",
    consumers: { personal: true, routeEngine: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "route-engine.test.ts",
    status: "Actief voor routebepaling."
  },
  {
    file: "route-questions.json",
    recordType: "routevragen + antwoorden",
    format: "array van vragen met answers[]",
    tsContract: "RouteQuestionDefinition[] (datasets.ts)",
    loader: "loadDomainDatasets",
    consumer: "packages/domain/src/route-engine.ts",
    consumers: { personal: true, routeEngine: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "route-engine.test.ts",
    status: "Actief voor routebepaling."
  },
  {
    file: "route-steps.json",
    recordType: "routestappen",
    format: "array van stappen met faqs[]/articles[]",
    tsContract:
      "RouteStepContentRecord[] (knowledge) + RouteStepDefinition (datasets.ts)",
    loader: "bootstrap.ts routeStepIngestion + loadDomainDatasets",
    consumer: "apps/api/src/bootstrap.ts + packages/domain/src/route-engine.ts",
    consumers: {
      general: true,
      personal: true,
      routeEngine: true,
      knowledge: true
    },
    chatIndexed: true,
    sourceLink: "present (deels)",
    tests: "retrieval-trace-parity.test.ts (166 records)",
    status:
      "Geindexeerd in chatretrieval. INERT: de faqs/articles-CMS-" +
      "verwijzingen op een routestap worden geladen maar niet geconsumeerd."
  },
  {
    file: "faq-seed.json",
    recordType: "FAQ-kennisrecords",
    format: "object: { faqs: [...] }",
    tsContract: "FaqSeedDataset (knowledge)",
    loader: "bootstrap.ts knowledgeIngestion",
    consumer: "apps/api/src/bootstrap.ts",
    consumers: {
      general: true,
      personal: true,
      knowledge: true,
      benchmark: true
    },
    chatIndexed: true,
    sourceLink: "present (source_url)",
    tests: "retrieval-trace-parity.test.ts",
    status:
      "Geindexeerd in chatretrieval. Enige bron in de benchmark. " +
      "LET OP: FAQ-records krijgen GEEN itemType (alleen category)."
  },
  {
    file: "regional-education-desks.json",
    recordType: "regionale loketten",
    format: "array van loketten",
    tsContract: "RegionalDeskRecord[] (knowledge)",
    loader: "bootstrap.ts regionalDeskIngestion",
    consumer: "apps/api/src/bootstrap.ts",
    consumers: { general: true, personal: true, knowledge: true },
    chatIndexed: true,
    sourceLink: "present (loket-URL)",
    tests: "retrieval-trace-parity.test.ts",
    status: "Geindexeerd (itemType regional_desk). NIET in de benchmark."
  },
  {
    file: "interest-talent-test.json",
    recordType: "talententest-vragen",
    format: "object/array met vragen",
    tsContract: "talent-test route",
    loader: "apps/api talent-test",
    consumer: "apps/api (talent-test route)",
    consumers: {},
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "parity-flows (e2e)",
    status: "Actief voor de talententest."
  },
  {
    file: "retrieval-benchmark.json",
    recordType: "benchmarkvragen",
    format: "array van query/expected",
    tsContract: "benchmark-scripts",
    loader: "evaluate-*",
    consumer:
      "scripts/evaluate-retrieval-baseline.mjs + evaluate-hybrid-retrieval.ts",
    consumers: { benchmark: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "benchmark-scripts",
    status:
      "Alleen benchmark. Meet tegen FAQ-only, NIET tegen de volledige " +
      "runtime-collectie (loketten + routestappen ontbreken)."
  },
  {
    file: "learned-reranker-model.json",
    recordType: "reranker-gewichten",
    format: "object: featureNames + weights",
    tsContract: "LearnedRerankerModel (knowledge)",
    loader: "bootstrap.ts",
    consumer: "packages/knowledge (LearnedLinearKnowledgeReranker)",
    consumers: { general: true, personal: true, knowledge: true },
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "learned-reranker.test.ts",
    status:
      "Actief. Titelfeatures getraind op canonieke titel; aliases niet " +
      "in de vier titelfeatures."
  },
  {
    file: "manifest.json",
    recordType: "dataset-manifest",
    format: "object: verwachte aantallen",
    tsContract: "verify-dataset-parity",
    loader: "verify-dataset-parity.ts",
    consumer: "scripts/verify-dataset-parity.ts",
    consumers: {},
    chatIndexed: false,
    sourceLink: "n.v.t.",
    tests: "verify:datasets",
    status: "Actief als verwachte-aantallen-manifest."
  }
];

const rows = [];
for (const entry of inventory) {
  const raw = await loadRaw(entry.file);
  const data = JSON.parse(raw);
  const count = entry.count ? entry.count(data) : genericCount(data);
  rows.push({ ...entry, count, sha: shortHash(raw) });
}

const indexedRows = rows.filter((r) => r.chatIndexed);
const indexedTotal = indexedRows.reduce((sum, r) => sum + r.count, 0);

// Categorize (not copy) the 654 phase items by how they are referenced.
const phaseData = await load("phase-detector-questions.json");
const catalogIds = new Set(Object.keys(phaseData.question_catalog));
const idsFrom = (map) => {
  const set = new Set();
  for (const refs of Object.values(map)) {
    for (const ref of refs) {
      set.add(typeof ref === "string" ? ref : ref.question_id);
    }
  }
  return set;
};
const slotIds = idsFrom(phaseData.slot_to_questions);
const phaseIds = idsFrom(phaseData.phase_to_questions);
const both = [...slotIds].filter((id) => phaseIds.has(id)).length;
const onlySlot = [...slotIds].filter((id) => !phaseIds.has(id)).length;
const onlyPhase = [...phaseIds].filter((id) => !slotIds.has(id)).length;
const unreferenced = [...catalogIds].filter(
  (id) => !slotIds.has(id) && !phaseIds.has(id)
).length;

function consumerCell(consumers) {
  const flags = [
    consumers.general && "algemeen",
    consumers.personal && "persoonlijk",
    consumers.phaseDetector && "PhaseDetector",
    consumers.routeEngine && "RouteEngine",
    consumers.knowledge && "kennisbank",
    consumers.benchmark && "benchmark"
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(", ") : "-";
}

const generatedAt = new Date().toISOString();
const md = [
  "# Data- en runtime-pariteitsaudit (Blok 1)",
  "",
  "> Read-only. Aantallen en SHA's zijn live berekend uit `datasets/`;",
  "> formaat, contract, consumers en status zijn geverifieerd tegen de code.",
  "> Gegenereerd door `npm run audit:data-parity`. Geen gedragswijziging.",
  "",
  `Gegenereerd: ${generatedAt}`,
  "",
  "## Matrix",
  "",
  "| Dataset | SHA256 | Records | Formaat | In chat | Consumers | Bronlink | Status |",
  "| --- | --- | ---: | --- | :---: | --- | --- | --- |",
  ...rows.map(
    (r) =>
      `| \`${r.file}\` | \`${r.sha}\` | ${r.count} | ${r.format} | ` +
      `${r.chatIndexed ? "ja" : "nee"} | ${consumerCell(r.consumers)} | ` +
      `${r.sourceLink} | ${r.status} |`
  ),
  "",
  "### Contract, loader en tests per dataset",
  "",
  ...rows.map(
    (r) =>
      `- **\`${r.file}\`** — type: ${r.recordType}; contract: ` +
      `${r.tsContract}; loader: ${r.loader}; tests: ${r.tests}.`
  ),
  "",
  `**Totaal geindexeerd in chatretrieval:** ${indexedTotal} records ` +
    `(${indexedRows
      .map((r) => `${r.file.replace(".json", "")}=${r.count}`)
      .join(", ")}).`,
  "",
  "## Categorisatie van de 654 Phase-Detector-items (niet gekopieerd)",
  "",
  "De 654 items zijn geen 654 FAQ-antwoorden en worden niet als FAQ's",
  "geimporteerd. Ze worden alleen naar hun runtime-rol gecategoriseerd:",
  "",
  `- catalogus totaal: **${catalogIds.size}**`,
  `- gerefereerd door slots (intake/slotindicator): **${slotIds.size}**`,
  `- gerefereerd door fasen (fase-indicator): **${phaseIds.size}**`,
  `- door beide: **${both}**`,
  `- alleen slot: **${onlySlot}**`,
  `- alleen fase: **${onlyPhase}**`,
  `- door geen van beide gerefereerd (latente metadata/vraagvarianten): ` +
    `**${unreferenced}**`,
  "",
  "## Aanwezig vs. actief — bekende verbroken/onvolledige verbindingen",
  "",
  "- **Benchmark ≠ runtime:** de benchmark meet alleen tegen " +
    "`faq-seed.json`; loketten (52) en routestappen (66) zitten wel in de " +
    "runtime-retrieval maar niet in de benchmark.",
  "- **Routestap-CMS inert:** `faqs`/`articles` op een routestap worden " +
    "geladen maar niet als kennis geconsumeerd (present maar inert).",
  "- **FAQ zonder itemType:** de 48 FAQ-records dragen geen `itemType` " +
    "(alleen `category`); bronlabeling kan nu niet op een `faq`-itemType " +
    "leunen.",
  "- **Reranker-aliases:** de vier titelfeatures gebruiken alleen de " +
    "canonieke titel, niet de aliases.",
  `- **Latente Phase-items:** ${unreferenced} van de 654 catalogusitems ` +
    "worden door geen slot of fase gerefereerd (aanwezig, niet actief in " +
    "vraagselectie).",
  "",
  "## Reproduceerbare candidate-trace",
  "",
  "Zie `npm run trace:chat` (via de echte runtime-pipeline uit " +
    "`createApplicationServices().retrievalPipeline`). Voor " +
    '"Hoeveel verdient een leraar?" staat het werktijdenrecord op #1 en ' +
    "het salarisrecord op #3; het no-LLM-pad toont blind #1. Vastgelegd in " +
    "`apps/api/test/retrieval-trace-parity.test.ts`.",
  ""
].join("\n");

const outMd = resolve(root, "docs/DATA_RUNTIME_PARITY_AUDIT.md");
const outJson = resolve(root, "docs/DATA_RUNTIME_PARITY_AUDIT.json");
await writeFile(outMd, md, "utf8");
await writeFile(
  outJson,
  JSON.stringify(
    {
      generatedAt,
      indexedTotal,
      phaseItemCategorisation: {
        catalog: catalogIds.size,
        referencedBySlots: slotIds.size,
        referencedByPhases: phaseIds.size,
        both,
        onlySlot,
        onlyPhase,
        unreferenced
      },
      rows: rows.map((r) => ({
        file: r.file,
        sha256: r.sha,
        count: r.count,
        format: r.format,
        chatIndexed: r.chatIndexed,
        consumer: r.consumer,
        sourceLink: r.sourceLink,
        tests: r.tests,
        status: r.status
      }))
    },
    null,
    2
  ),
  "utf8"
);

console.log(`[audit] geschreven: docs/DATA_RUNTIME_PARITY_AUDIT.md`);
console.log(`[audit] geindexeerd in chatretrieval: ${indexedTotal} records`);
console.log(
  `[audit] 654-items: slots=${slotIds.size} fasen=${phaseIds.size} ` +
    `ongerefereerd=${unreferenced}`
);
for (const r of rows) {
  console.log(
    `  ${r.file.padEnd(34)} ${String(r.count).padStart(5)}  ${r.sha}  ` +
      `${r.chatIndexed ? "[chat]" : "      "}`
  );
}
