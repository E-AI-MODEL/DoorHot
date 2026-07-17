# Door010 3.5 — capability architecture en knowledge connectors

## Capability architecture

Door010 is nu expliciet ingedeeld in negen capabilities:

```text
Identity
Knowledge
Journey
Reasoning
Conversation
Planning
Execution
Learning
Observability
```

De capability-indeling verandert bestaande packages niet onnodig, maar legt
stabiele grenzen vast voor verdere ontwikkeling.

Manifest:

```text
docs/capability-manifest.json
```

## Knowledge connector framework

Nieuwe contracten:

```text
KnowledgeConnector
ConnectorRepository
KnowledgeConnectorService
NormalizedKnowledgeEntity
ConnectorDefinition
ConnectorRun
```

Ondersteunde entitytypen:

```text
faq
route
education
subsidy
event
vacancy
organization
authority
cao
generic
```

Eerste connectoren:

```text
JsonKnowledgeConnector
CsvKnowledgeConnector
HttpJsonKnowledgeConnector
```

Pipeline:

```text
fetch
→ validate
→ normalize
→ content hash
→ diff
→ version
→ knowledge store
→ embedding index
→ health and run metrics
```

## Versies en diff

Nieuwe tabellen:

```text
knowledge_connectors
knowledge_connector_runs
knowledge_source_versions
```

De ingestservice telt:

- fetched;
- normalized;
- inserted;
- updated;
- unchanged;
- removed;
- failed.

Ongewijzigde records worden niet opnieuw geschreven of geïndexeerd.

## Backoffice API

```text
GET  /v1/backoffice/connectors
POST /v1/backoffice/connectors
GET  /v1/backoffice/connectors/runs
POST /v1/backoffice/connectors/:connectorKey/sync
```

Connectorconfiguraties kunnen worden ingeschakeld, uitgeschakeld en handmatig
gesynchroniseerd. De bestaande backoffice-autorisatie blijft van toepassing.

## Grenzen

- Cronplanning is als configuratieveld voorbereid, maar nog niet gekoppeld aan
  een distributed scheduler.
- HTTP-connectors ondersteunen JSON-arrays en `{ "items": [...] }`.
- Authenticatieheaders kunnen in configuratie staan; productie hoort secrets
  via een secretresolver te injecteren in plaats van ze op te slaan.
- Verwijderdetectie is voorbereid in de runstatistiek, maar wordt pas actief
  zodra connectors een volledige snapshotgarantie aangeven.
