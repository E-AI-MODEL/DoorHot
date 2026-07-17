# ARCHITECTURE.md

## Overzicht

Door010 Foundation 5.0 is een modulaire TypeScript-workspace met een webapp,
API, domeinengines, orchestrationlaag, provideradapters en PostgreSQL-opslag.

```text
Browser
  │
  ▼
Webapp
  │
  ▼
API en autorisatie
  │
  ├───────────────┬───────────────────┐
  ▼               ▼                   ▼
General Coach  Personal Coach   Human Advisor Chat
  │               │
  └───────┬───────┘
          ▼
AI Orchestrator
  │
  ├───────────────┬───────────────────┐
  ▼               ▼                   ▼
Retrieval     Journey/Route      Execution Tools
  │             Engines               │
  ▼               │                   ▼
Knowledge         ▼             Confirmation/Outbox
  │           Graph Projection        │
  └───────────────┴───────────────────┘
                  ▼
              PostgreSQL
```

## Chatkanalen

### Public General Coach

- algemene onderwijsinformatie;
- geen persoonlijke journey-state;
- trusted-source retrieval;
- gevalideerde antwoorden.

### Personal Journey Coach

- geauthenticeerde persoonlijke begeleiding;
- profiel-, route-, fase- en graphcontext;
- deterministische journeybeslissingen;
- mutaties via expliciete voorstellen en bevestiging.

### Human Advisor Chat

- direct menselijk kanaal;
- persistente gesprekken en berichten;
- eigen autorisatie- en backofficeflows;
- geen automatische vervanging door AI.

## Deterministische engines

### Phase Engine

Ondersteunt configureerbare faseweergaven en mappings:

- 4 overkoepelende fasen;
- 5 detectorfasen;
- 9 lifecyclefasen.

### Route Engine

Gebruikt de routevragen en datasets om reproduceerbare route-uitkomsten en
geordende stappen te bepalen.

### Journey Engine

Beheert:

- doelen;
- milestones;
- blockers;
- acties;
- evidence;
- beslissingen;
- voortgang;
- next-best action.

De engine is de enige component die journey-state mag muteren.

## Graph Memory

Graph Memory projecteert journeygegevens naar nodes en relaties voor context en
toekomstige graph retrieval.

Het is geen primaire opslag en bevat geen leidende businesslogica.

## AI-orchestration

De orchestrator:

- classificeert intent;
- plant capabilities;
- voert onafhankelijke stappen parallel uit;
- ondersteunt shadow planning;
- registreert explainability en runtimes;
- behoudt de bestaande coachcontracten.

De orchestrator mag deterministische enginebeslissingen niet vervangen.

## Retrieval

```text
PostgreSQL full-text search
→ optionele hybride fusion
→ conditionele reranking
→ trusted-source selectie
→ adaptieve webfallback
→ antwoordgeneratie
→ repair en validatie
```

Feature flags bepalen welke uitbreidingen actief zijn.

## Gecontroleerde uitvoering

```text
LLM of gebruiker
→ execution proposal
→ bevestigingstoken
→ approve/reject
→ tooluitvoering
→ outbox
→ delivery worker
→ notificatiestatus
```

Ondersteunde basisacties omvatten reminders en notificaties.

## Data en persistence

PostgreSQL is de referentiedatabase.

Belangrijke eigenschappen:

- append-only migraties;
- repositories achter interfaces;
- audittrail;
- dead-letteropslag;
- notification outbox;
- connector leases en snapshots;
- graphprojecties;
- orchestrationruns.

## Provideradapters

Adapters bestaan voor onder meer:

- authenticatie;
- database;
- objectopslag;
- LLM;
- embeddings;
- search;
- notificaties;
- externe onderwijsdata.

De domeinlaag blijft framework- en vendoronafhankelijk.

## Deployment en betrouwbaarheid

De repository bevat:

- Dockerimages en Docker Compose;
- GitHub Actions voor CI en acceptance;
- officiële Playwright-browserworkflow;
- staging-loadgate;
- PostgreSQL backup/restore-drill;
- healthchecks en metrics;
- provideracceptatie en realtimechecks.

## Securitymodel

- centrale authenticatie;
- ownership- en rolgebaseerde autorisatie;
- rate limiting;
- CSP en securityheaders;
- inputvalidatie met schema's;
- hash-only confirmation tokens;
- expliciete bevestiging voor gevoelige acties;
- minimale opslag van provider- en orchestrationpayloads.

## Toekomstige richting

Mogelijke uitbreidingen, uitsluitend achter stabiele contracten:

- GraphRAG voor persoonlijke contextretrieval;
- incrementele eventgedreven graphupdates;
- realtime browsernotificaties;
- MCP- en A2A-adapters;
- multi-tenant configuratie;
- agent memory compression;
- aanvullende execution providerplugins;
- autoriteits- en versheidsfeatures in de learned reranker, zodat
  bronautoriteit en actualiteit ook na reranking meewegen bij
  dynamische content (hertrainen via de bestaande benchmarkgates);
- benchmarkcases voor regionale loketten en routestappen plus
  hertraining, zodat niet-FAQ-kennistypen gelijkwaardig ranken
  (relevant bij landelijke uitbreiding).

Bewust niet gepland: ingest van de CMS-collecties faqs en articles
waarnaar de routestappen verwijzen. De 62 CMS-FAQ's overlappen
grotendeels met de bestaande 48 en de artikelen hebben beperkte
houdbaarheid; de adaptieve webfallback dekt actualiteitsvragen al
binnen de whitelist. De verwijzingen in route-steps.json zijn inert en
worden nergens geconsumeerd.

Deze uitbreidingen mogen de bestaande deterministische engines en kanaalgrenzen
niet doorbreken.
