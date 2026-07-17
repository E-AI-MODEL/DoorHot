# Door010 3.3 — uitgebreide benchmark, calibratie en driftcontrole

## Uitgebreide dataset

De retrievalbenchmark is uitgebreid van 191 naar
333 gelabelde queries.

Querytypen:

```text
alias
conversational
exact
hard_negative
multi_intent
paraphrase
short
typo
```

Toegevoegd:

- 48 korte zoekvragen;
- 48 conversationele vragen;
- 24 multi-intentvragen;
- 24 hard-negativevragen;
- expliciete distractorlabels;
- semantische `groupId` per informatiebehoefte.

De hard-negativevragen bevatten doelbewust een verwant, maar onjuist antwoord.
Daardoor leert de reranker onderscheid maken tussen bijvoorbeeld:

```text
zij-instroomkosten
versus
regulier collegegeld
```

en:

```text
PDG voor mbo
versus
lesgeven in het hoger onderwijs
```

## Leakagebestendige splitsing

Varianten van dezelfde informatiebehoefte worden niet meer willekeurig over
training en evaluatie verdeeld.

Splitsing:

```text
70% training
15% validation
15% holdout
```

Alle queries met dezelfde `groupId` blijven in dezelfde partitie.

Dit voorkomt dat een exacte vraag in training staat terwijl een bijna gelijke
parafrase van dezelfde FAQ als holdout wordt gerapporteerd.

## Hybrid retrieval op de grotere dataset

De grotere benchmark is bewust moeilijker dan de v3.1-set.

| Metric | Waarde |
|---|---:|
| Queries | 333 |
| Hybrid recall@5 | 0.8604 |
| Hybrid MRR@5 | 0.729 |
| Hybrid nDCG@5 | 0.7559 |

Recall@5 per querytype:

| Type | Recall@5 |
|---|---:|
| alias | 1 |
| conversational | 0.75 |
| exact | 1 |
| hard_negative | 0.7917 |
| multi_intent | 0.6458 |
| paraphrase | 0.75 |
| short | 0.8478 |
| typo | 0.9583 |

Multi-intent en hard-negativevragen zijn aantoonbaar moeilijker dan exacte,
alias- en typovragen. Dat is gewenst: de benchmark meet nu meer dan alleen
woordoverlap.

## Learned reranker

Training:

| Split | Cases | Recall@5 | MRR | nDCG@5 | Brier |
|---|---:|---:|---:|---:|---:|
| Train | 242 | 0.8822 | 0.8064 | 0.8215 | 0.21 |
| Validation | 46 | 0.9348 | 0.8569 | 0.8766 | 0.1584 |
| Holdout | 45 | 0.9222 | 0.8407 | 0.8544 | 0.178 |

Early stopping gebruikt validation log loss. Het model met de laagste
validation loss wordt als artifact opgeslagen.

## Calibratie

De benchmark rapporteert nu ook de Brier-score. Die meet hoe goed de
relevantiescore overeenkomt met de werkelijke labels.

De holdout Brier-score is:

```text
0.178
```

Een lagere waarde is beter.

## Drift- en regressiegate

Nieuw commando:

```bash
npm run benchmark:reranker:check
```

De gate controleert:

```text
minimaal 300 benchmarkqueries
holdout recall@5 >= 0.88
holdout MRR >= 0.78
holdout nDCG@5 >= 0.80
holdout Brier <= 0.22
validation/holdout recallverschil <= 0.08
alle acht querytypen aanwezig
alle cases hebben een groupId
```

De gewone CI-workflow gebruikt nu deze gate.

## Volgende technische stap

De dataset is nu groot en gevarieerd genoeg om verantwoord te vergelijken met:

1. een pairwise model zoals LambdaMART;
2. een compacte cross-encoder voor alleen de top 10;
3. active learning op lage-confidencevragen;
4. productiefeedback met expliciete privacygrenzen.

Een complexer model mag alleen worden behouden wanneer de gegroepeerde holdout
aantoonbaar verbetert.
