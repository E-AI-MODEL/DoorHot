import { describe, expect, it } from "vitest";
import { RouteEngine } from "../src/index.js";

const schoolAnswerId = "school-po";
const teacherAnswerId = "role-teacher";
const routeId = "route-po-teacher";
const stepId = "step-pabo";

const questions = [
  {
    id: "school",
    question: "Op wat voor school?",
    status: "published",
    sort: 1,
    answers: [
      {
        id: schoolAnswerId,
        status: "published",
        title: "Basisschool",
        question: "school",
        sort: 1,
        requires_answers: []
      }
    ]
  },
  {
    id: "role",
    question: "Welke functie?",
    status: "published",
    sort: 2,
    answers: [
      {
        id: teacherAnswerId,
        status: "published",
        title: "Leraar",
        question: "role",
        sort: 1,
        requires_answers: [
          {
            related_route_answers_id: {
              id: schoolAnswerId
            }
          }
        ]
      }
    ]
  }
];

const routes = [
  {
    id: routeId,
    title: "Route tot leerkracht primair onderwijs",
    slug: "po-teacher",
    status: "published",
    date_created: "2026-01-01T00:00:00.000Z",
    requires_answers: [
      {
        id: 1,
        routes_id: routeId,
        route_answers_id: schoolAnswerId
      },
      {
        id: 2,
        routes_id: routeId,
        route_answers_id: teacherAnswerId
      }
    ],
    route_steps: [
      {
        id: 10,
        routes_id: routeId,
        route_steps_id: stepId,
        sort: 0
      }
    ]
  }
];

const steps = [
  {
    id: stepId,
    unique_name: "Pabo",
    short_title: "Pabo",
    long_title: "Volg de pabo",
    slug: "pabo",
    status: "published",
    duration_in_months: 48,
    faqs: [],
    articles: []
  }
];

describe("RouteEngine", () => {
  it("navigates the conditional question tree", () => {
    const engine = new RouteEngine(questions, routes, steps);

    const initial = engine.evaluate({ selectedAnswerIds: [] });
    expect(initial.nextQuestion?.id).toBe("school");

    const afterSchool = engine.evaluate({
      selectedAnswerIds: [schoolAnswerId]
    });
    expect(afterSchool.nextQuestion?.id).toBe("role");
  });

  it("matches routes only when all required answers are selected", () => {
    const engine = new RouteEngine(questions, routes, steps);

    const partial = engine.evaluate({
      selectedAnswerIds: [schoolAnswerId]
    });
    expect(partial.matchedRoutes).toHaveLength(0);

    const complete = engine.evaluate({
      selectedAnswerIds: [schoolAnswerId, teacherAnswerId]
    });
    expect(complete.matchedRoutes).toHaveLength(1);
    expect(complete.bestRoute?.id).toBe(routeId);
  });

  it("returns route steps in configured order with enriched content", () => {
    const engine = new RouteEngine(questions, routes, steps);

    const result = engine.evaluate({
      selectedAnswerIds: [schoolAnswerId, teacherAnswerId]
    });

    expect(result.bestRoute?.steps[0]).toMatchObject({
      id: stepId,
      shortTitle: "Pabo",
      durationInMonths: 48
    });
  });

  it("does not match routes with only null requirements", () => {
    const nullRoute = {
      ...routes[0],
      id: "route-null",
      slug: "route-null",
      requires_answers: [
        {
          id: 99,
          routes_id: "route-null",
          route_answers_id: null
        }
      ]
    };

    const engine = new RouteEngine(questions, [nullRoute], steps);
    const result = engine.evaluate({
      selectedAnswerIds: [schoolAnswerId, teacherAnswerId]
    });

    expect(result.matchedRoutes).toHaveLength(0);
  });
});
