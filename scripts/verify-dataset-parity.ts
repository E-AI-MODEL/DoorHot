import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

// Manifest-driven dataset verification. Every dataset in
// datasets/manifest.json must exist, match its declared counts, have
// unique identifiers, keep its cross-references valid and have at
// least one registered consumer in the codebase, so no dataset can
// silently go dead.

const root = process.cwd();
const datasetsDirectory = resolve(root, "datasets");
const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

async function loadJson(filename: string): Promise<unknown> {
  const path = resolve(datasetsDirectory, filename);
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (cause) {
    fail(`${filename}: kan niet laden of parsen (${String(cause)})`);
    return undefined;
  }
}

function assertUnique(
  filename: string,
  label: string,
  values: readonly (string | undefined | null)[]
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) {
      fail(`${filename}: lege ${label} gevonden`);
      continue;
    }
    if (seen.has(value)) {
      fail(`${filename}: dubbele ${label} "${value}"`);
    }
    seen.add(value);
  }
}

// Registered consumers per dataset. A dataset without a consumer is
// dead data; the check below verifies the consumer file really
// references the dataset.
const CONSUMERS: Readonly<Record<string, readonly string[]>> = {
  "phase-detector-questions.json": ["packages/domain/src/datasets.ts"],
  "phase-detector-rules.json": ["packages/domain/src/datasets.ts"],
  "route-questions.json": ["packages/domain/src/datasets.ts"],
  "route-steps.json": ["packages/domain/src/datasets.ts"],
  "routes.json": ["packages/domain/src/datasets.ts"],
  "journey-phases.json": ["packages/domain/src/datasets.ts"],
  "phase-system-4.json": ["packages/domain/src/datasets.ts"],
  "phase-system-5.json": ["packages/domain/src/datasets.ts"],
  "phase-system-9.json": ["packages/domain/src/datasets.ts"],
  "interest-talent-test.json": [
    "apps/api/src/parity-flows-bootstrap.ts"
  ],
  "faq-seed.json": [
    "apps/api/src/bootstrap.ts",
    "apps/api/src/production-bootstrap.ts"
  ],
  "regional-education-desks.json": [
    "apps/api/src/bootstrap.ts",
    "apps/api/src/production-bootstrap.ts"
  ]
};

// Derived artifacts live in datasets/ but are produced by scripts
// rather than delivered as source data; they need a consumer too.
const DERIVED_DATASETS: Readonly<Record<string, readonly string[]>> = {
  "retrieval-benchmark.json": [
    "scripts/evaluate-retrieval-baseline.mjs",
    "scripts/evaluate-hybrid-retrieval.ts"
  ],
  "learned-reranker-model.json": [
    "apps/api/src/bootstrap.ts",
    "apps/api/src/production-bootstrap.ts"
  ]
};

const manifest = await loadJson("manifest.json") as {
  datasets: Record<string, Record<string, number | string>>;
} | undefined;

if (!manifest?.datasets) {
  fail("manifest.json: ontbreekt of heeft geen datasets-object");
} else {
  const manifestFiles = Object.keys(manifest.datasets);

  const actualFiles = (await readdir(datasetsDirectory))
    .filter((name) => name.endsWith(".json"))
    .filter((name) => name !== "manifest.json");

  for (const file of actualFiles) {
    if (
      !manifestFiles.includes(file) &&
      !(file in DERIVED_DATASETS)
    ) {
      fail(
        `${file}: staat niet in manifest.json en is geen ` +
        "geregistreerd afgeleid bestand"
      );
    }
  }

  for (const [file, consumers] of [
    ...manifestFiles.map((file) =>
      [file, CONSUMERS[file]] as const
    ),
    ...Object.entries(DERIVED_DATASETS)
  ]) {
    if (!consumers || consumers.length === 0) {
      fail(`${file}: geen geregistreerde consumer`);
      continue;
    }
    for (const consumer of consumers) {
      try {
        const source = await readFile(
          resolve(root, consumer),
          "utf8"
        );
        if (!source.includes(file)) {
          fail(
            `${file}: geregistreerde consumer ${consumer} ` +
            "verwijst niet naar dit bestand"
          );
        }
      } catch {
        fail(
          `${file}: consumer ${consumer} bestaat niet`
        );
      }
    }
  }
}

