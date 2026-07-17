import { describe, expect, it } from "vitest";
import {
  CircuitBreaker,
  InMemoryDeadLetterRepository,
  ResilientFetchClient,
  type FetchClient
} from "../src/index.js";

class SequenceFetchClient implements FetchClient {
  calls = 0;

  constructor(
    private readonly statuses: readonly number[]
  ) {}

  async fetch(): Promise<Response> {
    const status =
      this.statuses[Math.min(this.calls, this.statuses.length - 1)] ??
      500;
    this.calls += 1;
    return new Response("{}", { status });
  }
}

describe("provider resilience", () => {
  it("retries transient failures and succeeds", async () => {
    const inner = new SequenceFetchClient([503, 200]);
    const client = new ResilientFetchClient(inner, {
      providerKey: "events",
      operation: "scrape",
      maxAttempts: 3,
      initialDelayMs: 1
    });

    const response = await client.fetch("https://provider.test");

    expect(response.status).toBe(200);
    expect(inner.calls).toBe(2);
    expect(client.getCircuitState()).toBe("closed");
  });

  it("writes a dead letter after final failure", async () => {
    const deadLetters = new InMemoryDeadLetterRepository();
    const client = new ResilientFetchClient(
      new SequenceFetchClient([503, 503]),
      {
        providerKey: "notifications",
        operation: "send",
        maxAttempts: 2,
        initialDelayMs: 1,
        deadLetters
      }
    );

    await expect(
      client.fetch("https://provider.test")
    ).rejects.toThrow("provider_http_503");

    expect(await deadLetters.list()).toHaveLength(1);
    expect((await deadLetters.list())[0]?.attempts).toBe(2);
  });

  it("opens a circuit after its failure threshold", () => {
    const breaker = new CircuitBreaker(2, 60_000);
    breaker.failure();
    breaker.failure();

    expect(breaker.getState()).toBe("open");
    expect(() => breaker.beforeRequest())
      .toThrow("provider_circuit_open");
  });
});
