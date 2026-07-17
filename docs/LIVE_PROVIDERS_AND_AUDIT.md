# Door010 3.0 v2.1 — live providers en audittrail

## A — live provideradapters

Nieuwe package:

```text
packages/integrations
```

De productiebootstrap ondersteunt nu vier providercategorieën zonder een
providerspecifieke SDK in domein- of flowpackages.

### OpenAI-compatible LLM

```text
LLM_BASE_URL
LLM_API_KEY
LLM_MODEL
LLM_TIMEOUT_MS
```

De adapter gebruikt het OpenAI-compatible `/chat/completions`-contract.
Wanneer de variabelen ontbreken, blijft de deterministische answer provider
actief.

De goedgekeurde actieve systeemprompt wordt aan de live LLM-provider
doorgegeven. Fase-, route- en profielbeslissingen blijven deterministisch.

### Vacatures

```text
VACANCY_API_URL
VACANCY_API_KEY
```

Het endpoint mag een JSON-object met `vacancies` of `results` teruggeven.
Records worden naar het bestaande `Vacancy`-contract genormaliseerd en daarna
door de bestaande PostgreSQL-vacatureservice verwerkt.

### Evenementen

```text
EVENT_API_URL
EVENT_API_NAME
EVENT_API_KEY
```

Het endpoint mag een JSON-object met `events` of `results` teruggeven.
De adapter implementeert het bestaande `EventScraper`-contract.

### Notificaties

```text
NOTIFICATION_WEBHOOK_URL
NOTIFICATION_WEBHOOK_TOKEN
```

Nieuwe afspraken sturen na succesvolle opslag een providerneutrale
webhooknotificatie. Het veld `recipient` bevat het kandidaat-user-ID, zodat de
externe notificatieservice zelf het communicatiekanaal kan bepalen.

Een notificatiefout draait de opgeslagen afspraak niet terug. De API retourneert
daarom expliciet `notification.sent`.

### Capabilities

```text
GET /v1/system/capabilities
```

Dit endpoint toont welke live providers door omgevingsvariabelen zijn
geactiveerd.

## B — audittrail

Nieuwe package en migratie:

```text
packages/audit
migrations/0015_audit_events.sql
```

De audittrail bewaart:

- actor-user-ID;
- actie;
- doelsysteem en doel-ID;
- request-ID;
- IP-adres;
- user-agent;
- geredigeerde metadata;
- tijdstip.

Vastgelegde acties:

```text
profile.updated
profile.deleted
profile.file_uploaded
profile.note_created
profile.note_updated
profile.note_deleted
prompt.created
prompt.version_created
prompt.activated
backoffice.note_created
backoffice.appointment_created
```

Wachtwoorden, tokens, authorizationgegevens en base64-bestanden worden niet in
de auditmetadata opgeslagen.

Auditgegevens zijn alleen leesbaar voor `administrator` en `superuser`:

```text
GET /v1/backoffice/audit-events
```

Filters:

```text
actorUserId
action
targetType
limit
```

## Providergrenzen

- Geen Supabase-SDK-imports.
- Geen OpenAI-SDK-import in domein- of flowpackages.
- Alle live providers zitten achter bestaande interfaces.
- Lokale ontwikkeling blijft werken met deterministische, in-memory en noop
  adapters.
- Providerfouten veranderen geen fase- of routebeslissingen.
