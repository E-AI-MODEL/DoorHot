import { describe, expect, it } from "vitest";
import type {
  SqlExecutor,
  SqlQueryResult
} from "@door010/database";
import {
  PostgresRouteSessionRepository,
  PostgresVacancyService
} from "../src/index.js";
import {
  InMemoryVacancyProvider
} from "@door010/parity-flows";

class RecordingExecutor implements SqlExecutor {
  readonly calls: Array<{
    sql: string;
    parameters: readonly unknown[];
  }> = [];

  async query<Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<SqlQueryResult<Row>> {
    this.calls.push({ sql, parameters });

    if (sql.includes("FROM vacancies WHERE id")) {
      return {
        rows: [
          {
            id: "vacancy-1",
            external_id: null,
            title: "Docent",
            organization: "School",
            sector: "VO",
            location: "Rotterdam",
            description: null,
            url: null,
            source_name: null,
            published_at: null,
            expires_at: null,
            retrieved_at: "2026-01-01T00:00:00.000Z"
          } as Row
        ],
        rowCount: 1
      };
    }

    return { rows: [], rowCount: 1 };
  }
}

describe("PostgresRouteSessionRepository", () => {
  it("uses an upsert so sessions survive multiple API instances", async () => {
    const executor = new RecordingExecutor();
    const repository = new PostgresRouteSessionRepository(executor);

    await repository.save({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      selectedAnswerIds: ["answer-1"],
      result: {
        selections: [],
        completed: false,
        matchedRoutes: []
      },
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(executor.calls[0]?.sql).toContain("ON CONFLICT (id)");
  });
});

describe("PostgresVacancyService", () => {
  it("persists saved vacancies through the SQL executor", async () => {
    const executor = new RecordingExecutor();
    const service = new PostgresVacancyService(
      executor,
      new InMemoryVacancyProvider([])
    );

    await service.save(
      "22222222-2222-4222-8222-222222222222",
      "vacancy-1",
      "Interessant"
    );

    expect(
      executor.calls.some((call) =>
        call.sql.includes("INSERT INTO saved_vacancies")
      )
    ).toBe(true);
  });
});
