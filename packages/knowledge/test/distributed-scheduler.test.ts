import { describe, expect, it } from "vitest";
import {
  DistributedConnectorScheduler,
  InMemoryConnectorLeaseRepository,
  InMemoryConnectorRepository,
  InMemoryKnowledgeRepository,
  KnowledgeConnectorService
} from "../src/index.js";

describe("distributed connector scheduler", () => {
  it("prevents two owners from holding the same lease", async () => {
    const leases = new InMemoryConnectorLeaseRepository();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const first = await leases.acquire({
      connectorId: "11111111-1111-4111-8111-111111111111",
      ownerId: "owner-a",
      now,
      expiresAt
    });
    const second = await leases.acquire({
      connectorId: "11111111-1111-4111-8111-111111111111",
      ownerId: "owner-b",
      now,
      expiresAt
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("archives records missing from a full snapshot", async () => {
    const repository = new InMemoryConnectorRepository();
    const knowledge = new InMemoryKnowledgeRepository();
    const service = new KnowledgeConnectorService(
      repository,
      knowledge
    );
    const now = new Date().toISOString();
    const connector = {
      id: "22222222-2222-4222-8222-222222222222",
      connectorKey: "snapshot-test",
      connectorType: "json" as const,
      label: "Snapshot test",
      enabled: true,
      snapshotMode: true,
      configuration: {
        entityType: "vacancy",
        records: [
          {
            id: "vacancy-1",
            title: "Docent",
            body: "Vacature"
          },
          {
            id: "vacancy-2",
            title: "Leraar",
            body: "Vacature"
          }
        ]
      },
      createdAt: now,
      updatedAt: now
    };

    await repository.upsert(connector);
    await service.synchronize(connector.connectorKey);

    await repository.upsert({
      ...connector,
      configuration: {
        ...connector.configuration,
        records: [
          {
            id: "vacancy-1",
            title: "Docent",
            body: "Vacature"
          }
        ]
      },
      updatedAt: new Date().toISOString()
    });

    const second = await service.synchronize(connector.connectorKey);
    const archived = await knowledge.list({
      reviewStatus: "archived",
      limit: 10
    });

    expect(second.removedCount).toBe(1);
    expect(archived).toHaveLength(1);
    expect(archived[0]?.externalId).toBe("vacancy-2");
  });

  it("registers schedules with a distributed lease repository", async () => {
    const repository = new InMemoryConnectorRepository();
    const knowledge = new InMemoryKnowledgeRepository();
    const service = new KnowledgeConnectorService(
      repository,
      knowledge
    );
    const leases = new InMemoryConnectorLeaseRepository();
    const now = new Date().toISOString();

    await repository.upsert({
      id: "33333333-3333-4333-8333-333333333333",
      connectorKey: "scheduled",
      connectorType: "json",
      label: "Scheduled",
      enabled: true,
      scheduleCron: "every:1h",
      configuration: {
        records: [{
          id: "1",
          title: "Titel",
          body: "Body"
        }]
      },
      createdAt: now,
      updatedAt: now
    });

    const scheduler = new DistributedConnectorScheduler(
      repository,
      service,
      leases,
      "test-owner",
      30_000
    );
    await scheduler.start();

    expect(scheduler.activeScheduleCount).toBe(1);
    scheduler.stop();
  });
});
