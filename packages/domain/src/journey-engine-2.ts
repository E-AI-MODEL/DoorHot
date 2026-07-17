export type JourneyStatus = "active" | "paused" | "completed";
export type GoalStatus = "pending" | "active" | "completed" | "cancelled";
export type MilestoneStatus = "pending" | "completed" | "skipped";
export type BlockerStatus = "open" | "mitigating" | "resolved" | "dismissed";
export type ActionStatus = "pending" | "doing" | "done" | "cancelled" | "expired";
export type BlockerSeverity = "low" | "medium" | "high" | "critical";
export type EvidenceType =
  | "chat"
  | "profile"
  | "talent_test"
  | "route"
  | "document"
  | "advisor"
  | "rule";

export interface JourneyGoal {
  id: string;
  journeyId: string;
  title: string;
  description?: string;
  status: GoalStatus;
  priority: number;
  targetAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyMilestone {
  id: string;
  journeyId: string;
  goalId?: string;
  title: string;
  status: MilestoneStatus;
  weight: number;
  sortOrder: number;
  completedAt?: string;
  createdAt: string;
}

export interface JourneyBlocker {
  id: string;
  journeyId: string;
  blockerKey: string;
  title: string;
  severity: BlockerSeverity;
  confidence: number;
  status: BlockerStatus;
  evidenceIds: readonly string[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyAction {
  id: string;
  journeyId: string;
  goalId?: string;
  blockerId?: string;
  actionKey: string;
  title: string;
  description?: string;
  status: ActionStatus;
  priority: number;
  dueAt?: string;
  completedAt?: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyEvidence {
  id: string;
  journeyId: string;
  evidenceType: EvidenceType;
  sourceId?: string;
  claimKey: string;
  value: unknown;
  confidence: number;
  observedAt: string;
}

export interface JourneyDecision {
  id: string;
  journeyId: string;
  decisionKey: string;
  outcome: string;
  reason: string;
  evidenceIds: readonly string[];
  ruleVersion: string;
  reversible: boolean;
  decidedAt: string;
}

export interface Journey {
  id: string;
  userId: string;
  phaseKey: string;
  routeKey?: string;
  status: JourneyStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyAggregate {
  journey: Journey;
  goals: readonly JourneyGoal[];
  milestones: readonly JourneyMilestone[];
  blockers: readonly JourneyBlocker[];
  actions: readonly JourneyAction[];
  evidence: readonly JourneyEvidence[];
  decisions: readonly JourneyDecision[];
}

export interface JourneyRepository {
  findByUserId(userId: string): Promise<JourneyAggregate | null>;
  saveJourney(journey: Journey): Promise<void>;
  saveGoal(goal: JourneyGoal): Promise<void>;
  saveMilestone(milestone: JourneyMilestone): Promise<void>;
  saveBlocker(blocker: JourneyBlocker): Promise<void>;
  saveAction(action: JourneyAction): Promise<void>;
  saveEvidence(evidence: JourneyEvidence): Promise<void>;
  saveDecision(decision: JourneyDecision): Promise<void>;
}

export interface JourneySqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: readonly Row[]; rowCount: number }>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function severityWeight(severity: BlockerSeverity): number {
  return { low: 0.05, medium: 0.1, high: 0.2, critical: 0.35 }[severity];
}

export function calculateJourneyProgress(
  aggregate: Omit<JourneyAggregate, "journey"> & { journey?: Journey }
): number {
  const milestones = aggregate.milestones.filter(
    (item) => item.status !== "skipped"
  );
  const totalWeight = milestones.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = milestones
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.weight, 0);
  const goalProgress = aggregate.goals.length === 0
    ? 0
    : aggregate.goals.filter((goal) => goal.status === "completed").length /
      aggregate.goals.filter((goal) => goal.status !== "cancelled").length;
  const milestoneProgress = totalWeight === 0 ? 0 : completedWeight / totalWeight;
  const blockerPenalty = aggregate.blockers
    .filter((blocker) => ["open", "mitigating"].includes(blocker.status))
    .reduce(
      (sum, blocker) => sum + severityWeight(blocker.severity) * blocker.confidence,
      0
    );

  return Number(
    clamp((goalProgress * 0.4 + milestoneProgress * 0.6) * (1 - clamp(blockerPenalty)))
      .toFixed(4)
  );
}

export function selectNextBestAction(
  aggregate: JourneyAggregate
): JourneyAction | undefined {
  const severityRank: Record<BlockerSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
  };
  const blockers = new Map(
    aggregate.blockers.map((blocker) => [blocker.id, blocker])
  );

  return [...aggregate.actions]
    .filter((action) => ["pending", "doing"].includes(action.status))
    .sort((left, right) => {
      const leftBlocker = left.blockerId ? blockers.get(left.blockerId) : undefined;
      const rightBlocker = right.blockerId ? blockers.get(right.blockerId) : undefined;
      const blockerDifference =
        (rightBlocker ? severityRank[rightBlocker.severity] : 0) -
        (leftBlocker ? severityRank[leftBlocker.severity] : 0);
      if (blockerDifference !== 0) return blockerDifference;
      if (right.priority !== left.priority) return right.priority - left.priority;
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;
      return leftDue - rightDue;
    })[0];
}

export class InMemoryJourneyRepository implements JourneyRepository {
  private readonly aggregates = new Map<string, JourneyAggregate>();

