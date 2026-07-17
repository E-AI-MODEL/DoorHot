import type {
  RouteAnswerDefinition,
  RouteDefinition,
  RouteQuestionDefinition,
  RouteStepDefinition
} from "./datasets.js";

export interface RouteEngineInput {
  selectedAnswerIds: readonly string[];
}

export interface EligibleRouteAnswer {
  id: string;
  title: string;
  description?: string;
  selected: boolean;
}

export interface EligibleRouteQuestion {
  id: string;
  question: string;
  description?: string;
  sort: number;
  answers: readonly EligibleRouteAnswer[];
}

export interface RoutePathSelection {
  answerId: string;
  questionId: string;
  title: string;
  description?: string;
}

export interface MatchedRouteStep {
  id: string;
  sort: number;
  shortTitle: string;
  longTitle: string;
  slug: string;
  durationInMonths?: number | null;
  body?: unknown;
  faqs: readonly unknown[];
  articles: readonly unknown[];
}

export interface MatchedRoute {
  id: string;
  title: string;
  slug: string;
  requiredAnswerIds: readonly string[];
  extraSelectedAnswerIds: readonly string[];
  specificity: number;
  steps: readonly MatchedRouteStep[];
}

export interface RouteEngineResult {
  selections: readonly RoutePathSelection[];
  nextQuestion?: EligibleRouteQuestion;
  completed: boolean;
  matchedRoutes: readonly MatchedRoute[];
  bestRoute?: MatchedRoute;
}

function dependencyIds(answer: RouteAnswerDefinition): readonly string[] {
  return answer.requires_answers.map(
    (dependency) => dependency.related_route_answers_id.id
  );
}

function isEligible(
  answer: RouteAnswerDefinition,
  selected: ReadonlySet<string>
): boolean {
  const dependencies = dependencyIds(answer);
  return (
    dependencies.length === 0 ||
    dependencies.some((answerId) => selected.has(answerId))
  );
}

function resolveRouteId(route: RouteDefinition): string {
  const relationRouteId =
    route.requires_answers[0]?.routes_id ??
    route.route_steps[0]?.routes_id;

  return route.id ?? relationRouteId ?? route.slug;
}

export class RouteEngine {
  private readonly stepsById: ReadonlyMap<string, RouteStepDefinition>;

  constructor(
    private readonly questions: readonly RouteQuestionDefinition[],
    private readonly routes: readonly RouteDefinition[],
    private readonly steps: readonly RouteStepDefinition[],
    private readonly engineVersion = "route-engine-v2"
  ) {
    this.stepsById = new Map(steps.map((step) => [step.id, step]));
  }

  evaluate(input: RouteEngineInput): RouteEngineResult {
    const selected = new Set(input.selectedAnswerIds);
    const orderedQuestions = [...this.questions]
      .filter((question) => question.status === "published")
      .sort((left, right) => left.sort - right.sort);

    const selections: RoutePathSelection[] = [];

    for (const question of orderedQuestions) {
      const selectedAnswer = question.answers.find((answer) =>
        selected.has(answer.id)
      );

      if (selectedAnswer) {
        selections.push({
          answerId: selectedAnswer.id,
          questionId: question.id,
          title: selectedAnswer.title,
          description: selectedAnswer.description
        });
      }
    }

    const unanswered = orderedQuestions.find((question) => {
      const hasSelection = question.answers.some((answer) =>
        selected.has(answer.id)
      );
      if (hasSelection) {
        return false;
      }

      return question.answers.some((answer) =>
        isEligible(answer, selected)
      );
    });

    const nextQuestion = unanswered
      ? {
          id: unanswered.id,
          question: unanswered.question,
          description: unanswered.description,
          sort: unanswered.sort,
          answers: unanswered.answers
            .filter(
              (answer) =>
                answer.status === "published" &&
                isEligible(answer, selected)
            )
            .sort((left, right) => left.sort - right.sort)
            .map((answer) => ({
              id: answer.id,
              title: answer.title,
              description: answer.description,
              selected: selected.has(answer.id)
            }))
        }
      : undefined;

    const matchedRoutes = this.routes
      .filter((route) => route.status === "published")
      .filter((route) => {
        const requiredAnswerIds = route.requires_answers
          .map((relation) => relation.route_answers_id)
          .filter((answerId): answerId is string => answerId !== null);

        return (
          requiredAnswerIds.length > 0 &&
          requiredAnswerIds.every((answerId) => selected.has(answerId))
        );
      })
      .map((route): MatchedRoute => {
        const requiredAnswerIds = route.requires_answers
          .map((relation) => relation.route_answers_id)
          .filter((answerId): answerId is string => answerId !== null);
        const extraSelectedAnswerIds = input.selectedAnswerIds.filter(
          (answerId) => !requiredAnswerIds.includes(answerId)
        );

        const steps = [...route.route_steps]
          .sort((left, right) => left.sort - right.sort)
          .map((relation): MatchedRouteStep | null => {
            const step = this.stepsById.get(relation.route_steps_id);
            if (!step) {
              return null;
            }

            return {
              id: step.id,
              sort: relation.sort,
              shortTitle: step.short_title,
              longTitle: step.long_title,
              slug: step.slug,
              durationInMonths: step.duration_in_months,
              body: step.body,
              faqs: step.faqs,
              articles: step.articles
            };
          })
          .filter((step): step is MatchedRouteStep => step !== null);

        return {
          id: resolveRouteId(route),
          title: route.title,
          slug: route.slug,
          requiredAnswerIds,
          extraSelectedAnswerIds,
          specificity: requiredAnswerIds.length,
          steps
        };
      })
      .sort((left, right) => {
        if (right.specificity !== left.specificity) {
          return right.specificity - left.specificity;
        }

        if (
          left.extraSelectedAnswerIds.length !==
          right.extraSelectedAnswerIds.length
        ) {
          return (
            left.extraSelectedAnswerIds.length -
            right.extraSelectedAnswerIds.length
          );
        }

        return left.title.localeCompare(right.title, "nl");
      });

    return {
      selections,
      nextQuestion,
      completed: nextQuestion === undefined,
      matchedRoutes,
      bestRoute: matchedRoutes[0]
    };
  }

  get version(): string {
    return this.engineVersion;
  }
}
