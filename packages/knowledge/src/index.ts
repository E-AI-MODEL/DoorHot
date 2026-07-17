import type {
  AnswerDraft,
  AnswerDraftProvider,
  ChatContext
} from "@door010/chat";
import type {
  ChatRequest,
  SourceReference,
  VerifiedLink
} from "@door010/contracts";
import type { SqlExecutor } from "@door010/database";
import type {
  AdaptivePhaseDetectorResult,
  RouteEngineResult
} from "@door010/domain";

export type KnowledgeReviewStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "archived";

export interface TrustedSource {
  id: string;
  sourceKey: string;
  label: string;
  baseUrl?: string;
  authority: number;
  active: boolean;
  allowedDomains: readonly string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRecord {
  id: string;
  externalId?: string;
  title: string;
  body: string;
  category?: string;
  tags: readonly string[];
  sourceKey?: string;
  sourceUrl?: string;
  timeSensitive: boolean;
  requiresCitation: boolean;
  validFrom?: string;
  validUntil?: string;
  reviewStatus: KnowledgeReviewStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSearchResult {
  record: KnowledgeRecord;
  lexicalScore: number;
  semanticScore: number;
  authorityScore: number;
  freshnessScore: number;
  combinedScore: number;
  matchedTerms: readonly string[];
}

export interface SearchOptions {
  limit?: number;
  category?: string;
  approvedOnly?: boolean;
}

export interface KnowledgeRepository {
  upsert(record: KnowledgeRecord): Promise<void>;
  archive(id: string, updatedAt: string): Promise<void>;
  searchLexical(
    query: string,
    options?: SearchOptions
  ): Promise<readonly KnowledgeSearchResult[]>;
  list(options?: {
    reviewStatus?: KnowledgeReviewStatus;
    limit?: number;
  }): Promise<readonly KnowledgeRecord[]>;
}

export interface TrustedSourceRepository {
  upsert(source: TrustedSource): Promise<void>;
  findByKey(sourceKey: string): Promise<TrustedSource | null>;
  list(activeOnly?: boolean): Promise<readonly TrustedSource[]>;
}

export interface SemanticScorer {
  score(
    query: string,
    records: readonly KnowledgeRecord[]
  ): Promise<ReadonlyMap<string, number>>;
}

function normalizeTerms(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .toLocaleLowerCase("nl")
        .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .filter((term) => term.length >= 2)
    )
  ];
}

function lexicalSimilarity(
  query: string,
  record: KnowledgeRecord
): {
  score: number;
  matchedTerms: readonly string[];
} {
  const queryTerms = normalizeTerms(query);
  const titleTerms = new Set(normalizeTerms(record.title));
  const bodyTerms = new Set(normalizeTerms(record.body));
  const tagTerms = new Set(
    record.tags.flatMap((tag) => normalizeTerms(tag))
  );

  const matchedTerms = queryTerms.filter(
    (term) =>
      titleTerms.has(term) ||
      bodyTerms.has(term) ||
      tagTerms.has(term)
  );

  if (queryTerms.length === 0) {
    return { score: 0, matchedTerms: [] };
  }

  const weightedMatches = matchedTerms.reduce((score, term) => {
    if (titleTerms.has(term)) return score + 3;
    if (tagTerms.has(term)) return score + 2;
    return score + 1;
  }, 0);

  return {
    score: Math.min(1, weightedMatches / (queryTerms.length * 3)),
    matchedTerms
  };
}

export class TokenOverlapSemanticScorer implements SemanticScorer {
  async score(
    query: string,
    records: readonly KnowledgeRecord[]
  ): Promise<ReadonlyMap<string, number>> {
    const queryTerms = new Set(normalizeTerms(query));
    const scores = new Map<string, number>();

    for (const record of records) {
      const documentTerms = new Set(
        normalizeTerms(
          `${record.title} ${record.body} ${record.tags.join(" ")}`
        )
      );
      const intersection = [...queryTerms].filter((term) =>
        documentTerms.has(term)
      ).length;
      const union = new Set([
        ...queryTerms,
        ...documentTerms
      ]).size;

      scores.set(
        record.id,
        union === 0 ? 0 : intersection / union
      );
    }

    return scores;
  }
}

export interface KnowledgeSearch {
  search(
    query: string,
    options?: SearchOptions
  ): Promise<readonly KnowledgeSearchResult[]>;
}

export class HybridKnowledgeSearch {
  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly sources: TrustedSourceRepository,
    private readonly semantic: SemanticScorer =
      new TokenOverlapSemanticScorer()
  ) {}

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
    const lexical = await this.knowledge.searchLexical(query, {
      ...options,
      limit: Math.max(limit * 4, 20),
      approvedOnly: options.approvedOnly ?? true
    });
    const semanticScores = await this.semantic.score(
      query,
      lexical.map((result) => result.record)
    );
    const sourceList = await this.sources.list(true);
    const sourceMap = new Map(
      sourceList.map((source) => [source.sourceKey, source])
    );

    return lexical
      .map((result) => {
        const source = result.record.sourceKey
          ? sourceMap.get(result.record.sourceKey)
          : undefined;
        const semanticScore =
          semanticScores.get(result.record.id) ?? 0;
        const authorityScore = source?.authority ?? 0.4;
        const freshnessScore = calculateFreshness(result.record);
        const combinedScore =
          result.lexicalScore * 0.5 +
          semanticScore * 0.25 +
          authorityScore * 0.15 +
          freshnessScore * 0.1;

        return {
          ...result,
          semanticScore,
          authorityScore,
          freshnessScore,
          combinedScore
        };
      })
      .sort((left, right) =>
        right.combinedScore - left.combinedScore
      )
      .slice(0, limit);
  }
}

function calculateFreshness(record: KnowledgeRecord): number {
  if (record.validUntil) {
    return new Date(record.validUntil).getTime() >= Date.now()
      ? 1
      : 0;
  }

  const ageInDays =
    (Date.now() - new Date(record.updatedAt).getTime()) /
    86_400_000;

  if (!record.timeSensitive) {
    return Math.max(0.6, 1 - ageInDays / 3650);
  }

  return Math.max(0, 1 - ageInDays / 365);
}

export interface FaqSeedRecord {
  question: string;
  answer: string;
  category?: string;
  tags?: readonly string[];
  source_url?: string | null;
  peildatum?: string;
}

export interface FaqSeedDataset {
  faqs: readonly FaqSeedRecord[];
}

export class FaqIngestionService {
  constructor(
    private readonly knowledge: KnowledgeRepository,
    private readonly sources: TrustedSourceRepository,
    private readonly embeddingIndexer?: {
      index(record: KnowledgeRecord): Promise<void>;
    }
  ) {}

  async ingest(
    dataset: FaqSeedDataset
  ): Promise<{
    imported: number;
    sourceKeys: readonly string[];
  }> {
    const sourceKeys = new Set<string>();

    for (const faq of dataset.faqs) {
      const tags = faq.tags ?? [];
      const sourceKey = inferSourceKey(faq.source_url, tags);
      sourceKeys.add(sourceKey);

      const now = new Date().toISOString();
      await this.sources.upsert({
        id: stableId(`source:${sourceKey}`),
        sourceKey,
        label: inferSourceLabel(sourceKey),
        baseUrl: faq.source_url
          ? new URL(faq.source_url).origin
          : undefined,
        authority: inferAuthority(tags, faq.source_url),
        active: true,
        allowedDomains: faq.source_url
          ? [new URL(faq.source_url).hostname]
          : [],
        createdAt: now,
        updatedAt: now
      });

      const record: KnowledgeRecord = {
        id: stableId(`faq:${faq.question}`),
        externalId: stableId(faq.question),
        title: faq.question.trim(),
        body: faq.answer.trim(),
        category: faq.category,
        tags,
        sourceKey,
        sourceUrl: faq.source_url ?? undefined,
        timeSensitive: tags.includes("time_sensitive:true"),
        requiresCitation:
          tags.includes("requires_citation:true") ||
          tags.includes("source:official"),
        validFrom: faq.peildatum
          ? `${faq.peildatum}-01T00:00:00.000Z`
          : undefined,
        reviewStatus: "approved",
        version: 1,
        createdAt: now,
        updatedAt: now
      };

      await this.knowledge.upsert(record);
      await this.embeddingIndexer?.index(record);
    }

    return {
      imported: dataset.faqs.length,
      sourceKeys: [...sourceKeys].sort()
    };
  }
}

function stableId(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `00000000-0000-4000-8000-${hex.padStart(12, "0")}`;
}

function inferSourceKey(
  sourceUrl: string | null | undefined,
  tags: readonly string[]
): string {
  if (!sourceUrl) return "door010-internal";

  const hostname = new URL(sourceUrl).hostname
    .replace(/^www\./, "")
    .replaceAll(".", "-");

  return tags.includes("source:official")
    ? `official-${hostname}`
    : `external-${hostname}`;
}

function inferSourceLabel(sourceKey: string): string {
  if (sourceKey === "door010-internal") {
    return "Door010 interne kennis";
  }

  return sourceKey
    .replace(/^official-/, "")
    .replace(/^external-/, "")
    .replaceAll("-", " ");
}

function inferAuthority(
  tags: readonly string[],
  sourceUrl: string | null | undefined
): number {
  if (tags.includes("source:official")) return 1;
  if (sourceUrl) return 0.8;
  return 0.6;
}

export class InMemoryKnowledgeRepository
  implements KnowledgeRepository
{
  private readonly records = new Map<string, KnowledgeRecord>();

  async upsert(record: KnowledgeRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async archive(id: string, updatedAt: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    this.records.set(id, {
      ...record,
      reviewStatus: "archived",
      updatedAt,
      version: record.version + 1
    });
  }

  async searchLexical(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

    return [...this.records.values()]
      .filter((record) =>
        (!options.category || record.category === options.category) &&
        (
          options.approvedOnly === false ||
          record.reviewStatus === "approved"
        )
      )
      .map((record) => {
        const lexical = lexicalSimilarity(query, record);
        return {
          record,
          lexicalScore: lexical.score,
          semanticScore: 0,
          authorityScore: 0,
          freshnessScore: 0,
          combinedScore: lexical.score,
          matchedTerms: lexical.matchedTerms
        };
      })
      .filter((result) => result.lexicalScore > 0)
      .sort((left, right) =>
        right.lexicalScore - left.lexicalScore
      )
      .slice(0, limit);
  }

  async list(options: {
    reviewStatus?: KnowledgeReviewStatus;
    limit?: number;
  } = {}): Promise<readonly KnowledgeRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          !options.reviewStatus ||
          record.reviewStatus === options.reviewStatus
      )
      .slice(0, Math.max(1, Math.min(options.limit ?? 100, 500)));
  }
}

export class InMemoryTrustedSourceRepository
  implements TrustedSourceRepository
{
  private readonly sources = new Map<string, TrustedSource>();

  async upsert(source: TrustedSource): Promise<void> {
    this.sources.set(source.sourceKey, source);
  }

  async findByKey(sourceKey: string): Promise<TrustedSource | null> {
    return this.sources.get(sourceKey) ?? null;
  }

  async list(activeOnly = false): Promise<readonly TrustedSource[]> {
    return [...this.sources.values()]
      .filter((source) => !activeOnly || source.active)
      .sort((left, right) =>
        right.authority - left.authority
      );
  }
}

export class PostgresKnowledgeRepository
  implements KnowledgeRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async archive(id: string, updatedAt: string): Promise<void> {
    await this.executor.query(
      `UPDATE knowledge_items
       SET
         review_status = 'archived',
         version = version + 1,
         updated_at = $2
       WHERE id = $1`,
      [id, updatedAt]
    );
  }

  async upsert(record: KnowledgeRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO knowledge_items (
         id, external_id, item_type, title, body, category, tags,
         source_key, source_url, time_sensitive,
         requires_citation, valid_from, valid_until,
         review_status, version, created_at, updated_at
       ) VALUES (
         $1, $2, 'faq', $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16
       )
       ON CONFLICT (id) DO UPDATE SET
         external_id = EXCLUDED.external_id,
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         category = EXCLUDED.category,
         tags = EXCLUDED.tags,
         source_key = EXCLUDED.source_key,
         source_url = EXCLUDED.source_url,
         time_sensitive = EXCLUDED.time_sensitive,
         requires_citation = EXCLUDED.requires_citation,
         valid_from = EXCLUDED.valid_from,
         valid_until = EXCLUDED.valid_until,
         review_status = EXCLUDED.review_status,
         version = knowledge_items.version + 1,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.externalId ?? null,
        record.title,
        record.body,
        record.category ?? null,
        record.tags,
        record.sourceKey ?? null,
        record.sourceUrl ?? null,
        record.timeSensitive,
        record.requiresCitation,
        record.validFrom ?? null,
        record.validUntil ?? null,
        record.reviewStatus,
        record.version,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async searchLexical(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const result = await this.executor.query<KnowledgeRow & {
      lexical_score: number;
    }>(
      `SELECT *,
              ts_rank_cd(
                search_vector,
                plainto_tsquery('dutch', $1)
              ) AS lexical_score
       FROM knowledge_items
       WHERE search_vector @@ plainto_tsquery('dutch', $1)
         AND ($2::text IS NULL OR category = $2)
         AND (
           $3::boolean = false OR
           review_status = 'approved'
         )
         AND (
           valid_from IS NULL OR
           valid_from <= now()
         )
         AND (
           valid_until IS NULL OR
           valid_until > now()
         )
       ORDER BY lexical_score DESC, updated_at DESC
       LIMIT $4`,
      [
        query,
        options.category ?? null,
        options.approvedOnly ?? true,
        Math.max(1, Math.min(options.limit ?? 20, 100))
      ]
    );

    return result.rows.map((row) => ({
      record: mapKnowledgeRow(row),
      lexicalScore: Number(row.lexical_score),
      semanticScore: 0,
      authorityScore: 0,
      freshnessScore: 0,
      combinedScore: Number(row.lexical_score),
      matchedTerms: normalizeTerms(query).filter((term) =>
        `${row.title} ${row.body} ${row.tags.join(" ")}`
          .toLocaleLowerCase("nl")
          .includes(term)
      )
    }));
  }

  async list(options: {
    reviewStatus?: KnowledgeReviewStatus;
    limit?: number;
  } = {}): Promise<readonly KnowledgeRecord[]> {
    const result = await this.executor.query<KnowledgeRow>(
      `SELECT *
       FROM knowledge_items
       WHERE ($1::text IS NULL OR review_status = $1)
       ORDER BY updated_at DESC
       LIMIT $2`,
      [
        options.reviewStatus ?? null,
        Math.max(1, Math.min(options.limit ?? 100, 500))
      ]
    );

    return result.rows.map(mapKnowledgeRow);
  }
}

