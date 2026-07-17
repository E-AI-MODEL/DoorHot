import { describe, expect, it } from "vitest";
import {
  InMemoryPhaseSystemPreferenceRepository,
  PhaseSystemPreferenceResolver
} from "../src/index.js";

describe("PhaseSystemPreferenceResolver", () => {
  it("uses conversation before user and organization", async () => {
    const repository =
      new InMemoryPhaseSystemPreferenceRepository([
        {
          scope: "organization",
          scopeId: "org-1",
          phaseSystemKey: "phase-9",
          enabled: true,
          updatedAt: "2026-01-01T00:00:00.000Z"
        },
        {
          scope: "user",
          scopeId: "user-1",
          phaseSystemKey: "phase-4",
          enabled: true,
          updatedAt: "2026-01-01T00:00:00.000Z"
        },
        {
          scope: "conversation",
          scopeId: "conversation-1",
          phaseSystemKey: "phase-5",
          enabled: true,
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]);

    const resolver = new PhaseSystemPreferenceResolver(repository);
    const result = await resolver.resolve({
      organizationId: "org-1",
      userId: "user-1",
      conversationId: "conversation-1"
    });

    expect(result.phaseSystemKey).toBe("phase-5");
    expect(result.source).toBe("conversation");
  });

  it("falls back to the configured default", async () => {
    const resolver = new PhaseSystemPreferenceResolver(
      new InMemoryPhaseSystemPreferenceRepository(),
      "phase-4"
    );

    const result = await resolver.resolve({});

    expect(result.phaseSystemKey).toBe("phase-4");
    expect(result.source).toBe("default");
  });
});
