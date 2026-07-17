import { describe, expect, it, vi } from "vitest";
import { enforceOwnership } from "../src/security.js";

function replyMock() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
}

describe("ownership enforcement", () => {
  it("blocks a candidate from mutating another user", () => {
    const reply = replyMock();
    const request = {
      auth: {
        sub: "11111111-1111-4111-8111-111111111111",
        email: "candidate@example.nl",
        roles: ["candidate"],
        exp: 4_102_444_800
      },
      params: {
        userId: "22222222-2222-4222-8222-222222222222"
      },
      body: {},
      query: {},
      routeOptions: {
        url: "/v1/profiles/:userId"
      }
    };

    expect(
      enforceOwnership(request as never, reply as never)
    ).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it("allows an administrator to inspect another user", () => {
    const reply = replyMock();
    const request = {
      auth: {
        sub: "11111111-1111-4111-8111-111111111111",
        email: "admin@example.nl",
        roles: ["administrator"],
        exp: 4_102_444_800
      },
      params: {
        userId: "22222222-2222-4222-8222-222222222222"
      },
      body: {},
      query: {},
      routeOptions: {
        url: "/v1/profiles/:userId"
      }
    };

    expect(
      enforceOwnership(request as never, reply as never)
    ).toBe(true);
  });
});