interface KnowledgeRow {
  id: string;
  external_id: string | null;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  source_key: string | null;
  source_url: string | null;
  time_sensitive: boolean;
  requires_citation: boolean;
  valid_from: string | Date | null;
  valid_until: string | Date | null;
  review_status: KnowledgeReviewStatus;
  version: number;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapKnowledgeRow(row: KnowledgeRow): KnowledgeRecord {
  return {
    id: row.id,
    externalId: row.external_id ?? undefined,
    title: row.title,
    body: row.body,
    category: row.category ?? undefined,
    tags: row.tags,
    sourceKey: row.source_key ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    timeSensitive: row.time_sensitive,
    requiresCitation: row.requires_citation,
    validFrom: row.valid_from
      ? toIso(row.valid_from)
      : undefined,
    validUntil: row.valid_until
      ? toIso(row.valid_until)
      : undefined,
    reviewStatus: row.review_status,
    version: row.version,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export class PostgresTrustedSourceRepository
  implements TrustedSourceRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async upsert(source: TrustedSource): Promise<void> {
    await this.executor.query(
      `INSERT INTO trusted_sources (
         id, source_key, label, base_url, authority,
         active, allowed_domains, notes, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
       )
       ON CONFLICT (source_key) DO UPDATE SET
         label = EXCLUDED.label,
         base_url = EXCLUDED.base_url,
         authority = EXCLUDED.authority,
         active = EXCLUDED.active,
         allowed_domains = EXCLUDED.allowed_domains,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at`,
      [
        source.id,
        source.sourceKey,
        source.label,
        source.baseUrl ?? null,
        source.authority,
        source.active,
        source.allowedDomains,
        source.notes ?? null,
        source.createdAt,
        source.updatedAt
      ]
    );
  }

  async findByKey(sourceKey: string): Promise<TrustedSource | null> {
    const result = await this.executor.query<TrustedSourceRow>(
      `SELECT *
       FROM trusted_sources
       WHERE source_key = $1
       LIMIT 1`,
      [sourceKey]
    );

    return result.rows[0]
      ? mapTrustedSourceRow(result.rows[0])
      : null;
  }

  async list(activeOnly = false): Promise<readonly TrustedSource[]> {
    const result = await this.executor.query<TrustedSourceRow>(
      `SELECT *
       FROM trusted_sources
       WHERE ($1::boolean = false OR active = true)
       ORDER BY authority DESC, label`,
      [activeOnly]
    );

    return result.rows.map(mapTrustedSourceRow);
  }
}

interface TrustedSourceRow {
  id: string;
  source_key: string;
  label: string;
  base_url: string | null;
  authority: number;
  active: boolean;
  allowed_domains: string[];
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapTrustedSourceRow(row: TrustedSourceRow): TrustedSource {
  return {
    id: row.id,
    sourceKey: row.source_key,
    label: row.label,
    baseUrl: row.base_url ?? undefined,
    authority: Number(row.authority),
    active: row.active,
    allowedDomains: row.allowed_domains,
    notes: row.notes ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

export class RetrievalAnswerDraftProvider
  implements AnswerDraftProvider
{
  constructor(
    private readonly search: KnowledgeSearch,
    private readonly fallback: AnswerDraftProvider
  ) {}

  async createDraft(
    chatbotKey: "general-coach" | "personal-journey-coach",
    request: ChatRequest,
    context: ChatContext,
    phase?: AdaptivePhaseDetectorResult,
    route?: RouteEngineResult,
    systemPrompt?: string
  ): Promise<AnswerDraft> {
    const results = await this.search.search(request.message, {
      limit: 3,
      approvedOnly: true
    });

    if (results.length === 0) {
      return this.fallback.createDraft(
        chatbotKey,
        request,
        context,
        phase,
        route,
        systemPrompt
      );
    }

    const best = results[0]!;
    const supportingDetail = [
      systemPrompt
        ? `Actieve coachinstructie: ${systemPrompt}`
        : undefined,
      ...results
        .slice(1)
        .map((result) => result.record.body)
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n\n");

    const verifiedLinks: VerifiedLink[] = results
      .filter((result) => result.record.sourceUrl)
      .map((result) => ({
        label: result.record.title,
        href: result.record.sourceUrl!,
        sourceKey:
          result.record.sourceKey ?? "door010-knowledge"
      }));

    const sources: SourceReference[] = results.map((result) => ({
      provider:
        result.record.sourceKey ?? "door010-knowledge",
      externalId:
        result.record.externalId ?? result.record.id,
      sourceUrl: result.record.sourceUrl,
      retrievedAt: result.record.updatedAt,
      validFrom: result.record.validFrom,
      validUntil: result.record.validUntil,
      version: String(result.record.version)
    }));

    return {
      directAnswer: best.record.body,
      supportingDetail: supportingDetail || undefined,
      verifiedLinks,
      sources
    };
  }
}

export type ConversationIntent =
  | "greeting"
  | "question"
  | "exploration"
  | "followup";

export interface PipelineEvent {
  id: string;
  pipelineKey: string;
  stage: string;
  level: "info" | "warning" | "error";
  message: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface PipelineEventRepository {
  append(event: PipelineEvent): Promise<void>;
  list(limit?: number): Promise<readonly PipelineEvent[]>;
}

export class InMemoryPipelineEventRepository
  implements PipelineEventRepository
{
  private readonly events: PipelineEvent[] = [];

  async append(event: PipelineEvent): Promise<void> {
    this.events.push(event);
  }

  async list(limit = 100): Promise<readonly PipelineEvent[]> {
    return [...this.events]
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }
}

export class PostgresPipelineEventRepository
  implements PipelineEventRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async append(event: PipelineEvent): Promise<void> {
    await this.executor.query(
      `INSERT INTO ai_pipeline_events (
         id, pipeline_key, stage, level,
         message, metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        event.id,
        event.pipelineKey,
        event.stage,
        event.level,
        event.message,
        JSON.stringify(event.metadata),
        event.createdAt
      ]
    );
  }

  async list(limit = 100): Promise<readonly PipelineEvent[]> {
    const result = await this.executor.query<{
      id: string;
      pipeline_key: string;
      stage: string;
      level: "info" | "warning" | "error";
      message: string;
      metadata: unknown;
      created_at: string | Date;
    }>(
      `SELECT *
       FROM ai_pipeline_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 500))]
    );

    return result.rows.map((row) => ({
      id: row.id,
      pipelineKey: row.pipeline_key,
      stage: row.stage,
      level: row.level,
      message: row.message,
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? row.metadata as Readonly<Record<string, unknown>>
          : {},
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at
    }));
  }
}

export interface IntentModel {
  classify(
    messages: readonly { role: string; content: string }[]
  ): Promise<ConversationIntent>;
}

const GREETING_PATTERN =
  /^(hoi|hey|hallo|hi|goedemorgen|goedemiddag|goedenavond|welkom|dag)\b/i;
const FOLLOWUP_PATTERN =
  /^(ja|nee|en|maar|ok|oke|prima|goed|dank|bedankt|thanks|klopt)\b/i;

export function heuristicIntent(message: string): ConversationIntent {
  const trimmed = message.trim();
  if (trimmed.length < 15 && GREETING_PATTERN.test(trimmed)) {
    return "greeting";
  }
  if (trimmed.length < 25 && FOLLOWUP_PATTERN.test(trimmed)) {
    return "followup";
  }
  if (
    trimmed.includes("?") ||
    /\b(wat|hoe|waar|wanneer|welke|kan ik|moet ik|is het)\b/i
      .test(trimmed)
  ) {
    return "question";
  }
  return "exploration";
}

export class IntentRouter {
  constructor(
    private readonly model?: IntentModel,
    private readonly events?: PipelineEventRepository
  ) {}

  async classify(
    messages: readonly { role: string; content: string }[]
  ): Promise<ConversationIntent> {
    const latest =
      [...messages].reverse().find((item) => item.role === "user")
        ?.content ?? "";
    const fallback = heuristicIntent(latest);

    if (!this.model) {
      await this.log("intent", "info", "Heuristic intent selected", {
        intent: fallback
      });
      return fallback;
    }

    try {
      const intent = await this.model.classify(messages.slice(-5));
      await this.log("intent", "info", "Model intent selected", {
        intent
      });
      return intent;
    } catch (error) {
      await this.log("intent", "warning", "Intent model fallback", {
        intent: fallback,
        error: error instanceof Error ? error.message : "unknown"
      });
      return fallback;
    }
  }

  private async log(
    stage: string,
    level: PipelineEvent["level"],
    message: string,
    metadata: Readonly<Record<string, unknown>>
  ): Promise<void> {
    await this.events?.append({
      id: crypto.randomUUID(),
      pipelineKey: "doorai-chat",
      stage,
      level,
      message,
      metadata,
      createdAt: new Date().toISOString()
    });
  }
}

export interface RerankModel {
  select(
    query: string,
    candidates: readonly KnowledgeSearchResult[],
    limit: number
  ): Promise<readonly number[]>;
}

export class ConditionalFaqReranker {
  constructor(
    private readonly model?: RerankModel,
    private readonly events?: PipelineEventRepository
  ) {}

  async rerank(
    query: string,
    candidates: readonly KnowledgeSearchResult[],
    limit = 3
  ): Promise<readonly KnowledgeSearchResult[]> {
    if (candidates.length <= limit) return candidates;

    const top = candidates[0]?.lexicalScore ?? 0;
    const third = candidates[Math.min(2, candidates.length - 1)]
      ?.lexicalScore ?? 0;
    const uncertain =
      top > 0 && third > 0 && top / third < 2;

    if (!uncertain || !this.model) {
      await this.log("rerank", "info", "Lexical order retained", {
        uncertain,
        candidateCount: candidates.length
      });
      return candidates.slice(0, limit);
    }

    try {
      const indices = await this.model.select(
        query,
        candidates,
        limit
      );
      const selected = [...new Set(indices)]
        .filter((index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < candidates.length
        )
        .slice(0, limit)
        .map((index) => candidates[index]!)
        .filter(Boolean);

      if (selected.length === limit) {
        await this.log("rerank", "info", "Model reranking applied", {
          indices
        });
        return selected;
      }
    } catch (error) {
      await this.log("rerank", "warning", "Reranking fallback", {
        error: error instanceof Error ? error.message : "unknown"
      });
    }

    return candidates.slice(0, limit);
  }

  private async log(
    stage: string,
    level: PipelineEvent["level"],
    message: string,
    metadata: Readonly<Record<string, unknown>>
  ): Promise<void> {
    await this.events?.append({
      id: crypto.randomUUID(),
      pipelineKey: "doorai-chat",
      stage,
      level,
      message,
      metadata,
      createdAt: new Date().toISOString()
    });
  }
}

export interface WebKnowledgeResult {
  title: string;
  text: string;
  sourceUrl?: string;
  sourceKey: string;
  retrievedAt: string;
}

export interface TrustedWebSearch {
  search(
    query: string,
    allowedDomains: readonly string[],
    limit?: number
  ): Promise<readonly WebKnowledgeResult[]>;
}

export class EmptyTrustedWebSearch implements TrustedWebSearch {
  async search(): Promise<readonly WebKnowledgeResult[]> {
    return [];
  }
}

const TIME_SENSITIVE_PATTERN =
  /\b(salaris|verdien|loon|cao|collegegeld|kosten|subsidie|lerarentekort|tekort|vacature|20\d{2})\b/i;

function ageInMonths(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(
    0,
    (Date.now() - date.getTime()) / (30.4375 * 86_400_000)
  );
}

export interface AdaptiveRetrievalResult {
  intent: ConversationIntent;
  internal: readonly KnowledgeSearchResult[];
  external: readonly WebKnowledgeResult[];
  sourceHierarchy: readonly string[];
  webFallbackReason?: "sparse" | "time-sensitive" | "stale";
}

export class AdaptiveRetrievalPipeline {
  constructor(
    private readonly search: KnowledgeSearch,
    private readonly sources: TrustedSourceRepository,
    private readonly intentRouter: IntentRouter,
    private readonly reranker: ConditionalFaqReranker,
    private readonly web: TrustedWebSearch =
      new EmptyTrustedWebSearch(),
    private readonly events?: PipelineEventRepository
  ) {}

  async retrieve(
    query: string,
    messages: readonly { role: string; content: string }[] = [
      { role: "user", content: query }
    ]
  ): Promise<AdaptiveRetrievalResult> {
    const intent = await this.intentRouter.classify(messages);
    if (intent === "greeting") {
      return {
        intent,
        internal: [],
        external: [],
        sourceHierarchy: []
      };
    }

    const candidates = await this.search.search(query, {
      limit: 10,
      approvedOnly: true
    });
    const internal = await this.reranker.rerank(
      query,
      candidates,
      3
    );
    const sourceList = await this.sources.list(true);
    const allowedDomains = [
      ...new Set(
        sourceList.flatMap((source) => source.allowedDomains)
      )
    ].slice(0, 20);

    const sparse = internal.length < 2;
    const timeSensitive = TIME_SENSITIVE_PATTERN.test(query);
    const stale = internal.some((item) =>
      ageInMonths(
        item.record.validFrom ?? item.record.updatedAt
      ) >= 12
    );

    const reason = timeSensitive
      ? "time-sensitive"
      : stale
        ? "stale"
        : sparse
          ? "sparse"
          : undefined;

    const external =
      reason && allowedDomains.length > 0
        ? await this.web.search(query, allowedDomains, 3)
        : [];

    await this.events?.append({
      id: crypto.randomUUID(),
      pipelineKey: "doorai-chat",
      stage: "retrieval",
      level: "info",
      message: "Adaptive retrieval completed",
      metadata: {
        intent,
        candidates: candidates.length,
        internal: internal.length,
        external: external.length,
        reason
      },
      createdAt: new Date().toISOString()
    });

    return {
      intent,
      internal,
      external,
      sourceHierarchy: [
        ...(external.length > 0 ? ["external-fresh"] : []),
        ...(internal.length > 0 ? ["internal-faq"] : []),
        "static-ssot"
      ],
      webFallbackReason: reason
    };
  }
}

export interface AnswerRepairModel {
  repair(
    draft: string,
    issues: readonly string[],
    maxSentences: number
  ): Promise<string>;
}

export interface AnswerValidationResult {
  pass: boolean;
  issues: readonly string[];
  repaired: boolean;
  answer: string;
}

const DEFAULT_FORBIDDEN_TERMS = [
  "achtergrondinformatie",
  "dynamische context",
  "system prompt",
  "interne instructie"
] as const;

export class AnswerValidationPipeline {
  constructor(
    private readonly repairModel?: AnswerRepairModel,
    private readonly forbiddenTerms: readonly string[] =
      DEFAULT_FORBIDDEN_TERMS,
    private readonly events?: PipelineEventRepository
  ) {}

  async validateAndRepair(
    draft: string,
    intent: ConversationIntent
  ): Promise<AnswerValidationResult> {
    const maxSentences: Record<ConversationIntent, number> = {
      greeting: 2,
      question: 4,
      exploration: 3,
      followup: 3
    };
    const maximum = maxSentences[intent];
    const initialIssues = this.validate(draft, maximum);
    let answer = this.localRepair(draft, maximum);

    if (
      initialIssues.some((issue) =>
        issue.startsWith("forbidden:")
      ) &&
      this.repairModel
    ) {
      try {
        answer = await this.repairModel.repair(
          answer,
          initialIssues,
          maximum
        );
      } catch {
        // Local repair remains the deterministic fallback.
      }
    }

    answer = this.localRepair(answer, maximum);
    const finalIssues = this.validate(answer, maximum);

    await this.events?.append({
      id: crypto.randomUUID(),
      pipelineKey: "doorai-chat",
      stage: "reflection",
      level: finalIssues.length === 0 ? "info" : "warning",
      message:
        finalIssues.length === 0
          ? "Answer validation passed"
          : "Answer validation retained issues",
      metadata: {
        initialIssues,
        finalIssues,
        repaired: initialIssues.length > 0
      },
      createdAt: new Date().toISOString()
    });

    return {
      pass: finalIssues.length === 0,
      issues: finalIssues,
      repaired: initialIssues.length > 0 && finalIssues.length === 0,
      answer
    };
  }

  private validate(
    draft: string,
    maxSentences: number
  ): readonly string[] {
    const issues: string[] = [];
    const lower = draft.toLocaleLowerCase("nl");

    for (const phrase of this.forbiddenTerms) {
      if (lower.includes(phrase.toLocaleLowerCase("nl"))) {
        issues.push(`forbidden:${phrase}`);
      }
    }

    if (/\[[A-Z][^\]]{1,30}\]/.test(draft)) {
      issues.push("bracket-label");
    }
    if (/[\u2014\u2013]/.test(draft)) {
      issues.push("dash");
    }

    const sentences = draft
      .split(/[.!?]+/)
      .filter((sentence) => sentence.trim().length > 5);

    if (sentences.length > maxSentences) {
      issues.push(`sentence-limit:${sentences.length}`);
    }

    return issues;
  }

  private localRepair(
    value: string,
    maxSentences: number
  ): string {
    let answer = value
      .replace(/\[[A-Z][^\]]{1,30}\]\s*/g, "")
      .replace(/[\u2014\u2013]/g, "-");

    for (const phrase of this.forbiddenTerms) {
      answer = answer.replace(
        new RegExp(
          phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "gi"
        ),
        ""
      );
    }

    const sentences = answer
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) => sentence.trim().length > 0);

    return sentences
      .slice(0, maxSentences)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}

export interface RetrievalEvaluationCase {
  query: string;
  relevantIds: readonly string[];
}

export interface RetrievalEvaluationMetrics {
  recallAtK: number;
  meanReciprocalRank: number;
  ndcgAtK: number;
  evaluatedCases: number;
}

export async function evaluateRetrieval(
  search: KnowledgeSearch,
  cases: readonly RetrievalEvaluationCase[],
  k = 5
): Promise<RetrievalEvaluationMetrics> {
  if (cases.length === 0) {
    return {
      recallAtK: 0,
      meanReciprocalRank: 0,
      ndcgAtK: 0,
      evaluatedCases: 0
    };
  }

  let recall = 0;
  let reciprocalRank = 0;
  let ndcg = 0;

  for (const testCase of cases) {
    const results = await search.search(testCase.query, {
      limit: k,
      approvedOnly: true
    });
    const ids = results.map((item) => item.record.id);
    const hits = ids.filter((id) =>
      testCase.relevantIds.includes(id)
    );

    recall += testCase.relevantIds.length === 0
      ? 0
      : hits.length / testCase.relevantIds.length;

    const firstRelevant = ids.findIndex((id) =>
      testCase.relevantIds.includes(id)
    );
    reciprocalRank += firstRelevant >= 0
      ? 1 / (firstRelevant + 1)
      : 0;

    const dcg = ids.reduce((score, id, index) => {
      const relevance = testCase.relevantIds.includes(id) ? 1 : 0;
      return score + relevance / Math.log2(index + 2);
    }, 0);
    const idealHits = Math.min(k, testCase.relevantIds.length);
    const idcg = Array.from(
      { length: idealHits },
      (_, index) => 1 / Math.log2(index + 2)
    ).reduce((sum, value) => sum + value, 0);
    ndcg += idcg === 0 ? 0 : dcg / idcg;
  }

  return {
    recallAtK: recall / cases.length,
    meanReciprocalRank: reciprocalRank / cases.length,
    ndcgAtK: ndcg / cases.length,
    evaluatedCases: cases.length
  };
}

export class AdaptiveRetrievalAnswerDraftProvider
  implements AnswerDraftProvider
{
  constructor(
    private readonly retrieval: AdaptiveRetrievalPipeline,
    private readonly generator: AnswerDraftProvider,
    private readonly validator: AnswerValidationPipeline
  ) {}

  async createDraft(
    chatbotKey: "general-coach" | "personal-journey-coach",
    request: ChatRequest,
    context: ChatContext,
    phase?: AdaptivePhaseDetectorResult,
    route?: RouteEngineResult,
    systemPrompt?: string
  ): Promise<AnswerDraft> {
    const retrieval = await this.retrieval.retrieve(
      request.message
    );
    const contextSections = [
      retrieval.external.length > 0
        ? [
            "## Verse externe bronnen",
            "Deze zijn leidend bij tegenspraak.",
            ...retrieval.external.map((item) =>
              `- ${item.title}: ${item.text}`
            )
          ].join("\n")
        : undefined,
      retrieval.internal.length > 0
        ? [
            "## Interne bronnen",
            ...retrieval.internal.map((item) =>
              `- ${item.record.title}: ${item.record.body}`
            )
          ].join("\n")
        : undefined,
      `Bronhiërarchie: ${retrieval.sourceHierarchy.join(" > ")}`
    ].filter((value): value is string => Boolean(value));

    const generated = await this.generator.createDraft(
      chatbotKey,
      request,
      context,
      phase,
      route,
      [systemPrompt, ...contextSections]
        .filter((value): value is string => Boolean(value))
        .join("\n\n")
    );

    const validated = await this.validator.validateAndRepair(
      generated.directAnswer,
      retrieval.intent
    );

    const sources: SourceReference[] = [
      ...retrieval.external.map((item) => ({
        provider: item.sourceKey,
        externalId: item.sourceUrl ?? item.title,
        sourceUrl: item.sourceUrl,
        retrievedAt: item.retrievedAt
      })),
      ...retrieval.internal.map((item) => ({
        provider:
          item.record.sourceKey ?? "door010-knowledge",
        externalId:
          item.record.externalId ?? item.record.id,
        sourceUrl: item.record.sourceUrl,
        retrievedAt: item.record.updatedAt,
        validFrom: item.record.validFrom,
        validUntil: item.record.validUntil,
        version: String(item.record.version)
      }))
    ];

    const verifiedLinks: VerifiedLink[] = [
      ...retrieval.external
        .filter((item) => item.sourceUrl)
        .map((item) => ({
          label: item.title,
          href: item.sourceUrl!,
          sourceKey: item.sourceKey
        })),
      ...retrieval.internal
        .filter((item) => item.record.sourceUrl)
        .map((item) => ({
          label: item.record.title,
          href: item.record.sourceUrl!,
          sourceKey:
            item.record.sourceKey ?? "door010-knowledge"
        }))
    ].slice(0, 3);

    return {
      directAnswer: validated.answer,
      supportingDetail: generated.supportingDetail,
      verifiedLinks,
      sources
    };
  }
}

export interface EmbeddingProvider {
  readonly modelKey: string;
  readonly dimensions: number;
  embed(texts: readonly string[]): Promise<readonly number[][]>;
}

export interface KnowledgeEmbeddingRepository {
  upsert(input: {
    knowledgeItemId: string;
    modelKey: string;
    embedding: readonly number[];
    contentHash: string;
    updatedAt: string;
  }): Promise<void>;
  search(
    embedding: readonly number[],
    modelKey: string,
    options?: SearchOptions
  ): Promise<readonly KnowledgeSearchResult[]>;
}

export interface FuzzyKnowledgeRepository {
  searchFuzzy(
    query: string,
    options?: SearchOptions
  ): Promise<readonly KnowledgeSearchResult[]>;
}

function fnv1a(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const SEMANTIC_CONCEPTS: Readonly<Record<string, readonly string[]>> = {
  teacher: [
    "leraar", "docent", "juf", "meester", "lesgeven", "klas"
  ],
  education: [
    "opleiding", "studie", "leren", "college", "bachelor", "master"
  ],
  qualification: [
    "bevoegd", "bevoegdheid", "bekwaam", "diploma", "toelating",
    "lesbevoegdheid", "bevoegd zijn"
  ],
  career_change: [
    "omscholen", "omscholing", "overstap", "zij-instroom",
    "zijinstroom", "werken en leren", "meteen werken",
    "direct werken", "meteen als leraar"
  ],
  next_step: [
    "wat nu", "volgende stap", "volgende stappen", "waar begin ik",
    "na orientatie", "na oriëntatie", "vervolgstap",
    "vervolgstappen", "georiënteerd", "georienteerd", "hierna"
  ],
  salary: [
    "salaris", "loon", "verdienen", "inkomen", "uitbetaling",
    "beloning", "beloningen"
  ],
  cost: [
    "kosten", "kost", "betalen", "collegegeld", "gratis",
    "betaal", "uitgaven", "prijs", "zelf betalen",
    "rekening houden"
  ],
  subsidy: [
    "subsidie", "vergoeding", "regeling", "financieel", "steun"
  ],
  primary: [
    "basisschool", "primair", "pabo", "po", "juf", "meester"
  ],
  secondary: [
    "middelbare", "voortgezet", "vo", "havo", "vwo", "vmbo"
  ],
  vocational: [
    "mbo", "beroepsonderwijs", "pdg", "praktijk"
  ],
  higher: [
    "hbo", "universiteit", "hoger onderwijs", "hogeschool"
  ],
  employment: [
    "baan", "vacature", "vakature", "arbeidsmarkt", "werk",
    "tekort", "veel leraren nodig", "schoolvakken"
  ],
  work_schedule: [
    "werkweek", "werktijden", "dagen werken", "combineren",
    "opleiding naast werk", "werkdag", "normale werktijden",
    "combineer", "weekindeling", "opleidingsdagen", "werkdagen"
  ],
  extra_pay: [
    "vakantiegeld", "eindejaarsuitkering", "extra uitkering",
    "extra uitkeringen", "extra beloning"
  ],
  guidance: [
    "advies", "adviseur", "loket", "begeleiding", "gesprek"
  ],
  duration: [
    "duur", "hoelang", "hoe lang", "tijd", "jaar",
    "doorlooptijd", "hoeveel tijd", "binnen hoeveel",
    "hoe snel", "klaar ben", "tijd reserveren"
  ],
  suitability: [
    "geschikt", "past bij mij", "oriëntatie", "verkennen"
  ],
  foreign: [
    "buitenland", "buitenlands", "erkenning", "nederland"
  ],
  returner: [
    "herintreder", "terugkeren", "weer voor de klas"
  ],
  leadership: [
    "schoolleider", "directeur", "leidinggeven"
  ],
  internship: [
    "stage", "lio", "meelopen", "open dag", "meeloopdag",
    "meeloopdagen", "open dagen", "schooldag ervaren",
    "schooldag eruitziet", "schooldag eruit"
  ],
  route_comparison: [
    "deeltijd", "werken en leren", "verschil", "kiezen"
  ],
  pedagogy_certificate: [
    "pdg", "mbo zonder lerarenopleiding", "pedagogisch didactisch",
    "getuigschrift", "zonder lerarenopleiding"
  ],
  definition: [
    "wat is", "uitleg", "wat houdt", "betekenis", "precies in",
    "wat betekent"
  ],
  resources: [
    "bronnen", "bronne", "tools", "websites", "hulpmiddelen",
    "links", "informatiebronnen"
  ],
  screening: [
    "vog", "verklaring omtrent gedrag", "verklaring omtrent het gedrag"
  ],
  degree_level: [
    "eerstegraads", "tweedegraads", "eerste graads",
    "tweede graads", "onderbouw", "bovenbouw",
    "eerste- en tweedegraads"
  ],
  admission: [
    "toelatingseisen", "voorwaarden", "voldoen", "eisen",
    "toegelaten", "starten met"
  ],
  subject_match: [
    "verwant", "vooropleiding", "aansluit", "aansluiten",
    "vakinhoudelijk", "passende vakopleiding", "huidige studie",
    "geschikt voor een schoolvak", "mijn studie"
  ],
  regional: [
    "regio", "regionaal", "buurt", "rotterdam", "in de buurt",
    "eigen regio"
  ]
};

const DUTCH_STOPWORDS: ReadonlySet<string> = new Set([
  "de", "het", "een", "en", "of", "maar", "want", "dus", "als",
  "dan", "dat", "die", "dit", "deze", "er", "hier", "daar",
  "waar", "wat", "wie", "hoe", "waarom", "wanneer", "welke",
  "welk", "ik", "je", "jij", "jouw", "jou", "mijn", "mij", "me",
  "u", "uw", "we", "wij", "ons", "onze", "ze", "hun", "hen",
  "is", "ben", "bent", "zijn", "was", "waren", "word", "wordt",
  "worden", "heb", "hebt", "heeft", "hebben", "had", "hadden",
  "kan", "kun", "kunt", "kunnen", "kon", "moet", "moeten",
  "mag", "mogen", "wil", "wilt", "willen", "zal", "zul", "zou",
  "zouden", "ga", "gaat", "gaan", "doe", "doet", "doen", "aan",
  "af", "bij", "in", "op", "uit", "van", "voor", "naar", "met",
  "over", "onder", "tussen", "door", "om", "te", "tot", "per",
  "niet", "geen", "wel", "ook", "nog", "al", "alleen", "zelf",
  "zo", "heel", "erg", "even", "vaak", "soms", "altijd",
  "nooit", "iets", "iemand", "kun je", "mijzelf"
]);

const TYPO_NORMALIZATIONS: Readonly<Record<string, string>> = {
  trajekt: "traject",
  oplijding: "opleiding",
  vakature: "vacature",
  bronne: "bronnen",
  intreder: "herintreder",
  "her intreder": "herintreder",
  "zij instroom": "zij-instroom",
  "tweede graads": "tweedegraads",
  "kop oplijding": "kopopleiding",
  "onderwijs ondersteuner": "onderwijsondersteuner"
};

function normalizeSemanticText(value: string): string {
  let normalized = value
    .toLocaleLowerCase("nl")
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

  for (const [incorrect, corrected] of Object.entries(
    TYPO_NORMALIZATIONS
  )) {
    normalized = normalized.replaceAll(incorrect, corrected);
  }

  return normalized;
}

const CONCEPT_FEATURE_WEIGHT = 2.5;
const WORD_FEATURE_WEIGHT = 1;
const SUBWORD_FEATURE_WEIGHT = 0.2;
const SUBWORD_MIN_GRAM = 4;
const SUBWORD_MAX_GRAM = 5;

function subwordGrams(word: string): readonly string[] {
  const padded = `<${word}>`;
  const grams: string[] = [];

  for (
    let size = SUBWORD_MIN_GRAM;
    size <= SUBWORD_MAX_GRAM;
    size += 1
  ) {
    for (
      let start = 0;
      start + size <= padded.length;
      start += 1
    ) {
      grams.push(`gram:${padded.slice(start, start + size)}`);
    }
  }

  return grams;
}

function semanticFeatures(
  value: string
): ReadonlyMap<string, number> {
  const normalized = normalizeSemanticText(value);
  const features = new Map<string, number>();
  const add = (feature: string, weight: number) => {
    features.set(feature, (features.get(feature) ?? 0) + weight);
  };

  for (const [concept, phrases] of Object.entries(SEMANTIC_CONCEPTS)) {
    if (phrases.some((phrase) => normalized.includes(phrase))) {
      add(`concept:${concept}`, CONCEPT_FEATURE_WEIGHT);
    }
  }

  const contentWords = normalized
    .split(" ")
    .filter(Boolean)
    .filter((word) => !DUTCH_STOPWORDS.has(word));

  for (const word of contentWords) {
    add(word, WORD_FEATURE_WEIGHT);
  }

  for (const word of new Set(contentWords)) {
    if (word.length >= SUBWORD_MIN_GRAM + 1) {
      for (const gram of subwordGrams(word)) {
        add(gram, SUBWORD_FEATURE_WEIGHT);
      }
    }
  }

  return features;
}

function semanticTokens(value: string): readonly string[] {
  return [...semanticFeatures(value).keys()];
}

function normalizeVector(vector: number[]): readonly number[] {
  const norm = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0)
  );
  return norm === 0
    ? vector
    : vector.map((value) => value / norm);
}

