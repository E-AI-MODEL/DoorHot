# Door010 Foundation 5.0.1

Portable, provider-neutraal AI-platform voor onderwijsloopbaanbegeleiding,
persoonlijke journeys, kennisretrieval en samenwerking met menselijke adviseurs.

Repository: [E-AI-MODEL/door010](https://github.com/E-AI-MODEL/door010)

## Status

Versie 5.0.1 bundelt de volledige cumulatieve foundation. De huidige readinessstatus
is `CONDITIONAL_GO` totdat staging- en go-live-evidence extern is uitgevoerd.

## Demo in een klik (GitHub Codespaces)

1. Klik op **Code → Codespaces → Create codespace on main**.
2. Wacht tot de omgeving is gebouwd (eenmalig enkele minuten) — de demo start
   daarna automatisch via `npm run demo`.
3. Open de doorgestuurde poort **5173** (Door010 webapp).

De demo draait volledig in-memory in de codespace: de API seedt bij het opstarten
alle referentiedata (FAQ's, regionale loketten, routestap-uitleg) en de webapp
praat via de Vite-proxy met de echte API. Registreren, chatten met de coach, de
route- en talentflows en het journey-dashboard werken allemaal. Zet de poort op
*Public* om de demo tijdelijk met anderen te delen; met het stoppen van de
codespace verdwijnt alles.

Lokaal werkt hetzelfde met `npm ci && npx tsc -b && npm run demo`.

## Snel starten

Vereisten: Node.js 22+, npm, Docker en Docker Compose.

```bash
cp .env.example .env
npm install
docker compose up -d
npm run dev
```

Webapp en API gebruiken de configuratie uit `.env`. Gebruik uitsluitend lokale
testsecrets en commit het bestand nooit.

## Belangrijkste controles

```bash
npm run typecheck
npm test
npm run build
npm run verify:migrations
npm audit --audit-level=moderate
npm run test:e2e
```

## Architectuur in één oogopslag

```text
Public General Coach ─┐
Personal Journey Coach ├─ API → Orchestrator → Retrieval/Engines/Tools
Human Advisor Chat ───┘                         │
                                                ▼
                                            PostgreSQL
```

- Journey Engine beheert journey-state.
- Graph Memory is een projectie.
- Providers zijn verwisselbaar via adapters.
- Gevoelige schrijfacties vereisen bevestiging en audit.
- PostgreSQL is de primaire opslag.
- De 4/5/9-processen en hun werknamen blijven interne metadata; de chat vertaalt
  ze naar relevante informatie, een concrete vervolgstap of een natuurlijke
  vervolgvraag.
- Persoonlijke coachvragen gebruiken geen externe webfallback. Interne
  retrieval en gecontroleerde bronnen blijven wel beschikbaar.

Lees vóór bijdragen: [`AGENTS.md`](AGENTS.md), [`CONTRIBUTING.md`](CONTRIBUTING.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md).

---

<details>
<summary><strong>Repositorystructuur</strong></summary>

```text
.github/       GitHub Actions en deploymentgates
apps/api/      HTTP API, security en bootstrapping
apps/web/      webapp en Playwrighttests
packages/      domein, contracten, persistence en orchestration
datasets/      fase-, route- en kennisdatasets
migrations/    append-only PostgreSQL-migraties
scripts/       verificatie, acceptance, load en recovery
docs/          ontwerp-, validatie- en runbookdocumentatie
```

</details>

<details>
<summary><strong>API-endpoints (foundation)</strong></summary>

- `GET  http://localhost:4000/health`
- `GET  http://localhost:4000/v1/system/capabilities`
- `POST http://localhost:4000/v1/chat/general`
- `POST http://localhost:4000/v1/chat/personal`

Zonder LLM-configuratie werken de chat-endpoints met deterministische engines,
hybride retrieval en extractieve antwoorden uit gecontroleerde kennis. Een
OpenAI-compatible LLM kan via een adapter worden toegevoegd voor generatie,
intentrouting en reranking; de vaste domeinlogica en broncontrole blijven leidend.

</details>

<details>
<summary><strong>Scope van deze foundation</strong></summary>

- Twee expliciete chatbotcontracten: `GeneralCoach` en `PersonalJourneyCoach`.
- Menselijk adviseurskanaal als apart gesprekstype.
- Provider-neutrale domeincontracten.
- API-providerframework voor onderwijsdata.
- PostgreSQL-basisschema.
- Docker Compose met PostgreSQL, Redis en MinIO.
- Bestaande kernsets uit `presentatie-door010`.
- Baseline- en paritydocumentatie.

</details>

<details>
<summary><strong>Datamodelstatus</strong></summary>

Fase A is toegevoegd in `migrations/0002_domain_schema.sql`.

Het schema bevat nu de structurele basis voor:

- slots en slothistorie;
- fase-evaluaties en bevestigde overgangen;
- route-evaluaties en aanbevelingen;
- kennis en ingest;
- onderwijsproviders en opleidingen;
- events, vacatures en afspraken;
- promptversies, feature flags en providers;
- artifacts, bronnen, validatie en pipeline-events.

Zie `docs/DATA_MODEL.md`.

</details>

<details>
<summary><strong>Roadmap na 5.0</strong></summary>

1. Groene Playwright-, load- en restore-evidence vanuit staging.
2. Live provideracceptatie en privacy/DPIA-sign-off.
3. Realtime graph- en browsernotificaties.
4. Incrementele graphupdates en GraphRAG-contextretrieval.
5. Execution providerplugins en memory compression.
6. Multi-tenant deployment- en governanceondersteuning.

</details>

<details>
<summary><strong>Open-source governance</strong></summary>

Dit project gebruikt de Apache License 2.0.

- [`LICENSE`](LICENSE)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`SECURITY.md`](SECURITY.md)
- [`SUPPORT.md`](SUPPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

Issues en pull requests gebruiken vaste GitHub-templates in `.github/`.

</details>

<details>
<summary><strong>Versiegeschiedenis (v4.0 – v4.5)</strong></summary>

### v4.5 CI-, load- en recoverygates

Officiële Playwright-CI, een configureerbare staging-loadgate en een PostgreSQL
backup/restore-drill zijn toegevoegd. Zie `docs/CI_LOAD_RESTORE_4_5.md`.

### v4.4 Browseracceptatie en production readiness

Dedicated journey-dashboard-E2E is toegevoegd. Het production-readinessbesluit
is `CONDITIONAL_GO`, met expliciete go-liveblokkades voor browser, load,
recovery, providers en privacy. Zie `docs/PRODUCTION_READINESS_4_4.md`.

### v4.3 Journey-dashboard en alignmentcheckpoint

Gebruikers hebben nu een persoonlijk trajectdashboard. De architectuur en
oorspronkelijke parityflows zijn opnieuw gecontroleerd.
Zie `docs/JOURNEY_DASHBOARD_ALIGNMENT_4_3.md`.

### v4.2 Event-driven graphcontext en delivery workers

Journey-mutaties synchroniseren de graph memory automatisch. De persoonlijke
coach ontvangt graphcontext en de notification outbox heeft workers voor in-app
en optionele HTTP-providerdelivery. Zie `docs/EVENT_DRIVEN_GRAPH_NOTIFICATION_DELIVERY_4_2.md`.

### v4.1 Graph memory en veilige execution

Journey-state kan nu als domeingraph worden bevraagd. Reminders en notificaties
gebruiken expliciete bevestiging en een transactionele outbox.
Zie `docs/GRAPH_MEMORY_SAFE_EXECUTION_4_1.md`.

### v4.0 Parallel orchestration en shadow planning

Onafhankelijke tools draaien parallel. Een provider-onafhankelijke planner
draait in shadow mode en de backoffice toont verklaarbare plannen en traces.
Zie `docs/PARALLEL_ORCHESTRATION_SHADOW_PLANNING_4_0.md`.

<details>
<summary><strong>Eerder (v3.0 – v3.9)</strong></summary>

### v3.9 AI Orchestrator

Intent, journey, knowledge, planning, tools en observability zijn samengebracht
in `@door010/orchestration`. Zie `docs/AI_ORCHESTRATOR_3_9.md`.

### v3.8 Journey Engine 2.0

Persistente doelen, milestones, blockers, acties, evidence, beslissingen,
voortgang en next-best-action zijn toegevoegd.
Zie `docs/JOURNEY_ENGINE_2_3_8.md`.

### v3.7 Distributed scheduling en snapshots

Connectorruns gebruiken nu databaseleases met heartbeat en herstel van verlopen
leases. Volledige snapshots archiveren records die uit een bron verdwijnen.
Zie `docs/DISTRIBUTED_SCHEDULING_SNAPSHOTS_3_7.md`.

### v3.6 Connector runtime en domeinconnectors

Retries, environment secrets, scheduling, healthmonitoring en de eerste
opleidingen-, subsidie-, event- en vacatureconnectors zijn toegevoegd.
Zie `docs/CONNECTOR_RUNTIME_DOMAIN_CONNECTORS_3_6.md`.

### v3.5 Capability architecture en connectors

De capability-architectuur en een generiek JSON-, CSV- en HTTP-connectorframework
zijn toegevoegd. Zie `docs/CAPABILITY_ARCHITECTURE_CONNECTORS_3_5.md`.

### v3.4 Shadow reranking en active learning

Een provider-onafhankelijke cross-encoderadapter draait nu in shadow mode.
Lage-confidencevragen worden privacyvriendelijk naar een menselijke labelqueue
gestuurd. Zie `docs/SHADOW_RERANKING_ACTIVE_LEARNING_3_4.md`.

### v3.3 Uitgebreide retrievalbenchmark

De benchmark bevat nu 333 gegroepeerde queries, inclusief hard negatives en
multi-intentvragen. De reranker gebruikt validation-based early stopping,
Brier-calibratie en een CI-driftgate.
Zie `docs/EXPANDED_RETRIEVAL_BENCHMARK_3_3.md`.

### v3.2 Learned reranking

Een holdout-gevalideerde lineaire learned reranker is toegevoegd bovenop de
hybride RRF-laag. Zie `docs/LEARNED_RERANKING_3_2.md`.

### v3.1 Embeddingvalidatie en miss-analyse

Een externe embeddingbenchmarkmodus, gerichte miss-classificatie en verbeterde
Nederlandse normalisatie zijn toegevoegd. De lokale recall@5 steeg naar 0,9267.
Zie `docs/EMBEDDING_VALIDATION_AND_MISS_ANALYSIS_3_1.md`.

### v3.0 Hybrid retrieval

FTS, portable fuzzy retrieval en embeddings worden nu met reciprocal-rank
fusion gecombineerd. De benchmark recall@5 steeg van 0,5550 naar 0,8901.
Zie `docs/HYBRID_RETRIEVAL_3_0.md`.

<details>
<summary><strong>Eerder (v2.0 – v2.9)</strong></summary>

### v2.9 Retrievalbenchmark

Een gelabelde benchmark met 191 Nederlandse testvragen, echte PostgreSQL
FTS-baseline, foutanalyse en CI-regressiegate is toegevoegd.
Zie `docs/RETRIEVAL_BENCHMARK_BASELINE.md`.

### v2.8 AI-paritypipeline

Intentrouting, gewogen Nederlandse PostgreSQL FTS, conditionele LLM-reranking,
adaptieve trusted-source webfallback, bronhiërarchie, antwoordrepair,
pipeline-events en retrievalmetrics zijn toegevoegd.
Zie `docs/AI_PARITY_PIPELINE.md`.

### v2.7 Verplichte checks en stagingreview

Een GitHub-branch-protectioninstaller, CODEOWNERS en een wekelijkse
security/privacyreview voor staging zijn toegevoegd.
Zie `docs/BRANCH_PROTECTION_AND_STAGING_REVIEW.md`.

### v2.6 Security en productieacceptatie

Cross-user autorisatie, gespreksdeelnemerschap, securityheaders, rate limiting,
privacyvriendelijke dead-letterretentie en een echte PostgreSQL/provider/browser
acceptatiesuite zijn toegevoegd.
Zie `docs/SECURITY_AND_PRODUCTION_ACCEPTANCE.md`.

### v2.5 Dead-letterbeheer

Provider-dead-letters kunnen vanuit de backoffice opnieuw worden uitgevoerd,
handmatig worden afgehandeld en daarna worden verwijderd.
Zie `docs/DEAD_LETTER_MANAGEMENT.md`.

### v2.4 PostgreSQL realtime en providerdashboard

De proceslokale realtime broker is vervangen door een PostgreSQL
`LISTEN/NOTIFY`-adapter met memory fallback. De backoffice toont nu
providerconfiguratie, circuit states en dead letters.
Zie `docs/POSTGRES_REALTIME_AND_PROVIDER_DASHBOARD.md`.

### v2.3 Providerresilience en realtime chat

Live providers hebben retries, circuit breakers en een PostgreSQL dead-letter
queue. De menselijke adviseurschat gebruikt nu een beveiligde SSE-stream.
Zie `docs/PROVIDER_RESILIENCE_AND_REALTIME_CHAT.md`.

### v2.2 Klikbare parityflows

Routeverkenning, fasebevestiging, talententest, menselijke adviseurschat,
evenementen en vacatures hebben nu volledige frontendingangen.
Zie `docs/CLICKABLE_PARITY_FLOWS.md`.

### v2.1 Live providers en audittrail

OpenAI-compatible LLM-, JSON-vacature-, JSON-event- en webhooknotificatie-
providers zijn toegevoegd achter bestaande adapters. Profielwijzigingen,
promptactivaties en backofficeacties worden in een PostgreSQL-audittrail
opgeslagen. Zie `docs/LIVE_PROVIDERS_AND_AUDIT.md`.

### v2.0 Backoffice-inzichten en actieve coachprompts

Alerts, statistieken en kandidaatdetail zijn toegevoegd. De actieve goedgekeurde
promptversies worden nu daadwerkelijk aan beide coachproviders doorgegeven.
Zie `docs/BACKOFFICE_INSIGHTS_AND_ACTIVE_PROMPTS.md`.

<details>
<summary><strong>Eerder (v0.3 – v1.9)</strong></summary>

### v1.9 Backoffice en end-to-endtests

Kandidatenoverzicht, promptversiebeheer en Playwrighttests voor de belangrijkste
frontendflows zijn toegevoegd. Zie `docs/BACKOFFICE_AND_E2E.md`.

### v1.8 Kennislaag en frontend-shell

Trusted sources, FAQ-ingest, hybride retrieval en een zelfstandige frontend-shell
zijn toegevoegd. Zie `docs/KNOWLEDGE_AND_FRONTEND.md`.

### v1.6 Deploymentpromotie en observability

Handmatig goedgekeurde staging- en productieworkflows, gestructureerde logging,
healthchecks, Prometheus-metrics en een repo-/plandriftcontrole zijn toegevoegd.
Zie `docs/DEPLOYMENT_AND_OBSERVABILITY.md` en
`docs/REPO_AND_PLAN_DRIFT_AUDIT.md`.

### v1.5 CI en containerdeployment

GitHub Actions voert audit, typecheck, tests, build en migraties uit. Een
multi-stage Docker-image en Docker Compose-configuratie met PostgreSQL en
healthchecks zijn toegevoegd. Zie `docs/CI_AND_DEPLOYMENT.md`.

### v1.4 Dependencybeveiliging en migraties

De dependency-audit staat op nul kwetsbaarheden. Alle 13 migraties zijn
succesvol uitgevoerd tegen een tijdelijke embedded PostgreSQL-database.
Zie `docs/SECURITY_AND_MIGRATION_VERIFICATION.md`.

### v1.3 Volledige PostgreSQL-flowpersistence

Route-, talent-, fase-, backoffice-, evenement- en vacatureflows gebruiken nu
PostgreSQL in productiemodus. Typecheck, 40 tests en build zijn geslaagd.
Zie `docs/POSTGRES_FLOW_PERSISTENCE.md`.

### v1.2 Auth, profiel en productieopslag

Authenticatie, centrale autorisatie, profiel-CRUD en een PostgreSQL-productie-
bootstrap zijn toegevoegd. Zie `docs/AUTH_PROFILE_POSTGRES.md`.

### v1.1 Vacatures en parity-audit

Flow 10 is toegevoegd met zoeken, opslaan, verwijderen en profielkoppeling.
De volledige audit over flows 1 t/m 10 staat in
`docs/FULL_PARITY_AUDIT_1_TO_10.md`.

### v1.0 Parityflows 5–9

Routeflow, faseflow, talententest, adviseursbackoffice en evenementen zijn
end-to-end toegevoegd met hergebruik van bestaande engines en Door010-broncode.
Zie `docs/PARITY_FLOWS_5_TO_9.md`.

### v0.9 Parity-herstel

Correcties 1 t/m 4 zijn samen uitgevoerd: publieke chatbotgrens, volledige
persoonlijke coachcontext, adviseurschat en persistente gesprekken/berichten.
Zie `docs/PARITY_RESTORATION_1_TO_4.md`.

### v0.8.1 API-bootstrap en mutaties

De API laadt nu echte datasets en instantieert beide coaches. Fase- en
profielmutaties vereisen een expliciete acceptatie via de mutatie-endpoints.
Zie `docs/API_BOOTSTRAP_AND_MUTATIONS.md`.

### v0.8 Coaches en persistence

Beide coaches gebruiken nu de gedeelde responseflow. PostgreSQL-repositories
bewaren fasevoorkeuren, journey state en evaluaties.
Zie `docs/COACHES_AND_PERSISTENCE.md`.

### v0.7 Actieve fasesysteemkeuze

De Phase Detector gebruikt nu `PhaseSystemRegistry` en kan per organisatie,
gebruiker of gesprek tussen 4, 5 en 9 fases wisselen.
Zie `docs/ACTIVE_PHASE_SYSTEM.md`.

### v0.6 Wisselbare fasesystemen

Ondersteunt configuratiegestuurd 4, 5 en 9 fases met entry-, exit- en
mappinglogica. Zie `docs/PHASE_SYSTEMS.md`.

### v0.5 Phase Detector en response pipeline

SSOT Phase Detector, confidence fallback, gevalideerde next-slot-selectie,
gegarandeerde vraag-ID en vraagtekst, intake batches, antwoordtypes,
bronplicht, reflectie, directe en inklapbare antwoorddelen.
Zie `docs/PHASE_AND_RESPONSE_PIPELINE.md`.

### v0.4 Route-engine

Volledige route-mapping via `datasets/routes.json` met conditionele vragen,
volledige route matching, specificiteitsranking, geordende route steps,
verrijkte route-inhoud en 5 detectorfases naast 9 journeyfases.
Zie `docs/ROUTES_AND_JOURNEY.md`.

### v0.3 Eerste datamodel

Fase A toegevoegd in `migrations/0002_domain_schema.sql`.

</details>
</details>
</details>
</details>
