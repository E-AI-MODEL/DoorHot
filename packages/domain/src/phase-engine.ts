import type {
  PhaseQuestionDefinition,
  PhaseQuestionDataset,
  PhaseRulesDataset
} from "./datasets.js";
import type {
  ProfileSlot,
  ProfileSlotKey
} from "./index.js";

export interface PhaseDetectorInput {
  conversation?: readonly {
    role: "user" | "assistant";
    text: string;
    timestamp?: string;
  }[];
  knownSlots: readonly ProfileSlot[];
  locale?: string;
  currentPhaseKey?: string;
  explicitPhaseKey?: string;
  detectedIntents?: readonly string[];
  modelSuggestion?: {
    phaseCurrent?: string;
    confidence?: number;
    evidence?: readonly string[];
    nextSlotKey?: string;
  };
}

export interface PhaseDetectorResult {
  audience: string;
  phaseCurrent: string;
  phaseConfidence: number;
  evidence: readonly string[];
  missingSlots: readonly ProfileSlotKey[];
  nextSlotKey: ProfileSlotKey | null;
  nextQuestionId: string;
  nextQuestion: string;
  nextPhaseTarget?: string;
  fallbackUsed: boolean;
  debug: {
    currentPhaseSource: "explicit" | "current" | "model" | "default";
    requiredSlots: readonly string[];
    optionalSlots: readonly string[];
    questionSelectionReason:
      | "missing-required-slot"
      | "missing-optional-slot"
      | "phase-question"
      | "global-fallback";
    modelSuggestionAccepted: boolean;
  };
}

