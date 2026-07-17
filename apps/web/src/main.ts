import type {
  AuthSessionDto,
  AuthenticatedUserDto,
  ChatResponse,
  ProfileDto
} from "@door010/contracts";
import {
  ApiError,
  Door010Api,
  type BackofficeAlert,
  type BackofficeStatistics,
  type AdvisorMessage,
  type CandidateDetail,
  type CandidateSummary,
  type ConnectorHealthDto,
  type EducationEvent,
  type ExecutionRequestDto,
  type GraphContextDto,
  type JourneyDashboardDto,
  type KnowledgeResult,
  type NotificationOutboxDto,
  type OrchestrationRunDto,
  type PlannerShadowEvaluationDto,
  type PendingMutation,
  type PromptConfig,
  type ProviderDeadLetter,
  type ProviderRuntimeStatus,
  type RouteSession,
  type TalentQuestion,
  type Vacancy
} from "./api.js";
import "./styles.css";

type View =
  | "public-chat"
  | "personal-chat"
  | "journey-dashboard"
  | "profile"
  | "knowledge"
  | "route"
  | "talent"
  | "events"
  | "vacancies"
  | "advisor-chat"
  | "backoffice"
  | "account";

interface AppState {
  token: string | null;
  user: AuthenticatedUserDto | null;
  profile: ProfileDto | null;
  view: View;
  busy: boolean;
  routeSession: RouteSession | null;
  talentQuestions: readonly TalentQuestion[];
  advisorConversationId: string;
}

const state: AppState = {
  token: localStorage.getItem("door010.accessToken"),
  user: null,
  profile: null,
  view: "public-chat",
  busy: false,
  routeSession: null,
  talentQuestions: [],
  advisorConversationId:
    localStorage.getItem("door010.advisorConversationId") ??
    crypto.randomUUID()
};

localStorage.setItem(
  "door010.advisorConversationId",
  state.advisorConversationId
);

const api = new Door010Api(() => state.token);
let advisorStreamController: AbortController | undefined;
const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("App root is missing.");
}

const app: HTMLDivElement = appElement;

function setSession(session: AuthSessionDto): void {
  state.token = session.accessToken;
  state.user = session.user;
  localStorage.setItem("door010.accessToken", session.accessToken);
}

function clearSession(): void {
  state.token = null;
  state.user = null;
  state.profile = null;
  localStorage.removeItem("door010.accessToken");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}

function renderShell(content: string): void {
  const authenticated = Boolean(state.user);

  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#" data-view="public-chat">
        <span class="brand-mark">D</span>
        <span>
          <strong>Door010</strong>
          <small>Werken en leren in het onderwijs</small>
        </span>
      </a>
      <nav aria-label="Hoofdnavigatie">
        <button data-view="public-chat">Algemene coach</button>
        <button data-view="knowledge">Kennisbank</button>
        <button data-view="route">Route</button>
        <button data-view="talent">Talententest</button>
        <button data-view="events">Evenementen</button>
        <button data-view="vacancies">Vacatures</button>
        <button data-view="personal-chat">Mijn coach</button>
        <button data-view="journey-dashboard">Mijn traject</button>
        <button data-view="advisor-chat">Adviseur</button>
        <button data-view="profile">Profiel</button>
        ${state.user?.roles.some((role) =>
          ["advisor", "administrator", "superuser"].includes(role)
        )
          ? '<button data-view="backoffice">Backoffice</button>'
          : ""}
        <button data-view="account">
          ${authenticated ? escapeHtml(state.user?.email ?? "Account") : "Inloggen"}
        </button>
      </nav>
    </header>
    <main>${content}</main>
    <footer>
      <span>Door010 3.0</span>
      <a href="/health/live" target="_blank" rel="noreferrer">
        Systeemstatus
      </a>
    </footer>
  `;

  for (const element of app.querySelectorAll<HTMLElement>("[data-view]")) {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      state.view = element.dataset.view as View;
      void render();
    });
  }
}

function messagePanel(
  title: string,
  intro: string,
  personal: boolean
): string {
  return `
    <section class="hero">
      <div>
        <span class="eyebrow">${personal ? "Persoonlijk traject" : "Vrij toegankelijk"}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(intro)}</p>
      </div>
      <div class="hero-card">
        <strong>${personal ? "Jouw volgende stap" : "Eén vraag tegelijk"}</strong>
        <p>
          ${personal
            ? "Je coach gebruikt je profiel, route en fase."
            : "Je krijgt een direct antwoord met gecontroleerde bronnen."}
        </p>
      </div>
    </section>
    <section class="panel chat-panel">
      <div id="conversation" class="conversation" aria-live="polite">
        <article class="message assistant">
          <strong>Door010</strong>
          <p>Waarmee kan ik je helpen?</p>
        </article>
      </div>
      <form id="chat-form" class="composer">
        <label class="sr-only" for="chat-message">Je vraag</label>
        <textarea
          id="chat-message" data-testid="chat-message"
          name="message"
          rows="3"
          maxlength="8000"
          placeholder="Stel je vraag over werken of leren in het onderwijs…"
          required
        ></textarea>
        <button class="primary" type="submit">
          Versturen
        </button>
      </form>
    </section>
  `;
}

function appendChatMessage(
  role: "user" | "assistant",
  content: string,
  response?: ChatResponse
): void {
  const conversation =
    document.querySelector<HTMLDivElement>("#conversation");
  if (!conversation) return;

  const article = document.createElement("article");
  article.className = `message ${role}`;

  const links = response?.artifacts
    .filter((artifact) => artifact.type === "link")
    .map((artifact) => {
      const href = String(artifact.payload.href ?? "#");
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(artifact.label)}</a>`;
    })
    .join("");
  const pendingMutations =
    (response as ChatResponse & {
      pendingMutations?: readonly PendingMutation[];
    } | undefined)?.pendingMutations ?? [];
  const mutationActions = pendingMutations.map((mutation) => `
    <div class="mutation-card" data-mutation-id="${mutation.id}">
      <strong>
        ${mutation.mutation.type === "phase-transition"
          ? "Voorgestelde fasewijziging"
          : "Voorgestelde profielwijziging"}
      </strong>
      <pre>${escapeHtml(JSON.stringify(mutation.mutation.payload, null, 2))}</pre>
      <div class="actions">
        <button
          type="button"
          class="primary mutation-decision"
          data-decision="accept"
          data-mutation-id="${mutation.id}"
        >
          Bevestigen
        </button>
        <button
          type="button"
          class="secondary mutation-decision"
          data-decision="reject"
          data-mutation-id="${mutation.id}"
        >
          Weigeren
        </button>
      </div>
    </div>
  `).join("");

  article.innerHTML = `
    <strong>${role === "user" ? "Jij" : "Door010"}</strong>
    <p>${escapeHtml(content)}</p>
    ${links ? `<div class="source-links">${links}</div>` : ""}
    ${mutationActions}
  `;

  conversation.append(article);

  for (const button of article.querySelectorAll<HTMLButtonElement>(
    ".mutation-decision"
  )) {
    button.addEventListener("click", async () => {
      if (!state.user) return;
      const mutationId = button.dataset.mutationId;
      const decision = button.dataset.decision as
        | "accept"
        | "reject"
        | undefined;
      if (!mutationId || !decision) return;

      await api.confirmMutation(
        mutationId,
        state.user.id,
        decision
      );
      const card = button.closest<HTMLElement>(".mutation-card");
      if (card) {
        card.innerHTML = `<p>${
          decision === "accept"
            ? "Wijziging bevestigd."
            : "Wijziging geweigerd."
        }</p>`;
      }
    });
  }
  conversation.scrollTop = conversation.scrollHeight;
}

async function bindChat(personal: boolean): Promise<void> {
  const form = document.querySelector<HTMLFormElement>("#chat-form");
  const textarea =
    document.querySelector<HTMLTextAreaElement>("#chat-message");

  if (!form || !textarea) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = textarea.value.trim();
    if (!message || state.busy) return;

    if (personal && !state.user) {
      state.view = "account";
      await render("Log eerst in om je persoonlijke coach te gebruiken.");
      return;
    }

    appendChatMessage("user", message);
    textarea.value = "";
    state.busy = true;

    try {
      const request = {
        message,
        userId: personal ? state.user?.id : undefined
      };
      const response = personal
        ? await api.personalChat(request)
        : await api.generalChat(request);

      appendChatMessage("assistant", response.message, response);
    } catch (error) {
      appendChatMessage(
        "assistant",
        error instanceof ApiError
          ? `De aanvraag kon niet worden verwerkt: ${error.code}.`
          : "Er ging iets mis. Probeer het opnieuw."
      );
    } finally {
      state.busy = false;
    }
  });
}

