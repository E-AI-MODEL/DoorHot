import { describe, expect, it } from "vitest";
import {
  InMemoryJourneyRepository,
  InMemoryMemoryGraphRepository,
  GraphMemoryJourneyChangeListener,
  JourneyEngine,
  JourneyGraphMemoryService,
  buildJourneyMemoryGraph
} from "../src/index.js";

describe("journey graph memory", () => {
  it("builds linked nodes for goals, blockers and actions", async () => {
    const journeys = new InMemoryJourneyRepository();
    const engine = new JourneyEngine(journeys);
    const graphRepository =
      new InMemoryMemoryGraphRepository();
    const graphMemory = new JourneyGraphMemoryService(
      journeys,
      graphRepository
    );
    const userId =
      "11111111-1111-4111-8111-111111111111";

    await engine.ensureJourney({
      userId,
      phaseKey: "orientatie",
      routeKey: "zij-instroom"
    });
    const goal = await engine.addGoal({
      userId,
      title: "Een passende opleiding kiezen"
    });
    const blocker = await engine.upsertBlocker({
      userId,
      blockerKey: "financiering",
      title: "Financiering ontbreekt",
      severity: "high",
      confidence: 0.9
    });
    await engine.addAction({
      userId,
      actionKey: "subsidie-controleren",
      title: "Controleer subsidies",
      goalId: goal.id,
      blockerId: blocker.id
    });

    const graph = await graphMemory.synchronize(userId);

    expect(
      graph.nodes.some((item) => item.nodeType === "route")
    ).toBe(true);
    expect(
      graph.edges.some((item) => item.edgeType === "RESOLVES")
    ).toBe(true);
  });

  it("returns bounded neighbor context", async () => {
    const graph = buildJourneyMemoryGraph({
      journey: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        userId: "22222222-2222-4222-8222-222222222222",
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
    });
    const repository =
      new InMemoryMemoryGraphRepository();
    await repository.replaceUserGraph(
      "22222222-2222-4222-8222-222222222222",
      graph
    );

    const journeyNode = graph.nodes.find(
      (item) => item.nodeType === "journey"
    )!;
    const neighbors = await repository.neighbors(
      journeyNode.userId,
      journeyNode.id,
      1
    );

    expect(neighbors.nodes.length).toBeGreaterThanOrEqual(2);
    expect(neighbors.edges.length).toBeGreaterThanOrEqual(1);
  });

it("updates graph memory automatically after journey changes", async () => {
  const journeys = new InMemoryJourneyRepository();
  const graphRepository =
    new InMemoryMemoryGraphRepository();
  const graphMemory = new JourneyGraphMemoryService(
    journeys,
    graphRepository
  );
  const engine = new JourneyEngine(
    journeys,
    new GraphMemoryJourneyChangeListener(graphMemory)
  );
  const userId =
    "55555555-5555-4555-8555-555555555555";

  await engine.ensureJourney({
    userId,
    phaseKey: "interesse"
  });
  await engine.addGoal({
    userId,
    title: "Kennismaken met het onderwijs"
  });

  const graph = await graphMemory.get(userId);

  expect(
    graph.nodes.some(
      (item) =>
        item.nodeType === "goal" &&
        item.label === "Kennismaken met het onderwijs"
    )
  ).toBe(true);
});

});
