import { describe, expect, it } from "vitest";
import {
  InMemoryJourneyRepository,
  JourneyEngine,
  calculateJourneyProgress,
  selectNextBestAction
} from "../src/index.js";

describe("Journey Engine 2.0", () => {
  it("calculates progress from milestones and blockers", async () => {
    const engine = new JourneyEngine(
      new InMemoryJourneyRepository()
    );
    const userId = "11111111-1111-4111-8111-111111111111";

    await engine.ensureJourney({
      userId,
      phaseKey: "orientatie"
    });
    const goal = await engine.addGoal({
      userId,
      title: "Leraar worden",
      priority: 100
    });
    const milestone = await engine.addMilestone({
      userId,
      goalId: goal.id,
      title: "Onderwijssector kiezen",
      weight: 2
    });
    await engine.updateMilestoneStatus(
      userId,
      milestone.id,
      "completed"
    );
    await engine.upsertBlocker({
      userId,
      blockerKey: "financiering",
      title: "Financiering ontbreekt",
      severity: "high",
      confidence: 1
    });

    const dashboard = await engine.dashboard(userId);

    expect(dashboard.aggregate.journey.progress).toBeGreaterThan(0);
    expect(dashboard.aggregate.journey.progress).toBeLessThan(1);
  });

  it("prioritizes actions linked to severe blockers", async () => {
    const engine = new JourneyEngine(
      new InMemoryJourneyRepository()
    );
    const userId = "22222222-2222-4222-8222-222222222222";

    await engine.ensureJourney({
      userId,
      phaseKey: "beslissing"
    });
    const blocker = await engine.upsertBlocker({
      userId,
      blockerKey: "toelating",
      title: "Toelating nog onbekend",
      severity: "critical",
      confidence: 0.9
    });
    await engine.addAction({
      userId,
      actionKey: "bekijk-open-dag",
      title: "Bekijk een open dag",
      priority: 90
    });
    const blockerAction = await engine.addAction({
      userId,
      actionKey: "controleer-toelating",
      title: "Controleer toelatingseisen",
      blockerId: blocker.id,
      priority: 60
    });

    const dashboard = await engine.dashboard(userId);

    expect(dashboard.nextAction?.id).toBe(blockerAction.id);
  });

  it("records phase and route decisions with evidence", async () => {
    const engine = new JourneyEngine(
      new InMemoryJourneyRepository()
    );
    const userId = "33333333-3333-4333-8333-333333333333";

    const aggregate = await engine.synchronizeContext({
      userId,
      phaseKey: "matching",
      routeKey: "zij-instroom",
      phaseConfidence: 0.88,
      routeReason: "Alle vereiste routeantwoorden zijn bekend."
    });

    expect(aggregate.journey.phaseKey).toBe("matching");
    expect(aggregate.journey.routeKey).toBe("zij-instroom");
    expect(aggregate.evidence).toHaveLength(1);
    expect(aggregate.decisions[0]?.ruleVersion).toBe(
      "journey-engine-2.1.0"
    );
  });

  it("exposes deterministic helper functions", () => {
    expect(
      calculateJourneyProgress({
        goals: [],
        milestones: [],
        blockers: [],
        actions: [],
        evidence: [],
        decisions: []
      })
    ).toBe(0);

    expect(
      selectNextBestAction({
        journey: {
          id: "j",
          userId: "u",
          phaseKey: "interesse",
          status: "active",
          progress: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        },
        goals: [],
        milestones: [],
        blockers: [],
        actions: [],
        evidence: [],
        decisions: []
      })
    ).toBeUndefined();
  });
});
