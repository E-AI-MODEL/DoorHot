import type {
  AdaptivePhaseDetector,
  AdaptivePhaseDetectorResult,
  RouteEngine,
  RouteEngineResult
} from "@door010/domain";

export interface RouteSession {
  id: string;
  userId?: string;
  selectedAnswerIds: readonly string[];
  result: RouteEngineResult;
  status: "active" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface RouteSessionRepository {
  save(session: RouteSession): Promise<void>;
  findById(id: string): Promise<RouteSession | null>;
}

export class InMemoryRouteSessionRepository
  implements RouteSessionRepository
{
  private readonly sessions = new Map<string, RouteSession>();

  async save(session: RouteSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findById(id: string): Promise<RouteSession | null> {
    return this.sessions.get(id) ?? null;
  }
}

export class RouteFlowService {
  constructor(
    private readonly engine: RouteEngine,
    private readonly sessions: RouteSessionRepository
  ) {}

  async start(userId?: string): Promise<RouteSession> {
    const result = this.engine.evaluate({ selectedAnswerIds: [] });
    const now = new Date().toISOString();
    const session: RouteSession = {
      id: globalThis.crypto.randomUUID(),
      userId,
      selectedAnswerIds: [],
      result,
      status: result.completed ? "completed" : "active",
      createdAt: now,
      updatedAt: now
    };
    await this.sessions.save(session);
    return session;
  }

  async answer(
    sessionId: string,
    answerId: string
  ): Promise<RouteSession> {
    const current = await this.sessions.findById(sessionId);
    if (!current) {
      throw new Error("route_session_not_found");
    }

    const allowedAnswerIds =
      current.result.nextQuestion?.answers.map((answer) => answer.id) ?? [];

    if (!allowedAnswerIds.includes(answerId)) {
      throw new Error("route_answer_not_allowed");
    }

    const selectedAnswerIds = [
      ...current.selectedAnswerIds,
      answerId
    ];
    const result = this.engine.evaluate({ selectedAnswerIds });
    const updated: RouteSession = {
      ...current,
      selectedAnswerIds,
      result,
      status: result.completed ? "completed" : "active",
      updatedAt: new Date().toISOString()
    };
    await this.sessions.save(updated);
    return updated;
  }

  async get(sessionId: string): Promise<RouteSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new Error("route_session_not_found");
    }
    return session;
  }
}

export interface PhaseFlowContext {
  organizationId?: string;
  userId: string;
  conversationId?: string;
  currentPhaseCode?: string;
  completedPhaseCodes?: readonly string[];
  knownSlots: readonly {
    key: never;
    value: never;
    confidence: number;
    source: "user" | "advisor" | "model" | "rule" | "import";
    updatedAt: string;
  }[];
  selectedEntities?: Readonly<Record<string, string | null | undefined>>;
  events?: readonly string[];
  intents?: readonly string[];
}

export interface PhaseSnapshot {
  id: string;
  userId: string;
  result: AdaptivePhaseDetectorResult;
  createdAt: string;
}

export class PhaseFlowService {
  private readonly snapshots: PhaseSnapshot[] = [];

  constructor(private readonly detector: AdaptivePhaseDetector) {}

  async evaluate(
    context: PhaseFlowContext
  ): Promise<PhaseSnapshot> {
    const result = await this.detector.evaluate(context);
    const snapshot: PhaseSnapshot = {
      id: globalThis.crypto.randomUUID(),
      userId: context.userId,
      result,
      createdAt: new Date().toISOString()
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  listLatest(limit = 50): readonly PhaseSnapshot[] {
    return [...this.snapshots]
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      )
      .slice(0, Math.max(1, Math.min(limit, 100)));
  }
}

export interface TalentOption {
  value: string;
  label: string;
  sectors: readonly string[];
}

export interface TalentQuestion {
  id: string;
  question: string;
  options: readonly TalentOption[];
}

export interface TalentTestDataset {
  schema_version: string;
  title: string;
  sectors: Readonly<Record<
    string,
    { label: string; description: string }
  >>;
  questions: readonly TalentQuestion[];
}

export interface TalentTestResult {
  id: string;
  userId: string;
  answers: Readonly<Record<string, string>>;
  scores: Readonly<Record<string, number>>;
  rankedSectors: readonly {
    sector: string;
    score: number;
    label: string;
    description: string;
  }[];
  primarySector: string;
  completedAt: string;
}

export class TalentTestService {
  private readonly results = new Map<string, TalentTestResult>();

