import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  AdaptivePhaseDetector,
  InMemoryJourneyRepository,
  GraphMemoryJourneyChangeListener,
  InMemoryMemoryGraphRepository,
  InMemoryPhaseSystemPreferenceRepository,
  JourneyEngine,
  JourneyGraphMemoryService,
  type MemoryGraphRepository,
  PhaseSystemPreferenceResolver,
  PhaseSystemRegistry,
  loadDomainDatasets,
  type PhaseSystemDefinition
} from "@door010/domain";
import {
  DeterministicAnswerDraftProvider,
  AdvisorChatService,
  GeneralCoach,
  InMemoryChatContextProvider,
  InMemoryConversationPersistence,
  InMemoryPendingMutationStore,
  MutationApplicationService,
  PersonalJourneyCoach
} from "@door010/chat";
import {
  AuthService,
  AuthorizationService,
  HmacTokenService,
  InMemoryObjectStorage,
  InMemoryProfileRepository,
  InMemoryUserAccountRepository,
  InMemoryUserNoteRepository,
  InMemoryUserRoleRepository,
  PasswordHasher,
  ProfileService
} from "@door010/identity-profile";
import {
  ActiveLearningKnowledgeSearch,
  AdaptiveRetrievalAnswerDraftProvider,
  AdaptiveRetrievalPipeline,
  AnswerValidationPipeline,
  ConditionalFaqReranker,
  ConnectorHealthService,
  DistributedConnectorScheduler,
  InMemoryConnectorLeaseRepository,
  DomainCatalogConnector,
  EnvironmentSecretResolver,
  FaqIngestionService,
  InMemoryConnectorRepository,
  InMemoryFuzzyKnowledgeRepository,
  InMemoryKnowledgeEmbeddingRepository,
  InMemoryKnowledgeRepository,
  InMemoryPipelineEventRepository,
  InMemoryRetrievalLabelQueueRepository,
  InMemoryShadowEvaluationRepository,
  InMemoryTrustedSourceRepository,
  JsonKnowledgeConnector,
  CsvKnowledgeConnector,
  RetryingKnowledgeConnector,
  SecretResolvingKnowledgeConnector,
  seedDomainConnectorDefinitions,
  IntentRouter,
  LearnedRerankedKnowledgeSearch,
  KnowledgeConnectorService,
  LocalSemanticEmbeddingProvider,
  ReciprocalRankFusionKnowledgeSearch,
  RegionalDeskIngestionService,
  type RegionalDeskRecord,
  RouteStepIngestionService,
  type RouteStepContentRecord,
  ShadowCrossEncoderKnowledgeSearch,
  type FaqSeedDataset,
  type LearnedRerankerModel
} from "@door010/knowledge";
import {
  InMemoryPromptRepository,
  PromptManagementService,
  RepositoryActivePromptProvider
} from "@door010/backoffice";
import {
  AuditService,
  InMemoryAuditEventRepository
} from "@door010/audit";
import { InMemoryRealtimeBroker } from "@door010/realtime";
import {
  LocalConceptCrossEncoder,
  OpenAiCompatibleAnswerDraftProvider
} from "@door010/integrations";
import {
  InAppNotificationDeliveryProvider,
  InMemoryExecutionRepository,
  InMemoryOrchestrationRepository,
  NotificationDeliveryScheduler,
  NotificationDeliveryWorker,
  InMemoryPlannerShadowRepository,
  SafeExecutionService,
  createDefaultOrchestrator,
  type AiOrchestrator,
  type ExecutionRepository,
  type OrchestrationRepository,
  type PlannerShadowRepository
} from "@door010/orchestration";
import { provisionPublicDemoAccounts } from "./demo-accounts.js";

