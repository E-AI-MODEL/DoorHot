# Door010 3.1 — externe embeddingvalidatie en miss-analyse

## A — echte embeddingprovider

Nieuwe benchmarkmodus:

```bash
EMBEDDING_PROVIDER=external \
EMBEDDING_BASE_URL=https://api.example.com/v1 \
EMBEDDING_API_KEY=... \
EMBEDDING_MODEL=text-embedding-model \
EMBEDDING_DIMENSIONS=1536 \
npm run benchmark:embeddings:external
```

Vergelijkingsrun:

```bash
npm run benchmark:embeddings:compare
```

Output:

```text
reports/retrieval/external.json
reports/retrieval/external.md
```

De runner gebruikt dezelfde 191 gelabelde vragen, dezelfde FTS- en fuzzykanalen,
dezelfde RRF-configuratie en dezelfde metrics als de lokale benchmark.

In deze build zijn geen externe embeddingcredentials beschikbaar gesteld.
Daarom is de externe providerpad volledig geïmplementeerd maar niet werkelijk
tegen een commerciële of externe embeddingservice uitgevoerd.

## B — resterende misses

De 21 misses uit v3.0 zijn geclassificeerd in:

- orthografie en samengestelde woorden;
- onderspecificeerde volgende-stapvragen;
- impliciete routemapping;
- domeinsynoniemen;
- algemene semantische paraphrases.

Rapport:

```text
reports/retrieval/miss-analysis-v3.0.json
```

Gerichte verbeteringen:

- normalisatie van veelvoorkomende Nederlandse typefouten;
- normalisatie van samengestelde onderwijswoorden;
- extra conceptclusters voor volgende stappen;
- extra conceptclusters voor werkweek en extra beloning;
- expliciete koppelingen tussen deeltijd, werken-leren en zij-instroom;
- expliciete koppeling tussen mbo zonder lerarenopleiding en PDG;
- uitgebreidere arbeidsmarkt- en schoolvaktermen.

## Nieuwe lokale benchmark

| Metric | v3.0 | v3.1 | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.8901 | 0.9267 | 0.0366 |
| MRR@5 | 0.7620 | 0.7985 | 0.0365 |
| nDCG@5 | 0.7939 | 0.8302 | 0.0363 |

Per querytype bij k=5:

| Type | Recall@5 |
|---|---:|
| Exact | 1 |
| Alias | 1 |
| Paraphrase | 0.75 |
| Typo | 0.9583 |

Misses daalden van 21 naar 14.

## Nieuwe CI-drempels

```text
overall recall@5 >= 0.90
overall MRR@5 >= 0.76
paraphrase recall@5 >= 0.70
typo recall@5 >= 0.90
```