  constructor(private readonly dataset: TalentTestDataset) {}

  getQuestions(): readonly TalentQuestion[] {
    return this.dataset.questions;
  }

  submit(
    userId: string,
    answers: Readonly<Record<string, string>>
  ): TalentTestResult {
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
      const answer = question.options.find(
        (option) => option.value === answers[question.id]
      );
      if (!answer) {
        throw new Error(`talent_answer_invalid:${question.id}`);
      }

      for (const sector of answer.sectors) {
        scores[sector] = (scores[sector] ?? 0) + 1;
      }
    }

    const rankedSectors = Object.entries(scores)
      .map(([sector, score]) => ({
        sector,
        score,
        label: this.dataset.sectors[sector]?.label ?? sector,
        description:
          this.dataset.sectors[sector]?.description ?? ""
      }))
      .sort((left, right) =>
        right.score - left.score ||
        left.sector.localeCompare(right.sector)
      );

    const primarySector = rankedSectors[0]?.sector;
    if (!primarySector) {
      throw new Error("talent_test_has_no_result");
    }

    const result: TalentTestResult = {
      id: globalThis.crypto.randomUUID(),
      userId,
      answers,
      scores,
      rankedSectors,
      primarySector,
      completedAt: new Date().toISOString()
    };
    this.results.set(userId, result);
    return result;
  }

  findByUserId(userId: string): TalentTestResult | null {
    return this.results.get(userId) ?? null;
  }
}

export interface AdvisorNote {
  id: string;
  candidateUserId: string;
  advisorUserId: string;
  content: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  candidateUserId: string;
  advisorUserId: string;
  subject: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "requested" | "confirmed" | "rescheduled" | "completed" | "cancelled" | "no_show";
  location?: string;
  meetingUrl?: string;
  createdAt: string;
}

export interface CandidateSummary {
  userId: string;
  displayName: string;
  email?: string;
  currentPhaseCode?: string;
  phaseSystemKey?: string;
  lastDetectorConfidence?: number;
  routeTitle?: string;
}


export type BackofficeAlertSeverity = "info" | "warning" | "critical";

export interface BackofficeAlert {
  id: string;
  candidateUserId: string;
  severity: BackofficeAlertSeverity;
  code:
    | "missing_phase"
    | "low_phase_confidence"
    | "missing_route"
    | "stale_profile"
    | "appointment_attention";
  title: string;
  description: string;
  createdAt: string;
}

export interface BackofficeStatistics {
  totalCandidates: number;
  candidatesWithRoute: number;
  candidatesWithoutRoute: number;
  lowConfidenceCandidates: number;
  phaseDistribution: Readonly<Record<string, number>>;
  upcomingAppointments: number;
  openAlerts: number;
}

export interface CandidateDetail {
  candidate: CandidateSummary;
  notes: readonly AdvisorNote[];
  appointments: readonly Appointment[];
  alerts: readonly BackofficeAlert[];
}

export class BackofficeService {
  private readonly notes: AdvisorNote[] = [];
  private readonly appointments: Appointment[] = [];
  private readonly candidates = new Map<string, CandidateSummary>();

  upsertCandidate(candidate: CandidateSummary): void {
    this.candidates.set(candidate.userId, candidate);
  }

  listCandidates(): readonly CandidateSummary[] {
    return [...this.candidates.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nl")
    );
  }

