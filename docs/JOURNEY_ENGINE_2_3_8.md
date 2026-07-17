# Door010 3.8 — Journey Engine 2.0

## Domeinmodel

Nieuwe persistente objecten:

```text
Journey
├── Goals
├── Milestones
├── Blockers
├── Actions
├── Evidence
└── Decisions
```

De engine is deterministisch. Een taalmodel mag voorstellen formuleren, maar
de journey-state wordt alleen via expliciete services en regels gewijzigd.

## Progress

Voortgang wordt berekend uit:

```text
40% voltooide doelen
60% gewogen milestones
− blocker penalty
```

Open blockers verlagen de score op basis van severity en confidence.
De uitkomst ligt altijd tussen 0 en 1.

## Next-best action

De volgende actie wordt gekozen op:

1. severity van de gekoppelde open blocker;
2. actieprioriteit;
3. eerstvolgende deadline.

Hierdoor krijgt een actie die een kritieke blokkade oplost voorrang boven een
algemene actie met alleen een hoge prioriteit.

## Evidence en beslissingen

Iedere fase- en routecontext kan als evidence worden opgeslagen.

```text
fase- of route-engine
→ evidence
→ verklaarde decision
→ journey-state
```

Beslissingen bevatten:

- decision key;
- outcome;
- reden;
- evidence IDs;
- rule version;
- reversible-indicator;
- beslistijd.

Engineversie:

```text
journey-engine-2.0.0
```

## API

```text
POST  /v1/journeys
POST  /v1/journeys/:userId/context
GET   /v1/journeys/:userId
POST  /v1/journeys/:userId/goals
POST  /v1/journeys/:userId/milestones
POST  /v1/journeys/:userId/blockers
POST  /v1/journeys/:userId/actions
PATCH /v1/journeys/:userId/actions/:actionId
PATCH /v1/journeys/:userId/milestones/:milestoneId
POST  /v1/journeys/:userId/blockers/:blockerId/resolve
```

Kandidaten hebben alleen toegang tot hun eigen journey. Advisors,
administrators en superusers mogen journeys binnen hun bevoegdheid bekijken
en bijwerken.

## PostgreSQL

Nieuwe migratie:

```text
migrations/0022_journey_engine_2.sql
```

Nieuwe tabellen:

```text
journeys
journey_goals
journey_milestones
journey_blockers
journey_actions
journey_evidence
journey_decisions
```

## Grenzen

- Reminders en notificaties zijn nog niet gekoppeld.
- Automatische actievoorstellen vanuit de AI-orchestrator volgen in v3.9.
- De engine heeft nog geen backoffice-journeyvisualisatie.
- Volledige browser-E2E voor de nieuwe journey-API is nog niet toegevoegd.
