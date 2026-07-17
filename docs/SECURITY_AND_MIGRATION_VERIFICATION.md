# Door010 3.0 v1.4 — dependencybeveiliging en migratie-uitvoering

## A — dependencykwetsbaarheden

Vitest is gecontroleerd bijgewerkt van 2.1 naar 3.2.6. Dit is de eerste versie
in de 3.x-lijn waarin de relevante Vitest-kwetsbaarheid is opgelost.

Na de upgrade:

```text
npm audit
0 kwetsbaarheden
```

De volledige testset is opnieuw uitgevoerd:

```text
22 testbestanden
40 tests
40 geslaagd
```

## B — migraties

Alle 13 migraties zijn uitgevoerd tegen een tijdelijke embedded
PostgreSQL-database via PGlite.

Uitkomst:

```text
13 migraties geslaagd
74 publieke tabellen aangemaakt
```

PGlite draait de echte PostgreSQL-engine in WebAssembly. Voor de test is alleen
`CREATE EXTENSION pgcrypto` overgeslagen, omdat PGlite `gen_random_uuid()`
rechtstreeks beschikbaar stelt.

Tijdens de migratierun zijn drie echte migratieproblemen gevonden en hersteld:

1. De gegenereerde zoekkolom gebruikte een niet-immutable arrayconversie.
2. `journey_states` ontbrak vóór migratie 0005.
3. `conversations.user_id` ontbrak terwijl repositories en indexen die kolom
   gebruiken.

## Herhaalbare controle

```bash
npm run verify:migrations
```

Rapport:

```text
docs/v1.4-migration-run.json
```
