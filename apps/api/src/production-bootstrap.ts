import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  AdaptivePhaseDetector,
  GraphMemoryJourneyChangeListener,
  JourneyEngine,
  JourneyGraphMemoryService,
  PhaseSystemPreferenceResolver,
  PostgresJourneyRepository,
  PostgresMemoryGraphRepository,
  PhaseSystemRegistry,
  RouteEngine,
  loadDomainDatasets,
  type PhaseSystemDefinition
} from "@door010/domain";
import {
  AdvisorChatService,
  DeterministicAnswerDraftProvider,
  GeneralCoach,
  MutationApplicationService,
  PersonalJourneyCoach
} from "@door010/chat";
import {
  DatabaseChatPersistence,
  PostgresChatContextProvider,
  PostgresPendingMutationStore
} from "@door010/chat-persistence";
import {
  PostgresConversationRepository,
  PostgresDetectorSnapshotRepository,
  PostgresMessageRepository,
  PostgresPhaseRepository,
  PostgresPhaseSystemPreferenceRepository,
  PostgresProfileRepository,
  PostgresUserAccountRepository,
  PostgresUserNoteRepository,
  PostgresUserRoleRepository
} from "@door010/database";
import {
  AuthService,
  AuthorizationService,
  FileSystemObjectStorage,
  HmacTokenService,
  PasswordHasher,
  ProfileService
} from "@door010/identity-profile";
import { createPgExecutorFromEnvironment } from "@door010/postgres";
import {
  ActiveLearningKnowledgeSearch,
  AdaptiveRetrievalAnswerDraftProvider,
  AdaptiveRetrievalPipeline,
  AnswerValidationPipeline,
  ConditionalFaqReranker,
  ConnectorHealthService,
  DistributedConnectorScheduler,
  CsvKnowledgeConnector,
  DomainCatalogConnector,
  EnvironmentSecretResolver,
  FaqIngestionService,
  IntentRouter,
  KnowledgeConnectorService,
  JsonKnowledgeConnector,
  LearnedRerankedKnowledgeSearch,
  LocalSemanticEmbeddingProvider,
  PostgresConnectorLeaseRepository,
  PostgresConnectorRepository,
  PostgresFuzzyKnowledgeRepository,
  PostgresKnowledgeEmbeddingRepository,
  PostgresKnowledgeRepository,
  PostgresRetrievalLabelQueueRepository,
  ReciprocalRankFusionKnowledgeSearch,
  RegionalDeskIngestionService,
  type RegionalDeskRecord,
  RouteStepIngestionService,
  type RouteStepContentRecord,
  ShadowCrossEncoderKnowledgeSearch,
  PostgresPipelineEventRepository,
  PostgresShadowEvaluationRepository,
  PostgresTrustedSourceRepository,
  RetryingKnowledgeConnector,
  SecretResolvingKnowledgeConnector,
  seedDomainConnectorDefinitions,
  type FaqSeedDataset,
  type LearnedRerankerModel
} from "@door010/knowledge";
import {
  PostgresPromptRepository,
  PromptManagementService,
  RepositoryActivePromptProvider
} from "@door010/backoffice";
import {
  createLiveIntegrationsFromEnvironment,
  FirecrawlTrustedWebSearch,
  OpenAiAnswerRepairModel,
  OpenAiEmbeddingProvider,
  OpenAiFaqRerankModel,
  OpenAiIntentModel,
  HttpCrossEncoderReranker,
  LocalConceptCrossEncoder,
  PostgresDeadLetterRepository
} from "@door010/integrations";
import {
  AuditService,
  PostgresAuditEventRepository
} from "@door010/audit";
import {
  createPostgresRealtimeBrokerFromEnvironment
} from "@door010/realtime";
import {
  HttpNotificationDeliveryProvider,
  HttpPlannerSuggestionProvider,
  InAppNotificationDeliveryProvider,
  NotificationDeliveryScheduler,
  NotificationDeliveryWorker,
  PostgresExecutionRepository,
  PostgresOrchestrationRepository,
  PostgresPlannerShadowRepository,
  SafeExecutionService,
  createDefaultOrchestrator
} from "@door010/orchestration";
import { provisionPublicDemoAccounts } from "./demo-accounts.js";

