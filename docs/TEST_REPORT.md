# Door010 3.0 v0.4.1 — validatierapport

- Geslaagd: 9/9
- Statische validatie: geslaagd

## Controles

- ✅ vereiste repositorystructuur
- ✅ alle JSON-bestanden zijn geldig
- ✅ datasettellingen kloppen
- ✅ alle niet-lege routereferenties bestaan
- ✅ routeslugs zijn uniek
- ✅ kritieke route-engine-invarianten aanwezig
- ✅ kritieke fase-engine-invarianten aanwezig
- ✅ route- en journey-migraties aanwezig
- ✅ golden tests zijn aanwezig

## Gerepareerd in v0.4.1

- Null-safe filtering van `route_answers_id`.
- Routes zonder minimaal één geldig vereist antwoord matchen niet.
- Regressietest voor een route met uitsluitend een null-relatie.

## Niet uitgevoerd

- `npm install`
- `npm run typecheck`
- `npm test`

Reden: geen internettoegang en geen vooraf geïnstalleerde dependencies.
