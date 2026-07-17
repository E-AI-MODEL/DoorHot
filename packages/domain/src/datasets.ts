import { readFile } from "node:fs/promises";

export interface PhaseQuestionDefinition {
  question_id: string;
  question_text: string;
  phase_code: string;
  theme?: string | null;
  subtheme?: string | null;
  fills_slots: readonly string[];
}

export interface PhaseQuestionDataset {
  schema_version: string;
  generated_at: string;
  slots: Readonly<Record<string, unknown>>;
  slot_to_questions: Readonly<Record<string, readonly string[]>>;
  phase_to_questions: Readonly<Record<string, readonly string[]>>;
  question_catalog: Readonly<Record<string, PhaseQuestionDefinition>>;
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
    phaseQuestions: await loadJson<PhaseQuestionDataset>(
      `${datasetDirectory}/phase-detector-questions.json`
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
