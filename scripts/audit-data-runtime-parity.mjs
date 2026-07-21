import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Fase A of the data- and runtime-parity audit: a read-only inventory of
// every dataset. It changes no behaviour. For each dataset it records the
// live record count plus a curated mapping of which consumer reads it and
// what its status in the running system is. The mapping is asserted against
// the code (see the referenced files); the counts are computed here so the
// document can never silently drift from the data.
//
// It deliberately does NOT rewrite or import anything. Its only job is to
// make visible what Door010 already has, what is actually wired in, and
// where a dataset is loaded but not (fully) consumed.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const datasetsDir = resolve(root, "datasets");

async function load(name) {
  return JSON.parse(await readFile(resolve(datasetsDir, name), "utf8"));
}

// Generic record counter: arrays count by length; objects prefer their
// largest array-valued property, else the number of keys. A dataset can
// override this with an explicit `count` resolver when the meaningful unit
// is a specific collection (e.g. the detector's question_catalog).
function genericCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length > 0) {
      return Math.max(...arrays.map((a) => a.length));
    }
    return Object.keys(value).length;
  }
  return 0;
}

// Curated inventory. `consumer`, `chatIndexed`, `usedBy` and `status` are
// facts verified against the code, not guesses; the reference column points
// at the file that proves each claim.
const inventory = [
  {
    file: "phase-detector-questions.json",
    recordType: "intake-vragen + catalogus",
    count: (d) => Object.keys(d.question_catalog).length,
    consumer: "packages/domain/src/phase-engine.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (Phase Detector)",
    status:
      "Actief na contractfix: slot/fase-verwijzingen worden " +
      "genormaliseerd naar question_id en resolven in de catalogus."
  },
  {
    file: "phase-detector-rules.json",
    recordType: "fase-regels",
    count: (d) => d.phases.length,
    consumer: "packages/domain/src/phase-engine.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (Phase Detector)",
    status: "Actief: bepaalt vereiste/optionele slots per fase."
  },
  {
    file: "phase-system-4.json",
    recordType: "fasesysteem (4)",
    consumer: "packages/domain/src/phase-systems.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (fasesysteem)",
    status: "Actief."
  },
  {
    file: "phase-system-5.json",
    recordType: "fasesysteem (5)",
    consumer: "packages/domain/src/phase-systems.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (fasesysteem)",
    status: "Actief."
  },
  {
    file: "phase-system-9.json",
    recordType: "fasesysteem (9)",
    consumer: "packages/domain/src/phase-systems.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (fasesysteem)",
    status: "Actief."
  },
  {
    file: "journey-phases.json",
    recordType: "journeyfasen",
    consumer: "packages/domain/src/journey-phases.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (journeycontext)",
    status: "Actief."
  },
  {
    file: "routes.json",
    recordType: "routes",
    consumer: "packages/domain/src/route-engine.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (Route Engine)",
    status: "Actief voor routebepaling."
  },
  {
    file: "route-questions.json",
    recordType: "routevragen + antwoorden",
    consumer: "packages/domain/src/route-engine.ts",
    chatIndexed: false,
    usedBy: "Persoonlijke coach (Route Engine)",
    status: "Actief voor routebepaling."
  },
  {
    file: "route-steps.json",
    recordType: "routestappen",
    consumer:
      "apps/api/src/bootstrap.ts (routeStepIngestion) + " +
      "packages/domain/src/route-engine.ts",
    chatIndexed: true,
    usedBy: "Beide coaches (kennisretrieval) + Route Engine",
    status:
      "Geindexeerd in chatretrieval. LET OP: de faqs/articles-CMS-" +
      "verwijzingen op een routestap worden nog niet geconsumeerd."
  },
  {
    file: "faq-seed.json",
    recordType: "FAQ-kennisrecords",
    consumer: "apps/api/src/bootstrap.ts (knowledgeIngestion)",
    chatIndexed: true,
    usedBy: "Beide coaches (kennisretrieval) + benchmark",
    status: "Geindexeerd in chatretrieval. Enige bron in de benchmark."
  },
  {
    file: "regional-education-desks.json",
    recordType: "regionale loketten",
    consumer: "apps/api/src/bootstrap.ts (regionalDeskIngestion)",
    chatIndexed: true,
    usedBy: "Beide coaches (kennisretrieval)",
    status:
      "Geindexeerd in chatretrieval, maar NIET in de benchmark-collectie."
  },
  {
    file: "interest-talent-test.json",
    recordType: "talententest-vragen",
    consumer: "apps/api (talent-test route)",
    chatIndexed: false,
    usedBy: "Talententest",
    status: "Actief voor de talententest."
  },
  {
    file: "retrieval-benchmark.json",
    recordType: "benchmarkvragen",
    consumer:
      "scripts/evaluate-retrieval-baseline.mjs + " +
      "scripts/evaluate-hybrid-retrieval.ts",
    chatIndexed: false,
    usedBy: "Benchmark",
    status:
      "Alleen benchmark. Meet tegen FAQ-only, niet tegen de volledige " +
      "runtime-collectie (loketten + routestappen ontbreken)."
  },
  {
    file: "learned-reranker-model.json",
    recordType: "reranker-gewichten",
    consumer: "packages/knowledge (LearnedLinearKnowledgeReranker)",
    chatIndexed: false,
    usedBy: "Kennisretrieval (reranking)",
    status:
      "Actief. Titelfeatures getraind op canonieke titel; aliases niet " +
      "in de vier titelfeatures."
  },
  {
    file: "manifest.json",
    recordType: "dataset-manifest",
    consumer: "scripts/verify-dataset-parity.ts",
    chatIndexed: false,
    usedBy: "Pariteitscontrole",
    status: "Actief als verwachte-aantallen-manifest."
  }
];