const expectedFromManifest = manifest?.datasets ?? {};

function expectCount(
  filename: string,
  key: string,
  actualValue: number
): void {
  const declared = expectedFromManifest[filename]?.[key];
  if (typeof declared !== "number") return;
  if (declared !== actualValue) {
    fail(
      `${filename}: manifest verwacht ${key}=${declared}, ` +
      `dataset bevat ${actualValue}`
    );
  }
}

// phase-detector-questions.json
const detector = await loadJson("phase-detector-questions.json") as {
  slots: readonly string[];
  phase_to_questions: Record<
    string,
    readonly { question_id?: string }[]
  >;
  question_catalog: Record<string, unknown>;
} | undefined;

if (detector) {
  expectCount(
    "phase-detector-questions.json",
    "questions",
    Object.keys(detector.question_catalog).length
  );
  expectCount(
    "phase-detector-questions.json",
    "slots",
    detector.slots.length
  );
  expectCount(
    "phase-detector-questions.json",
    "phases",
    Object.keys(detector.phase_to_questions).length
  );

  for (const [phase, questions] of Object.entries(
    detector.phase_to_questions
  )) {
    for (const entry of questions) {
      const questionId = entry.question_id;
      if (
        !questionId ||
        !(questionId in detector.question_catalog)
      ) {
        fail(
          "phase-detector-questions.json: fase " +
          `"${phase}" verwijst naar onbekende vraag ` +
          `"${questionId ?? "?"}"`
        );
      }
    }
  }
}

// phase-detector-rules.json
const rules = await loadJson("phase-detector-rules.json") as {
  slots: Record<string, unknown>;
  phases: readonly unknown[];
} | undefined;

if (rules) {
  expectCount(
    "phase-detector-rules.json",
    "slots",
    Object.keys(rules.slots).length
  );
  expectCount(
    "phase-detector-rules.json",
    "phases",
    rules.phases.length
  );

  if (detector) {
    const detectorSlots = [...detector.slots].sort();
    const ruleSlots = Object.keys(rules.slots).sort();
    if (
      JSON.stringify(detectorSlots) !== JSON.stringify(ruleSlots)
    ) {
      fail(
        "phase-detector-rules.json: slots wijken af van " +
        "phase-detector-questions.json"
      );
    }
  }
}

// route-questions.json
const routeQuestions = await loadJson("route-questions.json") as
  readonly {
    id?: string | number;
    question?: string;
    answers?: readonly { id?: string | number }[];
  }[] | undefined;

if (routeQuestions) {
  expectCount(
    "route-questions.json",
    "questions",
    routeQuestions.length
  );
  expectCount(
    "route-questions.json",
    "answers",
    routeQuestions.reduce(
      (sum, question) => sum + (question.answers?.length ?? 0),
      0
    )
  );
  assertUnique(
    "route-questions.json",
    "vraag-id",
    routeQuestions.map((question) => String(question.id ?? ""))
  );
}

// route-steps.json
const routeSteps = await loadJson("route-steps.json") as
  readonly {
    id?: string;
    unique_name?: string;
  }[] | undefined;

if (routeSteps) {
  expectCount("route-steps.json", "steps", routeSteps.length);
  assertUnique(
    "route-steps.json",
    "unique_name",
    routeSteps.map((step) => step.unique_name)
  );
  assertUnique(
    "route-steps.json",
    "id",
    routeSteps.map((step) => step.id)
  );
}

// routes.json
const routes = await loadJson("routes.json") as
  readonly {
    slug?: string;
    status?: string;
    route_steps?: readonly { route_steps_id?: string }[];
  }[] | undefined;

if (routes) {
  expectCount("routes.json", "routes", routes.length);
  assertUnique(
    "routes.json",
    "slug",
    routes.map((route) => route.slug)
  );

  if (routeSteps) {
    const stepIds = new Set(
      routeSteps.map((step) => step.id ?? "")
    );
    let broken = 0;
    for (const route of routes) {
      for (const link of route.route_steps ?? []) {
        if (
          link.route_steps_id &&
          !stepIds.has(link.route_steps_id)
        ) {
          broken += 1;
        }
      }
    }
    if (broken > 0) {
      fail(
        `routes.json: ${broken} route-stapverwijzingen wijzen ` +
        "naar onbekende route-steps"
      );
    }
  }
}

