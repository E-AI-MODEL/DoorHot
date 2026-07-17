import type { SqlExecutor } from "@door010/database";
import type {
  AdaptivePhaseDetector,
  RouteEngine
} from "@door010/domain";
import type {
  AdvisorNote,
  Appointment,
  BackofficeAlert,
  BackofficeStatistics,
  CandidateDetail,
  CandidateSummary,
  EducationEvent,
  EventScraper,
  EventSource,
  PhaseFlowContext,
  PhaseSnapshot,
  RouteSession,
  RouteSessionRepository,
  SavedVacancy,
  TalentTestDataset,
  TalentTestResult,
  Vacancy,
  VacancyProfileSummary,
  VacancyProvider,
  VacancySearch
} from "@door010/parity-flows";

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function asObject(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export class PostgresRouteSessionRepository
  implements RouteSessionRepository
{
  constructor(private readonly executor: SqlExecutor) {}

  async save(session: RouteSession): Promise<void> {
    await this.executor.query(
      `INSERT INTO route_sessions (
         id, user_id, selected_answer_ids, result, status,
         created_at, updated_at
       ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         selected_answer_ids = EXCLUDED.selected_answer_ids,
         result = EXCLUDED.result,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        session.id,
        session.userId ?? null,
        JSON.stringify(session.selectedAnswerIds),
        JSON.stringify(session.result),
        session.status,
        session.createdAt,
        session.updatedAt
      ]
    );
  }

  async findById(id: string): Promise<RouteSession | null> {
    const result = await this.executor.query<{
      id: string;
      user_id: string | null;
      selected_answer_ids: unknown;
      result: unknown;
      status: "active" | "completed";
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, user_id, selected_answer_ids, result, status,
              created_at, updated_at
       FROM route_sessions
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          userId: row.user_id ?? undefined,
          selectedAnswerIds: asStringArray(row.selected_answer_ids),
          result: row.result as RouteSession["result"],
          status: row.status,
          createdAt: toIso(row.created_at),
          updatedAt: toIso(row.updated_at)
        }
      : null;
  }
}

export class PostgresTalentTestService {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly dataset: TalentTestDataset
  ) {}

  getQuestions() {
    return this.dataset.questions;
  }

  async submit(
    userId: string,
    answers: Readonly<Record<string, string>>
  ): Promise<TalentTestResult> {
    const expected = new Set(
      this.dataset.questions.map((question) => question.id)
    );

    if (
      Object.keys(answers).length !== expected.size ||
      [...expected].some((questionId) => !answers[questionId])
    ) {
      throw new Error("talent_test_incomplete");
    }

    const scores: Record<string, number> = Object.fromEntries(
      Object.keys(this.dataset.sectors).map((sector) => [sector, 0])
    );

    for (const question of this.dataset.questions) {
      const option = question.options.find(
        (candidate) => candidate.value === answers[question.id]
      );
      if (!option) {
        throw new Error(`talent_answer_invalid:${question.id}`);
      }
      for (const sector of option.sectors) {
        scores[sector] = (scores[sector] ?? 0) + 1;
      }
    }

    const rankedSectors = Object.entries(scores)
      .map(([sector, score]) => ({
        sector,
        score,
        label: this.dataset.sectors[sector]?.label ?? sector,
        description: this.dataset.sectors[sector]?.description ?? ""
      }))
      .sort((left, right) =>
        right.score - left.score ||
        left.sector.localeCompare(right.sector)
      );

    const primarySector = rankedSectors[0]?.sector;
    if (!primarySector) {
      throw new Error("talent_test_has_no_result");
    }

    const completedAt = new Date().toISOString();
    const record: TalentTestResult = {
      id: globalThis.crypto.randomUUID(),
      userId,
      answers,
      scores,
      rankedSectors,
      primarySector,
      completedAt
    };

    await this.executor.query(
      `INSERT INTO talent_test_results (
         id, user_id, schema_version, answers, scores,
         ranked_sectors, primary_sector, completed_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8
       )`,
      [
        record.id,
        userId,
        this.dataset.schema_version,
        JSON.stringify(answers),
        JSON.stringify(scores),
        JSON.stringify(rankedSectors),
        primarySector,
        completedAt
      ]
    );

    await this.executor.query(
      `UPDATE profiles
       SET test_completed = true,
           test_results = $2::jsonb,
           preferred_sector = COALESCE(preferred_sector, $3),
           updated_at = now()
       WHERE user_id = $1`,
      [userId, JSON.stringify(record), primarySector]
    );

    return record;
  }

  async findByUserId(userId: string): Promise<TalentTestResult | null> {
    const result = await this.executor.query<{
      id: string;
      user_id: string;
      answers: unknown;
      scores: unknown;
      ranked_sectors: unknown;
      primary_sector: string;
      completed_at: string | Date;
    }>(
      `SELECT id, user_id, answers, scores, ranked_sectors,
              primary_sector, completed_at
       FROM talent_test_results
       WHERE user_id = $1
       ORDER BY completed_at DESC
       LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          answers: asObject(row.answers) as Readonly<Record<string, string>>,
          scores: asObject(row.scores) as Readonly<Record<string, number>>,
          rankedSectors: Array.isArray(row.ranked_sectors)
            ? row.ranked_sectors as TalentTestResult["rankedSectors"]
            : [],
          primarySector: row.primary_sector,
          completedAt: toIso(row.completed_at)
        }
      : null;
  }
}

export class PostgresPhaseFlowService {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly detector: AdaptivePhaseDetector
  ) {}

  async evaluate(context: PhaseFlowContext): Promise<PhaseSnapshot> {
    const result = await this.detector.evaluate(context);
    const snapshot: PhaseSnapshot = {
      id: globalThis.crypto.randomUUID(),
      userId: context.userId,
      result,
      createdAt: new Date().toISOString()
    };

    const profile = await this.executor.query<{ id: string }>(
      `SELECT id FROM profiles WHERE user_id = $1 LIMIT 1`,
      [context.userId]
    );
    const profileId = profile.rows[0]?.id;
    if (!profileId) {
      throw new Error("profile_not_found");
    }

    await this.executor.query(
      `INSERT INTO detector_snapshots (
         id, profile_id, conversation_id, input_snapshot,
         output_snapshot, rules_version, created_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
      [
        snapshot.id,
        profileId,
        context.conversationId ?? null,
        JSON.stringify(context),
        JSON.stringify(result),
        "phase-detector-v3",
        snapshot.createdAt
      ]
    );

    return snapshot;
  }

  async listLatest(limit = 50): Promise<readonly PhaseSnapshot[]> {
    const result = await this.executor.query<{
      id: string;
      user_id: string;
      output_snapshot: unknown;
      created_at: string | Date;
    }>(
      `SELECT ds.id, p.user_id, ds.output_snapshot, ds.created_at
       FROM detector_snapshots ds
       JOIN profiles p ON p.id = ds.profile_id
       ORDER BY ds.created_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 100))]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      result: row.output_snapshot as PhaseSnapshot["result"],
      createdAt: toIso(row.created_at)
    }));
  }
}