export class LocalSemanticEmbeddingProvider
  implements EmbeddingProvider
{
  readonly modelKey = "door010-local-semantic-v2";
  readonly dimensions: number;

  constructor(dimensions = 384) {
    this.dimensions = dimensions;
  }

  async embed(
    texts: readonly string[]
  ): Promise<readonly number[][]> {
    return texts.map((text) => {
      const vector = Array<number>(this.dimensions).fill(0);

      for (const [feature, weight] of semanticFeatures(text)) {
        const hash = fnv1a(feature);
        const index = hash % this.dimensions;
        const sign = (hash & 1) === 0 ? 1 : -1;
        vector[index] = (vector[index] ?? 0) + sign * weight;
      }

      return [...normalizeVector(vector)];
    });
  }
}

function cosineSimilarity(
  left: readonly number[],
  right: readonly number[]
): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

const TITLE_EMPHASIS = 3;

function recordText(record: KnowledgeRecord): string {
  return [
    ...Array<string>(TITLE_EMPHASIS).fill(record.title),
    record.body,
    record.category ?? "",
    ...record.tags
  ].join(" ");
}

export class InMemoryKnowledgeEmbeddingRepository
  implements KnowledgeEmbeddingRepository
{
  private readonly vectors = new Map<string, {
    modelKey: string;
    embedding: readonly number[];
    contentHash: string;
    updatedAt: string;
    record?: KnowledgeRecord;
  }>();

  constructor(
    private readonly knowledge: KnowledgeRepository
  ) {}

  async upsert(input: {
    knowledgeItemId: string;
    modelKey: string;
    embedding: readonly number[];
    contentHash: string;
    updatedAt: string;
  }): Promise<void> {
    const records = await this.knowledge.list({ limit: 500 });
    const record = records.find(
      (item) => item.id === input.knowledgeItemId
    );
    this.vectors.set(input.knowledgeItemId, {
      ...input,
      record
    });
  }

  async search(
    embedding: readonly number[],
    modelKey: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

    return [...this.vectors.values()]
      .filter((item) =>
        item.modelKey === modelKey &&
        item.record &&
        (!options.category ||
          item.record.category === options.category) &&
        (
          options.approvedOnly === false ||
          item.record.reviewStatus === "approved"
        )
      )
      .map((item) => ({
        record: item.record!,
        lexicalScore: 0,
        semanticScore: cosineSimilarity(
          embedding,
          item.embedding
        ),
        authorityScore: 0,
        freshnessScore: 0,
        combinedScore: cosineSimilarity(
          embedding,
          item.embedding
        ),
        matchedTerms: []
      }))
      .sort((left, right) =>
        right.semanticScore - left.semanticScore
      )
      .slice(0, limit);
  }
}

