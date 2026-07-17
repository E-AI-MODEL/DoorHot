# Door010 3.6 — connector runtime en domeinconnectors

## Runtime

De connectorlaag ondersteunt nu:

```text
environment secret resolution
→ fetch retries
→ normalization
→ diff en versioning
→ health tracking
→ process-local scheduling
→ backoffice dashboard
```

### Secretresolver

Connectorconfiguratie mag verwijzen naar een omgevingsvariabele:

```json
{
  "headers": {
    "Authorization": "env:DOMAIN_CONNECTOR_TOKEN"
  }
}
```

De waarde wordt uitsluitend vlak voor de fetch opgelost. Het secret wordt niet
naar connectorruns of knowledge-versies geschreven.

### Retries

Fetches gebruiken standaard:

```text
maximaal 3 pogingen
exponentiële backoff
250 ms basisvertraging
5 seconden maximumvertraging
```

Normalisatie- en validatiefouten worden niet stil genegeerd.

### Scheduler

Ondersteunde schemawaarden:

```text
every:15m
every:1h
every:24h
```

De scheduler draait process-local en registreert alleen ingeschakelde
connectors. Voor meerdere API-instances is later een database-lease of externe
scheduler nodig om dubbele runs te voorkomen.

## Connector health

Nieuwe API:

```text
GET /v1/backoffice/connectors/health
```

Het antwoord bevat:

- healthy, degraded, failing of never-run;
- laatste succes en fout;
- vijf recente runs;
- aantal actieve schedules.

De bestaande backoffice toont een connector-healthdashboard en biedt een knop
voor handmatige synchronisatie.

## Domeinconnectors

Standaardtemplates:

```text
education-catalog
subsidy-catalog
event-catalog
vacancy-catalog
```

Omgevingsvariabelen:

```text
EDUCATION_CONNECTOR_URL
SUBSIDY_CONNECTOR_URL
EVENT_CONNECTOR_URL
VACANCY_CONNECTOR_URL
CONNECTOR_AUTHORIZATION_SECRET
```

Wanneer een URL ontbreekt, wordt de betreffende template uitgeschakeld
aangemaakt.

### Opleidingen

Normaliseert onder meer:

```text
name/title
description/body
institution
level
tags
```

### Subsidies

Normaliseert:

```text
name/title
description/body
amount
audience
tags
```

### Events

Normaliseert:

```text
name/title
description/body
startsAt/startDate
location
sourceUrl
```

### Vacatures

Normaliseert:

```text
position/title
description/body
employer
region
expiresAt
sourceUrl
```

Alle domeinrecords worden opgenomen in de bestaande knowledge store,
embeddingindex en hybride retrievalpipeline.

## Grenzen

- Geen live externe domeinbron is in deze omgeving aangeroepen.
- De scheduler is nog niet distributed.
- Alleen JSON-array en `{ "items": [...] }` HTTP-responses worden ondersteund.
- Snapshot-gebaseerde verwijderdetectie is nog niet actief.
- Connectorauthenticatie ondersteunt headers via de secretresolver; OAuth
  refreshflows vallen buiten deze release.
