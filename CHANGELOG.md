# Changelog

Dit bestand bewaart de ontwikkelgeschiedenis die eerder onderaan `README.md` stond. Het is een technisch overzicht van opeenvolgende foundations en geen bewijs dat externe staging- of productieacceptatie is afgerond.

## 5.0.1

Versie 5.0.1 bundelt de cumulatieve foundation. De readinessstatus blijft `CONDITIONAL_GO` totdat vereiste staging-, provider-, privacy-, load- en recovery-evidence in de doelomgeving is uitgevoerd.

## 4.5

### CI-, load- en recoverygates

Officiële Playwright-CI, een configureerbare staging-loadgate en een PostgreSQL backup/restore-drill zijn toegevoegd.

Zie [`docs/CI_LOAD_RESTORE_4_5.md`](docs/CI_LOAD_RESTORE_4_5.md).

## 4.4

### Browseracceptatie en production readiness

Dedicated journey-dashboard-E2E is toegevoegd. Het production-readinessbesluit is `CONDITIONAL_GO`, met expliciete go-liveblokkades voor browser, load, recovery, providers en privacy.

Zie [`docs/PRODUCTION_READINESS_4_4.md`](docs/PRODUCTION_READINESS_4_4.md).

## 4.3

### Journey-dashboard en alignmentcheckpoint

Gebruikers hebben een persoonlijk trajectdashboard. De architectuur en oorspronkelijke parityflows zijn opnieuw gecontroleerd.

Zie [`docs/JOURNEY_DASHBOARD_ALIGNMENT_4_3.md`](docs/JOURNEY_DASHBOARD_ALIGNMENT_4_3.md).

## 4.2

### Event-driven graphcontext en delivery workers

Journey-mutaties synchroniseren de graph memory automatisch. De persoonlijke coach ontvangt graphcontext en de notification outbox heeft workers voor in-app en optionele HTTP-providerdelivery.

Zie [`docs/EVENT_DRIVEN_GRAPH_NOTIFICATION_DELIVERY_4_2.md`](docs/EVENT_DRIVEN_GRAPH_NOTIFICATION_DELIVERY_4_2.md).

## 4.1

### Graph memory en veilige execution

Journey-state kan als domeingraph worden bevraagd. Reminders en notificaties gebruiken expliciete bevestiging en een transactionele outbox.

Zie [`docs/GRAPH_MEMORY_SAFE_EXECUTION_4_1.md`](docs/GRAPH_MEMORY_SAFE_EXECUTION_4_1.md).

## 4.0

### Parallel orchestration en shadow planning

Onafhankelijke tools draaien parallel. Een provider-onafhankelijke planner draait in shadow mode en de backoffice toont verklaarbare plannen en traces.

Zie [`docs/PARALLEL_ORCHESTRATION_SHADOW_PLANNING_4_0.md`](docs/PARALLEL_ORCHESTRATION_SHADOW_PLANNING_4_0.md).

## 3.9

### AI Orchestrator

Intent, journey, knowledge, planning, tools en observability zijn samengebracht in `@door010/orchestration`.

Zie [`docs/AI_ORCHESTRATOR_3_9.md`](docs/AI_ORCHESTRATOR_3_9.md).

## 3.8

### Journey Engine 2.0

Persistente doelen, milestones, blockers, acties, evidence, beslissingen, voortgang en next-best-action zijn toegevoegd.

Zie [`docs/JOURNEY_ENGINE_2_3_8.md`](docs/JOURNEY_ENGINE_2_3_8.md).

## 3.7

### Distributed scheduling en snapshots

Connectorruns gebruiken databaseleases met heartbeat en herstel van verlopen leases. Volledige snapshots archiveren records die uit een bron verdwijnen.

Zie [`docs/DISTRIBUTED_SCHEDULING_SNAPSHOTS_3_7.md`](docs/DISTRIBUTED_SCHEDULING_SNAPSHOTS_3_7.md).

## 3.6

### Connector runtime en domeinconnectors

Retries, environment secrets, scheduling, healthmonitoring en de eerste opleidingen-, subsidie-, event- en vacatureconnectors zijn toegevoegd.

