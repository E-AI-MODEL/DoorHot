import { describe, expect, it } from "vitest";
import {
  PostgresPhaseSystemPreferenceRepository,
  type SqlExecutor,
  type SqlQueryResult
} from "../src/index.js";

class RecordingExecutor implements SqlExecutor {
  calls: Array<{
    sql: string;
    parameters: readonly unknown[];
  }> = [];

  async query<Row>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push({ sql, parameters });
    return { rows: [], rowCount: 0 };
  }
}

describe("PostgresPhaseSystemPreferenceRepository", () => {
  it("uses an upsert keyed by scope and scope id", async () => {
    const executor = new RecordingExecutor();
    const repository =
      new PostgresPhaseSystemPreferenceRepository(executor);

    await repository.upsert({
      scope: "organization",
      scopeId: "org-1",
      phaseSystemKey: "phase-9",
      enabled: true,
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(executor.calls[0]?.sql).toContain(
      "ON CONFLICT (scope, scope_id)"
    );
    expect(executor.calls[0]?.parameters).toEqual([
      "organization",
      "org-1",
      "phase-9",
      true,
      "2026-01-01T00:00:00.000Z"
    ]);
  });
});
