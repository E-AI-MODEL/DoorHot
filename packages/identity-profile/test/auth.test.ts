import { describe, expect, it } from "vitest";
import {
  AuthService,
  AuthorizationService,
  HmacTokenService,
  InMemoryProfileRepository,
  InMemoryUserAccountRepository,
  InMemoryUserRoleRepository,
  PasswordHasher
} from "../src/index.js";

describe("AuthService", () => {
  it("registers, hashes passwords and issues a verifiable session", async () => {
    const tokenService = new HmacTokenService(
      "12345678901234567890123456789012"
    );
    const service = new AuthService(
      new InMemoryUserAccountRepository(),
      new InMemoryUserRoleRepository(),
      new InMemoryProfileRepository(),
      new PasswordHasher(),
      tokenService
    );

    const session = await service.register({
      email: "Test@Example.nl",
      password: "sterk-wachtwoord-123"
    });

    expect(session.user.email).toBe("test@example.nl");
    expect(session.user.roles).toEqual(["candidate"]);
    expect(tokenService.verify(session.accessToken).sub)
      .toBe(session.user.id);
  });
});

describe("AuthorizationService", () => {
  it("allows self access and blocks unrelated candidates", () => {
    const service = new AuthorizationService();
    const claims = {
      sub: "user-1",
      email: "test@example.nl",
      roles: ["candidate"] as const,
      exp: Math.floor(Date.now() / 1000) + 100
    };

    expect(
      service.requireSelfOrRole(claims, "user-1", ["administrator"]).sub
    ).toBe("user-1");

    expect(() =>
      service.requireSelfOrRole(claims, "user-2", ["administrator"])
    ).toThrow("forbidden");
  });
});
