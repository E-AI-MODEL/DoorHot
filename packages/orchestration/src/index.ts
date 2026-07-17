import {
  NotificationQueueTool,
  ReminderScheduleTool,
  type SafeExecutionService
} from "./execution-tools.js";
import type {
  JourneyAction,
  JourneyBlocker,
  JourneyEngine
} from "@door010/domain";
import type {
  KnowledgeSearch,
  KnowledgeSearchResult
} from "@door010/knowledge";

export type OrchestrationIntent =
  | "greeting"
  | "knowledge_question"
  | "journey_guidance"
  | "action_request"
  | "progress_request"
  | "handoff_request"
  | "unknown";

export type OrchestrationCapability =
  | "identity"
  | "knowledge"
  | "journey"
  | "reasoning"
  | "conversation"
  | "planning"
  | "execution"
  | "learning"
  | "observability";

export interface OrchestrationRequest {
  requestId: string;
  message: string;
  userId?: string;
  conversationId?: string;
  phaseKey?: string;
  routeKey?: string;
}

export interface OrchestrationPlanStep {
  sequence: number;
  capability: OrchestrationCapability;
  toolKey: string;
  reason: string;
  required: boolean;
  dependsOn?: readonly string[];
}

export interface OrchestrationPlan {
  intent: OrchestrationIntent;
  confidence: number;
  steps: readonly OrchestrationPlanStep[];
  answerStrategy:
    | "direct"
    | "knowledge_grounded"
    | "journey_guidance"
    | "handoff";
}

export interface OrchestrationToolContext {
  request: OrchestrationRequest;
  plan: OrchestrationPlan;
  previousOutputs: ReadonlyMap<string, unknown>;
}

export interface OrchestrationTool {
  readonly key: string;
  readonly capability: OrchestrationCapability;
  readonly timeoutMs: number;
  execute(context: OrchestrationToolContext): Promise<unknown>;
}

export interface OrchestrationTraceEvent {
  id: string;
  runId: string;
  sequence: number;
  executionGroup?: number;
  eventType: string;
  capability: OrchestrationCapability;
  status: "started" | "completed" | "failed" | "skipped";
  toolKey?: string;
  inputSummary: Readonly<Record<string, unknown>>;
  outputSummary: Readonly<Record<string, unknown>>;
  latencyMs?: number;
  errorCode?: string;
  createdAt: string;
}

export interface OrchestrationRun {
  id: string;
  requestId: string;
  userId?: string;
  conversationId?: string;
  intent: OrchestrationIntent;
  status: "running" | "completed" | "failed" | "partial";
  plan: OrchestrationPlan;
  answer?: string;
  latencyMs?: number;
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
  events?: readonly OrchestrationTraceEvent[];
}

export interface OrchestrationRepository {
  saveRun(run: OrchestrationRun): Promise<void>;
  appendEvent(event: OrchestrationTraceEvent): Promise<void>;
  findById(id: string): Promise<OrchestrationRun | null>;
  list(limit?: number): Promise<readonly OrchestrationRun[]>;
}

export interface OrchestrationSqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: readonly Row[]; rowCount: number }>;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("nl").trim();
}


export interface PlannerSuggestionProvider {
  readonly providerKey: string;
  suggestPlan(
    request: OrchestrationRequest,
    deterministicPlan: OrchestrationPlan,
    availableTools: readonly string[]
  ): Promise<OrchestrationPlan>;
}

export interface PlannerShadowEvaluation {
  id: string;
  runId: string;
  providerKey: string;
  deterministicPlan: OrchestrationPlan;
  shadowPlan?: OrchestrationPlan;
  agreementScore?: number;
  addedTools: readonly string[];
  removedTools: readonly string[];
  latencyMs: number;
  status: "completed" | "failed" | "skipped";
  errorCode?: string;
  createdAt: string;
}

export interface PlannerShadowRepository {
  append(
    evaluation: PlannerShadowEvaluation
  ): Promise<void>;
  list(
    limit?: number
  ): Promise<readonly PlannerShadowEvaluation[]>;
  findByRunId(
    runId: string
  ): Promise<PlannerShadowEvaluation | null>;
}

function planToolKeys(plan: OrchestrationPlan): readonly string[] {
  return plan.steps.map((step) => step.toolKey);
}

