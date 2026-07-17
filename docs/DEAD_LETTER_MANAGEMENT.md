# Door010 3.0 v2.5 — dead-letterbeheer

## Backofficeacties

Beheerders en superusers kunnen provider-dead-letters nu:

- opnieuw uitvoeren;
- handmatig als afgehandeld markeren;
- na afhandeling verwijderen.

API:

```text
POST   /v1/backoffice/provider-dead-letters/:deadLetterId/retry
POST   /v1/backoffice/provider-dead-letters/:deadLetterId/resolve
DELETE /v1/backoffice/provider-dead-letters/resolved
```

De purge-route accepteert optioneel:

```text
olderThan=<ISO-8601 tijdstip>
```

Zonder `olderThan` worden alle afgehandelde records verwijderd.

## Retrygedrag

Bij het ontstaan van een dead letter worden de volgende replaygegevens
opgeslagen:

- URL;
- HTTP-methode;
- content-type;
- requestbody tot maximaal 200.000 tekens.

Authorizationheaders en providercredentials worden niet opgeslagen. Bij een
retry wordt het actuele providercredential uit de omgevingsconfiguratie
gebruikt.

Een succesvolle HTTP-response:

1. markeert het record als afgehandeld;
2. verwijdert het record uit de standaardlijst met open dead letters;
3. blijft beschikbaar totdat een beheerder purge uitvoert.

Een mislukte retry laat het bestaande record open en retourneert een fout aan
de backoffice.

## Audittrail

De volgende beheeracties worden vastgelegd:

```text
provider.dead_letter_retried
provider.dead_letter_resolved
provider.dead_letters_purged
```

## Privacy en retentie

Een requestbody kan functionele of persoonsgegevens bevatten, bijvoorbeeld
een notificatiepayload of LLM-vraag. De body bevat geen authorizationheader,
maar moet wel volgens de gegevensretentie van Door010 worden behandeld.

De purgefunctie is daarom onderdeel van dezelfde release. Voor strengere
omgevingen kan een volgende stap encryptie-at-rest of providergerichte
payloadminimalisatie toevoegen.
