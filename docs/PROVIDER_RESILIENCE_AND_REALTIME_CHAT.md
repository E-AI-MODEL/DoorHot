# Door010 3.0 v2.3 — providerresilience en realtime adviseurschat

## Providerresilience

Alle live HTTP-providers gebruiken nu `ResilientFetchClient`.

Ondersteund:

- maximaal aantal pogingen;
- exponentiële wachttijd;
- retry bij netwerkfouten, HTTP 408, 429 en 5xx;
- circuit breaker;
- half-open herstelpoging;
- dead-letteropslag na definitief falen.

Configuratie:

```text
PROVIDER_MAX_ATTEMPTS=3
PROVIDER_INITIAL_DELAY_MS=250
PROVIDER_FAILURE_THRESHOLD=5
PROVIDER_RESET_TIMEOUT_MS=30000
```

Dead letters worden in productie opgeslagen in:

```text
provider_dead_letters
```

Migratie:

```text
migrations/0016_provider_dead_letters.sql
```

Beheerders en superusers kunnen open records opvragen:

```text
GET /v1/backoffice/provider-dead-letters?limit=100
```

De payload bevat alleen URL en HTTP-methode. Providercredentials en
authorizationheaders worden niet opgeslagen.

## Realtime adviseurschat

Nieuwe beveiligde SSE-route:

```text
GET /v1/conversations/:conversationId/stream
```

De webclient opent de stream met de bestaande bearer-token en verwerkt nieuwe
berichten zonder handmatig vernieuwen. Zowel kandidaat- als adviseursberichten
worden na succesvolle opslag gepubliceerd.

De implementatie gebruikt een proceslokale eventbroker. Dit is correct voor de
huidige enkele API-container. Horizontale schaalvergroting vereist later een
gedeelde broker, bijvoorbeeld Redis Streams of PostgreSQL LISTEN/NOTIFY.

## CI-browsertests

Playwright heeft een afzonderlijke CI-job:

```text
verify → e2e → container
```

De E2E-job:

- installeert de vergrendelde npm-dependencies;
- installeert Playwright-managed Chromium met systeembibliotheken;
- gebruikt één worker voor reproduceerbaarheid;
- voert alle negen scenario's uit;
- blokkeert containerpublicatie bij een mislukte browsertest.

De lokale systeem-Chromium in deze uitvoeromgeving blijft onbruikbaar door
afgeschermde GPU-, D-Bus- en netlinkfuncties. Dat is een beperking van deze
container en niet hetzelfde browserpad als de CI-job.

## Providergrenzen

- Geen Supabase-SDK.
- Geen providerspecifieke SDK in domein- of flowpackages.
- Resilience zit rond de bestaande `FetchClient`-adapter.
- Domeinbeslissingen blijven deterministisch.
