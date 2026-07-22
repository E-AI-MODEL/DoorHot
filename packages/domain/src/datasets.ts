import { readFile } from "node:fs/promises";

export interface PhaseQuestionDefinition {
  question_id: string;
  question_text: string;
  phase_code: string | null;
  theme?: string | null;
  subtheme?: string | null;
  fills_slots: readonly string[];
}

export interface PhaseQuestionReference {
  question_id: string;
  question_text?: string;
  reason?: string;
}

export type RawPhaseQuestionReference = string | PhaseQuestionReference;

export interface RawPhaseQuestionDataset {
  schema_version: string;
  generated_at: string;
  slots: readonly string[];
  slot_to_questions: Readonly<
    Record<string, readonly RawPhaseQuestionReference[]>
  >;
  phase_to_questions: Readonly<
    Record<string, readonly RawPhaseQuestionReference[]>
  >;
  question_catalog: Readonly<Record<string, PhaseQuestionDefinition>>;
}

// Runtime shape consumed by the existing detector. The real JSON carries
// objects in slot_to_questions and phase_to_questions; the loader validates
// and reduces them to string ids once, without creating a second dataset.
// The slots union keeps existing hand-written fixtures compatible.
export interface PhaseQuestionDataset {
  schema_version: string;
  generated_at: string;
  slots: readonly string[] | Readonly<Record<string, unknown>>;
  slot_to_questions: Readonly<Record<string, readonly string[]>>;
  phase_to_questions: Readonly<Record<string, readonly string[]>>;
  question_catalog: Readonly<Record<string, PhaseQuestionDefinition>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidPhaseQuestionDataset(path: string, detail: string): never {
  throw new Error(`Invalid phase question dataset at ${path}: ${detail}`);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    invalidPhaseQuestionDataset(path, "expected a non-empty string");
  }
  return value;
}

function optionalNullableString(
  value: unknown,
  path: string
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    invalidPhaseQuestionDataset(path, "expected a string, null or undefined");
  }
  return value;
}

function stringArray(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) {
    invalidPhaseQuestionDataset(path, "expected an array");
  }
  return value.map((entry, index) =>
    requiredString(entry, `${path}[${index}]`)
  );
}

function normalizeQuestionCatalog(
  value: unknown
): Record<string, PhaseQuestionDefinition> {
  if (!isRecord(value)) {
    invalidPhaseQuestionDataset("question_catalog", "expected an object");
  }

  return Object.fromEntries(
    Object.entries(value).map(([catalogId, definition]) => {
      if (!isRecord(definition)) {
        invalidPhaseQuestionDataset(
          `question_catalog.${catalogId}`,
          "expected an object"
        );
      }

      const questionId = requiredString(
        definition.question_id,
        `question_catalog.${catalogId}.question_id`
      );
      if (questionId !== catalogId) {
        invalidPhaseQuestionDataset(
          `question_catalog.${catalogId}.question_id`,
          `expected '${catalogId}', received '${questionId}'`
        );
      }

      const phaseCode = optionalNullableString(
        definition.phase_code,
        `question_catalog.${catalogId}.phase_code`
      );
      if (phaseCode === undefined) {
        invalidPhaseQuestionDataset(
          `question_catalog.${catalogId}.phase_code`,
          "expected a string or null"
        );
      }

      return [
        catalogId,
        {
          question_id: questionId,
          question_text: requiredString(
            definition.question_text,
            `question_catalog.${catalogId}.question_text`
          ),
          phase_code: phaseCode,
          theme: optionalNullableString(
            definition.theme,
            `question_catalog.${catalogId}.theme`
          ),
          subtheme: optionalNullableString(
            definition.subtheme,
            `question_catalog.${catalogId}.subtheme`
          ),
          fills_slots: stringArray(
            definition.fills_slots,
            `question_catalog.${catalogId}.fills_slots`
          )
        }
      ];
    })
  );
}

function questionIdOf(reference: unknown, path: string): string {
  if (typeof reference === "string") {
    return requiredString(reference, path);
  }
  if (!isRecord(reference)) {
    invalidPhaseQuestionDataset(
      path,
      "expected a question id or an object with question_id"
    );
  }

  if (
    reference.question_text !== undefined &&
    typeof reference.question_text !== "string"
  ) {
    invalidPhaseQuestionDataset(
      `${path}.question_text`,
      "expected a string when present"
    );
  }
  if (reference.reason !== undefined && typeof reference.reason !== "string") {
    invalidPhaseQuestionDataset(
      `${path}.reason`,
      "expected a string when present"
    );
  }

  return requiredString(reference.question_id, `${path}.question_id`);
}

function normalizeQuestionReferences(
  value: unknown,
  path: "slot_to_questions" | "phase_to_questions",
  catalog: Readonly<Record<string, PhaseQuestionDefinition>>
): Record<string, readonly string[]> {
  if (!isRecord(value)) {
    invalidPhaseQuestionDataset(path, "expected an object");
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, references]) => {
      if (!Array.isArray(references)) {
        invalidPhaseQuestionDataset(`${path}.${key}`, "expected an array");
      }

      const ids = references.map((reference, index) => {
        const questionId = questionIdOf(
          reference,
          `${path}.${key}[${index}]`
        );
        if (!catalog[questionId]) {
          invalidPhaseQuestionDataset(
            `${path}.${key}[${index}]`,
            `question_id '${questionId}' does not exist in question_catalog`
          );
        }
        return questionId;
      });

      return [key, ids];
    })
  );
}

