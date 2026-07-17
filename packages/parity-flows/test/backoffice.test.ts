import { describe, expect, it } from "vitest";
import { BackofficeService } from "../src/index.js";

describe("BackofficeService", () => {
  it("stores advisor notes and validates appointments", () => {
    const service = new BackofficeService();
    service.addNote({
      candidateUserId: "candidate-1",
      advisorUserId: "advisor-1",
      content: "Bel terug."
    });

    expect(service.listNotes("candidate-1")).toHaveLength(1);
    expect(() =>
      service.scheduleAppointment({
        candidateUserId: "candidate-1",
        advisorUserId: "advisor-1",
        subject: "Gesprek",
        startsAt: "2027-01-02T11:00:00.000Z",
        endsAt: "2027-01-02T10:00:00.000Z",
        timezone: "Europe/Amsterdam",
        status: "confirmed"
      })
    ).toThrow("appointment_end_must_follow_start");
  });
});
