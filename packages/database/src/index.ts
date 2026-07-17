export interface Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface Database {
  beginTransaction(): Promise<Transaction>;
  healthCheck(): Promise<boolean>;
}

export interface PageRequest {
  limit: number;
  cursor?: string;
}

export interface Page<T> {
  items: readonly T[];
  nextCursor?: string;
}

export interface SqlQueryResult<Row> {
  rows: readonly Row[];
  rowCount: number;
}

export interface SqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<SqlQueryResult<Row>>;
}

export interface AuditRecord {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface AuditRepository {
  append(record: AuditRecord): Promise<void>;
}

export interface ProfileSlotRecord {
  profileId: string;
  slotKey: string;
  value: unknown;
  confidence: number;
  source:
    | "user"
    | "advisor"
    | "administrator"
    | "system"
    | "model"
    | "provider";
  confirmedByUser: boolean;
  version: number;
  updatedAt: string;
}

export interface ProfileSlotRepository {
  findByProfileId(profileId: string): Promise<readonly ProfileSlotRecord[]>;
  upsert(record: ProfileSlotRecord): Promise<void>;
}

export interface PhaseEvaluationRecord {
  id: string;
  profileId: string;
  phaseKey: string;
  confidence: number;
  evidence: readonly string[];
  missingSlots: readonly string[];
  nextQuestionKey?: string;
  engineVersion: string;
  evaluatedAt: string;
  resolvedPhaseSystemKey?: string;
  phaseSystemSource?: string;
  mappedDetectorPhase?: string;
  transitionAllowed?: boolean;
  entrySatisfied?: boolean;
  exitSatisfied?: boolean;
}

export interface PhaseRepository {
  saveEvaluation(record: PhaseEvaluationRecord): Promise<void>;
  findLatestEvaluation(
    profileId: string
  ): Promise<PhaseEvaluationRecord | null>;
}

export interface RouteEvaluationRecord {
  id: string;
  profileId: string;
  answers: Readonly<Record<string, unknown>>;
  matchedStepKeys: readonly string[];
  explanation: readonly string[];
  engineVersion: string;
  evaluatedAt: string;
}

export interface RouteRepository {
  saveEvaluation(record: RouteEvaluationRecord): Promise<void>;
  findLatestEvaluation(
    profileId: string
  ): Promise<RouteEvaluationRecord | null>;
}

export type PhaseSystemScope =
  | "organization"
  | "user"
  | "conversation";

export type PhaseSystemKey =
  | "phase-4"
  | "phase-5"
  | "phase-9";

export interface PhaseSystemPreferenceRecord {
  scope: PhaseSystemScope;
  scopeId: string;
  phaseSystemKey: PhaseSystemKey;
  enabled: boolean;
  updatedAt: string;
}

export interface PhaseSystemPreferenceRepository {
  findByScope(
    scope: PhaseSystemScope,
    scopeId: string
  ): Promise<PhaseSystemPreferenceRecord | null>;
  upsert(record: PhaseSystemPreferenceRecord): Promise<void>;
}

export interface JourneyStateRecord {
  id: string;
  profileId: string;
  phaseSystemKey: PhaseSystemKey;
  currentPhaseCode: string;
  canonicalJourneyPosition?: string;
  completedPhaseCodes: readonly string[];
  selectedEntities: Readonly<Record<string, string | null>>;
  events: readonly string[];
  updatedAt: string;
}

export interface JourneyStateRepository {
  findByProfileId(profileId: string): Promise<JourneyStateRecord | null>;
  upsert(record: JourneyStateRecord): Promise<void>;
}

interface PhasePreferenceRow {
  scope: PhaseSystemScope;
  scope_id: string;
  phase_system_key: PhaseSystemKey;
  enabled: boolean;
  updated_at: string | Date;
}

interface JourneyStateRow {
  id: string;
  profile_id: string;
  phase_system_key: PhaseSystemKey;
  current_phase_code: string;
  canonical_journey_position: string | null;
  completed_phase_codes: unknown;
  selected_entities: unknown;
  events: unknown;
  updated_at: string | Date;
}

interface PhaseEvaluationRow {
  id: string;
  profile_id: string;
  phase_key: string;
  confidence: number;
  evidence: unknown;
  missing_slots: unknown;
  next_question_key: string | null;
  engine_version: string;
  evaluated_at: string | Date;
  resolved_phase_system_key: string | null;
  phase_system_source: string | null;
  mapped_detector_phase: string | null;
  phase_transition_allowed: boolean | null;
  phase_entry_satisfied: boolean | null;
  phase_exit_satisfied: boolean | null;
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asStringMap(
  value: unknown
): Readonly<Record<string, string | null>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || entry === null) {
      result[key] = entry;
    }
  }
  return result;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export class PostgresPhaseSystemPreferenceRepository
  implements PhaseSystemPreferenceRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async findByScope(
    scope: PhaseSystemScope,
    scopeId: string
  ): Promise<PhaseSystemPreferenceRecord | null> {
    const result = await this.executor.query<PhasePreferenceRow>(
      `SELECT scope, scope_id, phase_system_key, enabled, updated_at
       FROM phase_system_preferences
       WHERE scope = $1 AND scope_id = $2
       LIMIT 1`,
      [scope, scopeId]
    );
    const row = result.rows[0];
    return row
      ? {
          scope: row.scope,
          scopeId: row.scope_id,
          phaseSystemKey: row.phase_system_key,
          enabled: row.enabled,
          updatedAt: toIsoString(row.updated_at)
        }
      : null;
  }

  async upsert(record: PhaseSystemPreferenceRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO phase_system_preferences (
         scope, scope_id, phase_system_key, enabled, updated_at
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (scope, scope_id)
       DO UPDATE SET
         phase_system_key = EXCLUDED.phase_system_key,
         enabled = EXCLUDED.enabled,
         updated_at = EXCLUDED.updated_at`,
      [
        record.scope,
        record.scopeId,
        record.phaseSystemKey,
        record.enabled,
        record.updatedAt
      ]
    );
  }
}

export class PostgresJourneyStateRepository
  implements JourneyStateRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async findByProfileId(
    profileId: string
  ): Promise<JourneyStateRecord | null> {
    const result = await this.executor.query<JourneyStateRow>(
      `SELECT id, profile_id, phase_system_key, current_phase_code,
              canonical_journey_position, completed_phase_codes,
              selected_entities, events, updated_at
       FROM journey_states
       WHERE profile_id = $1
       LIMIT 1`,
      [profileId]
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          profileId: row.profile_id,
          phaseSystemKey: row.phase_system_key,
          currentPhaseCode: row.current_phase_code,
          canonicalJourneyPosition:
            row.canonical_journey_position ?? undefined,
          completedPhaseCodes: asStringArray(row.completed_phase_codes),
          selectedEntities: asStringMap(row.selected_entities),
          events: asStringArray(row.events),
          updatedAt: toIsoString(row.updated_at)
        }
      : null;
  }

  async upsert(record: JourneyStateRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO journey_states (
         id, profile_id, phase_system_key, current_phase_code,
         canonical_journey_position, completed_phase_codes,
         selected_entities, events, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)
       ON CONFLICT (profile_id)
       DO UPDATE SET
         phase_system_key = EXCLUDED.phase_system_key,
         current_phase_code = EXCLUDED.current_phase_code,
         canonical_journey_position = EXCLUDED.canonical_journey_position,
         completed_phase_codes = EXCLUDED.completed_phase_codes,
         selected_entities = EXCLUDED.selected_entities,
         events = EXCLUDED.events,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.profileId,
        record.phaseSystemKey,
        record.currentPhaseCode,
        record.canonicalJourneyPosition ?? null,
        JSON.stringify(record.completedPhaseCodes),
        JSON.stringify(record.selectedEntities),
        JSON.stringify(record.events),
        record.updatedAt
      ]
    );
  }
}

export class PostgresPhaseRepository implements PhaseRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async saveEvaluation(record: PhaseEvaluationRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO phase_evaluations (
         id, profile_id, phase_key, confidence, evidence, missing_slots,
         next_question_key, engine_version, evaluated_at,
         resolved_phase_system_key, phase_system_source,
         mapped_detector_phase, phase_transition_allowed,
         phase_entry_satisfied, phase_exit_satisfied
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9,
         $10, $11, $12, $13, $14, $15
       )`,
      [
        record.id,
        record.profileId,
        record.phaseKey,
        record.confidence,
        JSON.stringify(record.evidence),
        JSON.stringify(record.missingSlots),
        record.nextQuestionKey ?? null,
        record.engineVersion,
        record.evaluatedAt,
        record.resolvedPhaseSystemKey ?? null,
        record.phaseSystemSource ?? null,
        record.mappedDetectorPhase ?? null,
        record.transitionAllowed ?? null,
        record.entrySatisfied ?? null,
        record.exitSatisfied ?? null
      ]
    );
  }

  async findLatestEvaluation(
    profileId: string
  ): Promise<PhaseEvaluationRecord | null> {
    const result = await this.executor.query<PhaseEvaluationRow>(
      `SELECT id, profile_id, phase_key, confidence, evidence,
              missing_slots, next_question_key, engine_version,
              evaluated_at, resolved_phase_system_key,
              phase_system_source, mapped_detector_phase,
              phase_transition_allowed, phase_entry_satisfied,
              phase_exit_satisfied
       FROM phase_evaluations
       WHERE profile_id = $1
       ORDER BY evaluated_at DESC
       LIMIT 1`,
      [profileId]
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          profileId: row.profile_id,
          phaseKey: row.phase_key,
          confidence: row.confidence,
          evidence: asStringArray(row.evidence),
          missingSlots: asStringArray(row.missing_slots),
          nextQuestionKey: row.next_question_key ?? undefined,
          engineVersion: row.engine_version,
          evaluatedAt: toIsoString(row.evaluated_at),
          resolvedPhaseSystemKey:
            row.resolved_phase_system_key ?? undefined,
          phaseSystemSource: row.phase_system_source ?? undefined,
          mappedDetectorPhase: row.mapped_detector_phase ?? undefined,
          transitionAllowed:
            row.phase_transition_allowed ?? undefined,
          entrySatisfied: row.phase_entry_satisfied ?? undefined,
          exitSatisfied: row.phase_exit_satisfied ?? undefined
        }
      : null;
  }
}


