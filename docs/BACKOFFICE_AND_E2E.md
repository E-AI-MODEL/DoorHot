# Door010 3.0 v1.9 — backoffice en end-to-endtests

## Backoffice

Toegevoegd:

- kandidatenoverzicht;
- fase, route en detectorconfidence;
- adviseurs- en beheerdersnavigatie;
- promptconfiguraties voor de algemene en persoonlijke coach;
- promptversies;
- conceptstatus;
- versieactivatie;
- PostgreSQL- en memoryrepositories;
- rolcontrole voor backoffice-endpoints.

API:

```text
GET  /v1/backoffice/candidates
GET  /v1/backoffice/prompts
POST /v1/backoffice/prompts
POST /v1/backoffice/prompts/:promptConfigId/versions
POST /v1/backoffice/prompts/:promptConfigId/activate
```

Promptbeheer vereist `administrator` of `superuser`. Het kandidatenoverzicht
vereist `advisor`, `administrator` of `superuser`.

## Frontend

De bestaande `apps/web`-shell bevat nu een backofficeweergave met:

- dashboardtellingen;
- kandidatentabel;
- actieve fase en route;
- detectorconfidence;
- promptformulier;
- versieoverzicht;
- versieactivatie.

De frontend gebruikt alleen API-contracten en bevat geen eigen route-,
fase- of promptselectielogica.

## End-to-endtests

Playwrighttests:

```text
apps/web/e2e/core-flows.spec.ts
```

Gedekte flows:

1. publieke chat;
2. login;
3. profiel laden en opslaan;
4. persoonlijke chat;
5. kandidaten- en promptbeheer.

API-verzoeken worden in de browsertests gecontroleerd gemockt. Hierdoor testen
de scenario's de frontendcontracten zonder externe providers.

CI installeert Chromium en voert uit:

```bash
npm run test:e2e
```

In de huidige uitvoeromgeving kon Chromium niet volledig starten door
container-GPUbeperkingen. De vijf tests zijn wel succesvol door Playwright
ontdekt en TypeScript, frontendbuild en backendbuild zijn geslaagd.
