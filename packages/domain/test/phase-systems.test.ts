import { describe, expect, it } from "vitest";
import {
  PhaseSystemMapper,
  PhaseSystemRegistry,
  PhaseTransitionEngine,
  type PhaseSystemDefinition
} from "../src/index.js";

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
        allowed_next_phases: ["kiezen"],
        default_next_phase: "kiezen"
      },
      {
        code: "kiezen",
        title: "Kiezen",
        sort: 2,
        canonical_range: ["beslissing", "matching"],
        entry_criteria: [
          { type: "phase_completed", phase: "verkennen" }
        ],
        exit_criteria: [{ type: "always" }],
        required_slots: [],
        optional_slots: [],
        allowed_previous_phases: ["verkennen"],
        allowed_next_phases: [],
        default_next_phase: null
      }
    ]
  },
  {
    schema_version: "1.0.0",
    system_key: "phase-9",
    title: "9",
    description: "",
    phases: [
      {
        code: "interesse",
        title: "Interesse",
        sort: 1,
        canonical_range: ["interesse"],
        entry_criteria: [{ type: "always" }],
        exit_criteria: [{ type: "always" }],
        required_slots: [],
        optional_slots: [],
        allowed_previous_phases: [],
        allowed_next_phases: ["orientatie"],
        default_next_phase: "orientatie"
      },
      {
        code: "orientatie",
        title: "Oriëntatie",
        sort: 2,
        canonical_range: ["orientatie"],
        entry_criteria: [
          { type: "phase_completed", phase: "interesse" }
        ],
        exit_criteria: [{ type: "always" }],
        required_slots: [],
        optional_slots: [],
        allowed_previous_phases: ["interesse"],
        allowed_next_phases: [],
        default_next_phase: null
      }
    ]
  }
];

describe("PhaseTransitionEngine", () => {
  it("requires current exit and next entry criteria", () => {
    const registry = new PhaseSystemRegistry(systems);
    const engine = new PhaseTransitionEngine(registry);

    expect(
      engine.evaluate("phase-4", "verkennen", { slots: [] })
        .transitionAllowed
    ).toBe(false);

    expect(
      engine.evaluate("phase-4", "verkennen", {
        slots: [
          {
            key: "school_type",
            value: "po",
            confidence: 1,
            source: "user",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ]
      }).transitionAllowed
    ).toBe(true);
  });
});

describe("PhaseSystemMapper", () => {
  it("maps compact phases using canonical journey position", () => {
    const registry = new PhaseSystemRegistry(systems);
    const mapper = new PhaseSystemMapper(registry);
    const result = mapper.switchSystem(
      "phase-4",
      "phase-9",
      "verkennen"
    );

    expect(result.targetPhaseCode).toBe("orientatie");
    expect(result.canonicalPosition).toBe("orientatie");
  });
});
