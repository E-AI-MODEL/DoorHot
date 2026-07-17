import { describe, expect, it } from "vitest";
import {
  InMemoryObjectStorage,
  InMemoryProfileRepository,
  InMemoryUserNoteRepository,
  ProfileService
} from "../src/index.js";

describe("ProfileService", () => {
  it("updates profiles, stores notes and validates uploads", async () => {
    const profiles = new InMemoryProfileRepository();
    const now = new Date().toISOString();
    await profiles.create({
      id: "profile-1",
      userId: "user-1",
      knownSlots: {},
      testCompleted: false,
      createdAt: now,
      updatedAt: now
    });

    const service = new ProfileService(
      profiles,
      new InMemoryUserNoteRepository(),
      new InMemoryObjectStorage()
    );

    const updated = await service.update("user-1", {
      firstName: "Sam",
      preferredSector: "VO"
    });
    expect(updated.firstName).toBe("Sam");

    const note = await service.createNote("user-1", {
      title: "Mijn doel",
      content: "Docent worden"
    });
    expect(note.title).toBe("Mijn doel");

    await expect(
      service.uploadFile({
        userId: "user-1",
        kind: "cv",
        originalFilename: "cv.exe",
        mimeType: "application/octet-stream",
        content: new Uint8Array([1])
      })
    ).rejects.toThrow("unsupported_file_type");
  });
});
