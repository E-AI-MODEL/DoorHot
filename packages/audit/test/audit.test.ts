import { describe, expect, it } from "vitest";
import {
  AuditService,
  InMemoryAuditEventRepository
} from "../src/index.js";

describe("AuditService", () => {
  it("records and filters immutable audit events", async () => {
    const service = new AuditService(
      new InMemoryAuditEventRepository()
    );

    await service.record({
      actorUserId: "user-1",
      action: "profile.updated",
      targetType: "profile",
      targetId: "user-1",
      metadata: { fields: ["firstName"] }
    });

    const events = await service.list({
      action: "profile.updated"
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.actorUserId).toBe("user-1");
  });
});
