# Door010 3.0 v0.8 — coaches en persistence

## Coaches

`GeneralCoach` en `PersonalJourneyCoach` gebruiken nu dezelfde flow:

```text
context laden
→ actief fasesysteem bepalen
→ AdaptivePhaseDetector uitvoeren
→ antwoorddraft maken
→ response pipeline uitvoeren
→ artifacts en voorgestelde mutations bouwen
→ fase-evaluatie opslaan
```

De persoonlijke coach vereist authenticatie. Een faseovergang wordt nooit
automatisch toegepast; deze blijft een bevestigingsplichtige mutation.

## PostgreSQL repositories

Toegevoegd:

- `PostgresPhaseSystemPreferenceRepository`
- `PostgresJourneyStateRepository`
- `PostgresPhaseRepository`

De repositories gebruiken een `SqlExecutor`-interface. Daardoor kunnen `pg`,
Supabase of een transactionele adapter worden geïnjecteerd zonder de domeinlaag
te koppelen aan één driver.

## Persistence adapter

`DatabaseChatPersistence` vertaalt detectorresultaten naar
`PhaseEvaluationRecord`.

## Belangrijke bestanden

- `packages/chat/src/index.ts`
- `packages/database/src/index.ts`
- `packages/chat-persistence/src/index.ts`
- `migrations/0007_persistent_journey_state.sql`
