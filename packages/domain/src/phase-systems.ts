import type { ProfileSlot, ProfileSlotKey } from "./index.js";

export type PhaseSystemKey = "phase-4" | "phase-5" | "phase-9";

export type PhaseCriterion =
  | { type: "always" }
  | { type: "slot_present"; slot: ProfileSlotKey }
  | { type: "phase_completed"; phase: string }
  | { type: "entity_selected"; entity: string }
  | { type: "event_recorded"; event: string }
  | { type: "intent"; intent: string };

export interface PhaseDefinition {
  code: string;
  title: string;
  sort: number;
  canonical_range: readonly string[];
  entry_criteria: readonly PhaseCriterion[];
  exit_criteria: readonly PhaseCriterion[];
  required_slots: readonly ProfileSlotKey[];
  optional_slots: readonly ProfileSlotKey[];
  allowed_previous_phases: readonly string[];
  allowed_next_phases: readonly string[];
  default_next_phase?: string | null;
}

export interface PhaseSystemDefinition {
  schema_version: string;
  system_key: PhaseSystemKey;
  title: string;
  description: string;
  phases: readonly PhaseDefinition[];
}

export interface PhaseContext {
  slots: readonly ProfileSlot[];
  completedPhases?: readonly string[];
  selectedEntities?: Readonly<Record<string, string | null | undefined>>;
  events?: readonly string[];
  intents?: readonly string[];
}

export interface CriterionResult {
  criterion: PhaseCriterion;
  satisfied: boolean;
  reason: string;
}

export interface PhaseEvaluation {
  phaseSystemKey: PhaseSystemKey;
  currentPhaseCode: string;
  entrySatisfied: boolean;
  exitSatisfied: boolean;
  entryResults: readonly CriterionResult[];
  exitResults: readonly CriterionResult[];
  missingEntryCriteria: readonly PhaseCriterion[];
  missingExitCriteria: readonly PhaseCriterion[];
  proposedNextPhase?: string;
  transitionAllowed: boolean;
}

export interface PhaseSystemSwitchResult {
  sourceSystem: PhaseSystemKey;
  targetSystem: PhaseSystemKey;
  sourcePhaseCode: string;
  targetPhaseCode: string;
  canonicalPosition: string;
  exact: boolean;
}

function hasSlotValue(slot: ProfileSlot | undefined): boolean {
  if (!slot) return false;
  return (
    slot.value !== null &&
    slot.value !== "" &&
    (!Array.isArray(slot.value) || slot.value.length > 0)
  );
}

export class PhaseCriterionEvaluator {
  evaluate(
    criterion: PhaseCriterion,
    context: PhaseContext
  ): CriterionResult {
    const slots = new Map(context.slots.map((slot) => [slot.key, slot]));
    const completed = new Set(context.completedPhases ?? []);
    const events = new Set(context.events ?? []);
    const intents = new Set(context.intents ?? []);

    switch (criterion.type) {
      case "always":
        return { criterion, satisfied: true, reason: "always" };
      case "slot_present": {
        const satisfied = hasSlotValue(slots.get(criterion.slot));
        return {
          criterion,
          satisfied,
          reason: satisfied
            ? `slot:${criterion.slot}:present`
            : `slot:${criterion.slot}:missing`
        };
      }
      case "phase_completed": {
        const satisfied = completed.has(criterion.phase);
        return {
          criterion,
          satisfied,
          reason: satisfied
            ? `phase:${criterion.phase}:completed`
            : `phase:${criterion.phase}:not-completed`
        };
      }
      case "entity_selected": {
        const satisfied = Boolean(
          context.selectedEntities?.[criterion.entity]
        );
        return {
          criterion,
          satisfied,
          reason: satisfied
            ? `entity:${criterion.entity}:selected`
            : `entity:${criterion.entity}:missing`
        };
      }
      case "event_recorded": {
        const satisfied = events.has(criterion.event);
        return {
          criterion,
          satisfied,
          reason: satisfied
            ? `event:${criterion.event}:recorded`
            : `event:${criterion.event}:missing`
        };
      }
      case "intent": {
        const satisfied = intents.has(criterion.intent);
        return {
          criterion,
          satisfied,
          reason: satisfied
            ? `intent:${criterion.intent}:detected`
            : `intent:${criterion.intent}:missing`
        };
      }
    }
  }
}

export class PhaseSystemRegistry {
  private readonly systems: ReadonlyMap<
    PhaseSystemKey,
    PhaseSystemDefinition
  >;

  constructor(definitions: readonly PhaseSystemDefinition[]) {
    this.systems = new Map(
      definitions.map((definition) => [
        definition.system_key,
        definition
      ])
    );
  }

