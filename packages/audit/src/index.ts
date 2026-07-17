import type { SqlExecutor } from "@door010/database";

export interface AuditEvent {
  id: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt: string;
}

export interface AuditEventRepository {
  append(event: AuditEvent): Promise<void>;
  list(input?: {
    actorUserId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
  }): Promise<readonly AuditEvent[]>;
}

export class AuditService {
  constructor(private readonly repository: AuditEventRepository) {}

  async record(input: Omit<AuditEvent, "id" | "occurredAt">): Promise<void> {
    await this.repository.append({
      ...input,
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString()
    });
  }

  list(input?: {
    actorUserId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
  }): Promise<readonly AuditEvent[]> {
    return this.repository.list(input);
  }
}

export class InMemoryAuditEventRepository
  implements AuditEventRepository
{
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async list(input: {
    actorUserId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
  } = {}): Promise<readonly AuditEvent[]> {
    return this.events
      .filter((event) =>
        (!input.actorUserId || event.actorUserId === input.actorUserId) &&
        (!input.action || event.action === input.action) &&
        (!input.targetType || event.targetType === input.targetType)
      )
      .sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt)
      )
      .slice(0, Math.max(1, Math.min(input.limit ?? 100, 500)));
  }
}

interface AuditRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: unknown;
  occurred_at: string | Date;
}

export class PostgresAuditEventRepository
  implements AuditEventRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async append(event: AuditEvent): Promise<void> {
    await this.executor.query(
      `INSERT INTO audit_events (
         id, actor_user_id, action, target_type, target_id,
         request_id, ip_address, user_agent, metadata, occurred_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10
       )`,
      [
        event.id,
        event.actorUserId ?? null,
        event.action,
        event.targetType,
        event.targetId ?? null,
        event.requestId ?? null,
        event.ipAddress ?? null,
        event.userAgent ?? null,
        JSON.stringify(event.metadata),
        event.occurredAt
      ]
    );
  }

  async list(input: {
    actorUserId?: string;
    action?: string;
    targetType?: string;
    limit?: number;
  } = {}): Promise<readonly AuditEvent[]> {
    const result = await this.executor.query<AuditRow>(
      `SELECT *
       FROM audit_events
       WHERE ($1::uuid IS NULL OR actor_user_id = $1)
         AND ($2::text IS NULL OR action = $2)
         AND ($3::text IS NULL OR target_type = $3)
       ORDER BY occurred_at DESC
       LIMIT $4`,
      [
        input.actorUserId ?? null,
        input.action ?? null,
        input.targetType ?? null,
        Math.max(1, Math.min(input.limit ?? 100, 500))
      ]
    );

    return result.rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id ?? undefined,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id ?? undefined,
      requestId: row.request_id ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? row.metadata as Readonly<Record<string, unknown>>
          : {},
      occurredAt:
        row.occurred_at instanceof Date
          ? row.occurred_at.toISOString()
          : row.occurred_at
    }));
  }
}
