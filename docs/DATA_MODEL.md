# Door010 3.0 datamodel

## Migraties

- `0001_initial.sql`: minimale foundation voor gebruikers, profielen,
  gesprekken, berichten, audit en providerrecords.
- `0002_domain_schema.sql`: volledig domeinschema voor rollen, consent,
  slots, fase-engine, route-engine, kennis, opleidingen, events,
  vacatures, afspraken, prompts, providers en observability.

## Belangrijkste invarianten

1. Een persoonlijke fasewijziging ontstaat eerst als voorstel.
2. Een fasevoorstel krijgt een afzonderlijke bevestiging of afwijzing.
3. Iedere slotmutatie kan historisch worden herleid.
4. Algemene en persoonlijke AI-gesprekken hebben een expliciete botkey.
5. Adviseursgesprekken hebben geen botkey.
6. Externe data bewaart provider en extern ID.
7. Prompts en kennis zijn geversioneerd.
8. Object storage bewaart provider-neutrale object keys, geen vaste URLs.
9. AI-artifacts, bronnen en validatieresultaten zijn afzonderlijk te auditen.
10. Fase- en route-evaluaties bewaren de gebruikte engineversie.
