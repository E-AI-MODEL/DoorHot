# Door010 3.0 v1.5 — CI en containerdeployment

## Geen Supabase-SDK

De nieuwe foundation blijft provider-onafhankelijk. De CI- en
deploymentconfiguratie voegen geen Supabase-SDK of Supabase-runtime toe.

## Continuous integration

Workflow:

```text
.github/workflows/ci.yml
```

De workflow draait bij pushes naar `main` en `develop`, bij pull requests en
handmatig. De verificatiejob voert uit:

```text
npm ci --ignore-scripts
npm audit --audit-level=moderate
npm run typecheck
npm test
npm run build
npm run verify:migrations
```

Na een geslaagde verificatie controleert een tweede job de Compose-configuratie
en bouwt de productie-image.

## Automatisch readinessrapport

De job `readiness` in `ci.yml` draait altijd als laatste en bundelt de
uitkomsten van de workspace-, browser- en imagejobs tot
`readiness-report.json`, geüpload als artifact
`door010-readiness-<sha>`. Het rapport bevat de commit-SHA, het
tijdstip, de Node-versie, de status en het commando per check, de
run-URL en een expliciete lijst van gates die deze pipeline niet dekt
(staging-load, restore-drill, acceptance, security/DPIA). Het veld
`overall` is `GO_TECHNICAL` uitsluitend wanneer alle pipelinechecks
groen zijn; de job faalt mee wanneer dat niet zo is. Alleen de
pipeline produceert deze status — een handmatige tekst kan geen GO
verklaren.

## Productie-image

De `Dockerfile` gebruikt:

- Node.js 22;
- een aparte builder- en runtimestage;
- `npm ci` met lockfile;
- alleen productiedependencies in de runtimestage;
- de niet-root gebruiker `node`;
- een HTTP-healthcheck;
- graceful shutdown via `SIGTERM` en `SIGINT`.

## PostgreSQL-migraties

Bij het starten van de productiecontainer draait:

```text
scripts/start-production.mjs
→ scripts/migrate-postgres.mjs
→ apps/api/dist/server.js
```

De migratierunner:

- gebruikt een PostgreSQL advisory lock;
- maakt `schema_migrations`;
- controleert SHA-256-checksums;
- slaat reeds uitgevoerde migraties over;
- weigert gewijzigde historische migraties;
- voert iedere nieuwe migratie transactioneel uit.

## Docker Compose

Maak eerst de omgeving:

```bash
cp .env.example .env
```

Vervang minimaal:

```text
POSTGRES_PASSWORD
AUTH_TOKEN_SECRET
```

Start daarna:

```bash
docker compose up --build -d
```

Controle:

```bash
docker compose ps
curl http://localhost:4000/health
```

De API start pas nadat PostgreSQL gezond is. Zowel PostgreSQL als de API hebben
een eigen healthcheck. Bestanden en databasegegevens staan in afzonderlijke
Docker-volumes.

## Handmatige productieomgeving

Buiten Docker:

```bash
APP_STORAGE_MODE=postgres
DATABASE_URL=postgresql://...
AUTH_TOKEN_SECRET=<minimaal-32-tekens>
FILE_STORAGE_DIRECTORY=/var/lib/door010/files
npm run build
npm run migrate
npm run start:production
```
