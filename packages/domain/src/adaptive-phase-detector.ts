import type {
  PhaseQuestionDataset,
  PhaseRulesDataset
} from "./datasets.js";
import {
  PhaseDetector,
  type PhaseDetectorInput,
  type PhaseDetectorResult
} from "./phase-engine.js";
import type {
  PhaseContext,
  PhaseEvaluation,
  PhaseSystemKey
} from "./phase-systems.js";
import {
  PhaseSystemRegistry,
  PhaseSystemMapper,
  PhaseTransitionEngine
} from "./phase-systems.js";
import {
  PhaseSystemPreferenceResolver,
  type PhaseSystemPreferenceContext,
  type PhaseSystemResolution
} from "./phase-system-preferences.js";

export interface AdaptivePhaseDetectorInput
  extends PhaseDetectorInput,
    PhaseSystemPreferenceContext {
  currentPhaseCode?: string;
  completedPhaseCodes?: readonly string[];
  selectedEntities?: Readonly<Record<string, string | null | undefined>>;
  events?: readonly string[];
  intents?: readonly string[];
}

export interface AdaptivePhaseDetectorResult
  extends PhaseDetectorResult {
  phaseSystem: PhaseSystemResolution;
  phaseEvaluation: PhaseEvaluation;
  currentPhaseTitle: string;
  mappedDetectorPhase: string;
}

function mapToDetectorPhase(
  registry: PhaseSystemRegistry,
  systemKey: PhaseSystemKey,
  phaseCode: string
): string {
  if (systemKey === "phase-5") {
    return phaseCode;
  }

  const mapper = new PhaseSystemMapper(registry);
  return mapper.switchSystem(
    systemKey,
    "phase-5",
    phaseCode
  ).targetPhaseCode;
}

export class AdaptivePhaseDetector {
  private readonly detector: PhaseDetector;
  private readonly transitionEngine: PhaseTransitionEngine;

  constructor(
    rules: PhaseRulesDataset,
    questions: PhaseQuestionDataset,
    private readonly registry: PhaseSystemRegistry,
    private readonly preferenceResolver: PhaseSystemPreferenceResolver,
    confidenceThreshold = 0.45
  ) {
    this.detector = new PhaseDetector(
      rules,
      questions,
      confidenceThreshold,
      "phase-detector-v3"
    );
    this.transitionEngine = new PhaseTransitionEngine(registry);
  }

  async evaluate(
    input: AdaptivePhaseDetectorInput
  ): Promise<AdaptivePhaseDetectorResult> {
    const phaseSystem = await this.preferenceResolver.resolve({
      organizationId: input.organizationId,
      userId: input.userId,
      conversationId: input.conversationId
    });

    const system = this.registry.get(phaseSystem.phaseSystemKey);
    const currentPhaseCode =
      input.currentPhaseCode ??
      system.phases[0]?.code;

    if (!currentPhaseCode) {
      throw new Error(
        `Phase system '${phaseSystem.phaseSystemKey}' has no phases.`
      );
    }

    const currentPhase = system.phases.find(
      (candidate) => candidate.code === currentPhaseCode
    );
    if (!currentPhase) {
      throw new Error(
        `Unknown phase '${currentPhaseCode}' for ${phaseSystem.phaseSystemKey}.`
      );
    }

    const mappedDetectorPhase = mapToDetectorPhase(
      this.registry,
      phaseSystem.phaseSystemKey,
      currentPhaseCode
    );

    const detectorResult = this.detector.evaluate({
      ...input,
      currentPhaseKey: mappedDetectorPhase,
      detectedIntents: input.detectedIntents ?? input.intents
    });

    const phaseContext: PhaseContext = {
      slots: input.knownSlots,
      completedPhases: input.completedPhaseCodes,
      selectedEntities: input.selectedEntities,
      events: input.events,
      intents: input.intents ?? input.detectedIntents
    };

    const phaseEvaluation = this.transitionEngine.evaluate(
      phaseSystem.phaseSystemKey,
      currentPhaseCode,
      phaseContext
    );

    return {
      ...detectorResult,
      phaseSystem,
      phaseEvaluation,
      currentPhaseTitle: currentPhase.title,
      mappedDetectorPhase
    };
  }
}
