import { describe, expect, it } from "vitest";
import {
  CsvKnowledgeConnector,
  InMemoryConnectorRepository,
  InMemoryKnowledgeRepository,
  JsonKnowledgeConnector,
  KnowledgeConnectorService
} from "../src/index.js";

describe("knowledge connector framework", () => {
  it("ingests JSON and detects unchanged records", async () => {
    const repository = new InMemoryConnectorRepository();
    const knowledge = new InMemoryKnowledgeRepository();
    const service = new KnowledgeConnectorService(
      repository,
      knowledge
    );
    const now = new Date().toISOString();

    await repository.upsert({
      id: "11111111-1111-4111-8111-111111111111",
      connectorKey: "test-json",
      connectorType: "json",
      label: "Test JSON",
      enabled: true,
      configuration: {
        entityType: "education",
        records: [{
          id: "opleiding-1",
          title: "Pabo",
          body: "Opleiding tot leraar basisonderwijs.",
          tags: ["pabo", "basisonderwijs"]
        }]
      },
      createdAt: now,
      updatedAt: now
    });

    const first = await service.synchronize("test-json");
    const second = await service.synchronize("test-json");
    const items = await knowledge.list({ limit: 10 });

    expect(first.status).toBe("succeeded");
    expect(first.insertedCount).toBe(1);
    expect(second.unchangedCount).toBe(1);
    expect(items[0]?.tags).toContain("entity-type:education");
  });

  it("parses quoted CSV fields", async () => {
    const connector = new CsvKnowledgeConnector();
    const now = new Date().toISOString();
    const definition = {
      id: "22222222-2222-4222-8222-222222222222",
      connectorKey: "test-csv",
      connectorType: "csv" as const,
      label: "Test CSV",
      enabled: true,
      configuration: {
        entityType: "subsidy",
        csv: [
          "id,title,body",
          'subsidy-1,"SOOL subsidie","Vergoeding, voor opleiding"'
        ].join("\n")
      },
      createdAt: now,
      updatedAt: now
    };

    const rows = await connector.fetch(definition);
    const normalized = connector.normalize(rows[0], definition);

    expect(normalized.title).toBe("SOOL subsidie");
    expect(normalized.body).toBe("Vergoeding, voor opleiding");
    expect(normalized.entityType).toBe("subsidy");
  });

  it("fails clearly for malformed JSON records", () => {
    const connector = new JsonKnowledgeConnector();
    const now = new Date().toISOString();
    const definition = {
      id: "33333333-3333-4333-8333-333333333333",
      connectorKey: "bad-json",
      connectorType: "json" as const,
      label: "Bad JSON",
      enabled: true,
      configuration: {},
      createdAt: now,
      updatedAt: now
    };

    expect(() =>
      connector.normalize({ title: "Zonder body" }, definition)
    ).toThrow("json_connector_required_fields_missing");
  });
});
