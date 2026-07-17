import type {
  PendingMutationDto,
  ProposedMutation
} from "@door010/contracts";
import type {
  ChatContext,
  ChatContextProvider
} from "./index.js";
import type { ChatRequest } from "@door010/contracts";

export interface PendingMutationStore {
  create(input: {
    conversationId?: string;
    userId?: string;
    profileId?: string;
    mutation: ProposedMutation;
  }): Promise<PendingMutationDto>;
  findById(id: string): Promise<PendingMutationDto | null>;
  listPending(input: {
    conversationId?: string;
    userId?: string;
  }): Promise<readonly PendingMutationDto[]>;
  resolve(input: {
    mutationId: string;
    decision: "accept" | "reject";
    resolvedByUserId: string;
    reason?: string;
  }): Promise<PendingMutationDto>;
}

export class InMemoryPendingMutationStore
  implements PendingMutationStore
{
  private readonly records = new Map<string, PendingMutationDto>();

  async create(input: {
    conversationId?: string;
    userId?: string;
    profileId?: string;
    mutation: ProposedMutation;
  }): Promise<PendingMutationDto> {
    const record: PendingMutationDto = {
      id: globalThis.crypto.randomUUID(),
      conversationId: input.conversationId,
      userId: input.userId,
      profileId: input.profileId,
      mutation: input.mutation,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    this.records.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<PendingMutationDto | null> {
    return this.records.get(id) ?? null;
  }

  async listPending(input: {
    conversationId?: string;
    userId?: string;
  }): Promise<readonly PendingMutationDto[]> {
    return [...this.records.values()].filter((record) => {
      if (record.status !== "pending") {
        return false;
      }
      if (
        input.conversationId &&
        record.conversationId !== input.conversationId
      ) {
        return false;
      }
      if (input.userId && record.userId !== input.userId) {
        return false;
      }
      return true;
    });
  }

  async resolve(input: {
    mutationId: string;
    decision: "accept" | "reject";
    resolvedByUserId: string;
    reason?: string;
  }): Promise<PendingMutationDto> {
    const current = this.records.get(input.mutationId);
    if (!current) {
      throw new Error("mutation_not_found");
    }
    if (current.status !== "pending") {
      throw new Error("mutation_already_resolved");
    }

    const resolved: PendingMutationDto = {
      ...current,
      status: input.decision === "accept" ? "accepted" : "rejected",
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: input.resolvedByUserId,
      reason: input.reason
    };
    this.records.set(resolved.id, resolved);
    return resolved;
  }
}

export interface MutableChatContextProvider
  extends ChatContextProvider {
  applyPhaseTransition(input: {
    profileId: string;
    phaseSystemKey: string;
    from: string;
    to: string;
  }): Promise<void>;
  applyProfileSlot(input: {
    profileId: string;
    slotKey: string;
    value: unknown;
  }): Promise<void>;
}

export class InMemoryChatContextProvider
  implements MutableChatContextProvider
{
  private readonly contexts = new Map<string, ChatContext>();

  constructor(
    private readonly defaultPhaseCode = "interesse"
  ) {}

  async getContext(request: ChatRequest): Promise<ChatContext> {
    const profileId = request.userId;
    if (!profileId) {
      return {
        organizationId: request.organizationId,
        slots: []
      };
    }

    const existing = this.contexts.get(profileId);
    if (existing) {
      return {
        ...existing,
        organizationId:
          request.organizationId ?? existing.organizationId
      };
    }

    const created: ChatContext = {
      organizationId: request.organizationId,
      profileId,
      currentPhaseCode: this.defaultPhaseCode,
      completedPhaseCodes: [],
      slots: [],
      selectedEntities: {},
      events: [],
      intents: []
    };
    this.contexts.set(profileId, created);
    return created;
  }

  async applyPhaseTransition(input: {
    profileId: string;
    phaseSystemKey: string;
    from: string;
    to: string;
  }): Promise<void> {
    const current = this.contexts.get(input.profileId);
    if (!current) {
      throw new Error("profile_context_not_found");
    }
    if (current.currentPhaseCode !== input.from) {
      throw new Error("phase_transition_conflict");
    }

    this.contexts.set(input.profileId, {
      ...current,
      currentPhaseCode: input.to,
      completedPhaseCodes: [
        ...(current.completedPhaseCodes ?? []),
        input.from
      ]
    });
  }

  async applyProfileSlot(input: {
    profileId: string;
    slotKey: string;
    value: unknown;
  }): Promise<void> {
    const current = this.contexts.get(input.profileId);
    if (!current) {
      throw new Error("profile_context_not_found");
    }

    const nextSlots = current.slots.filter(
      (slot) => slot.key !== input.slotKey
    );
    nextSlots.push({
      key: input.slotKey as never,
      value: input.value as never,
      confidence: 1,
      source: "user",
      updatedAt: new Date().toISOString()
    });

    this.contexts.set(input.profileId, {
      ...current,
      slots: nextSlots
    });
  }
}

export class MutationApplicationService {
  constructor(
    private readonly store: PendingMutationStore,
    private readonly contexts: MutableChatContextProvider
  ) {}

  async resolve(input: {
    mutationId: string;
    decision: "accept" | "reject";
    userId: string;
    reason?: string;
  }): Promise<PendingMutationDto> {
    const pending = await this.store.findById(input.mutationId);
    if (!pending) {
      throw new Error("mutation_not_found");
    }
    if (pending.userId && pending.userId !== input.userId) {
      throw new Error("mutation_forbidden");
    }

    const resolved = await this.store.resolve({
      mutationId: input.mutationId,
      decision: input.decision,
      resolvedByUserId: input.userId,
      reason: input.reason
    });

    if (resolved.status !== "accepted" || !resolved.profileId) {
      return resolved;
    }

    if (resolved.mutation.type === "phase-transition") {
      const payload = resolved.mutation.payload;
      await this.contexts.applyPhaseTransition({
        profileId: resolved.profileId,
        phaseSystemKey: String(payload.phaseSystemKey),
        from: String(payload.from),
        to: String(payload.to)
      });
    }

    if (resolved.mutation.type === "profile-slot") {
      const payload = resolved.mutation.payload;
      await this.contexts.applyProfileSlot({
        profileId: resolved.profileId,
        slotKey: String(payload.slotKey),
        value: payload.value
      });
    }

    return resolved;
  }
}
