import { describe, expect, it } from "vitest";
import {
  EventService,
  InMemoryEventScraper
} from "../src/index.js";

describe("EventService", () => {
  it("caches and saves scraped events", async () => {
    const source = { name: "Bron", url: "https://example.test" };
    const service = new EventService(
      new InMemoryEventScraper({
        [source.url]: [
          {
            sourceName: source.name,
            sourceUrl: source.url,
            title: "Open dag",
            startsAt: "2027-01-01T10:00:00.000Z"
          }
        ]
      }),
      [source]
    );

    const events = await service.refresh();
    expect(events).toHaveLength(1);

    service.save("user-1", events[0]!.id);
    expect(service.listSaved("user-1")).toHaveLength(1);
  });
});
