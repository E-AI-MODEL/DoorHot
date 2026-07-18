import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createApplicationServices } from "../src/bootstrap.js";
import { PUBLIC_DEMO_ACCOUNTS } from "../src/demo-accounts.js";

describe("createApplicationServices", () => {
  it("loads all datasets and wires both coaches", async () => {
    const services = await createApplicationServices(
      resolve(process.cwd(), "../../datasets")
    );

    const candidateSession = await services.auth.login(
      PUBLIC_DEMO_ACCOUNTS.candidate
    );
    const administratorSession = await services.auth.login(
      PUBLIC_DEMO_ACCOUNTS.administrator
    );

    const general = await services.generalCoach.respond({
      message: "Hoe word ik leraar?"
    });
    const personal = await services.personalCoach.respond({
      userId: candidateSession.user.id,
      message: "Welke stap kan ik nu zetten?"
    });

    expect(general.chatbotKey).toBe("general-coach");
    expect(personal.chatbotKey).toBe("personal-journey-coach");
    expect(candidateSession.user.roles).toEqual(["candidate"]);
    expect(administratorSession.user.roles).toEqual(["administrator"]);
    expect(services.datasetsDirectory).toContain("datasets");
  });

  it("does not seed public accounts when they are disabled", async () => {
    const services = await createApplicationServices(
      resolve(process.cwd(), "../../datasets"),
      { seedDemoAccounts: false }
    );

    await expect(
      services.auth.login(PUBLIC_DEMO_ACCOUNTS.administrator)
    ).rejects.toThrow("invalid_credentials");
  });
});
