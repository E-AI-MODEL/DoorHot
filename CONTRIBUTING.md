# CONTRIBUTING.md

## Werkwijze

1. Maak een issue of beschrijf het probleem in de pull request.
2. Werk op een korte feature- of fixbranch.
3. Houd wijzigingen klein en gericht.
4. Voeg tests en documentatie toe.
5. Voer de lokale kwaliteitscontroles uit.
6. Open een pull request naar `main`.

Aanbevolen branchnamen:

```text
feature/<onderwerp>
fix/<onderwerp>
docs/<onderwerp>
chore/<onderwerp>
```

## Ontwikkelomgeving

Vereisten:

- Node.js 22 of nieuwer;
- npm;
- Docker en Docker Compose voor de volledige lokale stack;
- PostgreSQL-client voor herstel- en acceptancechecks.

Installatie:

```bash
cp .env.example .env
npm install
docker compose up -d
npm run dev
```

## Kwaliteitscontroles

Voor iedere pull request:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:migrations
npm audit --audit-level=moderate
```

Voor frontend- en flowwijzigingen:

```bash
npm run test:e2e
```

Voor retrieval- of rerankingwijzigingen:

```bash
npm run benchmark:reranker:check
npm run benchmark:shadow-reranker:check
```

## Architectuurregels

Lees vóór wijzigingen:

- `AGENTS.md`;
- `ARCHITECTURE.md`;
- relevante bestanden in `docs/`.

De volgende grenzen mogen niet worden doorbroken:

- Public Coach, Personal Journey Coach en Human Advisor Chat blijven gescheiden;
- Journey Engine beheert journey-state;
- Graph Memory is een projectie;
- providers lopen via adapters;
- schrijfacties volgen bevestiging en audit;
- PostgreSQL blijft de primaire opslag.

## Databasewijzigingen

- Voeg uitsluitend een nieuwe migratie toe.
- Wijzig nooit een reeds gecommitte migratie.
- Gebruik het volgende vrije migratienummer.
- Voeg waar nodig repository- en integratietests toe.
- Controleer alle migraties met `npm run verify:migrations`.

## Security en privacy

Nieuwe endpoints moeten aantoonbaar beschikken over:

- authenticatie waar nodig;
- ownership- of rolgebaseerde autorisatie;
- schema- en inputvalidatie;
- veilige foutmeldingen;
- auditlogging voor gevoelige mutaties;
- minimale gegevensverwerking.

Commit nooit:

- `.env`-bestanden;
- API-sleutels;
- databasewachtwoorden;
- toegangstokens;
- echte persoonsgegevens;
- productiedumps.

## Pull-requestbeschrijving

Beschrijf minimaal:

```text
Probleem
Oplossing
Architectuurimpact
Security- en privacyimpact
Database-impact
Tests en bewijs
Rollback
```

## Definition of Done

Een wijziging is klaar wanneer:

- het gevraagde gedrag is geïmplementeerd;
- relevante tests groen zijn;
- typecheck en build slagen;
- migraties slagen;
- documentatie actueel is;
- geen secrets of persoonsgegevens zijn toegevoegd;
- resterende beperkingen expliciet zijn vastgelegd.
