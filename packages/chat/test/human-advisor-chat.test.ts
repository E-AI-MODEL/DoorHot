import { describe, expect, it } from "vitest";
import {
  AdvisorChatService,
  InMemoryConversationPersistence
} from "../src/index.js";

describe("human advisor chat", () => {
  it("stores candidate and advisor messages in one conversation", async () => {
    const persistence = new InMemoryConversationPersistence();
    const service = new AdvisorChatService(persistence);
    const conversationId =
      "11111111-1111-4111-8111-111111111111";

    await service.sendCandidate({
      conversationId,
      candidateUserId:
        "22222222-2222-4222-8222-222222222222",
      message: "Ik heb een vraag."
    });
    await service.send({
      conversationId,
      candidateUserId:
        "22222222-2222-4222-8222-222222222222",
      advisorUserId:
        "33333333-3333-4333-8333-333333333333",
      message: "Ik help je graag."
    });

    const history = await service.history(conversationId);

    expect(history.map((message) => message.role)).toEqual([
      "user",
      "advisor"
    ]);
  });
});