export class PostgresBackofficeService {
  constructor(private readonly executor: SqlExecutor) {}

  async upsertCandidate(_candidate: CandidateSummary): Promise<void> {
    throw new Error(
      "Candidates are derived from users, profiles and latest evaluations."
    );
  }

  async listCandidates(): Promise<readonly CandidateSummary[]> {
    const result = await this.executor.query<{
      user_id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      current_phase_key: string | null;
      phase_system_key: string | null;
      confidence: number | null;
      route_title: string | null;
    }>(
      `SELECT
         u.id AS user_id,
         u.email,
         p.first_name,
         p.last_name,
         p.current_phase_key,
         js.phase_system_key,
         pe.confidence,
         rr.title AS route_title
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       LEFT JOIN journey_states js ON js.profile_id = p.id
       LEFT JOIN LATERAL (
         SELECT confidence
         FROM phase_evaluations
         WHERE profile_id = p.id
         ORDER BY evaluated_at DESC
         LIMIT 1
       ) pe ON true
       LEFT JOIN LATERAL (
         SELECT title
         FROM route_recommendations rec
         JOIN route_evaluations re ON re.id = rec.route_evaluation_id
         WHERE re.profile_id = p.id
         ORDER BY rec.created_at DESC
         LIMIT 1
       ) rr ON true
       ORDER BY p.updated_at DESC`
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      displayName:
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        row.email,
      email: row.email,
      currentPhaseCode: row.current_phase_key ?? undefined,
      phaseSystemKey: row.phase_system_key ?? undefined,
      lastDetectorConfidence: row.confidence ?? undefined,
      routeTitle: row.route_title ?? undefined
    }));
  }

  async addNote(
    input: Omit<AdvisorNote, "id" | "createdAt">
  ): Promise<AdvisorNote> {
    const result = await this.executor.query<{
      id: string;
      candidate_user_id: string;
      advisor_user_id: string;
      content: string;
      created_at: string | Date;
    }>(
      `INSERT INTO advisor_notes (
         id, candidate_user_id, advisor_user_id, content, created_at
       ) VALUES ($1, $2, $3, $4, now())
       RETURNING id, candidate_user_id, advisor_user_id, content, created_at`,
      [
        globalThis.crypto.randomUUID(),
        input.candidateUserId,
        input.advisorUserId,
        input.content
      ]
    );
    const row = result.rows[0]!;
    return {
      id: row.id,
      candidateUserId: row.candidate_user_id,
      advisorUserId: row.advisor_user_id,
      content: row.content,
      createdAt: toIso(row.created_at)
    };
  }

  async listNotes(
    candidateUserId: string
  ): Promise<readonly AdvisorNote[]> {
    const result = await this.executor.query<{
      id: string;
      candidate_user_id: string;
      advisor_user_id: string;
      content: string;
      created_at: string | Date;
    }>(
      `SELECT id, candidate_user_id, advisor_user_id, content, created_at
       FROM advisor_notes
       WHERE candidate_user_id = $1
       ORDER BY created_at DESC`,
      [candidateUserId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      candidateUserId: row.candidate_user_id,
      advisorUserId: row.advisor_user_id,
      content: row.content,
      createdAt: toIso(row.created_at)
    }));
  }

  async scheduleAppointment(
    input: Omit<Appointment, "id" | "createdAt">
  ): Promise<Appointment> {
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new Error("appointment_end_must_follow_start");
    }

    const result = await this.executor.query<{
      id: string;
      candidate_user_id: string;
      advisor_user_id: string;
      subject: string;
      description: string | null;
      starts_at: string | Date;
      ends_at: string | Date;
      timezone: string;
      status: Appointment["status"];
      location: string | null;
      meeting_url: string | null;
      created_at: string | Date;
    }>(
      `INSERT INTO appointments (
         id, candidate_user_id, advisor_user_id, subject, description,
         starts_at, ends_at, timezone, status, location, meeting_url
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
       )
       RETURNING *`,
      [
        globalThis.crypto.randomUUID(),
        input.candidateUserId,
        input.advisorUserId,
        input.subject,
        input.description ?? null,
        input.startsAt,
        input.endsAt,
        input.timezone,
        input.status,
        input.location ?? null,
        input.meetingUrl ?? null
      ]
    );
    return mapAppointment(result.rows[0]!);
  }

  async listAppointments(
    candidateUserId: string
  ): Promise<readonly Appointment[]> {
    const result = await this.executor.query<{
      id: string;
      candidate_user_id: string;
      advisor_user_id: string;
      subject: string;
      description: string | null;
      starts_at: string | Date;
      ends_at: string | Date;
      timezone: string;
      status: Appointment["status"];
      location: string | null;
      meeting_url: string | null;
      created_at: string | Date;
    }>(
      `SELECT * FROM appointments
       WHERE candidate_user_id = $1
       ORDER BY starts_at ASC`,
      [candidateUserId]
    );
    return result.rows.map(mapAppointment);
  }

  async getCandidateDetail(
    candidateUserId: string
  ): Promise<CandidateDetail> {
    const candidate = (await this.listCandidates()).find(
      (item) => item.userId === candidateUserId
    );
    if (!candidate) {
      throw new Error("candidate_not_found");
    }

    const [notes, appointments] = await Promise.all([
      this.listNotes(candidateUserId),
      this.listAppointments(candidateUserId)
    ]);

    return {
      candidate,
      notes,
      appointments,
      alerts: buildPersistenceAlerts(candidate, appointments)
    };
  }

  async listAlerts(): Promise<readonly BackofficeAlert[]> {
    const candidates = await this.listCandidates();
    const alerts = await Promise.all(
      candidates.map(async (candidate) =>
        buildPersistenceAlerts(
          candidate,
          await this.listAppointments(candidate.userId)
        )
      )
    );

    return alerts
      .flat()
      .sort((left, right) =>
        persistenceSeverityRank(right.severity) -
        persistenceSeverityRank(left.severity)
      );
  }

  async getStatistics(): Promise<BackofficeStatistics> {
    const candidates = await this.listCandidates();
    const alerts = await this.listAlerts();
    const phaseDistribution: Record<string, number> = {};

    for (const candidate of candidates) {
      const phase = candidate.currentPhaseCode ?? "unknown";
      phaseDistribution[phase] =
        (phaseDistribution[phase] ?? 0) + 1;
    }

    const appointmentResult = await this.executor.query<{
      count: number | string;
    }>(
      `SELECT count(*) AS count
       FROM appointments
       WHERE status IN ('requested', 'confirmed', 'rescheduled')
         AND starts_at >= now()`
    );

    return {
      totalCandidates: candidates.length,
      candidatesWithRoute: candidates.filter(
        (candidate) => Boolean(candidate.routeTitle)
      ).length,
      candidatesWithoutRoute: candidates.filter(
        (candidate) => !candidate.routeTitle
      ).length,
      lowConfidenceCandidates: candidates.filter(
        (candidate) =>
          candidate.lastDetectorConfidence !== undefined &&
          candidate.lastDetectorConfidence < 0.5
      ).length,
      phaseDistribution,
      upcomingAppointments: Number(
        appointmentResult.rows[0]?.count ?? 0
      ),
      openAlerts: alerts.length
    };
  }
}