function accountView(notice?: string): string {
  if (state.user) {
    return `
      <section class="narrow">
        <span class="eyebrow">Account</span>
        <h1>Welkom terug</h1>
        <p>${escapeHtml(state.user.email)}</p>
        <div class="panel actions">
          <button id="logout" class="secondary">Uitloggen</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="narrow">
      <span class="eyebrow">Account</span>
      <h1>Inloggen of registreren</h1>
      ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ""}
      <form id="account-form" data-testid="account-form" class="panel form-grid">
        <label>
          E-mailadres
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <label>
          Wachtwoord
          <input
            name="password"
            type="password"
            minlength="12"
            autocomplete="current-password"
            required
          />
        </label>
        <div class="actions">
          <button class="primary" type="submit" name="action" value="login">
            Inloggen
          </button>
          <button class="secondary" type="submit" name="action" value="register">
            Registreren
          </button>
        </div>
      </form>
    </section>
  `;
}

async function bindAccount(): Promise<void> {
  const logout = document.querySelector<HTMLButtonElement>("#logout");
  logout?.addEventListener("click", () => {
    clearSession();
    state.view = "public-chat";
    void render();
  });

  const form = document.querySelector<HTMLFormElement>("#account-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    try {
      const session = submitter?.value === "register"
        ? await api.register(email, password)
        : await api.login(email, password);
      setSession(session);
      state.view = "profile";
      await render();
    } catch (error) {
      await render(
        error instanceof ApiError
          ? `Inloggen mislukt: ${error.code}.`
          : "Inloggen mislukt."
      );
    }
  });
}

function journeyDashboardView(): string {
  if (!state.user) {
    return accountView("Log in om je traject te bekijken.");
  }

  return `
    <section class="wide-page journey-dashboard-page">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Mijn traject</span>
          <h1>Jouw voortgang en volgende stap</h1>
          <p>
            Doelen, acties, blokkades en meldingen uit je persoonlijke journey.
          </p>
        </div>
        <button
          id="refresh-journey-dashboard"
          class="secondary"
          type="button"
        >
          Vernieuwen
        </button>
      </div>
      <div
        id="journey-dashboard-content"
        data-testid="journey-dashboard"
      >
        <p>Traject laden…</p>
      </div>
    </section>
  `;
}