Zie [`docs/CONNECTOR_RUNTIME_DOMAIN_CONNECTORS_3_6.md`](docs/CONNECTOR_RUNTIME_DOMAIN_CONNECTORS_3_6.md).

## 3.5

### Capability architecture en connectors

De capability-architectuur en een generiek JSON-, CSV- en HTTP-connectorframework zijn toegevoegd.

Zie [`docs/CAPABILITY_ARCHITECTURE_CONNECTORS_3_5.md`](docs/CAPABILITY_ARCHITECTURE_CONNECTORS_3_5.md).

## 3.4

### Shadow reranking en active learning

Een provider-onafhankelijke cross-encoderadapter draait in shadow mode. Lage-confidencevragen worden privacyvriendelijk naar een menselijke labelqueue gestuurd.

Zie [`docs/SHADOW_RERANKING_ACTIVE_LEARNING_3_4.md`](docs/SHADOW_RERANKING_ACTIVE_LEARNING_3_4.md).

## 3.3

### Uitgebreide retrievalbenchmark

De benchmark is uitgebreid met gegroepeerde queries, hard negatives en multi-intentvragen. De reranker gebruikt validation-based early stopping, Brier-calibratie en een CI-driftgate.

Zie [`docs/EXPANDED_RETRIEVAL_BENCHMARK_3_3.md`](docs/EXPANDED_RETRIEVAL_BENCHMARK_3_3.md).

> Let op: benchmarkcijfers zijn interne regressie-evidence. Zie de toelichting in `README.md` over overlap tussen benchmarkqueries en geïndexeerde brondata.

## 3.2

### Learned reranking

Een hold-out-gevalideerde lineaire learned reranker is toegevoegd bovenop de hybride RRF-laag.

Zie [`docs/LEARNED_RERANKING_3_2.md`](docs/LEARNED_RERANKING_3_2.md).

## 3.1

### Embeddingvalidatie en miss-analyse

Een externe embeddingbenchmarkmodus, gerichte miss-classificatie en verbeterde Nederlandse normalisatie zijn toegevoegd.

Zie [`docs/EMBEDDING_VALIDATION_AND_MISS_ANALYSIS_3_1.md`](docs/EMBEDDING_VALIDATION_AND_MISS_ANALYSIS_3_1.md).

## 3.0

### Hybrid retrieval

FTS, portable fuzzy retrieval en embeddings worden met reciprocal-rank fusion gecombineerd.

Zie [`docs/HYBRID_RETRIEVAL_3_0.md`](docs/HYBRID_RETRIEVAL_3_0.md).

## 2.9

### Retrievalbenchmark

Een gelabelde benchmark met Nederlandse testvragen, een PostgreSQL FTS-baseline, foutanalyse en CI-regressiegate is toegevoegd.

Zie [`docs/RETRIEVAL_BENCHMARK_BASELINE.md`](docs/RETRIEVAL_BENCHMARK_BASELINE.md).

## 2.8

### AI-paritypipeline

Intentrouting, gewogen Nederlandse PostgreSQL FTS, conditionele LLM-reranking, adaptieve trusted-source webfallback, bronhiërarchie, antwoordrepair, pipeline-events en retrievalmetrics zijn toegevoegd.

Zie [`docs/AI_PARITY_PIPELINE.md`](docs/AI_PARITY_PIPELINE.md).

## 2.7

### Verplichte checks en stagingreview

Een GitHub-branch-protectioninstaller, CODEOWNERS en een wekelijkse security/privacyreview voor staging zijn toegevoegd.

Zie [`docs/BRANCH_PROTECTION_AND_STAGING_REVIEW.md`](docs/BRANCH_PROTECTION_AND_STAGING_REVIEW.md).

## 2.6

### Security en productieacceptatie

Cross-user autorisatie, gespreksdeelnemerschap, securityheaders, rate limiting, privacyvriendelijke dead-letterretentie en een PostgreSQL/provider/browser acceptatiesuite zijn toegevoegd.

Zie [`docs/SECURITY_AND_PRODUCTION_ACCEPTANCE.md`](docs/SECURITY_AND_PRODUCTION_ACCEPTANCE.md).

