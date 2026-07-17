import type { JourneyPhaseDefinition } from "./datasets.js";

export const DETECTOR_PHASE_KEYS = [
  "interesse",
  "orientatie",
  "beslissing",
  "matching",
  "voorbereiding"
] as const;

export const EXTENDED_JOURNEY_PHASE_KEYS = [
  ...DETECTOR_PHASE_KEYS,
  "start",
  "opleiding",
  "inductie",
  "behoud"
] as const;

export type DetectorPhaseKey = (typeof DETECTOR_PHASE_KEYS)[number];
export type JourneyPhaseKey = (typeof EXTENDED_JOURNEY_PHASE_KEYS)[number];

export class JourneyPhaseCatalog {
  private readonly byCode: ReadonlyMap<string, JourneyPhaseDefinition>;

  constructor(
    private readonly phases: readonly JourneyPhaseDefinition[]
  ) {
    this.byCode = new Map(phases.map((phase) => [phase.code, phase]));
  }

  getAll(): readonly JourneyPhaseDefinition[] {
    return [...this.phases].sort((left, right) => left.sort - right.sort);
  }

  getDetectorPhases(): readonly JourneyPhaseDefinition[] {
    return this.getAll().filter((phase) =>
      DETECTOR_PHASE_KEYS.includes(phase.code as DetectorPhaseKey)
    );
  }

  getByCode(code: JourneyPhaseKey): JourneyPhaseDefinition | null {
    return this.byCode.get(code) ?? null;
  }

  isDetectorPhase(code: string): code is DetectorPhaseKey {
    return DETECTOR_PHASE_KEYS.includes(code as DetectorPhaseKey);
  }
}