function comparePlans(
  deterministicPlan: OrchestrationPlan,
  shadowPlan: OrchestrationPlan
): {
  agreementScore: number;
  addedTools: readonly string[];
  removedTools: readonly string[];
} {
  const deterministic = new Set(planToolKeys(deterministicPlan));
  const shadow = new Set(planToolKeys(shadowPlan));
  const union = new Set([...deterministic, ...shadow]);
  const intersection = [...deterministic].filter((key) =>
    shadow.has(key)
  );

  return {
    agreementScore:
      union.size === 0
        ? 1
        : Number((intersection.length / union.size).toFixed(4)),
    addedTools: [...shadow].filter((key) => !deterministic.has(key)),
    removedTools: [...deterministic].filter((key) => !shadow.has(key))
  };
}


export interface HttpPlannerSuggestionConfig {
  endpoint: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
}

export class HttpPlannerSuggestionProvider
  implements PlannerSuggestionProvider
{
  readonly providerKey: string;

  constructor(
    private readonly config: HttpPlannerSuggestionConfig
  ) {
    this.providerKey = `http-planner:${config.model}`;
  }

  async suggestPlan(
    request: OrchestrationRequest,
    deterministicPlan: OrchestrationPlan,
    availableTools: readonly string[]
  ): Promise<OrchestrationPlan> {
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {})
      },
      body: JSON.stringify({
        model: this.config.model,
        message: request.message,
        userContext: {
          hasUser: Boolean(request.userId),
          phaseKey: request.phaseKey,
          routeKey: request.routeKey
        },
        deterministicPlan,
        availableTools
      }),
      signal: AbortSignal.timeout(
        this.config.timeoutMs ?? 10_000
      )
    });

    if (!response.ok) {
      throw new Error(`planner_http_${response.status}`);
    }

    const payload = await response.json() as {
      plan?: OrchestrationPlan;
    };
    if (!payload.plan || !Array.isArray(payload.plan.steps)) {
      throw new Error("planner_response_invalid");
    }

    const unknownTools = payload.plan.steps
      .map((step) => step.toolKey)
      .filter((toolKey) => !availableTools.includes(toolKey));
    if (unknownTools.length > 0) {
      throw new Error("planner_unknown_tool");
    }

    return payload.plan;
  }
}

export class HeuristicShadowPlanner
  implements PlannerSuggestionProvider
{
  readonly providerKey = "heuristic-shadow-planner-v1";

  async suggestPlan(
    request: OrchestrationRequest,
    deterministicPlan: OrchestrationPlan,
    availableTools: readonly string[]
  ): Promise<OrchestrationPlan> {
    const message = normalize(request.message);
    const steps = [...deterministicPlan.steps];

    if (
      request.userId &&
      /(persoonlijk|mijn situatie|wat past bij mij)/.test(message) &&
      availableTools.includes("journey.dashboard") &&
      !steps.some((step) => step.toolKey === "journey.dashboard")
    ) {
      steps.unshift({
        sequence: 1,
        capability: "journey",
        toolKey: "journey.dashboard",
        reason:
          "Shadow planner ziet expliciete behoefte aan persoonlijke context.",
        required: false
      });
    }

    return {
      ...deterministicPlan,
      steps: steps.map((step, index) => ({
        ...step,
        sequence: index + 1
      }))
    };
  }
}

