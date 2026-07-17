# Door010 4.3 — journey-dashboard en alignmentcheckpoint

## Persoonlijk journey-dashboard

Nieuwe navigatie:

```text
Mijn traject
```

Het dashboard toont:

- totale voortgang;
- huidige fase en route;
- next-best action;
- actieve doelen;
- milestones;
- open blockers;
- pending acties;
- graphcontext;
- afgeleverde in-appnotificaties.

Gebruikers kunnen vanuit het dashboard:

```text
actie afronden
milestone afronden
blocker als opgelost markeren
dashboard vernieuwen
```

Alle mutaties lopen via de bestaande Journey Engine. Graph memory wordt daarna
automatisch bijgewerkt via `JourneyChangeListener`.

## Alignmentcheckpoint

De oorspronkelijke functionele kanalen blijven gescheiden:

```text
Public General Coach
Personal Journey Coach
Human Advisor Chat
```

De oorspronkelijke parityflows zijn nog aanwezig:

```text
auth
profile
personal chat
route
phase
talent test
advisor chat
events
vacancies
backoffice
```

Nieuwe capabilities zijn additief toegevoegd. De orchestrator vervangt het
coachantwoord niet, graph memory vervangt de journey-state niet en execution
tools schrijven alleen na expliciete bevestiging.

Beoordeling:

```text
on-plan-no-material-architecture-drift
```

## Open bewijs

Nog niet volledig bewezen:

- volledige Playwright-browserrun;
- live provideracceptatie;
- live PostgreSQL multi-instance acceptance;
- externe e-mail- en webhookdelivery;
- dedicated journey-dashboard-E2E.

Zie `docs/v4.3-alignment-checkpoint.json`.
