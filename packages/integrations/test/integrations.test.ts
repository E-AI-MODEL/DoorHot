import { describe, expect, it } from "vitest";
import {
  JsonVacancyProvider,
  OpenAiCompatibleAnswerDraftProvider,
  type FetchClient
} from "../src/index.js";

class FakeFetch implements FetchClient {
  constructor(private readonly payload: unknown) {}
  lastInit?: RequestInit;

  async fetch(_input: string, init?: RequestInit): Promise<Response> {
    this.lastInit = init;
    return new Response(JSON.stringify(this.payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}

describe("live integrations", () => {
  it("maps OpenAI-compatible responses", async () => {
    const provider = new OpenAiCompatibleAnswerDraftProvider(
      { baseUrl: "https://llm.test/v1", apiKey: "key", model: "model" },
      new FakeFetch({
        choices: [{ message: { content: "Een antwoord." } }]
      })
    );

    const draft = await provider.createDraft(
      "general-coach",
      { message: "Vraag" },
      { slots: [] }
    );

    expect(draft.directAnswer).toBe("Een antwoord.");
  });

  it("sends useful journey context without internal phase labels", async () => {
    const client = new FakeFetch({
      choices: [{ message: { content: "Een persoonlijk antwoord." } }]
    });
    const provider = new OpenAiCompatibleAnswerDraftProvider(
      { baseUrl: "https://llm.test/v1", apiKey: "key", model: "model" },
      client
    );

    await provider.createDraft(
      "personal-journey-coach",
      { message: "Welke opleiding past bij mij?" },
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
      { bestRoute: { title: "Pabo" } } as never
    );

    const body = JSON.parse(String(client.lastInit?.body)) as {
      messages: readonly { role: string; content: string }[];
    };
    const userPayload = JSON.parse(body.messages[1]!.content) as {
      phase?: unknown;
      journeyContext?: Readonly<Record<string, unknown>>;
    };

    expect(userPayload).not.toHaveProperty("phase");
    expect(userPayload.journeyContext).toMatchObject({
      suggestedRoute: "Pabo",
      nextQuestion: "Welke onderwijssector spreekt je aan?",
      nextAction: "opleidingen vergelijken",
      blocker: "toelatingseisen controleren"
    });
    expect(body.messages[1]!.content).not.toContain("Interesseren");
    expect(body.messages[1]!.content).not.toMatch(/\bphase-[459]\b/i);
    expect(body.messages[0]!.content).toContain(
      "Noem nooit interne fase- of procesmodellen"
    );
  });

  it("maps vacancy JSON into canonical vacancies", async () => {
    const provider = new JsonVacancyProvider(
      { endpoint: "https://vacancies.test" },
      new FakeFetch({
        vacancies: [{ id: "v1", title: "Docent wiskunde" }]
      })
    );

    expect((await provider.list())[0]?.title)
      .toBe("Docent wiskunde");
  });
});
