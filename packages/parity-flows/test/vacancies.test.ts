import { describe, expect, it } from "vitest";
import {
  InMemoryVacancyProvider,
  VacancyService
} from "../src/index.js";

const vacancies = [
  {
    id: "vacancy-1",
    title: "Docent Nederlands",
    organization: "School A",
    sector: "VO",
    location: "Rotterdam",
    retrievedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "vacancy-2",
    title: "Leerkracht groep 7",
    organization: "School B",
    sector: "PO",
    location: "Schiedam",
    retrievedAt: "2026-01-01T00:00:00.000Z"
  }
];

describe("VacancyService", () => {
  it("searches vacancies and links saved items to a profile summary", async () => {
    const service = new VacancyService(
      new InMemoryVacancyProvider(vacancies)
    );

    const results = await service.search({ sector: "VO" });
    expect(results).toHaveLength(1);

    await service.save(
      "11111111-1111-4111-8111-111111111111",
      "vacancy-1",
      "Interessant"
    );

    const summary = await service.getProfileSummary(
      "11111111-1111-4111-8111-111111111111"
    );

    expect(summary.savedVacancies).toHaveLength(1);
    expect(summary.preferredSectors).toEqual(["VO"]);
    expect(summary.organizations).toEqual(["School A"]);
  });

  it("removes a saved vacancy", async () => {
    const service = new VacancyService(
      new InMemoryVacancyProvider(vacancies)
    );
    const userId = "11111111-1111-4111-8111-111111111111";

    await service.save(userId, "vacancy-2");
    expect(service.remove(userId, "vacancy-2")).toBe(true);
    expect(await service.listSaved(userId)).toHaveLength(0);
  });
});