function renderJourneyDashboard(
  dashboard: JourneyDashboardDto,
  graph: GraphContextDto,
  notifications: readonly NotificationOutboxDto[]
): void {
  const container =
    document.querySelector<HTMLDivElement>(
      "#journey-dashboard-content"
    );
  if (!container) return;

  const { aggregate, nextAction } = dashboard;
  const progress = Math.round(
    aggregate.journey.progress * 100
  );
  const activeGoals = aggregate.goals.filter(
    (item) => !["completed", "cancelled"].includes(item.status)
  );
  const openBlockers = aggregate.blockers.filter(
    (item) => ["open", "mitigating"].includes(item.status)
  );
  const pendingActions = aggregate.actions.filter(
    (item) => ["pending", "doing"].includes(item.status)
  );

  container.innerHTML = `
    <section class="journey-summary-grid">
      <article class="panel journey-summary-card">
        <span class="eyebrow">Voortgang</span>
        <strong>${progress}%</strong>
        <progress max="100" value="${progress}">
          ${progress}%
        </progress>
      </article>
      <article class="panel journey-summary-card">
        <span class="eyebrow">Fase</span>
        <strong>${escapeHtml(aggregate.journey.phaseKey)}</strong>
        <p>${escapeHtml(
          aggregate.journey.routeKey ?? "Route nog niet gekozen"
        )}</p>
      </article>
      <article class="panel journey-summary-card">
        <span class="eyebrow">Volgende actie</span>
        <strong>${escapeHtml(
          nextAction?.title ?? "Nog geen actie gepland"
        )}</strong>
      </article>
      <article class="panel journey-summary-card">
        <span class="eyebrow">Meldingen</span>
        <strong>${notifications.length}</strong>
        <p>Afgeleverde in-app meldingen.</p>
      </article>
    </section>

    <div class="journey-dashboard-grid">
      <section class="panel journey-dashboard-card">
        <h2>Doelen</h2>
        ${activeGoals.map((goal) => `
          <article class="journey-item">
            <strong>${escapeHtml(goal.title)}</strong>
            <span class="status">${escapeHtml(goal.status)}</span>
            ${goal.description
              ? `<p>${escapeHtml(goal.description)}</p>`
              : ""}
          </article>
        `).join("") || "<p>Geen actieve doelen.</p>"}
      </section>

      <section class="panel journey-dashboard-card">
        <h2>Milestones</h2>
        ${aggregate.milestones.map((milestone) => `
          <article class="journey-item">
            <strong>${escapeHtml(milestone.title)}</strong>
            <span class="status">${escapeHtml(milestone.status)}</span>
            ${milestone.status === "pending" ? `
              <button
                class="secondary milestone-complete"
                type="button"
                data-milestone-id="${milestone.id}"
              >
                Afronden
              </button>
            ` : ""}
          </article>
        `).join("") || "<p>Geen milestones.</p>"}
      </section>

      <section class="panel journey-dashboard-card">
        <h2>Open blokkades</h2>
        ${openBlockers.map((blocker) => `
          <article class="journey-item severity-${escapeHtml(
            blocker.severity
          )}">
            <strong>${escapeHtml(blocker.title)}</strong>
            <span class="status">${escapeHtml(blocker.severity)}</span>
            <p>
              Zekerheid: ${Math.round(blocker.confidence * 100)}%
            </p>
            <button
              class="secondary blocker-resolve"
              type="button"
              data-blocker-id="${blocker.id}"
            >
              Markeer opgelost
            </button>
          </article>
        `).join("") || "<p>Geen open blokkades.</p>"}
      </section>

      <section class="panel journey-dashboard-card">
        <h2>Acties</h2>
        ${pendingActions.map((action) => `
          <article class="journey-item">
            <strong>${escapeHtml(action.title)}</strong>
            <span class="status">${escapeHtml(action.status)}</span>
            ${action.description
              ? `<p>${escapeHtml(action.description)}</p>`
              : ""}
            <button
              class="primary action-complete"
              type="button"
              data-action-id="${action.id}"
            >
              Afronden
            </button>
          </article>
        `).join("") || "<p>Geen open acties.</p>"}
      </section>

      <section class="panel journey-dashboard-card">
        <h2>Graphcontext</h2>
        <dl class="journey-context-list">
          <div>
            <dt>Actieve doelen</dt>
            <dd>${graph.activeGoals.length}</dd>
          </div>
          <div>
            <dt>Open blockers</dt>
            <dd>${graph.openBlockers.length}</dd>
          </div>
          <div>
            <dt>Open acties</dt>
            <dd>${graph.pendingActions.length}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>${graph.evidence.length}</dd>
          </div>
        </dl>
      </section>

      <section class="panel journey-dashboard-card">
        <h2>Notificaties</h2>
        ${notifications.map((item) => `
          <article class="journey-item">
            <strong>${escapeHtml(item.body)}</strong>
            <time datetime="${escapeHtml(item.deliverAt)}">
              ${escapeHtml(
                new Date(item.deliverAt).toLocaleString("nl-NL")
              )}
            </time>
          </article>
        `).join("") || "<p>Nog geen meldingen.</p>"}
      </section>
    </div>
  `;

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".action-complete"
  )) {
    button.addEventListener("click", async () => {
      if (!state.user || !button.dataset.actionId) return;
      button.disabled = true;
      await api.updateJourneyAction(
        state.user.id,
        button.dataset.actionId,
        "done"
      );
      await loadJourneyDashboard();
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".milestone-complete"
  )) {
    button.addEventListener("click", async () => {
      if (!state.user || !button.dataset.milestoneId) return;
      button.disabled = true;
      await api.updateJourneyMilestone(
        state.user.id,
        button.dataset.milestoneId,
        "completed"
      );
      await loadJourneyDashboard();
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".blocker-resolve"
  )) {
    button.addEventListener("click", async () => {
      if (!state.user || !button.dataset.blockerId) return;
      button.disabled = true;
      await api.resolveJourneyBlocker(
        state.user.id,
        button.dataset.blockerId
      );
      await loadJourneyDashboard();
    });
  }
}

async function loadJourneyDashboard(): Promise<void> {
  if (!state.user) return;

  try {
    const [dashboard, graph, notifications] = await Promise.all([
      api.getJourney(state.user.id),
      api.getGraphContext(state.user.id),
      api.getNotifications(state.user.id)
    ]);
    renderJourneyDashboard(
      dashboard,
      graph,
      notifications.items
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      await api.createJourney(state.user.id);
      await loadJourneyDashboard();
      return;
    }

    const container =
      document.querySelector<HTMLDivElement>(
        "#journey-dashboard-content"
      );
    if (container) {
      container.innerHTML =
        '<p class="notice">Je traject kon niet worden geladen.</p>';
    }
  }
}

async function bindJourneyDashboard(): Promise<void> {
  if (!state.user) return;
  await loadJourneyDashboard();

  document
    .querySelector<HTMLButtonElement>(
      "#refresh-journey-dashboard"
    )
    ?.addEventListener(
      "click",
      () => void loadJourneyDashboard()
    );
}

function profileView(): string {
  if (!state.user) {
    return accountView("Log in om je profiel te bekijken.");
  }

  const profile = state.profile;

  return `
    <section class="narrow">
      <span class="eyebrow">Mijn profiel</span>
      <h1>Jouw onderwijsprofiel</h1>
      <p>
        Deze gegevens worden gebruikt door de persoonlijke coach.
      </p>
      <form id="profile-form" data-testid="profile-form" class="panel form-grid">
        <label>
          Voornaam
          <input
            name="firstName"
            value="${escapeHtml(profile?.firstName ?? "")}"
          />
        </label>
        <label>
          Achternaam
          <input
            name="lastName"
            value="${escapeHtml(profile?.lastName ?? "")}"
          />
        </label>
        <label>
          Telefoon
          <input
            name="phone"
            value="${escapeHtml(profile?.phone ?? "")}"
          />
        </label>
        <label>
          Voorkeurssector
          <select name="preferredSector">
            ${["", "PO", "VO", "MBO", "SO"].map((sector) => `
              <option
                value="${sector}"
                ${profile?.preferredSector === sector ? "selected" : ""}
              >
                ${sector || "Nog niet gekozen"}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="full">
          Over mij
          <textarea name="bio" rows="5">${escapeHtml(profile?.bio ?? "")}</textarea>
        </label>
        <button class="primary" type="submit">
          Profiel opslaan
        </button>
      </form>
    </section>
  `;
}

async function bindProfile(): Promise<void> {
  if (!state.user) return;

  if (!state.profile) {
    try {
      state.profile = await api.getProfile(state.user.id);
      renderShell(profileView());
      await bindProfile();
      return;
    } catch {
      // The form still renders so the user gets a recoverable screen.
    }
  }

  const form = document.querySelector<HTMLFormElement>("#profile-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) return;

    const data = new FormData(form);
    try {
      state.profile = await api.updateProfile(state.user.id, {
        firstName: String(data.get("firstName") ?? "") || null,
        lastName: String(data.get("lastName") ?? "") || null,
        phone: String(data.get("phone") ?? "") || null,
        preferredSector:
          String(data.get("preferredSector") ?? "") || null,
        bio: String(data.get("bio") ?? "") || null
      });
      await render("Profiel opgeslagen.");
    } catch (error) {
      await render(
        error instanceof ApiError
          ? `Opslaan mislukt: ${error.code}.`
          : "Opslaan mislukt."
      );
    }
  });
}

function knowledgeView(): string {
  return `
    <section class="narrow">
      <span class="eyebrow">Gecontroleerde kennis</span>
      <h1>Doorzoek de kennisbank</h1>
      <form id="knowledge-form" class="search-form">
        <input
          name="query"
          minlength="2"
          placeholder="Bijvoorbeeld: wat kost zij-instroom?"
          required
        />
        <button class="primary" type="submit">Zoeken</button>
      </form>
      <div id="knowledge-results" class="results"></div>
    </section>
  `;
}

async function bindKnowledge(): Promise<void> {
  const form =
    document.querySelector<HTMLFormElement>("#knowledge-form");
  const results =
    document.querySelector<HTMLDivElement>("#knowledge-results");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!results) return;

    const query = String(
      new FormData(form).get("query") ?? ""
    );
    results.innerHTML = "<p>Zoeken…</p>";

    try {
      const records = await api.searchKnowledge(query);
      renderKnowledgeResults(results, records);
    } catch {
      results.innerHTML =
        '<p class="notice">Zoeken is nu niet beschikbaar.</p>';
    }
  });
}

function renderKnowledgeResults(
  container: HTMLElement,
  results: readonly KnowledgeResult[]
): void {
  if (results.length === 0) {
    container.innerHTML = "<p>Geen passend antwoord gevonden.</p>";
    return;
  }

  container.innerHTML = results.map((result) => `
    <article class="panel result-card">
      <span class="eyebrow">
        ${escapeHtml(result.record.category ?? "Kennis")}
      </span>
      <h2>${escapeHtml(result.record.title)}</h2>
      <p>${escapeHtml(result.record.body)}</p>
      ${result.record.sourceUrl
        ? `<a href="${escapeHtml(result.record.sourceUrl)}" target="_blank" rel="noreferrer">Bekijk bron</a>`
        : ""}
    </article>
  `).join("");
}


function canUseBackoffice(): boolean {
  return Boolean(
    state.user?.roles.some((role) =>
      ["advisor", "administrator", "superuser"].includes(role)
    )
  );
}

function canManagePrompts(): boolean {
  return Boolean(
    state.user?.roles.some((role) =>
      ["administrator", "superuser"].includes(role)
    )
  );
}

function backofficeView(): string {
  if (!state.user) {
    return accountView("Log in om de backoffice te openen.");
  }

  if (!canUseBackoffice()) {
    return `
      <section class="narrow">
        <span class="eyebrow">Backoffice</span>
        <h1>Geen toegang</h1>
        <p>Je account heeft geen adviseurs- of beheerdersrol.</p>
      </section>
    `;
  }

  return `
    <section class="backoffice">
      <div class="backoffice-heading">
        <div>
          <span class="eyebrow">Adviseursbackoffice</span>
          <h1>Kandidaten en coachconfiguratie</h1>
          <p>
            Bekijk trajectstatus en beheer goedgekeurde promptversies.
          </p>
        </div>
        <button
          id="refresh-backoffice"
          class="secondary"
          type="button"
        >
          Vernieuwen
        </button>
      </div>

      <div class="dashboard-grid">
        <section class="panel dashboard-card">
          <span class="eyebrow">Kandidaten</span>
          <strong id="candidate-count">–</strong>
          <p>Actieve profielen in de trajectbegeleiding.</p>
        </section>
        <section class="panel dashboard-card">
          <span class="eyebrow">Open alerts</span>
          <strong id="alert-count">–</strong>
          <p>Kandidaten die menselijke aandacht nodig hebben.</p>
        </section>
        <section class="panel dashboard-card">
          <span class="eyebrow">Zonder route</span>
          <strong id="without-route-count">–</strong>
          <p>Profielen zonder vastgestelde onderwijsroute.</p>
        </section>
        <section class="panel dashboard-card">
          <span class="eyebrow">Promptconfiguraties</span>
          <strong id="prompt-count">–</strong>
          <p>Versiebeheerde instructies voor beide coaches.</p>
        </section>
      </div>

      <section class="panel backoffice-panel">
        <div class="section-heading">
          <div>
            <h2>Alerts</h2>
            <p>Gesorteerd op urgentie.</p>
          </div>
        </div>
        <div id="backoffice-alerts" data-testid="backoffice-alerts">
          <p>Alerts laden…</p>
        </div>
      </section>

      <section class="panel backoffice-panel">
        <div class="section-heading">
          <div>
            <h2>Kandidatenoverzicht</h2>
            <p>Fase, route en laatste detectorconfidence.</p>
          </div>
        </div>
        <div id="candidate-table" data-testid="candidate-table">
          <p>Gegevens laden…</p>
        </div>
      </section>

      <section
        id="candidate-detail"
        class="panel backoffice-panel"
        data-testid="candidate-detail"
      >
        <p>Selecteer een kandidaat voor details.</p>
      </section>

      ${
        canManagePrompts()
          ? `



            <section class="panel backoffice-panel">
              <div class="section-heading">
                <div>
                  <h2>Veilige execution</h2>
                  <p>
                    Bevestigingsverzoeken en queued reminders/notificaties.
                  </p>
                </div>
              </div>
              <div
                id="execution-overview"
                data-testid="execution-overview"
                class="dead-letter-list"
              >
                <p>Executionstatus laden…</p>
              </div>
            </section>

            <section class="panel backoffice-panel">
              <div class="section-heading">
                <div>
                  <h2>Orchestration & explainability</h2>
                  <p>
                    Plannen, parallelle toolgroepen en shadow-plannervergelijking.
                  </p>
                </div>
              </div>
              <div
                id="orchestration-runs"
                data-testid="orchestration-runs"
                class="dead-letter-list"
              >
                <p>Orchestrationruns laden…</p>
              </div>
            </section>

            <section class="panel backoffice-panel">
              <div class="section-heading">
                <div>
                  <h2>Connectorstatus</h2>
                  <p>
                    Synchronisaties, planning en brongezondheid.
                  </p>
                </div>
                <span class="status">
                  <span id="connector-schedule-count">0</span>
                  actief gepland
                </span>
              </div>
              <div
                id="connector-health"
                data-testid="connector-health"
                class="provider-grid"
              >
                <p>Connectorstatus laden…</p>
              </div>
            </section>

            <section class="panel backoffice-panel">
              <div class="section-heading">
                <div>
                  <h2>Providerstatus</h2>
                  <p>
                    Configuratie, circuit states en definitief mislukte
                    providerverzoeken.
                  </p>
                </div>
              </div>
              <div
                id="provider-status"
                data-testid="provider-status"
                class="provider-grid"
              >
                <p>Providerstatus laden…</p>
              </div>
              <div
                id="provider-dead-letters"
                data-testid="provider-dead-letters"
                class="dead-letter-list"
              >
                <p>Dead letters laden…</p>
              </div>
            </section>
          `
          : ""
      }

      ${canManagePrompts()
        ? `
          <section class="panel backoffice-panel">
            <div class="section-heading">
              <div>
                <h2>Promptbeheer</h2>
                <p>Nieuwe versies blijven concept tot activatie.</p>
              </div>
            </div>

            <form id="prompt-form" class="form-grid compact">
              <label>
                Coach
                <select name="chatbotKey">
                  <option value="general-coach">Algemene coach</option>
                  <option value="personal-journey-coach">
                    Persoonlijke coach
                  </option>
                </select>
              </label>
              <label>
                Configuratiesleutel
                <input name="configKey" value="default" required />
              </label>
              <label class="full">
                Titel
                <input name="title" required />
              </label>
              <label class="full">
                Systeemprompt
                <textarea
                  name="systemPrompt"
                  rows="7"
                  minlength="20"
                  required
                ></textarea>
              </label>
              <label class="full">
                Notitie
                <input name="notes" />
              </label>
              <button class="primary" type="submit">
                Configuratie toevoegen
              </button>
            </form>

            <div id="prompt-list" data-testid="prompt-list">
              <p>Promptconfiguraties laden…</p>
            </div>
          </section>
        `
        : ""}
    </section>
  `;
}

function renderCandidates(
  candidates: readonly CandidateSummary[]
): void {
  const container =
    document.querySelector<HTMLDivElement>("#candidate-table");
  const counter =
    document.querySelector<HTMLElement>("#candidate-count");

  if (counter) counter.textContent = String(candidates.length);
  if (!container) return;

  if (candidates.length === 0) {
    container.innerHTML = "<p>Nog geen kandidaten gevonden.</p>";
    return;
  }

  container.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Kandidaat</th>
            <th>Fase</th>
            <th>Route</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${candidates.map((candidate) => `
            <tr>
              <td>
                <button
                  class="candidate-link"
                  type="button"
                  data-candidate-id="${candidate.userId}"
                >
                  <strong>${escapeHtml(candidate.displayName)}</strong>
                  <small>${escapeHtml(candidate.email ?? "")}</small>
                </button>
              </td>
              <td>${escapeHtml(candidate.currentPhaseCode ?? "Onbekend")}</td>
              <td>${escapeHtml(candidate.routeTitle ?? "Nog niet bepaald")}</td>
              <td>
                ${candidate.lastDetectorConfidence === undefined
                  ? "–"
                  : `${Math.round(candidate.lastDetectorConfidence * 100)}%`}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".candidate-link"
  )) {
    button.addEventListener("click", () => {
      const candidateId = button.dataset.candidateId;
      if (candidateId) {
        void loadCandidateDetail(candidateId);
      }
    });
  }
}

