# Externe security- en privacyreview — opdrachtchecklist

## Scope

- Publieke chatbot
- Authenticatie en sessies
- Persoonlijk profiel
- Route- en fasegegevens
- Talententest
- Menselijke adviseurschat
- Bestandsuploads
- Events en vacatures
- Backoffice
- Promptbeheer
- Audittrail
- Providerdeadletters

## Testaccounts

- Kandidaat zonder aanvullende rechten
- Adviseur met toegewezen kandidaten
- Adviseur zonder toewijzing aan testkandidaat
- Administrator
- Superuser, alleen wanneer noodzakelijk

## Securitytests

- Horizontale en verticale autorisatie
- IDOR
- Sessiefixatie en tokenmisbruik
- Brute force en rate limiting
- XSS, CSP en HTML-injectie
- SSRF via provider- en URL-invoer
- Bestandsupload en content-typevalidatie
- SQL-injectie
- Promptinjectie en bronmanipulatie
- Realtime-conversatietoegang
- Auditlogintegriteit
- Secret- en foutmeldinglekkage
- Dependency- en containeranalyse

## Privacytests

- Dataminimalisatie
- Doelbinding
- Bewaartermijnen
- Verwijderbaarheid
- Inzage en export
- Logging van persoonsgegevens
- Dead-letterpayloads
- CV- en avataropslag
- Adviseursnotities
- LLM- en providerdoorgifte
- Verwerkersovereenkomsten
- Toestemming en transparantie
- Kind- en onderwijsgerelateerde gegevens

## Rapportage

Iedere bevinding bevat:

- ernst;
- reproduceerbare stappen;
- getroffen endpoint of flow;
- bewijs zonder onnodige persoonsgegevens;
- risico;
- hersteladvies;
- herteststatus.
