import type {
  AdvisorChatRequest,
  ChatArtifact,
  ChatRequest,
  ChatResponse,
  ConversationDto,
  MessageDto,
  ProposedMutation,
  SourceReference,
  StructuredResponse,
  VerifiedLink
} from "@door010/contracts";
import type {
  AdaptivePhaseDetector,
  AdaptivePhaseDetectorResult,
  ProfileSlot,
  RouteEngine,
  RouteEngineResult
} from "@door010/domain";
import { createStructuredResponse } from "@door010/response-pipeline";

export interface ChatOrchestrator {
  respond(request: ChatRequest): Promise<ChatResponse>;
}

export interface GraphMemoryChatContext {
  activeGoals: readonly string[];
  openBlockers: readonly string[];
  pendingActions: readonly string[];
  evidenceClaims: readonly string[];
}

export interface PersonalGraphContextProvider {
  getGraphContext(
    userId: string
  ): Promise<GraphMemoryChatContext | undefined>;
}

export interface ChatContext {
  organizationId?: string;
  profileId?: string;
  currentPhaseCode?: string;
  completedPhaseCodes?: readonly string[];
  slots: readonly ProfileSlot[];
  selectedEntities?: Readonly<Record<string, string | null | undefined>>;
  events?: readonly string[];
  intents?: readonly string[];
  routeAnswerIds?: readonly string[];
  graphMemory?: GraphMemoryChatContext;
}

export interface ChatContextProvider {
  getContext(request: ChatRequest): Promise<ChatContext>;
}

