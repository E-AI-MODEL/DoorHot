# Door010 3.0 v1.2 — authenticatie, profiel en PostgreSQL-productiemodus

## Authenticatie

- registratie met genormaliseerd e-mailadres;
- wachtwoorden via `scrypt` met unieke salt;
- HMAC-SHA256 access tokens;
- configureerbare vervaltijd;
- rollen: kandidaat, adviseur, beheerder en superuser;
- centrale Fastify `preHandler` voor afgeschermde routes.

Verplicht in productie:

```bash
AUTH_TOKEN_SECRET=<minimaal-32-tekens>
```

## Profiel-CRUD

Ondersteund:

- profiel ophalen;
- profiel bijwerken;
- profiel verwijderen;
- avatar uploaden;
- CV uploaden;
- tijdelijke bestands-URL opvragen;
- persoonlijke notities aanmaken, lezen, wijzigen en verwijderen.

Bestandsrestricties:

- avatar: JPEG, PNG of WebP, maximaal 5 MB;
- CV: PDF, maximaal 15 MB.

## Opslagmodi

### Lokale ontwikkeling

```bash
APP_STORAGE_MODE=memory
```

Gebruikt expliciete in-memory adapters.

### Productie

```bash
APP_STORAGE_MODE=postgres
DATABASE_URL=postgresql://...
AUTH_TOKEN_SECRET=...
FILE_STORAGE_DIRECTORY=/var/lib/door010/files
```

De productiebootstrap gebruikt:

- `PgSqlExecutor`;
- PostgreSQL-gebruikers, rollen en profielen;
- PostgreSQL-gesprekken en berichten;
- PostgreSQL-detectorsnapshots;
- PostgreSQL-fase-evaluaties;
- PostgreSQL-pending mutations;
- PostgreSQL-chatcontext;
- PostgreSQL-fasesysteemvoorkeuren;
- filesystem-objectstorage.

Er wordt geen Supabase-SDK gebruikt.

## API

```text
POST   /v1/auth/register
POST   /v1/auth/login
GET    /v1/auth/me

GET    /v1/profiles/:userId
PATCH  /v1/profiles/:userId
DELETE /v1/profiles/:userId

POST   /v1/profiles/:userId/files/:kind
GET    /v1/profiles/:userId/files/:kind/url

GET    /v1/profiles/:userId/notes
POST   /v1/profiles/:userId/notes
PATCH  /v1/profiles/:userId/notes/:noteId
DELETE /v1/profiles/:userId/notes/:noteId
```