export class InMemoryPlannerShadowRepository
  implements PlannerShadowRepository
{
  private readonly records: PlannerShadowEvaluation[] = [];

  async append(
    evaluation: PlannerShadowEvaluation
  ): Promise<void> {
    this.records.push(evaluation);
  }

  async list(
    limit = 100
  ): Promise<readonly PlannerShadowEvaluation[]> {
    return [...this.records]
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async findByRunId(
    runId: string
  ): Promise<PlannerShadowEvaluation | null> {
    return this.records.find((item) => item.runId === runId) ?? null;
  }
}

export class ShadowPlanningService {
  constructor(
    private readonly provider: PlannerSuggestionProvider,
    private readonly repository: PlannerShadowRepository,
    private readonly timeoutMs = 5_000
  ) {}

  async evaluate(input: {
    runId: string;
    request: OrchestrationRequest;
    deterministicPlan: OrchestrationPlan;
    availableTools: readonly string[];
  }): Promise<void> {
    const startedAt = Date.now();

    try {
      const shadowPlan = await withTimeout(
        this.provider.suggestPlan(
          input.request,
          input.deterministicPlan,
          input.availableTools
        ),
        this.timeoutMs,
        "planner.shadow"
      );
      const comparison = comparePlans(
        input.deterministicPlan,
        shadowPlan
      );

      await this.repository.append({
        id: crypto.randomUUID(),
        runId: input.runId,
        providerKey: this.provider.providerKey,
        deterministicPlan: input.deterministicPlan,
        shadowPlan,
        ...comparison,
        latencyMs: Date.now() - startedAt,
        status: "completed",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      await this.repository.append({
        id: crypto.randomUUID(),
        runId: input.runId,
        providerKey: this.provider.providerKey,
        deterministicPlan: input.deterministicPlan,
        addedTools: [],
        removedTools: [],
        latencyMs: Date.now() - startedAt,
        status: "failed",
        errorCode:
          error instanceof Error ? error.message : "unknown_error",
        createdAt: new Date().toISOString()
      });
    }
  }
}

export class DeterministicIntentPlanner {
  plan(request: OrchestrationRequest): OrchestrationPlan {
    const message = normalize(request.message);
    const greeting = /^(hoi|hallo|hey|goedemorgen|goedemiddag)[!. ]*$/.test(
      message
    );
    const handoff = /(adviseur|mens|persoon spreken|contact opnemen)/.test(
      message
    );
    const progress = /(voortgang|hoe ver|waar sta ik|percentage)/.test(
      message
    );
    const action = /(wat moet ik doen|volgende stap|actie|taak|nu doen)/.test(
      message
    );
    const journey = /(route|fase|traject|blocker|blokkade|doel)/.test(
      message
    );
    const reminder = /(herinner mij|herinnering|reminder)/.test(message);
    const notification = /(stuur.*melding|notificatie|melding sturen)/.test(
      message
    );

    if (greeting) {
      return {
        intent: "greeting",
        confidence: 0.98,
        steps: [],
        answerStrategy: "direct"
      };
    }

    if (handoff) {
      return {
        intent: "handoff_request",
        confidence: 0.9,
        steps: [],
        answerStrategy: "handoff"
      };
    }

    const steps: OrchestrationPlanStep[] = [];
    if (request.userId && (progress || action || journey)) {
      steps.push({
        sequence: steps.length + 1,
        capability: "journey",
        toolKey: "journey.dashboard",
        reason:
          progress
            ? "Voortgang vereist actuele journey-state."
            : "Persoonlijke begeleiding vereist journey-context.",
        required: true
      });
    }

    if (!progress || /(opleiding|subsidie|vacature|bevoegd|salaris)/.test(message)) {
      steps.push({
        sequence: steps.length + 1,
        capability: "knowledge",
        toolKey: "knowledge.search",
        reason: "De vraag kan met gecontroleerde kennis worden onderbouwd.",
        required: false
      });
    }

    if (action && request.userId) {
      steps.push({
        sequence: steps.length + 1,
        capability: "planning",
        toolKey: "journey.next-action",
        reason: "De gebruiker vraagt om de volgende beste actie.",
        required: true,
        dependsOn: ["journey.dashboard"]
      });
    }

    if (reminder && request.userId) {
      steps.push({
        sequence: steps.length + 1,
        capability: "execution",
        toolKey: "reminder.schedule",
        reason:
          "Een reminder is een write-actie en vereist expliciete bevestiging.",
        required: false
      });
    }

    if (notification && request.userId) {
      steps.push({
        sequence: steps.length + 1,
        capability: "execution",
        toolKey: "notification.queue",
        reason:
          "Een notificatie wordt alleen als bevestigingsverzoek klaargezet.",
        required: false
      });
    }

    return {
      intent: progress
        ? "progress_request"
        : action
          ? "action_request"
          : journey
            ? "journey_guidance"
            : "knowledge_question",
      confidence: 0.84,
      steps,
      answerStrategy:
        progress || action || journey
          ? "journey_guidance"
          : "knowledge_grounded"
    };
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  key: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`tool_timeout:${key}`)),
      timeoutMs
    );
    timeout.unref();

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export class ToolRegistry {
  private readonly tools = new Map<string, OrchestrationTool>();

  register(tool: OrchestrationTool): void {
    if (this.tools.has(tool.key)) {
      throw new Error(`tool_already_registered:${tool.key}`);
    }
    this.tools.set(tool.key, tool);
  }

  get(key: string): OrchestrationTool | undefined {
    return this.tools.get(key);
  }

  list(): readonly string[] {
    return [...this.tools.keys()].sort();
  }
}

export class KnowledgeSearchTool implements OrchestrationTool {
  readonly key = "knowledge.search";
  readonly capability = "knowledge" as const;
  readonly timeoutMs = 8_000;

  constructor(private readonly search: KnowledgeSearch) {}

  async execute(
    context: OrchestrationToolContext
  ): Promise<readonly KnowledgeSearchResult[]> {
    return this.search.search(context.request.message, { limit: 5 });
  }
}

export class JourneyDashboardTool implements OrchestrationTool {
  readonly key = "journey.dashboard";
  readonly capability = "journey" as const;
  readonly timeoutMs = 5_000;

  constructor(private readonly journeys: JourneyEngine) {}

  async execute(context: OrchestrationToolContext): Promise<unknown> {
    const userId = context.request.userId;
    if (!userId) throw new Error("journey_user_required");

    try {
      return await this.journeys.dashboard(userId);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "journey_not_found" &&
        context.request.phaseKey
      ) {
        await this.journeys.ensureJourney({
          userId,
          phaseKey: context.request.phaseKey,
          routeKey: context.request.routeKey
        });
        return this.journeys.dashboard(userId);
      }
      throw error;
    }
  }
}

export class JourneyNextActionTool implements OrchestrationTool {
  readonly key = "journey.next-action";
  readonly capability = "planning" as const;
  readonly timeoutMs = 5_000;

  async execute(context: OrchestrationToolContext): Promise<JourneyAction | null> {
    const dashboard = context.previousOutputs.get("journey.dashboard") as
      | { nextAction?: JourneyAction }
      | undefined;
    return dashboard?.nextAction ?? null;
  }
}

export class InMemoryOrchestrationRepository
  implements OrchestrationRepository
{
  private readonly runs = new Map<string, OrchestrationRun>();
  private readonly events = new Map<string, OrchestrationTraceEvent[]>();

  async saveRun(run: OrchestrationRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async appendEvent(event: OrchestrationTraceEvent): Promise<void> {
    const current = this.events.get(event.runId) ?? [];
    this.events.set(event.runId, [...current, event]);
  }

  async findById(id: string): Promise<OrchestrationRun | null> {
    const run = this.runs.get(id);
    if (!run) return null;
    return {
      ...run,
      events: this.events.get(id) ?? []
    };
  }

  async list(limit = 100): Promise<readonly OrchestrationRun[]> {
    return [...this.runs.values()]
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }
}

function summarizeOutput(
  value: unknown
): Readonly<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return { kind: "array", count: value.length };
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return {
      kind: "object",
      keys: Object.keys(object).slice(0, 12)
    };
  }
  return {
    kind: typeof value,
    value:
      typeof value === "string"
        ? value.slice(0, 200)
        : value
  };
}