function renderStatistics(
  statistics: BackofficeStatistics
): void {
  const candidateCount =
    document.querySelector<HTMLElement>("#candidate-count");
  const alertCount =
    document.querySelector<HTMLElement>("#alert-count");
  const withoutRouteCount =
    document.querySelector<HTMLElement>("#without-route-count");

  if (candidateCount) {
    candidateCount.textContent = String(statistics.totalCandidates);
  }
  if (alertCount) {
    alertCount.textContent = String(statistics.openAlerts);
  }
  if (withoutRouteCount) {
    withoutRouteCount.textContent = String(
      statistics.candidatesWithoutRoute
    );
  }
}

function renderAlerts(
  alerts: readonly BackofficeAlert[]
): void {
  const container =
    document.querySelector<HTMLDivElement>("#backoffice-alerts");
  if (!container) return;

  if (alerts.length === 0) {
    container.innerHTML = "<p>Geen open alerts.</p>";
    return;
  }

  container.innerHTML = `
    <div class="alert-list">
      ${alerts.map((alert) => `
        <button
          class="alert-card ${escapeHtml(alert.severity)}"
          type="button"
          data-candidate-id="${alert.candidateUserId}"
        >
          <span>${escapeHtml(alert.severity)}</span>
          <strong>${escapeHtml(alert.title)}</strong>
          <p>${escapeHtml(alert.description)}</p>
        </button>
      `).join("")}
    </div>
  `;

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".alert-card"
  )) {
    button.addEventListener("click", () => {
      const candidateId = button.dataset.candidateId;
      if (candidateId) {
        void loadCandidateDetail(candidateId);
      }
    });
  }
}

function renderCandidateDetail(detail: CandidateDetail): void {
  const container =
    document.querySelector<HTMLDivElement>("#candidate-detail");
  if (!container) return;

  container.innerHTML = `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Kandidaatdetail</span>
        <h2>${escapeHtml(detail.candidate.displayName)}</h2>
        <p>${escapeHtml(detail.candidate.email ?? "")}</p>
      </div>
      <span class="status">
        ${escapeHtml(detail.candidate.currentPhaseCode ?? "fase onbekend")}
      </span>
    </div>

    <div class="detail-grid">
      <div>
        <h3>Route</h3>
        <p>${escapeHtml(
          detail.candidate.routeTitle ?? "Nog geen route"
        )}</p>
      </div>
      <div>
        <h3>Alerts</h3>
        <p>${detail.alerts.length}</p>
      </div>
      <div>
        <h3>Notities</h3>
        ${
          detail.notes.length
            ? detail.notes.map((note) =>
                `<p>${escapeHtml(note.content)}</p>`
              ).join("")
            : "<p>Geen notities.</p>"
        }
      </div>
      <div>
        <h3>Afspraken</h3>
        ${
          detail.appointments.length
            ? detail.appointments.map((appointment) =>
                `<p><strong>${escapeHtml(appointment.subject)}</strong><br>${escapeHtml(appointment.startsAt)} · ${escapeHtml(appointment.status)}</p>`
              ).join("")
            : "<p>Geen afspraken.</p>"
        }
      </div>
    </div>
  `;
}

async function loadCandidateDetail(
  candidateId: string
): Promise<void> {
  const container =
    document.querySelector<HTMLDivElement>("#candidate-detail");
  if (container) {
    container.innerHTML = "<p>Kandidaatdetail laden…</p>";
  }

  try {
    renderCandidateDetail(
      await api.getCandidateDetail(candidateId)
    );
  } catch {
    if (container) {
      container.innerHTML =
        '<p class="notice">Kandidaatdetail kon niet worden geladen.</p>';
    }
  }
}