export class PostgresKnowledgeEmbeddingRepository
  implements KnowledgeEmbeddingRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async upsert(input: {
    knowledgeItemId: string;
    modelKey: string;
    embedding: readonly number[];
    contentHash: string;
    updatedAt: string;
  }): Promise<void> {
    await this.executor.query(
      `INSERT INTO knowledge_embeddings (
         knowledge_item_id, model_key, dimensions,
         embedding, content_hash, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (knowledge_item_id) DO UPDATE SET
         model_key = EXCLUDED.model_key,
         dimensions = EXCLUDED.dimensions,
         embedding = EXCLUDED.embedding,
         content_hash = EXCLUDED.content_hash,
         updated_at = EXCLUDED.updated_at`,
      [
        input.knowledgeItemId,
        input.modelKey,
        input.embedding.length,
        input.embedding,
        input.contentHash,
        input.updatedAt
      ]
    );
  }

  async search(
    embedding: readonly number[],
    modelKey: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const result = await this.executor.query<KnowledgeRow & {
      similarity: number;
    }>(
      `SELECT *
       FROM search_knowledge_embeddings($1, $2, $3, $4)`,
      [
        embedding,
        modelKey,
        Math.max(1, Math.min(options.limit ?? 20, 100)),
        options.category ?? null
      ]
    );

    return result.rows.map((row) => ({
      record: mapKnowledgeRow(row),
      lexicalScore: 0,
      semanticScore: Number(row.similarity),
      authorityScore: 0,
      freshnessScore: 0,
      combinedScore: Number(row.similarity),
      matchedTerms: []
    }));
  }
}

function trigrams(value: string): readonly string[] {
  const normalized = `  ${normalizeSemanticText(value)}  `;
  const result = new Set<string>();

  for (let index = 0; index <= normalized.length - 3; index += 1) {
    result.add(normalized.slice(index, index + 3));
  }

  return [...result];
}

function trigramSimilarity(left: string, right: string): number {
  const leftSet = new Set(trigrams(left));
  const rightSet = new Set(trigrams(right));
  const intersection = [...leftSet].filter((item) =>
    rightSet.has(item)
  ).length;
  return Math.max(leftSet.size, rightSet.size, 1) === 0
    ? 0
    : intersection / Math.max(leftSet.size, rightSet.size, 1);
}

export class InMemoryFuzzyKnowledgeRepository
  implements FuzzyKnowledgeRepository
{
  constructor(private readonly knowledge: KnowledgeRepository) {}

  async searchFuzzy(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const records = await this.knowledge.list({ limit: 500 });
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

    return records
      .filter((record) =>
        (!options.category || record.category === options.category) &&
        (
          options.approvedOnly === false ||
          record.reviewStatus === "approved"
        )
      )
      .map((record) => {
        const score = trigramSimilarity(query, recordText(record));
        return {
          record,
          lexicalScore: score,
          semanticScore: 0,
          authorityScore: 0,
          freshnessScore: 0,
          combinedScore: score,
          matchedTerms: []
        };
      })
      .filter((result) => result.lexicalScore >= 0.08)
      .sort((left, right) =>
        right.lexicalScore - left.lexicalScore
      )
      .slice(0, limit);
  }
}

export class PostgresFuzzyKnowledgeRepository
  implements FuzzyKnowledgeRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async searchFuzzy(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const result = await this.executor.query<KnowledgeRow & {
      similarity: number;
    }>(
      `SELECT *
       FROM search_knowledge_fuzzy($1, $2, $3, $4)`,
      [
        query,
        Math.max(1, Math.min(options.limit ?? 20, 100)),
        0.08,
        options.category ?? null
      ]
    );

    return result.rows.map((row) => ({
      record: mapKnowledgeRow(row),
      lexicalScore: Number(row.similarity),
      semanticScore: 0,
      authorityScore: 0,
      freshnessScore: 0,
      combinedScore: Number(row.similarity),
      matchedTerms: []
    }));
  }
}

function reciprocalRankFusion(
  rankings: readonly (
    readonly KnowledgeSearchResult[]
  )[],
  rankConstant = 60
): readonly {
  result: KnowledgeSearchResult;
  score: number;
}[] {
  const scores = new Map<string, {
    result: KnowledgeSearchResult;
    score: number;
  }>();

  for (const ranking of rankings) {
    ranking.forEach((result, index) => {
      const current = scores.get(result.record.id);
      const score = 1 / (rankConstant + index + 1);

      scores.set(result.record.id, {
        result: current?.result ?? result,
        score: (current?.score ?? 0) + score
      });
    });
  }

  return [...scores.values()].sort(
    (left, right) => right.score - left.score
  );
}

export class ReciprocalRankFusionKnowledgeSearch {
  constructor(
    private readonly lexical: KnowledgeRepository,
    private readonly fuzzy: FuzzyKnowledgeRepository,
    private readonly embeddings: KnowledgeEmbeddingRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly sources: TrustedSourceRepository,
    private readonly rankConstant = 60
  ) {}

  async index(record: KnowledgeRecord): Promise<void> {
    const [embedding] = await this.embeddingProvider.embed([
      recordText(record)
    ]);
    if (!embedding) return;

    await this.embeddings.upsert({
      knowledgeItemId: record.id,
      modelKey: this.embeddingProvider.modelKey,
      embedding,
      contentHash: String(fnv1a(recordText(record))),
      updatedAt: new Date().toISOString()
    });
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
    const candidateLimit = Math.max(limit * 4, 20);
    const [queryEmbedding] = await this.embeddingProvider.embed([
      query
    ]);
    const [lexical, fuzzy, semantic, sourceList] =
      await Promise.all([
        this.lexical.searchLexical(query, {
          ...options,
          limit: candidateLimit
        }),
        this.fuzzy.searchFuzzy(query, {
          ...options,
          limit: candidateLimit
        }),
        queryEmbedding
          ? this.embeddings.search(
              queryEmbedding,
              this.embeddingProvider.modelKey,
              {
                ...options,
                limit: candidateLimit
              }
            )
          : Promise.resolve([]),
        this.sources.list(true)
      ]);

    const sourceMap = new Map(
      sourceList.map((source) => [source.sourceKey, source])
    );
    const fused = reciprocalRankFusion(
      [lexical, fuzzy, semantic],
      this.rankConstant
    );

    return fused
      .map(({ result, score }) => {
        const source = result.record.sourceKey
          ? sourceMap.get(result.record.sourceKey)
          : undefined;
        const freshnessScore = calculateFreshness(result.record);

        return {
          ...result,
          authorityScore: source?.authority ?? 0.4,
          freshnessScore,
          combinedScore:
            score +
            (source?.authority ?? 0.4) * 0.001 +
            freshnessScore * 0.001
        };
      })
      .sort((left, right) =>
        right.combinedScore - left.combinedScore
      )
      .slice(0, limit);
  }
}

export interface LearnedRerankerModel {
  version: string;
  featureNames: readonly string[];
  weights: readonly number[];
  bias: number;
  trainedAt: string;
  trainingCases: number;
  validationCases?: number;
  holdoutCases: number;
  splitStrategy?: string;
  bestValidationLoss?: number;
}

