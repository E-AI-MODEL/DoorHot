import { createHash, randomBytes } from "node:crypto";
import type {
  OrchestrationCapability,
  OrchestrationTool,
  OrchestrationToolContext
} from "./index.js";

export type ExecutionRequestStatus =
  | "pending_confirmation"
  | "approved"
  | "rejected"
  | "executed"
  | "failed"
  | "expired";

export interface ExecutionRequest {
  id: string;
  userId: string;
  orchestrationRunId?: string;
  toolKey: string;
  status: ExecutionRequestStatus;
  payload: Readonly<Record<string, unknown>>;
  confirmationHash: string;
  expiresAt: string;
  approvedAt?: string;
  executedAt?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationOutboxItem {
  id: string;
  executionRequestId: string;
  userId: string;
  channel: "in_app" | "email" | "webhook";
  recipient?: string;
  subject?: string;
  body: string;
  deliverAt: string;
  status: "queued" | "delivered" | "failed" | "cancelled";
  attempts: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface ExecutionRepository {
  saveRequest(request: ExecutionRequest): Promise<void>;
  findRequest(id: string): Promise<ExecutionRequest | null>;
  listRequests(
    userId?: string,
    limit?: number
  ): Promise<readonly ExecutionRequest[]>;
  saveOutbox(item: NotificationOutboxItem): Promise<void>;
  listOutbox(
    status?: NotificationOutboxItem["status"],
    limit?: number
  ): Promise<readonly NotificationOutboxItem[]>;
}

export interface ExecutionSqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: readonly Row[]; rowCount: number }>;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function executionNow(): string {
  return new Date().toISOString();
}

export class InMemoryExecutionRepository
  implements ExecutionRepository
{
  private readonly requests = new Map<string, ExecutionRequest>();
  private readonly outbox = new Map<string, NotificationOutboxItem>();

  async saveRequest(request: ExecutionRequest): Promise<void> {
    this.requests.set(request.id, request);
  }

  async findRequest(id: string): Promise<ExecutionRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async listRequests(
    userId?: string,
    limit = 100
  ): Promise<readonly ExecutionRequest[]> {
    return [...this.requests.values()]
      .filter((item) => !userId || item.userId === userId)
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async saveOutbox(item: NotificationOutboxItem): Promise<void> {
    this.outbox.set(item.id, item);
  }

  async listOutbox(
    status?: NotificationOutboxItem["status"],
    limit = 100
  ): Promise<readonly NotificationOutboxItem[]> {
    return [...this.outbox.values()]
      .filter((item) => !status || item.status === status)
      .sort((left, right) =>
        left.deliverAt.localeCompare(right.deliverAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }
}

interface ExecutionRequestRow {
  id: string;
  user_id: string;
  orchestration_run_id: string | null;
  tool_key: string;
  status: ExecutionRequestStatus;
  payload: unknown;
  confirmation_hash: string;
  expires_at: string | Date;
  approved_at: string | Date | null;
  executed_at: string | Date | null;
  error_code: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface OutboxRow {
  id: string;
  execution_request_id: string;
  user_id: string;
  channel: NotificationOutboxItem["channel"];
  recipient: string | null;
  subject: string | null;
  body: string;
  deliver_at: string | Date;
  status: NotificationOutboxItem["status"];
  attempts: number;
  last_error: string | null;
  created_at: string | Date;
  delivered_at: string | Date | null;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function optionalIso(
  value: string | Date | null
): string | undefined {
  return value ? iso(value) : undefined;
}

function objectValue(
  value: unknown
): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

export class PostgresExecutionRepository
  implements ExecutionRepository
{
  constructor(private readonly executor: ExecutionSqlExecutor) {}

  async saveRequest(request: ExecutionRequest): Promise<void> {
    await this.executor.query(
      `INSERT INTO execution_requests (
         id, user_id, orchestration_run_id, tool_key, status,
         payload, confirmation_hash, expires_at, approved_at,
         executed_at, error_code, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13
       )
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         payload = EXCLUDED.payload,
         approved_at = EXCLUDED.approved_at,
         executed_at = EXCLUDED.executed_at,
         error_code = EXCLUDED.error_code,
         updated_at = EXCLUDED.updated_at`,
      [
        request.id,
        request.userId,
        request.orchestrationRunId ?? null,
        request.toolKey,
        request.status,
        JSON.stringify(request.payload),
        request.confirmationHash,
        request.expiresAt,
        request.approvedAt ?? null,
        request.executedAt ?? null,
        request.errorCode ?? null,
        request.createdAt,
        request.updatedAt
      ]
    );
  }

  async findRequest(id: string): Promise<ExecutionRequest | null> {
    const result = await this.executor.query<ExecutionRequestRow>(
      `SELECT * FROM execution_requests WHERE id = $1`,
      [id]
    );
    return result.rows[0]
      ? mapExecutionRequest(result.rows[0])
      : null;
  }

  async listRequests(
    userId?: string,
    limit = 100
  ): Promise<readonly ExecutionRequest[]> {
    const result = await this.executor.query<ExecutionRequestRow>(
      `SELECT * FROM execution_requests
       WHERE ($1::uuid IS NULL OR user_id = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId ?? null, Math.max(1, Math.min(limit, 500))]
    );
    return result.rows.map(mapExecutionRequest);
  }

  async saveOutbox(item: NotificationOutboxItem): Promise<void> {
    await this.executor.query(
      `INSERT INTO notification_outbox (
         id, execution_request_id, user_id, channel,
         recipient, subject, body, deliver_at, status,
         attempts, last_error, created_at, delivered_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
       )
       ON CONFLICT (execution_request_id) DO UPDATE SET
         status = EXCLUDED.status,
         attempts = EXCLUDED.attempts,
         last_error = EXCLUDED.last_error,
         delivered_at = EXCLUDED.delivered_at`,
      [
        item.id,
        item.executionRequestId,
        item.userId,
        item.channel,
        item.recipient ?? null,
        item.subject ?? null,
        item.body,
        item.deliverAt,
        item.status,
        item.attempts,
        item.lastError ?? null,
        item.createdAt,
        item.deliveredAt ?? null
      ]
    );
  }

  async listOutbox(
    status?: NotificationOutboxItem["status"],
    limit = 100
  ): Promise<readonly NotificationOutboxItem[]> {
    const result = await this.executor.query<OutboxRow>(
      `SELECT * FROM notification_outbox
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY deliver_at ASC
       LIMIT $2`,
      [status ?? null, Math.max(1, Math.min(limit, 500))]
    );
    return result.rows.map((row) => ({
      id: row.id,
      executionRequestId: row.execution_request_id,
      userId: row.user_id,
      channel: row.channel,
      recipient: row.recipient ?? undefined,
      subject: row.subject ?? undefined,
      body: row.body,
      deliverAt: iso(row.deliver_at),
      status: row.status,
      attempts: row.attempts,
      lastError: row.last_error ?? undefined,
      createdAt: iso(row.created_at),
      deliveredAt: optionalIso(row.delivered_at)
    }));
  }
}

function mapExecutionRequest(
  row: ExecutionRequestRow
): ExecutionRequest {
  return {
    id: row.id,
    userId: row.user_id,
    orchestrationRunId: row.orchestration_run_id ?? undefined,
    toolKey: row.tool_key,
    status: row.status,
    payload: objectValue(row.payload),
    confirmationHash: row.confirmation_hash,
    expiresAt: iso(row.expires_at),
    approvedAt: optionalIso(row.approved_at),
    executedAt: optionalIso(row.executed_at),
    errorCode: row.error_code ?? undefined,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

export class SafeExecutionService {
  constructor(
    private readonly repository: ExecutionRepository,
    private readonly confirmationTtlMs = 15 * 60 * 1_000
  ) {}

  async propose(input: {
    userId: string;
    orchestrationRunId?: string;
    toolKey: "reminder.schedule" | "notification.queue";
    payload: Readonly<Record<string, unknown>>;
  }): Promise<{
    request: ExecutionRequest;
    confirmationToken: string;
  }> {
    const token = randomBytes(24).toString("base64url");
    const timestamp = executionNow();
    const request: ExecutionRequest = {
      id: crypto.randomUUID(),
      userId: input.userId,
      orchestrationRunId: input.orchestrationRunId,
      toolKey: input.toolKey,
      status: "pending_confirmation",
      payload: input.payload,
      confirmationHash: tokenHash(token),
      expiresAt: new Date(
        Date.now() + this.confirmationTtlMs
      ).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveRequest(request);
    return {
      request,
      confirmationToken: token
    };
  }

  async confirm(input: {
    requestId: string;
    userId: string;
    token: string;
    decision: "approve" | "reject";
  }): Promise<ExecutionRequest> {
    const current = await this.repository.findRequest(input.requestId);
    if (!current || current.userId !== input.userId) {
      throw new Error("execution_request_not_found");
    }
    if (current.status !== "pending_confirmation") {
      throw new Error("execution_request_not_pending");
    }
    if (Date.parse(current.expiresAt) <= Date.now()) {
      const expired = {
        ...current,
        status: "expired" as const,
        updatedAt: executionNow()
      };
      await this.repository.saveRequest(expired);
      throw new Error("execution_confirmation_expired");
    }
    if (tokenHash(input.token) !== current.confirmationHash) {
      throw new Error("execution_confirmation_invalid");
    }

    const timestamp = executionNow();
    if (input.decision === "reject") {
      const rejected: ExecutionRequest = {
        ...current,
        status: "rejected",
        updatedAt: timestamp
      };
      await this.repository.saveRequest(rejected);
      return rejected;
    }

    const approved: ExecutionRequest = {
      ...current,
      status: "approved",
      approvedAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveRequest(approved);

    const deliverAt = String(
      current.payload.deliverAt ??
      current.payload.remindAt ??
      timestamp
    );
    const outbox: NotificationOutboxItem = {
      id: crypto.randomUUID(),
      executionRequestId: current.id,
      userId: current.userId,
      channel:
        current.payload.channel === "email" ||
        current.payload.channel === "webhook"
          ? current.payload.channel
          : "in_app",
      recipient:
        typeof current.payload.recipient === "string"
          ? current.payload.recipient
          : undefined,
      subject:
        typeof current.payload.subject === "string"
          ? current.payload.subject
          : undefined,
      body: String(
        current.payload.body ??
        current.payload.message ??
        "Herinnering van Door010"
      ),
      deliverAt,
      status: "queued",
      attempts: 0,
      createdAt: timestamp
    };
    await this.repository.saveOutbox(outbox);

    const executed: ExecutionRequest = {
      ...approved,
      status: "executed",
      executedAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveRequest(executed);
    return executed;
  }

  listRequests(
    userId?: string,
    limit?: number
  ): Promise<readonly ExecutionRequest[]> {
    return this.repository.listRequests(userId, limit);
  }

  listOutbox(
    status?: NotificationOutboxItem["status"],
    limit?: number
  ): Promise<readonly NotificationOutboxItem[]> {
    return this.repository.listOutbox(status, limit);
  }
}

function extractDate(message: string): string {
  const isoMatch = message.match(
    /\b(20\d{2}-\d{2}-\d{2})(?:[ t](\d{2}:\d{2}))?\b/i
  );
  if (isoMatch) {
    return new Date(
      `${isoMatch[1]}T${isoMatch[2] ?? "09:00"}:00.000Z`
    ).toISOString();
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
}

abstract class ConfirmationExecutionTool
  implements OrchestrationTool
{
  abstract readonly key:
    | "reminder.schedule"
    | "notification.queue";
  readonly capability: OrchestrationCapability = "execution";
  readonly timeoutMs = 3_000;

  constructor(protected readonly service: SafeExecutionService) {}

  abstract execute(
    context: OrchestrationToolContext
  ): Promise<unknown>;

  protected requireUser(context: OrchestrationToolContext): string {
    if (!context.request.userId) {
      throw new Error("execution_user_required");
    }
    return context.request.userId;
  }
}

export class ReminderScheduleTool
  extends ConfirmationExecutionTool
{
  readonly key = "reminder.schedule" as const;

  execute(context: OrchestrationToolContext): Promise<unknown> {
    const userId = this.requireUser(context);
    return this.service.propose({
      userId,
      toolKey: this.key,
      payload: {
        message: context.request.message,
        remindAt: extractDate(context.request.message),
        channel: "in_app"
      }
    });
  }
}

export class NotificationQueueTool
  extends ConfirmationExecutionTool
{
  readonly key = "notification.queue" as const;

  execute(context: OrchestrationToolContext): Promise<unknown> {
    const userId = this.requireUser(context);
    return this.service.propose({
      userId,
      toolKey: this.key,
      payload: {
        body: context.request.message,
        deliverAt: executionNow(),
        channel: "in_app"
      }
    });
  }
}

export interface NotificationDeliveryProvider {
  readonly channel: NotificationOutboxItem["channel"];
  readonly providerKey: string;
  deliver(item: NotificationOutboxItem): Promise<void>;
}

export class InAppNotificationDeliveryProvider
  implements NotificationDeliveryProvider
{
  readonly channel = "in_app" as const;
  readonly providerKey = "in-app-outbox-v1";

  async deliver(): Promise<void> {
    return undefined;
  }
}

export interface HttpNotificationProviderConfig {
  channel: "email" | "webhook";
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class HttpNotificationDeliveryProvider
  implements NotificationDeliveryProvider
{
  readonly channel: "email" | "webhook";
  readonly providerKey: string;

  constructor(
    private readonly config: HttpNotificationProviderConfig
  ) {
    this.channel = config.channel;
    this.providerKey = `http-${config.channel}-v1`;
  }

  async deliver(item: NotificationOutboxItem): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {})
      },
      body: JSON.stringify({
        id: item.id,
        userId: item.userId,
        recipient: item.recipient,
        subject: item.subject,
        body: item.body,
        deliverAt: item.deliverAt
      }),
      signal: AbortSignal.timeout(
        this.config.timeoutMs ?? 10_000
      )
    });

    if (!response.ok) {
      throw new Error(
        `notification_provider_${response.status}`
      );
    }
  }
}

export interface DeliveryWorkerResult {
  inspected: number;
  delivered: number;
  failed: number;
  skipped: number;
}

export class NotificationDeliveryWorker {
  private readonly providers = new Map<
    NotificationOutboxItem["channel"],
    NotificationDeliveryProvider
  >();

  constructor(
    private readonly repository: ExecutionRepository,
    providers: readonly NotificationDeliveryProvider[],
    private readonly maximumAttempts = 5
  ) {
    for (const provider of providers) {
      this.providers.set(provider.channel, provider);
    }
  }

  async processDue(
    now = new Date()
  ): Promise<DeliveryWorkerResult> {
    const queued = await this.repository.listOutbox(
      "queued",
      500
    );
    const due = queued.filter(
      (item) => Date.parse(item.deliverAt) <= now.getTime()
    );
    const result: DeliveryWorkerResult = {
      inspected: queued.length,
      delivered: 0,
      failed: 0,
      skipped: queued.length - due.length
    };

    for (const item of due) {
      const provider = this.providers.get(item.channel);
      if (!provider) {
        await this.repository.saveOutbox({
          ...item,
          status: "failed",
          attempts: item.attempts + 1,
          lastError: "delivery_provider_missing"
        });
        result.failed += 1;
        continue;
      }

      try {
        await provider.deliver(item);
        await this.repository.saveOutbox({
          ...item,
          status: "delivered",
          attempts: item.attempts + 1,
          lastError: undefined,
          deliveredAt: new Date().toISOString()
        });
        result.delivered += 1;
      } catch (error) {
        const attempts = item.attempts + 1;
        await this.repository.saveOutbox({
          ...item,
          status:
            attempts >= this.maximumAttempts
              ? "failed"
              : "queued",
          attempts,
          lastError:
            error instanceof Error
              ? error.message
              : "delivery_failed"
        });
        result.failed += 1;
      }
    }

    return result;
  }
}

export class NotificationDeliveryScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly worker: NotificationDeliveryWorker,
    private readonly intervalMs = 30_000
  ) {}

  start(): void {
    this.stop();
    this.timer = setInterval(
      () => void this.worker.processDue(),
      this.intervalMs
    );
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