  addNote(input: Omit<AdvisorNote, "id" | "createdAt">): AdvisorNote {
    const note: AdvisorNote = {
      ...input,
      id: globalThis.crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.notes.push(note);
    return note;
  }

  listNotes(candidateUserId: string): readonly AdvisorNote[] {
    return this.notes.filter(
      (note) => note.candidateUserId === candidateUserId
    );
  }

  scheduleAppointment(
    input: Omit<Appointment, "id" | "createdAt">
  ): Appointment {
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new Error("appointment_end_must_follow_start");
    }

    const appointment: Appointment = {
      ...input,
      id: globalThis.crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.appointments.push(appointment);
    return appointment;
  }

  listAppointments(candidateUserId: string): readonly Appointment[] {
    return this.appointments
      .filter(
        (appointment) =>
          appointment.candidateUserId === candidateUserId
      )
      .sort((left, right) =>
        left.startsAt.localeCompare(right.startsAt)
      );
  }

  getCandidateDetail(candidateUserId: string): CandidateDetail {
    const candidate = this.candidates.get(candidateUserId);
    if (!candidate) {
      throw new Error("candidate_not_found");
    }

    const appointments = this.listAppointments(candidateUserId);
    return {
      candidate,
      notes: this.listNotes(candidateUserId),
      appointments,
      alerts: buildCandidateAlerts(candidate, appointments)
    };
  }

  listAlerts(): readonly BackofficeAlert[] {
    return [...this.candidates.values()]
      .flatMap((candidate) =>
        buildCandidateAlerts(
          candidate,
          this.listAppointments(candidate.userId)
        )
      )
      .sort((left, right) =>
        severityRank(right.severity) - severityRank(left.severity)
      );
  }

  getStatistics(): BackofficeStatistics {
    const candidates = this.listCandidates();
    const alerts = this.listAlerts();
    const phaseDistribution: Record<string, number> = {};

    for (const candidate of candidates) {
      const phase = candidate.currentPhaseCode ?? "unknown";
      phaseDistribution[phase] =
        (phaseDistribution[phase] ?? 0) + 1;
    }

    const now = Date.now();
    const upcomingAppointments = this.appointments.filter(
      (appointment) =>
        ["requested", "confirmed", "rescheduled"].includes(
          appointment.status
        ) &&
        new Date(appointment.startsAt).getTime() >= now
    ).length;

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
      upcomingAppointments,
      openAlerts: alerts.length
    };
  }
}

function severityRank(severity: BackofficeAlertSeverity): number {
  return severity === "critical"
    ? 3
    : severity === "warning"
      ? 2
      : 1;
}

function buildCandidateAlerts(
  candidate: CandidateSummary,
  appointments: readonly Appointment[]
): readonly BackofficeAlert[] {
  const now = new Date().toISOString();
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
      createdAt: now
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
      createdAt: now
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
      createdAt: now
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
      createdAt: now
    });
  }

  return alerts;
}

export interface EducationEvent {
  id: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  description?: string;
  startsAt?: string;
  eventUrl?: string;
  retrievedAt: string;
  expiresAt: string;
}

export interface EventSource {
  name: string;
  url: string;
}

export interface EventScraper {
  scrape(source: EventSource): Promise<readonly Omit<
    EducationEvent,
    "id" | "retrievedAt" | "expiresAt"
  >[]>;
}

export class InMemoryEventScraper implements EventScraper {
  constructor(
    private readonly fixtures: Readonly<Record<
      string,
      readonly Omit<
        EducationEvent,
        "id" | "retrievedAt" | "expiresAt"
      >[]
    >> = {}
  ) {}

  async scrape(source: EventSource) {
    return this.fixtures[source.url] ?? [];
  }
}

export class EventService {
  private readonly events = new Map<string, EducationEvent>();
  private readonly saved = new Map<string, Set<string>>();

  constructor(
    private readonly scraper: EventScraper,
    private readonly sources: readonly EventSource[],
    private readonly ttlHours = 12
  ) {}

  list(): readonly EducationEvent[] {
    const now = Date.now();
    return [...this.events.values()]
      .filter((event) => new Date(event.expiresAt).getTime() > now)
      .sort((left, right) =>
        (left.startsAt ?? "9999").localeCompare(
          right.startsAt ?? "9999"
        )
      );
  }

  async refresh(force = false): Promise<readonly EducationEvent[]> {
    const current = this.list();
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
        const key = [
          record.sourceUrl,
          record.title,
          record.startsAt ?? ""
        ].join("|");
        this.events.set(key, {
          ...record,
          id: globalThis.crypto.randomUUID(),
          retrievedAt: retrievedAt.toISOString(),
          expiresAt: expiresAt.toISOString()
        });
      }
    }

    return this.list();
  }

  save(userId: string, eventId: string): void {
    if (![...this.events.values()].some((event) => event.id === eventId)) {
      throw new Error("event_not_found");
    }

    const ids = this.saved.get(userId) ?? new Set<string>();
    ids.add(eventId);
    this.saved.set(userId, ids);
  }

  unsave(userId: string, eventId: string): void {
    this.saved.get(userId)?.delete(eventId);
  }

  listSaved(userId: string): readonly EducationEvent[] {
    const ids = this.saved.get(userId) ?? new Set<string>();
    return [...this.events.values()].filter((event) => ids.has(event.id));
  }
}

