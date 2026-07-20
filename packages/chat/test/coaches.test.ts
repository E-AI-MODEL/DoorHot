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

  it("uses journey context without exposing internal process labels", async () => {
    const provider = new DeterministicAnswerDraftProvider();
    const draft = await provider.createDraft(
      "personal-journey-coach",
      { message: "Wat kan ik nu doen?", userId: "user-1" },
      {
        slots: [],
        graphMemory: {
          activeGoals: ["een passende opleiding vinden"],
          pendingActions: ["opleidingen vergelijken"],
          openBlockers: ["toelatingseisen controleren"],
          evidenceClaims: []
        }
      },
      {
        currentPhaseTitle: "Interesseren",
        nextQuestion: "Welke onderwijssector spreekt je aan?"
      } as never,
      {
        bestRoute: { title: "Pabo" }
      } as never
    );

    expect(draft.directAnswer).toContain("Pabo");
    expect(draft.directAnswer).toContain("opleidingen vergelijken");
    expect(draft.directAnswer).toContain("toelatingseisen controleren");
    expect(draft.directAnswer).toContain(
      "Welke onderwijssector spreekt je aan?"
    );
    expect(draft.directAnswer).not.toContain("Interesseren");
    expect(draft.directAnswer).not.toMatch(/\bphase-[459]\b/i);
  });
});