function renderExecutionOverview(
  requests: readonly ExecutionRequestDto[],
  outbox: readonly NotificationOutboxDto[]
): void {
  const container =
    document.querySelector<HTMLDivElement>(
      "#execution-overview"
    );
  if (!container) return;

  const pending = requests.filter(
    (item) => item.status === "pending_confirmation"
  );
  const queued = outbox.filter(
    (item) => item.status === "queued"
  );

  container.innerHTML = `
    <div class="dashboard-grid">
      <article class="dashboard-card">
        <span class="eyebrow">Bevestiging nodig</span>
        <strong>${pending.length}</strong>
      </article>
      <article class="dashboard-card">
        <span class="eyebrow">In wachtrij</span>
        <strong>${queued.length}</strong>
      </article>
    </div>
    ${requests.slice(0, 10).map((item) => `
      <details class="dead-letter-card">
        <summary>
          <strong>${escapeHtml(item.toolKey)}</strong>
          <span>${escapeHtml(item.status)}</span>
          <small>${escapeHtml(
            new Date(item.createdAt).toLocaleString("nl-NL")
          )}</small>
        </summary>
        <pre>${escapeHtml(
          JSON.stringify(item.payload, null, 2)
        )}</pre>
      </details>
    `).join("") || "<p>Nog geen executionverzoeken.</p>"}
  `;
}

function renderOrchestrationRuns(
  runs: readonly OrchestrationRunDto[],
  shadow: readonly PlannerShadowEvaluationDto[]
): void {
  const container =
    document.querySelector<HTMLDivElement>(
      "#orchestration-runs"
    );
  if (!container) return;

  const shadowByRun = new Map(
    shadow.map((item) => [item.runId, item])
  );

  if (runs.length === 0) {
    container.innerHTML = "<p>Nog geen orchestrationruns.</p>";
    return;
  }

  container.innerHTML = runs.map((run) => {
    const evaluation = shadowByRun.get(run.id);
    const required = run.plan.steps
      .filter((step) => step.required)
      .map((step) => step.toolKey);
    const optional = run.plan.steps
      .filter((step) => !step.required)
      .map((step) => step.toolKey);

    return `
      <details class="dead-letter-card orchestration-card">
        <summary>
          <strong>${escapeHtml(run.intent)}</strong>
          <span>${escapeHtml(run.status)}</span>
          <small>
            ${escapeHtml(
              new Date(run.createdAt).toLocaleString("nl-NL")
            )}
          </small>
        </summary>
        <dl>
          <div>
            <dt>Strategie</dt>
            <dd>${escapeHtml(run.plan.answerStrategy)}</dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>${run.latencyMs ?? "–"} ms</dd>
          </div>
          <div>
            <dt>Verplichte tools</dt>
            <dd>${escapeHtml(required.join(", ") || "geen")}</dd>
          </div>
          <div>
            <dt>Optionele tools</dt>
            <dd>${escapeHtml(optional.join(", ") || "geen")}</dd>
          </div>
          <div>
            <dt>Shadow agreement</dt>
            <dd>${
              evaluation?.agreementScore === undefined
                ? "–"
                : `${Math.round(
                    evaluation.agreementScore * 100
                  )}%`
            }</dd>
          </div>
        </dl>
        <ol>
          ${run.plan.steps.map((step) => `
            <li>
              <strong>${escapeHtml(step.toolKey)}</strong>
              <span>${escapeHtml(step.capability)}</span>
              <p>${escapeHtml(step.reason)}</p>
              ${
                step.dependsOn?.length
                  ? `<small>Na: ${escapeHtml(
                      step.dependsOn.join(", ")
                    )}</small>`
                  : "<small>Parallel uitvoerbaar</small>"
              }
            </li>
          `).join("")}
        </ol>
      </details>
    `;
  }).join("");
}

function renderConnectorHealth(
  health: readonly ConnectorHealthDto[],
  activeScheduleCount: number
): void {
  const container =
    document.querySelector<HTMLDivElement>("#connector-health");
  const scheduleCount =
    document.querySelector<HTMLElement>(
      "#connector-schedule-count"
    );

  if (scheduleCount) {
    scheduleCount.textContent = String(activeScheduleCount);
  }
  if (!container) return;

  if (health.length === 0) {
    container.innerHTML = "<p>Geen connectors geconfigureerd.</p>";
    return;
  }

  container.innerHTML = health.map((connector) => {
    const latest = connector.recentRuns[0];
    return `
      <article class="provider-card connector-card">
        <div>
          <span class="eyebrow">
            ${escapeHtml(connector.connectorKey)}
          </span>
          <strong>${escapeHtml(connector.label)}</strong>
        </div>
        <span class="circuit-state ${escapeHtml(
          connector.status === "healthy"
            ? "closed"
            : connector.status === "failing"
              ? "open"
              : "half-open"
        )}">
          ${escapeHtml(connector.status)}
        </span>
        <dl>
          <div>
            <dt>Laatste run</dt>
            <dd>${latest
              ? escapeHtml(
                  new Date(latest.startedAt)
                    .toLocaleString("nl-NL")
                )
              : "–"}</dd>
          </div>
          <div>
            <dt>Records</dt>
            <dd>${latest
              ? `${latest.insertedCount} nieuw, ` +
                `${latest.updatedCount} gewijzigd`
              : "–"}</dd>
          </div>
          <div>
            <dt>Laatste fout</dt>
            <dd>${escapeHtml(connector.lastError ?? "–")}</dd>
          </div>
        </dl>
        <button
          type="button"
          class="secondary synchronize-connector"
          data-connector-key="${escapeHtml(connector.connectorKey)}"
          ${connector.enabled ? "" : "disabled"}
        >
          Nu synchroniseren
        </button>
      </article>
    `;
  }).join("");

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".synchronize-connector"
  )) {
    button.addEventListener("click", async () => {
      const connectorKey = button.dataset.connectorKey;
      if (!connectorKey) return;

      button.disabled = true;
      button.textContent = "Synchroniseren…";
      try {
        await api.synchronizeConnector(connectorKey);
        await loadBackoffice();
      } catch (error) {
        button.disabled = false;
        button.textContent =
          error instanceof ApiError
            ? `Mislukt: ${error.code}`
            : "Opnieuw proberen";
      }
    });
  }
}

function renderProviderStatus(
  providers: readonly ProviderRuntimeStatus[]
): void {
  const container =
    document.querySelector<HTMLDivElement>("#provider-status");
  if (!container) return;

  if (providers.length === 0) {
    container.innerHTML =
      "<p>Geen live providers geconfigureerd.</p>";
    return;
  }

  container.innerHTML = providers.map((provider) => `
    <article class="provider-card">
      <div>
        <span class="eyebrow">${escapeHtml(provider.providerKey)}</span>
        <strong>
          ${provider.configured ? "Geconfigureerd" : "Niet geconfigureerd"}
        </strong>
      </div>
      <span class="circuit-state ${escapeHtml(provider.circuitState)}">
        ${escapeHtml(provider.circuitState)}
      </span>
      <dl>
        <div>
          <dt>Fouten</dt>
          <dd>${provider.failureCount}</dd>
        </div>
        <div>
          <dt>Laatste succes</dt>
          <dd>${
            provider.lastSuccessAt
              ? escapeHtml(
                  new Date(provider.lastSuccessAt)
                    .toLocaleString("nl-NL")
                )
              : "–"
          }</dd>
        </div>
        <div>
          <dt>Laatste fout</dt>
          <dd>${
            provider.lastFailureAt
              ? escapeHtml(
                  new Date(provider.lastFailureAt)
                    .toLocaleString("nl-NL")
                )
              : "–"
          }</dd>
        </div>
      </dl>
    </article>
  `).join("");
}

