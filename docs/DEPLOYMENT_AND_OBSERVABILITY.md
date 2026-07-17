# Door010 3.0 v1.6 — deploymentpromotie en observability

## Staging en productie

Workflows:

```text
.github/workflows/deploy-staging.yml
.github/workflows/deploy-production.yml
.github/workflows/reusable-release.yml
```

Beide deployments zijn handmatig te starten. De daadwerkelijke
goedkeuringsstap wordt afgedwongen via GitHub Environments.

Configureer in de repository:

1. Maak environments `staging` en `production`.
2. Voeg required reviewers toe.
3. Voeg per environment secrets toe:
   - `DEPLOY_WEBHOOK_URL`
   - `DEPLOY_WEBHOOK_TOKEN`
4. Beperk production eventueel tot beschermde branches.

De reusable workflow:

- draait de volledige releaseverificatie;
- bouwt een immutable container;
- publiceert naar GHCR;
- gebruikt het gekozen GitHub Environment;
- triggert daarna een provider-onafhankelijke deploymentwebhook.

## Logging

Fastify schrijft gestructureerde JSON-logs met:

- request-ID;
- eventnaam;
- HTTP-methode;
- route;
- statuscode;
- doorlooptijd;
- foutnaam.

Gevoelige waarden zoals authorization headers, wachtwoorden en access tokens
worden geredigeerd.

Instelling:

```bash
LOG_LEVEL=info
```

## Healthchecks

```text
GET /health/live
GET /health/ready
GET /health
```

`/health/live` controleert het proces. `/health/ready` controleert ook de
PostgreSQL-verbinding. Docker gebruikt readiness.

## Metrics

```text
GET /metrics
```

Formaat: Prometheus exposition format.

Beschikbaar:

- proces-uptime;
- actieve requests;
- requests per methode en route;
- HTTP 5xx-fouten;
- requestduur als histogram.

Een optionele bearer token kan worden ingesteld:

```bash
METRICS_TOKEN=<lange-willekeurige-token>
```

## Prometheus

Start de monitoringprofile naast de basiscompose:

```bash
docker compose   -f compose.yaml   -f compose.monitoring.yaml   --profile monitoring   up --build -d
```

Prometheus is dan beschikbaar op poort `9090`. Binnen de Compose-configuratie
wordt het metricsendpoint alleen via het private servicenetwerk benaderd.