function knowledgeTitles(
  value: unknown
): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const record = (item as { record?: { title?: string } }).record;
      return record?.title;
    })
    .filter((title): title is string => Boolean(title));
}

export class DeterministicAnswerComposer {
  compose(input: {
    request: OrchestrationRequest;
    plan: OrchestrationPlan;
    outputs: ReadonlyMap<string, unknown>;
  }): string {
    if (input.plan.intent === "greeting") {
      return "Hallo! Waarmee kan ik je helpen bij jouw stap naar het onderwijs?";
    }
    if (input.plan.intent === "handoff_request") {
      return "Ik kan je doorzetten naar een menselijke adviseur. Open daarvoor de adviseurschat.";
    }

    const dashboard = input.outputs.get("journey.dashboard") as
      | {
          aggregate?: {
            journey?: { progress?: number; phaseKey?: string };
            blockers?: readonly JourneyBlocker[];
          };
          nextAction?: JourneyAction;
        }
      | undefined;
    const nextAction =
      input.outputs.get("journey.next-action") as JourneyAction | null | undefined;
    const titles = knowledgeTitles(
      input.outputs.get("knowledge.search")
    );

    const parts: string[] = [];
    if (input.plan.intent === "progress_request" && dashboard?.aggregate?.journey) {
      parts.push(
        `Je voortgang is ${Math.round(
          (dashboard.aggregate.journey.progress ?? 0) * 100
        )}% en je huidige fase is ${
          dashboard.aggregate.journey.phaseKey ?? "onbekend"
        }.`
      );
    }

    const action = nextAction ?? dashboard?.nextAction;
    if (action) {
      parts.push(`Je beste volgende actie is: ${action.title}.`);
    }

    const openBlockers =
      dashboard?.aggregate?.blockers?.filter((item) =>
        ["open", "mitigating"].includes(item.status)
      ) ?? [];
    if (openBlockers.length > 0) {
      parts.push(
        `Belangrijkste blokkade: ${openBlockers[0]!.title}.`
      );
    }

    if (titles.length > 0) {
      parts.push(
        `Relevante kennis: ${titles.slice(0, 3).join("; ")}.`
      );
    }

    return parts.length > 0
      ? parts.join(" ")
      : "Ik heb onvoldoende context om dit betrouwbaar te beantwoorden. Kun je je vraag iets specifieker maken?";
  }
}

