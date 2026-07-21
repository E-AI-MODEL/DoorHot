# Data- en runtime-pariteitsaudit (Fase A)

> Read-only inventaris. Aantallen zijn live berekend uit `datasets/`;
> consumer, chatindexatie en status zijn geverifieerd tegen de code.
> Gegenereerd door `npm run audit:data-parity`.

Gegenereerd: 2026-07-21T23:19:19.683Z

| Dataset | Type | Records | In chatretrieval | Gebruikt door | Status |
| --- | --- | ---: | :---: | --- | --- |
| `phase-detector-questions.json` | intake-vragen + catalogus | 654 | nee | Persoonlijke coach (Phase Detector) | Actief na contractfix: slot/fase-verwijzingen worden genormaliseerd naar question_id en resolven in de catalogus. |
| `phase-detector-rules.json` | fase-regels | 5 | nee | Persoonlijke coach (Phase Detector) | Actief: bepaalt vereiste/optionele slots per fase. |
| `phase-system-4.json` | fasesysteem (4) | 4 | nee | Persoonlijke coach (fasesysteem) | Actief. |
| `phase-system-5.json` | fasesysteem (5) | 5 | nee | Persoonlijke coach (fasesysteem) | Actief. |
| `phase-system-9.json` | fasesysteem (9) | 9 | nee | Persoonlijke coach (fasesysteem) | Actief. |
| `journey-phases.json` | journeyfasen | 9 | nee | Persoonlijke coach (journeycontext) | Actief. |
| `routes.json` | routes | 3378 | nee | Persoonlijke coach (Route Engine) | Actief voor routebepaling. |
| `route-questions.json` | routevragen + antwoorden | 4 | nee | Persoonlijke coach (Route Engine) | Actief voor routebepaling. |
| `route-steps.json` | routestappen | 66 | ja | Beide coaches (kennisretrieval) + Route Engine | Geindexeerd in chatretrieval. LET OP: de faqs/articles-CMS-verwijzingen op een routestap worden nog niet geconsumeerd. |
| `faq-seed.json` | FAQ-kennisrecords | 48 | ja | Beide coaches (kennisretrieval) + benchmark | Geindexeerd in chatretrieval. Enige bron in de benchmark. |
| `regional-education-desks.json` | regionale loketten | 52 | ja | Beide coaches (kennisretrieval) | Geindexeerd in chatretrieval, maar NIET in de benchmark-collectie. |
| `interest-talent-test.json` | talententest-vragen | 8 | nee | Talententest | Actief voor de talententest. |
| `retrieval-benchmark.json` | benchmarkvragen | 333 | nee | Benchmark | Alleen benchmark. Meet tegen FAQ-only, niet tegen de volledige runtime-collectie (loketten + routestappen ontbreken). |
| `learned-reranker-model.json` | reranker-gewichten | 10 | nee | Kennisretrieval (reranking) | Actief. Titelfeatures getraind op canonieke titel; aliases niet in de vier titelfeatures. |
| `manifest.json` | dataset-manifest | 2 | nee | Pariteitscontrole | Actief als verwachte-aantallen-manifest. |

**Totaal geindexeerd in chatretrieval:** 166 records (route-steps=66, faq-seed=48, regional-education-desks=52).

## Bekende verbroken of onvolledige verbindingen

- **Benchmark ≠ runtime:** de benchmark meet alleen tegen `faq-seed.json`; loketten en routestappen zitten wel in de runtime-retrieval maar niet in de benchmark.
- **Routestap-CMS inert:** `faqs`/`articles` op een routestap worden geladen maar niet als kennis geconsumeerd.
- **Reranker-aliases:** de vier titelfeatures gebruiken alleen de canonieke titel, niet de aliases.
- **654 fasevragen:** worden als domeindataset gebruikt door de Phase Detector (na contractfix), niet als kennisrecords geindexeerd — dat is bewust, want lang niet alle items zijn antwoorden.
