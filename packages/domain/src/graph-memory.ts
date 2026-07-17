import type {
  JourneyAggregate,
  JourneyRepository
} from "./journey-engine-2.js";

export type MemoryNodeType =
  | "user"
  | "journey"
  | "goal"
  | "milestone"
  | "blocker"
  | "action"
  | "evidence"
  | "decision"
  | "phase"
  | "route";

export type MemoryEdgeType =
  | "HAS_JOURNEY"
  | "HAS_GOAL"
  | "HAS_MILESTONE"
  | "HAS_BLOCKER"
  | "HAS_ACTION"
  | "HAS_EVIDENCE"
  | "HAS_DECISION"
  | "IN_PHASE"
  | "FOLLOWS_ROUTE"
  | "SUPPORTS"
  | "BLOCKS"
  | "RESOLVES"
  | "DEPENDS_ON";

export interface MemoryGraphNode {
  id: string;
  userId: string;
  nodeType: MemoryNodeType;
  externalId: string;
  label: string;
  properties: Readonly<Record<string, unknown>>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryGraphEdge {
  id: string;
  userId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: MemoryEdgeType;
  properties: Readonly<Record<string, unknown>>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryGraph {
  nodes: readonly MemoryGraphNode[];
  edges: readonly MemoryGraphEdge[];
}

export interface MemoryGraphRepository {
  upsertNode(node: MemoryGraphNode): Promise<void>;
  upsertEdge(edge: MemoryGraphEdge): Promise<void>;
  replaceUserGraph(
    userId: string,
    graph: MemoryGraph
  ): Promise<void>;
  getUserGraph(userId: string): Promise<MemoryGraph>;
  neighbors(
    userId: string,
    nodeId: string,
    depth?: number
  ): Promise<MemoryGraph>;
}

export interface GraphSqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: readonly Row[]; rowCount: number }>;
}

function stableGraphId(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
}

function graphNow(): string {
  return new Date().toISOString();
}

