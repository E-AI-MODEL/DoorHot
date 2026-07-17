# Door010 3.0 v0.8.1 — API-bootstrap en mutatiebevestiging

## Bootstrap

`createApplicationServices()` laadt bij het opstarten:

- Phase Detector-regels;
- Phase Detector-vragen;
- vier-, vijf- en negenfasenconfiguraties;
- routes;
- routevragen;
- routestappen;
- journeyfases.

Daarna worden de registry, detector, contextprovider en beide coaches
geïnstantieerd.

De datasetmap is instelbaar via:

```bash
DATASETS_DIRECTORY=/pad/naar/datasets
```

## Mutaties

Coachmutaties worden eerst als pending record geregistreerd.

Endpoints:

```text
GET  /v1/mutations/pending
POST /v1/mutations/confirm
```

Een mutatie wordt alleen toegepast na `decision: "accept"`.

Ondersteund:

- `profile-slot`;
- `phase-transition`.

Afwijzen bewaart de beslissing, maar wijzigt het profiel of de fase niet.

## Productieadapter

v0.8.1 gebruikt standaard in-memory stores voor lokaal draaien. De interfaces
zijn geschikt om de aanwezige PostgreSQL-repositories te injecteren zonder de
coach- of API-contracten te wijzigen.
