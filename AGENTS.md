# AGENTS.md

## Doel

Deze repository bevat Door010 Foundation 5.0: een portable, provider-neutraal
platform voor onderwijsloopbaanbegeleiding, persoonlijke journeys,
kennisretrieval, adviseurscommunicatie en gecontroleerde AI-uitvoering.

Deze instructies gelden voor menselijke ontwikkelaars en AI-agents.

## Vaste architectuurgrenzen

De volgende kanalen blijven functioneel en technisch gescheiden:

1. **Public General Coach**
   - vrij toegankelijk;
   - gebruikt geen persoonlijke journey-state;
   - geeft algemene informatie met gecontroleerde bronnen.

2. **Personal Journey Coach**
   - vereist een geauthenticeerde gebruiker;
   - gebruikt profiel-, fase-, route- en journeycontext;
   - mag wijzigingen alleen voorstellen, nooit stilzwijgend uitvoeren.

3. **Human Advisor Chat**
   - is communicatie tussen gebruiker en menselijke adviseur;
   - wordt nooit vervangen door een LLM;
   - blijft een afzonderlijk gesprekstype en autorisatiedomein.

## Bronnen van waarheid

- PostgreSQL is de primaire persistente opslag.
- Journey Engine is de bron van waarheid voor journey-state.
- Route Engine is de bron van waarheid voor routebepaling.
- Phase Engine is de bron van waarheid voor fasebepaling.
- Graph Memory is uitsluitend een afgeleide projectie.
- De orchestrator coördineert capabilities, maar bepaalt geen domeinwaarheid.
- LLM-output is advies en moet gevalideerd worden voordat die invloed krijgt.

## Journey- en schrijfacties

Een LLM of agent mag nooit zelfstandig:

- een fase of route wijzigen;
- een actie, blocker, milestone of doel muteren;
- profielgegevens opslaan;
- een notificatie of externe actie uitvoeren;
- autorisatie- of bevestigingsstappen overslaan.

Schrijfacties vereisen waar van toepassing:

1. authenticatie;
2. autorisatie;
3. inputvalidatie;
4. expliciete bevestiging;
5. auditregistratie;
6. fout- en retryafhandeling.

## Providerneutraliteit

Gebruik altijd bestaande adapters of voeg een nieuwe adapter toe.

Plaats geen vendor-specifieke logica in:

- domeinmodellen;
- engines;
- orchestrationcontracten;
- API-contracten die generiek horen te zijn.

Nieuwe providers moeten uitschakelbaar en vervangbaar zijn.

## Retrieval en generatie

De ondersteunde pipeline is:

```text
lexicale retrieval
→ hybride retrieval
→ conditionele reranking
→ trusted-source filtering
→ generatie
→ repair en validatie
```

Nieuwe retrieval- of generatiecomponenten moeten:

- achter een feature flag of adapter staan;
- bestaande lexical fallback behouden;
- bronverwijzingen en validatie respecteren;
- meetbaar geëvalueerd worden.

### Chatpresentatie en privacy

- De 4-, 5- en 9-fasenmodellen, fasecodes en fasetitels zijn interne
  procesmetadata. Ze mogen niet verschijnen in coachberichten of zichtbare
  artifactlabels. Bewaar ze wel in machineleesbare metadata voor engines,
  persistence, mutaties en toekomstige koppelingen.
- Vertaal journey-state naar een nuttige consequentie voor de gebruiker: een
  relevant antwoord, passende route, concrete vervolgactie, aandachtspunt of
  natuurlijke vervolgvraag. Benoem het interne model zelf niet.
- Een kennisantwoord in de persoonlijke coach vult de journeycontext aan en
  vervangt die niet.
- Ruwe persoonlijke coachvragen mogen niet naar een optionele externe
  websearchprovider. Externe fallback vereist een afzonderlijk, expliciet
  privacybeleid met toestemming en querysanitisatie; standaard blijft deze uit.
- Een systeemprompt is geen afdoende technische grens. Dwing bovenstaande
  regels ook af in compositie, providerinput, validatie en tests.
- Phase, Route en Journey Engine leveren hun deterministische uitkomst vóór
  antwoordgeneratie. De eindgenerator mag die uitkomst semantisch formuleren en
  verbinden, maar niet opnieuw beslissen.
- Optionele modeltaken voor intentclassificatie, conditionele retrieval-
  reranking en antwoordrepair blijven begrensde hulptaken. Ze mogen de
  journey-state niet muteren. Shadow-reranking en shadow-planning beïnvloeden
  de actieve uitkomst nooit.

## Database en migraties

- Bestaande migraties worden nooit aangepast.
- Elke schemawijziging krijgt een nieuwe, oplopende migratie.
- Migraties moeten opnieuw uitvoerbaar zijn in de verificatiesuite.
- Verwijdering gebeurt bij voorkeur via archivering of expliciet beleid.
- Voeg geen directe Supabase-SDK-afhankelijkheid toe aan domein- of
  orchestrationcode.

## Codekwaliteit

Volg de bestaande TypeScript- en workspaceconventies.

Wijzigingen moeten:

- kleine, duidelijke functies gebruiken;
- afhankelijkheden injecteren waar dat testbaarheid verbetert;
- fouten betekenisvol afhandelen;
- publieke contracten typeren;
- bestaande functionaliteit behouden;
- tests toevoegen of aanpassen;
- documentatie bijwerken wanneer gedrag of architectuur verandert.

## Vereiste controles

Voer minimaal uit:

```bash
npm install --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:migrations
npm audit --audit-level=moderate
```

Voor frontend- of flowwijzigingen:

```bash
npm run test:e2e
```

Voor retrievalwijzigingen ook de relevante benchmarkgates uitvoeren.

## Nooit doen

- De drie chatkanalen samenvoegen.
- Journey-state buiten Journey Engine muteren.
- Graph Memory als primaire opslag gebruiken.
- Autorisatie, validatie of bevestiging omzeilen.
- Secrets, tokens of persoonsgegevens in logs, fixtures of commits opnemen.
- Een provider hardcoderen in de domeinlaag.
- Bestaande migraties herschrijven.
- Tests verwijderen om een wijziging groen te maken.
- Onbewezen productieclaims in documentatie zetten.

## Prioriteiten

1. correctheid;
2. veiligheid en privacy;
3. deterministisch domeingedrag;
4. testbaarheid;
5. leesbaarheid en onderhoudbaarheid;
6. portabiliteit;
7. performance;
8. nieuwe functionaliteit.

## Bij twijfel

Kies de eenvoudigste oplossing die:

- architectuurgrenzen bewaakt;
- backward compatible is;
- providerneutraal blijft;
- expliciet testbaar is;
- geen productie-evidence suggereert die niet werkelijk is verzameld.