export class AiOrchestrator {
  constructor(
    private readonly planner: DeterministicIntentPlanner,
    private readonly tools: ToolRegistry,
    private readonly composer: DeterministicAnswerComposer,
    private readonly repository: OrchestrationRepository,
    private readonly shadowPlanning?: ShadowPlanningService
  ) {}

  async execute(
    request: OrchestrationRequest
  ): Promise<OrchestrationRun> {
    const startedAt = Date.now();
    const createdAt = new Date().toISOString();
    const plan = this.planner.plan(request);
    const run: OrchestrationRun = {
      id: crypto.randomUUID(),
      requestId: request.requestId,
      userId: request.userId,
      conversationId: request.conversationId,
      intent: plan.intent,
      status: "running",
      plan,
      createdAt
    };
    await this.repository.saveRun(run);

    const shadowPromise = this.shadowPlanning?.evaluate({
      runId: run.id,
      request,
      deterministicPlan: plan,
      availableTools: this.tools.list()
    });

    const outputs = new Map<string, unknown>();
    const completedTools = new Set<string>();
    const failedRequiredTools = new Set<string>();
    const pending = new Map(
      plan.steps.map((step) => [step.toolKey, step])
    );
    let failures = 0;
    let executionGroup = 0;

    while (pending.size > 0) {
      const ready = [...pending.values()].filter((step) =>
        (step.dependsOn ?? []).every((dependency) =>
          completedTools.has(dependency)
        )
      );

      if (ready.length === 0) {
        for (const step of pending.values()) {
          failures += 1;
          await this.repository.appendEvent({
            id: crypto.randomUUID(),
            runId: run.id,
            sequence: step.sequence,
            executionGroup: executionGroup + 1,
            eventType: "tool_execution",
            capability: step.capability,
            status: "skipped",
            toolKey: step.toolKey,
            inputSummary: {},
            outputSummary: {},
            errorCode: "dependency_unresolved",
            createdAt: new Date().toISOString()
          });
        }
        break;
      }

      executionGroup += 1;
      const results = await Promise.all(
        ready.map((step) =>
          this.executeStep({
            run,
            request,
            plan,
            step,
            outputs,
            executionGroup
          })
        )
      );

      for (const result of results) {
        pending.delete(result.step.toolKey);

        if (result.status === "completed") {
          outputs.set(result.step.toolKey, result.output);
          completedTools.add(result.step.toolKey);
        } else {
          failures += 1;
          if (result.step.required) {
            failedRequiredTools.add(result.step.toolKey);
          }
        }
      }

      if (failedRequiredTools.size > 0) {
        for (const step of pending.values()) {
          await this.repository.appendEvent({
            id: crypto.randomUUID(),
            runId: run.id,
            sequence: step.sequence,
            executionGroup: executionGroup + 1,
            eventType: "tool_execution",
            capability: step.capability,
            status: "skipped",
            toolKey: step.toolKey,
            inputSummary: {},
            outputSummary: {},
            errorCode: "required_dependency_failed",
            createdAt: new Date().toISOString()
          });
        }
        failures += pending.size;
        break;
      }
    }

    const answer = this.composer.compose({
      request,
      plan,
      outputs
    });
    const completed: OrchestrationRun = {
      ...run,
      status:
        failures === 0
          ? "completed"
          : failures < plan.steps.length
            ? "partial"
            : "failed",
      answer,
      latencyMs: Date.now() - startedAt,
      completedAt: new Date().toISOString()
    };
    await this.repository.saveRun(completed);
    await shadowPromise;

    return (await this.repository.findById(completed.id)) ?? completed;
  }

