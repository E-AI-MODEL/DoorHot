# Door010 hybrid retrieval benchmark

- Engine: PostgreSQL FTS + fuzzy + door010-local-semantic-v2 embeddings + RRF
- Testvragen: 333

## Vergelijking bij k=5

| Metric | FTS baseline | Hybrid | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.3844 | 0.97 | 0.5856 |
| MRR@5 | 0.3717 | 0.8707 | 0.499 |
| nDCG@5 | 0.3749 | 0.8912 | 0.5163 |

## Hybrid per querytype bij k=5

| Type | Recall@5 | MRR | nDCG@5 |
|---|---:|---:|---:|
| alias | 0.9787 | 0.9362 | 0.9473 |
| conversational | 0.9375 | 0.7052 | 0.7631 |
| exact | 1 | 0.9792 | 0.9846 |
| hard_negative | 0.9583 | 0.6979 | 0.7645 |
| multi_intent | 0.875 | 0.8646 | 0.8024 |
| paraphrase | 0.9583 | 0.8212 | 0.8559 |
| short | 1 | 0.942 | 0.957 |
| typo | 1 | 0.934 | 0.9511 |

Gemiste vragen bij k=5: 7