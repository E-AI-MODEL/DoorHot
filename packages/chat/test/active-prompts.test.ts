import { describe, expect, it } from "vitest";
import type {
  ActivePromptProvider,
  AnswerDraftProvider,
  ChatContext
} from "../src/index.js";
import { GeneralCoach } from "../src/index.js";
import type { ChatRequest } from "@door010/contracts";

describe("active coach prompts", () => {
  it("passes the approved prompt to the answer provider", async () => {
    let receivedPrompt: string | undefined;

    const draftProvider: AnswerDraftProvider = {
      async createDraft(
        _chatbotKey,
        _request,
        _context: ChatContext,
        _phase,
        _route,
        systemPrompt
      ) {
        receivedPrompt = systemPrompt;
        return { directAnswer: "Antwoord" };
      }
    };
    const promptProvider: ActivePromptProvider = {
      async getActivePrompt() {
        return "Gebruik uitsluitend gecontroleerde bronnen.";
      }
    };

    const coach = new GeneralCoach(
      draftProvider,
      undefined,
      promptProvider
    );
    await coach.respond({
      message: "Wat kost zij-instroom?"
    } satisfies ChatRequest);

    expect(receivedPrompt).toBe(
      "Gebruik uitsluitend gecontroleerde bronnen."
    );
  });
});
