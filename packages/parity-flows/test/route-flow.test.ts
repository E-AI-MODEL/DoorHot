import { describe, expect, it } from "vitest";
import {
  InMemoryRouteSessionRepository,
  RouteFlowService
} from "../src/index.js";

describe("RouteFlowService", () => {
  it("accepts only answers offered by the next question", async () => {
    const engine = {
      evaluate(input: { selectedAnswerIds: readonly string[] }) {
        return input.selectedAnswerIds.length === 0
          ? {
              selections: [],
              completed: false,
              matchedRoutes: [],
              nextQuestion: {
                id: "q1",
                question: "Kies",
                sort: 1,
                answers: [
                  {
                    id: "a1",
                    title: "A",
                    selected: false
                  }
                ]
              }
            }
          : {
              selections: [],
              completed: true,
              matchedRoutes: [],
              bestRoute: undefined
            };
      }
    };

    const service = new RouteFlowService(
      engine as never,
      new InMemoryRouteSessionRepository()
    );
    const session = await service.start();

    await expect(
      service.answer(session.id, "invalid")
    ).rejects.toThrow("route_answer_not_allowed");

    const completed = await service.answer(session.id, "a1");
    expect(completed.status).toBe("completed");
  });
});