function persistenceSeverityRank(
  severity: BackofficeAlert["severity"]
): number {
  return severity === "critical"
    ? 3
    : severity === "warning"
      ? 2
      : 1;
}

function buildPersistenceAlerts(
  candidate: CandidateSummary,
  appointments: readonly Appointment[]
): readonly BackofficeAlert[] {
  const createdAt = new Date().toISOString();
  const alerts: BackofficeAlert[] = [];

  if (!candidate.currentPhaseCode) {
    alerts.push({
      id: `${candidate.userId}:missing_phase`,
      candidateUserId: candidate.userId,
      severity: "critical",
      code: "missing_phase",
      title: "Fase ontbreekt",
      description:
        "Deze kandidaat heeft nog geen vastgestelde trajectfase.",
      createdAt
    });
  }

  if (
    candidate.lastDetectorConfidence !== undefined &&
    candidate.lastDetectorConfidence < 0.5
  ) {
    alerts.push({
      id: `${candidate.userId}:low_phase_confidence`,
      candidateUserId: candidate.userId,
      severity: "warning",
      code: "low_phase_confidence",
      title: "Lage detectorconfidence",
      description:
        "Controleer de fase en ontbrekende profielinformatie.",
      createdAt
    });
  }

  if (!candidate.routeTitle) {
    alerts.push({
      id: `${candidate.userId}:missing_route`,
      candidateUserId: candidate.userId,
      severity: "warning",
      code: "missing_route",
      title: "Route ontbreekt",
      description:
        "De kandidaat heeft nog geen aanbevolen onderwijsroute.",
      createdAt
    });
  }

  if (
    appointments.some((appointment) =>
      ["requested", "rescheduled"].includes(appointment.status)
    )
  ) {
    alerts.push({
      id: `${candidate.userId}:appointment_attention`,
      candidateUserId: candidate.userId,
      severity: "info",
      code: "appointment_attention",
      title: "Afspraak vraagt aandacht",
      description:
        "Er staat een aangevraagde of verplaatste afspraak open.",
      createdAt
    });
  }

  return alerts;
}