## 2.5

### Dead-letterbeheer

Provider-dead-letters kunnen vanuit de backoffice opnieuw worden uitgevoerd, handmatig worden afgehandeld en daarna worden verwijderd.

Zie [`docs/DEAD_LETTER_MANAGEMENT.md`](docs/DEAD_LETTER_MANAGEMENT.md).

## 2.4

### PostgreSQL realtime en providerdashboard

De proceslokale realtime broker is vervangen door een PostgreSQL `LISTEN/NOTIFY`-adapter met memory fallback. De backoffice toont providerconfiguratie, circuit states en dead letters.

Zie [`docs/POSTGRES_REALTIME_AND_PROVIDER_DASHBOARD.md`](docs/POSTGRES_REALTIME_AND_PROVIDER_DASHBOARD.md).

## 2.3

### Providerresilience en realtime chat

Live providers hebben retries, circuit breakers en een PostgreSQL dead-letter queue. De menselijke adviseurschat gebruikt een beveiligde SSE-stream.

Zie [`docs/PROVIDER_RESILIENCE_AND_REALTIME_CHAT.md`](docs/PROVIDER_RESILIENCE_AND_REALTIME_CHAT.md).

## 2.2

### Klikbare parityflows

Routeverkenning, fasebevestiging, talententest, menselijke adviseurschat, evenementen en vacatures hebben volledige frontendingangen gekregen.

Zie [`docs/CLICKABLE_PARITY_FLOWS.md`](docs/CLICKABLE_PARITY_FLOWS.md).

## 2.1

### Live providers en audittrail

OpenAI-compatible LLM-, JSON-vacature-, JSON-event- en webhooknotificatieproviders zijn toegevoegd achter bestaande adapters. Profielwijzigingen, promptactivaties en backofficeacties worden in een PostgreSQL-audittrail opgeslagen.

Zie [`docs/LIVE_PROVIDERS_AND_AUDIT.md`](docs/LIVE_PROVIDERS_AND_AUDIT.md).

## 2.0

### Backoffice-inzichten en actieve coachprompts

Alerts, statistieken en kandidaatdetail zijn toegevoegd. Actieve goedgekeurde promptversies worden aan beide coachproviders doorgegeven.

Zie [`docs/BACKOFFICE_INSIGHTS_AND_ACTIVE_PROMPTS.md`](docs/BACKOFFICE_INSIGHTS_AND_ACTIVE_PROMPTS.md).

## 1.9

### Backoffice en end-to-endtests

Kandidatenoverzicht, promptversiebeheer en Playwrighttests voor de belangrijkste frontendflows zijn toegevoegd.

Zie [`docs/BACKOFFICE_AND_E2E.md`](docs/BACKOFFICE_AND_E2E.md).

## 1.8

### Kennislaag en frontend-shell

Trusted sources, FAQ-ingest, hybride retrieval en een zelfstandige frontend-shell zijn toegevoegd.

Zie [`docs/KNOWLEDGE_AND_FRONTEND.md`](docs/KNOWLEDGE_AND_FRONTEND.md).

## 1.6

### Deploymentpromotie en observability

Handmatig goedgekeurde staging- en productieworkflows, gestructureerde logging, healthchecks, Prometheus-metrics en een repo-/plandriftcontrole zijn toegevoegd.

Zie [`docs/DEPLOYMENT_AND_OBSERVABILITY.md`](docs/DEPLOYMENT_AND_OBSERVABILITY.md) en [`docs/REPO_AND_PLAN_DRIFT_AUDIT.md`](docs/REPO_AND_PLAN_DRIFT_AUDIT.md).

## 1.5

### CI en containerdeployment

GitHub Actions voert audit, typecheck, tests, build en migraties uit. Een multi-stage Docker-image en Docker Compose-configuratie met PostgreSQL en healthchecks zijn toegevoegd.

Zie [`docs/CI_AND_DEPLOYMENT.md`](docs/CI_AND_DEPLOYMENT.md).

## 1.4

### Dependencybeveiliging en migraties

