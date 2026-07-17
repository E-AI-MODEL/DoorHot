import { describe, expect, it } from "vitest";
import {
  InMemoryPromptRepository,
  PromptManagementService,
  RepositoryActivePromptProvider
} from "../src/index.js";

describe("PromptManagementService", () => {
  it("creates versions and activates the selected version", async () => {
    const service = new PromptManagementService(
      new InMemoryPromptRepository()
    );

    const config = await service.create({
      chatbotKey: "general-coach",
      configKey: "default",
      title: "Algemene coach",
      systemPrompt:
        "Geef duidelijke antwoorden op basis van gecontroleerde bronnen.",
      createdByUserId: "admin-1"
    });

    const version = await service.createVersion({
      promptConfigId: config.id,
      systemPrompt:
        "Geef korte en duidelijke antwoorden met bronvermelding waar nodig.",
      createdByUserId: "admin-1"
    });

    const activated = await service.activateVersion({
      promptConfigId: config.id,
      version: version.version
    });

    expect(activated.activeVersion).toBe(2);
    expect(
      activated.versions.find((item) => item.version === 2)?.status
    ).toBe("approved");
  });

  it("exposes only the approved active prompt to coach providers", async () => {
    const repository = new InMemoryPromptRepository();
    const service = new PromptManagementService(repository);
    const provider = new RepositoryActivePromptProvider(repository);

    const config = await service.create({
      chatbotKey: "general-coach",
      configKey: "default",
      title: "Algemene coach",
      systemPrompt:
        "Gebruik alleen gecontroleerde bronnen en geef een direct antwoord.",
      createdByUserId: "admin-1"
    });

    await service.createVersion({
      promptConfigId: config.id,
      systemPrompt:
        "Deze conceptversie mag nog niet actief gebruikt worden.",
      createdByUserId: "admin-1"
    });

    expect(
      await provider.getActivePrompt("general-coach")
    ).toContain("gecontroleerde bronnen");
  });

});
