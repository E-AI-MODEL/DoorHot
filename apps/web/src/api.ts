import type {
  AuthSessionDto,
  AuthenticatedUserDto,
  ChatRequest,
  ChatResponse,
  ProfileDto,
  UpdateProfileRequest
} from "@door010/contracts";

export interface KnowledgeResult {
  record: {
    id: string;
    title: string;
    body: string;
    category?: string;
    sourceUrl?: string;
    requiresCitation: boolean;
  };
  combinedScore: number;
}


export interface CandidateSummary {
  userId: string;
  displayName: string;
  email?: string;
  currentPhaseCode?: string;
  phaseSystemKey?: string;
  lastDetectorConfidence?: number;
  routeTitle?: string;
}

export interface PromptVersion {
  id: string;
  promptConfigId: string;
  version: number;
  systemPrompt: string;
  notes?: string;
  status: "draft" | "approved" | "rejected" | "archived";
  createdAt: string;
}

export interface PromptConfig {
  id: string;
  chatbotKey: "general-coach" | "personal-journey-coach";
  configKey: string;
  title: string;
  activeVersion: number;
  versions: readonly PromptVersion[];
}



export interface ProviderRuntimeStatus {
  providerKey: string;
  configured: boolean;
  circuitState: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
}

export interface ProviderDeadLetter {
  id: string;
  providerKey: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
  errorMessage: string;
  attempts: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface BackofficeAlert {
  id: string;
  candidateUserId: string;
  severity: "info" | "warning" | "critical";
  code: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface BackofficeStatistics {
  totalCandidates: number;
  candidatesWithRoute: number;
  candidatesWithoutRoute: number;
  lowConfidenceCandidates: number;
  phaseDistribution: Readonly<Record<string, number>>;
  upcomingAppointments: number;
  openAlerts: number;
}

export interface CandidateDetail {
  candidate: CandidateSummary;
  notes: readonly {
    id: string;
    content: string;
    createdAt: string;
  }[];
  appointments: readonly {
    id: string;
    subject: string;
    startsAt: string;
    endsAt: string;
    status: string;
  }[];
  alerts: readonly BackofficeAlert[];
}


export interface RouteAnswer {
  id: string;
  title: string;
  description?: string;
}

export interface RouteSession {
  id: string;
  userId?: string;
  selectedAnswerIds: readonly string[];
  status: "active" | "completed";
  result: {
    nextQuestion?: {
      id: string;
      question: string;
      description?: string;
      answers: readonly RouteAnswer[];
    };
    bestRoute?: {
      id: string;
      title: string;
      slug: string;
      steps: readonly {
        id: string;
        shortTitle: string;
        longTitle: string;
        durationInMonths?: number | null;
      }[];
    };
  };
}

export interface TalentQuestion {
  id: string;
  question: string;
  options: readonly {
    value: string;
    label: string;
  }[];
}

export interface TalentResult {
  primarySector: string;
  rankedSectors: readonly {
    sector: string;
    score: number;
    label: string;
    description: string;
  }[];
}

export interface EducationEvent {
  id: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  description?: string;
  startsAt?: string;
  eventUrl?: string;
}

export interface Vacancy {
  id: string;
  title: string;
  organization?: string;
  sector?: string;
  location?: string;
  description?: string;
  url?: string;
}

export interface AdvisorMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "advisor" | "system";
  content: string;
  createdAt: string;
}

export interface PendingMutation {
  id: string;
  mutation: {
    type: "profile-slot" | "phase-transition";
    payload: Readonly<Record<string, unknown>>;
  };
  status: "pending" | "accepted" | "rejected";
}


export interface ConnectorRunDto {
  id: string;
  connectorId: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  fetchedCount: number;
  normalizedCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  removedCount: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ConnectorHealthDto {
  connectorId: string;
  connectorKey: string;
  label: string;
  enabled: boolean;
  status: "healthy" | "degraded" | "failing" | "never-run";
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  recentRuns: readonly ConnectorRunDto[];
}


export interface OrchestrationRunDto {
  id: string;
  requestId: string;
  userId?: string;
  conversationId?: string;
  intent: string;
  status: "running" | "completed" | "failed" | "partial";
  plan: {
    answerStrategy: string;
    steps: readonly {
      sequence: number;
      capability: string;
      toolKey: string;
      reason: string;
      required: boolean;
      dependsOn?: readonly string[];
    }[];
  };
  answer?: string;
  latencyMs?: number;
  createdAt: string;
  completedAt?: string;
}

export interface PlannerShadowEvaluationDto {
  id: string;
  runId: string;
  providerKey: string;
  agreementScore?: number;
  addedTools: readonly string[];
  removedTools: readonly string[];
  latencyMs: number;
  status: "completed" | "failed" | "skipped";
  errorCode?: string;
  createdAt: string;
}


export interface ExecutionRequestDto {
  id: string;
  userId: string;
  toolKey: "reminder.schedule" | "notification.queue";
  status:
    | "pending_confirmation"
    | "approved"
    | "rejected"
    | "executed"
    | "failed"
    | "expired";
  payload: Readonly<Record<string, unknown>>;
  expiresAt: string;
  createdAt: string;
}

export interface NotificationOutboxDto {
  id: string;
  executionRequestId: string;
  userId: string;
  channel: "in_app" | "email" | "webhook";
  body: string;
  deliverAt: string;
  status: "queued" | "delivered" | "failed" | "cancelled";
  attempts: number;
}


export interface JourneyGoalDto {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "active" | "completed" | "cancelled";
  priority: number;
  targetAt?: string;
}

export interface JourneyMilestoneDto {
  id: string;
  goalId?: string;
  title: string;
  status: "pending" | "completed" | "skipped";
  weight: number;
  sortOrder: number;
}

export interface JourneyBlockerDto {
  id: string;
  blockerKey: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  status: "open" | "mitigating" | "resolved" | "dismissed";
}

export interface JourneyActionDto {
  id: string;
  goalId?: string;
  blockerId?: string;
  actionKey: string;
  title: string;
  description?: string;
  status: "pending" | "doing" | "done" | "cancelled" | "expired";
  priority: number;
  dueAt?: string;
}

export interface JourneyDashboardDto {
  aggregate: {
    journey: {
      id: string;
      userId: string;
      phaseKey: string;
      routeKey?: string;
      status: "active" | "paused" | "completed";
      progress: number;
    };
    goals: readonly JourneyGoalDto[];
    milestones: readonly JourneyMilestoneDto[];
    blockers: readonly JourneyBlockerDto[];
    actions: readonly JourneyActionDto[];
    evidence: readonly {
      id: string;
      claimKey: string;
      confidence: number;
    }[];
    decisions: readonly {
      id: string;
      decisionKey: string;
      outcome: string;
      reason: string;
      ruleVersion: string;
      decidedAt: string;
    }[];
  };
  nextAction?: JourneyActionDto;
  openCriticalBlockers: readonly JourneyBlockerDto[];
}

export interface GraphContextDto {
  activeGoals: readonly {
    id: string;
    label: string;
  }[];
  openBlockers: readonly {
    id: string;
    label: string;
  }[];
  pendingActions: readonly {
    id: string;
    label: string;
  }[];
  evidence: readonly {
    id: string;
    label: string;
  }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

export class Door010Api {
  constructor(
    private readonly getToken: () => string | null
  ) {}