function node(input: {
  userId: string;
  nodeType: MemoryNodeType;
  externalId: string;
  label: string;
  properties?: Readonly<Record<string, unknown>>;
  active?: boolean;
}): MemoryGraphNode {
  const timestamp = graphNow();
  return {
    id: stableGraphId(
      `${input.userId}:${input.nodeType}:${input.externalId}`
    ),
    userId: input.userId,
    nodeType: input.nodeType,
    externalId: input.externalId,
    label: input.label,
    properties: input.properties ?? {},
    active: input.active ?? true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function edge(input: {
  userId: string;
  from: MemoryGraphNode;
  to: MemoryGraphNode;
  edgeType: MemoryEdgeType;
  properties?: Readonly<Record<string, unknown>>;
}): MemoryGraphEdge {
  const timestamp = graphNow();
  return {
    id: stableGraphId(
      `${input.userId}:${input.from.id}:${input.edgeType}:${input.to.id}`
    ),
    userId: input.userId,
    fromNodeId: input.from.id,
    toNodeId: input.to.id,
    edgeType: input.edgeType,
    properties: input.properties ?? {},
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function buildJourneyMemoryGraph(
  aggregate: JourneyAggregate
): MemoryGraph {
  const { journey } = aggregate;
  const nodes: MemoryGraphNode[] = [];
  const edges: MemoryGraphEdge[] = [];

  const userNode = node({
    userId: journey.userId,
    nodeType: "user",
    externalId: journey.userId,
    label: "Gebruiker"
  });
  const journeyNode = node({
    userId: journey.userId,
    nodeType: "journey",
    externalId: journey.id,
    label: `Journey ${journey.phaseKey}`,
    properties: {
      progress: journey.progress,
      status: journey.status
    }
  });
  const phaseNode = node({
    userId: journey.userId,
    nodeType: "phase",
    externalId: journey.phaseKey,
    label: journey.phaseKey
  });

  nodes.push(userNode, journeyNode, phaseNode);
  edges.push(
    edge({
      userId: journey.userId,
      from: userNode,
      to: journeyNode,
      edgeType: "HAS_JOURNEY"
    }),
    edge({
      userId: journey.userId,
      from: journeyNode,
      to: phaseNode,
      edgeType: "IN_PHASE"
    })
  );

  if (journey.routeKey) {
    const routeNode = node({
      userId: journey.userId,
      nodeType: "route",
      externalId: journey.routeKey,
      label: journey.routeKey
    });
    nodes.push(routeNode);
    edges.push(edge({
      userId: journey.userId,
      from: journeyNode,
      to: routeNode,
      edgeType: "FOLLOWS_ROUTE"
    }));
  }

  const byExternalId = new Map<string, MemoryGraphNode>();
  byExternalId.set(journey.id, journeyNode);

  for (const goal of aggregate.goals) {
    const goalNode = node({
      userId: journey.userId,
      nodeType: "goal",
      externalId: goal.id,
      label: goal.title,
      active: !["completed", "cancelled"].includes(goal.status),
      properties: {
        status: goal.status,
        priority: goal.priority,
        targetAt: goal.targetAt
      }
    });
    nodes.push(goalNode);
    byExternalId.set(goal.id, goalNode);
    edges.push(edge({
      userId: journey.userId,
      from: journeyNode,
      to: goalNode,
      edgeType: "HAS_GOAL"
    }));
  }

  for (const milestone of aggregate.milestones) {
    const milestoneNode = node({
      userId: journey.userId,
      nodeType: "milestone",
      externalId: milestone.id,
      label: milestone.title,
      active: milestone.status === "pending",
      properties: {
        status: milestone.status,
        weight: milestone.weight,
        sortOrder: milestone.sortOrder
      }
    });
    nodes.push(milestoneNode);
    byExternalId.set(milestone.id, milestoneNode);
    edges.push(edge({
      userId: journey.userId,
      from: milestone.goalId
        ? byExternalId.get(milestone.goalId) ?? journeyNode
        : journeyNode,
      to: milestoneNode,
      edgeType: "HAS_MILESTONE"
    }));
  }

  for (const blocker of aggregate.blockers) {
    const blockerNode = node({
      userId: journey.userId,
      nodeType: "blocker",
      externalId: blocker.id,
      label: blocker.title,
      active: ["open", "mitigating"].includes(blocker.status),
      properties: {
        blockerKey: blocker.blockerKey,
        status: blocker.status,
        severity: blocker.severity,
        confidence: blocker.confidence
      }
    });
    nodes.push(blockerNode);
    byExternalId.set(blocker.id, blockerNode);
    edges.push(edge({
      userId: journey.userId,
      from: journeyNode,
      to: blockerNode,
      edgeType: "HAS_BLOCKER"
    }));
  }

  for (const action of aggregate.actions) {
    const actionNode = node({
      userId: journey.userId,
      nodeType: "action",
      externalId: action.id,
      label: action.title,
      active: ["pending", "doing"].includes(action.status),
      properties: {
        actionKey: action.actionKey,
        status: action.status,
        priority: action.priority,
        dueAt: action.dueAt
      }
    });
    nodes.push(actionNode);
    byExternalId.set(action.id, actionNode);
    edges.push(edge({
      userId: journey.userId,
      from: action.goalId
        ? byExternalId.get(action.goalId) ?? journeyNode
        : journeyNode,
      to: actionNode,
      edgeType: "HAS_ACTION"
    }));

    if (action.blockerId) {
      const blockerNode = byExternalId.get(action.blockerId);
      if (blockerNode) {
        edges.push(edge({
          userId: journey.userId,
          from: actionNode,
          to: blockerNode,
          edgeType: "RESOLVES"
        }));
      }
    }
  }

  for (const evidence of aggregate.evidence) {
    const evidenceNode = node({
      userId: journey.userId,
      nodeType: "evidence",
      externalId: evidence.id,
      label: evidence.claimKey,
      properties: {
        evidenceType: evidence.evidenceType,
        confidence: evidence.confidence,
        value: evidence.value
      }
    });
    nodes.push(evidenceNode);
    byExternalId.set(evidence.id, evidenceNode);
    edges.push(edge({
      userId: journey.userId,
      from: journeyNode,
      to: evidenceNode,
      edgeType: "HAS_EVIDENCE"
    }));
  }

  for (const blocker of aggregate.blockers) {
    const blockerNode = byExternalId.get(blocker.id);
    if (!blockerNode) continue;
    for (const evidenceId of blocker.evidenceIds) {
      const evidenceNode = byExternalId.get(evidenceId);
      if (evidenceNode) {
        edges.push(edge({
          userId: journey.userId,
          from: evidenceNode,
          to: blockerNode,
          edgeType: "SUPPORTS"
        }));
      }
    }
  }

  for (const decision of aggregate.decisions) {
    const decisionNode = node({
      userId: journey.userId,
      nodeType: "decision",
      externalId: decision.id,
      label: `${decision.decisionKey}: ${decision.outcome}`,
      properties: {
        reason: decision.reason,
        ruleVersion: decision.ruleVersion,
        reversible: decision.reversible
      }
    });
    nodes.push(decisionNode);
    byExternalId.set(decision.id, decisionNode);
    edges.push(edge({
      userId: journey.userId,
      from: journeyNode,
      to: decisionNode,
      edgeType: "HAS_DECISION"
    }));

    for (const evidenceId of decision.evidenceIds) {
      const evidenceNode = byExternalId.get(evidenceId);
      if (evidenceNode) {
        edges.push(edge({
          userId: journey.userId,
          from: evidenceNode,
          to: decisionNode,
          edgeType: "SUPPORTS"
        }));
      }
    }
  }

  return { nodes, edges };
}

export class InMemoryMemoryGraphRepository
  implements MemoryGraphRepository
{
  private readonly nodes = new Map<string, MemoryGraphNode>();
  private readonly edges = new Map<string, MemoryGraphEdge>();

  async upsertNode(value: MemoryGraphNode): Promise<void> {
    this.nodes.set(value.id, value);
  }

  async upsertEdge(value: MemoryGraphEdge): Promise<void> {
    this.edges.set(value.id, value);
  }

  async replaceUserGraph(
    userId: string,
    graph: MemoryGraph
  ): Promise<void> {
    for (const [id, value] of this.nodes) {
      if (value.userId === userId) this.nodes.delete(id);
    }
    for (const [id, value] of this.edges) {
      if (value.userId === userId) this.edges.delete(id);
    }
    for (const value of graph.nodes) await this.upsertNode(value);
    for (const value of graph.edges) await this.upsertEdge(value);
  }

  async getUserGraph(userId: string): Promise<MemoryGraph> {
    return {
      nodes: [...this.nodes.values()].filter(
        (value) => value.userId === userId
      ),
      edges: [...this.edges.values()].filter(
        (value) => value.userId === userId
      )
    };
  }

  async neighbors(
    userId: string,
    nodeId: string,
    depth = 1
  ): Promise<MemoryGraph> {
    const graph = await this.getUserGraph(userId);
    const selected = new Set<string>([nodeId]);

    for (let level = 0; level < Math.max(1, depth); level += 1) {
      for (const value of graph.edges) {
        if (selected.has(value.fromNodeId)) {
          selected.add(value.toNodeId);
        }
        if (selected.has(value.toNodeId)) {
          selected.add(value.fromNodeId);
        }
      }
    }

    return {
      nodes: graph.nodes.filter((value) => selected.has(value.id)),
      edges: graph.edges.filter(
        (value) =>
          selected.has(value.fromNodeId) &&
          selected.has(value.toNodeId)
      )
    };
  }
}

export class PostgresMemoryGraphRepository
  implements MemoryGraphRepository
{
  constructor(private readonly executor: GraphSqlExecutor) {}

  async upsertNode(node: MemoryGraphNode): Promise<void> {
    await this.executor.query(
      `INSERT INTO memory_graph_nodes (
         id, user_id, node_type, external_id, label,
         properties, active, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
       ON CONFLICT (user_id, node_type, external_id)
       DO UPDATE SET
         label = EXCLUDED.label,
         properties = EXCLUDED.properties,
         active = EXCLUDED.active,
         updated_at = EXCLUDED.updated_at`,
      [
        node.id,
        node.userId,
        node.nodeType,
        node.externalId,
        node.label,
        JSON.stringify(node.properties),
        node.active,
        node.createdAt,
        node.updatedAt
      ]
    );
  }

  async upsertEdge(edge: MemoryGraphEdge): Promise<void> {
    await this.executor.query(
      `INSERT INTO memory_graph_edges (
         id, user_id, from_node_id, to_node_id, edge_type,
         properties, active, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
       ON CONFLICT (user_id, from_node_id, to_node_id, edge_type)
       DO UPDATE SET
         properties = EXCLUDED.properties,
         active = EXCLUDED.active,
         updated_at = EXCLUDED.updated_at`,
      [
        edge.id,
        edge.userId,
        edge.fromNodeId,
        edge.toNodeId,
        edge.edgeType,
        JSON.stringify(edge.properties),
        edge.active,
        edge.createdAt,
        edge.updatedAt
      ]
    );
  }

  async replaceUserGraph(
    userId: string,
    graph: MemoryGraph
  ): Promise<void> {
    await this.executor.query(
      `DELETE FROM memory_graph_edges WHERE user_id = $1`,
      [userId]
    );
    await this.executor.query(
      `DELETE FROM memory_graph_nodes WHERE user_id = $1`,
      [userId]
    );
    for (const value of graph.nodes) await this.upsertNode(value);
    for (const value of graph.edges) await this.upsertEdge(value);
  }

  async getUserGraph(userId: string): Promise<MemoryGraph> {
    const nodes = await this.executor.query<{
      id: string;
      user_id: string;
      node_type: MemoryNodeType;
      external_id: string;
      label: string;
      properties: unknown;
      active: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT * FROM memory_graph_nodes
       WHERE user_id = $1
       ORDER BY node_type, label`,
      [userId]
    );
    const edges = await this.executor.query<{
      id: string;
      user_id: string;
      from_node_id: string;
      to_node_id: string;
      edge_type: MemoryEdgeType;
      properties: unknown;
      active: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT * FROM memory_graph_edges
       WHERE user_id = $1
       ORDER BY edge_type`,
      [userId]
    );

    const iso = (value: string | Date): string =>
      value instanceof Date ? value.toISOString() : value;
    const objectValue = (
      value: unknown
    ): Readonly<Record<string, unknown>> =>
      value && typeof value === "object" && !Array.isArray(value)
        ? value as Readonly<Record<string, unknown>>
        : {};

    return {
      nodes: nodes.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        nodeType: row.node_type,
        externalId: row.external_id,
        label: row.label,
        properties: objectValue(row.properties),
        active: row.active,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at)
      })),
      edges: edges.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        fromNodeId: row.from_node_id,
        toNodeId: row.to_node_id,
        edgeType: row.edge_type,
        properties: objectValue(row.properties),
        active: row.active,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at)
      }))
    };
  }

  async neighbors(
    userId: string,
    nodeId: string,
    depth = 1
  ): Promise<MemoryGraph> {
    const graph = await this.getUserGraph(userId);
    const selected = new Set<string>([nodeId]);

    for (let level = 0; level < Math.max(1, depth); level += 1) {
      for (const value of graph.edges) {
        if (selected.has(value.fromNodeId)) {
          selected.add(value.toNodeId);
        }
        if (selected.has(value.toNodeId)) {
          selected.add(value.fromNodeId);
        }
      }
    }

    return {
      nodes: graph.nodes.filter((value) => selected.has(value.id)),
      edges: graph.edges.filter(
        (value) =>
          selected.has(value.fromNodeId) &&
          selected.has(value.toNodeId)
      )
    };
  }
}

