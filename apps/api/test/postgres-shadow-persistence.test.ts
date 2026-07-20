import { PGlite } from "@electric-sql/pglite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  PostgresShadowEvaluationRepository,
  type ShadowEvaluation
} from "@door010/knowledge";
import {
  PostgresPlannerShadowRepository,
  type OrchestrationPlan,
  type OrchestrationSqlExecutor,
  type PlannerShadowEvaluation
} from "@door010/orchestration";
import { describe, expect, it } from "vitest";

const shadowMigrationNames = [
  "0019_shadow_reranking_active_learning.sql",
  "0023_ai_orchestrator.sql",
  "0024_parallel_shadow_planning_explainability.sql"
] as const;

class PGliteExecutor implements OrchestrationSqlExecutor {
  constructor(private readonly database: PGlite) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<{ rows: readonly Row[]; rowCount: number }> {
    const result = await this.database.query<Row>(sql, [
      ...parameters
    ]);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length
    };
  }
}

async function applyShadowMigrations(database: PGlite): Promise<void> {
  for (const migrationName of shadowMigrationNames) {
    const sql = await readFile(
      resolve(process.cwd(), "../../migrations", migrationName),
      "utf8"
    );
    await database.exec(sql);
  }
}

const deterministicPlan: OrchestrationPlan = {
  intent: "journey_guidance",
  confidence: 0.91,
  steps: [
    {
      sequence: 1,
      capability: "journey",
      toolKey: "journey.next-action",
      reason: "Bepaal de volgende stap.",
      required: true
    }
  ],
  answerStrategy: "journey_guidance"
};

describe("PostgreSQL shadow persistence", () => {
  it("survives a database reopen for reranker and planner records", async () => {
    const databaseDirectory = await mkdtemp(
      join(tmpdir(), "door010-shadow-persistence-")
    );
    const runId = "11111111-1111-4111-8111-111111111111";
    const createdAt = "2026-07-18T12:00:00.000Z";
    const rerankerEvaluation: ShadowEvaluation = {
      id: "22222222-2222-4222-8222-222222222222",
      queryHash: "stable-query-hash",
      providerKey: "test-cross-encoder",
      candidateIds: [
        "33333333-3333-4333-8333-333333333333"
      ],
      baselineOrder: [
        "33333333-3333-4333-8333-333333333333"
      ],
      shadowOrder: [
        "33333333-3333-4333-8333-333333333333"
      ],
      baselineTopId: "33333333-3333-4333-8333-333333333333",
      shadowTopId: "33333333-3333-4333-8333-333333333333",
      scoreDelta: 0.14,
      latencyMs: 17,
      status: "completed",
      createdAt
    };
    const plannerEvaluation: PlannerShadowEvaluation = {
      id: "44444444-4444-4444-8444-444444444444",
      runId,
      providerKey: "test-shadow-planner",
      deterministicPlan,
      shadowPlan: deterministicPlan,
      agreementScore: 1,
      addedTools: [],
      removedTools: [],
      latencyMs: 23,
      status: "completed",
      createdAt
    };

    let database: PGlite | undefined;
    try {
      database = new PGlite(databaseDirectory);
      await applyShadowMigrations(database);
      const firstExecutor = new PGliteExecutor(database);

      await firstExecutor.query(
        `INSERT INTO orchestration_runs (
           id, request_id, intent, status, plan, created_at
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          runId,
          "postgres-shadow-persistence-test",
          deterministicPlan.intent,
          "completed",
          JSON.stringify(deterministicPlan),
          createdAt
        ]
      );
      await new PostgresShadowEvaluationRepository(
        firstExecutor
      ).append(rerankerEvaluation);
      await new PostgresPlannerShadowRepository(
        firstExecutor
      ).append(plannerEvaluation);

      await database.close();
      database = undefined;
      database = new PGlite(databaseDirectory);
      const secondExecutor = new PGliteExecutor(database);
      const storedReranker = await new PostgresShadowEvaluationRepository(
        secondExecutor
      ).list();
      const storedPlanner = await new PostgresPlannerShadowRepository(
        secondExecutor
      ).findByRunId(runId);

      expect(storedReranker).toEqual([rerankerEvaluation]);
      expect(storedPlanner).toEqual(plannerEvaluation);
    } finally {
      try {
        await database?.close();
      } finally {
        await rm(databaseDirectory, {
          recursive: true,
          force: true
        });
      }
    }
  }, 30_000);
});
