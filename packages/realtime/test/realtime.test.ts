import { describe, expect, it } from "vitest";
import { InMemoryRealtimeBroker } from "../src/index.js";

describe("InMemoryRealtimeBroker", () => {
  it("publishes messages and supports unsubscribe", async () => {
    const broker = new InMemoryRealtimeBroker();
    const received: string[] = [];

    const unsubscribe = await broker.subscribe(
      "conversation:test",
      (payload) => received.push(payload)
    );

    await broker.publish("conversation:test", "first");
    await unsubscribe();
    await broker.publish("conversation:test", "second");

    expect(received).toEqual(["first"]);
  });
});