function hasValue(slot: ProfileSlot | undefined): boolean {
  if (!slot) {
    return false;
  }

  return (
    slot.value !== null &&
    slot.value !== "" &&
    (!Array.isArray(slot.value) || slot.value.length > 0)
  );
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getQuestion(
  dataset: PhaseQuestionDataset,
  questionId: string | undefined
): PhaseQuestionDefinition | null {
  if (!questionId) {
    return null;
  }

  return dataset.question_catalog[questionId] ?? null;
}

export class PhaseDetector {
  constructor(
    private readonly rules: PhaseRulesDataset,
    private readonly questions: PhaseQuestionDataset,
    private readonly confidenceThreshold = 0.45,
    private readonly engineVersion = "phase-detector-v2"
  ) {}

  evaluate(input: PhaseDetectorInput): PhaseDetectorResult {
    const allowed = new Set(this.rules.classification.allowed_phase_codes);
    const phases = [...this.rules.phases].sort(
      (left, right) => left.sort - right.sort
    );
    const slotMap = new Map(input.knownSlots.map((slot) => [slot.key, slot]));
    const intents = new Set(input.detectedIntents ?? []);
    const model = input.modelSuggestion;

    const explicitPhase =
      input.explicitPhaseKey && allowed.has(input.explicitPhaseKey)
        ? input.explicitPhaseKey
        : undefined;
    const currentPhase =
      input.currentPhaseKey && allowed.has(input.currentPhaseKey)
        ? input.currentPhaseKey
        : undefined;
    const modelPhase =
      model?.phaseCurrent && allowed.has(model.phaseCurrent)
        ? model.phaseCurrent
        : undefined;

    let phaseSource: PhaseDetectorResult["debug"]["currentPhaseSource"];
    let phaseCurrent: string;

    if (explicitPhase) {
      phaseSource = "explicit";
      phaseCurrent = explicitPhase;
    } else if (currentPhase) {
      phaseSource = "current";
      phaseCurrent = currentPhase;
    } else if (modelPhase) {
      phaseSource = "model";
      phaseCurrent = modelPhase;
    } else {
      phaseSource = "default";
      phaseCurrent = phases[0]?.code ?? "interesse";
    }

    const selected =
      phases.find((phase) => phase.code === phaseCurrent) ?? phases[0];

    if (!selected) {
      throw new Error("Phase rules contain no valid phases.");
    }

    const missingRequired = selected.required_slots.filter(
      (slotKey) => !hasValue(slotMap.get(slotKey as ProfileSlotKey))
    );
    const missingOptional = selected.optional_slots.filter(
      (slotKey) => !hasValue(slotMap.get(slotKey as ProfileSlotKey))
    );

    const requiredFulfilled =
      selected.required_slots.length - missingRequired.length;
    const deterministicConfidence =
      selected.required_slots.length === 0
        ? 1
        : requiredFulfilled / selected.required_slots.length;

    const modelConfidence =
      typeof model?.confidence === "number"
        ? clampConfidence(model.confidence)
        : null;

    const modelSuggestionAccepted =
      phaseSource === "model" &&
      modelConfidence !== null &&
      modelConfidence >= this.confidenceThreshold;

    let phaseConfidence =
      modelSuggestionAccepted && modelConfidence !== null
        ? modelConfidence
        : deterministicConfidence;

    let fallbackUsed = false;
    if (phaseConfidence < this.confidenceThreshold) {
      fallbackUsed = true;
      phaseConfidence = deterministicConfidence;
    }

    const evidence = [
      ...selected.required_slots
        .filter((slotKey) => hasValue(slotMap.get(slotKey as ProfileSlotKey)))
        .map((slotKey) => `slot:${slotKey}`),
      ...(modelSuggestionAccepted ? model?.evidence ?? [] : [])
    ];

    const modelNextSlot =
      modelSuggestionAccepted &&
      model?.nextSlotKey &&
      Object.prototype.hasOwnProperty.call(
        this.questions.slot_to_questions,
        model.nextSlotKey
      )
        ? model.nextSlotKey
        : null;

    let nextSlotKey: string | null =
      modelNextSlot ??
      missingRequired[0] ??
      missingOptional[0] ??
      null;

    let questionSelectionReason:
      PhaseDetectorResult["debug"]["questionSelectionReason"];
    let questionId: string | undefined;

    if (nextSlotKey && missingRequired.includes(nextSlotKey as never)) {
      questionSelectionReason = "missing-required-slot";
      questionId = this.questions.slot_to_questions[nextSlotKey]?.[0];
    } else if (nextSlotKey && missingOptional.includes(nextSlotKey as never)) {
      questionSelectionReason = "missing-optional-slot";
      questionId = this.questions.slot_to_questions[nextSlotKey]?.[0];
    } else {
      const phaseQuestions =
        this.questions.phase_to_questions[selected.code] ?? [];
      questionId = phaseQuestions[0];
      questionSelectionReason = "phase-question";
    }

    let question = getQuestion(this.questions, questionId);

    if (!question) {
      const globalQuestionId =
        Object.keys(this.questions.question_catalog)[0];
      question = getQuestion(this.questions, globalQuestionId);
      questionId = globalQuestionId;
      nextSlotKey = null;
      questionSelectionReason = "global-fallback";
      fallbackUsed = true;
    }

    if (!question || !questionId || !question.question_text.trim()) {
      throw new Error(
        "Phase question dataset cannot provide a valid next question."
      );
    }

    const nextPhaseTarget = selected.exit_criteria.some((criterion) => {
      if (criterion.type === "intent" && criterion.intent) {
        return intents.has(criterion.intent);
      }

      if (criterion.type === "slots_present" && criterion.slots) {
        return criterion.slots.every((slotKey) =>
          hasValue(slotMap.get(slotKey as ProfileSlotKey))
        );
      }

      return false;
    })
      ? selected.next_phase_default
      : undefined;

    return {
      audience: this.rules.audience,
      phaseCurrent: selected.code,
      phaseConfidence,
      evidence,
      missingSlots: missingRequired as ProfileSlotKey[],
      nextSlotKey: nextSlotKey as ProfileSlotKey | null,
      nextQuestionId: questionId,
      nextQuestion: question.question_text,
      nextPhaseTarget,
      fallbackUsed,
      debug: {
        currentPhaseSource: phaseSource,
        requiredSlots: selected.required_slots,
        optionalSlots: selected.optional_slots,
        questionSelectionReason,
        modelSuggestionAccepted
      }
    };
  }

  get version(): string {
    return this.engineVersion;
  }
}
