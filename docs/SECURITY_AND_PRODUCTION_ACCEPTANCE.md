# Door010 3.0 v2.6 — security en productieacceptatie

## Security en autorisatie

Toegevoegd:

- eigendomscontrole voor `userId` en `candidateUserId`;
- kandidaataccounts kunnen geen gegevens van andere gebruikers wijzigen;
- `advisorUserId` moet overeenkomen met de ingelogde adviseur;
- backofficeroutes vereisen een adviseurs- of beheerdersrol;
- gespreksgeschiedenis en SSE-stream controleren deelnemerschap;
- securityheaders;
- configureerbare rate limiting;
- tests voor cross-user toegang.

Securityheaders:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'none'
```

Configuratie:

```text
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_DEFAULT=180
RATE_LIMIT_AUTH=20
```

## Dead-letterprivacy

Replaybodies worden standaard niet opgeslagen:

```text
DEAD_LETTER_STORE_BODY=false
```

Alleen wanneer dit bewust op `true` wordt gezet, wordt maximaal 200.000
tekens opgeslagen. Authorizationheaders en credentials worden nooit
opgeslagen.

Afgehandelde dead letters worden dagelijks automatisch verwijderd na:

```text
DEAD_LETTER_RETENTION_DAYS=30
```

## Productieacceptatiesuite

Nieuwe workflow:

```text
.github/workflows/acceptance.yml
```

De suite gebruikt:

- echte PostgreSQL 17;
- alle SQL-migraties via `psql`;
- twee PostgreSQL-verbindingen voor `LISTEN/NOTIFY`;
- lokale contractproviders voor LLM, vacatures, events en notificaties;
- Playwright-managed Chromium;
- alle negen browserflows;
- Playwright-traces en screenshots als CI-artifact.

Commando's:

```text
npm run acceptance:providers
npm run acceptance:realtime
npm run acceptance:browser
npm run acceptance:all
```

Lokale PostgreSQL:

```text
docker compose -f compose.acceptance.yaml up -d
ACCEPTANCE_DATABASE_URL=postgresql://door010:acceptance-password@127.0.0.1:55432/door010_acceptance npm run acceptance:realtime
```

## Lokale verificatie

De provideracceptatietest is lokaal geslaagd. De live PostgreSQL- en volledige
browseracceptatie zijn in deze uitvoeromgeving niet gestart omdat geen
bruikbare Docker/PostgreSQL- en Chromium-runtime beschikbaar was. De CI-suite
bevat deze echte uitvoerpaden.
