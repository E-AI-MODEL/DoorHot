# Door010 3.0 v1.3 — volledige PostgreSQL-flowpersistence

## PostgreSQL-repositories

De productiebootstrap gebruikt nu ook PostgreSQL voor:

- routesessies en geselecteerde antwoorden;
- talententestresultaten en profielkoppeling;
- fase-evaluaties en detectorsnapshots;
- kandidatenoverzicht;
- adviseursnotities;
- afspraken;
- opgehaalde evenementen;
- opgeslagen externe evenementen;
- vacatures;
- opgeslagen vacatures en profielsamenvattingen.

De memory-modus blijft alleen beschikbaar voor lokale ontwikkeling en tests.

## Nieuwe package

```text
packages/parity-persistence
```

Belangrijkste implementaties:

- `PostgresRouteSessionRepository`
- `PostgresTalentTestService`
- `PostgresPhaseFlowService`
- `PostgresBackofficeService`
- `PostgresEventService`
- `PostgresVacancyService`

## Productiemodus

```bash
APP_STORAGE_MODE=postgres
DATABASE_URL=postgresql://...
AUTH_TOKEN_SECRET=<minimaal-32-tekens>
FILE_STORAGE_DIRECTORY=/var/lib/door010/files
```

De API deelt dezelfde PostgreSQL-executor met de kernservices en parityflows.

## Verificatie

Uitgevoerd en geslaagd:

```text
npm install --ignore-scripts
npm run typecheck
22 testbestanden / 40 tests
npm run build
statische controle van 13 migraties
```

Een live migratie-uitvoering is niet gedaan omdat geen `DATABASE_URL` voor een
testdatabase beschikbaar was.

## Dependency-audit

`npm audit` meldt vijf kwetsbaarheden:

- drie moderate;
- één high;
- één critical.

Er is geen automatische `npm audit fix --force` uitgevoerd, omdat die
breaking dependency-upgrades kan toepassen. Het volledige rapport staat in
`docs/v1.3-npm-audit.json`.
