# Door010 3.0 v1.1 — vacatures en volledige parity-audit

## Flow 10 — vacatures

Toegevoegd:

- `VacancyProvider`;
- `InMemoryVacancyProvider`;
- `VacancyService`;
- zoeken op tekst, sector, organisatie en locatie;
- vacaturedetails;
- vacature opslaan;
- opgeslagen vacature verwijderen;
- lijst met opgeslagen vacatures;
- profielkoppeling met afgeleide sectoren en organisaties.

API:

```text
GET    /v1/vacancies
GET    /v1/vacancies/:vacancyId
POST   /v1/vacancies/:vacancyId/save
DELETE /v1/vacancies/:vacancyId/save
GET    /v1/users/:userId/saved-vacancies
GET    /v1/users/:userId/vacancy-profile
```

## Portabiliteit

Er is geen directe Supabase-koppeling toegevoegd. De vacaturebron zit achter
`VacancyProvider`. Een live bron kan later worden aangesloten via een adapter.

## Audit

De volledige audit staat in:

- `docs/FULL_PARITY_AUDIT_1_TO_10.md`
- `docs/FULL_PARITY_AUDIT_1_TO_10.json`
