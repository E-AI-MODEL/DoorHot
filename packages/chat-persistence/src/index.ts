import type {
  ConversationDto,
  MessageDto
} from "@door010/contracts";
import type { AdaptivePhaseDetectorResult } from "@door010/domain";
import type {
  AdvisorChatPersistence,
  ChatPersistence
} from "@door010/chat";
import type {
  ConversationRepository,
  DetectorSnapshotRepository,
  MessageRepository,
  PhaseRepository
} from "@door010/database";

export class DatabaseChatPersistence
  implements ChatPersistence, AdvisorChatPersistence
{
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
    private readonly phases: PhaseRepository,
    private readonly snapshots: DetectorSnapshotRepository
  ) {}

  async ensureConversation(input: {
    conversationId?: string;
    userId?: string;
    candidateUserId?: string;
    title?: string;
    type?: "general-ai" | "personal-ai" | "advisor";
  }): Promise<ConversationDto> {
    if (input.conversationId) {
      const existing = await this.conversations.findById(
        input.conversationId
      );
      if (existing) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const record = {
      id: input.conversationId ?? globalThis.crypto.randomUUID(),
      userId: input.userId ?? input.candidateUserId,
      title: input.title ?? "Adviseursgesprek",
      type: input.type ?? "advisor",
      createdAt: now,
      updatedAt: now
    } as const;

    await this.conversations.create(record);
    return record;
  }

  async findConversation(
    conversationId: string
  ): Promise<ConversationDto | null> {
    return this.conversations.findById(conversationId);
  }

  async appendMessage(message: MessageDto): Promise<void> {
    await this.messages.append(message);
  }

  async listMessages(
    conversationId: string
  ): Promise<readonly MessageDto[]> {
    return this.messages.listByConversationId(conversationId);
  }

  async savePhaseEvaluation(
    profileId: string,
    result: AdaptivePhaseDetectorResult
  ): Promise<void> {
    await this.phases.saveEvaluation({
      id: globalThis.crypto.randomUUID(),
      profileId,
      phaseKey: result.phaseEvaluation.currentPhaseCode,
      confidence: result.phaseConfidence,
      evidence: result.evidence,
      missingSlots: result.missingSlots,
      nextQuestionKey: result.nextQuestionId,
      engineVersion: "adaptive-phase-detector-v2",
      evaluatedAt: new Date().toISOString(),
      resolvedPhaseSystemKey: result.phaseSystem.phaseSystemKey,
      phaseSystemSource: result.phaseSystem.source,
      mappedDetectorPhase: result.mappedDetectorPhase,
      transitionAllowed:
        result.phaseEvaluation.transitionAllowed,
      entrySatisfied: result.phaseEvaluation.entrySatisfied,
      exitSatisfied: result.phaseEvaluation.exitSatisfied
    });
  }

  async saveDetectorSnapshot(input: {
    profileId: string;
    conversationId?: string;
    detectorInput: Readonly<Record<string, unknown>>;
    detectorOutput: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.snapshots.save({
      id: globalThis.crypto.randomUUID(),
      profileId: input.profileId,
      conversationId: input.conversationId,
      input: input.detectorInput,
      output: input.detectorOutput,
      rulesVersion: "phase-detector-v3",
      createdAt: new Date().toISOString()
    });
  }
}


import type {
  PendingMutationDto,
  ProposedMutation
} from "@door010/contracts";
import type {
  MutableChatContextProvider,
  PendingMutationStore,
  ChatContext
} from "@door010/chat";
import type {
  ChatRequest
} from "@door010/contracts";
import type {
  SqlExecutor
} from "@door010/database";

interface PendingMutationRow {
  id: string;
  conversation_id: string | null;
  user_id: string | null;
  profile_id: string | null;
  mutation_type: "profile-slot" | "phase-transition";
  payload: unknown;
  status: "pending" | "accepted" | "rejected";
  created_at: string | Date;
  resolved_at: string | Date | null;
  resolved_by_user_id: string | null;
  reason: string | null;
}

function asObject(
  value: unknown
): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function mapPendingMutation(
  row: PendingMutationRow
): PendingMutationDto {
  return {
    id: row.id,
    conversationId: row.conversation_id ?? undefined,
    userId: row.user_id ?? undefined,
    profileId: row.profile_id ?? undefined,
    mutation: {
      type: row.mutation_type,
      requiresConfirmation: true,
      payload: asObject(row.payload)
    },
    status: row.status,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at,
    resolvedAt: row.resolved_at
      ? row.resolved_at instanceof Date
        ? row.resolved_at.toISOString()
        : row.resolved_at
      : undefined,
    resolvedByUserId: row.resolved_by_user_id ?? undefined,
    reason: row.reason ?? undefined
  };
}

export class PostgresPendingMutationStore
  implements PendingMutationStore
{
  constructor(private readonly executor: SqlExecutor) {}

  async create(input: {
    conversationId?: string;
    userId?: string;
    profileId?: string;
    mutation: ProposedMutation;
  }): Promise<PendingMutationDto> {
    const result = await this.executor.query<PendingMutationRow>(
      `INSERT INTO pending_mutations (
         id, conversation_id, user_id, profile_id, mutation_type,
         payload, requires_confirmation, status, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6::jsonb, true, 'pending', now()
       )
       RETURNING *`,
      [
        globalThis.crypto.randomUUID(),
        input.conversationId ?? null,
        input.userId ?? null,
        input.profileId ?? null,
        input.mutation.type,
        JSON.stringify(input.mutation.payload)
      ]
    );
    return mapPendingMutation(result.rows[0]!);
  }

  async findById(id: string): Promise<PendingMutationDto | null> {
    const result = await this.executor.query<PendingMutationRow>(
      `SELECT * FROM pending_mutations WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rows[0] ? mapPendingMutation(result.rows[0]) : null;
  }

  async listPending(input: {
    conversationId?: string;
    userId?: string;
  }): Promise<readonly PendingMutationDto[]> {
    const result = await this.executor.query<PendingMutationRow>(
      `SELECT * FROM pending_mutations
       WHERE status = 'pending'
         AND ($1::uuid IS NULL OR conversation_id = $1)
         AND ($2::uuid IS NULL OR user_id = $2)
       ORDER BY created_at DESC`,
      [input.conversationId ?? null, input.userId ?? null]
    );
    return result.rows.map(mapPendingMutation);
  }

  async resolve(input: {
    mutationId: string;
    decision: "accept" | "reject";
    resolvedByUserId: string;
    reason?: string;
  }): Promise<PendingMutationDto> {
    const result = await this.executor.query<PendingMutationRow>(
      `UPDATE pending_mutations
       SET status = $2,
           resolved_by_user_id = $3,
           reason = $4,
           resolved_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [
        input.mutationId,
        input.decision === "accept" ? "accepted" : "rejected",
        input.resolvedByUserId,
        input.reason ?? null
      ]
    );
    const row = result.rows[0];
    if (!row) {
      const existing = await this.findById(input.mutationId);
      throw new Error(
        existing ? "mutation_already_resolved" : "mutation_not_found"
      );
    }
    return mapPendingMutation(row);
  }
}

interface ContextProfileRow {
  profile_id: string;
  current_phase_key: string | null;
  known_slots: unknown;
  phase_system_key: string | null;
  completed_phase_codes: unknown;
  selected_entities: unknown;
  events: unknown;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export class PostgresChatContextProvider
  implements MutableChatContextProvider
{
  constructor(
    private readonly executor: SqlExecutor,
    private readonly defaultPhaseCode = "interesse"
  ) {}

  async getContext(request: ChatRequest): Promise<ChatContext> {
    if (!request.userId) {
      return {
        organizationId: request.organizationId,
        slots: []
      };
    }

    const result = await this.executor.query<ContextProfileRow>(
      `SELECT
         p.id AS profile_id,
         p.current_phase_key,
         p.known_slots,
         js.phase_system_key,
         js.completed_phase_codes,
         js.selected_entities,
         js.events
       FROM profiles p
       LEFT JOIN journey_states js ON js.profile_id = p.id
       WHERE p.user_id = $1
       LIMIT 1`,
      [request.userId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("profile_not_found");
    }

    const slotsObject = asObject(row.known_slots);
    const slots = Object.entries(slotsObject).map(([key, value]) => ({
      key: key as never,
      value: value as never,
      confidence: 1,
      source: "user" as const,
      updatedAt: new Date().toISOString()
    }));

    return {
      organizationId: request.organizationId,
      profileId: row.profile_id,
      currentPhaseCode:
        row.current_phase_key ?? this.defaultPhaseCode,
      completedPhaseCodes: stringArray(row.completed_phase_codes),
      slots,
      selectedEntities: asObject(row.selected_entities) as
        Readonly<Record<string, string | null>>,
      events: stringArray(row.events),
      intents: []
    };
  }

  async applyPhaseTransition(input: {
    profileId: string;
    phaseSystemKey: string;
    from: string;
    to: string;
  }): Promise<void> {
    const result = await this.executor.query(
      `UPDATE profiles
       SET current_phase_key = $3, updated_at = now()
       WHERE id = $1 AND COALESCE(current_phase_key, $2) = $2`,
      [input.profileId, input.from, input.to]
    );
    if (result.rowCount !== 1) {
      throw new Error("phase_transition_conflict");
    }

    await this.executor.query(
      `INSERT INTO journey_states (
         id, profile_id, phase_system_key, current_phase_code,
         canonical_journey_position, completed_phase_codes,
         selected_entities, events, updated_at
       ) VALUES (
         $1, $2, $3, $4, $4, $5::jsonb, '{}'::jsonb, '[]'::jsonb, now()
       )
       ON CONFLICT (profile_id) DO UPDATE SET
         phase_system_key = EXCLUDED.phase_system_key,
         current_phase_code = EXCLUDED.current_phase_code,
         canonical_journey_position = EXCLUDED.canonical_journey_position,
         completed_phase_codes =
           journey_states.completed_phase_codes || EXCLUDED.completed_phase_codes,
         updated_at = now()`,
      [
        globalThis.crypto.randomUUID(),
        input.profileId,
        input.phaseSystemKey,
        input.to,
        JSON.stringify([input.from])
      ]
    );
  }

  async applyProfileSlot(input: {
    profileId: string;
    slotKey: string;
    value: unknown;
  }): Promise<void> {
    await this.executor.query(
      `UPDATE profiles
       SET known_slots =
         COALESCE(known_slots, '{}'::jsonb) ||
         jsonb_build_object($2::text, $3::jsonb),
         updated_at = now()
       WHERE id = $1`,
      [input.profileId, input.slotKey, JSON.stringify(input.value)]
    );

    await this.executor.query(
      `INSERT INTO profile_slots (
         id, profile_id, slot_key, value, confidence, source,
         confirmed_by_user, version, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, 1, 'user', true, 1, now(), now()
       )
       ON CONFLICT (profile_id, slot_key) DO UPDATE SET
         value = EXCLUDED.value,
         confidence = 1,
         source = 'user',
         confirmed_by_user = true,
         version = profile_slots.version + 1,
         updated_at = now()`,
      [
        globalThis.crypto.randomUUID(),
        input.profileId,
        input.slotKey,
        JSON.stringify(input.value)
      ]
    );
  }
}
