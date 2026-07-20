import type {
  AnswerDraft,
  AnswerDraftProvider,
  ChatContext
} from "@door010/chat";
import type { ChatRequest } from "@door010/contracts";
import type {
  AdaptivePhaseDetectorResult,
  RouteEngineResult
} from "@door010/domain";
import type { SqlExecutor } from "@door010/database";
import type {
  AnswerRepairModel,
  ConversationIntent,
  CrossEncoderReranker,
  EmbeddingProvider,
  IntentModel,
  KnowledgeRecord,
  KnowledgeSearchResult,
  RerankModel,
  TrustedWebSearch,
  WebKnowledgeResult
} from "@door010/knowledge";
import type {
  EducationEvent,
  EventScraper,
  EventSource,
  Vacancy,
  VacancyProvider,
  VacancySearch
} from "@door010/parity-flows";

export interface FetchClient {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export class NativeFetchClient implements FetchClient {
  fetch(input: string, init?: RequestInit): Promise<Response> {
    return fetch(input, init);
  }
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(Math.max(1_000, timeoutMs));
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `provider_http_${response.status}:${body.slice(0, 300)}`
    );
  }
  return response.json() as Promise<T>;
}


export type CircuitState = "closed" | "open" | "half-open";

export interface DeadLetterRecord {
  id: string;
  providerKey: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
  errorMessage: string;
  attempts: number;
  createdAt: string;
  resolvedAt?: string;
}

export interface DeadLetterRepository {
  append(record: DeadLetterRecord): Promise<void>;
  findById(id: string): Promise<DeadLetterRecord | null>;
  list(
    limit?: number,
    includeResolved?: boolean
  ): Promise<readonly DeadLetterRecord[]>;
  resolve(id: string, resolvedAt?: string): Promise<boolean>;
  purgeResolved(olderThan?: string): Promise<number>;
}

