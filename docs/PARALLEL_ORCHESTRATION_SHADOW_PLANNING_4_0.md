# Door010 4.0 — parallel orchestration, shadow planning en explainability

## Parallelle uitvoering

De orchestrator voert onafhankelijke tools nu parallel uit.

Voorbeeld:

```text
execution group 1
├── journey.dashboard
└── knowledge.search

execution group 2
└── journey.next-action
```

`dependsOn` bepaalt welke stappen eerst moeten zijn afgerond. Required
dependency failures stoppen alleen de afhankelijke vervolgstappen.

## Model-assisted planner in shadow mode

Nieuwe contracten:

```text
PlannerSuggestionProvider
PlannerShadowRepository
ShadowPlanningService
```

Implementaties:

```text
HeuristicShadowPlanner
HttpPlannerSuggestionProvider
InMemoryPlannerShadowRepository
PostgresPlannerShadowRepository
```

De HTTP-provider ontvangt:

- gebruikersvraag;
- beperkte context;
- deterministisch plan;
- allowlist van beschikbare tools.

Een shadowplan mag alleen tools uit die allowlist gebruiken. Het plan beïnvloedt
de productie-uitvoering niet.

Configuratie:

```text
PLANNER_SHADOW_ENDPOINT
PLANNER_SHADOW_API_KEY
PLANNER_SHADOW_MODEL
PLANNER_SHADOW_TIMEOUT_MS
```

Zonder providerconfiguratie wordt de lokale heuristische shadowplanner gebruikt.

## Planvergelijking

Per orchestrationrun worden opgeslagen:

```text
provider
deterministisch plan
shadowplan
agreement score
toegevoegde tools
verwijderde tools
latency
status en foutcode
```

Nieuwe tabel:

```text
planner_shadow_evaluations
```

### Opslagduur

- `APP_STORAGE_MODE=memory` gebruikt `InMemoryPlannerShadowRepository`.
  Evaluaties verdwijnen bij een herstart van het API-proces.
- `APP_STORAGE_MODE=postgres` gebruikt `PostgresPlannerShadowRepository` en
  schrijft voor iedere orchestrationrun een voltooide of mislukte evaluatie
  naar `planner_shadow_evaluations`.

De API-bootstraptest voert de orchestrator end-to-end uit en controleert dat de
shadowevaluatie op het bijbehorende run-ID kan worden teruggelezen.

Een afzonderlijke PGlite-test past de relevante productiemigraties toe, schrijft
via `PostgresPlannerShadowRepository`, sluit de embedded PostgreSQL-database en
leest het record na heropening via een nieuwe repository-instantie en hetzelfde
run-ID terug. Dit bewijst de SQL-wiring en opslag over database- en
repository-instanties. Het is geen bewijs van de configuratie of beschikbaarheid
van een live PostgreSQL-omgeving.

## Explainability

Nieuwe API:

```text
GET /v1/backoffice/orchestration-runs/:runId/explanation
GET /v1/backoffice/planner-shadow
```

De uitleg bevat:

- intent;
- antwoordstrategie;
- verplichte en optionele tools;
- redenen per planstap;
- dependencies;
- parallelle execution groups;
- toolfouten;
- shadowplannervergelijking.

De backoffice toont recente orchestrationruns en de shadow agreement score.

## Grenzen

- De externe modelplanner is niet live uitgevoerd.
- De lokale shadowplanner is heuristisch en dient als veilige fallback.
- Productierouting blijft volledig deterministisch.
- De negen Playwright-tests zijn ontdekt, maar niet als volledige browserrun
  uitgevoerd.
