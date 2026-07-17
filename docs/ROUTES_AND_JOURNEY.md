# Door010 3.0 v0.4 — routes en klantreis

## Volledige routeketen

v0.4 bevat nu:

- routevragen;
- antwoordafhankelijkheden;
- routes;
- vereiste antwoord-ID's per route;
- geordende route-step-ID's;
- verrijkte routestapinhoud.

Matching:

```text
gekozen antwoord-ID's
→ alle required answer-ID's aanwezig
→ route match
→ stappen sorteren
→ stapinhoud verrijken
```

## Fasen

De twee fasemodellen zijn expliciet gescheiden:

- 5 detectorfases voor de persoonlijke chatbot;
- 9 journeyfases voor dashboard en langetermijnbegeleiding.

## Datakwaliteit

- Routes: 3378
- Journeyfases: 9
- Routevragen: 4
- Routeantwoorden: 56
- Routestappen: 66
- Ontbrekende antwoordreferenties: 1
- Ontbrekende stapreferenties: 0

Zie `docs/v0.4-data-report.json`.
