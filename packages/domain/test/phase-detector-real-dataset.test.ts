import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AdaptivePhaseDetector,
  InMemoryPhaseSystemPreferenceRepository,
  PhaseDetector,
  PhaseSystemPreferenceResolver,
  PhaseSystemRegistry,
  loadDomainDatasets,
  normalizePhaseQuestionDataset,
  type PhaseQuestionDataset,
  type PhaseSystemDefinition,
  type ProfileSlot
} from "../src/index.js";

const datasetsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../datasets"
);

function filledSlots(): ProfileSlot[] {
  return [
    "school_type",
    "role_interest",
    "credential_goal",
    "admission_requirements",
    "duration_info",
    "costs_info",
    "salary_info",
    "region_preference",
    "next_step"
  ].map((key) => ({
    key: key as ProfileSlot["key"],
    value: "bekend",
    confidence: 1,
    source: "user" as const,
    updatedAt: "2026-01-01T00:00:00.000Z"
  }));
}

describe("PhaseDetector on the real dataset", () => {
  it("normalizes every slot and phase reference to a valid catalog id", async () => {
    const { phaseQuestions } = await loadDomainDatasets(datasetsDir);

    const referenceMaps = [
      phaseQuestions.slot_to_questions,
      phaseQuestions.phase_to_questions
    ];

    for (const referenceMap of referenceMaps) {
      for (const ids of Object.values(referenceMap)) {
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
          expect(typeof id).toBe("string");
          expect(phaseQuestions.question_catalog).toHaveProperty(id);
        }
      }
    }
  });

  it("selects a real slot question instead of the global fallback", async () => {
    const { phaseRules, phaseQuestions } =
      await loadDomainDatasets(datasetsDir);
    const result = new PhaseDetector(phaseRules, phaseQuestions).evaluate({
      knownSlots: []
    });

    expect(result.debug.questionSelectionReason).toBe(
      "missing-optional-slot"
    );
    expect(result.nextSlotKey).toBe("role_interest");
    expect(result.nextQuestionId).toBe("S00002");
    expect(result.nextQuestion).toContain("interesse het meest");
    expect(phaseQuestions.question_catalog).toHaveProperty(
      result.nextQuestionId
    );
  });

  it("selects a valid phase question when all slots are filled", async () => {
    const { phaseRules, phaseQuestions } =
      await loadDomainDatasets(datasetsDir);
    const result = new PhaseDetector(phaseRules, phaseQuestions).evaluate({
      knownSlots: filledSlots(),
      currentPhaseKey: "orientatie"
    });

    expect(result.debug.questionSelectionReason).toBe("phase-question");
    expect(phaseQuestions.question_catalog).toHaveProperty(
      result.nextQuestionId
    );
    expect(result.nextQuestion).toBe(
      phaseQuestions.question_catalog[result.nextQuestionId].question_text
    );
  });

  it("never uses the structural global fallback for the real phase maps", async () => {
    const { phaseRules, phaseQuestions } =
      await loadDomainDatasets(datasetsDir);
    const detector = new PhaseDetector(phaseRules, phaseQuestions);

    for (const phase of phaseRules.classification.allowed_phase_codes) {
      for (const knownSlots of [[], filledSlots()]) {
        const result = detector.evaluate({
          knownSlots,
          currentPhaseKey: phase
        });

        expect(result.debug.questionSelectionReason).not.toBe(
          "global-fallback"
        );
        expect(phaseQuestions.question_catalog).toHaveProperty(
          result.nextQuestionId
        );
      }
    }
  });

  it("keeps the existing 4, 5 and 9 phase systems wired to valid questions", async () => {
    const datasets = await loadDomainDatasets(datasetsDir);
    const registry = new PhaseSystemRegistry(
      datasets.phaseSystems as unknown as readonly PhaseSystemDefinition[]
    );

    for (const system of datasets.phaseSystems) {
      const organizationId = `org-${system.system_key}`;
      const preferences = new InMemoryPhaseSystemPreferenceRepository([
        {
          scope: "organization",
          scopeId: organizationId,
          phaseSystemKey: system.system_key,
          enabled: true,
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]);
      const detector = new AdaptivePhaseDetector(
        datasets.phaseRules,
        datasets.phaseQuestions,
        registry,
        new PhaseSystemPreferenceResolver(preferences)
      );
      const firstPhase = system.phases[0];
      expect(firstPhase).toBeDefined();

      const result = await detector.evaluate({
        organizationId,
        currentPhaseCode: firstPhase!.code,
        knownSlots: []
      });

      expect(result.phaseSystem.phaseSystemKey).toBe(system.system_key);
      expect(datasets.phaseQuestions.question_catalog).toHaveProperty(
        result.nextQuestionId
      );
      expect(result.debug.questionSelectionReason).not.toBe(
        "global-fallback"
      );
    }
  });

  it("fails clearly when a reference is missing from question_catalog", () => {
    const raw = {
      schema_version: "1.0.0",
      generated_at: "2026-01-01T00:00:00.000Z",
      slots: ["school_type"],
      slot_to_questions: {
        school_type: [{ question_id: "MISSING" }]
      },
      phase_to_questions: {},
      question_catalog: {}
    };

    expect(() => normalizePhaseQuestionDataset(raw)).toThrow(
      "question_id 'MISSING' does not exist in question_catalog"
    );
  });

  it("keeps simple string fixtures backwards compatible", () => {
    const raw = {
      schema_version: "1.0.0",
      generated_at: "2026-01-01T00:00:00.000Z",
      slots: ["school_type"],
      slot_to_questions: { school_type: ["S1"] },
      phase_to_questions: { orientatie: ["S1"] },
      question_catalog: {
        S1: {
          question_id: "S1",
          question_text: "Welke sector bedoel je?",
          phase_code: "orientatie",
          fills_slots: ["school_type"]
        }
      }
    };

    const normalized: PhaseQuestionDataset =
      normalizePhaseQuestionDataset(raw);
    expect(normalized.slot_to_questions.school_type).toEqual(["S1"]);
    expect(normalized.phase_to_questions.orientatie).toEqual(["S1"]);
  });
});
