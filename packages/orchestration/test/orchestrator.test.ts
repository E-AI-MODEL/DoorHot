import { describe, expect, it } from "vitest";
import {
  AiOrchestrator,
  DeterministicAnswerComposer,
  DeterministicIntentPlanner,
  InMemoryOrchestrationRepository,
  ToolRegistry,
  type OrchestrationTool
} from "../src/index.js";

describe("AI orchestrator", () => {
  it("plans a journey progress request deterministically", () => {
    const planner = new DeterministicIntentPlanner();
    const plan = planner.plan({
      requestId: "request-1",
      message: "Waar sta ik in mijn traject?",
      userId: "11111111-1111-4111-8111-111111111111"
    });

    expect(plan.intent).toBe("progress_request");
    expect(plan.steps[0]?.toolKey).toBe("journey.dashboard");
    expect(plan.answerStrategy).toBe("journey_guidance");
  });

  it("executes allowlisted tools and records trace events", async () => {
    const repository = new InMemoryOrchestrationRepository();
    const tools = new ToolRegistry();
    const journeyTool: OrchestrationTool = {
      key: "journey.dashboard",
      capability: "journey",
      timeoutMs: 1_000,
      async execute() {
        return {
          aggregate: {
            journey: {
              progress: 0.65,
              phaseKey: "matching"
            },
            blockers: []
          },
          nextAction: {
            id: "action-1",
            title: "Plan een adviesgesprek"
          }
        };
      }
    };
    tools.register(journeyTool);
    tools.register({
      key: "knowledge.search",
      capability: "knowledge",
      timeoutMs: 1_000,
      async execute() {
        return [];
      }
    });

    const orchestrator = new AiOrchestrator(
      new DeterministicIntentPlanner(),
      tools,
      new DeterministicAnswerComposer(),
      repository
    );

    const run = await orchestrator.execute({
      requestId: "request-2",
      message: "Hoe ver ben ik?",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(run.status).toBe("completed");
    expect(run.answer).toContain("65%");
    expect(run.events).toHaveLength(1);
    expect(run.events?.[0]?.status).toBe("completed");
  });

  it("keeps optional tool failures as partial results", async () => {
    const repository = new InMemoryOrchestrationRepository();
    const tools = new ToolRegistry();
    tools.register({
      key: "knowledge.search",
      capability: "knowledge",
      timeoutMs: 1_000,
      async execute() {
        throw new Error("provider_unavailable");
      }
    });

    const orchestrator = new AiOrchestrator(
      new DeterministicIntentPlanner(),
      tools,
      new DeterministicAnswerComposer(),
      repository
    );

    const run = await orchestrator.execute({
      requestId: "request-3",
      message: "Wat kost een lerarenopleiding?"
    });

    expect(run.status).toBe("failed");
    expect(run.events?.[0]?.errorCode).toBe("provider_unavailable");
    expect(run.answer).toContain("onvoldoende context");
  });

  it("does not register duplicate tools", () => {
    const registry = new ToolRegistry();
    const tool: OrchestrationTool = {
      key: "knowledge.search",
      capability: "knowledge",
      timeoutMs: 1_000,
      async execute() {
        return [];
      }
    };

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow(
      "tool_already_registered:knowledge.search"
    );
  });
});
