import type { PhaseSystemKey } from "./phase-systems.js";

export type PhaseSystemScope =
  | "organization"
  | "user"
  | "conversation";

export interface PhaseSystemPreference {
  scope: PhaseSystemScope;
  scopeId: string;
  phaseSystemKey: PhaseSystemKey;
  enabled: boolean;
  updatedAt: string;
}

export interface PhaseSystemPreferenceContext {
  organizationId?: string;
  userId?: string;
  conversationId?: string;
}

export interface PhaseSystemResolution {
  phaseSystemKey: PhaseSystemKey;
  source:
    | "conversation"
    | "user"
    | "organization"
    | "default";
  preference?: PhaseSystemPreference;
}

export interface PhaseSystemPreferenceRepository {
  findByScope(
    scope: PhaseSystemScope,
    scopeId: string
  ): Promise<PhaseSystemPreference | null>;
}

export class InMemoryPhaseSystemPreferenceRepository
  implements PhaseSystemPreferenceRepository
{
  private readonly preferences = new Map<string, PhaseSystemPreference>();

  constructor(initial: readonly PhaseSystemPreference[] = []) {
    for (const preference of initial) {
      this.save(preference);
    }
  }

  async findByScope(
    scope: PhaseSystemScope,
    scopeId: string
  ): Promise<PhaseSystemPreference | null> {
    return this.preferences.get(`${scope}:${scopeId}`) ?? null;
  }

  save(preference: PhaseSystemPreference): void {
    this.preferences.set(
      `${preference.scope}:${preference.scopeId}`,
      preference
    );
  }
}

export class PhaseSystemPreferenceResolver {
  constructor(
    private readonly repository: PhaseSystemPreferenceRepository,
    private readonly defaultPhaseSystemKey: PhaseSystemKey = "phase-5"
  ) {}

  async resolve(
    context: PhaseSystemPreferenceContext
  ): Promise<PhaseSystemResolution> {
    const candidates: Array<{
      scope: PhaseSystemScope;
      scopeId: string | undefined;
      source: PhaseSystemResolution["source"];
    }> = [
      {
        scope: "conversation",
        scopeId: context.conversationId,
        source: "conversation"
      },
      {
        scope: "user",
        scopeId: context.userId,
        source: "user"
      },
      {
        scope: "organization",
        scopeId: context.organizationId,
        source: "organization"
      }
    ];

    for (const candidate of candidates) {
      if (!candidate.scopeId) {
        continue;
      }

      const preference = await this.repository.findByScope(
        candidate.scope,
        candidate.scopeId
      );

      if (preference?.enabled) {
        return {
          phaseSystemKey: preference.phaseSystemKey,
          source: candidate.source,
          preference
        };
      }
    }

    return {
      phaseSystemKey: this.defaultPhaseSystemKey,
      source: "default"
    };
  }
}