export interface ApplicationServices {
  generalCoach: GeneralCoach;
  personalCoach: PersonalJourneyCoach;
  contextProvider: InMemoryChatContextProvider;
  mutationStore: InMemoryPendingMutationStore;
  mutationService: MutationApplicationService;
  advisorChat: AdvisorChatService;
  conversationPersistence: InMemoryConversationPersistence;
  phasePreferenceRepository:
    InMemoryPhaseSystemPreferenceRepository;
  phasePreferenceResolver: PhaseSystemPreferenceResolver;
  datasetsDirectory: string;
  storageMode: "memory";
  auth: AuthService;
  authorization: AuthorizationService;
  profileService: ProfileService;
  tokenService: HmacTokenService;
  knowledgeSearch: import("@door010/knowledge").KnowledgeSearch;
  knowledgeIngestion: FaqIngestionService;
  knowledgeRepository: InMemoryKnowledgeRepository;
  trustedSourceRepository: InMemoryTrustedSourceRepository;
  promptManagement: PromptManagementService;
  audit: AuditService;
  realtime: InMemoryRealtimeBroker;
  pipelineEvents: InMemoryPipelineEventRepository;
  shadowEvaluations: InMemoryShadowEvaluationRepository;
  labelQueue: InMemoryRetrievalLabelQueueRepository;
  connectors: InMemoryConnectorRepository;
  connectorService: KnowledgeConnectorService;
  connectorHealth: ConnectorHealthService;
  connectorScheduler: DistributedConnectorScheduler;
  journeyEngine: JourneyEngine;
  orchestrator: AiOrchestrator;
  orchestrationRepository: OrchestrationRepository;
  plannerShadowRepository: PlannerShadowRepository;
  graphMemory: JourneyGraphMemoryService;
  graphRepository: MemoryGraphRepository;
  executionService: SafeExecutionService;
  executionRepository: ExecutionRepository;
  deliveryWorker: NotificationDeliveryWorker;
  deliveryScheduler: NotificationDeliveryScheduler;
}

