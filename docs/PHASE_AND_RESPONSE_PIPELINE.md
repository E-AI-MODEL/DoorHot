# Door010 3.0 v0.5 — Phase Detector en response pipeline

## Phase Detector

De detector gebruikt de regels en vraagmapping als single source of truth.

Het model mag uitsluitend voorstellen:

- fase;
- confidence;
- evidence;
- next slot key.

De uiteindelijke vraag-ID en vraagtekst komen altijd uit de vraagdataset.

Fallbackbeleid:

1. modelvoorstellen onder confidence `0.45` worden niet leidend;
2. een onbekende next-slot-key wordt afgewezen;
3. ontbrekende required slots hebben voorrang;
4. daarna volgt een optional slot;
5. daarna een fasevraag;
6. als laatste een globale SSOT-vraag.

## Response pipeline

De gedeelde pipeline ondersteunt:

- `direct`;
- `clarify_batch`;
- `source_check`;
- `handoff`.

Antwoordtypes:

- reproductie;
- wegwijs;
- verkenning;
- empathisch_steunend;
- bronplichtig;
- handoff_mens.

Alleen `supportingDetail` mag inklapbaar zijn. `directAnswer` blijft altijd
zichtbaar.

## Nieuwe package

`packages/response-pipeline`

## Database

Migratie:

`migrations/0004_response_pipeline.sql`
