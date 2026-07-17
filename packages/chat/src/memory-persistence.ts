import type {
  ConversationDto,
  MessageDto
} from "@door010/contracts";
import type { AdaptivePhaseDetectorResult } from "@door010/domain";
import type {
  AdvisorChatPersistence,
  ChatPersistence
} from "./index.js";

export class InMemoryConversationPersistence
  implements ChatPersistence, AdvisorChatPersistence
{
  private readonly conversations = new Map<string, ConversationDto>();
  private readonly messages = new Map<string, MessageDto[]>();
  readonly snapshots: Array<Readonly<Record<string, unknown>>> = [];
  readonly phaseEvaluations: AdaptivePhaseDetectorResult[] = [];

  async ensureConversation(input: {
    conversationId?: string;
    userId?: string;
    candidateUserId?: string;
    title?: string;
    type?: "general-ai" | "personal-ai" | "advisor";
  }): Promise<ConversationDto> {
    if (input.conversationId) {
      const existing = this.conversations.get(input.conversationId);
      if (existing) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const conversation: ConversationDto = {
      id: input.conversationId ?? globalThis.crypto.randomUUID(),
      userId: input.userId ?? input.candidateUserId,
      title: input.title ?? "Gesprek",
      type: input.type ?? "advisor",
      createdAt: now,
      updatedAt: now
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async findConversation(
    conversationId: string
  ): Promise<ConversationDto | null> {
    return this.conversations.get(conversationId) ?? null;
  }

  async appendMessage(message: MessageDto): Promise<void> {
    const items = this.messages.get(message.conversationId) ?? [];
    items.push(message);
    this.messages.set(message.conversationId, items);
  }

  async listMessages(
    conversationId: string
  ): Promise<readonly MessageDto[]> {
    return [...(this.messages.get(conversationId) ?? [])];
  }

  async savePhaseEvaluation(
    _profileId: string,
    result: AdaptivePhaseDetectorResult
  ): Promise<void> {
    this.phaseEvaluations.push(result);
  }

  async saveDetectorSnapshot(input: {
    profileId: string;
    conversationId?: string;
    detectorInput: Readonly<Record<string, unknown>>;
    detectorOutput: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    this.snapshots.push(input);
  }
}