function mapAppointment(row: {
  id: string;
  candidate_user_id: string;
  advisor_user_id: string;
  subject: string;
  description: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  timezone: string;
  status: Appointment["status"];
  location: string | null;
  meeting_url: string | null;
  created_at: string | Date;
}): Appointment {
  return {
    id: row.id,
    candidateUserId: row.candidate_user_id,
    advisorUserId: row.advisor_user_id,
    subject: row.subject,
    description: row.description ?? undefined,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    timezone: row.timezone,
    status: row.status,
    location: row.location ?? undefined,
    meetingUrl: row.meeting_url ?? undefined,
    createdAt: toIso(row.created_at)
  };
}

export class PostgresEventService {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly scraper: EventScraper,
    private readonly sources: readonly EventSource[],
    private readonly ttlHours = 12
  ) {}

  async list(): Promise<readonly EducationEvent[]> {
    const result = await this.executor.query<{
      id: string;
      source_name: string;
      source_url: string;
      title: string;
      description: string | null;
      starts_at: string | Date | null;
      event_url: string | null;
      retrieved_at: string | Date;
      expires_at: string | Date;
    }>(
      `SELECT id, source_name, source_url, title, description,
              starts_at, event_url, retrieved_at, expires_at
       FROM scraped_events
       WHERE expires_at > now()
       ORDER BY starts_at NULLS LAST, title`
    );
    return result.rows.map(mapEvent);
  }

  async refresh(force = false): Promise<readonly EducationEvent[]> {
    const current = await this.list();
    if (!force && current.length > 0) {
      return current;
    }

    const retrievedAt = new Date();
    const expiresAt = new Date(
      retrievedAt.getTime() + this.ttlHours * 60 * 60 * 1000
    );

    for (const source of this.sources) {
      const records = await this.scraper.scrape(source);
      for (const record of records) {
        const fingerprint = [
          record.sourceUrl,
          record.title,
          record.startsAt ?? ""
        ].join("|");

        await this.executor.query(
          `INSERT INTO scraped_events (
             id, source_name, source_url, title, description,
             starts_at, event_url, retrieved_at, expires_at, fingerprint
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
           )
           ON CONFLICT (fingerprint) DO UPDATE SET
             description = EXCLUDED.description,
             starts_at = EXCLUDED.starts_at,
             event_url = EXCLUDED.event_url,
             retrieved_at = EXCLUDED.retrieved_at,
             expires_at = EXCLUDED.expires_at`,
          [
            globalThis.crypto.randomUUID(),
            record.sourceName,
            record.sourceUrl,
            record.title,
            record.description ?? null,
            record.startsAt ?? null,
            record.eventUrl ?? null,
            retrievedAt.toISOString(),
            expiresAt.toISOString(),
            fingerprint
          ]
        );
      }
    }

    return this.list();
  }

  async save(userId: string, eventId: string): Promise<void> {
    const result = await this.executor.query(
      `INSERT INTO saved_events (user_id, event_id, saved_at)
       SELECT $1, id, now()
       FROM events
       WHERE id = $2
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [userId, eventId]
    );

    if (result.rowCount === 0) {
      const scraped = await this.executor.query<{
        id: string;
        source_name: string;
        source_url: string;
        title: string;
        description: string | null;
        starts_at: string | Date | null;
        event_url: string | null;
        retrieved_at: string | Date;
        expires_at: string | Date;
      }>(
        `SELECT * FROM scraped_events WHERE id = $1 LIMIT 1`,
        [eventId]
      );
      const event = scraped.rows[0];
      if (!event) throw new Error("event_not_found");

      await this.executor.query(
        `INSERT INTO saved_external_events (
           user_id, external_event_id, event_snapshot, saved_at
         ) VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (user_id, external_event_id) DO UPDATE SET
           event_snapshot = EXCLUDED.event_snapshot,
           saved_at = now()`,
        [userId, eventId, JSON.stringify(mapEvent(event))]
      );
    }
  }

  async unsave(userId: string, eventId: string): Promise<void> {
    await Promise.all([
      this.executor.query(
        `DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2`,
        [userId, eventId]
      ),
      this.executor.query(
        `DELETE FROM saved_external_events
         WHERE user_id = $1 AND external_event_id = $2`,
        [userId, eventId]
      )
    ]);
  }

  async listSaved(userId: string): Promise<readonly EducationEvent[]> {
    const result = await this.executor.query<{ event_snapshot: unknown }>(
      `SELECT event_snapshot
       FROM saved_external_events
       WHERE user_id = $1
       ORDER BY saved_at DESC`,
      [userId]
    );
    return result.rows.map(
      (row) => row.event_snapshot as EducationEvent
    );
  }
}

function mapEvent(row: {
  id: string;
  source_name: string;
  source_url: string;
  title: string;
  description: string | null;
  starts_at: string | Date | null;
  event_url: string | null;
  retrieved_at: string | Date;
  expires_at: string | Date;
}): EducationEvent {
  return {
    id: row.id,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    title: row.title,
    description: row.description ?? undefined,
    startsAt: row.starts_at ? toIso(row.starts_at) : undefined,
    eventUrl: row.event_url ?? undefined,
    retrievedAt: toIso(row.retrieved_at),
    expiresAt: toIso(row.expires_at)
  };
}

export class PostgresVacancyService {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly provider: VacancyProvider
  ) {}

  async search(search: VacancySearch = {}): Promise<readonly Vacancy[]> {
    const providerResults = await this.provider.list(search);
    for (const vacancy of providerResults) {
      await this.upsert(vacancy);
    }

    const result = await this.executor.query<{
      id: string;
      external_id: string | null;
      title: string;
      organization: string | null;
      sector: string | null;
      location: string | null;
      description: string | null;
      url: string | null;
      source_name: string | null;
      published_at: string | Date | null;
      expires_at: string | Date | null;
      retrieved_at: string | Date;
    }>(
      `SELECT id, external_id, title, organization, sector, location,
              description, url, source_name, published_at,
              expires_at, retrieved_at
       FROM vacancies
       WHERE ($1::text IS NULL OR
              to_tsvector('dutch',
                coalesce(title, '') || ' ' ||
                coalesce(organization, '') || ' ' ||
                coalesce(description, '')
              ) @@ plainto_tsquery('dutch', $1))
         AND ($2::text IS NULL OR lower(sector) = lower($2))
         AND ($3::text IS NULL OR organization ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR location ILIKE '%' || $4 || '%')
       ORDER BY published_at DESC NULLS LAST, retrieved_at DESC
       LIMIT $5`,
      [
        search.query ?? null,
        search.sector ?? null,
        search.organization ?? null,
        search.location ?? null,
        Math.max(1, Math.min(search.limit ?? 50, 100))
      ]
    );

    return result.rows.map(mapVacancy);
  }

  async getById(vacancyId: string): Promise<Vacancy | null> {
    const result = await this.executor.query<{
      id: string;
      external_id: string | null;
      title: string;
      organization: string | null;
      sector: string | null;
      location: string | null;
      description: string | null;
      url: string | null;
      source_name: string | null;
      published_at: string | Date | null;
      expires_at: string | Date | null;
      retrieved_at: string | Date;
    }>(
      `SELECT id, external_id, title, organization, sector, location,
              description, url, source_name, published_at,
              expires_at, retrieved_at
       FROM vacancies WHERE id = $1 LIMIT 1`,
      [vacancyId]
    );
    return result.rows[0] ? mapVacancy(result.rows[0]) : null;
  }

  async save(
    userId: string,
    vacancyId: string,
    notes?: string
  ): Promise<SavedVacancy> {
    if (!(await this.getById(vacancyId))) {
      throw new Error("vacancy_not_found");
    }

    const savedAt = new Date().toISOString();
    await this.executor.query(
      `INSERT INTO saved_vacancies (
         user_id, vacancy_id, notes, saved_at
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, vacancy_id) DO UPDATE SET
         notes = EXCLUDED.notes,
         saved_at = EXCLUDED.saved_at`,
      [userId, vacancyId, notes?.trim() || null, savedAt]
    );

    return {
      userId,
      vacancyId,
      notes: notes?.trim() || undefined,
      savedAt
    };
  }

  async remove(userId: string, vacancyId: string): Promise<boolean> {
    const result = await this.executor.query(
      `DELETE FROM saved_vacancies
       WHERE user_id = $1 AND vacancy_id = $2`,
      [userId, vacancyId]
    );
    return result.rowCount > 0;
  }

  async listSaved(userId: string): Promise<readonly Vacancy[]> {
    const result = await this.executor.query<{
      id: string;
      external_id: string | null;
      title: string;
      organization: string | null;
      sector: string | null;
      location: string | null;
      description: string | null;
      url: string | null;
      source_name: string | null;
      published_at: string | Date | null;
      expires_at: string | Date | null;
      retrieved_at: string | Date;
    }>(
      `SELECT v.id, v.external_id, v.title, v.organization, v.sector,
              v.location, v.description, v.url, v.source_name,
              v.published_at, v.expires_at, v.retrieved_at
       FROM saved_vacancies sv
       JOIN vacancies v ON v.id = sv.vacancy_id
       WHERE sv.user_id = $1
       ORDER BY sv.saved_at DESC`,
      [userId]
    );
    return result.rows.map(mapVacancy);
  }

  async getProfileSummary(userId: string): Promise<VacancyProfileSummary> {
    const savedVacancies = await this.listSaved(userId);
    return {
      userId,
      savedVacancies,
      preferredSectors: [
        ...new Set(
          savedVacancies
            .map((vacancy) => vacancy.sector)
            .filter((value): value is string => Boolean(value))
        )
      ].sort(),
      organizations: [
        ...new Set(
          savedVacancies
            .map((vacancy) => vacancy.organization)
            .filter((value): value is string => Boolean(value))
        )
      ].sort()
    };
  }

  private async upsert(vacancy: Vacancy): Promise<void> {
    await this.executor.query(
      `INSERT INTO vacancies (
         id, external_id, title, organization, sector, location,
         description, url, source_name, published_at, expires_at,
         retrieved_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       )
       ON CONFLICT (id) DO UPDATE SET
         external_id = EXCLUDED.external_id,
         title = EXCLUDED.title,
         organization = EXCLUDED.organization,
         sector = EXCLUDED.sector,
         location = EXCLUDED.location,
         description = EXCLUDED.description,
         url = EXCLUDED.url,
         source_name = EXCLUDED.source_name,
         published_at = EXCLUDED.published_at,
         expires_at = EXCLUDED.expires_at,
         retrieved_at = EXCLUDED.retrieved_at`,
      [
        vacancy.id,
        vacancy.externalId ?? null,
        vacancy.title,
        vacancy.organization ?? null,
        vacancy.sector ?? null,
        vacancy.location ?? null,
        vacancy.description ?? null,
        vacancy.url ?? null,
        vacancy.sourceName ?? null,
        vacancy.publishedAt ?? null,
        vacancy.expiresAt ?? null,
        vacancy.retrievedAt
      ]
    );
  }
}

function mapVacancy(row: {
  id: string;
  external_id: string | null;
  title: string;
  organization: string | null;
  sector: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | Date | null;
  expires_at: string | Date | null;
  retrieved_at: string | Date;
}): Vacancy {
  return {
    id: row.id,
    externalId: row.external_id ?? undefined,
    title: row.title,
    organization: row.organization ?? undefined,
    sector: row.sector ?? undefined,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    url: row.url ?? undefined,
    sourceName: row.source_name ?? undefined,
    publishedAt: row.published_at ? toIso(row.published_at) : undefined,
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined,
    retrievedAt: toIso(row.retrieved_at)
  };
}

export function createPostgresRouteFlow(
  executor: SqlExecutor,
  engine: RouteEngine
) {
  return {
    repository: new PostgresRouteSessionRepository(executor),
    engine
  };
}
