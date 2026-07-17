import { describe, expect, it } from "vitest";
import {
  AdaptivePhaseDetector,
  InMemoryPhaseSystemPreferenceRepository,
  PhaseSystemPreferenceResolver,
  PhaseSystemRegistry,
  type PhaseQuestionDataset,
  type PhaseRulesDataset,
  type PhaseSystemDefinition
} from "../src/index.js";

const rules: PhaseRulesDataset = {
  schema_version: "1.0.0",
  generated_at: "2026-01-01T00:00:00.000Z",
  audience: "zij-instromer",
  slots: {},
  classification: {
    allowed_phase_codes: [
      "interesse",
      "orientatie",
      "beslissing",
      "matching",
      "voorbereiding"
    ],
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
      exit_criteria: [],
      next_phase_default: "orientatie"
    },
    {
      code: "orientatie",
      title: "Oriënteren",
      description: "",
      sort: 2,
      required_slots: ["school_type"],
      optional_slots: [],
      exit_criteria: [],
      next_phase_default: "beslissing"
    },
    {
      code: "beslissing",
      title: "Beslissen",
      description: "",
      sort: 3,
      required_slots: [],
      optional_slots: [],
      exit_criteria: [],
      next_phase_default: "matching"
    },
    {
      code: "matching",
      title: "Matchen",
      description: "",
      sort: 4,
      required_slots: [],
      optional_slots: [],
      exit_criteria: [],
      next_phase_default: "voorbereiding"
    },
    {
      code: "voorbereiding",
      title: "Voorbereiden",
      description: "",
      sort: 5,
      required_slots: [],
      optional_slots: [],
      exit_criteria: []
    }
  ]
};

const questions: PhaseQuestionDataset = {
  schema_version: "1.0.0",
  generated_at: "2026-01-01T00:00:00.000Z",
  slots: {},
  slot_to_questions: {
    school_type: ["S1"]
  },
  phase_to_questions: {
    interesse: ["S0"],
    orientatie: ["S1"],
    beslissing: ["S0"],
    matching: ["S0"],
    voorbereiding: ["S0"]
  },
  question_catalog: {
    S0: {
      question_id: "S0",
      question_text: "Waar ben je naar op zoek?",
      phase_code: "interesse",
      fills_slots: []
    },
    S1: {
      question_id: "S1",
      question_text: "Welke sector bedoel je?",
      phase_code: "orientatie",
      fills_slots: ["school_type"]
    }
  }
};

const systems: PhaseSystemDefinition[] = [
  {
    schema_version: "1.0.0",
    system_key: "phase-4",
    title: "4",
    description: "",
    phases: [
      {
        code: "verkennen",
        title: "Verkennen",
        sort: 1,
        canonical_range: ["interesse", "orientatie"],
        entry_criteria: [{ type: "always" }],
        exit_criteria: [
          { type: "slot_present", slot: "school_type" }
        ],
        required_slots: ["school_type"],
        optional_slots: [],
        allowed_previous_phases: [],
        allowed_next_phases: [],
        default_next_phase: null
      }
    ]
  },
  {
    schema_version: "1.0.0",
    system_key: "phase-5",
    title: "5",
    description: "",
    phases: [
      {
        code: "orientatie",
        title: "Oriënteren",
        sort: 1,
        canonical_range: ["orientatie"],
        entry_criteria: [{ type: "always" }],
        exit_criteria: [
          { type: "slot_present", slot: "school_type" }
        ],
        required_slots: ["school_type"],
        optional_slots: [],
        allowed_previous_phases: [],
        allowed_next_phases: [],
        default_next_phase: null
      }
    ]
  }
];

describe("AdaptivePhaseDetector", () => {
  it("resolves the active system and maps to detector phases", async () => {
    const preferences =
      new InMemoryPhaseSystemPreferenceRepository([
        {
          scope: "organization",
          scopeId: "org-1",
          phaseSystemKey: "phase-4",
          enabled: true,
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ]);

    const detector = new AdaptivePhaseDetector(
      rules,
      questions,
      new PhaseSystemRegistry(systems),
      new PhaseSystemPreferenceResolver(preferences)
    );

    const result = await detector.evaluate({
      organizationId: "org-1",
      currentPhaseCode: "verkennen",
      knownSlots: []
    });

    expect(result.phaseSystem.phaseSystemKey).toBe("phase-4");
    expect(result.mappedDetectorPhase).toBe("orientatie");
    expect(result.nextQuestionId).toBe("S1");
  });
});
