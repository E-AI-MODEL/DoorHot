# Door010 3.0 v2.4 — PostgreSQL realtime en providerdashboard

## A — PostgreSQL LISTEN/NOTIFY

Nieuwe package:

```text
packages/realtime
```

Contract:

```text
RealtimeBroker
├── publish(channel, payload)
├── subscribe(channel, handler)
└── close()
```

Implementaties:

- `InMemoryRealtimeBroker` voor lokale ontwikkeling en tests;
- `PostgresRealtimeBroker` voor productie.

De productie-implementatie gebruikt twee afzonderlijke PostgreSQL-clients:

- één client voor `pg_notify`;
- één permanente client voor `LISTEN` en `UNLISTEN`.

Kandidaat- en adviseursberichten worden pas gepubliceerd nadat het bericht
succesvol persistent is opgeslagen. Iedere API-instance kan dezelfde
conversatiekanalen beluisteren, waardoor realtime chat horizontaal schaalbaar
is zonder proceslokale eventbroker.

SSE blijft het browsertransport:

```text
GET /v1/conversations/:conversationId/stream
```

De broker gebruikt kanalen in het formaat:

```text
conversation:<uuid>
```

## B — providerstatusdashboard

Nieuwe beheerroute:

```text
GET /v1/backoffice/provider-status
```

De bestaande dead-letterroute blijft:

```text
GET /v1/backoffice/provider-dead-letters
```

Beide routes vereisen `administrator` of `superuser`.

Per provider wordt getoond:

- geconfigureerd of niet geconfigureerd;
- circuit state: `closed`, `open` of `half-open`;
- actuele foutenteller;
- laatste succesvolle aanvraag;
- laatste mislukte aanvraag.

Het backofficedashboard toont daarnaast de open dead letters met:

- provider;
- operatie;
- foutmelding;
- aantal pogingen;
- geredigeerde payload;
- tijdstip.

## Grenzen

- Geen providercredentials in statusresponses of dead letters.
- Geen Supabase-SDK-imports.
- Realtime transport blijft achter een eigen adapter.
- Businesslogica is niet naar de frontend verplaatst.
- De PostgreSQL-broker vereist een echte PostgreSQL-server; PGlite valideert
  migraties maar simuleert geen volledige LISTEN/NOTIFY-integratietest.
