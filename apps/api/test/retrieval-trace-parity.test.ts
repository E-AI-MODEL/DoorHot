import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createApplicationServices } from "../src/bootstrap.js";

// Audit Blok 1: prove the candidate trace reflects the real runtime, and
// document the current (wrong-facet) baseline so a later fix (Blok 7) has a
// concrete before-state to invert. This test changes no product behaviour.
const datasetsDir = resolve(process.cwd(), "../../datasets");
const SALARY_QUERY = "Hoeveel verdient een leraar?";

describe("retrieval trace parity and consumer coverage", () => {
  it("ingests the three chat datasets into the runtime knowledge store", async () => {
    const services = await createApplicationServices(datasetsDir, {
      seedDemoAccounts: false
    });

    const records = await services.knowledgeRepository.list({
      limit: 500
    });
    // faq-seed (48) + regional desks (52) + route steps (66) = 166.
    expect(records.length).toBe(166);

    const byItemType = new Map<string, number>();
    for (const record of records) {
      const key = record.itemType ?? "(none)";
      byItemType.set(key, (byItemType.get(key) ?? 0) + 1);
    }

    // Desks and route steps carry their own itemType.
    expect(byItemType.get("regional_desk")).toBe(52);
    expect(byItemType.get("route_step")).toBe(66);
    // AUDIT FINDING (Blok 8): the 48 FAQ records carry NO itemType - they
    // only have a category. Source labelling / itemType handling cannot rely
    // on a "faq" itemType today. This assertion documents that gap so the
    // Blok 8 fix has a concrete before-state.
    expect(byItemType.get("(none)")).toBe(48);
  });

  it("exposes the same retrieval pipeline the general coach uses", async () => {
    const services = await createApplicationServices(datasetsDir, {
      seedDemoAccounts: false
    });

    // The exposed pipeline is the real one: its top candidate for the salary
    // query is the (wrong-facet) werktijden record, and the general coach -
    // which runs no-LLM and extractive in this env - answers from exactly
    // that record. Same selection via both paths => the trace is runtime.
    const retrieval = await services.retrievalPipeline.retrieve(
      SALARY_QUERY,
      { allowWebFallback: true }
    );
    const top = retrieval.internal[0];
    expect(top).toBeDefined();
    expect(top.record.title).toBe("Wat zijn de werktijden van een leraar?");

    // The correct salary record IS retrieved - just ranked below the wrong
    // one. This is the top-1-vs-top-3 selection problem, made visible.
    const salaryRecord = retrieval.internal.find((item) =>
      item.record.title.includes("salaris van een startende docent")
    );
    expect(
      salaryRecord,
      "het salarisrecord hoort wel in de kandidatenset te zitten"
    ).toBeDefined();

    const answer = await services.generalCoach.respond({
      message: SALARY_QUERY
    });
    // BASELINE (current bug): the no-LLM general coach answers with the
    // werktijden body for a salary question. Blok 7 must flip this.
    expect(answer.message).toContain("40 uur per week");
  });
});
