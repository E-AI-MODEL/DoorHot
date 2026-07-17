import { describe, expect, it } from "vitest";
import {
  InMemoryConversationPersistence
} from "../src/index.js";

describe("personal persistence parity", () => {
  it("stores detector snapshots separately from messages", async () => {
    const persistence = new InMemoryConversationPersistence();

    await persistence.saveDetectorSnapshot({
      profileId: "profile-1",
      conversationId: "conversation-1",
      detectorInput: { currentPhaseCode: "orientatie" },
      detectorOutput: { nextQuestionId: "S00001" }
    });

    expect(persistence.snapshots).toHaveLength(1);
  });
});