export interface ConversationRecord {
  id: string;
  userId?: string;
  title: string;
  type: "general-ai" | "personal-ai" | "advisor";
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRepository {
  create(record: ConversationRecord): Promise<void>;
  findById(id: string): Promise<ConversationRecord | null>;
  listByUserId(userId: string): Promise<readonly ConversationRecord[]>;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role:
    | "user"
    | "assistant_general"
    | "assistant_personal"
    | "advisor"
    | "system";
  content: string;
  chatbotKey?: "general-coach" | "personal-journey-coach";
  advisorUserId?: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface MessageRepository {
  append(record: MessageRecord): Promise<void>;
  listByConversationId(
    conversationId: string
  ): Promise<readonly MessageRecord[]>;
}

export interface DetectorSnapshotRecord {
  id: string;
  profileId: string;
  conversationId?: string;
  input: Readonly<Record<string, unknown>>;
  output: Readonly<Record<string, unknown>>;
  rulesVersion: string;
  createdAt: string;
}

export interface DetectorSnapshotRepository {
  save(record: DetectorSnapshotRecord): Promise<void>;
  findLatestByProfileId(
    profileId: string
  ): Promise<DetectorSnapshotRecord | null>;
}

interface ConversationRow {
  id: string;
  user_id: string | null;
  title: string;
  conversation_type: "general-ai" | "personal-ai" | "advisor";
  created_at: string | Date;
  updated_at: string | Date;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role:
    | "user"
    | "assistant_general"
    | "assistant_personal"
    | "advisor"
    | "system";
  content: string;
  chatbot_key: "general-coach" | "personal-journey-coach" | null;
  advisor_user_id: string | null;
  metadata: unknown;
  created_at: string | Date;
}

interface DetectorSnapshotRow {
  id: string;
  profile_id: string;
  conversation_id: string | null;
  input_snapshot: unknown;
  output_snapshot: unknown;
  rules_version: string;
  created_at: string | Date;
}

function asRecord(
  value: unknown
): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

export class PostgresConversationRepository
  implements ConversationRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async create(record: ConversationRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO conversations (
         id, user_id, title, conversation_type, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.id,
        record.userId ?? null,
        record.title,
        record.type,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const result = await this.executor.query<ConversationRow>(
      `SELECT id, user_id, title, conversation_type, created_at, updated_at
       FROM conversations
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          userId: row.user_id ?? undefined,
          title: row.title,
          type: row.conversation_type,
          createdAt: toIsoString(row.created_at),
          updatedAt: toIsoString(row.updated_at)
        }
      : null;
  }

  async listByUserId(
    userId: string
  ): Promise<readonly ConversationRecord[]> {
    const result = await this.executor.query<ConversationRow>(
      `SELECT id, user_id, title, conversation_type, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id ?? undefined,
      title: row.title,
      type: row.conversation_type,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    }));
  }
}