// Single validation and normalization boundary from on-disk JSON to the
// existing detector contract. Invalid references fail during loading instead
// of silently reaching the detector's global question fallback.
export function normalizePhaseQuestionDataset(
  raw: unknown
): PhaseQuestionDataset {
  if (!isRecord(raw)) {
    invalidPhaseQuestionDataset("root", "expected an object");
  }

  const catalog = normalizeQuestionCatalog(raw.question_catalog);

  return {
    schema_version: requiredString(raw.schema_version, "schema_version"),
    generated_at: requiredString(raw.generated_at, "generated_at"),
    slots: stringArray(raw.slots, "slots"),
    slot_to_questions: normalizeQuestionReferences(
      raw.slot_to_questions,
      "slot_to_questions",
      catalog
    ),
    phase_to_questions: normalizeQuestionReferences(
      raw.phase_to_questions,
      "phase_to_questions",
      catalog
    ),
    question_catalog: catalog
  };
}

export interface PhaseExitCriterion {
  type: "intent" | "slots_present" | string;
  intent?: string;
  slots?: readonly string[];
}

export interface PhaseRuleDefinition {
  code: string;
  title: string;
  description: string;
  sort: number;
  required_slots: readonly string[];
  optional_slots: readonly string[];
  exit_criteria: readonly PhaseExitCriterion[];
  next_phase_default?: string;
}

export interface PhaseRulesDataset {
  schema_version: string;
  generated_at: string;
  audience: string;
  slots: Readonly<Record<string, unknown>>;
  phases: readonly PhaseRuleDefinition[];
  classification: {
    allowed_phase_codes: readonly string[];
    policy: Readonly<Record<string, string>>;
  };
}

export interface JourneyPhaseDefinition {
  id: string;
  title: string;
  code: string;
  description: string;
  color: string;
  sort: number;
  status: string;
  date_created: string;
  date_updated?: string | null;
}

export interface RouteAnswerDependency {
  related_route_answers_id: {
    id: string;
  };
}

export interface RouteAnswerDefinition {
  id: string;
  status: string;
  title: string;
  description?: string;
  question: string;
  sort: number;
  requires_answers: readonly RouteAnswerDependency[];
}

export interface RouteQuestionDefinition {
  id: string;
  question: string;
  description?: string;
  status: string;
  sort: number;
  answers: readonly RouteAnswerDefinition[];
}

export interface RouteStepDefinition {
  id: string;
  unique_name: string;
  short_title: string;
  long_title: string;
  slug: string;
  status: string;
  duration_in_months?: number | null;
  body?: unknown;
  faqs: readonly unknown[];
  articles: readonly unknown[];
}

export interface RouteRequirementRelation {
  id: number;
  routes_id: string;
  route_answers_id: string | null;
}

export interface RouteStepRelation {
  id: number;
  routes_id: string;
  route_steps_id: string;
  sort: number;
}

export interface RouteDefinition {
  id?: string;
  title: string;
  slug: string;
  status: string;
  date_created: string;
  date_updated?: string | null;
  requires_answers: readonly RouteRequirementRelation[];
  route_steps: readonly RouteStepRelation[];
}

export interface PhaseSystemDataset {
  schema_version: string;
  system_key: "phase-4" | "phase-5" | "phase-9";
  title: string;
  description: string;
  phases: readonly {
    code: string;
    title: string;
    sort: number;
    canonical_range: readonly string[];
    entry_criteria: readonly unknown[];
    exit_criteria: readonly unknown[];
    required_slots: readonly string[];
    optional_slots: readonly string[];
    allowed_previous_phases: readonly string[];
    allowed_next_phases: readonly string[];
    default_next_phase?: string | null;
  }[];
}

export interface DomainDatasets {
  phaseQuestions: PhaseQuestionDataset;
  phaseRules: PhaseRulesDataset;
  journeyPhases: readonly JourneyPhaseDefinition[];
  routeQuestions: readonly RouteQuestionDefinition[];
  routes: readonly RouteDefinition[];
  routeSteps: readonly RouteStepDefinition[];
  phaseSystems: readonly PhaseSystemDataset[];
}

async function loadJson<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as T;
}

export async function loadDomainDatasets(
  datasetDirectory: string
): Promise<DomainDatasets> {
  return {
    phaseQuestions: normalizePhaseQuestionDataset(
      await loadJson<unknown>(
        `${datasetDirectory}/phase-detector-questions.json`
      )
    ),
    phaseRules: await loadJson<PhaseRulesDataset>(
      `${datasetDirectory}/phase-detector-rules.json`
    ),
    journeyPhases: await loadJson<readonly JourneyPhaseDefinition[]>(
      `${datasetDirectory}/journey-phases.json`
    ),
    routeQuestions: await loadJson<readonly RouteQuestionDefinition[]>(
      `${datasetDirectory}/route-questions.json`
    ),
    routes: await loadJson<readonly RouteDefinition[]>(
      `${datasetDirectory}/routes.json`
    ),
    routeSteps: await loadJson<readonly RouteStepDefinition[]>(
      `${datasetDirectory}/route-steps.json`
    ),
    phaseSystems: await Promise.all(
      [
        "phase-system-4.json",
        "phase-system-5.json",
        "phase-system-9.json"
      ].map((filename) =>
        loadJson<PhaseSystemDataset>(
          `${datasetDirectory}/${filename}`
        )
      )
    )
  };
}
