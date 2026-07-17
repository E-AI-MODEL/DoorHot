import { describe, expect, it } from "vitest";
import { BackofficeService } from "../src/index.js";

describe("Backoffice insights", () => {
  it("derives alerts, statistics and candidate detail", () => {
    const service = new BackofficeService();
    service.upsertCandidate({
      userId: "user-1",
      displayName: "Sam Kandidaat",
      lastDetectorConfidence: 0.35
    });

    const alerts = service.listAlerts();
    const statistics = service.getStatistics();
    const detail = service.getCandidateDetail("user-1");

    expect(alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining([
        "missing_phase",
        "low_phase_confidence",
        "missing_route"
      ])
    );
    expect(statistics.totalCandidates).toBe(1);
    expect(statistics.lowConfidenceCandidates).toBe(1);
    expect(detail.candidate.displayName).toBe("Sam Kandidaat");
  });
});
