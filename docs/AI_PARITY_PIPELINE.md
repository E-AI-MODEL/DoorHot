# Door010 3.0 v2.8 — AI-paritypipeline

## Referentiearchitectuur

Deze release reconstrueert de onderscheidende chatpipeline uit de twee
Door010-repositories in portable packages. De Supabase Edge Function is niet
rechtstreeks als monoliet overgenomen. De onderdelen zijn opgesplitst in
interfaces, services, PostgreSQL-adapters en provideradapters.

## Pipeline

```text
bericht
→ intent routing
→ Nederlandse PostgreSQL FTS
→ maximaal 10 kandidaten
→ conditionele reranking naar 3 resultaten
→ actualiteits- en sparsitycontrole
→ trusted-source webfallback
→ expliciete bronhiërarchie
→ antwoordgeneratie
→ validate, sanitize en repair
→ pipeline-events
```

## A — intent, FTS en reranking

### Intent routing

Ondersteunde intents:

```text
greeting
question
exploration
followup
```

Wanneer een model beschikbaar is, wordt het snelle model gebruikt. Bij een
fout of ontbrekende configuratie wordt deterministisch teruggevallen op regex-
en lengteheuristieken.

### Nederlandse FTS

Migratie:

```text
migrations/0017_ai_parity_pipeline.sql
```

De zoekvector gebruikt:

- titel met gewicht A;
- antwoord/body met gewicht B;
- tags met gewicht B;
- categorie met gewicht C;
- Nederlandse taalconfiguratie;
- GIN-index;
- `plainto_tsquery('dutch', ...)`;
- `ts_rank`.

Omdat `array_to_string(tags, ...)` niet als immutable generated-columnexpressie
wordt geaccepteerd, wordt de gewogen vector betrouwbaar onderhouden met een
PostgreSQL-trigger.

### Conditionele reranking

De lexicale zoeklaag haalt maximaal tien kandidaten op. Wanneer de eerste en
derde score minder dan een factor twee verschillen, wordt de ranking als
onzeker beschouwd. Alleen dan selecteert een snel model drie kandidaten.

Bij modelproblemen blijft de oorspronkelijke lexicale top drie behouden.

## B — webfallback, bronhiërarchie en repair

### Adaptieve webfallback

Webretrieval wordt overwogen wanneer:

- minder dan twee interne resultaten beschikbaar zijn;
- de vraag tijdgevoelig is;
- een geselecteerde interne bron minstens twaalf maanden oud is.

Tijdgevoelige onderwerpen omvatten onder meer salaris, cao, collegegeld,
kosten, subsidie, vacatures, tekorten en expliciete jaartallen.

### Trusted sources

De actieve `trusted_sources.allowed_domains` bepalen welke domeinen gebruikt
mogen worden. Firecrawl-resultaten worden opnieuw op hostname gevalideerd,
opgeschoond en afgekapt voordat ze in de modelcontext komen.

Configuratie:

```text
FIRECRAWL_API_KEY
FIRECRAWL_API_URL
```

### Bronhiërarchie

```text
verse externe bron
> interne FAQ
> statische SSOT-kennis
```

Verse externe resultaten worden in de prompt expliciet als leidend bij
tegenspraak gemarkeerd.

### Generate–validate–repair

De antwoordcontrole detecteert:

- verboden interne termen;
- bracketlabels;
- em-dashes en en-dashes;
- een intentspecifieke overschrijding van het aantal zinnen.

Eerst wordt een lokale deterministische repair uitgevoerd. Wanneer verboden
termen een modelrepair vereisen en een model beschikbaar is, volgt een tweede
snelle modelcall. Daarna wordt het antwoord opnieuw gevalideerd.

## Observability

Nieuwe tabel:

```text
ai_pipeline_events
```

Nieuwe beheerroute:

```text
GET /v1/backoffice/ai-pipeline-events?limit=100
```

Events worden opgeslagen voor onder andere:

- intentselectie;
- reranking;
- retrievalbesluit;
- webfallbackreden;
- reflection en repair.

## Retrievalevaluatie

`evaluateRetrieval()` berekent:

- recall@k;
- mean reciprocal rank;
- nDCG@k.

De release bevat unitcases voor intentrouting, conditionele reranking,
tijdgevoelige webfallback, repair en retrievalmetrics.

## Grenzen

- Embeddings en vectorsearch zijn nog niet toegevoegd.
- De huidige `HybridKnowledgeSearch` gebruikt nog de bestaande
  token-overlapscore als semantische fallback.
- Firecrawl en de LLM-adapters zijn met mocks en contracten testbaar, maar
  echte providercredentials zijn niet in deze omgeving gebruikt.
- Inhoudelijke fact-checking door een onafhankelijk tweede model valt buiten
  deze release.
