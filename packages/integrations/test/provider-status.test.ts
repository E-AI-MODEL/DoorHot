import { describe, expect, it } from "vitest";
import {
  ProviderStatusRegistry,
  ResilientFetchClient,
  type FetchClient
} from "../src/index.js";

class SuccessfulFetch implements FetchClient {
  async fetch(): Promise<Response> {
    return new Response("{}", { status: 200 });
  }
}

describe("ProviderStatusRegistry", () => {
  it("tracks configured providers and circuit state", async () => {
    const registry = new ProviderStatusRegistry();
    registry.configure("llm", true);

    const client = new ResilientFetchClient(
      new SuccessfulFetch(),
      {
        providerKey: "llm",
        operation: "chat.completions",
        maxAttempts: 1
      },
      registry
    );

    await client.fetch("https://provider.test");

    expect(registry.list()).toEqual([
      expect.objectContaining({
        providerKey: "llm",
        configured: true,
        circuitState: "closed",
        failureCount: 0
      })
    ]);
  });
});
