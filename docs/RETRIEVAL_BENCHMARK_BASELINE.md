# Door010 3.0 v2.9 — retrievalbenchmark en FTS-baseline

## Dataset

Nieuwe benchmark:

```text
datasets/retrieval-benchmark.json
```

Omvang:

- 48 FAQ's;
- 191 gelabelde testvragen;
- vier querytypes:
  - exact;
  - alias;
  - paraphrase;
  - typo.

Iedere testvraag verwijst naar één of meer relevante FAQ-vragen. De runner
vertaalt deze labels naar de stabiele FAQ-ID's die ook door de ingestielaag
worden gebruikt.

## Runner

```text
scripts/evaluate-retrieval-baseline.mjs
```

Uitvoeren:

```bash
npm run benchmark:retrieval
```

De runner:

1. start een geïsoleerde PGlite PostgreSQL-instantie;
2. voert alle migraties uit;
3. importeert de 48 FAQ's;
4. gebruikt de echte Nederlandse PostgreSQL FTS-functie;
5. haalt maximaal tien resultaten per testvraag op;
6. berekent recall@k, MRR, nDCG@k en hit rate;
7. maakt een foutanalyse van alle misses bij k=5.

Rapporten:

```text
reports/retrieval/baseline.json
reports/retrieval/baseline.md
```

## Baseline

Totale scores:

| k | Recall@k | MRR | nDCG@k | Hit rate |
|---:|---:|---:|---:|---:|
| 1 | 0.5183 | 0.5183 | 0.5183 | 0.5183 |
| 3 | 0.5445 | 0.5305 | 0.5342 | 0.5445 |
| 5 | 0.555 | 0.5329 | 0.5384 | 0.555 |
| 10 | 0.555 | 0.5329 | 0.5384 | 0.555 |

Scores bij k=5:

| Querytype | Cases | Recall@5 | MRR | nDCG@5 |
|---|---:|---:|---:|---:|
| exact | 48 | 1 | 0.9861 | 0.9896 |
| alias | 47 | 0.9787 | 0.9032 | 0.9222 |
| paraphrase | 48 | 0.0208 | 0.0208 | 0.0208 |
| typo | 48 | 0.2292 | 0.2292 | 0.2292 |

## Conclusie

De meting bevestigt de eerdere hypothese:

- exacte FAQ-vragen worden vrijwel perfect gevonden;
- bekende aliases worden zeer goed gevonden;
- semantische herformuleringen worden bijna volledig gemist;
- spelfouten worden beperkt opgevangen.

De paraphrase recall@5 van
`0.0208`
is de sterkste onderbouwing voor embeddings naast FTS. De typo recall@5 van
`0.2292` laat daarnaast
zien dat fuzzy normalisatie of trigram retrieval waarschijnlijk nuttig is.

## CI-gate

```bash
npm run benchmark:retrieval:check
```

De gate bewaakt minimaal:

```text
overall recall@5 >= 0.54
overall MRR@5 >= 0.52
exact recall@5 >= 0.95
alias recall@5 >= 0.95
```

Deze grenzen liggen net onder de vastgelegde nulmeting. Ze voorkomen regressie,
maar doen niet alsof de huidige semantische recall al voldoende is.

De volgende implementatie moet dezelfde benchmark gebruiken en hogere
drempels introduceren nadat embeddings, scorefusion en typotolerantie
aantoonbare winst opleveren.