  get(systemKey: PhaseSystemKey): PhaseSystemDefinition {
    const definition = this.systems.get(systemKey);
    if (!definition) {
      throw new Error(`Unknown phase system: ${systemKey}`);
    }
    return definition;
  }

  list(): readonly PhaseSystemDefinition[] {
    return [...this.systems.values()];
  }
}

export class PhaseTransitionEngine {
  constructor(
    private readonly registry: PhaseSystemRegistry,
    private readonly evaluator = new PhaseCriterionEvaluator()
  ) {}

  evaluate(
    systemKey: PhaseSystemKey,
    currentPhaseCode: string,
    context: PhaseContext
  ): PhaseEvaluation {
    const system = this.registry.get(systemKey);
    const current = system.phases.find(
      (candidate) => candidate.code === currentPhaseCode
    );
    if (!current) {
      throw new Error(
        `Unknown phase '${currentPhaseCode}' for ${systemKey}.`
      );
    }

    const entryResults = current.entry_criteria.map((criterion) =>
      this.evaluator.evaluate(criterion, context)
    );
    const exitResults = current.exit_criteria.map((criterion) =>
      this.evaluator.evaluate(criterion, context)
    );
    const entrySatisfied = entryResults.every((result) => result.satisfied);
    const exitSatisfied = exitResults.every((result) => result.satisfied);
    const proposedNextPhase =
      exitSatisfied && current.default_next_phase
        ? current.default_next_phase
        : undefined;

    const next = proposedNextPhase
      ? system.phases.find((candidate) => candidate.code === proposedNextPhase)
      : undefined;

    const nextContext: PhaseContext = {
      ...context,
      completedPhases: [
        ...(context.completedPhases ?? []),
        current.code
      ]
    };
    const nextEntrySatisfied = next
      ? next.entry_criteria.every(
          (criterion) =>
            this.evaluator.evaluate(criterion, nextContext).satisfied
        )
      : false;

    return {
      phaseSystemKey: systemKey,
      currentPhaseCode,
      entrySatisfied,
      exitSatisfied,
      entryResults,
      exitResults,
      missingEntryCriteria: entryResults
        .filter((result) => !result.satisfied)
        .map((result) => result.criterion),
      missingExitCriteria: exitResults
        .filter((result) => !result.satisfied)
        .map((result) => result.criterion),
      proposedNextPhase,
      transitionAllowed:
        Boolean(proposedNextPhase) &&
        exitSatisfied &&
        nextEntrySatisfied &&
        current.allowed_next_phases.includes(proposedNextPhase!)
    };
  }
}

const CANONICAL_ORDER = [
  "interesse",
  "orientatie",
  "beslissing",
  "matching",
  "voorbereiding",
  "start",
  "opleiding",
  "inductie",
  "behoud"
] as const;

export class PhaseSystemMapper {
  constructor(private readonly registry: PhaseSystemRegistry) {}

  switchSystem(
    sourceSystem: PhaseSystemKey,
    targetSystem: PhaseSystemKey,
    sourcePhaseCode: string
  ): PhaseSystemSwitchResult {
    const source = this.registry.get(sourceSystem);
    const target = this.registry.get(targetSystem);
    const sourcePhase = source.phases.find(
      (phase) => phase.code === sourcePhaseCode
    );
    if (!sourcePhase) {
      throw new Error(
        `Unknown source phase '${sourcePhaseCode}' for ${sourceSystem}.`
      );
    }

    const canonicalPosition =
      sourcePhase.canonical_range[sourcePhase.canonical_range.length - 1] ??
      sourcePhase.code;

    const exactTarget = target.phases.find((phase) =>
      phase.canonical_range.includes(canonicalPosition)
    );
    if (exactTarget) {
      return {
        sourceSystem,
        targetSystem,
        sourcePhaseCode,
        targetPhaseCode: exactTarget.code,
        canonicalPosition,
        exact: true
      };
    }

    const canonicalIndex = CANONICAL_ORDER.indexOf(
      canonicalPosition as (typeof CANONICAL_ORDER)[number]
    );

    const fallback = [...target.phases]
      .sort((left, right) => right.sort - left.sort)
      .find((phase) =>
        phase.canonical_range.some((candidate) => {
          const index = CANONICAL_ORDER.indexOf(
            candidate as (typeof CANONICAL_ORDER)[number]
          );
          return index <= canonicalIndex;
        })
      ) ?? target.phases[0];

    if (!fallback) {
      throw new Error(`Target system '${targetSystem}' has no phases.`);
    }

    return {
      sourceSystem,
      targetSystem,
      sourcePhaseCode,
      targetPhaseCode: fallback.code,
      canonicalPosition,
      exact: false
    };
  }
}