export class InMemoryDeadLetterRepository
  implements DeadLetterRepository
{
  private readonly records = new Map<string, DeadLetterRecord>();

  async append(record: DeadLetterRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async findById(id: string): Promise<DeadLetterRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(
    limit = 100,
    includeResolved = false
  ): Promise<readonly DeadLetterRecord[]> {
    return [...this.records.values()]
      .filter((record) => includeResolved || !record.resolvedAt)
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async resolve(
    id: string,
    resolvedAt = new Date().toISOString()
  ): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;
    this.records.set(id, { ...record, resolvedAt });
    return true;
  }

  async purgeResolved(olderThan?: string): Promise<number> {
    let purged = 0;
    for (const [id, record] of this.records) {
      if (
        record.resolvedAt &&
        (!olderThan || record.resolvedAt < olderThan)
      ) {
        this.records.delete(id);
        purged += 1;
      }
    }
    return purged;
  }
}

export class PostgresDeadLetterRepository
  implements DeadLetterRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async append(record: DeadLetterRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO provider_dead_letters (
         id, provider_key, operation, payload,
         error_message, attempts, created_at, resolved_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        record.id,
        record.providerKey,
        record.operation,
        JSON.stringify(record.payload),
        record.errorMessage,
        record.attempts,
        record.createdAt,
        record.resolvedAt ?? null
      ]
    );
  }

  async findById(id: string): Promise<DeadLetterRecord | null> {
    const result = await this.executor.query<DeadLetterRow>(
      `SELECT *
       FROM provider_dead_letters
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    return result.rows[0]
      ? mapDeadLetterRow(result.rows[0])
      : null;
  }

  async list(
    limit = 100,
    includeResolved = false
  ): Promise<readonly DeadLetterRecord[]> {
    const result = await this.executor.query<DeadLetterRow>(
      `SELECT *
       FROM provider_dead_letters
       WHERE ($2::boolean = true OR resolved_at IS NULL)
       ORDER BY created_at DESC
       LIMIT $1`,
      [
        Math.max(1, Math.min(limit, 500)),
        includeResolved
      ]
    );

    return result.rows.map(mapDeadLetterRow);
  }

  async resolve(
    id: string,
    resolvedAt = new Date().toISOString()
  ): Promise<boolean> {
    const result = await this.executor.query(
      `UPDATE provider_dead_letters
       SET resolved_at = COALESCE(resolved_at, $2)
       WHERE id = $1`,
      [id, resolvedAt]
    );
    return result.rowCount === 1;
  }

  async purgeResolved(olderThan?: string): Promise<number> {
    const result = await this.executor.query(
      `DELETE FROM provider_dead_letters
       WHERE resolved_at IS NOT NULL
         AND ($1::timestamptz IS NULL OR resolved_at < $1)`,
      [olderThan ?? null]
    );
    return result.rowCount;
  }
}

interface DeadLetterRow {
  id: string;
  provider_key: string;
  operation: string;
  payload: unknown;
  error_message: string;
  attempts: number;
  created_at: string | Date;
  resolved_at: string | Date | null;
}

function mapDeadLetterRow(row: DeadLetterRow): DeadLetterRecord {
  return {
    id: row.id,
    providerKey: row.provider_key,
    operation: row.operation,
    payload:
      row.payload && typeof row.payload === "object"
        ? row.payload as Readonly<Record<string, unknown>>
        : {},
    errorMessage: row.error_message,
    attempts: row.attempts,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    resolvedAt: row.resolved_at
      ? row.resolved_at instanceof Date
        ? row.resolved_at.toISOString()
        : row.resolved_at
      : undefined
  };
}

export interface ProviderRuntimeStatus {
  providerKey: string;
  configured: boolean;
  circuitState: CircuitState;
  failureCount: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
}

export class ProviderStatusRegistry {
  private readonly entries =
    new Map<string, ProviderRuntimeStatus>();

  configure(providerKey: string, configured: boolean): void {
    const current = this.entries.get(providerKey);
    this.entries.set(providerKey, {
      providerKey,
      configured,
      circuitState: current?.circuitState ?? "closed",
      failureCount: current?.failureCount ?? 0,
      lastFailureAt: current?.lastFailureAt,
      lastSuccessAt: current?.lastSuccessAt
    });
  }

  update(input: ProviderRuntimeStatus): void {
    this.entries.set(input.providerKey, input);
  }

  list(): readonly ProviderRuntimeStatus[] {
    return [...this.entries.values()].sort((left, right) =>
      left.providerKey.localeCompare(right.providerKey)
    );
  }
}

export interface ResilienceOptions {
  providerKey: string;
  operation: string;
  maxAttempts?: number;
  initialDelayMs?: number;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  deadLetters?: DeadLetterRepository;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt?: number;
  private state: CircuitState = "closed";

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 30_000
  ) {}

  getState(): CircuitState {
    if (
      this.state === "open" &&
      this.openedAt !== undefined &&
      Date.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this.state = "half-open";
    }
    return this.state;
  }

  beforeRequest(): void {
    if (this.getState() === "open") {
      throw new Error("provider_circuit_open");
    }
  }

  getFailureCount(): number {
    return this.failures;
  }

  success(): void {
    this.failures = 0;
    this.openedAt = undefined;
    this.state = "closed";
  }

  failure(): void {
    this.failures += 1;
    if (
      this.state === "half-open" ||
      this.failures >= this.failureThreshold
    ) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class ResilientFetchClient implements FetchClient {
  private readonly breaker: CircuitBreaker;

  private lastFailureAt?: string;
  private lastSuccessAt?: string;

  constructor(
    private readonly inner: FetchClient,
    private readonly options: ResilienceOptions,
    private readonly statusRegistry?: ProviderStatusRegistry
  ) {
    this.breaker = new CircuitBreaker(
      options.failureThreshold ?? 5,
      options.resetTimeoutMs ?? 30_000
    );
    this.publishStatus();
  }

  private publishStatus(): void {
    this.statusRegistry?.update({
      providerKey: this.options.providerKey,
      configured: true,
      circuitState: this.breaker.getState(),
      failureCount: this.breaker.getFailureCount(),
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt
    });
  }

  getCircuitState(): CircuitState {
    return this.breaker.getState();
  }

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    this.breaker.beforeRequest();
    const maxAttempts = Math.max(1, this.options.maxAttempts ?? 3);
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.inner.fetch(input, init);
        if (!retryableStatus(response.status)) {
          this.breaker.success();
          this.lastSuccessAt = new Date().toISOString();
          this.publishStatus();
          return response;
        }

        lastError = new Error(`provider_http_${response.status}`);
      } catch (error) {
        lastError = error instanceof Error
          ? error
          : new Error("provider_request_failed");
      }

      this.breaker.failure();
      this.lastFailureAt = new Date().toISOString();
      this.publishStatus();

      if (attempt < maxAttempts) {
        const baseDelay = this.options.initialDelayMs ?? 250;
        await delay(baseDelay * 2 ** (attempt - 1));
      }
    }

    const error = lastError ?? new Error("provider_request_failed");
    await this.options.deadLetters?.append({
      id: crypto.randomUUID(),
      providerKey: this.options.providerKey,
      operation: this.options.operation,
      payload: {
        url: input,
        method: init?.method ?? "GET",
        body:
          process.env.DEAD_LETTER_STORE_BODY === "true" &&
          typeof init?.body === "string"
            ? init.body.slice(0, 200_000)
            : undefined,
        bodyStored:
          process.env.DEAD_LETTER_STORE_BODY === "true",
        contentType:
          new Headers(init?.headers).get("content-type") ?? undefined
      },
      errorMessage: error.message,
      attempts: maxAttempts,
      createdAt: new Date().toISOString()
    });

    throw error;
  }
}

export interface DeadLetterRetryResult {
  retried: boolean;
  status?: number;
  resolved: boolean;
}

export class DeadLetterRetryService {
  constructor(
    private readonly repository: DeadLetterRepository,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async retry(id: string): Promise<DeadLetterRetryResult> {
    const record = await this.repository.findById(id);
    if (!record) throw new Error("dead_letter_not_found");
    if (record.resolvedAt) {
      return { retried: false, resolved: true };
    }

    const url = String(record.payload.url ?? "");
    const method = String(record.payload.method ?? "GET").toUpperCase();
    const body =
      typeof record.payload.body === "string"
        ? record.payload.body
        : undefined;

    if (!url || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      throw new Error("dead_letter_not_replayable");
    }

    const headers = new Headers();
    const contentType = record.payload.contentType;
    if (typeof contentType === "string") {
      headers.set("Content-Type", contentType);
    }

    const token = this.resolveProviderToken(record.providerKey);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await this.client.fetch(url, {
      method,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : body,
      signal: timeoutSignal(30_000)
    });

    if (!response.ok) {
      throw new Error(`provider_retry_http_${response.status}`);
    }

    const resolved = await this.repository.resolve(id);
    return {
      retried: true,
      status: response.status,
      resolved
    };
  }

  private resolveProviderToken(providerKey: string): string | undefined {
    switch (providerKey) {
      case "llm":
        return process.env.LLM_API_KEY;
      case "vacancies":
        return process.env.VACANCY_API_KEY;
      case "events":
        return process.env.EVENT_API_KEY;
      case "notifications":
        return process.env.NOTIFICATION_WEBHOOK_TOKEN;
      default:
        return undefined;
    }
  }
}

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  temperature?: number;
}

const PERSONAL_COACH_OUTPUT_BOUNDARY =
  "Gebruik de trajectcontext alleen om het antwoord persoonlijk en " +
  "handelingsgericht te maken. Noem nooit interne fase- of procesmodellen, " +
  "fasecodes, werknamen, veldnamen of technische labels in het antwoord.";

export class OpenAiCompatibleAnswerDraftProvider
  implements AnswerDraftProvider
{
  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async createDraft(
    chatbotKey: "general-coach" | "personal-journey-coach",
    request: ChatRequest,
    context: ChatContext,
    phase?: AdaptivePhaseDetectorResult,
    route?: RouteEngineResult,
    systemPrompt?: string
  ): Promise<AnswerDraft> {
    const response = await this.client.fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.config.temperature ?? 0.2,
          messages: [
            {
              role: "system",
              content: [
                systemPrompt ??
                  "Geef een correct, duidelijk en beknopt antwoord in het Nederlands.",
                chatbotKey === "personal-journey-coach"
                  ? PERSONAL_COACH_OUTPUT_BOUNDARY
                  : undefined
              ]
                .filter((value): value is string => Boolean(value))
                .join("\n\n")
            },
            {
              role: "user",
              content: JSON.stringify({
                chatbotKey,
                question: request.message,
                profileSlots: context.slots,
                journeyContext:
                  chatbotKey === "personal-journey-coach"
                    ? {
                        suggestedRoute: route?.bestRoute?.title,
                        nextQuestion: phase?.nextQuestion,
                        activeGoal:
                          context.graphMemory?.activeGoals[0],
                        nextAction:
                          context.graphMemory?.pendingActions[0],
                        blocker:
                          context.graphMemory?.openBlockers[0]
                      }
                    : undefined,
                route:
                  chatbotKey === "general-coach"
                    ? route?.bestRoute?.title
                    : undefined
              })
            }
          ]
        }),
        signal: timeoutSignal(this.config.timeoutMs ?? 30_000)
      }
    );

    const payload = await readJson<{
      choices?: readonly {
        message?: { content?: string };
      }[];
    }>(response);
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("llm_empty_response");

    return { directAnswer: content };
  }
}

export interface JsonVacancyProviderConfig {
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class JsonVacancyProvider implements VacancyProvider {
  constructor(
    private readonly config: JsonVacancyProviderConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async list(search: VacancySearch = {}): Promise<readonly Vacancy[]> {
    const url = new URL(this.config.endpoint);
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await this.client.fetch(url.toString(), {
      headers: this.config.apiKey
        ? { Authorization: `Bearer ${this.config.apiKey}` }
        : undefined,
      signal: timeoutSignal(this.config.timeoutMs ?? 20_000)
    });
    const payload = await readJson<{
      vacancies?: readonly Record<string, unknown>[];
      results?: readonly Record<string, unknown>[];
    }>(response);

    return (payload.vacancies ?? payload.results ?? []).map((item) => ({
      id: String(item.id ?? item.externalId ?? crypto.randomUUID()),
      externalId: item.externalId ? String(item.externalId) : undefined,
      title: String(item.title ?? ""),
      organization: item.organization ? String(item.organization) : undefined,
      sector: item.sector ? String(item.sector) : undefined,
      location: item.location ? String(item.location) : undefined,
      description: item.description ? String(item.description) : undefined,
      url: item.url ? String(item.url) : undefined,
      sourceName: item.sourceName ? String(item.sourceName) : "live-json",
      publishedAt: item.publishedAt ? String(item.publishedAt) : undefined,
      expiresAt: item.expiresAt ? String(item.expiresAt) : undefined,
      retrievedAt: new Date().toISOString()
    })).filter((item) => item.title);
  }
}

export interface JsonEventScraperConfig {
  apiKey?: string;
  timeoutMs?: number;
}

export class JsonEventScraper implements EventScraper {
  constructor(
    private readonly config: JsonEventScraperConfig = {},
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async scrape(source: EventSource): Promise<readonly Omit<
    EducationEvent,
    "id" | "retrievedAt" | "expiresAt"
  >[]> {
    const response = await this.client.fetch(source.url, {
      headers: this.config.apiKey
        ? { Authorization: `Bearer ${this.config.apiKey}` }
        : undefined,
      signal: timeoutSignal(this.config.timeoutMs ?? 20_000)
    });
    const payload = await readJson<{
      events?: readonly Record<string, unknown>[];
      results?: readonly Record<string, unknown>[];
    }>(response);

    return (payload.events ?? payload.results ?? []).map((item) => ({
      sourceName: String(item.sourceName ?? source.name),
      sourceUrl: String(item.sourceUrl ?? source.url),
      title: String(item.title ?? ""),
      description: item.description ? String(item.description) : undefined,
      startsAt: item.startsAt ? String(item.startsAt) : undefined,
      eventUrl: item.eventUrl ? String(item.eventUrl) : undefined
    })).filter((item) => item.title);
  }
}

export interface NotificationMessage {
  recipient: string;
  templateKey: string;
  subject: string;
  variables: Readonly<Record<string, string>>;
}

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<{ messageId: string }>;
}

export class NoopNotificationProvider implements NotificationProvider {
  async send(): Promise<{ messageId: string }> {
    return { messageId: `noop-${crypto.randomUUID()}` };
  }
}

export class WebhookNotificationProvider
  implements NotificationProvider
{
  constructor(
    private readonly endpoint: string,
    private readonly token?: string,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async send(
    message: NotificationMessage
  ): Promise<{ messageId: string }> {
    const response = await this.client.fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token
          ? { Authorization: `Bearer ${this.token}` }
          : {})
      },
      body: JSON.stringify(message),
      signal: timeoutSignal(20_000)
    });

    const payload = await readJson<{ messageId?: string }>(response);
    return {
      messageId: payload.messageId ?? crypto.randomUUID()
    };
  }
}

export function createLiveIntegrationsFromEnvironment(
  deadLetters: DeadLetterRepository =
    new InMemoryDeadLetterRepository()
) {
  const providerStatus = new ProviderStatusRegistry();
  providerStatus.configure("llm", Boolean(
    process.env.LLM_BASE_URL &&
    process.env.LLM_API_KEY &&
    process.env.LLM_MODEL
  ));
  providerStatus.configure(
    "vacancies",
    Boolean(process.env.VACANCY_API_URL)
  );
  providerStatus.configure(
    "events",
    Boolean(process.env.EVENT_API_URL)
  );
  providerStatus.configure(
    "notifications",
    Boolean(process.env.NOTIFICATION_WEBHOOK_URL)
  );

  const resilienceDefaults = {
    maxAttempts: Number(process.env.PROVIDER_MAX_ATTEMPTS ?? 3),
    initialDelayMs: Number(
      process.env.PROVIDER_INITIAL_DELAY_MS ?? 250
    ),
    failureThreshold: Number(
      process.env.PROVIDER_FAILURE_THRESHOLD ?? 5
    ),
    resetTimeoutMs: Number(
      process.env.PROVIDER_RESET_TIMEOUT_MS ?? 30_000
    ),
    deadLetters
  };
  const llm = process.env.LLM_BASE_URL &&
    process.env.LLM_API_KEY &&
    process.env.LLM_MODEL
    ? new OpenAiCompatibleAnswerDraftProvider(
        {
          baseUrl: process.env.LLM_BASE_URL,
          apiKey: process.env.LLM_API_KEY,
          model: process.env.LLM_MODEL,
          timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30_000)
        },
        new ResilientFetchClient(new NativeFetchClient(), {
          ...resilienceDefaults,
          providerKey: "llm",
          operation: "chat.completions"
        }, providerStatus)
      )
    : undefined;

  const vacancies = process.env.VACANCY_API_URL
    ? new JsonVacancyProvider(
        {
          endpoint: process.env.VACANCY_API_URL,
          apiKey: process.env.VACANCY_API_KEY
        },
        new ResilientFetchClient(new NativeFetchClient(), {
          ...resilienceDefaults,
          providerKey: "vacancies",
          operation: "list"
        }, providerStatus)
      )
    : undefined;

  const eventSources = process.env.EVENT_API_URL
    ? [
        {
          name:
            process.env.EVENT_API_NAME ??
            "Door010 event provider",
          url: process.env.EVENT_API_URL
        }
      ]
    : undefined;
  const events = eventSources
    ? new JsonEventScraper(
        {
          apiKey: process.env.EVENT_API_KEY
        },
        new ResilientFetchClient(new NativeFetchClient(), {
          ...resilienceDefaults,
          providerKey: "events",
          operation: "scrape"
        }, providerStatus)
      )
    : undefined;

  const notifications = process.env.NOTIFICATION_WEBHOOK_URL
    ? new WebhookNotificationProvider(
        process.env.NOTIFICATION_WEBHOOK_URL,
        process.env.NOTIFICATION_WEBHOOK_TOKEN,
        new ResilientFetchClient(new NativeFetchClient(), {
          ...resilienceDefaults,
          providerKey: "notifications",
          operation: "send"
        }, providerStatus)
      )
    : new NoopNotificationProvider();

  return {
    llm,
    vacancies,
    events,
    eventSources,
    notifications,
    deadLetters,
    providerStatus
  };
}

function extractJsonObject(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? value;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("model_json_missing");
  }
  return JSON.parse(source.slice(start, end + 1));
}

export class OpenAiIntentModel implements IntentModel {
  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async classify(
    messages: readonly { role: string; content: string }[]
  ): Promise<ConversationIntent> {
    const response = await this.client.fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                'Classificeer het laatste bericht als "greeting", ' +
                '"question", "exploration" of "followup". ' +
                'Antwoord alleen als JSON: {"intent":"..."}'
            },
            ...messages.map((message) => ({
              role: message.role,
              content: message.content.slice(0, 500)
            }))
          ]
        }),
        signal: timeoutSignal(this.config.timeoutMs ?? 15_000)
      }
    );

    const payload = await readJson<{
      choices?: readonly {
        message?: { content?: string };
      }[];
    }>(response);
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content) as {
      intent?: ConversationIntent;
    };
    if (
      !parsed.intent ||
      !["greeting", "question", "exploration", "followup"]
        .includes(parsed.intent)
    ) {
      throw new Error("intent_model_invalid");
    }
    return parsed.intent;
  }
}

export class OpenAiFaqRerankModel implements RerankModel {
  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async select(
    query: string,
    candidates: readonly KnowledgeSearchResult[],
    limit: number
  ): Promise<readonly number[]> {
    const candidateText = candidates.map((candidate, index) =>
      `[${index}] ${candidate.record.title}\n` +
      candidate.record.body.slice(0, 240)
    ).join("\n\n");

    const response = await this.client.fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                `Selecteer de ${limit} meest relevante kandidaten. ` +
                'Antwoord alleen als JSON: {"indices":[0,1,2]}'
            },
            {
              role: "user",
              content: `Vraag: ${query.slice(0, 800)}\n\n${candidateText}`
            }
          ]
        }),
        signal: timeoutSignal(this.config.timeoutMs ?? 15_000)
      }
    );

    const payload = await readJson<{
      choices?: readonly {
        message?: { content?: string };
      }[];
    }>(response);
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content) as {
      indices?: readonly number[];
    };
    if (!Array.isArray(parsed.indices)) {
      throw new Error("rerank_model_invalid");
    }
    return parsed.indices;
  }
}

export class OpenAiAnswerRepairModel implements AnswerRepairModel {
  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async repair(
    draft: string,
    issues: readonly string[],
    maxSentences: number
  ): Promise<string> {
    const response = await this.client.fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                `Herschrijf in maximaal ${maxSentences} korte zinnen. ` +
                "Verwijder interne termen, labels en systeeminformatie."
            },
            {
              role: "user",
              content:
                `Problemen: ${issues.join(", ")}\n\nAntwoord:\n${draft}`
            }
          ]
        }),
        signal: timeoutSignal(this.config.timeoutMs ?? 15_000)
      }
    );

    const payload = await readJson<{
      choices?: readonly {
        message?: { content?: string };
      }[];
    }>(response);
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("repair_model_empty");
    return content;
  }
}

export interface FirecrawlTrustedWebSearchConfig {
  endpoint?: string;
  apiKey: string;
  timeoutMs?: number;
}

export class FirecrawlTrustedWebSearch implements TrustedWebSearch {
  constructor(
    private readonly config: FirecrawlTrustedWebSearchConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {}

  async search(
    query: string,
    allowedDomains: readonly string[],
    limit = 3
  ): Promise<readonly WebKnowledgeResult[]> {
    const domains = allowedDomains
      .map((domain) => domain.replace(/^https?:\/\//, "").split("/")[0]!)
      .filter(Boolean)
      .slice(0, 5);
    if (domains.length === 0) return [];

    const siteFilter = domains
      .map((domain) => `site:${domain}`)
      .join(" OR ");
    const response = await this.client.fetch(
      this.config.endpoint ?? "https://api.firecrawl.dev/v1/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: `${query.slice(0, 300)} (${siteFilter})`,
          limit: Math.max(1, Math.min(limit, 3)),
          lang: "nl",
          country: "nl",
          scrapeOptions: {
            formats: ["markdown"]
          }
        }),
        signal: timeoutSignal(this.config.timeoutMs ?? 20_000)
      }
    );

    const payload = await readJson<{
      success?: boolean;
      data?: readonly {
        title?: string;
        url?: string;
        markdown?: string;
      }[];
    }>(response);

    const allowed = new Set(
      domains.map((domain) => domain.replace(/^www\./, ""))
    );
    const now = new Date().toISOString();

    return (payload.data ?? [])
      .filter((item) => {
        if (!item.markdown || !item.url) return false;
        try {
          const hostname = new URL(item.url).hostname.replace(/^www\./, "");
          return [...allowed].some(
            (domain) =>
              hostname === domain ||
              hostname.endsWith(`.${domain}`)
          );
        } catch {
          return false;
        }
      })
      .slice(0, Math.max(1, Math.min(limit, 3)))
      .map((item) => ({
        title: item.title?.trim() || "Externe bron",
        text: (item.markdown ?? "")
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/^[-*]\s+/gm, "")
          .replace(/\|/g, " ")
          .replace(/\*\*|__/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 1200),
        sourceUrl: item.url,
        sourceKey: `web-${new URL(item.url!).hostname.replace(/^www\./, "")}`,
        retrievedAt: now
      }));
  }
}

export interface OpenAiEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions?: number;
  timeoutMs?: number;
}

export class OpenAiEmbeddingProvider
  implements EmbeddingProvider
{
  readonly modelKey: string;
  readonly dimensions: number;

  constructor(
    private readonly config: OpenAiEmbeddingConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {
    this.modelKey = config.model;
    this.dimensions = config.dimensions ?? 1536;
  }

  async embed(
    texts: readonly string[]
  ): Promise<readonly number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/embeddings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
          ...(this.config.dimensions
            ? { dimensions: this.config.dimensions }
            : {})
        }),
        signal: timeoutSignal(this.config.timeoutMs ?? 30_000)
      }
    );

    const payload = await readJson<{
      data?: readonly {
        index: number;
        embedding: readonly number[];
      }[];
    }>(response);

    const ordered = [...(payload.data ?? [])]
      .sort((left, right) => left.index - right.index)
      .map((item) => [...item.embedding]);

    if (ordered.length !== texts.length) {
      throw new Error("embedding_response_count_mismatch");
    }

    for (const embedding of ordered) {
      if (embedding.length !== this.dimensions) {
        throw new Error("embedding_dimension_mismatch");
      }
    }

    return ordered;
  }
}

export interface CrossEncoderConfig {
  endpoint: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
}

export class HttpCrossEncoderReranker
  implements CrossEncoderReranker
{
  readonly providerKey: string;

  constructor(
    private readonly config: CrossEncoderConfig,
    private readonly client: FetchClient = new NativeFetchClient()
  ) {
    this.providerKey = `cross-encoder:${config.model}`;
  }

  async score(
    query: string,
    candidates: readonly KnowledgeRecord[]
  ): Promise<readonly number[]> {
    if (candidates.length === 0) return [];

    const response = await this.client.fetch(
      this.config.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey
            ? {
                Authorization:
                  `Bearer ${this.config.apiKey}`
              }
            : {})
        },
        body: JSON.stringify({
          model: this.config.model,
          query,
          documents: candidates.map((candidate) => ({
            id: candidate.id,
            text: [
              candidate.title,
              candidate.body,
              candidate.category ?? "",
              ...candidate.tags
            ].join("\n")
          }))
        }),
        signal: timeoutSignal(
          this.config.timeoutMs ?? 20_000
        )
      }
    );

    const payload = await readJson<{
      scores?: readonly number[];
      data?: readonly {
        index: number;
        score: number;
      }[];
    }>(response);

    if (Array.isArray(payload.scores)) {
      return payload.scores.map(Number);
    }

    if (Array.isArray(payload.data)) {
      return [...payload.data]
        .sort((left, right) => left.index - right.index)
        .map((item) => Number(item.score));
    }

    throw new Error("cross_encoder_response_invalid");
  }
}

export class LocalConceptCrossEncoder
  implements CrossEncoderReranker
{
  readonly providerKey = "local-concept-cross-encoder-v1";

  async score(
    query: string,
    candidates: readonly KnowledgeRecord[]
  ): Promise<readonly number[]> {
    const queryTokens = new Set(
      query
        .toLocaleLowerCase("nl")
        .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 2)
    );

    return candidates.map((candidate) => {
      const text = [
        candidate.title,
        candidate.body,
        candidate.category ?? "",
        ...candidate.tags
      ]
        .join(" ")
        .toLocaleLowerCase("nl");
      const documentTokens = new Set(
        text
          .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
          .split(/\s+/)
          .filter((token) => token.length >= 2)
      );
      const overlap = [...queryTokens].filter((token) =>
        documentTokens.has(token)
      ).length;

      return overlap / Math.max(queryTokens.size, 1);
    });
  }
}