Dependency-audit en migratieverificatie tegen een tijdelijke embedded PostgreSQL-database zijn toegevoegd.

Zie [`docs/SECURITY_AND_MIGRATION_VERIFICATION.md`](docs/SECURITY_AND_MIGRATION_VERIFICATION.md).

## 1.3

### Volledige PostgreSQL-flowpersistence

Route-, talent-, fase-, backoffice-, evenement- en vacatureflows gebruiken PostgreSQL in productiemodus.

Zie [`docs/POSTGRES_FLOW_PERSISTENCE.md`](docs/POSTGRES_FLOW_PERSISTENCE.md).

## 1.2

### Auth, profiel en productieopslag

Authenticatie, centrale autorisatie, profiel-CRUD en een PostgreSQL-productiebootstrap zijn toegevoegd.

Zie [`docs/AUTH_PROFILE_POSTGRES.md`](docs/AUTH_PROFILE_POSTGRES.md).

## 1.1

### Vacatures en parity-audit

Vacaturezoeken, opslaan, verwijderen en profielkoppeling zijn toegevoegd. De volledige audit over flows 1 tot en met 10 is vastgelegd.

Zie [`docs/FULL_PARITY_AUDIT_1_TO_10.md`](docs/FULL_PARITY_AUDIT_1_TO_10.md).

## 1.0

### Parityflows 5 tot en met 9

Routeflow, faseflow, talententest, adviseursbackoffice en evenementen zijn end-to-end toegevoegd met hergebruik van bestaande engines en Door010-broncode.

Zie [`docs/PARITY_FLOWS_5_TO_9.md`](docs/PARITY_FLOWS_5_TO_9.md).

## 0.9

### Parity-herstel

Correcties voor de publieke chatbotgrens, volledige persoonlijke coachcontext, adviseurschat en persistente gesprekken en berichten zijn samengebracht.

Zie [`docs/PARITY_RESTORATION_1_TO_4.md`](docs/PARITY_RESTORATION_1_TO_4.md).

## 0.8.1

### API-bootstrap en mutaties

De API laadt datasets en instantieert beide coaches. Fase- en profielmutaties vereisen expliciete acceptatie via mutatie-endpoints.

Zie [`docs/API_BOOTSTRAP_AND_MUTATIONS.md`](docs/API_BOOTSTRAP_AND_MUTATIONS.md).

## 0.8

### Coaches en persistence

Beide coaches gebruiken de gedeelde responseflow. PostgreSQL-repositories bewaren fasevoorkeuren, journey-state en evaluaties.

Zie [`docs/COACHES_AND_PERSISTENCE.md`](docs/COACHES_AND_PERSISTENCE.md).

## 0.7

### Actieve fasesysteemkeuze

De Phase Detector gebruikt `PhaseSystemRegistry` en kan per organisatie, gebruiker of gesprek tussen 4, 5 en 9 fasen wisselen.

Zie [`docs/ACTIVE_PHASE_SYSTEM.md`](docs/ACTIVE_PHASE_SYSTEM.md).

## 0.6

### Wisselbare fasesystemen

Configuratiegestuurde 4-, 5- en 9-fasenmodellen met entry-, exit- en mappinglogica zijn toegevoegd.

Zie [`docs/PHASE_SYSTEMS.md`](docs/PHASE_SYSTEMS.md).

## 0.5

### Phase Detector en response pipeline

De SSOT Phase Detector, confidence fallback, gevalideerde next-slot-selectie, vraag-ID's, intakebatches, antwoordtypen, bronplicht en reflectie zijn toegevoegd.

Zie [`docs/PHASE_AND_RESPONSE_PIPELINE.md`](docs/PHASE_AND_RESPONSE_PIPELINE.md).

## 0.4

### Route Engine

Volledige routemapping via `datasets/routes.json` met conditionele vragen, route matching, specificiteitsranking en geordende routestappen is toegevoegd.

Zie [`docs/ROUTES_AND_JOURNEY.md`](docs/ROUTES_AND_JOURNEY.md).

## 0.3

### Eerste datamodel

Fase A is toegevoegd in `migrations/0002_domain_schema.sql`.