function learnedFeatureVector(
  query: string,
  candidate: KnowledgeSearchResult,
  rank: number
): readonly number[] {
  const queryTerms = new Set(normalizeTerms(query));
  const titleTerms = new Set(normalizeTerms(candidate.record.title));
  const bodyTerms = new Set(normalizeTerms(candidate.record.body));
  const tagTerms = new Set(
    candidate.record.tags.flatMap((tag) => normalizeTerms(tag))
  );
  const titleOverlap = [...queryTerms].filter((term) =>
    titleTerms.has(term)
  ).length / Math.max(queryTerms.size, 1);
  const bodyOverlap = [...queryTerms].filter((term) =>
    bodyTerms.has(term)
  ).length / Math.max(queryTerms.size, 1);
  const tagOverlap = [...queryTerms].filter((term) =>
    tagTerms.has(term)
  ).length / Math.max(queryTerms.size, 1);
  const normalizedQuery = normalizeSemanticText(query);
  const normalizedTitle = normalizeSemanticText(candidate.record.title);
  const conceptQuery = semanticTokens(query)
    .filter((token) => token.startsWith("concept:"));
  const conceptDocument = new Set(
    semanticTokens(recordText(candidate.record))
      .filter((token) => token.startsWith("concept:"))
  );
  const conceptOverlap = conceptQuery.filter((token) =>
    conceptDocument.has(token)
  ).length / Math.max(conceptQuery.length, 1);

  return [
    1 / Math.max(rank + 1, 1),
    candidate.combinedScore,
    titleOverlap,
    bodyOverlap,
    tagOverlap,
    trigramSimilarity(normalizedQuery, normalizedTitle),
    conceptOverlap,
    normalizedQuery === normalizedTitle ? 1 : 0,
    Math.min(normalizedQuery.length, normalizedTitle.length) /
      Math.max(normalizedQuery.length, normalizedTitle.length, 1),
    1
  ];
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exponential = Math.exp(-value);
    return 1 / (1 + exponential);
  }

  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

export class LearnedLinearKnowledgeReranker {
  constructor(private readonly model: LearnedRerankerModel) {
    if (
      model.featureNames.length !== model.weights.length ||
      model.weights.length !== 10
    ) {
      throw new Error("learned_reranker_model_invalid");
    }
  }

  rerank(
    query: string,
    candidates: readonly KnowledgeSearchResult[],
    limit = candidates.length
  ): readonly KnowledgeSearchResult[] {
    return candidates
      .map((candidate, index) => {
        const features = learnedFeatureVector(
          query,
          candidate,
          index
        );
        const linear = features.reduce(
          (sum, value, featureIndex) =>
            sum +
            value * (this.model.weights[featureIndex] ?? 0),
          this.model.bias
        );

        return {
          candidate,
          learnedScore: sigmoid(linear)
        };
      })
      .sort((left, right) =>
        right.learnedScore - left.learnedScore
      )
      .slice(0, Math.max(1, limit))
      .map(({ candidate, learnedScore }) => ({
        ...candidate,
        combinedScore:
          candidate.combinedScore + learnedScore
      }));
  }
}

export class LearnedRerankedKnowledgeSearch
  implements KnowledgeSearch
{
  private readonly reranker: LearnedLinearKnowledgeReranker;

  constructor(
    private readonly base: KnowledgeSearch,
    model: LearnedRerankerModel,
    private readonly candidateMultiplier = 4
  ) {
    this.reranker = new LearnedLinearKnowledgeReranker(model);
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
    const candidates = await this.base.search(query, {
      ...options,
      limit: Math.max(limit * this.candidateMultiplier, limit)
    });

    return this.reranker.rerank(query, candidates, limit);
  }
}

export interface CrossEncoderReranker {
  readonly providerKey: string;
  score(
    query: string,
    candidates: readonly KnowledgeRecord[]
  ): Promise<readonly number[]>;
}

export interface ShadowEvaluation {
  id: string;
  queryHash: string;
  providerKey: string;
  candidateIds: readonly string[];
  baselineOrder: readonly string[];
  shadowOrder: readonly string[];
  baselineTopId?: string;
  shadowTopId?: string;
  scoreDelta: number;
  latencyMs: number;
  status: "completed" | "failed" | "skipped";
  errorCode?: string;
  createdAt: string;
}

export interface ShadowEvaluationRepository {
  append(evaluation: ShadowEvaluation): Promise<void>;
  list(limit?: number): Promise<readonly ShadowEvaluation[]>;
}

export class InMemoryShadowEvaluationRepository
  implements ShadowEvaluationRepository
{
  private readonly records: ShadowEvaluation[] = [];

  async append(evaluation: ShadowEvaluation): Promise<void> {
    this.records.push(evaluation);
  }

  async list(limit = 100): Promise<readonly ShadowEvaluation[]> {
    return [...this.records]
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }
}

export class PostgresShadowEvaluationRepository
  implements ShadowEvaluationRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async append(evaluation: ShadowEvaluation): Promise<void> {
    await this.executor.query(
      `INSERT INTO reranker_shadow_evaluations (
         id, query_hash, provider_key, candidate_ids,
         baseline_order, shadow_order, baseline_top_id,
         shadow_top_id, score_delta, latency_ms,
         status, error_code, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12, $13
       )`,
      [
        evaluation.id,
        evaluation.queryHash,
        evaluation.providerKey,
        evaluation.candidateIds,
        evaluation.baselineOrder,
        evaluation.shadowOrder,
        evaluation.baselineTopId ?? null,
        evaluation.shadowTopId ?? null,
        evaluation.scoreDelta,
        evaluation.latencyMs,
        evaluation.status,
        evaluation.errorCode ?? null,
        evaluation.createdAt
      ]
    );
  }

  async list(limit = 100): Promise<readonly ShadowEvaluation[]> {
    const result = await this.executor.query<{
      id: string;
      query_hash: string;
      provider_key: string;
      candidate_ids: string[];
      baseline_order: string[];
      shadow_order: string[];
      baseline_top_id: string | null;
      shadow_top_id: string | null;
      score_delta: number;
      latency_ms: number;
      status: ShadowEvaluation["status"];
      error_code: string | null;
      created_at: string | Date;
    }>(
      `SELECT *
       FROM reranker_shadow_evaluations
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 500))]
    );

    return result.rows.map((row) => ({
      id: row.id,
      queryHash: row.query_hash,
      providerKey: row.provider_key,
      candidateIds: row.candidate_ids,
      baselineOrder: row.baseline_order,
      shadowOrder: row.shadow_order,
      baselineTopId: row.baseline_top_id ?? undefined,
      shadowTopId: row.shadow_top_id ?? undefined,
      scoreDelta: Number(row.score_delta),
      latencyMs: row.latency_ms,
      status: row.status,
      errorCode: row.error_code ?? undefined,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at
    }));
  }
}

function stableQueryHash(query: string): string {
  return String(fnv1a(normalizeSemanticText(query)));
}

export class ShadowCrossEncoderKnowledgeSearch
  implements KnowledgeSearch
{
  constructor(
    private readonly base: KnowledgeSearch,
    private readonly reranker: CrossEncoderReranker,
    private readonly evaluations: ShadowEvaluationRepository,
    private readonly candidateLimit = 10
  ) {}

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
    const candidates = await this.base.search(query, {
      ...options,
      limit: Math.max(limit, this.candidateLimit)
    });
    const baseline = candidates.slice(0, limit);
    const startedAt = Date.now();

    try {
      const scores = await this.reranker.score(
        query,
        candidates.map((item) => item.record)
      );
      if (scores.length !== candidates.length) {
        throw new Error("cross_encoder_score_count_mismatch");
      }

      const shadow = candidates
        .map((candidate, index) => ({
          candidate,
          score: scores[index] ?? Number.NEGATIVE_INFINITY
        }))
        .sort((left, right) => right.score - left.score)
        .map((item) => item.candidate);

      await this.evaluations.append({
        id: crypto.randomUUID(),
        queryHash: stableQueryHash(query),
        providerKey: this.reranker.providerKey,
        candidateIds: candidates.map((item) => item.record.id),
        baselineOrder: candidates.map((item) => item.record.id),
        shadowOrder: shadow.map((item) => item.record.id),
        baselineTopId: candidates[0]?.record.id,
        shadowTopId: shadow[0]?.record.id,
        scoreDelta:
          (scores[shadow.length > 0
            ? candidates.findIndex(
                (item) => item.record.id === shadow[0]?.record.id
              )
            : 0] ?? 0) -
          (scores[0] ?? 0),
        latencyMs: Date.now() - startedAt,
        status: "completed",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      await this.evaluations.append({
        id: crypto.randomUUID(),
        queryHash: stableQueryHash(query),
        providerKey: this.reranker.providerKey,
        candidateIds: candidates.map((item) => item.record.id),
        baselineOrder: candidates.map((item) => item.record.id),
        shadowOrder: [],
        baselineTopId: candidates[0]?.record.id,
        scoreDelta: 0,
        latencyMs: Date.now() - startedAt,
        status: "failed",
        errorCode:
          error instanceof Error ? error.message : "unknown_error",
        createdAt: new Date().toISOString()
      });
    }

    return baseline;
  }
}

export interface RetrievalLabelQueueItem {
  id: string;
  queryHash: string;
  candidateIds: readonly string[];
  candidateTitles: readonly string[];
  predictedTopId?: string;
  confidence: number;
  uncertaintyReason: string;
  status: "pending" | "claimed" | "labeled" | "discarded";
  claimedBy?: string;
  claimedAt?: string;
  labeledBy?: string;
  relevantIds?: readonly string[];
  irrelevantIds?: readonly string[];
  labelNotes?: string;
  createdAt: string;
  labeledAt?: string;
}

export interface RetrievalLabelQueueRepository {
  enqueue(
    item: RetrievalLabelQueueItem
  ): Promise<RetrievalLabelQueueItem>;
  list(
    status?: RetrievalLabelQueueItem["status"],
    limit?: number
  ): Promise<readonly RetrievalLabelQueueItem[]>;
  claim(id: string, userId: string): Promise<RetrievalLabelQueueItem | null>;
  label(input: {
    id: string;
    userId: string;
    relevantIds: readonly string[];
    irrelevantIds: readonly string[];
    notes?: string;
  }): Promise<RetrievalLabelQueueItem | null>;
}

export class InMemoryRetrievalLabelQueueRepository
  implements RetrievalLabelQueueRepository
{
  private readonly items = new Map<string, RetrievalLabelQueueItem>();

  async enqueue(
    item: RetrievalLabelQueueItem
  ): Promise<RetrievalLabelQueueItem> {
    const existing = [...this.items.values()].find(
      (current) =>
        current.queryHash === item.queryHash &&
        ["pending", "claimed"].includes(current.status)
    );
    if (existing) return existing;

    this.items.set(item.id, item);
    return item;
  }

  async list(
    status?: RetrievalLabelQueueItem["status"],
    limit = 100
  ): Promise<readonly RetrievalLabelQueueItem[]> {
    return [...this.items.values()]
      .filter((item) => !status || item.status === status)
      .sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async claim(
    id: string,
    userId: string
  ): Promise<RetrievalLabelQueueItem | null> {
    const item = this.items.get(id);
    if (!item || item.status !== "pending") return null;

    const claimed: RetrievalLabelQueueItem = {
      ...item,
      status: "claimed",
      claimedBy: userId,
      claimedAt: new Date().toISOString()
    };
    this.items.set(id, claimed);
    return claimed;
  }

  async label(input: {
    id: string;
    userId: string;
    relevantIds: readonly string[];
    irrelevantIds: readonly string[];
    notes?: string;
  }): Promise<RetrievalLabelQueueItem | null> {
    const item = this.items.get(input.id);
    if (
      !item ||
      !["pending", "claimed"].includes(item.status) ||
      (
        item.claimedBy &&
        item.claimedBy !== input.userId
      )
    ) {
      return null;
    }

    const labeled: RetrievalLabelQueueItem = {
      ...item,
      status: "labeled",
      labeledBy: input.userId,
      relevantIds: [...new Set(input.relevantIds)],
      irrelevantIds: [...new Set(input.irrelevantIds)],
      labelNotes: input.notes,
      labeledAt: new Date().toISOString()
    };
    this.items.set(item.id, labeled);
    return labeled;
  }
}

export class ActiveLearningKnowledgeSearch
  implements KnowledgeSearch
{
  constructor(
    private readonly base: KnowledgeSearch,
    private readonly queue: RetrievalLabelQueueRepository,
    private readonly threshold = 0.12,
    private readonly minimumScore = 0.01
  ) {}

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<readonly KnowledgeSearchResult[]> {
    const results = await this.base.search(query, options);
    const top = results[0]?.combinedScore ?? 0;
    const second = results[1]?.combinedScore ?? 0;
    const margin = top - second;
    const normalizedMargin =
      margin / Math.max(Math.abs(top), 0.000_001);

    let reason: string | undefined;
    if (results.length < 2) {
      reason = "insufficient_candidates";
    } else if (top < this.minimumScore) {
      reason = "low_absolute_score";
    } else if (normalizedMargin < this.threshold) {
      reason = "small_top_margin";
    }

    if (reason) {
      await this.queue.enqueue({
        id: crypto.randomUUID(),
        queryHash: stableQueryHash(query),
        candidateIds: results.map((item) => item.record.id),
        candidateTitles: results.map((item) => item.record.title),
        predictedTopId: results[0]?.record.id,
        confidence: Math.max(
          0,
          Math.min(1, normalizedMargin)
        ),
        uncertaintyReason: reason,
        status: "pending",
        createdAt: new Date().toISOString()
      });
    }

    return results;
  }
}

export class PostgresRetrievalLabelQueueRepository
  implements RetrievalLabelQueueRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async enqueue(
    item: RetrievalLabelQueueItem
  ): Promise<RetrievalLabelQueueItem> {
    const result = await this.executor.query<{
      id: string;
      query_hash: string;
      candidate_ids: string[];
      candidate_titles: string[];
      predicted_top_id: string | null;
      confidence: number;
      uncertainty_reason: string;
      status: RetrievalLabelQueueItem["status"];
      claimed_by: string | null;
      claimed_at: string | Date | null;
      labeled_by: string | null;
      relevant_ids: string[] | null;
      irrelevant_ids: string[] | null;
      label_notes: string | null;
      created_at: string | Date;
      labeled_at: string | Date | null;
    }>(
      `INSERT INTO retrieval_label_queue (
         id, query_hash, candidate_ids, candidate_titles,
         predicted_top_id, confidence, uncertainty_reason,
         status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (query_hash)
       WHERE status IN ('pending', 'claimed')
       DO UPDATE SET query_hash = EXCLUDED.query_hash
       RETURNING *`,
      [
        item.id,
        item.queryHash,
        item.candidateIds,
        item.candidateTitles,
        item.predictedTopId ?? null,
        item.confidence,
        item.uncertaintyReason,
        item.status,
        item.createdAt
      ]
    );

    return mapLabelQueueRow(result.rows[0]!);
  }

  async list(
    status?: RetrievalLabelQueueItem["status"],
    limit = 100
  ): Promise<readonly RetrievalLabelQueueItem[]> {
    const result = await this.executor.query<LabelQueueRow>(
      `SELECT *
       FROM retrieval_label_queue
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY created_at ASC
       LIMIT $2`,
      [status ?? null, Math.max(1, Math.min(limit, 500))]
    );

    return result.rows.map(mapLabelQueueRow);
  }

  async claim(
    id: string,
    userId: string
  ): Promise<RetrievalLabelQueueItem | null> {
    const result = await this.executor.query<LabelQueueRow>(
      `UPDATE retrieval_label_queue
       SET
         status = 'claimed',
         claimed_by = $2,
         claimed_at = now()
       WHERE id = $1
         AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );

    return result.rows[0]
      ? mapLabelQueueRow(result.rows[0])
      : null;
  }

  async label(input: {
    id: string;
    userId: string;
    relevantIds: readonly string[];
    irrelevantIds: readonly string[];
    notes?: string;
  }): Promise<RetrievalLabelQueueItem | null> {
    const result = await this.executor.query<LabelQueueRow>(
      `UPDATE retrieval_label_queue
       SET
         status = 'labeled',
         labeled_by = $2,
         relevant_ids = $3,
         irrelevant_ids = $4,
         label_notes = $5,
         labeled_at = now()
       WHERE id = $1
         AND status IN ('pending', 'claimed')
         AND (
           claimed_by IS NULL OR
           claimed_by = $2
         )
       RETURNING *`,
      [
        input.id,
        input.userId,
        [...new Set(input.relevantIds)],
        [...new Set(input.irrelevantIds)],
        input.notes ?? null
      ]
    );

    const item = result.rows[0]
      ? mapLabelQueueRow(result.rows[0])
      : null;

    if (!item) return null;

    for (const candidateId of item.relevantIds ?? []) {
      await this.executor.query(
        `INSERT INTO retrieval_training_labels (
           queue_item_id, query_hash, candidate_id,
           relevance, labeled_by
         ) VALUES ($1, $2, $3, 2, $4)
         ON CONFLICT (queue_item_id, candidate_id)
         DO UPDATE SET
           relevance = EXCLUDED.relevance,
           labeled_by = EXCLUDED.labeled_by`,
        [item.id, item.queryHash, candidateId, input.userId]
      );
    }

    for (const candidateId of item.irrelevantIds ?? []) {
      await this.executor.query(
        `INSERT INTO retrieval_training_labels (
           queue_item_id, query_hash, candidate_id,
           relevance, labeled_by
         ) VALUES ($1, $2, $3, 0, $4)
         ON CONFLICT (queue_item_id, candidate_id)
         DO UPDATE SET
           relevance = EXCLUDED.relevance,
           labeled_by = EXCLUDED.labeled_by`,
        [item.id, item.queryHash, candidateId, input.userId]
      );
    }

    return item;
  }
}

