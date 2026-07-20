# Door010 3.4 — cross-encoder shadow mode en active learning

## A — provider-onafhankelijke cross-encoder

Nieuw contract:

```text
CrossEncoderReranker
```

Adapters:

```text
HttpCrossEncoderReranker
LocalConceptCrossEncoder
```

De HTTP-adapter accepteert een provider-onafhankelijk contract:

```json
{
  "model": "model-key",
  "query": "gebruikersvraag",
  "documents": [
    { "id": "uuid", "text": "titel en inhoud" }
  ]
}
```

Ondersteunde responses:

```json
{ "scores": [0.91, 0.42] }
```

of:

```json
{
  "data": [
    { "index": 0, "score": 0.91 }
  ]
}
```

Configuratie:

```text
CROSS_ENCODER_ENDPOINT
CROSS_ENCODER_API_KEY
CROSS_ENCODER_MODEL
CROSS_ENCODER_TIMEOUT_MS
```

## Shadow mode

`ShadowCrossEncoderKnowledgeSearch` laat de bestaande productieranking intact.

```text
bestaande learned RRF-ranking
→ antwoordpad blijft ongewijzigd
→ cross-encoder draait parallel in shadow mode
→ alternatieve volgorde wordt alleen opgeslagen
```

Nieuwe tabel:

```text
reranker_shadow_evaluations
```

Nieuwe beheerroute:

```text
GET /v1/backoffice/reranker-shadow
```

De opgeslagen query is uitsluitend een stabiele hash. De ruwe gebruikersvraag
wordt niet opgeslagen.

### Opslagduur

- `APP_STORAGE_MODE=memory` gebruikt `InMemoryShadowEvaluationRepository`.
  Evaluaties blijven alleen beschikbaar zolang het API-proces draait.
- `APP_STORAGE_MODE=postgres` gebruikt `PostgresShadowEvaluationRepository`
  en schrijft iedere voltooide of mislukte evaluatie duurzaam naar
  `reranker_shadow_evaluations`.

De API-bootstraptest maakt eerst een nulmeting, voert daarna via de persoonlijke
coach een echte kennisvraag uit en controleert uitsluitend het nieuw toegevoegde
shadowrecord, inclusief kandidaat-ID's. Zo kan een eerdere evaluatie van de
algemene coach deze assertion niet onterecht laten slagen.

Een afzonderlijke PGlite-test past de relevante productiemigraties toe, schrijft
via `PostgresShadowEvaluationRepository`, sluit de embedded PostgreSQL-database
en leest het record na heropening via een nieuwe repository-instantie terug.
Dit bewijst de SQL-wiring en opslag over database- en repository-instanties. Het
is geen bewijs van de configuratie of beschikbaarheid van een live
PostgreSQL-omgeving.

### Lokale shadowbenchmark

| Metric | Baseline | Shadow | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.8604 | 0.8664 | 0.006 |
| MRR@5 | 0.729 | 0.7305 | 0.0015 |
| nDCG@5 | 0.7559 | 0.7585 | 0.0026 |

```text
cases: 333
failures: 0
gemiddelde lokale latency: 0.19 ms
```

Deze meting gebruikt de lokale conceptadapter, niet een extern geleerd
cross-encodermodel. Een externe provider is in deze omgeving niet aangeroepen.

Commando:

```bash
npm run benchmark:shadow-reranker:check
```

## B — active learning

`ActiveLearningKnowledgeSearch` detecteert:

- onvoldoende kandidaten;
- een zeer lage topscore;
- een kleine genormaliseerde marge tussen de eerste twee resultaten.

Onzekere vragen worden naar een menselijke labelqueue gestuurd.

Nieuwe tabellen:

```text
retrieval_label_queue
retrieval_training_labels
```

Nieuwe beheerflows:

```text
GET  /v1/backoffice/retrieval-label-queue
POST /v1/backoffice/retrieval-label-queue/:id/claim
POST /v1/backoffice/retrieval-label-queue/:id/label
```

Een reviewer kan:

1. een item claimen;
2. relevante kandidaat-ID's selecteren;
3. irrelevante kandidaat-ID's selecteren;
4. een korte toelichting toevoegen;
5. het label als retraininginput opslaan.

Ook hier wordt standaard geen ruwe query opgeslagen. Alleen de queryhash,
kandidaat-ID's, titels, confidence en menselijke labels worden bewaard.

Configuratie:

```text
ACTIVE_LEARNING_MARGIN_THRESHOLD=0.12
```

Export van gelabelde data:

```bash
DATABASE_URL=... npm run active-learning:export
```

Output:

```text
reports/retrieval/active-learning-labels.json
```

## CI

Toegevoegd:

```text
benchmark:reranker:check
benchmark:shadow-reranker:check
```

De shadowgate controleert:

- minimaal 300 cases;
- maximaal 1% providerfailures;
- geen grotere regressie dan 0,01 op recall, MRR of nDCG.

De actieve-learningqueue heeft unitdekking voor deduplicatie, claimen en
menselijke labeling.

## Productievolgorde

```text
FTS + fuzzy + embeddings
→ RRF
→ learned linear reranker
→ cross-encoder shadow evaluation
→ active-learning uncertainty detection
→ conditionele LLM-reranking
→ antwoordpipeline
```

De cross-encoder beïnvloedt de productie-output nog niet. Promotie naar actieve
ranking vereist eerst echte providerresultaten, latencymetingen en een
positieve gegroepeerde holdoutmeting.