function renderProviderDeadLetters(
  records: readonly ProviderDeadLetter[]
): void {
  const container =
    document.querySelector<HTMLDivElement>(
      "#provider-dead-letters"
    );
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = "<p>Geen open dead letters.</p>";
    return;
  }

  container.innerHTML = `
    <div class="section-heading">
      <h3>Dead letters</h3>
      <button
        id="purge-resolved-dead-letters"
        class="secondary"
        type="button"
      >
        Afgehandelde records verwijderen
      </button>
    </div>
    ${records.map((record) => `
      <details class="dead-letter-card">
        <summary>
          <strong>${escapeHtml(record.providerKey)}</strong>
          <span>${escapeHtml(record.operation)}</span>
          <small>${escapeHtml(
            new Date(record.createdAt).toLocaleString("nl-NL")
          )}</small>
        </summary>
        <p>${escapeHtml(record.errorMessage)}</p>
        <dl>
          <div>
            <dt>Pogingen</dt>
            <dd>${record.attempts}</dd>
          </div>
          <div>
            <dt>Payload</dt>
            <dd>
              <pre>${escapeHtml(
                JSON.stringify(record.payload, null, 2)
              )}</pre>
            </dd>
          </div>
        </dl>
        <div class="actions">
          <button
            type="button"
            class="primary retry-dead-letter"
            data-dead-letter-id="${record.id}"
          >
            Opnieuw proberen
          </button>
          <button
            type="button"
            class="secondary resolve-dead-letter"
            data-dead-letter-id="${record.id}"
          >
            Markeer afgehandeld
          </button>
        </div>
      </details>
    `).join("")}
  `;

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".retry-dead-letter"
  )) {
    button.addEventListener("click", async () => {
      const id = button.dataset.deadLetterId;
      if (!id) return;

      button.disabled = true;
      button.textContent = "Bezig…";

      try {
        await api.retryProviderDeadLetter(id);
        await loadBackoffice();
      } catch (error) {
        button.disabled = false;
        button.textContent =
          error instanceof ApiError
            ? `Mislukt: ${error.code}`
            : "Opnieuw proberen";
      }
    });
  }

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".resolve-dead-letter"
  )) {
    button.addEventListener("click", async () => {
      const id = button.dataset.deadLetterId;
      if (!id) return;

      await api.resolveProviderDeadLetter(id);
      await loadBackoffice();
    });
  }

  document
    .querySelector<HTMLButtonElement>(
      "#purge-resolved-dead-letters"
    )
    ?.addEventListener("click", async () => {
      await api.purgeResolvedProviderDeadLetters();
      await loadBackoffice();
    });
}

function renderPrompts(prompts: readonly PromptConfig[]): void {
  const container =
    document.querySelector<HTMLDivElement>("#prompt-list");
  const counter =
    document.querySelector<HTMLElement>("#prompt-count");

  if (counter) counter.textContent = String(prompts.length);
  if (!container) return;

  if (prompts.length === 0) {
    container.innerHTML = "<p>Nog geen promptconfiguraties.</p>";
    return;
  }

  container.innerHTML = prompts.map((prompt) => {
    const active = prompt.versions.find(
      (version) => version.version === prompt.activeVersion
    );

    return `
      <article class="prompt-card">
        <div>
          <span class="eyebrow">${escapeHtml(prompt.chatbotKey)}</span>
          <h3>${escapeHtml(prompt.title)}</h3>
          <p>
            Actieve versie ${prompt.activeVersion}
            · ${prompt.versions.length} versie(s)
          </p>
        </div>
        <details>
          <summary>Versies bekijken</summary>
          <div class="version-list">
            ${prompt.versions.map((version) => `
              <article>
                <strong>Versie ${version.version}</strong>
                <span class="status">${escapeHtml(version.status)}</span>
                <p>${escapeHtml(version.systemPrompt)}</p>
                ${version.version !== prompt.activeVersion
                  ? `
                    <button
                      type="button"
                      class="secondary activate-prompt"
                      data-prompt-id="${prompt.id}"
                      data-version="${version.version}"
                    >
                      Activeren
                    </button>
                  `
                  : "<small>Actief</small>"}
              </article>
            `).join("")}
          </div>
        </details>
        ${active
          ? `<p class="active-prompt">${escapeHtml(active.systemPrompt)}</p>`
          : ""}
      </article>
    `;
  }).join("");

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".activate-prompt"
  )) {
    button.addEventListener("click", async () => {
      const promptId = button.dataset.promptId;
      const version = Number(button.dataset.version);
      if (!promptId || !Number.isInteger(version)) return;

      await api.activatePromptVersion(promptId, version);
      await loadBackoffice();
    });
  }
}

async function loadBackoffice(): Promise<void> {
  if (!canUseBackoffice()) return;

  const candidatePromise = api.getCandidates();
  const statisticsPromise = api.getBackofficeStatistics();
  const alertsPromise = api.getBackofficeAlerts();
  const promptsPromise = canManagePrompts()
    ? api.getPrompts()
    : Promise.resolve([] as readonly PromptConfig[]);
  const executionRequestsPromise = canManagePrompts()
    ? api.getExecutionRequests()
    : Promise.resolve([] as readonly ExecutionRequestDto[]);
  const notificationOutboxPromise = canManagePrompts()
    ? api.getNotificationOutbox()
    : Promise.resolve([] as readonly NotificationOutboxDto[]);
  const orchestrationRunsPromise = canManagePrompts()
    ? api.getOrchestrationRuns()
    : Promise.resolve([] as readonly OrchestrationRunDto[]);
  const plannerShadowPromise = canManagePrompts()
    ? api.getPlannerShadowEvaluations()
    : Promise.resolve([] as readonly PlannerShadowEvaluationDto[]);
  const connectorHealthPromise = canManagePrompts()
    ? api.getConnectorHealth()
    : Promise.resolve({
        health: [] as readonly ConnectorHealthDto[],
        activeScheduleCount: 0
      });
  const providerStatusPromise = canManagePrompts()
    ? api.getProviderStatus()
    : Promise.resolve([] as readonly ProviderRuntimeStatus[]);
  const deadLettersPromise = canManagePrompts()
    ? api.getProviderDeadLetters()
    : Promise.resolve([] as readonly ProviderDeadLetter[]);

  try {
    const [
      candidates,
      statistics,
      alerts,
      prompts,
      executionRequests,
      notificationOutbox,
      orchestrationRuns,
      plannerShadow,
      connectorHealth,
      providerStatus,
      deadLetters
    ] = await Promise.all([
      candidatePromise,
      statisticsPromise,
      alertsPromise,
      promptsPromise,
      executionRequestsPromise,
      notificationOutboxPromise,
      orchestrationRunsPromise,
      plannerShadowPromise,
      connectorHealthPromise,
      providerStatusPromise,
      deadLettersPromise
    ]);
    renderCandidates(candidates);
    renderStatistics(statistics);
    renderAlerts(alerts);
    renderPrompts(prompts);
    renderExecutionOverview(
      executionRequests,
      notificationOutbox
    );
    renderOrchestrationRuns(
      orchestrationRuns,
      plannerShadow
    );
    renderConnectorHealth(
      connectorHealth.health,
      connectorHealth.activeScheduleCount
    );
    renderProviderStatus(providerStatus);
    renderProviderDeadLetters(deadLetters);
  } catch (error) {
    const message =
      error instanceof ApiError
        ? `Laden mislukt: ${error.code}.`
        : "Backofficegegevens konden niet worden geladen.";

    const candidateContainer =
      document.querySelector<HTMLDivElement>("#candidate-table");
    if (candidateContainer) {
      candidateContainer.innerHTML =
        `<p class="notice">${escapeHtml(message)}</p>`;
    }
  }
}

async function bindBackoffice(): Promise<void> {
  document
    .querySelector<HTMLButtonElement>("#refresh-backoffice")
    ?.addEventListener("click", () => {
      void loadBackoffice();
    });

  const form = document.querySelector<HTMLFormElement>("#prompt-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);

    try {
      await api.createPrompt({
        chatbotKey: String(data.get("chatbotKey")) as
          | "general-coach"
          | "personal-journey-coach",
        configKey: String(data.get("configKey") ?? ""),
        title: String(data.get("title") ?? ""),
        systemPrompt: String(data.get("systemPrompt") ?? ""),
        notes: String(data.get("notes") ?? "") || undefined
      });
      form.reset();
      await loadBackoffice();
    } catch (error) {
      const container =
        document.querySelector<HTMLDivElement>("#prompt-list");
      if (container) {
        container.innerHTML = `<p class="notice">${
          escapeHtml(
            error instanceof ApiError
              ? `Opslaan mislukt: ${error.code}.`
              : "Opslaan mislukt."
          )
        }</p>`;
      }
    }
  });

  await loadBackoffice();
}


function requireUserView(message: string): string {
  return state.user
    ? ""
    : accountView(message);
}

