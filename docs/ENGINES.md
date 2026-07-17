# Fase- en route-engine

## Doel

De engine is deterministisch en provider-onafhankelijk.

## Fase-engine

Invoer:

- genormaliseerde profielslots;
- optioneel de huidige fase.

Uitvoer:

- gekozen fase;
- confidence;
- bewijs;
- ontbrekende slots;
- volgende vraag;
- scores van alle kandidaatfases.

Definitieve fasewijzigingen blijven buiten de engine en vereisen een
afzonderlijk bevestigingscommando.

## Route-engine

Invoer:

- beantwoorde routevragen;
- optionele gekoppelde opleidings-ID's.

Uitvoer:

- beschikbare onbeantwoorde vragen;
- gematchte routestappen;
- gegroepeerde routeaanbevelingen.

## Datasetparity

Voer uit:

```bash
npm run verify:datasets
npm test
```

Verwachte kernset:

- 654 detectorvragen;
- 9 slots;
- 5 fases;
- 4 routevragen;
- 66 routestappen;
- 48 FAQ's;
- 52 regionale loketten.

## Belangrijke datasetgrens

`route-questions.json` bevat de conditionele vraag- en antwoordboom.
`route-steps.json` bevat 66 inhoudelijke routebeschrijvingen.

In de aangeleverde repositories is geen expliciete relatie aangetroffen
tussen een combinatie van antwoord-ID's en één of meer route-step-ID's.
De v0.3-engine navigeert daarom de echte antwoordboom volledig, maar
verzint geen ontbrekende route-mapping.

De route-stepselectie wordt in een volgende fase aangesloten via:

1. een nog te vinden bronmapping;
2. een externe provider zoals Onderwijsloket/HOVI; of
3. een beheerde Door010-mappingstabel met golden tests.
