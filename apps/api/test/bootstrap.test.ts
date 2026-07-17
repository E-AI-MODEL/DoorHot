import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { createApplicationServices } from "../src/bootstrap.js";

describe("createApplicationServices", () => {
  it("loads all datasets and wires both coaches", async () => {
    const services = await createApplicationServices(
      resolve(process.cwd(), "../../datasets")
    );

    const general = await services.generalCoach.respond({
      message: "Hoe word ik leraar?"
    });

    expect(general.chatbotKey).toBe("general-coach");
    expect(services.datasetsDirectory).toContain("datasets");
  });
});
