import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AdaptivePhaseDetector,
  InMemoryPhaseSystemPreferenceRepository,
  PhaseSystemPreferenceResolver,
  PhaseSystemRegistry,
  RouteEngine,
  loadDomainDatasets,
  type PhaseSystemDefinition
} from "@door010/domain";
import type { SqlExecutor } from "@door010/database";
import {
  BackofficeService,
  DEFAULT_EVENT_SOURCES,
  EventService,
  InMemoryEventScraper,
  InMemoryRouteSessionRepository,
  InMemoryVacancyProvider,
  PhaseFlowService,
  RouteFlowService,
  TalentTestService,
  VacancyService,
  type TalentTestDataset
} from "@door010/parity-flows";
import {
  PostgresBackofficeService,
  PostgresEventService,
  PostgresPhaseFlowService,
  PostgresRouteSessionRepository,
  PostgresTalentTestService,
  PostgresVacancyService
} from "@door010/parity-persistence";
import {
  NoopNotificationProvider,
  type NotificationProvider,
  type JsonEventScraper,
  type JsonVacancyProvider
} from "@door010/integrations";

export async function createParityFlowServices(input?: {
  datasetsDirectory?: string;
  storageMode?: "memory" | "postgres";
  executor?: SqlExecutor;
  liveIntegrations?: {
    vacancies?: JsonVacancyProvider;
    events?: JsonEventScraper;
    eventSources?: readonly {
      name: string;
      url: string;
    }[];
    notifications: NotificationProvider;
  };
}) {
  const datasetsDirectory =
    input?.datasetsDirectory ??
    process.env.DATASETS_DIRECTORY ??
    resolve(process.cwd(), "datasets");

  const datasets = await loadDomainDatasets(datasetsDirectory);
  const talentDataset = JSON.parse(
    await readFile(
      resolve(datasetsDirectory, "interest-talent-test.json"),
      "utf8"
    )
  ) as TalentTestDataset;

  const registry = new PhaseSystemRegistry(
    datasets.phaseSystems as unknown as readonly PhaseSystemDefinition[]
  );
  const preferences = new InMemoryPhaseSystemPreferenceRepository();
  const detector = new AdaptivePhaseDetector(
    datasets.phaseRules,
    datasets.phaseQuestions,
    registry,
    new PhaseSystemPreferenceResolver(preferences, "phase-5")
  );
  const routeEngine = new RouteEngine(
    datasets.routeQuestions,
    datasets.routes,
    datasets.routeSteps
  );
  const scraper =
    input?.liveIntegrations?.events ??
    new InMemoryEventScraper();
  const vacancyProvider =
    input?.liveIntegrations?.vacancies ??
    new InMemoryVacancyProvider([]);
  const eventSources =
    input?.liveIntegrations?.eventSources ??
    DEFAULT_EVENT_SOURCES;
  const notifications =
    input?.liveIntegrations?.notifications ??
    new NoopNotificationProvider();

  if (input?.storageMode === "postgres") {
    if (!input.executor) {
      throw new Error(
        "A SqlExecutor is required for PostgreSQL parity-flow services."
      );
    }

    return {
      routeFlow: new RouteFlowService(
        routeEngine,
        new PostgresRouteSessionRepository(input.executor)
      ),
      phaseFlow: new PostgresPhaseFlowService(
        input.executor,
        detector
      ),
      talentTest: new PostgresTalentTestService(
        input.executor,
        talentDataset
      ),
      backoffice: new PostgresBackofficeService(input.executor),
      events: new PostgresEventService(
        input.executor,
        scraper,
        eventSources
      ),
      vacancies: new PostgresVacancyService(
        input.executor,
        vacancyProvider
      ),
      notifications
    };
  }

  return {
    routeFlow: new RouteFlowService(
      routeEngine,
      new InMemoryRouteSessionRepository()
    ),
    phaseFlow: new PhaseFlowService(detector),
    talentTest: new TalentTestService(talentDataset),
    backoffice: new BackofficeService(),
    events: new EventService(
      scraper,
      eventSources
    ),
    vacancies: new VacancyService(vacancyProvider),
    notifications
  };
}