function routeView(): string {
  if (!state.user) {
    return requireUserView("Log in om je persoonlijke route te bepalen.");
  }

  return `
    <section class="narrow">
      <span class="eyebrow">Routeverkenning</span>
      <h1>Vind jouw route naar het onderwijs</h1>
      <p>
        Beantwoord de routevragen. De route-engine gebruikt alleen
        gevalideerde antwoorden en vaste routestappen.
      </p>
      <div id="route-flow" class="panel journey-panel">
        <p>Route laden…</p>
      </div>
    </section>
  `;
}

function renderRouteSession(session: RouteSession): void {
  const container =
    document.querySelector<HTMLDivElement>("#route-flow");
  if (!container) return;

  const question = session.result.nextQuestion;
  const route = session.result.bestRoute;

  if (session.status === "completed" && route) {
    container.innerHTML = `
      <span class="eyebrow">Jouw route</span>
      <h2>${escapeHtml(route.title)}</h2>
      <ol class="journey-steps">
        ${route.steps.map((step) => `
          <li>
            <strong>${escapeHtml(step.shortTitle)}</strong>
            <p>${escapeHtml(step.longTitle)}</p>
            ${
              step.durationInMonths
                ? `<small>Indicatie: ${step.durationInMonths} maanden</small>`
                : ""
            }
          </li>
        `).join("")}
      </ol>
      <button id="restart-route" class="secondary" type="button">
        Opnieuw beginnen
      </button>
    `;

    document
      .querySelector<HTMLButtonElement>("#restart-route")
      ?.addEventListener("click", () => {
        state.routeSession = null;
        void bindRoute();
      });
    return;
  }

  if (!question) {
    container.innerHTML = `
      <p class="notice">
        Er kon nog geen passende route worden vastgesteld.
      </p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="journey-progress">
      ${session.selectedAnswerIds.length + 1} van maximaal 4 vragen
    </div>
    <h2>${escapeHtml(question.question)}</h2>
    ${
      question.description
        ? `<p>${escapeHtml(question.description)}</p>`
        : ""
    }
    <div class="choice-grid">
      ${question.answers.map((answer) => `
        <button
          type="button"
          class="choice-card route-answer"
          data-answer-id="${answer.id}"
        >
          <strong>${escapeHtml(answer.title)}</strong>
          ${
            answer.description
              ? `<span>${escapeHtml(answer.description)}</span>`
              : ""
          }
        </button>
      `).join("")}
    </div>
  `;

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".route-answer"
  )) {
    button.addEventListener("click", async () => {
      const answerId = button.dataset.answerId;
      if (!answerId || !state.routeSession) return;

      state.routeSession = await api.answerRoute(
        state.routeSession.id,
        answerId
      );
      renderRouteSession(state.routeSession);
    });
  }
}

async function bindRoute(): Promise<void> {
  if (!state.user) return;

  try {
    state.routeSession =
      state.routeSession ?? await api.startRoute(state.user.id);
    renderRouteSession(state.routeSession);
  } catch (error) {
    const container =
      document.querySelector<HTMLDivElement>("#route-flow");
    if (container) {
      container.innerHTML = `<p class="notice">${
        escapeHtml(
          error instanceof ApiError
            ? `Route laden mislukt: ${error.code}.`
            : "Route laden mislukt."
        )
      }</p>`;
    }
  }
}

function talentView(): string {
  if (!state.user) {
    return requireUserView("Log in om de talententest te doen.");
  }

  return `
    <section class="narrow">
      <span class="eyebrow">Interesse- en talententest</span>
      <h1>Welke onderwijsomgeving past bij jou?</h1>
      <p>
        Kies per vraag het antwoord dat het beste bij je past.
      </p>
      <form id="talent-form" class="panel journey-panel">
        <p>Vragen laden…</p>
      </form>
      <div id="talent-result"></div>
    </section>
  `;
}

function renderTalentQuestions(
  questions: readonly TalentQuestion[]
): void {
  const form = document.querySelector<HTMLFormElement>("#talent-form");
  if (!form) return;

  form.innerHTML = questions.map((question, index) => `
    <fieldset>
      <legend>
        <span>${index + 1}</span>
        ${escapeHtml(question.question)}
      </legend>
      <div class="choice-grid">
        ${question.options.map((option) => `
          <label class="choice-card">
            <input
              type="radio"
              name="${escapeHtml(question.id)}"
              value="${escapeHtml(option.value)}"
              required
            />
            <strong>${escapeHtml(option.label)}</strong>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `).join("") + `
    <button class="primary" type="submit">
      Toon mijn resultaat
    </button>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) return;

    const data = new FormData(form);
    const answers = Object.fromEntries(
      questions.map((question) => [
        question.id,
        String(data.get(question.id) ?? "")
      ])
    );

    try {
      const result = await api.submitTalentTest(
        state.user.id,
        answers
      );
      const container =
        document.querySelector<HTMLDivElement>("#talent-result");
      if (!container) return;

      container.innerHTML = `
        <section class="panel result-card">
          <span class="eyebrow">Beste match</span>
          <h2>${escapeHtml(
            result.rankedSectors[0]?.label ?? result.primarySector
          )}</h2>
          <p>${escapeHtml(
            result.rankedSectors[0]?.description ?? ""
          )}</p>
          <ol class="ranking-list">
            ${result.rankedSectors.slice(0, 4).map((sector) => `
              <li>
                <strong>${escapeHtml(sector.label)}</strong>
                <span>${sector.score} punten</span>
              </li>
            `).join("")}
          </ol>
        </section>
      `;
    } catch (error) {
      await render(
        error instanceof ApiError
          ? `Test opslaan mislukt: ${error.code}.`
          : "Test opslaan mislukt."
      );
    }
  });
}

async function bindTalent(): Promise<void> {
  if (!state.user) return;

  try {
    state.talentQuestions =
      state.talentQuestions.length > 0
        ? state.talentQuestions
        : await api.getTalentQuestions();
    renderTalentQuestions(state.talentQuestions);
  } catch {
    const form = document.querySelector<HTMLFormElement>("#talent-form");
    if (form) {
      form.innerHTML =
        '<p class="notice">De talententest kon niet worden geladen.</p>';
    }
  }
}

function eventsView(): string {
  return `
    <section class="wide-page">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Ontmoeten en oriënteren</span>
          <h1>Evenementen</h1>
          <p>Open dagen, voorlichtingen en regionale bijeenkomsten.</p>
        </div>
        <button id="refresh-events" class="secondary" type="button">
          Vernieuwen
        </button>
      </div>
      <div id="event-list" class="card-grid">
        <p>Evenementen laden…</p>
      </div>
    </section>
  `;
}

function renderEvents(events: readonly EducationEvent[]): void {
  const container =
    document.querySelector<HTMLDivElement>("#event-list");
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = "<p>Nog geen evenementen beschikbaar.</p>";
    return;
  }

  container.innerHTML = events.map((event) => `
    <article class="panel content-card">
      <span class="eyebrow">${escapeHtml(event.sourceName)}</span>
      <h2>${escapeHtml(event.title)}</h2>
      ${
        event.startsAt
          ? `<time>${escapeHtml(
              new Date(event.startsAt).toLocaleString("nl-NL")
            )}</time>`
          : ""
      }
      <p>${escapeHtml(event.description ?? "")}</p>
      <div class="actions">
        ${
          event.eventUrl
            ? `<a class="secondary-link" href="${escapeHtml(event.eventUrl)}" target="_blank" rel="noreferrer">Bekijken</a>`
            : ""
        }
        ${
          state.user
            ? `<button class="primary save-event" data-event-id="${event.id}" type="button">Opslaan</button>`
            : ""
        }
      </div>
    </article>
  `).join("");

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".save-event"
  )) {
    button.addEventListener("click", async () => {
      if (!state.user || !button.dataset.eventId) return;
      await api.saveEvent(button.dataset.eventId, state.user.id);
      button.textContent = "Opgeslagen";
      button.disabled = true;
    });
  }
}

async function bindEvents(): Promise<void> {
  const load = async (refresh: boolean): Promise<void> => {
    const events = refresh
      ? await api.refreshEvents()
      : await api.getEvents();
    renderEvents(events);
  };

  try {
    await load(false);
  } catch {
    await load(true).catch(() => {
      const container =
        document.querySelector<HTMLDivElement>("#event-list");
      if (container) {
        container.innerHTML =
          '<p class="notice">Evenementen zijn tijdelijk niet beschikbaar.</p>';
      }
    });
  }

  document
    .querySelector<HTMLButtonElement>("#refresh-events")
    ?.addEventListener("click", () => {
      void load(true);
    });
}