interface LabelQueueRow {
  id: string;
  query_hash: string;
  candidate_ids: string[];
  candidate_titles: string[];
  predicted_top_id: string | null;
  confidence: number;
  uncertainty_reason: string;
  status: RetrievalLabelQueueItem["status"];
  claimed_by: string | null;
  claimed_at: string | Date | null;
  labeled_by: string | null;
  relevant_ids: string[] | null;
  irrelevant_ids: string[] | null;
  label_notes: string | null;
  created_at: string | Date;
  labeled_at: string | Date | null;
}

function mapOptionalDate(
  value: string | Date | null
): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function mapLabelQueueRow(
  row: LabelQueueRow
): RetrievalLabelQueueItem {
  return {
    id: row.id,
    queryHash: row.query_hash,
    candidateIds: row.candidate_ids,
    candidateTitles: row.candidate_titles,
    predictedTopId: row.predicted_top_id ?? undefined,
    confidence: Number(row.confidence),
    uncertaintyReason: row.uncertainty_reason,
    status: row.status,
    claimedBy: row.claimed_by ?? undefined,
    claimedAt: mapOptionalDate(row.claimed_at),
    labeledBy: row.labeled_by ?? undefined,
    relevantIds: row.relevant_ids ?? undefined,
    irrelevantIds: row.irrelevant_ids ?? undefined,
    labelNotes: row.label_notes ?? undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    labeledAt: mapOptionalDate(row.labeled_at)
  };
}

export type KnowledgeEntityType =
  | "faq"
  | "route"
  | "education"
  | "subsidy"
  | "event"
  | "vacancy"
  | "organization"
  | "authority"
  | "cao"
  | "generic";

export interface NormalizedKnowledgeEntity {
  externalId: string;
  entityType: KnowledgeEntityType;
  title: string;
  body: string;
  category?: string;
  tags: readonly string[];
  sourceUrl?: string;
  validFrom?: string;
  validUntil?: string;
  metadata: Readonly<Record<string, unknown>>;
}

export interface ConnectorDefinition {
  id: string;
  connectorKey: string;
  connectorType: "json" | "csv" | "http-json";
  label: string;
  enabled: boolean;
  scheduleCron?: string;
  snapshotMode?: boolean;
  configuration: Readonly<Record<string, unknown>>;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorRun {
  id: string;
  connectorId: string;
  status: "running" | "succeeded" | "failed" | "skipped";
  fetchedCount: number;
  normalizedCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  removedCount: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface KnowledgeConnector {
  readonly connectorType: ConnectorDefinition["connectorType"];
  fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]>;
  normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity;
}

export interface ConnectorRepository {
  upsert(definition: ConnectorDefinition): Promise<void>;
  findByKey(key: string): Promise<ConnectorDefinition | null>;
  list(): Promise<readonly ConnectorDefinition[]>;
  saveRun(run: ConnectorRun): Promise<void>;
  listRuns(
    connectorId?: string,
    limit?: number
  ): Promise<readonly ConnectorRun[]>;
  findLatestVersion(
    connectorId: string,
    externalId: string
  ): Promise<{
    contentHash: string;
    active: boolean;
  } | null>;
  saveVersion(input: {
    id: string;
    connectorId: string;
    externalId: string;
    contentHash: string;
    normalizedPayload: Readonly<Record<string, unknown>>;
    observedAt: string;
    active: boolean;
  }): Promise<void>;
  updateHealth(input: {
    connectorId: string;
    success: boolean;
    at: string;
    error?: string;
  }): Promise<void>;
  listActiveExternalIds(
    connectorId: string
  ): Promise<readonly string[]>;
  deactivateExternalId(input: {
    connectorId: string;
    externalId: string;
    observedAt: string;
    runId: string;
  }): Promise<void>;
}

function connectorHash(value: unknown): string {
  return String(fnv1a(JSON.stringify(value)));
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string =>
        typeof item === "string"
      )
    : [];
}

export class JsonKnowledgeConnector implements KnowledgeConnector {
  readonly connectorType: ConnectorDefinition["connectorType"] = "json";

  async fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]> {
    const records = definition.configuration.records;
    if (!Array.isArray(records)) {
      throw new Error("json_connector_records_missing");
    }
    return records;
  }

  normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    if (!record || typeof record !== "object") {
      throw new Error("json_connector_record_invalid");
    }
    const item = record as Record<string, unknown>;
    const title = stringValue(item.title, stringValue(item.question));
    const body = stringValue(item.body, stringValue(item.answer));
    const externalId = stringValue(
      item.externalId,
      stringValue(item.id, connectorHash(item))
    );

    if (!title || !body) {
      throw new Error("json_connector_required_fields_missing");
    }

    return {
      externalId,
      entityType:
        stringValue(
          item.entityType,
          stringValue(
            definition.configuration.entityType,
            "generic"
          )
        ) as KnowledgeEntityType,
      title,
      body,
      category: stringValue(item.category) || undefined,
      tags: stringArray(item.tags),
      sourceUrl: stringValue(item.sourceUrl) || undefined,
      validFrom: stringValue(item.validFrom) || undefined,
      validUntil: stringValue(item.validUntil) || undefined,
      metadata:
        item.metadata &&
        typeof item.metadata === "object" &&
        !Array.isArray(item.metadata)
          ? item.metadata as Readonly<Record<string, unknown>>
          : {}
    };
  }
}

function parseCsvLine(line: string): readonly string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

export class CsvKnowledgeConnector extends JsonKnowledgeConnector {
  readonly connectorType = "csv" as const;

  override async fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]> {
    const csv = definition.configuration.csv;
    if (typeof csv !== "string") {
      throw new Error("csv_connector_content_missing");
    }

    const lines = csv
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    const headers = parseCsvLine(lines[0] ?? "");
    return lines.slice(1).map((line) =>
      Object.fromEntries(
        parseCsvLine(line).map((value, index) => [
          headers[index] ?? `column_${index}`,
          value
        ])
      )
    );
  }
}

export class HttpJsonKnowledgeConnector
  extends JsonKnowledgeConnector
{
  readonly connectorType = "http-json" as const;

  override async fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]> {
    const url = definition.configuration.url;
    if (typeof url !== "string") {
      throw new Error("http_connector_url_missing");
    }

    const response = await fetch(url, {
      headers:
        definition.configuration.headers &&
        typeof definition.configuration.headers === "object"
          ? definition.configuration.headers as Record<string, string>
          : undefined,
      signal: AbortSignal.timeout(
        Number(definition.configuration.timeoutMs ?? 20_000)
      )
    });

    if (!response.ok) {
      throw new Error(`http_connector_${response.status}`);
    }

    const payload = await response.json() as unknown;
    if (Array.isArray(payload)) return payload;

    if (
      payload &&
      typeof payload === "object" &&
      Array.isArray(
        (payload as Record<string, unknown>).items
      )
    ) {
      return (payload as { items: readonly unknown[] }).items;
    }

    throw new Error("http_connector_payload_invalid");
  }
}

export class InMemoryConnectorRepository
  implements ConnectorRepository
{
  private readonly definitions = new Map<string, ConnectorDefinition>();
  private readonly runs = new Map<string, ConnectorRun>();
  private readonly versions = new Map<string, {
    contentHash: string;
    active: boolean;
  }>();

  async upsert(definition: ConnectorDefinition): Promise<void> {
    this.definitions.set(definition.id, definition);
  }

  async findByKey(key: string): Promise<ConnectorDefinition | null> {
    return [...this.definitions.values()].find(
      (item) => item.connectorKey === key
    ) ?? null;
  }

  async list(): Promise<readonly ConnectorDefinition[]> {
    return [...this.definitions.values()];
  }

  async saveRun(run: ConnectorRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async listRuns(
    connectorId?: string,
    limit = 100
  ): Promise<readonly ConnectorRun[]> {
    return [...this.runs.values()]
      .filter((run) => !connectorId || run.connectorId === connectorId)
      .sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 500)));
  }

  async findLatestVersion(
    connectorId: string,
    externalId: string
  ): Promise<{ contentHash: string; active: boolean } | null> {
    return this.versions.get(`${connectorId}:${externalId}`) ?? null;
  }

  async saveVersion(input: {
    id: string;
    connectorId: string;
    externalId: string;
    contentHash: string;
    normalizedPayload: Readonly<Record<string, unknown>>;
    observedAt: string;
    active: boolean;
  }): Promise<void> {
    this.versions.set(`${input.connectorId}:${input.externalId}`, {
      contentHash: input.contentHash,
      active: input.active
    });
  }

  async updateHealth(input: {
    connectorId: string;
    success: boolean;
    at: string;
    error?: string;
  }): Promise<void> {
    const current = this.definitions.get(input.connectorId);
    if (!current) return;

    this.definitions.set(input.connectorId, {
      ...current,
      lastSuccessAt: input.success
        ? input.at
        : current.lastSuccessAt,
      lastFailureAt: input.success
        ? current.lastFailureAt
        : input.at,
      lastError: input.success ? undefined : input.error,
      updatedAt: input.at
    });
  }

  async listActiveExternalIds(
    connectorId: string
  ): Promise<readonly string[]> {
    const prefix = `${connectorId}:`;
    return [...this.versions.entries()]
      .filter(([key, value]) =>
        key.startsWith(prefix) && value.active
      )
      .map(([key]) => key.slice(prefix.length));
  }

  async deactivateExternalId(input: {
    connectorId: string;
    externalId: string;
    observedAt: string;
    runId: string;
  }): Promise<void> {
    this.versions.set(
      `${input.connectorId}:${input.externalId}`,
      { contentHash: `inactive:${input.runId}`, active: false }
    );
  }
}