export async function createApplicationServices(
  datasetsDirectory =
    process.env.DATASETS_DIRECTORY ??
    resolve(process.cwd(), "datasets"),
  options: { seedDemoAccounts?: boolean } = {}
): Promise<ApplicationServices> {
  const datasets = await loadDomainDatasets(datasetsDirectory);
  const registry = new PhaseSystemRegistry(
    datasets.phaseSystems as unknown as readonly PhaseSystemDefinition[]
  );

  const phasePreferenceRepository =
    new InMemoryPhaseSystemPreferenceRepository();
  const phasePreferenceResolver =
    new PhaseSystemPreferenceResolver(
      phasePreferenceRepository,
      "phase-5"
    );


const userAccounts = new InMemoryUserAccountRepository();
const userRoles = new InMemoryUserRoleRepository();
const profiles = new InMemoryProfileRepository();
const notes = new InMemoryUserNoteRepository();
const tokenService = new HmacTokenService(
  process.env.AUTH_TOKEN_SECRET ??
    "development-secret-change-this-value-before-production"
);
const auth = new AuthService(
  userAccounts,
  userRoles,
  profiles,
  new PasswordHasher(),
  tokenService
);
if (options.seedDemoAccounts ?? true) {
  await provisionPublicDemoAccounts(auth);
}
const profileService = new ProfileService(
  profiles,
  notes,
  new InMemoryObjectStorage()
);


const knowledgeRepository =
  new InMemoryKnowledgeRepository();
const trustedSourceRepository =
  new InMemoryTrustedSourceRepository();
const embeddingProvider =
  new LocalSemanticEmbeddingProvider();
const embeddingRepository =
  new InMemoryKnowledgeEmbeddingRepository(
    knowledgeRepository
  );
const baseKnowledgeSearch =
  new ReciprocalRankFusionKnowledgeSearch(
    knowledgeRepository,
    new InMemoryFuzzyKnowledgeRepository(
      knowledgeRepository
    ),
    embeddingRepository,
    embeddingProvider,
    trustedSourceRepository
  );
const learnedRerankerModel = JSON.parse(
  await readFile(
    resolve(datasetsDirectory, "learned-reranker-model.json"),
    "utf8"
  )
) as LearnedRerankerModel;
const learnedKnowledgeSearch =
  new LearnedRerankedKnowledgeSearch(
    baseKnowledgeSearch,
    learnedRerankerModel
  );
const shadowEvaluations =
  new InMemoryShadowEvaluationRepository();
const labelQueue =
  new InMemoryRetrievalLabelQueueRepository();
const shadowKnowledgeSearch =
  new ShadowCrossEncoderKnowledgeSearch(
    learnedKnowledgeSearch,
    new LocalConceptCrossEncoder(),
    shadowEvaluations
  );
const knowledgeSearch = new ActiveLearningKnowledgeSearch(
  shadowKnowledgeSearch,
  labelQueue
);
const knowledgeIngestion = new FaqIngestionService(
  knowledgeRepository,
  trustedSourceRepository,
  baseKnowledgeSearch
);
const regionalDeskIngestion = new RegionalDeskIngestionService(
  knowledgeRepository,
  trustedSourceRepository,
  baseKnowledgeSearch
);
const routeStepIngestion = new RouteStepIngestionService(
  knowledgeRepository,
  trustedSourceRepository,
  baseKnowledgeSearch
);
const connectors = new InMemoryConnectorRepository();
const secretResolver = new EnvironmentSecretResolver();
const connectorService = new KnowledgeConnectorService(
  connectors,
  knowledgeRepository,
  baseKnowledgeSearch,
  [
    new RetryingKnowledgeConnector(
      new SecretResolvingKnowledgeConnector(
        new JsonKnowledgeConnector(),
        secretResolver
      )
    ),
    new RetryingKnowledgeConnector(
      new SecretResolvingKnowledgeConnector(
        new CsvKnowledgeConnector(),
        secretResolver
      )
    ),
    new RetryingKnowledgeConnector(
      new SecretResolvingKnowledgeConnector(
        new DomainCatalogConnector(),
        secretResolver
      )
    )
  ]
);
await seedDomainConnectorDefinitions(connectors);
const connectorHealth = new ConnectorHealthService(connectors);
const connectorLeases =
  new InMemoryConnectorLeaseRepository();
const connectorScheduler =
  new DistributedConnectorScheduler(
    connectors,
    connectorService,
    connectorLeases,
    `memory:${process.pid}`
  );
await connectorScheduler.start();
const faqSeed = JSON.parse(
  await readFile(
    resolve(datasetsDirectory, "faq-seed.json"),
    "utf8"
  )
) as FaqSeedDataset;
await knowledgeIngestion.ingest(faqSeed);
const regionalDesks = JSON.parse(
  await readFile(
    resolve(datasetsDirectory, "regional-education-desks.json"),
    "utf8"
  )
) as readonly RegionalDeskRecord[];
await regionalDeskIngestion.ingest({ desks: regionalDesks });
const routeStepContent = JSON.parse(
  await readFile(
    resolve(datasetsDirectory, "route-steps.json"),
    "utf8"
  )
) as readonly RouteStepContentRecord[];
await routeStepIngestion.ingest({ steps: routeStepContent });

  const promptRepository = new InMemoryPromptRepository();
  const promptManagement = new PromptManagementService(
    promptRepository
  );
  const activePromptProvider =
    new RepositoryActivePromptProvider(promptRepository);

  const audit = new AuditService(
    new InMemoryAuditEventRepository()
  );

  const realtime = new InMemoryRealtimeBroker();

  const journeyRepository =
    new InMemoryJourneyRepository();
  const graphRepository =
    new InMemoryMemoryGraphRepository();
  const graphMemory = new JourneyGraphMemoryService(
    journeyRepository,
    graphRepository
  );
  const journeyEngine = new JourneyEngine(
    journeyRepository,
    new GraphMemoryJourneyChangeListener(graphMemory)
  );
  const executionRepository =
    new InMemoryExecutionRepository();
  const executionService = new SafeExecutionService(
    executionRepository
  );
  const deliveryWorker = new NotificationDeliveryWorker(
    executionRepository,
    [new InAppNotificationDeliveryProvider()]
  );
  const deliveryScheduler = new NotificationDeliveryScheduler(
    deliveryWorker,
    Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS ?? 30_000)
  );
  deliveryScheduler.start();

  const orchestrationRepository =
    new InMemoryOrchestrationRepository();
  const plannerShadowRepository =
    new InMemoryPlannerShadowRepository();
  const orchestrator = createDefaultOrchestrator({
    knowledge: knowledgeSearch,
    journeys: journeyEngine,
    repository: orchestrationRepository,
    plannerShadowRepository,
    executionService
  });

  const detector = new AdaptivePhaseDetector(
    datasets.phaseRules,
    datasets.phaseQuestions,
    registry,
    phasePreferenceResolver
  );

  const contextProvider =
    new InMemoryChatContextProvider("interesse");
  const draftProvider =
    new DeterministicAnswerDraftProvider();
  const pipelineEvents =
    new InMemoryPipelineEventRepository();
  const retrievalPipeline = new AdaptiveRetrievalPipeline(
    knowledgeSearch,
    trustedSourceRepository,
    new IntentRouter(undefined, pipelineEvents),
    new ConditionalFaqReranker(undefined, pipelineEvents),
    undefined,
    pipelineEvents
  );
  const llmGenerator =
    process.env.LLM_BASE_URL &&
    process.env.LLM_API_KEY &&
    process.env.LLM_MODEL
      ? new OpenAiCompatibleAnswerDraftProvider({
          baseUrl: process.env.LLM_BASE_URL,
          apiKey: process.env.LLM_API_KEY,
          model: process.env.LLM_MODEL,
          timeoutMs: Number(
            process.env.LLM_TIMEOUT_MS ?? 30_000
          )
        })
      : undefined;
  const retrievalDraftProvider =
    new AdaptiveRetrievalAnswerDraftProvider(
      retrievalPipeline,
      llmGenerator ?? draftProvider,
      new AnswerValidationPipeline(
        undefined,
        undefined,
        pipelineEvents
      ),
      { preferExtractiveAnswer: !llmGenerator }
    );
  const mutationStore =
    new InMemoryPendingMutationStore();
  const conversationPersistence =
    new InMemoryConversationPersistence();
  const mutationService =
    new MutationApplicationService(
      mutationStore,
      contextProvider
    );

  return {
    storageMode: "memory",
    auth,
    authorization: new AuthorizationService(),
    profileService,
    tokenService,
    generalCoach: new GeneralCoach(
      retrievalDraftProvider,
      conversationPersistence,
      activePromptProvider
    ),
    personalCoach: new PersonalJourneyCoach(
      contextProvider,
      draftProvider,
      detector,
      new (await import("@door010/domain")).RouteEngine(
        datasets.routeQuestions,
        datasets.routes,
        datasets.routeSteps
      ),
      conversationPersistence,
      activePromptProvider,
      {
        getGraphContext: async (userId: string) => {
          try {
            let context = await graphMemory.context(userId);
            if (context.graph.nodes.length === 0) {
              await graphMemory.synchronize(userId);
              context = await graphMemory.context(userId);
            }
            return {
              activeGoals: context.activeGoals.map((item) => item.label),
              openBlockers: context.openBlockers.map((item) => item.label),
              pendingActions: context.pendingActions.map((item) => item.label),
              evidenceClaims: context.evidence.map((item) => item.label)
            };
          } catch {
            return undefined;
          }
        }
      }
    ),
    contextProvider,
    mutationStore,
    mutationService,
    advisorChat: new AdvisorChatService(conversationPersistence),
    conversationPersistence,
    phasePreferenceRepository,
    phasePreferenceResolver,
    datasetsDirectory,
    knowledgeSearch,
    knowledgeIngestion,
    knowledgeRepository,
    trustedSourceRepository,
    promptManagement,
    audit,
    realtime,
    pipelineEvents,
    shadowEvaluations,
    labelQueue,
    connectors,
    connectorService,
    connectorHealth,
    connectorScheduler,
    journeyEngine,
    orchestrator,
    orchestrationRepository,
    plannerShadowRepository,
    graphMemory,
    graphRepository,
    executionService,
    executionRepository,
    deliveryWorker,
    deliveryScheduler
  };
}
