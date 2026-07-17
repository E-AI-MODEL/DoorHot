export const PROFILE_SLOT_KEYS = [
  "school_type",
  "role_interest",
  "credential_goal",
  "admission_requirements",
  "duration_info",
  "costs_info",
  "salary_info",
  "region_preference",
  "next_step"
] as const;

export type ProfileSlotKey = (typeof PROFILE_SLOT_KEYS)[number];

export type ProfileSlotValue =
  | string
  | number
  | boolean
  | readonly string[]
  | null;

export interface ProfileSlot {
  key: ProfileSlotKey;
  value: ProfileSlotValue;
  confidence: number;
  source: "user" | "advisor" | "rule" | "model" | "import";
  updatedAt: string;
}

export interface PhaseEvaluation {
  phaseKey: string;
  confidence: number;
  evidence: readonly string[];
  missingSlots: readonly ProfileSlotKey[];
  nextQuestionKey?: string;
}

export interface PhaseTransitionProposal {
  fromPhaseKey: string;
  toPhaseKey: string;
  reason: string;
  requiresConfirmation: true;
}

export interface RouteRecommendation {
  routeKey: string;
  title: string;
  reasons: readonly string[];
  stepKeys: readonly string[];
  programmeIds: readonly string[];
}

export * from "./datasets.js";
export * from "./phase-engine.js";
export * from "./route-engine.js";

export * from "./journey-phases.js";

export * from "./phase-systems.js";

export * from "./phase-system-preferences.js";

export * from "./adaptive-phase-detector.js";

export * from "./journey-engine-2.js";

export * from "./graph-memory.js";
