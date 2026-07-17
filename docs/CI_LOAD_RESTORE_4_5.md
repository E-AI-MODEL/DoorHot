# Door010 4.5 — CI browsergate, staging load en restore drill

## Playwright CI

Workflow:

```text
.github/workflows/playwright-ci.yml
```

De workflow gebruikt de officiële Playwright-container die overeenkomt met de
projectversie:

```text
mcr.microsoft.com/playwright:v1.55.0-noble
```

Uitvoering:

```text
npm ci --ignore-scripts
npx playwright test --list
npx playwright test --workers=1
```

Artifacts:

```text
apps/web/playwright-report
apps/web/test-results
```

De artifacts blijven 21 dagen beschikbaar.

## Staging load gate

Workflow:

```text
.github/workflows/staging-load.yml
```

Vereist environmentsecret:

```text
STAGING_BASE_URL
```

Handmatige parameters:

```text
path
requests
concurrency
maximum_p95_ms
minimum_success_rate
```

Het resultaat wordt opgeslagen als:

```text
artifacts/staging-load-result.json
```

Een workflowrun faalt wanneer de success rate of p95-gate niet wordt gehaald.

## PostgreSQL restore drill

Workflow:

```text
.github/workflows/postgres-restore-drill.yml
```

Vereist environmentsecret:

```text
STAGING_DATABASE_ADMIN_URL
```

De drill:

1. valideert bron- en restore-databasenamen;
2. maakt een custom-format `pg_dump`;
3. maakt een tijdelijke lege database;
4. herstelt de dump met `pg_restore --exit-on-error`;
5. vergelijkt het aantal publieke tabellen;
6. vergelijkt een schemafingerprint;
7. controleert kritieke Door010-tabellen;
8. ruimt de tijdelijke database altijd op.

Evidence:

```text
artifacts/postgres-restore-drill/result.json
artifacts/postgres-restore-drill/summary.md
```

De dump zelf wordt alleen binnen het workflowartifact bewaard. Gebruik voor
productiedata een afgeschermde GitHub Environment met beperkte toegang en een
korte artifactretentie.

## Readinessstatus

De automatisering is gereed. Werkelijke staging-evidence ontstaat pas nadat
beide handmatige workflows met geldige secrets zijn uitgevoerd.

Daarom blijft het besluit:

```text
CONDITIONAL_GO
```

Open externe gates:

- groene Playwright-CI-run;
- groene staging-loadrun;
- groene PostgreSQL-restoredrill;
- provideracceptatie;
- privacy- en DPIA-sign-off.