export async function createProductionServices(
  datasetsDirectory =
    process.env.DATASETS_DIRECTORY ??
    resolve(process.cwd(), "datasets"),
  options: { seedDemoAccounts?: boolean } = {}
) {
  const executor = createPgExecutorFromEnvironment();
  const realtime =
    createPostgresRealtimeBrokerFromEnvironment();
  const liveIntegrations = createLiveIntegrationsFromEnvironment(
    new PostgresDeadLetterRepository(executor)
  );
  const retentionDays = Number(
    process.env.DEAD_LETTER_RETENTION_DAYS ?? 30
  );
  const purgeResolvedDeadLetters = async (): Promise<void> => {
    const olderThan = new Date(
      Date.now() - retentionDays * 86_400_000
    ).toISOString();
    await liveIntegrations.deadLetters.purgeResolved(olderThan);
  };
  await purgeResolvedDeadLetters();
  const retentionTimer = setInterval(
    () => void purgeResolvedDeadLetters(),
    24 * 60 * 60 * 1000
  );
  retentionTimer.unref();
  const datasets = await loadDomainDatasets(datasetsDirectory);
  const registry = new PhaseSystemRegistry(
    datasets.phaseSystems as unknown as readonly PhaseSystemDefinition[]
  );

  const preferenceData =
    new PostgresPhaseSystemPreferenceRepository(executor);
  const preferenceRepository = {
    findByScope: preferenceData.findByScope.bind(preferenceData)
  };
  const preferenceResolver = new PhaseSystemPreferenceResolver(
    preferenceRepository,
    "phase-5"
  );


const knowledgeRepository =
  new PostgresKnowledgeRepository(executor);
const trustedSourceRepository =
  new PostgresTrustedSourceRepository(executor);
const embeddingProvider =
  process.env.EMBEDDING_BASE_URL &&
  process.env.EMBEDDING_API_KEY &&
  process.env.EMBEDDING_MODEL
    ? new OpenAiEmbeddingProvider({
        baseUrl: process.env.EMBEDDING_BASE_URL,
        apiKey: process.env.EMBEDDING_API_KEY,
        model: process.env.EMBEDDING_MODEL,
        dimensions: Number(
          process.env.EMBEDDING_DIMENSIONS ?? 1536
        ),
        timeoutMs: Number(
          process.env.EMBEDDING_TIMEOUT_MS ?? 30_000
        )
      })
    : new LocalSemanticEmbeddingProvider();
const embeddingRepository =
  new PostgresKnowledgeEmbeddingRepository(executor);
const baseKnowledgeSearch =
  new ReciprocalRankFusionKnowledgeSearch(
    knowledgeRepository,
    new PostgresFuzzyKnowledgeRepository(executor),
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
  new PostgresShadowEvaluationRepository(executor);
const labelQueue =
  new PostgresRetrievalLabelQueueRepository(executor);
const crossEncoder =
  process.env.CROSS_ENCODER_ENDPOINT &&
  process.env.CROSS_ENCODER_MODEL
    ? new HttpCrossEncoderReranker({
        endpoint: process.env.CROSS_ENCODER_ENDPOINT,
        apiKey: process.env.CROSS_ENCODER_API_KEY,
        model: process.env.CROSS_ENCODER_MODEL,
        timeoutMs: Number(
          process.env.CROSS_ENCODER_TIMEOUT_MS ?? 20_000
        )
      })
    : new LocalConceptCrossEncoder();
const shadowKnowledgeSearch =
  new ShadowCrossEncoderKnowledgeSearch(
    learnedKnowledgeSearch,
    crossEncoder,
    shadowEvaluations
  );
const knowledgeSearch = new ActiveLearningKnowledgeSearch(
  shadowKnowledgeSearch,
  labelQueue,
  Number(
    process.env.ACTIVE_LEARNING_MARGIN_THRESHOLD ?? 0.12
  )
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
const connectors = new PostgresConnectorRepository(executor);
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
  new PostgresConnectorLeaseRepository(executor);
const connectorScheduler =
  new DistributedConnectorScheduler(
    connectors,
    connectorService,
    connectorLeases,
    process.env.CONNECTOR_SCHEDULER_OWNER_ID ??
      `${process.env.HOSTNAME ?? "api"}:${process.pid}`,
    Number(
      process.env.CONNECTOR_LEASE_DURATION_MS ?? 300_000
    )
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

  const promptRepository =
    new PostgresPromptRepository(executor);
  const promptManagement = new PromptManagementService(
    promptRepository
  );
  const activePromptProvider =
    new RepositoryActivePromptProvider(promptRepository);

  const journeyRepository =
    new PostgresJourneyRepository(executor);
  const graphRepository =
    new PostgresMemoryGraphRepository(executor);
  const graphMemory = new JourneyGraphMemoryService(
    journeyRepository,
    graphRepository
  );
  const journeyEngine = new JourneyEngine(
    journeyRepository,
    new GraphMemoryJourneyChangeListener(graphMemory)
  );
  const executionRepository =
    new PostgresExecutionRepository(executor);
  const executionService = new SafeExecutionService(
    executionRepository
  );
  const deliveryProviders = [
    new InAppNotificationDeliveryProvider(),
    ...(process.env.EMAIL_DELIVERY_ENDPOINT
      ? [new HttpNotificationDeliveryProvider({
          channel: "email",
          endpoint: process.env.EMAIL_DELIVERY_ENDPOINT,
          apiKey: process.env.EMAIL_DELIVERY_API_KEY,
          timeoutMs: Number(
            process.env.NOTIFICATION_DELIVERY_TIMEOUT_MS ?? 10_000
          )
        })]
      : []),
    ...(process.env.WEBHOOK_DELIVERY_ENDPOINT
      ? [new HttpNotificationDeliveryProvider({
          channel: "webhook",
          endpoint: process.env.WEBHOOK_DELIVERY_ENDPOINT,
          apiKey: process.env.WEBHOOK_DELIVERY_API_KEY,
          timeoutMs: Number(
            process.env.NOTIFICATION_DELIVERY_TIMEOUT_MS ?? 10_000
          )
        })]
      : [])
  ];
  const deliveryWorker = new NotificationDeliveryWorker(
    executionRepository,
    deliveryProviders
  );
  const deliveryScheduler = new NotificationDeliveryScheduler(
    deliveryWorker,
    Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS ?? 30_000)
  );
  deliveryScheduler.start();

  const orchestrationRepository =
    new PostgresOrchestrationRepository(executor);
  const plannerShadowRepository =
    new PostgresPlannerShadowRepository(executor);
  const plannerSuggestionProvider =
    process.env.PLANNER_SHADOW_ENDPOINT &&
    process.env.PLANNER_SHADOW_MODEL
      ? new HttpPlannerSuggestionProvider({
          endpoint: process.env.PLANNER_SHADOW_ENDPOINT,
          apiKey: process.env.PLANNER_SHADOW_API_KEY,
          model: process.env.PLANNER_SHADOW_MODEL,
          timeoutMs: Number(
            process.env.PLANNER_SHADOW_TIMEOUT_MS ?? 10_000
          )
        })
      : undefined;
  const orchestrator = createDefaultOrchestrator({
    knowledge: knowledgeSearch,
    journeys: journeyEngine,
    repository: orchestrationRepository,
    plannerShadowRepository,
    plannerSuggestionProvider,
    executionService
  });

  const detector = new AdaptivePhaseDetector(
    datasets.phaseRules,
    datasets.phaseQuestions,
    registry,
    preferenceResolver
  );
  const contextProvider = new PostgresChatContextProvider(executor);
  const mutationStore = new PostgresPendingMutationStore(executor);

  const conversationPersistence = new DatabaseChatPersistence(
    new PostgresConversationRepository(executor),
    new PostgresMessageRepository(executor),
    new PostgresPhaseRepository(executor),
    new PostgresDetectorSnapshotRepository(executor)
  );
  const deterministicDraftProvider =
    new DeterministicAnswerDraftProvider();
  const draftProvider =
    liveIntegrations.llm ?? deterministicDraftProvider;
  const pipelineEvents =
    new PostgresPipelineEventRepository(executor);
  const modelConfig =
    process.env.LLM_BASE_URL &&
    process.env.LLM_API_KEY &&
    process.env.LLM_MODEL
      ? {
          baseUrl: process.env.LLM_BASE_URL,
          apiKey: process.env.LLM_API_KEY,
          model: process.env.LLM_MODEL,
          timeoutMs: Number(
            process.env.LLM_TIMEOUT_MS ?? 30_000
          )
        }
      : undefined;
  const trustedWebSearch = process.env.FIRECRAWL_API_KEY
    ? new FirecrawlTrustedWebSearch({
        apiKey: process.env.FIRECRAWL_API_KEY,
        endpoint: process.env.FIRECRAWL_API_URL
      })
    : undefined;
  const retrievalPipeline = new AdaptiveRetrievalPipeline(
    knowledgeSearch,
    trustedSourceRepository,
    new IntentRouter(
      modelConfig
        ? new OpenAiIntentModel(modelConfig)
        : undefined,
      pipelineEvents
    ),
    new ConditionalFaqReranker(
      modelConfig
        ? new OpenAiFaqRerankModel(modelConfig)
        : undefined,
      pipelineEvents
    ),
    trustedWebSearch,
    pipelineEvents
  );
  const retrievalDraftProvider =
    new AdaptiveRetrievalAnswerDraftProvider(
      retrievalPipeline,
      draftProvider,
      new AnswerValidationPipeline(
        modelConfig
          ? new OpenAiAnswerRepairModel(modelConfig)
          : undefined,
        undefined,
        pipelineEvents
      ),
      { preferExtractiveAnswer: !liveIntegrations.llm }
    );

  const audit = new AuditService(
    new PostgresAuditEventRepository(executor)
  );

  const profiles = new PostgresProfileRepository(executor);
  const userAccounts = new PostgresUserAccountRepository(executor);
  const userRoles = new PostgresUserRoleRepository(executor);
  const auth = new AuthService(
    userAccounts,
    userRoles,
    profiles,
    new PasswordHasher(),
    new HmacTokenService(
      process.env.AUTH_TOKEN_SECRET ??
        "development-secret-change-this-value-before-production"
    )
  );
  if (options.seedDemoAccounts ?? false) {
    await provisionPublicDemoAccounts(auth);
  }
  const profileService = new ProfileService(
    profiles,
    new PostgresUserNoteRepository(executor),
    new FileSystemObjectStorage(
      process.env.FILE_STORAGE_DIRECTORY ??
        resolve(process.cwd(), "var/storage")
    )
  );

  return {
    storageMode: "postgres" as const,
    executor,
    auth,
    authorization: new AuthorizationService(),
    profileService,
    tokenService: new HmacTokenService(
      process.env.AUTH_TOKEN_SECRET ??
        "development-secret-change-this-value-before-production"
    ),
    generalCoach: new GeneralCoach(
      retrievalDraftProvider,
      conversationPersistence,
      activePromptProvider
    ),
    personalCoach: new PersonalJourneyCoach(
      contextProvider,
      retrievalDraftProvider,
      detector,
      new RouteEngine(
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
    mutationService: new MutationApplicationService(
      mutationStore,
      contextProvider
    ),
    advisorChat: new AdvisorChatService(conversationPersistence),
    conversationPersistence,
    phasePreferenceRepository: {
      save: async (preference: {
        scope: "organization" | "user" | "conversation";
        scopeId: string;
        phaseSystemKey: "phase-4" | "phase-5" | "phase-9";
        enabled: boolean;
        updatedAt: string;
      }) => preferenceData.upsert(preference)
    },
    phasePreferenceResolver: preferenceResolver,
    datasetsDirectory,
    knowledgeSearch,
    knowledgeIngestion,
    knowledgeRepository,
    trustedSourceRepository,
    promptManagement,
    audit,
    liveIntegrations,
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