export class JourneyGraphMemoryService {
  constructor(
    private readonly journeys: JourneyRepository,
    private readonly graph: MemoryGraphRepository
  ) {}

  async synchronize(userId: string): Promise<MemoryGraph> {
    const aggregate = await this.journeys.findByUserId(userId);
    if (!aggregate) throw new Error("journey_not_found");

    const memory = buildJourneyMemoryGraph(aggregate);
    await this.graph.replaceUserGraph(userId, memory);
    return memory;
  }

  get(userId: string): Promise<MemoryGraph> {
    return this.graph.getUserGraph(userId);
  }

  context(userId: string): Promise<{
    graph: MemoryGraph;
    activeGoals: readonly MemoryGraphNode[];
    openBlockers: readonly MemoryGraphNode[];
    pendingActions: readonly MemoryGraphNode[];
    evidence: readonly MemoryGraphNode[];
  }> {
    return this.graph.getUserGraph(userId).then((graph) => ({
      graph,
      activeGoals: graph.nodes.filter(
        (value) => value.nodeType === "goal" && value.active
      ),
      openBlockers: graph.nodes.filter(
        (value) => value.nodeType === "blocker" && value.active
      ),
      pendingActions: graph.nodes.filter(
        (value) => value.nodeType === "action" && value.active
      ),
      evidence: graph.nodes.filter(
        (value) => value.nodeType === "evidence"
      )
    }));
  }
}


export class GraphMemoryJourneyChangeListener {
  constructor(
    private readonly service: JourneyGraphMemoryService
  ) {}

  async onJourneyChanged(userId: string): Promise<void> {
    await this.service.synchronize(userId);
  }
}