  async findByUserId(userId: string): Promise<JourneyAggregate | null> {
    return this.aggregates.get(userId) ?? null;
  }

  private update(journeyId: string, mutate: (value: JourneyAggregate) => JourneyAggregate): void {
    const entry = [...this.aggregates.entries()].find(
      ([, value]) => value.journey.id === journeyId
    );
    if (!entry) throw new Error("journey_not_found");
    this.aggregates.set(entry[0], mutate(entry[1]));
  }

  async saveJourney(journey: Journey): Promise<void> {
    const existing = this.aggregates.get(journey.userId);
    this.aggregates.set(journey.userId, existing
      ? { ...existing, journey }
      : {
          journey,
          goals: [],
          milestones: [],
          blockers: [],
          actions: [],
          evidence: [],
          decisions: []
        });
  }

  async saveGoal(goal: JourneyGoal): Promise<void> {
    this.update(goal.journeyId, (value) => ({
      ...value,
      goals: [...value.goals.filter((item) => item.id !== goal.id), goal]
    }));
  }

  async saveMilestone(milestone: JourneyMilestone): Promise<void> {
    this.update(milestone.journeyId, (value) => ({
      ...value,
      milestones: [
        ...value.milestones.filter((item) => item.id !== milestone.id),
        milestone
      ]
    }));
  }

  async saveBlocker(blocker: JourneyBlocker): Promise<void> {
    this.update(blocker.journeyId, (value) => ({
      ...value,
      blockers: [...value.blockers.filter((item) => item.id !== blocker.id), blocker]
    }));
  }

  async saveAction(action: JourneyAction): Promise<void> {
    this.update(action.journeyId, (value) => ({
      ...value,
      actions: [...value.actions.filter((item) => item.id !== action.id), action]
    }));
  }

  async saveEvidence(evidence: JourneyEvidence): Promise<void> {
    this.update(evidence.journeyId, (value) => ({
      ...value,
      evidence: [...value.evidence.filter((item) => item.id !== evidence.id), evidence]
    }));
  }

  async saveDecision(decision: JourneyDecision): Promise<void> {
    this.update(decision.journeyId, (value) => ({
      ...value,
      decisions: [...value.decisions.filter((item) => item.id !== decision.id), decision]
    }));
  }
}

export interface JourneyChangeListener {
  onJourneyChanged(userId: string): Promise<void>;
}

export class JourneyEngine {
  readonly ruleVersion = "journey-engine-2.1.0";

