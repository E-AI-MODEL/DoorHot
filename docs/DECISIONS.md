# Architectuurbesluiten

## ADR-001 — Eén codebase

Light, standard en heavy zijn configuratieprofielen, geen forks.

## ADR-002 — Twee bot-orchestrators

`GeneralCoach` en `PersonalJourneyCoach` delen infrastructuur, maar niet
automatisch prompts, privacycontext, mutatierechten of evaluaties.

## ADR-003 — Deterministische fase- en routekern

LLM-output kan voorstellen doen. Definitieve profiel- en fasewijzigingen
lopen via gevalideerde domeincommando's en auditlogging.

## ADR-004 — Provider-neutrale infrastructuur

Database, auth, storage, realtime, LLM, retrieval en externe onderwijsdata
worden via interfaces gekoppeld.

## ADR-005 — Canonieke externe data

Onderwijsloket, HOVI, DUO/RIO, OOAPI en handmatige imports worden eerst
genormaliseerd naar Door010-entiteiten voordat de applicatie ze gebruikt.