export class PostgresMessageRepository implements MessageRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async append(record: MessageRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO messages (
         id, conversation_id, role, content, chatbot_key,
         advisor_user_id, metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        record.id,
        record.conversationId,
        record.role,
        record.content,
        record.chatbotKey ?? null,
        record.advisorUserId ?? null,
        JSON.stringify(record.metadata),
        record.createdAt
      ]
    );
  }

  async listByConversationId(
    conversationId: string
  ): Promise<readonly MessageRecord[]> {
    const result = await this.executor.query<MessageRow>(
      `SELECT id, conversation_id, role, content, chatbot_key,
              advisor_user_id, metadata, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      chatbotKey: row.chatbot_key ?? undefined,
      advisorUserId: row.advisor_user_id ?? undefined,
      metadata: asRecord(row.metadata),
      createdAt: toIsoString(row.created_at)
    }));
  }
}

export class PostgresDetectorSnapshotRepository
  implements DetectorSnapshotRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async save(record: DetectorSnapshotRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO detector_snapshots (
         id, profile_id, conversation_id, input_snapshot,
         output_snapshot, rules_version, created_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
      [
        record.id,
        record.profileId,
        record.conversationId ?? null,
        JSON.stringify(record.input),
        JSON.stringify(record.output),
        record.rulesVersion,
        record.createdAt
      ]
    );
  }

  async findLatestByProfileId(
    profileId: string
  ): Promise<DetectorSnapshotRecord | null> {
    const result = await this.executor.query<DetectorSnapshotRow>(
      `SELECT id, profile_id, conversation_id, input_snapshot,
              output_snapshot, rules_version, created_at
       FROM detector_snapshots
       WHERE profile_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [profileId]
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          profileId: row.profile_id,
          conversationId: row.conversation_id ?? undefined,
          input: asRecord(row.input_snapshot),
          output: asRecord(row.output_snapshot),
          rulesVersion: row.rules_version,
          createdAt: toIsoString(row.created_at)
        }
      : null;
  }
}


