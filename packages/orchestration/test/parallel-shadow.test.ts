import { describe, expect, it } from "vitest";
import {
  AiOrchestrator,
  DeterministicAnswerComposer,
  DeterministicIntentPlanner,
  HeuristicShadowPlanner,
  InMemoryOrchestrationRepository,
  InMemoryPlannerShadowRepository,
  ShadowPlanningService,
  ToolRegistry,
  type OrchestrationTool
} from "../src/index.js";

function delayedTool(
  key: string,
  delayMs: number
): OrchestrationTool {
  return {
    key,
    capability:
      key.startsWith("journey")
        ? "journey"
        : "knowledge",
    timeoutMs: 1_000,
    async execute() {
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs)
      );
      return key === "journey.dashboard"
        ? {
            aggregate: {
              journey: {
                progress: 0.5,
                phaseKey: "orientatie"
              },
              blockers: []
            }
          }
        : [];
    }
  };
}

describe("parallel orchestration and planner shadow", () => {
  it("executes independent tools in the same parallel group", async () => {
    const runs = new InMemoryOrchestrationRepository();
    const tools = new ToolRegistry();
    tools.register(delayedTool("journey.dashboard", 80));
    tools.register(delayedTool("knowledge.search", 80));
    tools.register({
      key: "journey.next-action",
      capability: "planning",
      timeoutMs: 1_000,
      async execute() {
        return null;
      }
    });

    const orchestrator = new AiOrchestrator(
      new DeterministicIntentPlanner(),
      tools,
      new DeterministicAnswerComposer(),
      runs
    );

    const startedAt = Date.now();
    const run = await orchestrator.execute({
      requestId: "parallel-test",
      userId: "11111111-1111-4111-8111-111111111111",
      message: "Wat is mijn volgende stap en welke opleiding past?"
    });
    const elapsed = Date.now() - startedAt;

    const firstGroup = run.events
      ?.filter((event) => event.executionGroup === 1)
      .map((event) => event.toolKey);

    expect(firstGroup).toContain("journey.dashboard");
    expect(firstGroup).toContain("knowledge.search");
    expect(elapsed).toBeLessThan(150);
  });

  it("stores shadow planner comparison without changing the plan", async () => {
    const runs = new InMemoryOrchestrationRepository();
    const shadows = new InMemoryPlannerShadowRepository();
    const tools = new ToolRegistry();
    tools.register(delayedTool("knowledge.search", 1));

    const orchestrator = new AiOrchestrator(
      new DeterministicIntentPlanner(),
      tools,
      new DeterministicAnswerComposer(),
      runs,
      new ShadowPlanningService(
        new HeuristicShadowPlanner(),
        shadows
      )
    );

    const run = await orchestrator.execute({
      requestId: "shadow-test",
      message: "Wat kost een opleiding?"
    });
    const evaluation = await shadows.findByRunId(run.id);

    expect(run.plan.steps[0]?.toolKey).toBe("knowledge.search");
    expect(evaluation?.status).toBe("completed");
    expect(evaluation?.agreementScore).toBe(1);
  });
});