  private async executeStep(input: {
    run: OrchestrationRun;
    request: OrchestrationRequest;
    plan: OrchestrationPlan;
    step: OrchestrationPlanStep;
    outputs: ReadonlyMap<string, unknown>;
    executionGroup: number;
  }): Promise<{
    step: OrchestrationPlanStep;
    status: "completed" | "failed" | "skipped";
    output?: unknown;
  }> {
    const tool = this.tools.get(input.step.toolKey);
    if (!tool) {
      await this.repository.appendEvent({
        id: crypto.randomUUID(),
        runId: input.run.id,
        sequence: input.step.sequence,
        executionGroup: input.executionGroup,
        eventType: "tool_execution",
        capability: input.step.capability,
        status: input.step.required ? "failed" : "skipped",
        toolKey: input.step.toolKey,
        inputSummary: {},
        outputSummary: {},
        errorCode: "tool_not_registered",
        createdAt: new Date().toISOString()
      });
      return {
        step: input.step,
        status: input.step.required ? "failed" : "skipped"
      };
    }

    const startedAt = Date.now();
    try {
      const output = await withTimeout(
        tool.execute({
          request: input.request,
          plan: input.plan,
          previousOutputs: input.outputs
        }),
        tool.timeoutMs,
        tool.key
      );

      await this.repository.appendEvent({
        id: crypto.randomUUID(),
        runId: input.run.id,
        sequence: input.step.sequence,
        executionGroup: input.executionGroup,
        eventType: "tool_execution",
        capability: tool.capability,
        status: "completed",
        toolKey: tool.key,
        inputSummary: {
          messageLength: input.request.message.length,
          hasUser: Boolean(input.request.userId),
          dependencies: input.step.dependsOn ?? []
        },
        outputSummary: summarizeOutput(output),
        latencyMs: Date.now() - startedAt,
        createdAt: new Date().toISOString()
      });

      return {
        step: input.step,
        status: "completed",
        output
      };
    } catch (error) {
      await this.repository.appendEvent({
        id: crypto.randomUUID(),
        runId: input.run.id,
        sequence: input.step.sequence,
        executionGroup: input.executionGroup,
        eventType: "tool_execution",
        capability: tool.capability,
        status: "failed",
        toolKey: tool.key,
        inputSummary: {
          dependencies: input.step.dependsOn ?? []
        },
        outputSummary: {},
        latencyMs: Date.now() - startedAt,
        errorCode:
          error instanceof Error ? error.message : "unknown_error",
        createdAt: new Date().toISOString()
      });

      return {
        step: input.step,
        status: "failed"
      };
    }
  }
}
interface RunRow {
  id: string;
  request_id: string;
  user_id: string | null;
  conversation_id: string | null;
  intent: OrchestrationIntent;
  status: OrchestrationRun["status"];
  plan: unknown;
  answer: string | null;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
}

