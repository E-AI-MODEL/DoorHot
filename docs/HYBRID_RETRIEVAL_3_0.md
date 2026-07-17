# Door010 3.0 — hybrid retrieval

## Architectuur

```text
Nederlandse PostgreSQL FTS
+
portable trigram/fuzzy retrieval
+
embedding retrieval
→ reciprocal-rank fusion
→ bronautoriteit en actualiteit
→ conditionele reranking
→ antwoordpipeline
```

## Fuzzy retrieval

Migratie:

```text
migrations/0018_hybrid_fusion_retrieval.sql
```

Toegevoegd:

- genormaliseerde zoektekst;
- trigramarrays;
- GIN-index;
- portable trigram-similarity;
- `search_knowledge_fuzzy(...)`;
- memory- en PostgreSQL-adapters.

Er is bewust geen harde afhankelijkheid van `pg_trgm`. Daardoor blijft de
migratie uitvoerbaar in standaard PostgreSQL en PGlite.

## Embeddings

Contract:

```text
EmbeddingProvider
KnowledgeEmbeddingRepository
```

Implementaties:

- `LocalSemanticEmbeddingProvider`;
- `OpenAiEmbeddingProvider`;
- `InMemoryKnowledgeEmbeddingRepository`;
- `PostgresKnowledgeEmbeddingRepository`.

De lokale provider is een deterministische semantische feature-hash voor
development, tests en providerloze fallback. Het is geen geleerd
transformermodel.

Productie kan een OpenAI-compatible embeddingendpoint gebruiken:

```text
EMBEDDING_BASE_URL
EMBEDDING_API_KEY
EMBEDDING_MODEL
EMBEDDING_DIMENSIONS
EMBEDDING_TIMEOUT_MS
```

Embeddings worden opgeslagen in `knowledge_embeddings` als portable
`double precision[]`. De database berekent cosine similarity via
`door010_cosine_similarity(...)`.

## Reciprocal-rank fusion

`ReciprocalRankFusionKnowledgeSearch` haalt kandidaten op uit:

1. FTS;
2. fuzzy retrieval;
3. embedding retrieval.

De rankings worden samengevoegd met reciprocal-rank fusion met
`k = 60`. Daarna worden bronautoriteit en actualiteit als kleine,
deterministische tie-breakers toegepast.

## Benchmark

Testvragen:

```text
191
```

Vergelijking bij k=5:

| Metric | FTS | Hybrid | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.555 | 0.8901 | 0.3351 |
| MRR@5 | 0.5329 | 0.762 | 0.2291 |
| nDCG@5 | 0.5384 | 0.7939 | 0.2555 |

Per querytype bij k=5:

| Type | Recall@5 | MRR | nDCG@5 |
|---|---:|---:|---:|
| Exact | 1 | 0.9531 | 0.9651 |
| Alias | 0.9787 | 0.9149 | 0.9311 |
| Paraphrase | 0.7292 | 0.4847 | 0.5452 |
| Typo | 0.8542 | 0.6983 | 0.737 |

Misses bij k=5 daalden van 85 naar 21.

## CI-gate

```bash
npm run benchmark:hybrid:check
```

Standaardgrenzen:

```text
overall recall@5 >= 0.72
overall MRR@5 >= 0.65
paraphrase recall@5 >= 0.45
typo recall@5 >= 0.65
```

De gewone CI-workflow gebruikt nu deze hybrid gate.

## Grenzen

- De benchmark gebruikt de lokale deterministische embeddingprovider.
- De winst van een echte embeddingprovider moet opnieuw met dezelfde dataset
  worden gemeten.
- De portable arrayopslag is geschikt voor de huidige compacte FAQ-collectie,
  maar voor grote corpora is pgvector of een externe vectorindex efficiënter.
- Reranking en trusted-webfallback blijven bovenop deze retrievallaag actief.
