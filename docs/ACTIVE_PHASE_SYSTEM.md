# Door010 3.0 v0.7 — actieve fasesysteemkeuze

## Resolvervolgorde

Het actieve fasesysteem wordt als volgt bepaald:

1. gesprek;
2. gebruiker;
3. organisatie;
4. standaard `phase-5`.

Een specifiekere instelling overschrijft dus een bredere instelling.

## Adaptive Phase Detector

De `AdaptivePhaseDetector`:

1. bepaalt het actieve fasesysteem;
2. leest de huidige fase binnen dat systeem;
3. mapt die fase naar de 5-fasen detector;
4. selecteert de SSOT-vraag;
5. evalueert entry- en exitcriteria binnen het actieve systeem;
6. retourneert zowel detector- als transitieresultaat.

## API

```text
POST /v1/settings/phase-system
GET  /v1/settings/phase-system
```

Ondersteunde scopes:

- `organization`
- `user`
- `conversation`

## Bestanden

- `packages/domain/src/phase-system-preferences.ts`
- `packages/domain/src/adaptive-phase-detector.ts`
- `migrations/0006_phase_system_preferences.sql`