export class PostgresConnectorRepository
  implements ConnectorRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async upsert(definition: ConnectorDefinition): Promise<void> {
    await this.executor.query(
      `INSERT INTO knowledge_connectors (
         id, connector_key, connector_type, label,
         enabled, schedule_cron, snapshot_mode, configuration,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
       ON CONFLICT (connector_key) DO UPDATE SET
         connector_type = EXCLUDED.connector_type,
         label = EXCLUDED.label,
         enabled = EXCLUDED.enabled,
         schedule_cron = EXCLUDED.schedule_cron,
         snapshot_mode = EXCLUDED.snapshot_mode,
         configuration = EXCLUDED.configuration,
         updated_at = EXCLUDED.updated_at`,
      [
        definition.id,
        definition.connectorKey,
        definition.connectorType,
        definition.label,
        definition.enabled,
        definition.scheduleCron ?? null,
        definition.snapshotMode ?? false,
        JSON.stringify(definition.configuration),
        definition.createdAt,
        definition.updatedAt
      ]
    );
  }

  async findByKey(key: string): Promise<ConnectorDefinition | null> {
    const result = await this.executor.query<ConnectorRow>(
      `SELECT * FROM knowledge_connectors
       WHERE connector_key = $1`,
      [key]
    );
    return result.rows[0] ? mapConnectorRow(result.rows[0]) : null;
  }

  async list(): Promise<readonly ConnectorDefinition[]> {
    const result = await this.executor.query<ConnectorRow>(
      `SELECT * FROM knowledge_connectors
       ORDER BY connector_key`
    );
    return result.rows.map(mapConnectorRow);
  }

  async saveRun(run: ConnectorRun): Promise<void> {
    await this.executor.query(
      `INSERT INTO knowledge_connector_runs (
         id, connector_id, status, fetched_count,
         normalized_count, inserted_count, updated_count,
         unchanged_count, removed_count, started_at,
         completed_at, error_message
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         fetched_count = EXCLUDED.fetched_count,
         normalized_count = EXCLUDED.normalized_count,
         inserted_count = EXCLUDED.inserted_count,
         updated_count = EXCLUDED.updated_count,
         unchanged_count = EXCLUDED.unchanged_count,
         removed_count = EXCLUDED.removed_count,
         completed_at = EXCLUDED.completed_at,
         error_message = EXCLUDED.error_message`,
      [
        run.id,
        run.connectorId,
        run.status,
        run.fetchedCount,
        run.normalizedCount,
        run.insertedCount,
        run.updatedCount,
        run.unchangedCount,
        run.removedCount,
        run.startedAt,
        run.completedAt ?? null,
        run.errorMessage ?? null
      ]
    );
  }

  async listRuns(
    connectorId?: string,
    limit = 100
  ): Promise<readonly ConnectorRun[]> {
    const result = await this.executor.query<ConnectorRunRow>(
      `SELECT *
       FROM knowledge_connector_runs
       WHERE ($1::uuid IS NULL OR connector_id = $1)
       ORDER BY started_at DESC
       LIMIT $2`,
      [connectorId ?? null, Math.max(1, Math.min(limit, 500))]
    );
    return result.rows.map(mapConnectorRunRow);
  }

  async findLatestVersion(
    connectorId: string,
    externalId: string
  ): Promise<{ contentHash: string; active: boolean } | null> {
    const result = await this.executor.query<{
      content_hash: string;
      active: boolean;
    }>(
      `SELECT content_hash, active
       FROM knowledge_source_versions
       WHERE connector_id = $1 AND external_id = $2
       ORDER BY observed_at DESC
       LIMIT 1`,
      [connectorId, externalId]
    );
    return result.rows[0]
      ? {
          contentHash: result.rows[0].content_hash,
          active: result.rows[0].active
        }
      : null;
  }

  async saveVersion(input: {
    id: string;
    connectorId: string;
    externalId: string;
    contentHash: string;
    normalizedPayload: Readonly<Record<string, unknown>>;
    observedAt: string;
    active: boolean;
  }): Promise<void> {
    await this.executor.query(
      `INSERT INTO knowledge_source_versions (
         id, connector_id, external_id, content_hash,
         normalized_payload, observed_at, active, run_id, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$6)
       ON CONFLICT (connector_id, external_id, content_hash)
       DO UPDATE SET
         observed_at = EXCLUDED.observed_at,
         active = EXCLUDED.active,
         run_id = EXCLUDED.run_id,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        input.id,
        input.connectorId,
        input.externalId,
        input.contentHash,
        JSON.stringify(input.normalizedPayload),
        input.observedAt,
        input.active,
        input.id
      ]
    );
  }

  async updateHealth(input: {
    connectorId: string;
    success: boolean;
    at: string;
    error?: string;
  }): Promise<void> {
    await this.executor.query(
      `UPDATE knowledge_connectors
       SET
         last_success_at = CASE WHEN $2 THEN $3 ELSE last_success_at END,
         last_failure_at = CASE WHEN $2 THEN last_failure_at ELSE $3 END,
         last_error = CASE WHEN $2 THEN NULL ELSE $4 END,
         updated_at = $3
       WHERE id = $1`,
      [
        input.connectorId,
        input.success,
        input.at,
        input.error ?? null
      ]
    );
  }

  async listActiveExternalIds(
    connectorId: string
  ): Promise<readonly string[]> {
    const result = await this.executor.query<{
      external_id: string;
    }>(
      `SELECT DISTINCT ON (external_id) external_id
       FROM knowledge_source_versions
       WHERE connector_id = $1 AND active = true
       ORDER BY external_id, observed_at DESC`,
      [connectorId]
    );
    return result.rows.map((row) => row.external_id);
  }

  async deactivateExternalId(input: {
    connectorId: string;
    externalId: string;
    observedAt: string;
    runId: string;
  }): Promise<void> {
    await this.executor.query(
      `UPDATE knowledge_source_versions
       SET active = false, last_seen_at = $3, run_id = $4
       WHERE connector_id = $1
         AND external_id = $2
         AND active = true`,
      [
        input.connectorId,
        input.externalId,
        input.observedAt,
        input.runId
      ]
    );
  }
}

interface ConnectorRow {
  id: string;
  connector_key: string;
  connector_type: ConnectorDefinition["connectorType"];
  label: string;
  enabled: boolean;
  schedule_cron: string | null;
  snapshot_mode: boolean;
  configuration: unknown;
  last_success_at: string | Date | null;
  last_failure_at: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ConnectorRunRow {
  id: string;
  connector_id: string;
  status: ConnectorRun["status"];
  fetched_count: number;
  normalized_count: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  removed_count: number;
  started_at: string | Date;
  completed_at: string | Date | null;
  error_message: string | null;
}

function connectorDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapConnectorRow(row: ConnectorRow): ConnectorDefinition {
  return {
    id: row.id,
    connectorKey: row.connector_key,
    connectorType: row.connector_type,
    label: row.label,
    enabled: row.enabled,
    scheduleCron: row.schedule_cron ?? undefined,
    snapshotMode: row.snapshot_mode,
    configuration:
      row.configuration && typeof row.configuration === "object"
        ? row.configuration as Readonly<Record<string, unknown>>
        : {},
    lastSuccessAt: row.last_success_at
      ? connectorDate(row.last_success_at)
      : undefined,
    lastFailureAt: row.last_failure_at
      ? connectorDate(row.last_failure_at)
      : undefined,
    lastError: row.last_error ?? undefined,
    createdAt: connectorDate(row.created_at),
    updatedAt: connectorDate(row.updated_at)
  };
}

function mapConnectorRunRow(row: ConnectorRunRow): ConnectorRun {
  return {
    id: row.id,
    connectorId: row.connector_id,
    status: row.status,
    fetchedCount: row.fetched_count,
    normalizedCount: row.normalized_count,
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    unchangedCount: row.unchanged_count,
    removedCount: row.removed_count,
    startedAt: connectorDate(row.started_at),
    completedAt: row.completed_at
      ? connectorDate(row.completed_at)
      : undefined,
    errorMessage: row.error_message ?? undefined
  };
}

export class KnowledgeConnectorService {
  private readonly connectors: ReadonlyMap<
    ConnectorDefinition["connectorType"],
    KnowledgeConnector
  >;

  constructor(
    private readonly repository: ConnectorRepository,
    private readonly knowledge: KnowledgeRepository,
    private readonly indexer?: {
      index(record: KnowledgeRecord): Promise<void>;
    },
    connectors: readonly KnowledgeConnector[] = [
      new JsonKnowledgeConnector(),
      new CsvKnowledgeConnector(),
      new HttpJsonKnowledgeConnector()
    ]
  ) {
    this.connectors = new Map(
      connectors.map((connector) => [
        connector.connectorType,
        connector
      ])
    );
  }

  async synchronize(connectorKey: string): Promise<ConnectorRun> {
    const definition = await this.repository.findByKey(connectorKey);
    if (!definition) throw new Error("connector_not_found");

    const now = new Date().toISOString();
    const run: ConnectorRun = {
      id: crypto.randomUUID(),
      connectorId: definition.id,
      status: definition.enabled ? "running" : "skipped",
      fetchedCount: 0,
      normalizedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      removedCount: 0,
      startedAt: now,
      completedAt: definition.enabled ? undefined : now
    };
    await this.repository.saveRun(run);

    if (!definition.enabled) return run;

    const connector = this.connectors.get(definition.connectorType);
    if (!connector) throw new Error("connector_type_unsupported");

    try {
      const rawRecords = await connector.fetch(definition);
      run.fetchedCount = rawRecords.length;
      const seenExternalIds = new Set<string>();

      for (const rawRecord of rawRecords) {
        const entity = connector.normalize(rawRecord, definition);
        run.normalizedCount += 1;
        seenExternalIds.add(entity.externalId);
        const contentHash = connectorHash(entity);
        const previous = await this.repository.findLatestVersion(
          definition.id,
          entity.externalId
        );

        if (previous?.contentHash === contentHash && previous.active) {
          run.unchangedCount += 1;
          continue;
        }

        const timestamp = new Date().toISOString();
        const record: KnowledgeRecord = {
          id: stableId(
            `connector:${definition.connectorKey}:${entity.externalId}`
          ),
          externalId: entity.externalId,
          title: entity.title,
          body: entity.body,
          category: entity.category,
          tags: [
            `entity-type:${entity.entityType}`,
            ...entity.tags
          ],
          sourceKey: definition.connectorKey,
          sourceUrl: entity.sourceUrl,
          timeSensitive: [
            "vacancy",
            "event",
            "cao",
            "subsidy"
          ].includes(entity.entityType),
          requiresCitation: Boolean(entity.sourceUrl),
          validFrom: entity.validFrom,
          validUntil: entity.validUntil,
          reviewStatus: "approved",
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        await this.knowledge.upsert(record);
        await this.indexer?.index(record);
        await this.repository.saveVersion({
          id: crypto.randomUUID(),
          connectorId: definition.id,
          externalId: entity.externalId,
          contentHash,
          normalizedPayload: entity as unknown as Readonly<
            Record<string, unknown>
          >,
          observedAt: timestamp,
          active: true
        });

        if (previous) run.updatedCount += 1;
        else run.insertedCount += 1;
      }

      if (definition.snapshotMode) {
        const activeExternalIds =
          await this.repository.listActiveExternalIds(definition.id);
        const removed = activeExternalIds.filter(
          (externalId) => !seenExternalIds.has(externalId)
        );

        for (const externalId of removed) {
          const timestamp = new Date().toISOString();
          await this.repository.deactivateExternalId({
            connectorId: definition.id,
            externalId,
            observedAt: timestamp,
            runId: run.id
          });
          await this.knowledge.archive(
            stableId(
              `connector:${definition.connectorKey}:${externalId}`
            ),
            timestamp
          );
          run.removedCount += 1;
        }
      }

      run.status = "succeeded";
      run.completedAt = new Date().toISOString();
      await this.repository.saveRun(run);
      await this.repository.updateHealth({
        connectorId: definition.id,
        success: true,
        at: run.completedAt
      });
      return run;
    } catch (error) {
      run.status = "failed";
      run.completedAt = new Date().toISOString();
      run.errorMessage =
        error instanceof Error ? error.message : "unknown_error";
      await this.repository.saveRun(run);
      await this.repository.updateHealth({
        connectorId: definition.id,
        success: false,
        at: run.completedAt,
        error: run.errorMessage
      });
      return run;
    }
  }
}

export interface SecretResolver {
  resolve(reference: string): Promise<string>;
}

export class EnvironmentSecretResolver implements SecretResolver {
  async resolve(reference: string): Promise<string> {
    const key = reference.startsWith("env:")
      ? reference.slice("env:".length)
      : reference;
    const value = process.env[key];

    if (!value) {
      throw new Error(`secret_not_found:${key}`);
    }

    return value;
  }
}

function isSecretReference(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("env:");
}

async function resolveSecretObject(
  value: unknown,
  resolver: SecretResolver
): Promise<unknown> {
  if (isSecretReference(value)) {
    return resolver.resolve(value);
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) => resolveSecretObject(item, resolver))
    );
  }

  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [
        key,
        await resolveSecretObject(item, resolver)
      ] as const)
    );
    return Object.fromEntries(entries);
  }

  return value;
}

export class SecretResolvingKnowledgeConnector
  implements KnowledgeConnector
{
  readonly connectorType: ConnectorDefinition["connectorType"];

  constructor(
    private readonly inner: KnowledgeConnector,
    private readonly resolver: SecretResolver
  ) {
    this.connectorType = inner.connectorType;
  }

  async fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]> {
    const configuration = await resolveSecretObject(
      definition.configuration,
      this.resolver
    );

    return this.inner.fetch({
      ...definition,
      configuration:
        configuration as Readonly<Record<string, unknown>>
    });
  }

  normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    return this.inner.normalize(record, definition);
  }
}

export interface ConnectorRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maximumDelayMs: number;
}

export const DEFAULT_CONNECTOR_RETRY_POLICY: ConnectorRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maximumDelayMs: 5_000
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export class RetryingKnowledgeConnector
  implements KnowledgeConnector
{
  readonly connectorType: ConnectorDefinition["connectorType"];

  constructor(
    private readonly inner: KnowledgeConnector,
    private readonly policy: ConnectorRetryPolicy =
      DEFAULT_CONNECTOR_RETRY_POLICY
  ) {
    this.connectorType = inner.connectorType;
  }

  async fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]> {
    let lastError: unknown;

    for (
      let attempt = 1;
      attempt <= this.policy.maxAttempts;
      attempt += 1
    ) {
      try {
        return await this.inner.fetch(definition);
      } catch (error) {
        lastError = error;
        if (attempt >= this.policy.maxAttempts) break;

        const delay = Math.min(
          this.policy.baseDelayMs * 2 ** (attempt - 1),
          this.policy.maximumDelayMs
        );
        await sleep(delay);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("connector_fetch_failed");
  }

  normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    return this.inner.normalize(record, definition);
  }
}

export interface ConnectorHealthSummary {
  connectorId: string;
  connectorKey: string;
  label: string;
  enabled: boolean;
  status: "healthy" | "degraded" | "failing" | "never-run";
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  recentRuns: readonly ConnectorRun[];
}

export class ConnectorHealthService {
  constructor(private readonly repository: ConnectorRepository) {}

  async summarize(): Promise<readonly ConnectorHealthSummary[]> {
    const definitions = await this.repository.list();

    return Promise.all(
      definitions.map(async (definition) => {
        const recentRuns = await this.repository.listRuns(
          definition.id,
          5
        );
        const latest = recentRuns[0];
        let status: ConnectorHealthSummary["status"] = "never-run";

        if (latest?.status === "succeeded") {
          status = recentRuns.some((run) => run.status === "failed")
            ? "degraded"
            : "healthy";
        } else if (latest?.status === "failed") {
          status = "failing";
        } else if (latest?.status === "skipped") {
          status = "degraded";
        }

        return {
          connectorId: definition.id,
          connectorKey: definition.connectorKey,
          label: definition.label,
          enabled: definition.enabled,
          status,
          lastSuccessAt: definition.lastSuccessAt,
          lastFailureAt: definition.lastFailureAt,
          lastError: definition.lastError,
          recentRuns
        };
      })
    );
  }
}

function parseSimpleSchedule(
  schedule: string
): number | null {
  const normalized = schedule.trim().toLocaleLowerCase("en");
  const match = normalized.match(/^every:(\d+)(m|h)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return unit === "h"
    ? amount * 60 * 60 * 1_000
    : amount * 60 * 1_000;
}

export interface ConnectorLease {
  connectorId: string;
  ownerId: string;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
}

export interface ConnectorLeaseRepository {
  acquire(input: {
    connectorId: string;
    ownerId: string;
    now: string;
    expiresAt: string;
  }): Promise<boolean>;
  renew(input: {
    connectorId: string;
    ownerId: string;
    now: string;
    expiresAt: string;
  }): Promise<boolean>;
  release(connectorId: string, ownerId: string): Promise<void>;
  list(): Promise<readonly ConnectorLease[]>;
}

export class InMemoryConnectorLeaseRepository
  implements ConnectorLeaseRepository
{
  private readonly leases = new Map<string, ConnectorLease>();

  async acquire(input: {
    connectorId: string;
    ownerId: string;
    now: string;
    expiresAt: string;
  }): Promise<boolean> {
    const current = this.leases.get(input.connectorId);
    if (
      current &&
      current.expiresAt > input.now &&
      current.ownerId !== input.ownerId
    ) {
      return false;
    }

    this.leases.set(input.connectorId, {
      connectorId: input.connectorId,
      ownerId: input.ownerId,
      acquiredAt: input.now,
      heartbeatAt: input.now,
      expiresAt: input.expiresAt
    });
    return true;
  }

  async renew(input: {
    connectorId: string;
    ownerId: string;
    now: string;
    expiresAt: string;
  }): Promise<boolean> {
    const current = this.leases.get(input.connectorId);
    if (!current || current.ownerId !== input.ownerId) return false;
    this.leases.set(input.connectorId, {
      ...current,
      heartbeatAt: input.now,
      expiresAt: input.expiresAt
    });
    return true;
  }

  async release(
    connectorId: string,
    ownerId: string
  ): Promise<void> {
    const current = this.leases.get(connectorId);
    if (current?.ownerId === ownerId) {
      this.leases.delete(connectorId);
    }
  }

  async list(): Promise<readonly ConnectorLease[]> {
    return [...this.leases.values()];
  }
}

export class PostgresConnectorLeaseRepository
  implements ConnectorLeaseRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async acquire(input: {
    connectorId: string;
    ownerId: string;
    now: string;
    expiresAt: string;
  }): Promise<boolean> {
    const result = await this.executor.query<{ connector_id: string }>(
      `INSERT INTO knowledge_connector_leases (
         connector_id, owner_id, acquired_at, heartbeat_at, expires_at
       ) VALUES ($1,$2,$3,$3,$4)
       ON CONFLICT (connector_id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         acquired_at = EXCLUDED.acquired_at,
         heartbeat_at = EXCLUDED.heartbeat_at,
         expires_at = EXCLUDED.expires_at
       WHERE knowledge_connector_leases.expires_at <= $3
          OR knowledge_connector_leases.owner_id = $2
       RETURNING connector_id`,
      [input.connectorId, input.ownerId, input.now, input.expiresAt]
    );
    return result.rows.length === 1;
  }

  async renew(input: {
    connectorId: string;
    ownerId: string;
    now: string;
    expiresAt: string;
  }): Promise<boolean> {
    const result = await this.executor.query<{ connector_id: string }>(
      `UPDATE knowledge_connector_leases
       SET heartbeat_at = $3, expires_at = $4
       WHERE connector_id = $1 AND owner_id = $2
       RETURNING connector_id`,
      [input.connectorId, input.ownerId, input.now, input.expiresAt]
    );
    return result.rows.length === 1;
  }

  async release(
    connectorId: string,
    ownerId: string
  ): Promise<void> {
    await this.executor.query(
      `DELETE FROM knowledge_connector_leases
       WHERE connector_id = $1 AND owner_id = $2`,
      [connectorId, ownerId]
    );
  }

  async list(): Promise<readonly ConnectorLease[]> {
    const result = await this.executor.query<{
      connector_id: string;
      owner_id: string;
      acquired_at: string | Date;
      heartbeat_at: string | Date;
      expires_at: string | Date;
    }>(
      `SELECT * FROM knowledge_connector_leases
       ORDER BY expires_at DESC`
    );
    return result.rows.map((row) => ({
      connectorId: row.connector_id,
      ownerId: row.owner_id,
      acquiredAt: connectorDate(row.acquired_at),
      heartbeatAt: connectorDate(row.heartbeat_at),
      expiresAt: connectorDate(row.expires_at)
    }));
  }
}

export class DistributedConnectorScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly repository: ConnectorRepository,
    private readonly service: KnowledgeConnectorService,
    private readonly leases: ConnectorLeaseRepository,
    private readonly ownerId: string,
    private readonly leaseDurationMs = 5 * 60 * 1_000
  ) {}

  async start(): Promise<void> {
    this.stop();
    const definitions = await this.repository.list();

    for (const definition of definitions) {
      if (!definition.enabled || !definition.scheduleCron) continue;
      const intervalMs = parseSimpleSchedule(definition.scheduleCron);
      if (!intervalMs) continue;

      const timer = setInterval(
        () => void this.runWithLease(definition),
        intervalMs
      );
      timer.unref();
      this.timers.set(definition.id, timer);
    }
  }

  private async runWithLease(
    definition: ConnectorDefinition
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.leaseDurationMs
    );
    const acquired = await this.leases.acquire({
      connectorId: definition.id,
      ownerId: this.ownerId,
      now: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });
    if (!acquired) return;

    const heartbeat = setInterval(
      () => {
        const heartbeatAt = new Date();
        void this.leases.renew({
          connectorId: definition.id,
          ownerId: this.ownerId,
          now: heartbeatAt.toISOString(),
          expiresAt: new Date(
            heartbeatAt.getTime() + this.leaseDurationMs
          ).toISOString()
        });
      },
      Math.max(5_000, Math.floor(this.leaseDurationMs / 3))
    );
    heartbeat.unref();

    try {
      await this.service.synchronize(definition.connectorKey);
    } finally {
      clearInterval(heartbeat);
      await this.leases.release(definition.id, this.ownerId);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  get activeScheduleCount(): number {
    return this.timers.size;
  }
}

export class ConnectorScheduler {
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly repository: ConnectorRepository,
    private readonly service: KnowledgeConnectorService
  ) {}

  async start(): Promise<void> {
    this.stop();
    const definitions = await this.repository.list();

    for (const definition of definitions) {
      if (!definition.enabled || !definition.scheduleCron) continue;
      const intervalMs = parseSimpleSchedule(
        definition.scheduleCron
      );
      if (!intervalMs) continue;

      const timer = setInterval(
        () => void this.service.synchronize(
          definition.connectorKey
        ),
        intervalMs
      );
      timer.unref();
      this.timers.set(definition.id, timer);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  get activeScheduleCount(): number {
    return this.timers.size;
  }
}

abstract class DomainHttpJsonConnector
  extends HttpJsonKnowledgeConnector
{
  abstract readonly entityType: KnowledgeEntityType;

  override normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    const normalized = super.normalize(record, {
      ...definition,
      configuration: {
        ...definition.configuration,
        entityType: this.entityType
      }
    });

    return {
      ...normalized,
      entityType: this.entityType,
      tags: [
        `entity-type:${this.entityType}`,
        ...normalized.tags
      ]
    };
  }
}

export class EducationCatalogConnector
  extends DomainHttpJsonConnector
{
  readonly connectorType = "http-json" as const;
  readonly entityType = "education" as const;

  override normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    const item = record as Record<string, unknown>;
    const title = stringValue(
      item.title,
      stringValue(item.name)
    );
    const institution = stringValue(item.institution);
    const level = stringValue(item.level);
    const body = stringValue(
      item.body,
      [
        stringValue(item.description),
        institution ? `Instelling: ${institution}.` : "",
        level ? `Niveau: ${level}.` : ""
      ].filter(Boolean).join(" ")
    );

    return super.normalize({
      ...item,
      title,
      body,
      tags: [
        ...stringArray(item.tags),
        ...(institution ? [`institution:${institution}`] : []),
        ...(level ? [`level:${level}`] : [])
      ]
    }, definition);
  }
}

export class SubsidyCatalogConnector
  extends DomainHttpJsonConnector
{
  readonly connectorType = "http-json" as const;
  readonly entityType = "subsidy" as const;

  override normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    const item = record as Record<string, unknown>;
    const amount = stringValue(item.amount);
    const audience = stringValue(item.audience);

    return super.normalize({
      ...item,
      title: stringValue(item.title, stringValue(item.name)),
      body: stringValue(
        item.body,
        [
          stringValue(item.description),
          amount ? `Bedrag: ${amount}.` : "",
          audience ? `Doelgroep: ${audience}.` : ""
        ].filter(Boolean).join(" ")
      ),
      tags: [
        ...stringArray(item.tags),
        ...(audience ? [`audience:${audience}`] : [])
      ]
    }, definition);
  }
}

export class EventCatalogConnector
  extends DomainHttpJsonConnector
{
  readonly connectorType = "http-json" as const;
  readonly entityType = "event" as const;

  override normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    const item = record as Record<string, unknown>;
    const startsAt = stringValue(
      item.startsAt,
      stringValue(item.startDate)
    );
    const location = stringValue(item.location);

    return super.normalize({
      ...item,
      title: stringValue(item.title, stringValue(item.name)),
      body: stringValue(
        item.body,
        [
          stringValue(item.description),
          startsAt ? `Start: ${startsAt}.` : "",
          location ? `Locatie: ${location}.` : ""
        ].filter(Boolean).join(" ")
      ),
      validFrom: startsAt || undefined,
      tags: [
        ...stringArray(item.tags),
        ...(location ? [`location:${location}`] : [])
      ]
    }, definition);
  }
}

export class VacancyCatalogConnector
  extends DomainHttpJsonConnector
{
  readonly connectorType = "http-json" as const;
  readonly entityType = "vacancy" as const;

  override normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    const item = record as Record<string, unknown>;
    const employer = stringValue(item.employer);
    const region = stringValue(item.region);
    const expiresAt = stringValue(item.expiresAt);

    return super.normalize({
      ...item,
      title: stringValue(item.title, stringValue(item.position)),
      body: stringValue(
        item.body,
        [
          stringValue(item.description),
          employer ? `Werkgever: ${employer}.` : "",
          region ? `Regio: ${region}.` : ""
        ].filter(Boolean).join(" ")
      ),
      validUntil: expiresAt || undefined,
      tags: [
        ...stringArray(item.tags),
        ...(employer ? [`employer:${employer}`] : []),
        ...(region ? [`region:${region}`] : [])
      ]
    }, definition);
  }
}

export class DomainCatalogConnector
  implements KnowledgeConnector
{
  readonly connectorType = "http-json" as const;

  private readonly normalizers = new Map<
    KnowledgeEntityType,
    DomainHttpJsonConnector
  >([
    ["education", new EducationCatalogConnector()],
    ["subsidy", new SubsidyCatalogConnector()],
    ["event", new EventCatalogConnector()],
    ["vacancy", new VacancyCatalogConnector()]
  ]);

  constructor(
    private readonly transport: HttpJsonKnowledgeConnector =
      new HttpJsonKnowledgeConnector()
  ) {}

  fetch(
    definition: ConnectorDefinition
  ): Promise<readonly unknown[]> {
    return this.transport.fetch(definition);
  }

  normalize(
    record: unknown,
    definition: ConnectorDefinition
  ): NormalizedKnowledgeEntity {
    const entityType = stringValue(
      definition.configuration.entityType,
      "generic"
    ) as KnowledgeEntityType;
    const normalizer = this.normalizers.get(entityType);

    return normalizer
      ? normalizer.normalize(record, definition)
      : this.transport.normalize(record, definition);
  }
}

export async function seedDomainConnectorDefinitions(
  repository: ConnectorRepository,
  environment: Readonly<Record<string, string | undefined>> =
    process.env
): Promise<void> {
  const now = new Date().toISOString();
  const definitions = [
    {
      key: "education-catalog",
      label: "Opleidingen",
      entityType: "education",
      url: environment.EDUCATION_CONNECTOR_URL,
      schedule: "every:24h"
    },
    {
      key: "subsidy-catalog",
      label: "Subsidies",
      entityType: "subsidy",
      url: environment.SUBSIDY_CONNECTOR_URL,
      schedule: "every:24h"
    },
    {
      key: "event-catalog",
      label: "Evenementen",
      entityType: "event",
      url: environment.EVENT_CONNECTOR_URL,
      schedule: "every:6h"
    },
    {
      key: "vacancy-catalog",
      label: "Vacatures",
      entityType: "vacancy",
      url: environment.VACANCY_CONNECTOR_URL,
      schedule: "every:1h"
    }
  ] as const;

  for (const definition of definitions) {
    const existing = await repository.findByKey(definition.key);
    if (existing) continue;

    await repository.upsert({
      id: crypto.randomUUID(),
      connectorKey: definition.key,
      connectorType: "http-json",
      label: definition.label,
      enabled: Boolean(definition.url),
      scheduleCron: definition.schedule,
      snapshotMode: true,
      configuration: {
        entityType: definition.entityType,
        url: definition.url ?? "",
        headers: {
          ...(environment.CONNECTOR_AUTHORIZATION_SECRET
            ? {
                Authorization:
                  `env:${environment.CONNECTOR_AUTHORIZATION_SECRET}`
              }
            : {})
        }
      },
      createdAt: now,
      updatedAt: now
    });
  }
}
