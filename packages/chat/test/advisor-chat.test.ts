import { describe, expect, it } from "vitest";
import {
  AdvisorChatService,
  InMemoryConversationPersistence
} from "../src/index.js";

describe("AdvisorChatService", () => {
  it("stores advisor messages with a distinct advisor role", async () => {
    const persistence = new InMemoryConversationPersistence();
    const service = new AdvisorChatService(persistence);

    const message = await service.send({
      conversationId: "11111111-1111-4111-8111-111111111111",
      advisorUserId: "22222222-2222-4222-8222-222222222222",
      candidateUserId: "33333333-3333-4333-8333-333333333333",
      message: "Zullen we een afspraak plannen?"
    });

    expect(message.role).toBe("advisor");
    expect(
      await service.history(
        "11111111-1111-4111-8111-111111111111"
      )
    ).toHaveLength(1);
  });
});
