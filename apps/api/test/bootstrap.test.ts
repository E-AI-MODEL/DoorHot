import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createApplicationServices } from "../src/bootstrap.js";

describe("createApplicationServices", () => {
  it("loads all datasets and wires both coaches", async () => {
    const services = await createApplicationServices(
      resolve(process.cwd(), "../../datasets")
    );

    const general = await services.generalCoach.respond({
      message: "Hoe word ik leraar?"
    });
    const shadowIdsBeforePersonal = new Set(
      (await services.shadowEvaluations.list()).map(
        (evaluation) => evaluation.id
      )
    );

    const personal = await services.personalCoach.respond({
      userId: "11111111-1111-4111-8111-111111111111",
      message: "Wat is een zij-instroomtraject?"
    });
    const rerankerShadowAfterPersonal =
      await services.shadowEvaluations.list();
    const personalRerankerShadow =
      rerankerShadowAfterPersonal.find(
        (evaluation) => !shadowIdsBeforePersonal.has(evaluation.id)
      );
    const orchestration = await services.orchestrator.execute({
      requestId: "22222222-2222-4222-8222-222222222222",
      userId: "11111111-1111-4111-8111-111111111111",
      message: "Welke opleiding past bij mij?"
    });
    const plannerShadow =
      await services.plannerShadowRepository.findByRunId(
        orchestration.id
      );

    expect(general.chatbotKey).toBe("general-coach");
    expect(personal.chatbotKey).toBe("personal-journey-coach");
    expect(personal.message).not.toMatch(/\bphase-[459]\b/i);
    expect(personal.message).not.toMatch(
      /\b(?:stap|fase|proces)\s*['"“”‘’]?(?:Interesseren|Oriënteren)/i
    );
    expect(personal.message).toContain("Om je gerichter te helpen:");
    expect(personal.message).toContain("tweejarig versneld traject");
    expect(
      personal.artifacts.find(
        (artifact) => artifact.type === "phase-proposal"
      )?.label
    ).toBe("Voorstel voor je volgende stap");
    expect(
      personal.sources.some(
        (source) =>
          source.sourceUrl?.includes("onderwijsloket.com") &&
          source.externalId.length > 0
      )
    ).toBe(true);
    expect(personalRerankerShadow?.status).toBe("completed");
    expect(
      personalRerankerShadow?.candidateIds.length
    ).toBeGreaterThan(0);
    expect(plannerShadow?.status).toBe("completed");
    expect(plannerShadow?.deterministicPlan).toEqual(
      orchestration.plan
    );
    expect(services.datasetsDirectory).toContain("datasets");
  });
});
