import { describe, expect, it } from "vitest";
import {
  TalentTestService,
  type TalentTestDataset
} from "../src/index.js";

const dataset: TalentTestDataset = {
  schema_version: "1",
  title: "Test",
  sectors: {
    po: { label: "PO", description: "" },
    vo: { label: "VO", description: "" }
  },
  questions: [
    {
      id: "q1",
      question: "Vraag",
      options: [
        { value: "po", label: "PO", sectors: ["po"] },
        { value: "vo", label: "VO", sectors: ["vo"] }
      ]
    }
  ]
};

describe("TalentTestService", () => {
  it("calculates and stores ranked sectors", () => {
    const service = new TalentTestService(dataset);
    const result = service.submit("user-1", { q1: "po" });

    expect(result.primarySector).toBe("po");
    expect(service.findByUserId("user-1")?.primarySector)
      .toBe("po");
  });
});
