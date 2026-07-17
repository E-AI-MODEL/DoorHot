export interface ConnectionStatus {
  ok: boolean;
  message: string;
}

export interface ProviderCapabilities {
  supportsFullSync: boolean;
  supportsIncrementalSync: boolean;
  supportsWebhooks: boolean;
  entityTypes: readonly string[];
}

export interface SyncCursor {
  value: string;
}

export interface ProviderPage<T> {
  records: readonly T[];
  nextCursor?: SyncCursor;
}

export interface CanonicalEntity {
  entityType:
    | "education-provider"
    | "education-programme"
    | "education-route"
    | "education-event"
    | "vacancy"
    | "regional-desk";
  externalId: string;
  providerKey: string;
  payload: Readonly<Record<string, unknown>>;
  retrievedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
}

export interface DataProvider<TSource> {
  readonly providerKey: string;

  testConnection(): Promise<ConnectionStatus>;
  discoverCapabilities(): Promise<ProviderCapabilities>;
  fetchChanges(cursor?: SyncCursor): AsyncIterable<ProviderPage<TSource>>;
  normalize(record: TSource): Promise<CanonicalEntity[]>;
  validate(entity: CanonicalEntity): ValidationResult;
}

export class ManualImportProvider
  implements DataProvider<Record<string, unknown>>
{
  readonly providerKey = "manual-import";

  constructor(
    private readonly records: readonly Record<string, unknown>[]
  ) {}

  async testConnection(): Promise<ConnectionStatus> {
    return {
      ok: true,
      message: "Manual import provider is available."
    };
  }

  async discoverCapabilities(): Promise<ProviderCapabilities> {
    return {
      supportsFullSync: true,
      supportsIncrementalSync: false,
      supportsWebhooks: false,
      entityTypes: [
        "education-provider",
        "education-programme",
        "education-route",
        "education-event",
        "vacancy",
        "regional-desk"
      ]
    };
  }

  async *fetchChanges(): AsyncIterable<
    ProviderPage<Record<string, unknown>>
  > {
    yield {
      records: this.records
    };
  }

  async normalize(
    record: Record<string, unknown>
  ): Promise<CanonicalEntity[]> {
    const entityType = String(record.entityType ?? "");
    const externalId = String(record.externalId ?? "");

    if (!entityType || !externalId) {
      return [];
    }

    return [
      {
        entityType: entityType as CanonicalEntity["entityType"],
        externalId,
        providerKey: this.providerKey,
        payload: record,
        retrievedAt: new Date().toISOString()
      }
    ];
  }

  validate(entity: CanonicalEntity): ValidationResult {
    const errors: string[] = [];

    if (!entity.externalId.trim()) {
      errors.push("externalId is required.");
    }

    if (!entity.providerKey.trim()) {
      errors.push("providerKey is required.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}
