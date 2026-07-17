# Door010 4.4 — browseracceptatie en production readiness

## A. Journey-dashboard Playwright

Toegevoegd:

```text
apps/web/e2e/journey-dashboard.spec.ts
```

Scenario's:

1. voortgang, fase, route, doelen, blockers, acties, graphcontext en notificaties;
2. actie afronden, milestone afronden en blocker oplossen.

Playwright ontdekt nu elf tests in drie bestanden.

De volledige browserrun is in deze omgeving uitgevoerd met system Chromium,
maar de browser sluit tijdens startup omdat het GPU-proces in deze sandbox niet
bruikbaar is. De officiële Playwright-browser kon niet worden gedownload door
DNS/netwerkbeperkingen. Dit is een runtimeblokkade en geen geslaagde browsersuite.

De suite moet daarom nog één keer draaien in de ondersteunde CI-container met
de officiële Playwright-image.

## B. Production-readiness checkpoint

Besluit:

```text
CONDITIONAL_GO
```

### Security — pass met externe gates

Aanwezig:

- ownership- en rolcontrole;
- rate limiting;
- CSP en overige securityheaders;
- nul bekende npm-kwetsbaarheden;
- bestaand staging security review-resultaat: PASS.

Nog nodig:

- onafhankelijke pentest;
- secret-managercontrole;
- verificatie van productie-TLS en HSTS.

### Privacy — conditional

Aanwezig:

- hash-only confirmation tokens;
- user-scoped graph memory en execution;
- expliciete bevestiging voor write-actions;
- beperkte orchestrationtraces.

Nog nodig:

- DPIA en verwerkingsregister;
- retention/deletion acceptance;
- export- en verwijderverzoeken;
- PII-review van providerpayloads en logging.

### Load — niet bewezen

Toegevoegd:

```text
npm run test:load-smoke
```

Configuratie:

```text
LOAD_TEST_BASE_URL
LOAD_TEST_PATH
LOAD_TEST_REQUESTS
LOAD_TEST_CONCURRENCY
LOAD_TEST_MAX_P95_MS
LOAD_TEST_MIN_SUCCESS_RATE
```

De test moet tegen staging worden uitgevoerd met productieachtige PostgreSQL,
providers en meerdere API-instances.

### Recovery — gedeeltelijk bewezen

Bewezen:

- volledige migratiereplay;
- persistente outbox en dead letters;
- lease-expiry recovery;
- soft archival.

Nog nodig:

- echte backup/restore drill;
- PITR-test;
- RPO/RTO-goedkeuring;
- multi-instance failover.

## Go-liveblokkades

1. volledige Playwright-suite groen in CI;
2. staging loadtest binnen afgesproken grenzen;
3. PostgreSQL restore drill;
4. live provideracceptatie;
5. privacy/DPIA sign-off.
