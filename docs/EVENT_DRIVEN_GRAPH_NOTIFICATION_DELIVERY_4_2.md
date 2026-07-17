# Door010 4.2 — event-driven graphcontext en notification delivery

## Event-driven graphupdates

Journey Engine 2.1 publiceert na iedere relevante mutatie een change-event via
`JourneyChangeListener`.

Ondersteunde mutaties:

```text
journey aanmaken of bijwerken
goal toevoegen
milestone bijwerken
blocker toevoegen of oplossen
action toevoegen of afronden
evidence toevoegen
decision vastleggen
```

`GraphMemoryJourneyChangeListener` synchroniseert daarna automatisch de
graphprojectie.

```text
Journey mutation
→ JourneyChangeListener
→ JourneyGraphMemoryService
→ memory_graph_nodes
→ memory_graph_edges
```

Handmatige graphsync blijft beschikbaar voor herstel en bestaande journeys.

## Automatische graphcontext in de persoonlijke coach

`PersonalJourneyCoach` accepteert nu een `PersonalGraphContextProvider`.

De coachcontext bevat:

```text
activeGoals
openBlockers
pendingActions
evidenceClaims
```

Wanneer een bestaande journey nog geen graphprojectie heeft, wordt die bij het
laden van de persoonlijke coach automatisch opgebouwd.

De deterministische fallbackcoach gebruikt de eerstvolgende actie en de
belangrijkste open blokkade in zijn antwoord. Live LLM-providers ontvangen
dezelfde gestructureerde graphcontext via `ChatContext`.

## Notification delivery worker

Nieuwe componenten:

```text
NotificationDeliveryProvider
InAppNotificationDeliveryProvider
HttpNotificationDeliveryProvider
NotificationDeliveryWorker
NotificationDeliveryScheduler
```

Flow:

```text
bevestigd execution request
→ notification_outbox
→ worker selecteert due items
→ channel provider
→ delivered of retry
```

### In-app

De in-app-provider is standaard actief. Afgeleverde meldingen zijn beschikbaar
via:

```text
GET /v1/notifications/:userId
```

### E-mail en webhook

Optionele HTTP-adapters:

```text
EMAIL_DELIVERY_ENDPOINT
EMAIL_DELIVERY_API_KEY
WEBHOOK_DELIVERY_ENDPOINT
WEBHOOK_DELIVERY_API_KEY
```

De provider ontvangt uitsluitend het outboxitem dat eerder expliciet door de
gebruiker is goedgekeurd.

### Workerconfiguratie

```text
NOTIFICATION_WORKER_INTERVAL_MS=30000
NOTIFICATION_DELIVERY_TIMEOUT_MS=10000
```

Handmatige beheertrigger:

```text
POST /v1/backoffice/notification-outbox/process
```

## Retrygedrag

- alleen due queued-items worden verwerkt;
- succesvolle levering wordt `delivered`;
- mislukte levering blijft queued zolang de maximale pogingengrens niet is
  bereikt;
- na maximaal vijf pogingen wordt het item `failed`;
- een ontbrekende provider wordt direct als configuratiefout vastgelegd;
- aflevering is idempotent via één outboxrecord per execution request.

## Grenzen

- Externe e-mail- en webhookproviders zijn niet live aangeroepen.
- In-app delivery markeert het outboxitem als geleverd; realtime push naar de
  browser volgt later.
- Graphupdates draaien momenteel synchroon na journey-mutaties.
- De negen Playwright-tests zijn ontdekt maar niet als volledige browserrun
  uitgevoerd.
