# Door010 3.0 v2.0 — backoffice-inzichten en actieve coachprompts

## Backoffice-inzichten

Toegevoegd:

- afgeleide alerts per kandidaat;
- statistieken voor routes, confidence, fases en afspraken;
- kandidaatdetail met notities, afspraken en alerts;
- memory- en PostgreSQL-implementaties;
- beveiligde API-routes;
- frontenddashboard met doorklikbare kandidaten en alerts.

Alertregels:

- ontbrekende fase;
- lage detectorconfidence;
- ontbrekende route;
- afspraak die aandacht vraagt.

API:

```text
GET /v1/backoffice/statistics
GET /v1/backoffice/alerts
GET /v1/backoffice/candidates/:candidateUserId
```

Alerts worden deterministisch afgeleid uit de actuele kandidaatstatus. Daarom
is geen extra alerttabel of migratie nodig.

## Actieve promptversies

Promptbeheer was al versieerbaar. In v2.0 is de actieve goedgekeurde versie
daadwerkelijk gekoppeld aan beide coachorchestrators.

Stroom:

```text
PromptRepository
→ RepositoryActivePromptProvider
→ GeneralCoach of PersonalJourneyCoach
→ AnswerDraftProvider
```

Alleen de versie die tegelijk:

- bij de juiste chatbot hoort;
- de configuratiesleutel `default` heeft;
- gelijk is aan `activeVersion`;
- status `approved` heeft;

wordt aan de answer provider doorgegeven.

De publieke en persoonlijke coach blijven gescheiden. Een prompt verandert
geen fase-, route- of profielregels; hij stuurt alleen de antwoordprovider aan.

## Frontend

De backoffice toont nu:

- totaal aantal kandidaten;
- aantal open alerts;
- kandidaten zonder route;
- promptconfiguraties;
- alerts op urgentie;
- kandidaatdetail;
- notities en afspraken;
- actieve promptversies.

## Verificatie

Uitgevoerd:

```text
npm install --ignore-scripts
npm run typecheck
npm run build
14/14 migraties
npm audit
chat prompt-integratietests
backoffice prompttests
backoffice insighttests
API-bootstraptest
```

De vijf Playwrightscenario's zijn opnieuw succesvol ontdekt. Volledige
browseruitvoering blijft in deze omgeving geblokkeerd door de aanwezige
Chromium/GPU-beperking; CI installeert en gebruikt de Playwright-browser.
