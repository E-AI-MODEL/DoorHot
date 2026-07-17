# Door010 3.0 v1.8 — kennislaag en frontend-shell

## v1.7: trusted sources en retrieval

Toegevoegd:

- trusted-source register met autoriteit en toegestane domeinen;
- FAQ-ingest vanuit het bestaande `faq-seed.json`;
- PostgreSQL full-text search;
- aanvullende semantische token-overlapscore;
- ranking op lexical match, semantic match, bronautoriteit en actualiteit;
- geldigheidsdatums en reviewstatus;
- bronplichtige antwoorden met links;
- integratie in de publieke algemene coach.

API:

```text
GET  /v1/knowledge/search
GET  /v1/knowledge/items
GET  /v1/trusted-sources
POST /v1/trusted-sources
POST /v1/knowledge/ingest/faqs
```

## v1.8: frontend-shell

Nieuwe workspace:

```text
apps/web
```

De frontend gebruikt uitsluitend de bestaande API-contracten en bevat:

- publieke algemene chatbot;
- persoonlijke chatbot;
- login en registratie;
- profiel bekijken en wijzigen;
- kennisbank zoeken;
- bronlinks en chat-artifacts;
- responsive desktop- en mobiele layout;
- lokale Vite-proxy;
- productie-Nginx reverse proxy.

De bedrijfsregels blijven in de backend. De frontend berekent geen fases,
routes of profielmutaties.

## Starten voor ontwikkeling

```bash
npm run dev
npm run dev:web
```

API:

```text
http://localhost:4000
```

Frontend:

```text
http://localhost:5173
```

## Docker

```bash
docker compose up --build -d
```

Frontend:

```text
http://localhost:8080
```

De webcontainer stuurt `/v1` en `/health` door naar de API-container.
`/metrics` wordt niet publiek doorgestuurd.