export interface UserAccountRowRecord {
  id: string;
  email: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccountDataRepository {
  create(record: UserAccountRowRecord): Promise<void>;
  findByEmail(email: string): Promise<UserAccountRowRecord | null>;
  findById(id: string): Promise<UserAccountRowRecord | null>;
}

export interface UserRoleDataRepository {
  listByUserId(userId: string): Promise<readonly (
    "candidate" | "advisor" | "administrator" | "superuser"
  )[]>;
  assign(
    userId: string,
    role: "candidate" | "advisor" | "administrator" | "superuser"
  ): Promise<void>;
}

export interface ProfileDataRecord {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  preferredSector?: string;
  currentPhaseCode?: string;
  knownSlots: Readonly<Record<string, unknown>>;
  testCompleted: boolean;
  testResults?: unknown;
  avatarObjectKey?: string;
  cvObjectKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDataRepository {
  create(record: ProfileDataRecord): Promise<void>;
  findByUserId(userId: string): Promise<ProfileDataRecord | null>;
  update(
    userId: string,
    input: Readonly<Record<string, string | null | undefined>>
  ): Promise<ProfileDataRecord>;
  updateFile(
    userId: string,
    field: "avatarObjectKey" | "cvObjectKey",
    objectKey: string | null
  ): Promise<ProfileDataRecord>;
  delete(userId: string): Promise<void>;
}

export interface UserNoteDataRecord {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserNoteDataRepository {
  create(record: UserNoteDataRecord): Promise<void>;
  listByUserId(userId: string): Promise<readonly UserNoteDataRecord[]>;
  update(
    userId: string,
    noteId: string,
    input: { title: string; content: string }
  ): Promise<UserNoteDataRecord>;
  delete(userId: string, noteId: string): Promise<void>;
}

interface UserAccountRow {
  id: string;
  email: string;
  password_hash: string;
  active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

export class PostgresUserAccountRepository
  implements UserAccountDataRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async create(record: UserAccountRowRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO users (
         id, email, password_hash, active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.id,
        record.email,
        record.passwordHash,
        record.active,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async findByEmail(email: string): Promise<UserAccountRowRecord | null> {
    const result = await this.executor.query<UserAccountRow>(
      `SELECT id, email, password_hash, active, created_at, updated_at
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    return mapUserAccount(result.rows[0]);
  }

  async findById(id: string): Promise<UserAccountRowRecord | null> {
    const result = await this.executor.query<UserAccountRow>(
      `SELECT id, email, password_hash, active, created_at, updated_at
       FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return mapUserAccount(result.rows[0]);
  }
}

function mapUserAccount(
  row: UserAccountRow | undefined
): UserAccountRowRecord | null {
  return row
    ? {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        active: row.active,
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at)
      }
    : null;
}

export class PostgresUserRoleRepository
  implements UserRoleDataRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async listByUserId(userId: string) {
    const result = await this.executor.query<{ key: string }>(
      `SELECT r.key
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.key`,
      [userId]
    );
    return result.rows.map((row) => row.key as
      "candidate" | "advisor" | "administrator" | "superuser");
  }

  async assign(
    userId: string,
    role: "candidate" | "advisor" | "administrator" | "superuser"
  ): Promise<void> {
    await this.executor.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE key = $2
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, role]
    );
  }
}

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  bio: string | null;
  preferred_sector: string | null;
  current_phase_key: string | null;
  known_slots: unknown;
  test_completed: boolean;
  test_results: unknown;
  avatar_object_key: string | null;
  cv_object_key: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export class PostgresProfileRepository implements ProfileDataRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async create(record: ProfileDataRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO profiles (
         id, user_id, first_name, last_name, phone, bio,
         preferred_sector, current_phase_key, known_slots,
         test_completed, test_results, avatar_object_key,
         cv_object_key, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
         $10, $11::jsonb, $12, $13, $14, $15
       )`,
      [
        record.id,
        record.userId,
        record.firstName ?? null,
        record.lastName ?? null,
        record.phone ?? null,
        record.bio ?? null,
        record.preferredSector ?? null,
        record.currentPhaseCode ?? null,
        JSON.stringify(record.knownSlots),
        record.testCompleted,
        JSON.stringify(record.testResults ?? null),
        record.avatarObjectKey ?? null,
        record.cvObjectKey ?? null,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async findByUserId(userId: string): Promise<ProfileDataRecord | null> {
    const result = await this.executor.query<ProfileRow>(
      `SELECT * FROM profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return mapProfile(result.rows[0]);
  }