export const DEFAULT_EVENT_SOURCES: readonly EventSource[] = [
  {
    name: "Onderwijsloket Rotterdam",
    url: "https://www.onderwijsloketrotterdam.nl/activiteiten"
  },
  {
    name: "Onderwijs010",
    url: "https://www.onderwijs010.nl/activiteiten"
  },
  {
    name: "Landelijk Onderwijsloket",
    url: "https://www.onderwijsloket.com/activiteiten"
  }
];


export interface Vacancy {
  id: string;
  externalId?: string;
  title: string;
  organization?: string;
  sector?: string;
  location?: string;
  description?: string;
  url?: string;
  sourceName?: string;
  publishedAt?: string;
  expiresAt?: string;
  retrievedAt: string;
}

export interface VacancySearch {
  query?: string;
  sector?: string;
  organization?: string;
  location?: string;
  limit?: number;
}

export interface VacancyProvider {
  list(search?: VacancySearch): Promise<readonly Vacancy[]>;
}

export class InMemoryVacancyProvider implements VacancyProvider {
  constructor(
    private readonly vacancies: readonly Vacancy[] = []
  ) {}

  async list(search: VacancySearch = {}): Promise<readonly Vacancy[]> {
    const query = search.query?.trim().toLowerCase();
    const sector = search.sector?.trim().toLowerCase();
    const organization = search.organization?.trim().toLowerCase();
    const location = search.location?.trim().toLowerCase();
    const limit = Math.max(1, Math.min(search.limit ?? 50, 100));

    return this.vacancies
      .filter((vacancy) => {
        const haystack = [
          vacancy.title,
          vacancy.organization,
          vacancy.sector,
          vacancy.location,
          vacancy.description
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (!query || haystack.includes(query)) &&
          (!sector || vacancy.sector?.toLowerCase() === sector) &&
          (
            !organization ||
            vacancy.organization?.toLowerCase().includes(organization)
          ) &&
          (
            !location ||
            vacancy.location?.toLowerCase().includes(location)
          )
        );
      })
      .slice(0, limit);
  }
}

export interface SavedVacancy {
  userId: string;
  vacancyId: string;
  notes?: string;
  savedAt: string;
}

export interface VacancyProfileSummary {
  userId: string;
  savedVacancies: readonly Vacancy[];
  preferredSectors: readonly string[];
  organizations: readonly string[];
}

export class VacancyService {
  private readonly saved = new Map<
    string,
    Map<string, SavedVacancy>
  >();

  constructor(private readonly provider: VacancyProvider) {}

  async search(search?: VacancySearch): Promise<readonly Vacancy[]> {
    return this.provider.list(search);
  }

  async getById(vacancyId: string): Promise<Vacancy | null> {
    const vacancies = await this.provider.list({ limit: 100 });
    return vacancies.find((vacancy) => vacancy.id === vacancyId) ?? null;
  }

  async save(
    userId: string,
    vacancyId: string,
    notes?: string
  ): Promise<SavedVacancy> {
    const vacancy = await this.getById(vacancyId);
    if (!vacancy) {
      throw new Error("vacancy_not_found");
    }

    const records = this.saved.get(userId) ?? new Map<
      string,
      SavedVacancy
    >();
    const record: SavedVacancy = {
      userId,
      vacancyId,
      notes: notes?.trim() || undefined,
      savedAt: new Date().toISOString()
    };
    records.set(vacancyId, record);
    this.saved.set(userId, records);
    return record;
  }

  remove(userId: string, vacancyId: string): boolean {
    return this.saved.get(userId)?.delete(vacancyId) ?? false;
  }

  listSavedRecords(userId: string): readonly SavedVacancy[] {
    return [...(this.saved.get(userId)?.values() ?? [])]
      .sort((left, right) =>
        right.savedAt.localeCompare(left.savedAt)
      );
  }

  async listSaved(userId: string): Promise<readonly Vacancy[]> {
    const ids = new Set(
      this.listSavedRecords(userId).map((record) => record.vacancyId)
    );
    const vacancies = await this.provider.list({ limit: 100 });
    return vacancies.filter((vacancy) => ids.has(vacancy.id));
  }

  async getProfileSummary(
    userId: string
  ): Promise<VacancyProfileSummary> {
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
      ].sort((left, right) => left.localeCompare(right, "nl")),
      organizations: [
        ...new Set(
          savedVacancies
            .map((vacancy) => vacancy.organization)
            .filter((value): value is string => Boolean(value))
        )
      ].sort((left, right) => left.localeCompare(right, "nl"))
    };
  }
}
