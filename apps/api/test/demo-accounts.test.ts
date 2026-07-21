import Fastify from "fastify";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registerAuthProfileRoutes } from "../src/auth-profile-routes.js";
import { createApplicationServices } from "../src/bootstrap.js";
import { PUBLIC_DEMO_ACCOUNTS } from "../src/demo-accounts.js";

describe("public demo account routes", () => {
  it("accepts both fixed logins and short registration passwords", async () => {
    const services = await createApplicationServices(
      resolve(process.cwd(), "../../datasets")
    );
    const server = Fastify();
    await registerAuthProfileRoutes(server, {
      auth: services.auth,
      authorization: services.authorization,
      profileService: services.profileService,
      tokenService: services.tokenService,
      demoLoginEnabled: true,
      minPasswordLength: 1
    });

    for (const account of Object.values(PUBLIC_DEMO_ACCOUNTS)) {
      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: account.email,
          password: account.password
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({
        email: account.email,
        roles: account.roles
      });
    }

    const registration = await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "kort-wachtwoord@doorai.nl",
        password: "kort"
      }
    });

    expect(registration.statusCode).toBe(200);
    await server.close();
  });

  it("keeps the full password policy outside demo mode", async () => {
    const services = await createApplicationServices(
      resolve(process.cwd(), "../../datasets"),
      { seedDemoAccounts: false }
    );
    const server = Fastify();
    await registerAuthProfileRoutes(server, {
      auth: services.auth,
      authorization: services.authorization,
      profileService: services.profileService,
      tokenService: services.tokenService,
      demoLoginEnabled: false,
      minPasswordLength: 12
    });

    const shortPassword = await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "echt@doorai.nl",
        password: "kort"
      }
    });
    expect(shortPassword.statusCode).toBe(400);

    const strongPassword = await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "echt@doorai.nl",
        password: "sterk-genoeg-wachtwoord"
      }
    });
    expect(strongPassword.statusCode).toBe(200);
    await server.close();
  });
});