const rows = [];
for (const entry of inventory) {
  const data = await load(entry.file);
  const count = entry.count ? entry.count(data) : genericCount(data);
  rows.push({
    file: entry.file,
    recordType: entry.recordType,
    count,
    chatIndexed: entry.chatIndexed,
    usedBy: entry.usedBy,
    consumer: entry.consumer,
    status: entry.status
  });
}

const indexedTotal = rows
  .filter((r) => r.chatIndexed)
  .reduce((sum, r) => sum + r.count, 0);

const generatedAt = new Date().toISOString();
const md = [
  "# Data- en runtime-pariteitsaudit (Fase A)",
  "",
  "> Read-only inventaris. Aantallen zijn live berekend uit `datasets/`;",
  "> consumer, chatindexatie en status zijn geverifieerd tegen de code.",
  "> Gegenereerd door `npm run audit:data-parity`.",
  "",
  `Gegenereerd: ${generatedAt}`,
  "",
  "| Dataset | Type | Records | In chatretrieval | Gebruikt door | Status |",
  "| --- | --- | ---: | :---: | --- | --- |",
  ...rows.map(
    (r) =>
      `| \`${r.file}\` | ${r.recordType} | ${r.count} | ` +
      `${r.chatIndexed ? "ja" : "nee"} | ${r.usedBy} | ${r.status} |`
  ),
  "",
  `**Totaal geindexeerd in chatretrieval:** ${indexedTotal} records ` +
    `(${rows
      .filter((r) => r.chatIndexed)
      .map((r) => `${r.file.replace(".json", "")}=${r.count}`)
      .join(", ")}).`,
  "",
  "## Bekende verbroken of onvolledige verbindingen",
  "",
  "- **Benchmark ≠ runtime:** de benchmark meet alleen tegen " +
    "`faq-seed.json`; loketten en routestappen zitten wel in de runtime-" +
    "retrieval maar niet in de benchmark.",
  "- **Routestap-CMS inert:** `faqs`/`articles` op een routestap worden " +
    "geladen maar niet als kennis geconsumeerd.",
  "- **Reranker-aliases:** de vier titelfeatures gebruiken alleen de " +
    "canonieke titel, niet de aliases.",
  "- **654 fasevragen:** worden als domeindataset gebruikt door de Phase " +
    "Detector (na contractfix), niet als kennisrecords geindexeerd — dat " +
    "is bewust, want lang niet alle items zijn antwoorden.",
  ""
].join("\n");

const outMd = resolve(root, "docs/DATA_RUNTIME_INVENTORY.md");
const outJson = resolve(root, "docs/DATA_RUNTIME_INVENTORY.json");
await writeFile(outMd, md, "utf8");
await writeFile(
  outJson,
  JSON.stringify({ generatedAt, indexedTotal, rows }, null, 2),
  "utf8"
);

console.log(`[audit] inventaris geschreven: docs/DATA_RUNTIME_INVENTORY.md`);
console.log(`[audit] geindexeerd in chatretrieval: ${indexedTotal} records`);
for (const r of rows) {
  console.log(
    `  ${r.file.padEnd(34)} ${String(r.count).padStart(5)}  ` +
      `${r.chatIndexed ? "[chat]" : "      "}  ${r.usedBy}`
  );
}
