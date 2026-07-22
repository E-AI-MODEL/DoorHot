# Data- en runtime-pariteitsaudit (Blok 1)

> Read-only. Aantallen en SHA's zijn live berekend uit `datasets/`;
> formaat, contract, consumers en status zijn geverifieerd tegen de code.
> Gegenereerd door `npm run audit:data-parity`. Geen gedragswijziging.

Gegenereerd: 2026-07-22T14:01:01.474Z

## Matrix

| Dataset | SHA256 | Records | Formaat | In chat | Consumers | Bronlink | Status |
| --- | --- | ---: | --- | :---: | --- | --- | --- |
| `phase-detector-questions.json` | `938a13ef4d4c` | 654 | object: slots + slot_to_questions + phase_to_questions + catalogus | nee | persoonlijk, PhaseDetector | n.v.t. | Actief na contractfix (PR #22): slot/fase-verwijzingen worden genormaliseerd naar question_id en resolven in de catalogus. |
| `phase-detector-rules.json` | `43586fd65265` | 5 | object: phases[] met required/optional slots | nee | persoonlijk, PhaseDetector | n.v.t. | Actief: bepaalt vereiste/optionele slots per fase. |
| `phase-system-4.json` | `e751ab9b8d11` | 4 | object: phases[] | nee | persoonlijk, PhaseDetector | n.v.t. | Actief. |
| `phase-system-5.json` | `9fe1914ee18b` | 5 | object: phases[] | nee | persoonlijk, PhaseDetector | n.v.t. | Actief. |
| `phase-system-9.json` | `babc2634bba4` | 9 | object: phases[] | nee | persoonlijk, PhaseDetector | n.v.t. | Actief. |
| `journey-phases.json` | `40ea5a7d81cd` | 9 | array van fasedefinities | nee | persoonlijk | n.v.t. | Actief (journeycontext). |
| `routes.json` | `c0fec940bacf` | 3378 | array van routes met stap-/antwoordrelaties | nee | persoonlijk, RouteEngine | n.v.t. | Actief voor routebepaling. |
| `route-questions.json` | `bebc7a1237b4` | 4 | array van vragen met answers[] | nee | persoonlijk, RouteEngine | n.v.t. | Actief voor routebepaling. |
| `route-steps.json` | `5dc5cd633487` | 66 | array van stappen met faqs[]/articles[] | ja | algemeen, persoonlijk, RouteEngine, kennisbank | present (deels) | Geindexeerd in chatretrieval. INERT: de faqs/articles-CMS-verwijzingen op een routestap worden geladen maar niet geconsumeerd. |
| `faq-seed.json` | `f13d28f50d55` | 48 | object: { faqs: [...] } | ja | algemeen, persoonlijk, kennisbank, benchmark | present (source_url) | Geindexeerd in chatretrieval. Enige bron in de benchmark. LET OP: FAQ-records krijgen GEEN itemType (alleen category). |
| `regional-education-desks.json` | `e2c6be8ad42e` | 52 | array van loketten | ja | algemeen, persoonlijk, kennisbank | present (loket-URL) | Geindexeerd (itemType regional_desk). NIET in de benchmark. |
| `interest-talent-test.json` | `ab1e4d90a1dd` | 8 | object/array met vragen | nee | - | n.v.t. | Actief voor de talententest. |
| `retrieval-benchmark.json` | `30750e980068` | 333 | array van query/expected | nee | benchmark | n.v.t. | Alleen benchmark. Meet tegen FAQ-only, NIET tegen de volledige runtime-collectie (loketten + routestappen ontbreken). |
| `learned-reranker-model.json` | `234df5ff1ae4` | 10 | object: featureNames + weights | nee | algemeen, persoonlijk, kennisbank | n.v.t. | Actief. Titelfeatures getraind op canonieke titel; aliases niet in de vier titelfeatures. |
| `manifest.json` | `f2bdd1bf9ee6` | 2 | object: verwachte aantallen | nee | - | n.v.t. | Actief als verwachte-aantallen-manifest. |

### Contract, loader en tests per dataset

- **`phase-detector-questions.json`** — type: intake-vragen + catalogus; contract: RawPhaseQuestionDataset -> PhaseQuestionDataset (datasets.ts); loader: loadDomainDatasets (valideert + normaliseert); tests: phase-detector-real-dataset.test.ts (echte dataset).
- **`phase-detector-rules.json`** — type: fase-regels; contract: PhaseRulesDataset (datasets.ts); loader: loadDomainDatasets; tests: phase-engine.test.ts.
- **`phase-system-4.json`** — type: fasesysteem (4); contract: PhaseSystemDataset (datasets.ts); loader: loadDomainDatasets; tests: phase-systems.test.ts.
- **`phase-system-5.json`** — type: fasesysteem (5); contract: PhaseSystemDataset (datasets.ts); loader: loadDomainDatasets; tests: phase-systems.test.ts.
- **`phase-system-9.json`** — type: fasesysteem (9); contract: PhaseSystemDataset (datasets.ts); loader: loadDomainDatasets; tests: phase-systems.test.ts.
- **`journey-phases.json`** — type: journeyfasen; contract: JourneyPhaseDefinition[] (datasets.ts); loader: loadDomainDatasets; tests: journey-phases.test.ts.
- **`routes.json`** — type: routes; contract: RouteDefinition[] (datasets.ts); loader: loadDomainDatasets; tests: route-engine.test.ts.
- **`route-questions.json`** — type: routevragen + antwoorden; contract: RouteQuestionDefinition[] (datasets.ts); loader: loadDomainDatasets; tests: route-engine.test.ts.
- **`route-steps.json`** — type: routestappen; contract: RouteStepContentRecord[] (knowledge) + RouteStepDefinition (datasets.ts); loader: bootstrap.ts routeStepIngestion + loadDomainDatasets; tests: retrieval-trace-parity.test.ts (166 records).
- **`faq-seed.json`** — type: FAQ-kennisrecords; contract: FaqSeedDataset (knowledge); loader: bootstrap.ts knowledgeIngestion; tests: retrieval-trace-parity.test.ts.
- **`regional-education-desks.json`** — type: regionale loketten; contract: RegionalDeskRecord[] (knowledge); loader: bootstrap.ts regionalDeskIngestion; tests: retrieval-trace-parity.test.ts.
- **`interest-talent-test.json`** — type: talententest-vragen; contract: talent-test route; loader: apps/api talent-test; tests: parity-flows (e2e).
- **`retrieval-benchmark.json`** — type: benchmarkvragen; contract: benchmark-scripts; loader: evaluate-*; tests: benchmark-scripts.
- **`learned-reranker-model.json`** — type: reranker-gewichten; contract: LearnedRerankerModel (knowledge); loader: bootstrap.ts; tests: learned-reranker.test.ts.
- **`manifest.json`** — type: dataset-manifest; contract: verify-dataset-parity; loader: verify-dataset-parity.ts; tests: verify:datasets.

**Totaal geindexeerd in chatretrieval:** 166 records (route-steps=66, faq-seed=48, regional-education-desks=52).

## Categorisatie van de 654 Phase-Detector-items (niet gekopieerd)

De 654 items zijn geen 654 FAQ-antwoorden en worden niet als FAQ's
geimporteerd. Ze worden alleen naar hun runtime-rol gecategoriseerd:

- catalogus totaal: **654**
- gerefereerd door slots (intake/slotindicator): **441**
- gerefereerd door fasen (fase-indicator): **163**
- door beide: **101**
- alleen slot: **340**
- alleen fase: **62**
- door geen van beide gerefereerd (latente metadata/vraagvarianten): **151**

## Aanwezig vs. actief — bekende verbroken/onvolledige verbindingen

- **Benchmark ≠ runtime:** de benchmark meet alleen tegen `faq-seed.json`; loketten (52) en routestappen (66) zitten wel in de runtime-retrieval maar niet in de benchmark.
- **Routestap-CMS inert:** `faqs`/`articles` op een routestap worden geladen maar niet als kennis geconsumeerd (present maar inert).
- **FAQ zonder itemType:** de 48 FAQ-records dragen geen `itemType` (alleen `category`); bronlabeling kan nu niet op een `faq`-itemType leunen.
- **Reranker-aliases:** de vier titelfeatures gebruiken alleen de canonieke titel, niet de aliases.
- **Latente Phase-items:** 151 van de 654 catalogusitems worden door geen slot of fase gerefereerd (aanwezig, niet actief in vraagselectie).

## Reproduceerbare candidate-trace

Zie `npm run trace:chat` (via de echte runtime-pipeline uit `createApplicationServices().retrievalPipeline`). Voor "Hoeveel verdient een leraar?" staat het werktijdenrecord op #1 en het salarisrecord op #3; het no-LLM-pad toont blind #1. Vastgelegd in `apps/api/test/retrieval-trace-parity.test.ts`.
