# Door010 hybrid retrieval benchmark

- Engine: PostgreSQL FTS + fuzzy + door010-local-semantic-v1 embeddings + RRF
- Testvragen: 333

## Vergelijking bij k=5

| Metric | FTS baseline | Hybrid | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.555 | 0.8604 | 0.3054 |
| MRR@5 | 0.5329 | 0.729 | 0.1961 |
| nDCG@5 | 0.5384 | 0.7559 | 0.2175 |

## Hybrid per querytype bij k=5

| Type | Recall@5 | MRR | nDCG@5 |
|---|---:|---:|---:|
| alias | 1 | 0.9468 | 0.9602 |
| conversational | 0.75 | 0.5285 | 0.5847 |
| exact | 1 | 0.9635 | 0.9728 |
| hard_negative | 0.7917 | 0.5813 | 0.6338 |
| multi_intent | 0.6458 | 0.6771 | 0.5873 |
| paraphrase | 0.75 | 0.5167 | 0.5741 |
| short | 0.8478 | 0.7536 | 0.7779 |
| typo | 0.9583 | 0.7701 | 0.8165 |

Gemiste vragen bij k=5: 41