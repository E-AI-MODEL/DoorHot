import { describe, expect, it } from "vitest";
import { JourneyPhaseCatalog } from "../src/index.js";

const phases = [
  {
    id: "1",
    title: "Interesseren",
    code: "interesse",
    description: "",
    color: "#000000",
    sort: 1,
    status: "published",
    date_created: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "2",
    title: "Starten",
    code: "start",
    description: "",
    color: "#000000",
    sort: 6,
    status: "published",
    date_created: "2026-01-01T00:00:00.000Z"
  }
];

describe("JourneyPhaseCatalog", () => {
  it("separates detector phases from extended lifecycle phases", () => {
    const catalog = new JourneyPhaseCatalog(phases);

    expect(catalog.getDetectorPhases().map((phase) => phase.code)).toEqual([
      "interesse"
    ]);
    expect(catalog.getByCode("start")?.title).toBe("Starten");
  });
});
