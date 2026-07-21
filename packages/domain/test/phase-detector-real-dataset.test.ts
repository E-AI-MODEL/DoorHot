import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PhaseDetector, loadDomainDatasets } from "../src/index.js";

// Regression guard for the Phase Detector data contract. The real
// phase-detector-questions.json stores slot_to_questions and
// phase_to_questions as objects ({ question_id, question_text | reason }),
// but the loader used to cast them straight to string[]. The detector then
// took element [0] - an object - and used it as a question_catalog key,
// every lookup missed, and it fell back to the global first catalog entry
// (a route-choice question about mbo vs po) for every intake turn. This
// test drives the detector against the *real* dataset, so it fails if that
// object-vs-string mismatch ever returns.
const datasetsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../datasets"
);

describe("PhaseDetector on the real dataset", () => {
  it("selects a real slot question instead of the global fallback", async () => {
    const { phaseRules, phaseQuestions } =
      await loadDomainDatasets(datasetsDir);

    const detector = new PhaseDetector(phaseRules, phaseQuestions);
    const result = detector.evaluate({ knownSlots: [] });

    // It must not fall back to the global first catalog question.
    expect(result.fallbackUsed).toBe(false);
    expect(result.debug.questionSelectionReason).not.toBe(
      "global-fallback"
    );

    // The chosen id must be a real catalog entry, and the returned text
    // must match that entry (proving the id resolved, not "[object Object]").
    expect(phaseQuestions.question_catalog).toHaveProperty(
      result.nextQuestionId
    );
    expect(result.nextQuestion).toBe(
      phaseQuestions.question_catalog[result.nextQuestionId].question_text
    );

    // With no known slots the default phase's first missing slot drives the
    // question. Lock the concrete expected question from the real dataset.
    expect(result.debug.questionSelectionReason).toBe(
      "missing-optional-slot"
    );
    expect(result.nextSlotKey).toBe("role_interest");
    expect(result.nextQuestionId).toBe("S00002");
    expect(result.nextQuestion).toContain("interesse het meest");

    // And explicitly not the global fallback route-choice question.
    expect(result.nextQuestion).not.toContain("mbo en po");
  });
});
