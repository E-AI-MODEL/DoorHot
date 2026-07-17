import { describe, expect, it } from "vitest";
import {
  JsonVacancyProvider,
  OpenAiCompatibleAnswerDraftProvider,
  type FetchClient
} from "../src/index.js";

class FakeFetch implements FetchClient {
  constructor(private readonly payload: unknown) {}
  async fetch(): Promise<Response> {
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
