import { describe, expect, it } from "vitest";
import {
  ConnectorHealthService,
  ConnectorScheduler,
  DomainCatalogConnector,
  EnvironmentSecretResolver,
  InMemoryConnectorRepository,
  InMemoryKnowledgeRepository,
  KnowledgeConnectorService,
  RetryingKnowledgeConnector,
  SecretResolvingKnowledgeConnector,
  type ConnectorDefinition,
  type KnowledgeConnector
} from "../src/index.js";

function definition(
  overrides: Partial<ConnectorDefinition> = {}
): ConnectorDefinition {
  const now = new Date().toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    connectorKey: "test",
    connectorType: "http-json",
    label: "Test",
    enabled: true,
    configuration: {
      entityType: "education",
      url: "https://example.test/data"
    },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("connector runtime", () => {
  it("retries transient fetch failures", async () => {
    let attempts = 0;
    const inner: KnowledgeConnector = {
      connectorType: "json",
      async fetch() {
        attempts += 1;
        if (attempts < 3) throw new Error("temporary");
        return [{ id: "ok", title: "Titel", body: "Body" }];
      },
      normalize(record) {
        return record as never;
      }
    };
    const connector = new RetryingKnowledgeConnector(inner, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maximumDelayMs: 1
    });

    const records = await connector.fetch(
      definition({ connectorType: "json" })
    );

    expect(records).toHaveLength(1);
    expect(attempts).toBe(3);
  });

  it("resolves environment-backed secrets before fetch", async () => {
    process.env.CONNECTOR_TEST_TOKEN = "secret-value";
    let authorization = "";

    const inner: KnowledgeConnector = {
      connectorType: "http-json",
      async fetch(input) {
        authorization = String(
          (
            input.configuration.headers as
              | Record<string, unknown>
              | undefined
          )?.Authorization ?? ""
        );
        return [];
      },
      normalize() {
        throw new Error("not_used");
      }
    };

    const connector = new SecretResolvingKnowledgeConnector(
      inner,
      new EnvironmentSecretResolver()
    );

    await connector.fetch(definition({
      configuration: {
        url: "https://example.test/data",
        headers: {
          Authorization: "env:CONNECTOR_TEST_TOKEN"
        }
      }
    }));

    expect(authorization).toBe("secret-value");
    delete process.env.CONNECTOR_TEST_TOKEN;
  });

  it("normalizes domain catalogs", () => {
    const connector = new DomainCatalogConnector();
    const normalized = connector.normalize({
      id: "pabo-1",
      name: "Pabo Rotterdam",
      description: "Opleiding voor het basisonderwijs.",
      institution: "Hogeschool Rotterdam",
      level: "hbo"
    }, definition());

    expect(normalized.entityType).toBe("education");
    expect(normalized.title).toBe("Pabo Rotterdam");
    expect(normalized.tags).toContain(
      "institution:Hogeschool Rotterdam"
    );
  });

  it("reports health and registers schedules", async () => {
    const repository = new InMemoryConnectorRepository();
    const knowledge = new InMemoryKnowledgeRepository();
    const service = new KnowledgeConnectorService(
      repository,
      knowledge
    );
    const scheduled = definition({
      connectorType: "json",
      scheduleCron: "every:1h",
      configuration: {
        records: [{
          id: "faq-1",
          title: "Vraag",
          body: "Antwoord"
        }]
      }
    });

    await repository.upsert(scheduled);
    await service.synchronize(scheduled.connectorKey);

    const health = await new ConnectorHealthService(
      repository
    ).summarize();
    const scheduler = new ConnectorScheduler(
      repository,
      service
    );
    await scheduler.start();

    expect(health[0]?.status).toBe("healthy");
    expect(scheduler.activeScheduleCount).toBe(1);
    scheduler.stop();
  });
});
