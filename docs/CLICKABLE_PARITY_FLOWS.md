# Door010 3.0 v2.2 — klikbare parityflows 4 tot en met 10

## Nieuwe frontendflows

### Persoonlijke coach en fasebevestiging

De persoonlijke chat toont pending profiel- en fasewijzigingen als expliciete
bevestigingskaarten. De gebruiker kan iedere mutatie accepteren of weigeren via
de bestaande mutation-confirmation API.

### Routeverkenning

De frontend doorloopt conditioneel de routevragen en toont daarna:

- de best passende route;
- geordende routestappen;
- eventuele doorlooptijd;
- een optie om opnieuw te beginnen.

De browser bevat geen eigen matchlogica.

### Interesse- en talententest

Alle vragen worden uit de API geladen. Na afronding worden de beste sector en
de rangschikking getoond. De scoreberekening blijft in de backend.

### Menselijke adviseurschat

Kandidaten en adviseurs kunnen berichten in hetzelfde gesprek opslaan.
Berichten van de adviseur worden visueel onderscheiden van kandidaat- en
AI-berichten.

### Evenementen

De evenementenpagina ondersteunt:

- cached events laden;
- handmatig vernieuwen;
- bron en datum tonen;
- externe detailpagina openen;
- evenement opslaan voor een ingelogde gebruiker.

### Vacatures

De vacaturepagina ondersteunt:

- zoeken;
- organisatie, sector en locatie tonen;
- externe vacature openen;
- vacature opslaan.

## API-uitbreiding

```text
POST /v1/chat/candidate
```

Deze route voegt kandidaatberichten aan de bestaande menselijke
adviseursconversatie toe.

## Paritystand

De tien gereconstrueerde gebruikersflows hebben nu allemaal een klikbare
frontend- of backoffice-ingang. Overblijvende productiewerkzaamheden zijn
voornamelijk:

- live provideracceptatietests;
- realtime transport voor menselijke chat;
- retry-, circuit-breaker- en dead-letterafhandeling;
- verdere toegankelijkheids- en gebruikerstests;
- volledige Playwright-uitvoering in CI.

## Verificatie

Succesvol uitgevoerd:

```text
npm install --ignore-scripts
npm run typecheck
chat: 7 bestanden / 9 tests
parity-flows: 6 bestanden / 7 tests
API: 1 bestand / 1 test
npm run build
15/15 migraties
npm audit: 0 kwetsbaarheden
Playwright discovery: 9 tests in 2 bestanden
```

Een volledige lokale `npm test`-aggregatierun overschreed de maximale
uitvoeringstijd van deze omgeving. De gewijzigde packages en de belangrijkste
afhankelijke domeinpackages zijn afzonderlijk gecontroleerd.
