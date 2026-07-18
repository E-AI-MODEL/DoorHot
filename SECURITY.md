# Security Policy

## Ondersteunde versies

| Versie | Ondersteund |
|---|---|
| 5.x | Ja |
| 4.x en ouder | Nee |

## Kwetsbaarheden melden

Meld beveiligingsproblemen niet via een openbaar issue.

Gebruik bij voorkeur GitHub Private Vulnerability Reporting wanneer dit voor
de repository is ingeschakeld. Is dat niet beschikbaar, neem dan privé contact
op via het beveiligingscontact dat de repository-eigenaar in GitHub vermeldt.

Vermeld:

- getroffen component en versie;
- reproduceerbare stappen;
- mogelijke impact;
- eventuele proof of concept;
- voorgestelde mitigatie, indien bekend.

## Reactiedoelen

Het project streeft naar:

- ontvangstbevestiging binnen 3 werkdagen;
- eerste beoordeling binnen 7 werkdagen;
- periodieke voortgangsupdates bij bevestigde kwetsbaarheden.

Dit zijn streefwaarden, geen garantie.

## Responsible disclosure

Geef maintainers redelijke tijd om een oplossing uit te brengen voordat
details openbaar worden gemaakt. Test uitsluitend op systemen en gegevens
waarvoor je expliciete toestemming hebt.

## Buiten scope

- social engineering;
- denial-of-servicetests;
- testen met echte persoonsgegevens;
- misbruik van externe providers;
- rapporten zonder reproduceerbare technische impact.

## Demo-login

`POST /v1/auth/demo-login` ("Inloggen zonder wachtwoord") maakt een
tijdelijk demo-account aan zonder wachtwoordinvoer. De route staat
standaard alleen aan bij in-memory opslag en is in productie
uitgeschakeld tenzij `DEMO_LOGIN_ENABLED=true` expliciet is gezet.
Schakel dit nooit in op een omgeving met echte gebruikersgegevens.
