# Door010 hybrid retrieval benchmark

- Engine: PostgreSQL FTS + fuzzy + door010-local-semantic-v2 embeddings + RRF
- Testvragen: 333

## Vergelijking bij k=5

| Metric | FTS baseline | Hybrid | Delta |
|---|---:|---:|---:|
| Recall@5 | 0.3844 | 0.9039 | 0.5195 |
| MRR@5 | 0.3717 | 0.7794 | 0.4077 |
| nDCG@5 | 0.3749 | 0.8047 | 0.4298 |

## Hybrid per querytype bij k=5

| Type | Recall@5 | MRR | nDCG@5 |
|---|---:|---:|---:|
| alias | 0.9787 | 0.9468 | 0.9552 |
| conversational | 0.8542 | 0.5948 | 0.6593 |
| exact | 1 | 0.9757 | 0.9819 |
| hard_negative | 0.9167 | 0.6611 | 0.7251 |
| multi_intent | 0.7917 | 0.8021 | 0.7158 |
| paraphrase | 0.75 | 0.541 | 0.5928 |
| short | 0.9348 | 0.8279 | 0.8554 |
| typo | 0.9583 | 0.8438 | 0.8733 |

Gemiste vragen bij k=5: 28