import { describe, expect, it } from "vitest";
import {
  InAppNotificationDeliveryProvider,
  InMemoryExecutionRepository,
  NotificationDeliveryWorker,
  SafeExecutionService
} from "../src/index.js";

describe("safe execution tools", () => {
  it("requires a valid confirmation before queueing", async () => {
    const repository = new InMemoryExecutionRepository();
    const service = new SafeExecutionService(repository, 60_000);
    const userId =
      "33333333-3333-4333-8333-333333333333";

    const proposal = await service.propose({
      userId,
      toolKey: "reminder.schedule",
      payload: {
        message: "Bel het Onderwijsloket",
        remindAt: "2026-08-01T09:00:00.000Z",
        channel: "in_app"
      }
    });

    await expect(
      service.confirm({
        requestId: proposal.request.id,
        userId,
        token: "ongeldig-token-dat-lang-genoeg-is",
        decision: "approve"
      })
    ).rejects.toThrow("execution_confirmation_invalid");

    const approved = await service.confirm({
      requestId: proposal.request.id,
      userId,
      token: proposal.confirmationToken,
      decision: "approve"
    });
    const outbox = await repository.listOutbox("queued");

    expect(approved.status).toBe("executed");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.body).toBe("Bel het Onderwijsloket");
  });

  it("supports explicit rejection without outbox delivery", async () => {
    const repository = new InMemoryExecutionRepository();
    const service = new SafeExecutionService(repository);
    const userId =
      "44444444-4444-4444-8444-444444444444";
    const proposal = await service.propose({
      userId,
      toolKey: "notification.queue",
      payload: {
        body: "Melding"
      }
    });

    const rejected = await service.confirm({
      requestId: proposal.request.id,
      userId,
      token: proposal.confirmationToken,
      decision: "reject"
    });

    expect(rejected.status).toBe("rejected");
    expect(await repository.listOutbox()).toHaveLength(0);
  });

it("delivers due in-app notifications through the worker", async () => {
  const repository = new InMemoryExecutionRepository();
  const service = new SafeExecutionService(repository);
  const userId =
    "66666666-6666-4666-8666-666666666666";
  const proposal = await service.propose({
    userId,
    toolKey: "notification.queue",
    payload: {
      body: "Je afspraak begint binnenkort.",
      deliverAt: "2026-01-01T00:00:00.000Z",
      channel: "in_app"
    }
  });
  await service.confirm({
    requestId: proposal.request.id,
    userId,
    token: proposal.confirmationToken,
    decision: "approve"
  });

  const worker = new NotificationDeliveryWorker(
    repository,
    [new InAppNotificationDeliveryProvider()]
  );
  const result = await worker.processDue(
    new Date("2026-07-01T00:00:00.000Z")
  );
  const delivered = await repository.listOutbox("delivered");

  expect(result.delivered).toBe(1);
  expect(delivered[0]?.body).toBe(
    "Je afspraak begint binnenkort."
  );
});

it("marks missing delivery providers as failed", async () => {
  const repository = new InMemoryExecutionRepository();
  const service = new SafeExecutionService(repository);
  const userId =
    "77777777-7777-4777-8777-777777777777";
  const proposal = await service.propose({
    userId,
    toolKey: "notification.queue",
    payload: {
      body: "Webhookmelding",
      deliverAt: "2026-01-01T00:00:00.000Z",
      channel: "webhook"
    }
  });
  await service.confirm({
    requestId: proposal.request.id,
    userId,
    token: proposal.confirmationToken,
    decision: "approve"
  });

  const worker = new NotificationDeliveryWorker(
    repository,
    []
  );
  const result = await worker.processDue(
    new Date("2026-07-01T00:00:00.000Z")
  );
  const failed = await repository.listOutbox("failed");

  expect(result.failed).toBe(1);
  expect(failed[0]?.lastError).toBe(
    "delivery_provider_missing"
  );
});

});
