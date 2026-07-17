import type { ChatbotKey } from "@door010/contracts";
import type { ActivePromptProvider } from "@door010/chat";
import type { SqlExecutor } from "@door010/database";

export type PromptReviewStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "archived";

export interface PromptVersion {
  id: string;
  promptConfigId: string;
  version: number;
  systemPrompt: string;
  notes?: string;
  status: PromptReviewStatus;
  createdByUserId?: string;
  createdAt: string;
}

export interface PromptConfig {
  id: string;
  chatbotKey: ChatbotKey;
  configKey: string;
  title: string;
  activeVersion: number;
  createdAt: string;
  updatedAt: string;
  versions: readonly PromptVersion[];
}

export interface PromptRepository {
  list(): Promise<readonly PromptConfig[]>;
  findById(id: string): Promise<PromptConfig | null>;
  create(input: {
    chatbotKey: ChatbotKey;
    configKey: string;
    title: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptConfig>;
  createVersion(input: {
    promptConfigId: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptVersion>;
  activateVersion(input: {
    promptConfigId: string;
    version: number;
  }): Promise<PromptConfig>;
}

export class PromptManagementService {
  constructor(private readonly repository: PromptRepository) {}

  list(): Promise<readonly PromptConfig[]> {
    return this.repository.list();
  }

  create(input: {
    chatbotKey: ChatbotKey;
    configKey: string;
    title: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptConfig> {
    if (input.systemPrompt.trim().length < 20) {
      throw new Error("prompt_too_short");
    }

    return this.repository.create({
      ...input,
      configKey: input.configKey.trim().toLowerCase(),
      title: input.title.trim(),
      systemPrompt: input.systemPrompt.trim(),
      notes: input.notes?.trim() || undefined
    });
  }

  createVersion(input: {
    promptConfigId: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptVersion> {
    if (input.systemPrompt.trim().length < 20) {
      throw new Error("prompt_too_short");
    }

    return this.repository.createVersion({
      ...input,
      systemPrompt: input.systemPrompt.trim(),
      notes: input.notes?.trim() || undefined
    });
  }

  activateVersion(input: {
    promptConfigId: string;
    version: number;
  }): Promise<PromptConfig> {
    return this.repository.activateVersion(input);
  }
}

export class InMemoryPromptRepository implements PromptRepository {
  private readonly configs = new Map<string, PromptConfig>();

  async list(): Promise<readonly PromptConfig[]> {
    return [...this.configs.values()].sort((left, right) =>
      left.title.localeCompare(right.title, "nl")
    );
  }

  async findById(id: string): Promise<PromptConfig | null> {
    return this.configs.get(id) ?? null;
  }

  async create(input: {
    chatbotKey: ChatbotKey;
    configKey: string;
    title: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptConfig> {
    if (
      [...this.configs.values()].some(
        (config) =>
          config.chatbotKey === input.chatbotKey &&
          config.configKey === input.configKey
      )
    ) {
      throw new Error("prompt_config_exists");
    }

    const now = new Date().toISOString();
    const id = globalThis.crypto.randomUUID();
    const version: PromptVersion = {
      id: globalThis.crypto.randomUUID(),
      promptConfigId: id,
      version: 1,
      systemPrompt: input.systemPrompt,
      notes: input.notes,
      status: "approved",
      createdByUserId: input.createdByUserId,
      createdAt: now
    };
    const config: PromptConfig = {
      id,
      chatbotKey: input.chatbotKey,
      configKey: input.configKey,
      title: input.title,
      activeVersion: 1,
      createdAt: now,
      updatedAt: now,
      versions: [version]
    };

    this.configs.set(id, config);
    return config;
  }

  async createVersion(input: {
    promptConfigId: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptVersion> {
    const config = this.configs.get(input.promptConfigId);
    if (!config) {
      throw new Error("prompt_config_not_found");
    }

    const nextVersion =
      Math.max(0, ...config.versions.map((item) => item.version)) + 1;
    const version: PromptVersion = {
      id: globalThis.crypto.randomUUID(),
      promptConfigId: config.id,
      version: nextVersion,
      systemPrompt: input.systemPrompt,
      notes: input.notes,
      status: "draft",
      createdByUserId: input.createdByUserId,
      createdAt: new Date().toISOString()
    };

    this.configs.set(config.id, {
      ...config,
      updatedAt: new Date().toISOString(),
      versions: [...config.versions, version]
    });

    return version;
  }

  async activateVersion(input: {
    promptConfigId: string;
    version: number;
  }): Promise<PromptConfig> {
    const config = this.configs.get(input.promptConfigId);
    if (!config) {
      throw new Error("prompt_config_not_found");
    }

    if (!config.versions.some((item) => item.version === input.version)) {
      throw new Error("prompt_version_not_found");
    }

    const updated: PromptConfig = {
      ...config,
      activeVersion: input.version,
      updatedAt: new Date().toISOString(),
      versions: config.versions.map((version) => ({
        ...version,
        status:
          version.version === input.version
            ? "approved"
            : version.status === "approved"
              ? "archived"
              : version.status
      }))
    };
    this.configs.set(config.id, updated);
    return updated;
  }
}

interface PromptConfigRow {
  id: string;
  chatbot_key: ChatbotKey;
  config_key: string;
  title: string;
  active_version: number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface PromptVersionRow {
  id: string;
  prompt_config_id: string;
  version: number;
  system_prompt: string;
  notes: string | null;
  status: PromptReviewStatus;
  created_by_user_id: string | null;
  created_at: string | Date;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export class PostgresPromptRepository implements PromptRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async list(): Promise<readonly PromptConfig[]> {
    const configs = await this.executor.query<PromptConfigRow>(
      `SELECT id, chatbot_key, config_key, title, active_version,
              created_at, updated_at
       FROM prompt_configs
       ORDER BY title`
    );
    const versions = await this.executor.query<PromptVersionRow>(
      `SELECT id, prompt_config_id, version, system_prompt, notes,
              status, created_by_user_id, created_at
       FROM prompt_versions
       ORDER BY prompt_config_id, version DESC`
    );

    return configs.rows.map((config) =>
      mapPromptConfig(
        config,
        versions.rows.filter(
          (version) => version.prompt_config_id === config.id
        )
      )
    );
  }

  async findById(id: string): Promise<PromptConfig | null> {
    const config = await this.executor.query<PromptConfigRow>(
      `SELECT id, chatbot_key, config_key, title, active_version,
              created_at, updated_at
       FROM prompt_configs
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const row = config.rows[0];
    if (!row) return null;

    const versions = await this.executor.query<PromptVersionRow>(
      `SELECT id, prompt_config_id, version, system_prompt, notes,
              status, created_by_user_id, created_at
       FROM prompt_versions
       WHERE prompt_config_id = $1
       ORDER BY version DESC`,
      [id]
    );

    return mapPromptConfig(row, versions.rows);
  }

  async create(input: {
    chatbotKey: ChatbotKey;
    configKey: string;
    title: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptConfig> {
    const configId = globalThis.crypto.randomUUID();
    const versionId = globalThis.crypto.randomUUID();

    await this.executor.query("BEGIN");
    try {
      await this.executor.query(
        `INSERT INTO prompt_configs (
           id, chatbot_key, config_key, title, active_version
         ) VALUES ($1, $2, $3, $4, 1)`,
        [
          configId,
          input.chatbotKey,
          input.configKey,
          input.title
        ]
      );
      await this.executor.query(
        `INSERT INTO prompt_versions (
           id, prompt_config_id, version, system_prompt,
           notes, status, created_by_user_id
         ) VALUES ($1, $2, 1, $3, $4, 'approved', $5)`,
        [
          versionId,
          configId,
          input.systemPrompt,
          input.notes ?? null,
          input.createdByUserId
        ]
      );
      await this.executor.query("COMMIT");
    } catch (error) {
      await this.executor.query("ROLLBACK");
      throw error;
    }

    const created = await this.findById(configId);
    if (!created) {
      throw new Error("prompt_create_failed");
    }
    return created;
  }

  async createVersion(input: {
    promptConfigId: string;
    systemPrompt: string;
    notes?: string;
    createdByUserId: string;
  }): Promise<PromptVersion> {
    const result = await this.executor.query<PromptVersionRow>(
      `INSERT INTO prompt_versions (
         id, prompt_config_id, version, system_prompt,
         notes, status, created_by_user_id
       )
       SELECT $1, $2, COALESCE(MAX(version), 0) + 1,
              $3, $4, 'draft', $5
       FROM prompt_versions
       WHERE prompt_config_id = $2
       RETURNING id, prompt_config_id, version, system_prompt,
                 notes, status, created_by_user_id, created_at`,
      [
        globalThis.crypto.randomUUID(),
        input.promptConfigId,
        input.systemPrompt,
        input.notes ?? null,
        input.createdByUserId
      ]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("prompt_config_not_found");
    }
    return mapPromptVersion(row);
  }

  async activateVersion(input: {
    promptConfigId: string;
    version: number;
  }): Promise<PromptConfig> {
    const exists = await this.executor.query<{ id: string }>(
      `SELECT id
       FROM prompt_versions
       WHERE prompt_config_id = $1 AND version = $2`,
      [input.promptConfigId, input.version]
    );
    if (exists.rowCount !== 1) {
      throw new Error("prompt_version_not_found");
    }

    await this.executor.query("BEGIN");
    try {
      await this.executor.query(
        `UPDATE prompt_versions
         SET status = CASE
           WHEN version = $2 THEN 'approved'::review_status
           WHEN status = 'approved' THEN 'archived'::review_status
           ELSE status
         END
         WHERE prompt_config_id = $1`,
        [input.promptConfigId, input.version]
      );
      await this.executor.query(
        `UPDATE prompt_configs
         SET active_version = $2, updated_at = now()
         WHERE id = $1`,
        [input.promptConfigId, input.version]
      );
      await this.executor.query("COMMIT");
    } catch (error) {
      await this.executor.query("ROLLBACK");
      throw error;
    }

    const updated = await this.findById(input.promptConfigId);
    if (!updated) {
      throw new Error("prompt_config_not_found");
    }
    return updated;
  }
}

function mapPromptVersion(row: PromptVersionRow): PromptVersion {
  return {
    id: row.id,
    promptConfigId: row.prompt_config_id,
    version: row.version,
    systemPrompt: row.system_prompt,
    notes: row.notes ?? undefined,
    status: row.status,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdAt: toIso(row.created_at)
  };
}

function mapPromptConfig(
  row: PromptConfigRow,
  versions: readonly PromptVersionRow[]
): PromptConfig {
  return {
    id: row.id,
    chatbotKey: row.chatbot_key,
    configKey: row.config_key,
    title: row.title,
    activeVersion: row.active_version,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    versions: versions.map(mapPromptVersion)
  };
}


export class RepositoryActivePromptProvider
  implements ActivePromptProvider
{
  constructor(private readonly repository: PromptRepository) {}

  async getActivePrompt(
    chatbotKey: ChatbotKey,
    configKey = "default"
  ): Promise<string | undefined> {
    const config = (await this.repository.list()).find(
      (item) =>
        item.chatbotKey === chatbotKey &&
        item.configKey === configKey
    );

    if (!config) return undefined;

    return config.versions.find(
      (version) =>
        version.version === config.activeVersion &&
        version.status === "approved"
    )?.systemPrompt;
  }
}