// faq-seed.json
const faqSeed = await loadJson("faq-seed.json") as {
  faqs: readonly {
    question: string;
    aliases?: readonly string[];
    answer?: string;
  }[];
} | undefined;

if (faqSeed) {
  expectCount("faq-seed.json", "faqs", faqSeed.faqs.length);
  assertUnique(
    "faq-seed.json",
    "vraag",
    faqSeed.faqs.map((faq) => faq.question)
  );

  const questionSet = new Set(
    faqSeed.faqs.map((faq) => faq.question)
  );
  const seenAliases = new Set<string>();
  for (const faq of faqSeed.faqs) {
    if (!faq.answer?.trim()) {
      fail(`faq-seed.json: "${faq.question}" heeft geen antwoord`);
    }
    for (const alias of faq.aliases ?? []) {
      if (questionSet.has(alias)) {
        fail(
          `faq-seed.json: alias "${alias}" is ook een ` +
          "canonieke vraag"
        );
      }
      if (seenAliases.has(alias)) {
        fail(`faq-seed.json: dubbele alias "${alias}"`);
      }
      seenAliases.add(alias);
    }
  }
}

// regional-education-desks.json
const desks = await loadJson("regional-education-desks.json") as
  readonly {
    id?: string;
    slug?: string;
    title?: string;
    status?: string;
  }[] | undefined;

if (desks) {
  expectCount(
    "regional-education-desks.json",
    "desks",
    desks.length
  );
  assertUnique(
    "regional-education-desks.json",
    "id",
    desks.map((desk) => desk.id)
  );
  assertUnique(
    "regional-education-desks.json",
    "slug",
    desks.map((desk) => desk.slug)
  );
  for (const desk of desks) {
    if (!desk.title?.trim()) {
      fail(
        "regional-education-desks.json: loket zonder titel " +
        `(id ${desk.id ?? "?"})`
      );
    }
  }
}

// journey-phases.json
const journeyPhases = await loadJson("journey-phases.json") as
  readonly { code?: string }[] | undefined;

if (journeyPhases) {
  expectCount(
    "journey-phases.json",
    "phases",
    journeyPhases.length
  );
  assertUnique(
    "journey-phases.json",
    "code",
    journeyPhases.map((phase) => phase.code)
  );
}

// phase-system-*.json
for (const systemFile of [
  "phase-system-4.json",
  "phase-system-5.json",
  "phase-system-9.json"
]) {
  const system = await loadJson(systemFile) as {
    phases: readonly { key?: string; code?: string }[];
  } | undefined;
  if (!system) continue;
  expectCount(systemFile, "phases", system.phases.length);
  assertUnique(
    systemFile,
    "fasesleutel",
    system.phases.map((phase) => phase.key ?? phase.code)
  );
}

// interest-talent-test.json
const talentTest = await loadJson("interest-talent-test.json") as {
  questions: readonly {
    id?: string | number;
    options?: Record<string, unknown> | readonly unknown[];
  }[];
  sectors: Record<string, unknown>;
} | undefined;

if (talentTest) {
  expectCount(
    "interest-talent-test.json",
    "questions",
    talentTest.questions.length
  );
  expectCount(
    "interest-talent-test.json",
    "sectors",
    Object.keys(talentTest.sectors).length
  );
  assertUnique(
    "interest-talent-test.json",
    "vraag-id",
    talentTest.questions.map((question) =>
      String(question.id ?? "")
    )
  );
}

if (errors.length > 0) {
  console.error({ status: "failed", errors });
  process.exit(1);
}

console.log({
  status: "ok",
  manifestDatasets: Object.keys(expectedFromManifest).length,
  derivedDatasets: Object.keys(DERIVED_DATASETS).length,
  detectorQuestions: detector
    ? Object.keys(detector.question_catalog).length
    : 0,
  routes: routes?.length ?? 0,
  routeSteps: routeSteps?.length ?? 0,
  faqs: faqSeed?.faqs.length ?? 0,
  regionalDesks: desks?.length ?? 0
});
