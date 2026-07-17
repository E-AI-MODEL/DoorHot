# Door010 3.0 — volledige parity-audit flows 1 t/m 10

## Samenvatting

| Flow | Onderdeel | Status |
|---|---|---|
| 1 | Publieke algemene chatbot | Geïmplementeerd |
| 2 | Registratie en authenticatie | Gedeeltelijk |
| 3 | Persoonlijk profiel | Gedeeltelijk |
| 4 | Persoonlijke chatbot | Geïmplementeerd |
| 5 | Route bepalen | Geïmplementeerd |
| 6 | Fase bepalen | Geïmplementeerd |
| 7 | Interesse- en talententest | Geïmplementeerd |
| 8 | Adviseursbackoffice | Kern geïmplementeerd |
| 9 | Evenementen | Kern geïmplementeerd |
| 10 | Vacatures | Kern geïmplementeerd |

## Supabase-onafhankelijkheid

De nieuwe foundation importeert geen Supabase-SDK in de domein- of flowlagen.

De oude repositories zijn alleen gebruikt voor:

- bestaand gedrag;
- gegevensmodellen;
- vragen en scoring;
- bronlijsten;
- UX- en workflowpatronen.

Database-, auth-, storage-, scraper- en zoekfunctionaliteit blijven achter
interfaces en adapters.

## Belangrijkste resterende paritygaten

1. Een concrete authadapter en centrale autorisatiemiddleware.
2. Volledige profiel-CRUD met avatar-, CV- en notitieopslag.
3. Productie-bootstrap met PostgreSQL-repositories in plaats van in-memory stores.
4. Live FAQ-, web-, evenementen- en vacatureproviders.
5. Een echte backoffice- en profiel-UI.

Zie `FULL_PARITY_AUDIT_1_TO_10.json` voor bewijs en resterende acties per flow.
