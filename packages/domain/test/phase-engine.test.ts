import { describe, expect, it } from "vitest";
import {
  PhaseDetector,
  type PhaseQuestionDataset,
  type PhaseRulesDataset,
  type ProfileSlot
} from "../src/index.js";

const rules: PhaseRulesDataset = {
  schema_version: "1.0.0",
  generated_at: "2026-02-12T00:00:00Z",
  audience: "zij-instromer",
  slots: {},
  classification: {
    allowed_phase_codes: ["interesse", "orientatie"],
    policy: {}
  },
  phases: [
    {
      code: "interesse",
      title: "Interesseren",
      description: "",
      sort: 1,
      required_slots: [],
      optional_slots: ["school_type"],
      exit_criteria: [
        {
          type: "intent",
          intent: "wants_orientation_info"
        }
      ],
      next_phase_default: "orientatie"
    },
    {
      code: "orientatie",
      title: "Oriënteren",
      description: "",
      sort: 2,
      required_slots: ["school_type", "credential_goal"],
      optional_slots: ["region_preference"],
      exit_criteria: [
        {
          type: "slots_present",
          slots: ["school_type", "credential_goal"]
        }
      ]
    }
  ]
};

const questions: PhaseQuestionDataset = {
  schema_version: "1.0.0",
  generated_at: "2026-02-12T00:00:00Z",
  slots: {},
  slot_to_questions: {
    school_type: ["S00001"],
    credential_goal: ["S00003"],
    region_preference: ["S00008"]
  },
  phase_to_questions: {
    interesse: ["S00000"],
    orientatie: ["S00001", "S00003"]
  },
  question_catalog: {
    S00000: {
      question_id: "S00000",
      question_text: "Waar ben je naar op zoek?",
      phase_code: "interesse",
      fills_slots: []
    },
    S00001: {
      question_id: "S00001",
      question_text: "Welke sector bedoel je: PO, VO of MBO?",
      phase_code: "orientatie",
      fills_slots: ["school_type"]
    },
    S00003: {
      question_id: "S00003",
      question_text: "Welke bevoegdheid wil je halen?",
      phase_code: "orientatie",
      fills_slots: ["credential_goal"]
    },
    S00008: {
      question_id: "S00008",
      question_text: "Welke regio heeft je voorkeur?",
      phase_code: "orientatie",
      fills_slots: ["region_preference"]
    }
  }
};

describe("PhaseDetector", () => {
  it("always returns a valid SSOT question", () => {
    const result = new PhaseDetector(rules, questions).evaluate({
      knownSlots: [],
      currentPhaseKey: "orientatie"
    });

    expect(result.nextQuestionId).toBe("S00001");
    expect(result.nextQuestion).toBe(
      "Welke sector bedoel je: PO, VO of MBO?"
    );
  });

  it("rejects an invalid model-proposed next slot", () => {
    const result = new PhaseDetector(rules, questions).evaluate({
      knownSlots: [],
      modelSuggestion: {
        phaseCurrent: "orientatie",
        confidence: 0.9,
        nextSlotKey: "invented_slot"
      }
    });

    expect(result.nextSlotKey).toBe("school_type");
    expect(result.debug.modelSuggestionAccepted).toBe(true);
  });

  it("uses deterministic fallback for low model confidence", () => {
    const result = new PhaseDetector(rules, questions).evaluate({
      knownSlots: [],
      modelSuggestion: {
        phaseCurrent: "orientatie",
        confidence: 0.2,
        nextSlotKey: "credential_goal"
      }
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.nextSlotKey).toBe("school_type");
  });

  it("selects an optional-slot question when required slots are complete", () => {
    const slots: ProfileSlot[] = [
      {
        key: "school_type",
        value: "po",
        confidence: 1,
        source: "user",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      {
        key: "credential_goal",
        value: "pabo",
        confidence: 1,
        source: "user",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ];

    const result = new PhaseDetector(rules, questions).evaluate({
      knownSlots: slots,
      currentPhaseKey: "orientatie"
    });

    expect(result.debug.questionSelectionReason).toBe(
      "missing-optional-slot"
    );
  });

  it("proposes a next phase without applying it", () => {
    const result = new PhaseDetector(rules, questions).evaluate({
      knownSlots: [],
      currentPhaseKey: "interesse",
      detectedIntents: ["wants_orientation_info"]
    });

    expect(result.nextPhaseTarget).toBe("orientatie");
    expect(result.phaseCurrent).toBe("interesse");
  });
});
