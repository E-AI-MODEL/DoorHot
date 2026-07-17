import { describe, expect, it } from "vitest";
import {
  DeadLetterRetryService,
  InMemoryDeadLetterRepository,
  type FetchClient
} from "../src/index.js";

class SuccessfulRetryClient implements FetchClient {
  async fetch(): Promise<Response> {
    return new Response(null, { status: 204 });
  }
}

describe("dead-letter management", () => {
  it("retries and resolves a failed provider request", async () => {
    const repository = new InMemoryDeadLetterRepository();
    await repository.append({
      id: "11111111-1111-4111-8111-111111111111",
      providerKey: "events",
      operation: "scrape",
      payload: {
        url: "https://provider.test/events",
        method: "GET"
      },
      errorMessage: "provider_http_503",
      attempts: 3,
      createdAt: "2026-01-01T00:00:00.000Z"
    });

    const result = await new DeadLetterRetryService(
      repository,
      new SuccessfulRetryClient()
    ).retry("11111111-1111-4111-8111-111111111111");

    expect(result).toEqual({
      retried: true,
      status: 204,
      resolved: true
    });
    expect(await repository.list()).toHaveLength(0);
  });

  it("marks and purges handled records", async () => {
    const repository = new InMemoryDeadLetterRepository();
    await repository.append({
      id: "22222222-2222-4222-8222-222222222222",
      providerKey: "vacancies",
      operation: "list",
      payload: {
        url: "https://provider.test/vacancies",
        method: "GET"
      },
      errorMessage: "provider_http_500",
      attempts: 2,
      createdAt: "2026-01-01T00:00:00.000Z"
    });

    expect(
      await repository.resolve(
        "22222222-2222-4222-8222-222222222222"
      )
    ).toBe(true);
    expect(await repository.list(100, true)).toHaveLength(1);
    expect(await repository.purgeResolved()).toBe(1);
  });
});
