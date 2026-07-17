# Door010 3.0 v0.9 — parity-herstel 1 t/m 4

## 1. Algemene chatbot

De publieke algemene chatbot:

- gebruikt geen persoonlijke Phase Detector;
- leest geen persoonlijke slots;
- stelt geen faseovergangen voor;
- maakt geen profielmutaties;
- bewaart wel zijn eigen gesprek en berichten.

## 2. Persoonlijke trajectcoach

De persoonlijke coach gebruikt:

- profiel- en slotcontext;
- actief 4-, 5- of 9-fasensysteem;
- Adaptive Phase Detector;
- detector snapshots;
- RouteEngine;
- route-artifacts;
- persistente gesprekken en berichten;
- bevestigingsplichtige faseovergangen.

## 3. Menselijke adviseurschat

Toegevoegd:

- `AdvisorChatService`;
- berichtrol `advisor`;
- adviseur-, kandidaat- en conversatiecontext;
- API-endpoint voor adviseursberichten;
- gedeelde gesprekshistorie.

## 4. Conversaties en berichten

Toegevoegd:

- `ConversationRepository`;
- `MessageRepository`;
- `DetectorSnapshotRepository`;
- PostgreSQL-implementaties;
- in-memory implementatie voor lokale bootstrap;
- aparte rollen voor algemene AI, persoonlijke AI en adviseur.

## API

```text
POST /v1/chat/general
POST /v1/chat/personal
POST /v1/chat/advisor
GET  /v1/conversations/:conversationId/messages
```