interface EventRow {
  id: string;
  run_id: string;
  sequence: number;
  execution_group: number;
  event_type: string;
  capability: OrchestrationCapability;
  status: OrchestrationTraceEvent["status"];
  tool_key: string | null;
  input_summary: unknown;
  output_summary: unknown;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string | Date;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function objectValue(
  value: unknown
): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

export class PostgresOrchestrationRepository
  implements OrchestrationRepository
{
  constructor(private readonly executor: OrchestrationSqlExecutor) {}

  async saveRun(run: OrchestrationRun): Promise<void> {
    await this.executor.query(
      `INSERT INTO orchestration_runs (
         id, request_id, user_id, conversation_id, intent,
         status, plan, answer, latency_ms, error_code,
         created_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         answer = EXCLUDED.answer,
         latency_ms = EXCLUDED.latency_ms,
         error_code = EXCLUDED.error_code,
         completed_at = EXCLUDED.completed_at`,
      [
        run.id,
        run.requestId,
        run.userId ?? null,
        run.conversationId ?? null,
        run.intent,
        run.status,
        JSON.stringify(run.plan),
        run.answer ?? null,
        run.latencyMs ?? null,
        run.errorCode ?? null,
        run.createdAt,
        run.completedAt ?? null
      ]
    );
  }

  async appendEvent(event: OrchestrationTraceEvent): Promise<void> {
    await this.executor.query(
      `INSERT INTO orchestration_events (
         id, run_id, sequence, execution_group, event_type,
         capability, status, tool_key, input_summary,
         output_summary, latency_ms, error_code, created_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13
       )`,
      [
        event.id,
        event.runId,
        event.sequence,
        event.executionGroup ?? 1,
        event.eventType,
        event.capability,
        event.status,
        event.toolKey ?? null,
        JSON.stringify(event.inputSummary),
        JSON.stringify(event.outputSummary),
        event.latencyMs ?? null,
        event.errorCode ?? null,
        event.createdAt
      ]
    );
  }

  async findById(id: string): Promise<OrchestrationRun | null> {
    const runResult = await this.executor.query<RunRow>(
      `SELECT * FROM orchestration_runs WHERE id = $1`,
      [id]
    );
    const row = runResult.rows[0];
    if (!row) return null;

    const eventsResult = await this.executor.query<EventRow>(
      `SELECT * FROM orchestration_events
       WHERE run_id = $1
       ORDER BY sequence`,
      [id]
    );

    return {
      ...this.mapRun(row),
      events: eventsResult.rows.map((event) => ({
        id: event.id,
        runId: event.run_id,
        sequence: event.sequence,
        executionGroup: event.execution_group,
        eventType: event.event_type,
        capability: event.capability,
        status: event.status,
        toolKey: event.tool_key ?? undefined,
        inputSummary: objectValue(event.input_summary),
        outputSummary: objectValue(event.output_summary),
        latencyMs: event.latency_ms ?? undefined,
        errorCode: event.error_code ?? undefined,
        createdAt: iso(event.created_at)
      }))
    };
  }

  async list(limit = 100): Promise<readonly OrchestrationRun[]> {
    const result = await this.executor.query<RunRow>(
      `SELECT * FROM orchestration_runs
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 500))]
    );
    return result.rows.map((row) => this.mapRun(row));
  }

  private mapRun(row: RunRow): OrchestrationRun {
    return {
      id: row.id,
      requestId: row.request_id,
      userId: row.user_id ?? undefined,
      conversationId: row.conversation_id ?? undefined,
      intent: row.intent,
      status: row.status,
      plan: row.plan as OrchestrationPlan,
      answer: row.answer ?? undefined,
      latencyMs: row.latency_ms ?? undefined,
      errorCode: row.error_code ?? undefined,
      createdAt: iso(row.created_at),
      completedAt: row.completed_at
        ? iso(row.completed_at)
        : undefined
    };
  }
}


interface PlannerShadowRow {
  id: string;
  run_id: string;
  provider_key: string;
  deterministic_plan: unknown;
  shadow_plan: unknown | null;
  agreement_score: number | string | null;
  added_tools: string[];
  removed_tools: string[];
  latency_ms: number;
  status: PlannerShadowEvaluation["status"];
  error_code: string | null;
  created_at: string | Date;
}

export class PostgresPlannerShadowRepository
  implements PlannerShadowRepository
{
  constructor(private readonly executor: OrchestrationSqlExecutor) {}

  async append(
    evaluation: PlannerShadowEvaluation
  ): Promise<void> {
    await this.executor.query(
      `INSERT INTO planner_shadow_evaluations (
         id, run_id, provider_key, deterministic_plan,
         shadow_plan, agreement_score, added_tools,
         removed_tools, latency_ms, status, error_code,
         created_at
       ) VALUES (
         $1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12
       )`,
      [
        evaluation.id,
        evaluation.runId,
        evaluation.providerKey,
        JSON.stringify(evaluation.deterministicPlan),
        evaluation.shadowPlan
          ? JSON.stringify(evaluation.shadowPlan)
          : null,
        evaluation.agreementScore ?? null,
        evaluation.addedTools,
        evaluation.removedTools,
        evaluation.latencyMs,
        evaluation.status,
        evaluation.errorCode ?? null,
        evaluation.createdAt
      ]
    );
  }

  async list(
    limit = 100
  ): Promise<readonly PlannerShadowEvaluation[]> {
    const result = await this.executor.query<PlannerShadowRow>(
      `SELECT *
       FROM planner_shadow_evaluations
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 500))]
    );
    return result.rows.map(mapPlannerShadowRow);
  }

  async findByRunId(
    runId: string
  ): Promise<PlannerShadowEvaluation | null> {
    const result = await this.executor.query<PlannerShadowRow>(
      `SELECT *
       FROM planner_shadow_evaluations
       WHERE run_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [runId]
    );
    return result.rows[0]
      ? mapPlannerShadowRow(result.rows[0])
      : null;
  }
}

function mapPlannerShadowRow(
  row: PlannerShadowRow
): PlannerShadowEvaluation {
  return {
    id: row.id,
    runId: row.run_id,
    providerKey: row.provider_key,
    deterministicPlan:
      row.deterministic_plan as OrchestrationPlan,
    shadowPlan:
      row.shadow_plan
        ? row.shadow_plan as OrchestrationPlan
        : undefined,
    agreementScore:
      row.agreement_score === null
        ? undefined
        : Number(row.agreement_score),
    addedTools: row.added_tools ?? [],
    removedTools: row.removed_tools ?? [],
    latencyMs: row.latency_ms,
    status: row.status,
    errorCode: row.error_code ?? undefined,
    createdAt: iso(row.created_at)
  };
}

export interface OrchestrationExplanation {
  run: OrchestrationRun;
  plannerShadow?: PlannerShadowEvaluation;
  rationale: {
    intent: string;
    answerStrategy: string;
    requiredTools: readonly string[];
    optionalTools: readonly string[];
    parallelGroups: readonly {
      executionGroup: number;
      tools: readonly string[];
    }[];
    failures: readonly string[];
  };
}

export async function explainOrchestrationRun(input: {
  runId: string;
  runs: OrchestrationRepository;
  shadow: PlannerShadowRepository;
}): Promise<OrchestrationExplanation | null> {
  const run = await input.runs.findById(input.runId);
  if (!run) return null;
  const plannerShadow = await input.shadow.findByRunId(input.runId);
  const groups = new Map<number, string[]>();
  const failures: string[] = [];

  for (const event of run.events ?? []) {
    const group = event.executionGroup ?? 1;
    const tools = groups.get(group) ?? [];
    if (event.toolKey) tools.push(event.toolKey);
    groups.set(group, tools);
    if (event.status === "failed" && event.errorCode) {
      failures.push(`${event.toolKey ?? event.capability}: ${event.errorCode}`);
    }
  }

  return {
    run,
    plannerShadow: plannerShadow ?? undefined,
    rationale: {
      intent: run.plan.intent,
      answerStrategy: run.plan.answerStrategy,
      requiredTools: run.plan.steps
        .filter((step) => step.required)
        .map((step) => step.toolKey),
      optionalTools: run.plan.steps
        .filter((step) => !step.required)
        .map((step) => step.toolKey),
      parallelGroups: [...groups.entries()]
        .sort(([left], [right]) => left - right)
        .map(([executionGroup, tools]) => ({
          executionGroup,
          tools
        })),
      failures
    }
  };
}

export function createDefaultOrchestrator(input: {
  knowledge: KnowledgeSearch;
  journeys: JourneyEngine;
  repository: OrchestrationRepository;
  plannerShadowRepository?: PlannerShadowRepository;
  plannerSuggestionProvider?: PlannerSuggestionProvider;
  executionService?: SafeExecutionService;
}): AiOrchestrator {
  const tools = new ToolRegistry();
  tools.register(new KnowledgeSearchTool(input.knowledge));
  tools.register(new JourneyDashboardTool(input.journeys));
  tools.register(new JourneyNextActionTool());
  if (input.executionService) {
    tools.register(
      new ReminderScheduleTool(input.executionService)
    );
    tools.register(
      new NotificationQueueTool(input.executionService)
    );
  }

  const shadowPlanning = input.plannerShadowRepository
    ? new ShadowPlanningService(
        input.plannerSuggestionProvider ??
          new HeuristicShadowPlanner(),
        input.plannerShadowRepository
      )
    : undefined;

  return new AiOrchestrator(
    new DeterministicIntentPlanner(),
    tools,
    new DeterministicAnswerComposer(),
    input.repository,
    shadowPlanning
  );
}

export * from "./execution-tools.js";
