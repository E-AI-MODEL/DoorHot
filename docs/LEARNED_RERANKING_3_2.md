# Door010 3.2 — learned reranking

## Doel

De resterende retrievalfouten zijn niet meer hoofdzakelijk exacte zoek- of
spelfouten. Ze bestaan vooral uit impliciete routekeuzes en semantische
herformuleringen. Daarom is een getrainde reranker toegevoegd bovenop:

```text
FTS + fuzzy + embeddings + RRF
```

## Model

Nieuwe runtimecomponenten:

```text
LearnedRerankerModel
LearnedLinearKnowledgeReranker
LearnedRerankedKnowledgeSearch
```

Modelartifact:

```text
datasets/learned-reranker-model.json
```

Het model is een pointwise logistisch lineair model met tien features:

```text
reciprocal rank
RRF-score
titel-tokenoverlap
body-tokenoverlap
tag-tokenoverlap
titel-trigramoverlap
domeinconceptoverlap
exacte titelmatch
lengteverhouding
kanaalindicator
```

De modeloutput herordent alleen bestaande kandidaten. Wanneer geen geldig model
kan worden geladen, kan de onderliggende RRF-zoeklaag zelfstandig blijven
werken.

## Training en evaluatie

Commando:

```bash
npm run benchmark:learned-reranker
```

De 191 gelabelde queries worden via een stabiele hash verdeeld:

```text
80% training
20% holdout
```

Er wordt dus niet op dezelfde queries getraind en gerapporteerd.

Resultaten:

| Split | Queries | Recall@5 | MRR | nDCG@5 |
|---|---:|---:|---:|---:|
| Training | 148 | 0.9189 | 0.8439 | 0.8629 |
| Holdout | 43 | 0.9302 | 0.8961 | 0.9043 |

De holdout-MRR van 0.8961 laat zien dat
relevante kandidaten vaker hoger in de resultatenlijst komen.

## Miss-analyse

De 14 resterende misses vallen vooral in:

- impliciete zij-instroomroute;
- routevergelijking zonder expliciete terminologie;
- ontbrekende relatie tussen vraag en formele route;
- bredere domeinparafrase;
- twee resterende orthografische varianten.

Deze categorieën worden nu als aparte trainingssignalen vastgelegd in plaats
van steeds meer handmatige uitzonderingen aan de productielogica toe te voegen.

## Runtime

Zowel memory- als PostgreSQL-bootstrap laden:

```text
datasets/learned-reranker-model.json
```

De runtimevolgorde is nu:

```text
FTS
+ fuzzy
+ embeddings
→ RRF
→ learned linear reranking
→ conditionele LLM-reranking
→ antwoordpipeline
```

De learned reranker vervangt de LLM-reranker niet. Hij verbetert goedkoop en
deterministisch de eerste kandidaatvolgorde. De LLM-reranker blijft alleen
nodig bij onzekere topresultaten.

## Grenzen

- Het model is getraind op 191 gelabelde queries; dit is bruikbaar maar nog
  klein.
- Het model is pointwise, geen LambdaMART of cross-encoder.
- Recall kan alleen verbeteren wanneer de relevante FAQ al in de kandidaatset
  voorkomt.
- Nieuwe FAQ's en nieuwe querytypen vereisen periodieke hertraining.