export interface ChatPersistence {
  ensureConversation(input: {
    conversationId?: string;
    userId?: string;
    title: string;
    type: "general-ai" | "personal-ai" | "advisor";
  }): Promise<ConversationDto>;
  appendMessage(message: MessageDto): Promise<void>;
  savePhaseEvaluation(
    profileId: string,
    result: AdaptivePhaseDetectorResult
  ): Promise<void>;
  saveDetectorSnapshot(input: {
    profileId: string;
    conversationId?: string;
    detectorInput: Readonly<Record<string, unknown>>;
    detectorOutput: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

export interface AnswerDraft {
  directAnswer: string;
  supportingDetail?: string;
  verifiedLinks?: readonly VerifiedLink[];
  sources?: readonly SourceReference[];
}

export interface AnswerDraftProvider {
  createDraft(
    chatbotKey: "general-coach" | "personal-journey-coach",
    request: ChatRequest,
    context: ChatContext,
    phase?: AdaptivePhaseDetectorResult,
    route?: RouteEngineResult,
    systemPrompt?: string
  ): Promise<AnswerDraft>;
}

export interface ActivePromptProvider {
  getActivePrompt(
    chatbotKey: "general-coach" | "personal-journey-coach",
    configKey?: string
  ): Promise<string | undefined>;
}

export class EmptyActivePromptProvider implements ActivePromptProvider {
  async getActivePrompt(): Promise<undefined> {
    return undefined;
  }
}

export class EmptyChatContextProvider implements ChatContextProvider {
  async getContext(): Promise<ChatContext> {
    return { slots: [] };
  }
}

export class DeterministicAnswerDraftProvider
  implements AnswerDraftProvider
{
  async createDraft(
    chatbotKey: "general-coach" | "personal-journey-coach",
    request: ChatRequest,
    context: ChatContext,
    phase?: AdaptivePhaseDetectorResult,
    route?: RouteEngineResult,
    systemPrompt?: string
  ): Promise<AnswerDraft> {
    if (chatbotKey === "general-coach") {
      return {
        directAnswer:
          "Ik help je met algemene informatie over werken en leren in het onderwijs.",
        supportingDetail:
          `${systemPrompt ? `Actieve coachinstructie: ${systemPrompt}\n\n` : ""}` +
          `Je vraag was: "${request.message}". Ik kan je verwijzen naar opleidingen, routes, evenementen en vacatures.`
      };
    }

    const routeText = route?.bestRoute
      ? ` De best passende route is '${route.bestRoute.title}'.`
      : "";
    const graphText = context.graphMemory
      ? [
          context.graphMemory.pendingActions[0]
            ? ` Volgende actie: ${context.graphMemory.pendingActions[0]}.`
            : "",
          context.graphMemory.openBlockers[0]
            ? ` Open blokkade: ${context.graphMemory.openBlockers[0]}.`
            : ""
        ].join("")
      : "";

    return {
      directAnswer: phase
        ? `Je bent nu bezig met de stap '${phase.currentPhaseTitle}' in je traject.${routeText}${graphText}`
        : `Je persoonlijke trajectcontext is geladen.${routeText}${graphText}`,
      supportingDetail:
        `${systemPrompt ? `Actieve coachinstructie: ${systemPrompt}\n\n` : ""}` +
        (
          phase?.nextQuestion ??
          "Vul je profiel verder aan om de volgende stap te bepalen."
        )
    };
  }
}

function buildArtifacts(
  response: StructuredResponse,
  phase?: AdaptivePhaseDetectorResult,
  route?: RouteEngineResult
): ChatArtifact[] {
  const artifacts: ChatArtifact[] = response.verifiedLinks.map((link) => ({
    type: "link",
    label: link.label,
    payload: {
      href: link.href,
      sourceKey: link.sourceKey
    }
  }));

  if (response.intakeBatch) {
    artifacts.push({
      type: "intake",
      label: "Beantwoord deze korte vragen",
      payload: {
        questions: response.intakeBatch.questions,
        summaryTemplate: response.intakeBatch.summaryTemplate
      }
    });
  }

  if (phase) {
    artifacts.push({
      type: "phase-proposal",
      label: `Stap: ${phase.currentPhaseTitle}`,
      payload: {
        phaseSystemKey: phase.phaseSystem.phaseSystemKey,
        phaseSystemSource: phase.phaseSystem.source,
        currentPhaseCode: phase.phaseEvaluation.currentPhaseCode,
        mappedDetectorPhase: phase.mappedDetectorPhase,
        entrySatisfied: phase.phaseEvaluation.entrySatisfied,
        exitSatisfied: phase.phaseEvaluation.exitSatisfied,
        transitionAllowed: phase.phaseEvaluation.transitionAllowed,
        proposedNextPhase: phase.phaseEvaluation.proposedNextPhase,
        nextQuestionId: phase.nextQuestionId,
        nextQuestion: phase.nextQuestion
      }
    });
  }

  if (route?.bestRoute) {
    artifacts.push({
      type: "route",
      label: route.bestRoute.title,
      payload: {
        routeId: route.bestRoute.id,
        slug: route.bestRoute.slug,
        requiredAnswerIds: route.bestRoute.requiredAnswerIds,
        steps: route.bestRoute.steps
      }
    });
  }

  return artifacts;
}

function buildMutations(
  phase?: AdaptivePhaseDetectorResult
): ProposedMutation[] {
  if (
    !phase?.phaseEvaluation.transitionAllowed ||
    !phase.phaseEvaluation.proposedNextPhase
  ) {
    return [];
  }

  return [
    {
      type: "phase-transition",
      requiresConfirmation: true,
      payload: {
        phaseSystemKey: phase.phaseSystem.phaseSystemKey,
        from: phase.phaseEvaluation.currentPhaseCode,
        to: phase.phaseEvaluation.proposedNextPhase
      }
    }
  ];
}

export class GeneralCoach implements ChatOrchestrator {
  constructor(
    private readonly draftProvider: AnswerDraftProvider,
    private readonly persistence?: ChatPersistence,
    private readonly promptProvider: ActivePromptProvider =
      new EmptyActivePromptProvider()
  ) {}

  async respond(request: ChatRequest): Promise<ChatResponse> {
    const conversation = this.persistence
      ? await this.persistence.ensureConversation({
          conversationId: request.conversationId,
          userId: request.userId,
          title: request.message.slice(0, 80),
          type: "general-ai"
        })
      : undefined;

    if (conversation && this.persistence) {
      await this.persistence.appendMessage({
        id: globalThis.crypto.randomUUID(),
        conversationId: conversation.id,
        role: "user",
        content: request.message,
        metadata: {},
        createdAt: new Date().toISOString()
      });
    }

    const context: ChatContext = { slots: [] };
    const systemPrompt = await this.promptProvider.getActivePrompt(
      "general-coach"
    );
    const draft = await this.draftProvider.createDraft(
      "general-coach",
      request,
      context,
      undefined,
      undefined,
      systemPrompt
    );
    const structured = createStructuredResponse({
      question: request.message,
      draft: draft.directAnswer,
      supportingDetail: draft.supportingDetail,
      verifiedLinks: draft.verifiedLinks
    });

    if (conversation && this.persistence) {
      await this.persistence.appendMessage({
        id: globalThis.crypto.randomUUID(),
        conversationId: conversation.id,
        role: "assistant_general",
        content: structured.directAnswer,
        chatbotKey: "general-coach",
        metadata: {
          answerType: structured.answerType,
          mode: structured.mode
        },
        createdAt: new Date().toISOString()
      });
    }

    return {
      chatbotKey: "general-coach",
      message: structured.directAnswer,
      artifacts: buildArtifacts(structured),
      sources: [...(draft.sources ?? [])],
      mutations: []
    };
  }
}

export class PersonalJourneyCoach implements ChatOrchestrator {
  constructor(
    private readonly contextProvider: ChatContextProvider,
    private readonly draftProvider: AnswerDraftProvider,
    private readonly detector: AdaptivePhaseDetector,
    private readonly routeEngine: RouteEngine,
    private readonly persistence?: ChatPersistence,
    private readonly promptProvider: ActivePromptProvider =
      new EmptyActivePromptProvider(),
    private readonly graphContextProvider?: PersonalGraphContextProvider
  ) {}

  async respond(request: ChatRequest): Promise<ChatResponse> {
    if (!request.userId) {
      throw new Error(
        "PersonalJourneyCoach requires an authenticated user."
      );
    }

    const baseContext = await this.contextProvider.getContext(request);
    const graphMemory =
      await this.graphContextProvider?.getGraphContext(request.userId);
    const context: ChatContext = {
      ...baseContext,
      graphMemory
    };
    const conversation = this.persistence
      ? await this.persistence.ensureConversation({
          conversationId: request.conversationId,
          userId: request.userId,
          title: request.message.slice(0, 80),
          type: "personal-ai"
        })
      : undefined;

    if (conversation && this.persistence) {
      await this.persistence.appendMessage({
        id: globalThis.crypto.randomUUID(),
        conversationId: conversation.id,
        role: "user",
        content: request.message,
        metadata: {},
        createdAt: new Date().toISOString()
      });
    }

    const detectorInput = {
      organizationId: context.organizationId,
      userId: request.userId,
      conversationId: conversation?.id ?? request.conversationId,
      currentPhaseCode: context.currentPhaseCode,
      completedPhaseCodes: context.completedPhaseCodes,
      knownSlots: context.slots,
      selectedEntities: context.selectedEntities,
      events: context.events,
      intents: context.intents
    };

    const phase = await this.detector.evaluate(detectorInput);
    const route = this.routeEngine.evaluate({
      selectedAnswerIds: context.routeAnswerIds ?? []
    });

    if (context.profileId && this.persistence) {
      await this.persistence.savePhaseEvaluation(
        context.profileId,
        phase
      );
      await this.persistence.saveDetectorSnapshot({
        profileId: context.profileId,
        conversationId: conversation?.id ?? request.conversationId,
        detectorInput,
        detectorOutput: phase as unknown as Readonly<Record<string, unknown>>
      });
    }

    const systemPrompt = await this.promptProvider.getActivePrompt(
      "personal-journey-coach"
    );
    const draft = await this.draftProvider.createDraft(
      "personal-journey-coach",
      request,
      context,
      phase,
      route,
      systemPrompt
    );
    const structured = createStructuredResponse({
      question: request.message,
      draft: draft.directAnswer,
      supportingDetail: draft.supportingDetail,
      verifiedLinks: draft.verifiedLinks,
      missingSector: !context.slots.some(
        (slot) => slot.key === "school_type" && slot.value
      ),
      missingLevel: !context.slots.some(
        (slot) =>
          slot.key === "admission_requirements" && slot.value
      )
    });

    if (conversation && this.persistence) {
      await this.persistence.appendMessage({
        id: globalThis.crypto.randomUUID(),
        conversationId: conversation.id,
        role: "assistant_personal",
        content: structured.directAnswer,
        chatbotKey: "personal-journey-coach",
        metadata: {
          answerType: structured.answerType,
          mode: structured.mode,
          phaseSystemKey: phase.phaseSystem.phaseSystemKey,
          phaseCode: phase.phaseEvaluation.currentPhaseCode,
          routeId: route.bestRoute?.id
        },
        createdAt: new Date().toISOString()
      });
    }

    return {
      chatbotKey: "personal-journey-coach",
      message: structured.directAnswer,
      artifacts: buildArtifacts(structured, phase, route),
      sources: [...(draft.sources ?? [])],
      mutations: buildMutations(phase)
    };
  }
}

export interface AdvisorChatPersistence {
  ensureConversation(input: {
    conversationId: string;
    candidateUserId: string;
  }): Promise<ConversationDto>;
  findConversation(
    conversationId: string
  ): Promise<ConversationDto | null>;
  appendMessage(message: MessageDto): Promise<void>;
  listMessages(
    conversationId: string
  ): Promise<readonly MessageDto[]>;
}

export class AdvisorChatService {
  constructor(
    private readonly persistence: AdvisorChatPersistence
  ) {}

  async send(request: AdvisorChatRequest): Promise<MessageDto> {
    await this.persistence.ensureConversation({
      conversationId: request.conversationId,
      candidateUserId: request.candidateUserId
    });

    const message: MessageDto = {
      id: globalThis.crypto.randomUUID(),
      conversationId: request.conversationId,
      role: "advisor",
      content: request.message,
      advisorUserId: request.advisorUserId,
      metadata: {
        candidateUserId: request.candidateUserId
      },
      createdAt: new Date().toISOString()
    };

    await this.persistence.appendMessage(message);
    return message;
  }

  async sendCandidate(input: {
    conversationId: string;
    candidateUserId: string;
    message: string;
  }): Promise<MessageDto> {
    await this.persistence.ensureConversation({
      conversationId: input.conversationId,
      candidateUserId: input.candidateUserId
    });

    const message: MessageDto = {
      id: globalThis.crypto.randomUUID(),
      conversationId: input.conversationId,
      role: "user",
      content: input.message,
      metadata: {
        candidateUserId: input.candidateUserId,
        channel: "human-advisor"
      },
      createdAt: new Date().toISOString()
    };

    await this.persistence.appendMessage(message);
    return message;
  }

  async canAccess(
    conversationId: string,
    userId: string,
    privileged: boolean
  ): Promise<boolean> {
    if (privileged) return true;

    const conversation = await this.persistence.findConversation(
      conversationId
    );
    return conversation?.userId === userId;
  }

  async history(
    conversationId: string
  ): Promise<readonly MessageDto[]> {
    return this.persistence.listMessages(conversationId);
  }
}

export class MockGeneralCoach extends GeneralCoach {
  constructor() {
    super(new DeterministicAnswerDraftProvider());
  }
}

export class MockPersonalJourneyCoach
  implements ChatOrchestrator
{
  async respond(request: ChatRequest): Promise<ChatResponse> {
    if (!request.userId) {
      throw new Error(
        "PersonalJourneyCoach requires an authenticated user."
      );
    }

    return {
      chatbotKey: "personal-journey-coach",
      message:
        "De persoonlijke coach vereist detector-, route- en contextinjectie.",
      artifacts: [],
      sources: [],
      mutations: []
    };
  }
}

export * from "./memory-persistence.js";

export * from "./mutations.js";
