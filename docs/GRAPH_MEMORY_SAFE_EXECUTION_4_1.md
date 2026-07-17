# Door010 4.1 — graph memory en veilige execution-tools

## Graph memory

De journey-state wordt geprojecteerd naar een domeingraph:

```text
User
└── Journey
    ├── Phase
    ├── Route
    ├── Goals
    │   ├── Milestones
    │   └── Actions
    ├── Blockers
    ├── Evidence
    └── Decisions
```

Node-typen:

```text
user
journey
goal
milestone
blocker
action
evidence
decision
phase
route
```

Relaties:

```text
HAS_JOURNEY
HAS_GOAL
HAS_MILESTONE
HAS_BLOCKER
HAS_ACTION
HAS_EVIDENCE
HAS_DECISION
IN_PHASE
FOLLOWS_ROUTE
SUPPORTS
RESOLVES
DEPENDS_ON
```

De graph memory vervangt Journey Engine 2.0 niet. Het is een uitleesbare,
querybare projectie van de deterministische journey-state.

API:

```text
POST /v1/memory-graph/:userId/synchronize
GET  /v1/memory-graph/:userId
GET  /v1/memory-graph/:userId/nodes/:nodeId/neighbors
```

Neighbor-query's zijn begrensd tot maximaal vier niveaus.

## Veilige execution-tools

Nieuwe tools:

```text
reminder.schedule
notification.queue
```

Deze tools voeren niet direct een externe actie uit. Ze maken eerst een
`pending_confirmation`-verzoek aan.

```text
toolvoorstel
→ eenmalige confirmation token
→ expliciete approve/reject
→ notification outbox
→ latere delivery-adapter
```

Beveiliging:

- gebruiker moet geauthenticeerd zijn;
- verzoek is aan één user ID gekoppeld;
- confirmation token wordt uitsluitend gehasht opgeslagen;
- token verloopt standaard na vijftien minuten;
- hergebruik van een request is niet toegestaan;
- write-tools staan in de bestaande toolallowlist;
- afwijzen maakt geen outboxitem;
- externe aflevering is nog niet actief.

API:

```text
POST /v1/execution-requests
POST /v1/execution-requests/:requestId/confirm
GET  /v1/backoffice/execution-requests
GET  /v1/backoffice/notification-outbox
```

## Backoffice

De beheeromgeving toont:

- verzoeken die nog bevestiging nodig hebben;
- uitgevoerde, afgewezen en verlopen requests;
- queued reminders en notificaties;
- payload en gekozen execution-tool.

## Database

Migratie:

```text
migrations/0025_graph_memory_execution_tools.sql
```

Nieuwe tabellen:

```text
memory_graph_nodes
memory_graph_edges
execution_requests
notification_outbox
```

## Grenzen

- De graph wordt op aanvraag gesynchroniseerd; event-driven incremental graph
  updates volgen later.
- De graph is relationeel opgeslagen en gebruikt geen externe graphdatabase.
- De notification outbox levert nog niet af via e-mail, webhook of push.
- Confirmation tokens moeten door de client direct na aanmaken veilig worden
  bewaard; alleen de hash staat in de database.
- De negen Playwright-tests zijn ontdekt, maar niet als volledige browserrun
  uitgevoerd.
