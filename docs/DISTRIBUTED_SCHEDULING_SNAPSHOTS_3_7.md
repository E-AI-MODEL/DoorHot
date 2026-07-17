# Door010 3.7 — distributed scheduling en snapshotverwijdering

## Distributed scheduling

Nieuwe componenten:

```text
ConnectorLeaseRepository
InMemoryConnectorLeaseRepository
PostgresConnectorLeaseRepository
DistributedConnectorScheduler
```

Werking:

```text
scheduled trigger
→ database lease proberen
→ alleen leasehouder synchroniseert
→ heartbeat verlengt lease
→ run afronden
→ lease vrijgeven
```

Verlopen leases kunnen door een andere API-instance worden overgenomen.

Configuratie:

```text
CONNECTOR_SCHEDULER_OWNER_ID
CONNECTOR_LEASE_DURATION_MS=300000
```

Nieuwe tabel:

```text
knowledge_connector_leases
```

## Snapshotverwijdering

Connectors kunnen `snapshotMode: true` gebruiken.

Bij een volledige snapshot:

1. alle ontvangen external IDs worden geregistreerd;
2. actieve IDs uit de vorige snapshot worden opgehaald;
3. ontbrekende IDs worden gedeactiveerd;
4. het bijbehorende knowledge-item krijgt `review_status = archived`;
5. de connectorrun verhoogt `removedCount`.

Er wordt niet hard verwijderd. Daardoor blijven auditbaarheid en herstel
mogelijk.

De vier standaard domeinconnectors gebruiken snapshotmodus.

## Veiligheid

- Leases hebben een eigenaar, heartbeat en vervaltijd.
- Een tweede eigenaar kan een geldige lease niet overnemen.
- Een verlopen lease kan worden hersteld.
- Handmatige synchronisatie blijft mogelijk.
- Gearchiveerde records verdwijnen uit approved-only retrieval.
- Historische bronversies blijven bewaard.

## Grenzen

- De scheduler gebruikt databaseleases maar geen externe jobqueue.
- Een procescrash wordt hersteld zodra de lease verloopt.
- Snapshotmodus mag alleen worden gebruikt voor bronnen die werkelijk een
  volledige dataset leveren.
- Live externe bronnen zijn niet nodig geweest voor deze release.
