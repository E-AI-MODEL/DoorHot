# Door010 3.0 v1.0 — parityflows 5 tot en met 9

Deze release hergebruikt bestaande Door010-code en datasets waar mogelijk.

## 5. Route bepalen

- hergebruikt de bestaande `RouteEngine`;
- conditionele vragen;
- alleen zichtbare/toegestane antwoorden worden geaccepteerd;
- sessies bewaren geselecteerde antwoord-ID's;
- eindresultaat bevat de beste route en geordende stappen.

API:

```text
POST /v1/routes/sessions
POST /v1/routes/sessions/:sessionId/answers
GET  /v1/routes/sessions/:sessionId
```

## 6. Fase bepalen

- hergebruikt `AdaptivePhaseDetector`;
- ondersteunt 4, 5 en 9 fasen;
- bewaart evaluaties als snapshots;
- backoffice-debugfeed beschikbaar.

API:

```text
POST /v1/phases/evaluate
GET  /v1/backoffice/detector-snapshots
```

## 7. Interesse- en talententest

De acht vragen en sectorwegingen zijn overgenomen uit de bestaande
`InterestTest`-implementatie.

API:

```text
GET  /v1/talent-test/questions
POST /v1/talent-test/submit
GET  /v1/talent-test/results/:userId
```

## 8. Adviseursbackoffice

- kandidatenoverzicht;
- interne adviseursnotities;
- afspraken met begin, einde en tijdzone;
- detector-debugdata;
- bestaande adviseurschat uit v0.9 blijft behouden.

API:

```text
GET  /v1/backoffice/candidates
POST /v1/backoffice/candidates/:candidateUserId/notes
GET  /v1/backoffice/candidates/:candidateUserId/notes
POST /v1/backoffice/appointments
GET  /v1/backoffice/candidates/:candidateUserId/appointments
```

## 9. Evenementen

De bronlijst en cacheopzet zijn gebaseerd op de bestaande
`scrape-events`-functie. De scraper zit nu achter een adapter.

Standaardbronnen:

- Onderwijsloket Rotterdam;
- Onderwijs010;
- Landelijk Onderwijsloket.

API:

```text
GET    /v1/events
POST   /v1/events/refresh
POST   /v1/events/:eventId/save
DELETE /v1/events/:eventId/save
GET    /v1/users/:userId/saved-events
```

De standaard lokale bootstrap gebruikt een lege in-memory scraper. Een
Firecrawl-, HTTP- of handmatige provider kan worden geïnjecteerd zonder
wijzigingen in de flowservice.
