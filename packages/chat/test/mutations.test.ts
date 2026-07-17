import { describe, expect, it } from "vitest";
import {
  InMemoryChatContextProvider,
  InMemoryPendingMutationStore,
  MutationApplicationService
} from "../src/index.js";

describe("MutationApplicationService", () => {
  it("applies an accepted profile-slot mutation", async () => {
    const contexts = new InMemoryChatContextProvider();
    await contexts.getContext({
      message: "",
      userId: "user-1"
    });

    const store = new InMemoryPendingMutationStore();
    const pending = await store.create({
      userId: "user-1",
      profileId: "user-1",
      mutation: {
        type: "profile-slot",
        requiresConfirmation: true,
        payload: {
          slotKey: "school_type",
          value: "po"
        }
      }
    });

    const service = new MutationApplicationService(
      store,
      contexts
    );
    const resolved = await service.resolve({
      mutationId: pending.id,
      decision: "accept",
      userId: "user-1"
    });

    expect(resolved.status).toBe("accepted");
    const context = await contexts.getContext({
      message: "",
      userId: "user-1"
    });
    expect(context.slots[0]?.value).toBe("po");
  });

  it("does not apply a rejected mutation", async () => {
    const contexts = new InMemoryChatContextProvider();
    await contexts.getContext({
      message: "",
      userId: "user-1"
    });

    const store = new InMemoryPendingMutationStore();
    const pending = await store.create({
      userId: "user-1",
      profileId: "user-1",
      mutation: {
        type: "profile-slot",
        requiresConfirmation: true,
        payload: {
          slotKey: "school_type",
          value: "vo"
        }
      }
    });

    const service = new MutationApplicationService(
      store,
      contexts
    );
    const resolved = await service.resolve({
      mutationId: pending.id,
      decision: "reject",
      userId: "user-1"
    });

    expect(resolved.status).toBe("rejected");
    const context = await contexts.getContext({
      message: "",
      userId: "user-1"
    });
    expect(context.slots).toHaveLength(0);
  });
});
