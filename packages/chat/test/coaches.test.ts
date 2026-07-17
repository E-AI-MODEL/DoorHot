import { describe, expect, it } from "vitest";
import {
  DeterministicAnswerDraftProvider,
  GeneralCoach,
  PersonalJourneyCoach,
  type ChatContextProvider
} from "../src/index.js";

const contextProvider: ChatContextProvider = {
  async getContext() {
    return {
      profileId: "profile-1",
      slots: []
    };
  }
};

describe("coaches", () => {
  it("runs the general coach through the response pipeline", async () => {
    const coach = new GeneralCoach(
      new DeterministicAnswerDraftProvider()
    );

    const response = await coach.respond({
      message: "Hoe word ik leraar?"
    });

    expect(response.chatbotKey).toBe("general-coach");
    expect(response.message.length).toBeGreaterThan(10);
    expect(
      response.artifacts.some((artifact) => artifact.type === "intake")
    ).toBe(true);
  });

  it("requires authentication for the personal coach", async () => {
    const detector = {
      evaluate: async () => {
        throw new Error("should not be called");
      }
    };

    const coach = new PersonalJourneyCoach(
      contextProvider,
      new DeterministicAnswerDraftProvider(),
      detector as never
    );

    await expect(
      coach.respond({ message: "Wat is mijn volgende stap?" })
    ).rejects.toThrow("authenticated user");
  });
});
