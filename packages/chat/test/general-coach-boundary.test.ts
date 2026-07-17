import { describe, expect, it } from "vitest";
import {
  DeterministicAnswerDraftProvider,
  GeneralCoach,
  InMemoryConversationPersistence
} from "../src/index.js";

describe("GeneralCoach parity boundary", () => {
  it("never proposes personal phase or slot mutations", async () => {
    const persistence = new InMemoryConversationPersistence();
    const coach = new GeneralCoach(
      new DeterministicAnswerDraftProvider(),
      persistence
    );

    const response = await coach.respond({
      message: "Welke opleiding kan ik volgen?",
      userId: "user-1"
    });

    expect(response.mutations).toEqual([]);
    expect(
      response.artifacts.some(
        (artifact) => artifact.type === "phase-proposal"
      )
    ).toBe(false);
  });
});