  constructor(
    private readonly repository: JourneyRepository,
    private readonly changeListener?: JourneyChangeListener
  ) {}

  private async notifyChanged(userId: string): Promise<void> {
    await this.changeListener?.onJourneyChanged(userId);
  }

  async ensureJourney(input: {
    userId: string;
    phaseKey: string;
    routeKey?: string;
  }): Promise<JourneyAggregate> {
    const existing = await this.repository.findByUserId(input.userId);
    if (existing) return existing;

    const timestamp = nowIso();
    const journey: Journey = {
      id: crypto.randomUUID(),
      userId: input.userId,
      phaseKey: input.phaseKey,
      routeKey: input.routeKey,
      status: "active",
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveJourney(journey);
    await this.notifyChanged(input.userId);
    return (await this.repository.findByUserId(input.userId))!;
  }

  async synchronizeContext(input: {
    userId: string;
    phaseKey: string;
    routeKey?: string;
    phaseConfidence?: number;
    routeReason?: string;
  }): Promise<JourneyAggregate> {
    const aggregate = await this.ensureJourney(input);
    const timestamp = nowIso();
    const phaseEvidence = await this.addEvidence({
      userId: input.userId,
      evidenceType: "rule",
      claimKey: "current_phase",
      value: input.phaseKey,
      confidence: input.phaseConfidence ?? 1
    });

    await this.repository.saveJourney({
      ...aggregate.journey,
      phaseKey: input.phaseKey,
      routeKey: input.routeKey ?? aggregate.journey.routeKey,
      updatedAt: timestamp
    });
    await this.recordDecision({
      userId: input.userId,
      decisionKey: "journey_context",
      outcome: [
        `phase:${input.phaseKey}`,
        input.routeKey ? `route:${input.routeKey}` : undefined
      ].filter(Boolean).join(","),
      reason:
        input.routeReason ??
        "Journeycontext bijgewerkt vanuit fase- en route-engine.",
      evidenceIds: [phaseEvidence.id],
      reversible: true
    });

    return (await this.repository.findByUserId(input.userId))!;
  }

  async addGoal(input: {
    userId: string;
    title: string;
    description?: string;
    priority?: number;
    targetAt?: string;
  }): Promise<JourneyGoal> {
    const aggregate = await this.requireJourney(input.userId);
    const timestamp = nowIso();
    const goal: JourneyGoal = {
      id: crypto.randomUUID(),
      journeyId: aggregate.journey.id,
      title: input.title,
      description: input.description,
      status: "active",
      priority: Math.round(clamp(input.priority ?? 50, 0, 100)),
      targetAt: input.targetAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveGoal(goal);
    await this.refresh(input.userId);
    return goal;
  }

  async addMilestone(input: {
    userId: string;
    goalId?: string;
    title: string;
    weight?: number;
    sortOrder?: number;
  }): Promise<JourneyMilestone> {
    const aggregate = await this.requireJourney(input.userId);
    const milestone: JourneyMilestone = {
      id: crypto.randomUUID(),
      journeyId: aggregate.journey.id,
      goalId: input.goalId,
      title: input.title,
      status: "pending",
      weight: Math.max(0.1, input.weight ?? 1),
      sortOrder: input.sortOrder ?? aggregate.milestones.length,
      createdAt: nowIso()
    };
    await this.repository.saveMilestone(milestone);
    await this.refresh(input.userId);
    return milestone;
  }

  async upsertBlocker(input: {
    userId: string;
    blockerKey: string;
    title: string;
    severity: BlockerSeverity;
    confidence: number;
    evidenceIds?: readonly string[];
  }): Promise<JourneyBlocker> {
    const aggregate = await this.requireJourney(input.userId);
    const existing = aggregate.blockers.find(
      (item) => item.blockerKey === input.blockerKey && item.status !== "dismissed"
    );
    const timestamp = nowIso();
    const blocker: JourneyBlocker = {
      id: existing?.id ?? crypto.randomUUID(),
      journeyId: aggregate.journey.id,
      blockerKey: input.blockerKey,
      title: input.title,
      severity: input.severity,
      confidence: clamp(input.confidence),
      status: existing?.status ?? "open",
      evidenceIds: input.evidenceIds ?? existing?.evidenceIds ?? [],
      resolvedAt: existing?.resolvedAt,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveBlocker(blocker);
    await this.refresh(input.userId);
    return blocker;
  }

  async addAction(input: {
    userId: string;
    actionKey: string;
    title: string;
    description?: string;
    goalId?: string;
    blockerId?: string;
    priority?: number;
    dueAt?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<JourneyAction> {
    const aggregate = await this.requireJourney(input.userId);
    const timestamp = nowIso();
    const action: JourneyAction = {
      id: crypto.randomUUID(),
      journeyId: aggregate.journey.id,
      goalId: input.goalId,
      blockerId: input.blockerId,
      actionKey: input.actionKey,
      title: input.title,
      description: input.description,
      status: "pending",
      priority: Math.round(clamp(input.priority ?? 50, 0, 100)),
      dueAt: input.dueAt,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveAction(action);
    await this.notifyChanged(input.userId);
    return action;
  }

  async addEvidence(input: {
    userId: string;
    evidenceType: EvidenceType;
    sourceId?: string;
    claimKey: string;
    value: unknown;
    confidence: number;
  }): Promise<JourneyEvidence> {
    const aggregate = await this.requireJourney(input.userId);
    const evidence: JourneyEvidence = {
      id: crypto.randomUUID(),
      journeyId: aggregate.journey.id,
      evidenceType: input.evidenceType,
      sourceId: input.sourceId,
      claimKey: input.claimKey,
      value: input.value,
      confidence: clamp(input.confidence),
      observedAt: nowIso()
    };
    await this.repository.saveEvidence(evidence);
    await this.notifyChanged(input.userId);
    return evidence;
  }

  async recordDecision(input: {
    userId: string;
    decisionKey: string;
    outcome: string;
    reason: string;
    evidenceIds?: readonly string[];
    reversible?: boolean;
  }): Promise<JourneyDecision> {
    const aggregate = await this.requireJourney(input.userId);
    const decision: JourneyDecision = {
      id: crypto.randomUUID(),
      journeyId: aggregate.journey.id,
      decisionKey: input.decisionKey,
      outcome: input.outcome,
      reason: input.reason,
      evidenceIds: input.evidenceIds ?? [],
      ruleVersion: this.ruleVersion,
      reversible: input.reversible ?? true,
      decidedAt: nowIso()
    };
    await this.repository.saveDecision(decision);
    await this.notifyChanged(input.userId);
    return decision;
  }

  async updateActionStatus(
    userId: string,
    actionId: string,
    status: ActionStatus
  ): Promise<JourneyAction> {
    const aggregate = await this.requireJourney(userId);
    const current = aggregate.actions.find((item) => item.id === actionId);
    if (!current) throw new Error("journey_action_not_found");
    const timestamp = nowIso();
    const action: JourneyAction = {
      ...current,
      status,
      completedAt: status === "done" ? timestamp : undefined,
      updatedAt: timestamp
    };
    await this.repository.saveAction(action);
    await this.notifyChanged(userId);
    return action;
  }

  async updateMilestoneStatus(
    userId: string,
    milestoneId: string,
    status: MilestoneStatus
  ): Promise<JourneyMilestone> {
    const aggregate = await this.requireJourney(userId);
    const current = aggregate.milestones.find((item) => item.id === milestoneId);
    if (!current) throw new Error("journey_milestone_not_found");
    const milestone: JourneyMilestone = {
      ...current,
      status,
      completedAt: status === "completed" ? nowIso() : undefined
    };
    await this.repository.saveMilestone(milestone);
    await this.refresh(userId);
    return milestone;
  }

  async resolveBlocker(
    userId: string,
    blockerId: string
  ): Promise<JourneyBlocker> {
    const aggregate = await this.requireJourney(userId);
    const current = aggregate.blockers.find((item) => item.id === blockerId);
    if (!current) throw new Error("journey_blocker_not_found");
    const timestamp = nowIso();
    const blocker: JourneyBlocker = {
      ...current,
      status: "resolved",
      resolvedAt: timestamp,
      updatedAt: timestamp
    };
    await this.repository.saveBlocker(blocker);
    await this.refresh(userId);
    return blocker;
  }

  async dashboard(userId: string): Promise<{
    aggregate: JourneyAggregate;
    nextAction?: JourneyAction;
    openCriticalBlockers: readonly JourneyBlocker[];
  }> {
    const aggregate = await this.requireJourney(userId);
    return {
      aggregate,
      nextAction: selectNextBestAction(aggregate),
      openCriticalBlockers: aggregate.blockers.filter(
        (item) =>
          item.status === "open" &&
          ["critical", "high"].includes(item.severity)
      )
    };
  }

  private async refresh(userId: string): Promise<void> {
    const aggregate = await this.requireJourney(userId);
    const progress = calculateJourneyProgress(aggregate);
    await this.repository.saveJourney({
      ...aggregate.journey,
      progress,
      status: progress >= 1 ? "completed" : aggregate.journey.status,
      updatedAt: nowIso()
    });
    await this.notifyChanged(userId);
  }

  private async requireJourney(userId: string): Promise<JourneyAggregate> {
    const aggregate = await this.repository.findByUserId(userId);
    if (!aggregate) throw new Error("journey_not_found");
    return aggregate;
  }
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function optionalIso(
  value: string | Date | null
): string | undefined {
  return value ? toIso(value) : undefined;
}

function recordValue(
  value: unknown
): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

export class PostgresJourneyRepository
  implements JourneyRepository
{
  constructor(private readonly executor: JourneySqlExecutor) {}

  async findByUserId(userId: string): Promise<JourneyAggregate | null> {
    const journeyResult = await this.executor.query<{
      id: string;
      user_id: string;
      phase_key: string;
      route_key: string | null;
      status: JourneyStatus;
      progress: number | string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT *
       FROM journeys
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const row = journeyResult.rows[0];
    if (!row) return null;

    const [
      goalsResult,
      milestonesResult,
      blockersResult,
      actionsResult,
      evidenceResult,
      decisionsResult
    ] = await Promise.all([
      this.executor.query<{
        id: string;
        journey_id: string;
        title: string;
        description: string | null;
        status: GoalStatus;
        priority: number;
        target_at: string | Date | null;
        completed_at: string | Date | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT * FROM journey_goals
         WHERE journey_id = $1
         ORDER BY priority DESC, created_at ASC`,
        [row.id]
      ),
      this.executor.query<{
        id: string;
        journey_id: string;
        goal_id: string | null;
        title: string;
        status: MilestoneStatus;
        weight: number | string;
        sort_order: number;
        completed_at: string | Date | null;
        created_at: string | Date;
      }>(
        `SELECT * FROM journey_milestones
         WHERE journey_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [row.id]
      ),
      this.executor.query<{
        id: string;
        journey_id: string;
        blocker_key: string;
        title: string;
        severity: BlockerSeverity;
        confidence: number | string;
        status: BlockerStatus;
        evidence_ids: string[];
        resolved_at: string | Date | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT * FROM journey_blockers
         WHERE journey_id = $1
         ORDER BY created_at ASC`,
        [row.id]
      ),
      this.executor.query<{
        id: string;
        journey_id: string;
        goal_id: string | null;
        blocker_id: string | null;
        action_key: string;
        title: string;
        description: string | null;
        status: ActionStatus;
        priority: number;
        due_at: string | Date | null;
        completed_at: string | Date | null;
        metadata: unknown;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT * FROM journey_actions
         WHERE journey_id = $1
         ORDER BY priority DESC, created_at ASC`,
        [row.id]
      ),
      this.executor.query<{
        id: string;
        journey_id: string;
        evidence_type: EvidenceType;
        source_id: string | null;
        claim_key: string;
        value: unknown;
        confidence: number | string;
        observed_at: string | Date;
      }>(
        `SELECT * FROM journey_evidence
         WHERE journey_id = $1
         ORDER BY observed_at DESC`,
        [row.id]
      ),
      this.executor.query<{
        id: string;
        journey_id: string;
        decision_key: string;
        outcome: string;
        reason: string;
        evidence_ids: string[];
        rule_version: string;
        reversible: boolean;
        decided_at: string | Date;
      }>(
        `SELECT * FROM journey_decisions
         WHERE journey_id = $1
         ORDER BY decided_at DESC`,
        [row.id]
      )
    ]);

    return {
      journey: {
        id: row.id,
        userId: row.user_id,
        phaseKey: row.phase_key,
        routeKey: row.route_key ?? undefined,
        status: row.status,
        progress: Number(row.progress),
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at)
      },
      goals: goalsResult.rows.map((item) => ({
        id: item.id,
        journeyId: item.journey_id,
        title: item.title,
        description: item.description ?? undefined,
        status: item.status,
        priority: item.priority,
        targetAt: optionalIso(item.target_at),
        completedAt: optionalIso(item.completed_at),
        createdAt: toIso(item.created_at),
        updatedAt: toIso(item.updated_at)
      })),
      milestones: milestonesResult.rows.map((item) => ({
        id: item.id,
        journeyId: item.journey_id,
        goalId: item.goal_id ?? undefined,
        title: item.title,
        status: item.status,
        weight: Number(item.weight),
        sortOrder: item.sort_order,
        completedAt: optionalIso(item.completed_at),
        createdAt: toIso(item.created_at)
      })),
      blockers: blockersResult.rows.map((item) => ({
        id: item.id,
        journeyId: item.journey_id,
        blockerKey: item.blocker_key,
        title: item.title,
        severity: item.severity,
        confidence: Number(item.confidence),
        status: item.status,
        evidenceIds: item.evidence_ids ?? [],
        resolvedAt: optionalIso(item.resolved_at),
        createdAt: toIso(item.created_at),
        updatedAt: toIso(item.updated_at)
      })),
      actions: actionsResult.rows.map((item) => ({
        id: item.id,
        journeyId: item.journey_id,
        goalId: item.goal_id ?? undefined,
        blockerId: item.blocker_id ?? undefined,
        actionKey: item.action_key,
        title: item.title,
        description: item.description ?? undefined,
        status: item.status,
        priority: item.priority,
        dueAt: optionalIso(item.due_at),
        completedAt: optionalIso(item.completed_at),
        metadata: recordValue(item.metadata),
        createdAt: toIso(item.created_at),
        updatedAt: toIso(item.updated_at)
      })),
      evidence: evidenceResult.rows.map((item) => ({
        id: item.id,
        journeyId: item.journey_id,
        evidenceType: item.evidence_type,
        sourceId: item.source_id ?? undefined,
        claimKey: item.claim_key,
        value: item.value,
        confidence: Number(item.confidence),
        observedAt: toIso(item.observed_at)
      })),
      decisions: decisionsResult.rows.map((item) => ({
        id: item.id,
        journeyId: item.journey_id,
        decisionKey: item.decision_key,
        outcome: item.outcome,
        reason: item.reason,
        evidenceIds: item.evidence_ids ?? [],
        ruleVersion: item.rule_version,
        reversible: item.reversible,
        decidedAt: toIso(item.decided_at)
      }))
    };
  }

  async saveJourney(journey: Journey): Promise<void> {
    await this.executor.query(
      `INSERT INTO journeys (
         id, user_id, phase_key, route_key, status,
         progress, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET
         phase_key = EXCLUDED.phase_key,
         route_key = EXCLUDED.route_key,
         status = EXCLUDED.status,
         progress = EXCLUDED.progress,
         updated_at = EXCLUDED.updated_at`,
      [
        journey.id,
        journey.userId,
        journey.phaseKey,
        journey.routeKey ?? null,
        journey.status,
        journey.progress,
        journey.createdAt,
        journey.updatedAt
      ]
    );
  }

  async saveGoal(goal: JourneyGoal): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_goals (
         id, journey_id, title, description, status,
         priority, target_at, completed_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         priority = EXCLUDED.priority,
         target_at = EXCLUDED.target_at,
         completed_at = EXCLUDED.completed_at,
         updated_at = EXCLUDED.updated_at`,
      [
        goal.id, goal.journeyId, goal.title,
        goal.description ?? null, goal.status, goal.priority,
        goal.targetAt ?? null, goal.completedAt ?? null,
        goal.createdAt, goal.updatedAt
      ]
    );
  }

  async saveMilestone(item: JourneyMilestone): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_milestones (
         id, journey_id, goal_id, title, status,
         weight, sort_order, completed_at, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         goal_id = EXCLUDED.goal_id,
         title = EXCLUDED.title,
         status = EXCLUDED.status,
         weight = EXCLUDED.weight,
         sort_order = EXCLUDED.sort_order,
         completed_at = EXCLUDED.completed_at`,
      [
        item.id, item.journeyId, item.goalId ?? null,
        item.title, item.status, item.weight, item.sortOrder,
        item.completedAt ?? null, item.createdAt
      ]
    );
  }

  async saveBlocker(item: JourneyBlocker): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_blockers (
         id, journey_id, blocker_key, title, severity,
         confidence, status, evidence_ids, resolved_at,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         severity = EXCLUDED.severity,
         confidence = EXCLUDED.confidence,
         status = EXCLUDED.status,
         evidence_ids = EXCLUDED.evidence_ids,
         resolved_at = EXCLUDED.resolved_at,
         updated_at = EXCLUDED.updated_at`,
      [
        item.id, item.journeyId, item.blockerKey, item.title,
        item.severity, item.confidence, item.status,
        item.evidenceIds, item.resolvedAt ?? null,
        item.createdAt, item.updatedAt
      ]
    );
  }

  async saveAction(item: JourneyAction): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_actions (
         id, journey_id, goal_id, blocker_id, action_key,
         title, description, status, priority, due_at,
         completed_at, metadata, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14
       )
       ON CONFLICT (id) DO UPDATE SET
         goal_id = EXCLUDED.goal_id,
         blocker_id = EXCLUDED.blocker_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         priority = EXCLUDED.priority,
         due_at = EXCLUDED.due_at,
         completed_at = EXCLUDED.completed_at,
         metadata = EXCLUDED.metadata,
         updated_at = EXCLUDED.updated_at`,
      [
        item.id, item.journeyId, item.goalId ?? null,
        item.blockerId ?? null, item.actionKey, item.title,
        item.description ?? null, item.status, item.priority,
        item.dueAt ?? null, item.completedAt ?? null,
        JSON.stringify(item.metadata), item.createdAt, item.updatedAt
      ]
    );
  }

  async saveEvidence(item: JourneyEvidence): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_evidence (
         id, journey_id, evidence_type, source_id,
         claim_key, value, confidence, observed_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         value = EXCLUDED.value,
         confidence = EXCLUDED.confidence,
         observed_at = EXCLUDED.observed_at`,
      [
        item.id, item.journeyId, item.evidenceType,
        item.sourceId ?? null, item.claimKey,
        JSON.stringify(item.value), item.confidence, item.observedAt
      ]
    );
  }

  async saveDecision(item: JourneyDecision): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_decisions (
         id, journey_id, decision_key, outcome, reason,
         evidence_ids, rule_version, reversible, decided_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id, item.journeyId, item.decisionKey,
        item.outcome, item.reason, item.evidenceIds,
        item.ruleVersion, item.reversible, item.decidedAt
      ]
    );
  }
}