function vacanciesView(): string {
  return `
    <section class="wide-page">
      <span class="eyebrow">Werken in het onderwijs</span>
      <h1>Vacatures</h1>
      <form id="vacancy-search" class="search-form">
        <input
          name="query"
          placeholder="Functie, school, sector of plaats"
        />
        <button class="primary" type="submit">Zoeken</button>
      </form>
      <div id="vacancy-list" class="card-grid">
        <p>Vacatures laden…</p>
      </div>
    </section>
  `;
}

function renderVacancies(vacancies: readonly Vacancy[]): void {
  const container =
    document.querySelector<HTMLDivElement>("#vacancy-list");
  if (!container) return;

  if (vacancies.length === 0) {
    container.innerHTML = "<p>Geen vacatures gevonden.</p>";
    return;
  }

  container.innerHTML = vacancies.map((vacancy) => `
    <article class="panel content-card">
      <span class="eyebrow">${escapeHtml(
        vacancy.sector ?? "Onderwijs"
      )}</span>
      <h2>${escapeHtml(vacancy.title)}</h2>
      <p>
        ${escapeHtml(vacancy.organization ?? "")}
        ${vacancy.location ? ` · ${escapeHtml(vacancy.location)}` : ""}
      </p>
      <p>${escapeHtml(vacancy.description ?? "")}</p>
      <div class="actions">
        ${
          vacancy.url
            ? `<a class="secondary-link" href="${escapeHtml(vacancy.url)}" target="_blank" rel="noreferrer">Vacature bekijken</a>`
            : ""
        }
        ${
          state.user
            ? `<button class="primary save-vacancy" data-vacancy-id="${vacancy.id}" type="button">Opslaan</button>`
            : ""
        }
      </div>
    </article>
  `).join("");

  for (const button of container.querySelectorAll<HTMLButtonElement>(
    ".save-vacancy"
  )) {
    button.addEventListener("click", async () => {
      if (!state.user || !button.dataset.vacancyId) return;
      await api.saveVacancy(
        button.dataset.vacancyId,
        state.user.id
      );
      button.textContent = "Opgeslagen";
      button.disabled = true;
    });
  }
}

async function bindVacancies(): Promise<void> {
  const form =
    document.querySelector<HTMLFormElement>("#vacancy-search");

  const search = async (query = ""): Promise<void> => {
    try {
      renderVacancies(await api.searchVacancies(query));
    } catch {
      const container =
        document.querySelector<HTMLDivElement>("#vacancy-list");
      if (container) {
        container.innerHTML =
          '<p class="notice">Vacatures zijn tijdelijk niet beschikbaar.</p>';
      }
    }
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = String(new FormData(form).get("query") ?? "");
    void search(query);
  });

  await search();
}

function advisorChatView(): string {
  if (!state.user) {
    return requireUserView("Log in om met een adviseur te chatten.");
  }

  const isAdvisor = state.user.roles.some((role) =>
    ["advisor", "administrator", "superuser"].includes(role)
  );

  return `
    <section class="narrow">
      <span class="eyebrow">Menselijke begeleiding</span>
      <h1>Chat met een adviseur</h1>
      <p>
        Berichten van mensen worden zichtbaar onderscheiden van AI-antwoorden.
      </p>
      ${
        isAdvisor
          ? `
            <label class="panel candidate-selector">
              Kandidaat-ID
              <input
                id="advisor-candidate-id"
                value=""
                placeholder="UUID van kandidaat"
              />
            </label>
          `
          : ""
      }
      <section class="panel chat-panel">
        <div id="advisor-conversation" class="conversation">
          <p>Berichten laden…</p>
        </div>
        <form id="advisor-chat-form" class="composer">
          <textarea
            name="message"
            rows="3"
            placeholder="Typ een bericht…"
            required
          ></textarea>
          <button class="primary" type="submit">Versturen</button>
        </form>
      </section>
    </section>
  `;
}

function renderAdvisorMessages(
  messages: readonly AdvisorMessage[]
): void {
  const container =
    document.querySelector<HTMLDivElement>("#advisor-conversation");
  if (!container) return;

  container.innerHTML = messages.length
    ? messages.map((message) => `
        <article class="message ${
          message.role === "advisor" ? "advisor" : "user"
        }">
          <strong>${
            message.role === "advisor" ? "Adviseur" : "Kandidaat"
          }</strong>
          <p>${escapeHtml(message.content)}</p>
          <small>${escapeHtml(
            new Date(message.createdAt).toLocaleString("nl-NL")
          )}</small>
        </article>
      `).join("")
    : "<p>Nog geen berichten.</p>";
  container.scrollTop = container.scrollHeight;
}

async function bindAdvisorChat(): Promise<void> {
  if (!state.user) return;

  const knownMessages = new Map<string, AdvisorMessage>();
  const renderKnownMessages = (): void => {
    renderAdvisorMessages(
      [...knownMessages.values()].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      )
    );
  };
  const load = async (): Promise<void> => {
    try {
      const messages = await api.getAdvisorMessages(
        state.advisorConversationId
      );
      for (const message of messages) {
        knownMessages.set(message.id, message);
      }
      renderKnownMessages();
    } catch {
      renderKnownMessages();
    }
  };

  await load();

  advisorStreamController?.abort();
  advisorStreamController = api.subscribeAdvisorMessages(
    state.advisorConversationId,
    (message) => {
      knownMessages.set(message.id, message);
      renderKnownMessages();
    }
  );

  const form =
    document.querySelector<HTMLFormElement>("#advisor-chat-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) return;

    const data = new FormData(form);
    const message = String(data.get("message") ?? "").trim();
    if (!message) return;

    const isAdvisor = state.user.roles.some((role) =>
      ["advisor", "administrator", "superuser"].includes(role)
    );

    if (isAdvisor) {
      const candidateId =
        document.querySelector<HTMLInputElement>(
          "#advisor-candidate-id"
        )?.value.trim();
      if (!candidateId) {
        return;
      }

      await api.sendAdvisorMessage({
        conversationId: state.advisorConversationId,
        advisorUserId: state.user.id,
        candidateUserId: candidateId,
        message
      });
    } else {
      await api.sendCandidateMessage({
        conversationId: state.advisorConversationId,
        candidateUserId: state.user.id,
        message
      });
    }

    form.reset();
    await load();
  });
}

async function restoreSession(): Promise<void> {
  if (!state.token) return;

  try {
    state.user = await api.me();
  } catch {
    clearSession();
  }
}

async function render(notice?: string): Promise<void> {
  if (state.view !== "advisor-chat") {
    advisorStreamController?.abort();
    advisorStreamController = undefined;
  }

  switch (state.view) {
    case "public-chat":
      renderShell(
        messagePanel(
          "Ontdek jouw route naar het onderwijs",
          "Stel een vraag over opleidingen, bevoegdheden, routes, kosten of werken in de regio Rotterdam.",
          false
        )
      );
      await bindChat(false);
      break;
    case "personal-chat":
      renderShell(
        messagePanel(
          "Jouw persoonlijke onderwijscoach",
          "Werk stap voor stap aan je profiel, route en volgende fase.",
          true
        )
      );
      await bindChat(true);
      break;
    case "journey-dashboard":
      renderShell(journeyDashboardView());
      await bindJourneyDashboard();
      break;
    case "profile":
      renderShell(profileView());
      await bindProfile();
      break;
    case "knowledge":
      renderShell(knowledgeView());
      await bindKnowledge();
      break;
    case "route":
      renderShell(routeView());
      await bindRoute();
      break;
    case "talent":
      renderShell(talentView());
      await bindTalent();
      break;
    case "events":
      renderShell(eventsView());
      await bindEvents();
      break;
    case "vacancies":
      renderShell(vacanciesView());
      await bindVacancies();
      break;
    case "advisor-chat":
      renderShell(advisorChatView());
      await bindAdvisorChat();
      break;
    case "backoffice":
      renderShell(backofficeView());
      await bindBackoffice();
      break;
    case "account":
      renderShell(accountView(notice));
      await bindAccount();
      break;
  }
}

await restoreSession();
await render();
