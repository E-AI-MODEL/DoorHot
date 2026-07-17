# Door010 3.0 — repo- en plandriftcontrole

## Conclusie

De domein- en backendflows zijn niet wezenlijk van het reconstructieplan
afgedreven. De grootste resterende afwijking zit in de productlaag: de twee
bronrepos bevatten meerdere gebruikersinterfaces, beheerfuncties en live
providerintegraties die de foundation nog niet reproduceert.

## Behouden grenzen

- De publieke coach bezit geen persoonlijke fase of profielmutaties.
- De persoonlijke coach gebruikt profiel-, route- en fasecontext.
- Vier-, vijf- en negenfasensystemen blijven naast elkaar bestaan.
- Mutaties vereisen bevestiging.
- PostgreSQL-persistence zit achter repositories.
- Er zijn geen Supabase-SDK-imports in domein- of flowpackages.

## Nog ontbrekend

| Prioriteit | Onderdeel | Stand |
|---|---|---|
| P0 | Frontend voor chat, profiel en backoffice | Niet gebouwd |
| P0 | Trusted sources, FAQ-ingest en retrieval | Alleen basis/interfaces |
| P1 | Prompt- en superuserbeheer | Rollen aanwezig, beheer ontbreekt |
| P1 | Backoffice-alerts, statistieken en kandidaatdetail | Services deels aanwezig |
| P1 | Live event-, vacature-, zoek- en LLM-providers | Alleen adapters |
| P2 | Chatinteracties en profielcompleteness | Alleen backendcontracten |
| P2 | E-mail en notificaties | Nog geen portable provider |

## Vervolgplan

1. **v1.7:** trusted sources, FAQ-ingest en hybride retrieval.
2. **v1.8:** frontend-shell voor publieke chat, profiel en persoonlijke chat.
3. **v1.9:** backoffice-UI, prompts, alerts en statistieken.
4. **v2.0:** live providers voor LLM, zoeken, events, vacatures en notificaties.

## Anti-driftregels

- Iedere release actualiseert deze matrix.
- UI dupliceert geen domeinregels.
- Provider-SDK's blijven buiten domein- en flowpackages.
- Nieuwe persistence krijgt migratie- en repositorytests.
- De publieke en persoonlijke chatbotgrens blijft expliciet.