  register(email: string, password: string): Promise<AuthSessionDto> {
    return this.request("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  demoLogin(): Promise<AuthSessionDto> {
    return this.request("/v1/auth/demo-login", {
      method: "POST",
      body: "{}"
    });
  }

  async demoLoginEnabled(): Promise<boolean> {
    try {
      const capabilities = await this.request<{
        demoLogin?: boolean;
      }>("/v1/system/capabilities");
      return capabilities.demoLogin === true;
    } catch {
      return false;
    }
  }

  login(email: string, password: string): Promise<AuthSessionDto> {
    return this.request("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  me(): Promise<AuthenticatedUserDto> {
    return this.request("/v1/auth/me");
  }

  generalChat(input: ChatRequest): Promise<ChatResponse> {
    return this.request("/v1/chat/general", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  personalChat(input: ChatRequest): Promise<ChatResponse & {
    pendingMutations?: readonly PendingMutation[];
  }> {
    return this.request("/v1/chat/personal", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  getProfile(userId: string): Promise<ProfileDto> {
    return this.request(`/v1/profiles/${userId}`);
  }

  updateProfile(
    userId: string,
    input: UpdateProfileRequest
  ): Promise<ProfileDto> {
    return this.request(`/v1/profiles/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }


  getJourney(userId: string): Promise<JourneyDashboardDto> {
    return this.request(`/v1/journeys/${userId}`);
  }

  createJourney(
    userId: string,
    phaseKey = "interesse"
  ): Promise<unknown> {
    return this.request("/v1/journeys", {
      method: "POST",
      body: JSON.stringify({ userId, phaseKey })
    });
  }

  getGraphContext(userId: string): Promise<GraphContextDto> {
    return this.request(`/v1/memory-graph/${userId}`);
  }

  getNotifications(
    userId: string
  ): Promise<{ items: readonly NotificationOutboxDto[] }> {
    return this.request(`/v1/notifications/${userId}`);
  }

  updateJourneyAction(
    userId: string,
    actionId: string,
    status: JourneyActionDto["status"]
  ): Promise<{ action: JourneyActionDto }> {
    return this.request(
      `/v1/journeys/${userId}/actions/${actionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      }
    );
  }

  updateJourneyMilestone(
    userId: string,
    milestoneId: string,
    status: JourneyMilestoneDto["status"]
  ): Promise<{ milestone: JourneyMilestoneDto }> {
    return this.request(
      `/v1/journeys/${userId}/milestones/${milestoneId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      }
    );
  }

  resolveJourneyBlocker(
    userId: string,
    blockerId: string
  ): Promise<{ blocker: JourneyBlockerDto }> {
    return this.request(
      `/v1/journeys/${userId}/blockers/${blockerId}/resolve`,
      {
        method: "POST",
        body: "{}"
      }
    );
  }

  async searchKnowledge(
    query: string
  ): Promise<readonly KnowledgeResult[]> {
    const response = await this.request<{
      results: readonly KnowledgeResult[];
    }>(
      `/v1/knowledge/search?query=${encodeURIComponent(query)}`
    );
    return response.results;
  }




  async getConnectorHealth(): Promise<{
    health: readonly ConnectorHealthDto[];
    activeScheduleCount: number;
  }> {
    return this.request("/v1/backoffice/connectors/health");
  }

  synchronizeConnector(
    connectorKey: string
  ): Promise<{ run: ConnectorRunDto }> {
    return this.request(
      `/v1/backoffice/connectors/${encodeURIComponent(connectorKey)}/sync`,
      {
        method: "POST",
        body: "{}"
      }
    );
  }



  async getExecutionRequests(): Promise<
    readonly ExecutionRequestDto[]
  > {
    const response = await this.request<{
      requests: readonly ExecutionRequestDto[];
    }>("/v1/backoffice/execution-requests?limit=50");
    return response.requests;
  }

  async getNotificationOutbox(): Promise<
    readonly NotificationOutboxDto[]
  > {
    const response = await this.request<{
      items: readonly NotificationOutboxDto[];
    }>("/v1/backoffice/notification-outbox?limit=50");
    return response.items;
  }

  async getOrchestrationRuns(): Promise<
    readonly OrchestrationRunDto[]
  > {
    const response = await this.request<{
      runs: readonly OrchestrationRunDto[];
    }>("/v1/backoffice/orchestration-runs?limit=50");
    return response.runs;
  }

  async getPlannerShadowEvaluations(): Promise<
    readonly PlannerShadowEvaluationDto[]
  > {
    const response = await this.request<{
      evaluations: readonly PlannerShadowEvaluationDto[];
    }>("/v1/backoffice/planner-shadow?limit=50");
    return response.evaluations;
  }

  async getProviderStatus(): Promise<
    readonly ProviderRuntimeStatus[]
  > {
    const response = await this.request<{
      providers: readonly ProviderRuntimeStatus[];
    }>("/v1/backoffice/provider-status");
    return response.providers;
  }

  retryProviderDeadLetter(
    deadLetterId: string
  ): Promise<{
    result: {
      retried: boolean;
      status?: number;
      resolved: boolean;
    };
  }> {
    return this.request(
      `/v1/backoffice/provider-dead-letters/${deadLetterId}/retry`,
      {
        method: "POST",
        body: "{}"
      }
    );
  }

  resolveProviderDeadLetter(
    deadLetterId: string
  ): Promise<{ resolved: boolean }> {
    return this.request(
      `/v1/backoffice/provider-dead-letters/${deadLetterId}/resolve`,
      {
        method: "POST",
        body: "{}"
      }
    );
  }

  purgeResolvedProviderDeadLetters(): Promise<{ purged: number }> {
    return this.request(
      "/v1/backoffice/provider-dead-letters/resolved",
      {
        method: "DELETE"
      }
    );
  }

  async getProviderDeadLetters(): Promise<
    readonly ProviderDeadLetter[]
  > {
    const response = await this.request<{
      deadLetters: readonly ProviderDeadLetter[];
    }>("/v1/backoffice/provider-dead-letters?limit=100");
    return response.deadLetters;
  }

  async getBackofficeStatistics(): Promise<BackofficeStatistics> {
    const response = await this.request<{
      statistics: BackofficeStatistics;
    }>("/v1/backoffice/statistics");
    return response.statistics;
  }

  async getBackofficeAlerts(): Promise<readonly BackofficeAlert[]> {
    const response = await this.request<{
      alerts: readonly BackofficeAlert[];
    }>("/v1/backoffice/alerts");
    return response.alerts;
  }

  async getCandidateDetail(
    userId: string
  ): Promise<CandidateDetail> {
    const response = await this.request<{
      detail: CandidateDetail;
    }>(`/v1/backoffice/candidates/${userId}`);
    return response.detail;
  }

  async getCandidates(): Promise<readonly CandidateSummary[]> {
    const response = await this.request<{
      candidates: readonly CandidateSummary[];
    }>("/v1/backoffice/candidates");
    return response.candidates;
  }

  async getPrompts(): Promise<readonly PromptConfig[]> {
    const response = await this.request<{
      prompts: readonly PromptConfig[];
    }>("/v1/backoffice/prompts");
    return response.prompts;
  }

  async createPrompt(input: {
    chatbotKey: "general-coach" | "personal-journey-coach";
    configKey: string;
    title: string;
    systemPrompt: string;
    notes?: string;
  }): Promise<PromptConfig> {
    const response = await this.request<{ prompt: PromptConfig }>(
      "/v1/backoffice/prompts",
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
    return response.prompt;
  }

  async createPromptVersion(
    promptConfigId: string,
    input: {
      systemPrompt: string;
      notes?: string;
    }
  ): Promise<PromptVersion> {
    const response = await this.request<{ version: PromptVersion }>(
      `/v1/backoffice/prompts/${promptConfigId}/versions`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
    return response.version;
  }

  async activatePromptVersion(
    promptConfigId: string,
    version: number
  ): Promise<PromptConfig> {
    const response = await this.request<{ prompt: PromptConfig }>(
      `/v1/backoffice/prompts/${promptConfigId}/activate`,
      {
        method: "POST",
        body: JSON.stringify({ version })
      }
    );
    return response.prompt;
  }


  startRoute(userId?: string): Promise<RouteSession> {
    return this.request("/v1/routes/sessions", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  answerRoute(
    sessionId: string,
    answerId: string
  ): Promise<RouteSession> {
    return this.request(
      `/v1/routes/sessions/${sessionId}/answers`,
      {
        method: "POST",
        body: JSON.stringify({ answerId })
      }
    );
  }

  async getTalentQuestions(): Promise<readonly TalentQuestion[]> {
    const response = await this.request<{
      questions: readonly TalentQuestion[];
    }>("/v1/talent-test/questions");
    return response.questions;
  }

  submitTalentTest(
    userId: string,
    answers: Readonly<Record<string, string>>
  ): Promise<TalentResult> {
    return this.request("/v1/talent-test/submit", {
      method: "POST",
      body: JSON.stringify({ userId, answers })
    });
  }

  confirmMutation(
    mutationId: string,
    userId: string,
    decision: "accept" | "reject"
  ): Promise<unknown> {
    return this.request("/v1/mutations/confirm", {
      method: "POST",
      body: JSON.stringify({
        mutationId,
        userId,
        decision
      })
    });
  }

  async getEvents(): Promise<readonly EducationEvent[]> {
    const response = await this.request<{
      events: readonly EducationEvent[];
    }>("/v1/events");
    return response.events;
  }

  async refreshEvents(): Promise<readonly EducationEvent[]> {
    const response = await this.request<{
      events: readonly EducationEvent[];
    }>("/v1/events/refresh", {
      method: "POST",
      body: JSON.stringify({ force: true })
    });
    return response.events;
  }

  saveEvent(eventId: string, userId: string): Promise<unknown> {
    return this.request(`/v1/events/${eventId}/save`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  async searchVacancies(
    query = ""
  ): Promise<readonly Vacancy[]> {
    const response = await this.request<{
      vacancies: readonly Vacancy[];
    }>(
      `/v1/vacancies?query=${encodeURIComponent(query)}`
    );
    return response.vacancies;
  }

  saveVacancy(
    vacancyId: string,
    userId: string
  ): Promise<unknown> {
    return this.request(`/v1/vacancies/${vacancyId}/save`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  subscribeAdvisorMessages(
    conversationId: string,
    onMessage: (message: AdvisorMessage) => void,
    onError?: (error: unknown) => void
  ): AbortController {
    const controller = new AbortController();

    void (async () => {
      try {
        const headers = new Headers();
        const token = this.getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        const response = await fetch(
          `/v1/conversations/${conversationId}/stream`,
          {
            headers,
            signal: controller.signal
          }
        );

        if (!response.ok || !response.body) {
          throw new ApiError(
            response.status,
            "advisor_stream_unavailable"
          );
        }

        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += value;
          const events = buffer.split("\\n\\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const dataLine = event
              .split("\\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;

            onMessage(
              JSON.parse(dataLine.slice("data: ".length)) as
                AdvisorMessage
            );
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          onError?.(error);
        }
      }
    })();

    return controller;
  }

  async getAdvisorMessages(
    conversationId: string
  ): Promise<readonly AdvisorMessage[]> {
    const response = await this.request<{
      messages: readonly AdvisorMessage[];
    }>(`/v1/conversations/${conversationId}/messages`);
    return response.messages;
  }

  async sendCandidateMessage(input: {
    conversationId: string;
    candidateUserId: string;
    message: string;
  }): Promise<AdvisorMessage> {
    const response = await this.request<{
      message: AdvisorMessage;
    }>("/v1/chat/candidate", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.message;
  }

  async sendAdvisorMessage(input: {
    conversationId: string;
    advisorUserId: string;
    candidateUserId: string;
    message: string;
  }): Promise<AdvisorMessage> {
    const response = await this.request<{
      message: AdvisorMessage;
    }>("/v1/chat/advisor", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.message;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    const token = this.getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(path, {
      ...init,
      headers
    });

    const payload = await response.json().catch(() => ({})) as {
      error?: string;
    };

    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload.error ?? "request_failed"
      );
    }

    return payload as T;
  }
}
