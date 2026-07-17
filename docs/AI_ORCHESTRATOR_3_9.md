# Door010 3.9 — AI Orchestrator

## Architectuur

Nieuwe package:

```text
@door010/orchestration
```

De orchestrator verbindt:

```text
Intent
→ Journey
→ Knowledge
→ Planning
→ Tools
→ Deterministische answer composition
→ Observability
```

De planner bepaalt eerst de intent en maakt daarna een expliciet plan met
capabilities, tools, redenen en required/optional-status.

## Intenten

Ondersteunde intenten:

```text
greeting
knowledge_question
journey_guidance
action_request
progress_request
handoff_request
unknown
```

## Toolregistry

Alle uitvoerbare tools moeten vooraf in de `ToolRegistry` zijn geregistreerd.

Standaardtools:

```text
knowledge.search
journey.dashboard
journey.next-action
```

Iedere tool heeft:

- een stabiele key;
- een capability;
- een timeout;
- een geïsoleerde execute-functie;
- een trace-event;
- een foutstatus.

Niet-geregistreerde tools worden niet uitgevoerd.

## Planning

Voorbeeld:

```text
Vraag: "Wat is mijn volgende stap?"

1. journey.dashboard
   Reden: persoonlijke begeleiding vereist actuele journey-state.

2. knowledge.search
   Reden: relevante kennis kan de aanbeveling onderbouwen.

3. journey.next-action
   Reden: gebruiker vraagt expliciet om de volgende beste actie.
```

Required tool failures stoppen verdere noodzakelijke stappen. Optional tool
failures leveren een partial result op wanneer voldoende context overblijft.

## Answer composition

De v3.9 composer is bewust deterministisch. Hij gebruikt:

- journey progress;
- huidige fase;
- next-best action;
- open blockers;
- maximaal drie relevante kennistitels;
- handoffregels.

De bestaande LLM- en response-validatiepipeline blijft actief in de algemene
en persoonlijke coach. De orchestrator wordt als sidecar uitgevoerd en voegt
planmetadata toe zonder het bestaande coachantwoord te vervangen.

## Coachintegratie

Beide endpoints leveren nu aanvullend:

```json
{
  "orchestration": {
    "runId": "uuid",
    "intent": "journey_guidance",
    "status": "completed",
    "plan": {}
  }
}
```

Endpoints:

```text
POST /v1/chat/general
POST /v1/chat/personal
POST /v1/orchestrate
```

## Observability

Nieuwe tabellen:

```text
orchestration_runs
orchestration_events
```

Een run bevat:

- request ID;
- gebruiker en conversatie wanneer aanwezig;
- intent;
- plan;
- status;
- antwoord;
- latency;
- foutcode.

Een event bevat alleen samenvattingen van input en output. Ruwe tooloutputs
worden niet standaard opgeslagen.

Backoffice:

```text
GET /v1/backoffice/orchestration-runs
GET /v1/backoffice/orchestration-runs/:runId
```

Alleen administrators en superusers mogen orchestration traces bekijken.

## Grenzen

- De planner is rule-based en nog niet model-assisted.
- De composer genereert nog geen rijk natuurlijk antwoord op basis van alle
  tooloutputs.
- Externe tools voor notificaties, afspraken en applicaties zijn nog niet
  geregistreerd.
- Volledige browser-E2E voor orchestrationmetadata is nog niet toegevoegd.
- Tooluitvoering is sequentieel; parallelle onafhankelijke stappen volgen in
  een latere optimalisatie.