  async update(
    userId: string,
    input: Readonly<Record<string, string | null | undefined>>
  ): Promise<ProfileDataRecord> {
    const result = await this.executor.query<ProfileRow>(
      `UPDATE profiles SET
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         phone = COALESCE($4, phone),
         bio = COALESCE($5, bio),
         preferred_sector = COALESCE($6, preferred_sector),
         updated_at = now()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        input.firstName ?? null,
        input.lastName ?? null,
        input.phone ?? null,
        input.bio ?? null,
        input.preferredSector ?? null
      ]
    );
    const profile = mapProfile(result.rows[0]);
    if (!profile) throw new Error("profile_not_found");
    return profile;
  }

  async updateFile(
    userId: string,
    field: "avatarObjectKey" | "cvObjectKey",
    objectKey: string | null
  ): Promise<ProfileDataRecord> {
    const column = field === "avatarObjectKey"
      ? "avatar_object_key"
      : "cv_object_key";
    const result = await this.executor.query<ProfileRow>(
      `UPDATE profiles
       SET ${column} = $2, updated_at = now()
       WHERE user_id = $1
       RETURNING *`,
      [userId, objectKey]
    );
    const profile = mapProfile(result.rows[0]);
    if (!profile) throw new Error("profile_not_found");
    return profile;
  }

  async delete(userId: string): Promise<void> {
    await this.executor.query(
      `DELETE FROM profiles WHERE user_id = $1`,
      [userId]
    );
  }
}

function mapProfile(row: ProfileRow | undefined): ProfileDataRecord | null {
  return row
    ? {
        id: row.id,
        userId: row.user_id,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        phone: row.phone ?? undefined,
        bio: row.bio ?? undefined,
        preferredSector: row.preferred_sector ?? undefined,
        currentPhaseCode: row.current_phase_key ?? undefined,
        knownSlots: asRecord(row.known_slots),
        testCompleted: row.test_completed,
        testResults: row.test_results ?? undefined,
        avatarObjectKey: row.avatar_object_key ?? undefined,
        cvObjectKey: row.cv_object_key ?? undefined,
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at)
      }
    : null;
}

interface UserNoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string | Date;
  updated_at: string | Date;
}

export class PostgresUserNoteRepository
  implements UserNoteDataRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async create(record: UserNoteDataRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO user_notes (
         id, user_id, title, content, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.id,
        record.userId,
        record.title,
        record.content,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async listByUserId(userId: string): Promise<readonly UserNoteDataRecord[]> {
    const result = await this.executor.query<UserNoteRow>(
      `SELECT * FROM user_notes
       WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(mapUserNote);
  }

  async update(
    userId: string,
    noteId: string,
    input: { title: string; content: string }
  ): Promise<UserNoteDataRecord> {
    const result = await this.executor.query<UserNoteRow>(
      `UPDATE user_notes
       SET title = $3, content = $4, updated_at = now()
       WHERE user_id = $1 AND id = $2
       RETURNING *`,
      [userId, noteId, input.title, input.content]
    );
    const row = result.rows[0];
    if (!row) throw new Error("note_not_found");
    return mapUserNote(row);
  }

  async delete(userId: string, noteId: string): Promise<void> {
    await this.executor.query(
      `DELETE FROM user_notes WHERE user_id = $1 AND id = $2`,
      [userId, noteId]
    );
  }
}

function mapUserNote(row: UserNoteRow): UserNoteDataRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}
