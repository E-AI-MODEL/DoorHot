# Door010

<p align="center">
  <strong>Een digitale route naar werken en leren in het onderwijs.</strong>
</p>

<p align="center">
  <img alt="Repositoryversie 5.0.1" src="https://img.shields.io/badge/repository-5.0.1-2f6f5e">
  <img alt="Node.js 22 of hoger" src="https://img.shields.io/badge/Node.js-22%2B-339933">
  <img alt="TypeScript workspaces" src="https://img.shields.io/badge/TypeScript-workspaces-3178c6">
  <img alt="Lokale LLM mogelijk" src="https://img.shields.io/badge/lokale_LLM-optioneel-7c3aed">
  <img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="Readiness conditional go" src="https://img.shields.io/badge/readiness-CONDITIONAL__GO-c88719">
</p>

<p align="center">
  <a href="https://codespaces.new/E-AI-MODEL/door010?quickstart=1">
    <img
      src="https://github.com/codespaces/badge.svg"
      alt="Open Door010 in GitHub Codespaces"
    >
  </a>
</p>

<p align="center">
  <a href="https://door010.lovable.app/">
    <img
      src="https://img.shields.io/badge/Bekijk-versie_1-8A2BE2"
      alt="Bekijk Door010 versie 1"
    >
  </a>
  &nbsp;
  <a href="https://github.com/E-AI-MODEL/door0101">
    <img
      src="https://img.shields.io/badge/GitHub-code_versie_1-181717"
      alt="Bekijk de code van Door010 versie 1"
    >
  </a>
  &nbsp;
  <a href="https://demo-regio.lovable.app/">
    <img
      src="https://img.shields.io/badge/Bekijk-presentatieversie-8A2BE2"
      alt="Bekijk de presentatieversie van Door010"
    >
  </a>
  &nbsp;
  <a href="https://github.com/E-AI-MODEL/presentatie-door010">
    <img
      src="https://img.shields.io/badge/GitHub-presentatieversie-181717"
      alt="Bekijk de code van de presentatieversie"
    >
  </a>
</p>

<p align="center">
  <a href="https://github.com/E-AI-MODEL/-rag-eat-starter-kit">
    <img
      src="https://img.shields.io/badge/GitHub-RAG_EAT_starter_kit-181717"
      alt="Bekijk de RAG EAT Starter Kit"
    >
  </a>
  &nbsp;
  <a href="https://door-datamodel-explorer.ai.studio">
    <img
      src="https://img.shields.io/badge/Bekijk-DOOR_datamodel_explorer-4285F4"
      alt="Bekijk de DOOR datamodel explorer"
    >
  </a>
</p>

Door010 helpt mensen bij vragen over werken en leren in het onderwijs.

Een bezoeker kan zelf informatie bekijken, een route verkennen, vacatures en evenementen zoeken, een algemene vraag stellen, met een persoonlijke coach werken of contact opnemen met een medewerker.

Deze repository is niet het begin van het project. Zij is het resultaat van een langer traject waarin een werkgroepvraag, een afgebroken leveranciersroute, twee werkende vibecodeversies, een A/B-test, honderden procesvragen, verschillende databronnen en een apart RAG-experiment bij elkaar zijn gekomen.

> [!IMPORTANT]
> Door010 is nog geen bewezen productieomgeving.
>
> De repository bevat onderdelen die nodig zijn om verder richting productie te werken. De uiteindelijke doelomgeving, echte koppelingen, privacybeoordeling, belasting en herstel moeten nog afzonderlijk worden getest.

> [!NOTE]
> Nieuw in de repository? Begin bij **Hoe dit project hier terechtkwam**. Technische uitleg staat waar mogelijk in uitklapbare delen.

---

## Kies je route

| Ik wil... | Begin hier |
| --- | --- |
| Begrijpen waarom dit project is gebouwd | [Hoe dit project hier terechtkwam](#hoe-dit-project-hier-terechtkwam) |
| De verschillende openbare versies bekijken | [Openbare projectonderdelen](#openbare-projectonderdelen) |
| Door010 direct starten | [Open Door010 in Codespaces](https://codespaces.new/E-AI-MODEL/door010?quickstart=1) |
| Begrijpen wat een gebruiker kan doen | [Vier ingangen](#vier-ingangen) |
| Begrijpen hoe vragen worden verwerkt | [Het uitgangspunt](#het-uitgangspunt) |
| Begrijpen wat zonder LLM gebeurt | [De route zonder LLM](#de-route-zonder-llm) |
| Begrijpen wat Codespaces met Ollama doet | [Codespaces](#codespaces) |
| De retrievalcode bekijken | [Retrieval en antwoordopbouw](#retrieval-en-antwoordopbouw) |
| Lokaal starten zonder database | [Lokale demo](#lokale-demo) |
| Met PostgreSQL ontwikkelen | [PostgreSQL-omgeving](#postgresql-omgeving) |
| Een eerste wijziging maken | [Eerste wijziging](#eerste-wijziging) |
| De juiste map vinden | [Waar staat wat?](#waar-staat-wat) |
| Een wijziging controleren | [Controles](#controles) |

---

# Hoe dit project hier terechtkwam

## 1. Eerst adviseur in de werkgroep

Mijn betrokkenheid begon niet als softwareontwikkelaar, maar als adviseur in een werkgroep rond de inrichting van digitale ondersteuning voor mensen die in het onderwijs willen werken of leren.

Binnen die werkgroep was via CM.com een omgeving ingericht. Die route is gestopt omdat de gekozen inrichting niet goed genoeg aansloot op de eisen en zorgen rond de AVG en de Europese AI Act.

De behoefte verdween daarmee niet. Er bleef behoefte aan een omgeving die vragen kon beantwoorden, routes kon helpen ordenen, beschikbare gegevens kon benutten en waar nodig kon doorverwijzen naar een mens.

> [!NOTE]
> De CM.com-fase is onderdeel van de projectgeschiedenis, maar is niet als openbare code-repository beschikbaar. De openbare technische lijn begint bij de eerste Door010-repo hieronder.

## 2. Zelf gaan bouwen

Ik heb geen informatica gestudeerd.

Toen de oorspronkelijke route stopte, ben ik zelf gaan bouwen. Niet omdat ik dacht dat ik direct een productiesysteem kon maken, maar omdat ik zichtbaar wilde maken wat er binnen mijn kennis, tijd en visie op het gebruik van AI maximaal mogelijk was.

Bij iedere versie heb ik geprobeerd om meer te laten zien dan een losse chatbot:

- welke vragen vooraf te verwachten zijn;
- welke gegevens hard beschikbaar kunnen zijn;
- welke routekeuzes met gewone code kunnen worden uitgevoerd;
- welke informatie nog ontbreekt;
- waar een menselijke adviseur nodig blijft;
- wat een taalmodel wel en niet zou moeten doen;
- hoe fouten, onzekerheid en brongebruik zichtbaar kunnen worden gemaakt.

De versies moeten daarom gelezen worden als opeenvolgende proefopstellingen. Iedere versie maakte iets nieuws mogelijk en maakte tegelijk zichtbaar waar de vorige opzet tekortschiet.

## 3. Februari 2026: eerste testversie en A/B-test

In februari 2026 stond de eerste werkende testversie klaar:

- app: [door010.lovable.app](https://door010.lovable.app/)
- code: [`E-AI-MODEL/door0101`](https://github.com/E-AI-MODEL/door0101)

Deze Lovable-versie was variant B in een A/B-test. De andere variant was een Replit-versie.

De openbare Lovable-repo bevat de testopzet voor variant B. In de onboardingcode staat onder andere:

- dat het om een A/B-test gaat;
- dat variant B wordt getest;
- dat testers ook de andere variant moesten testen;
- dat de werksessie op 23 februari plaatsvond;
- dat werd gekeken naar rolvastheid, fasegevoeligheid, betrouwbaarheid en tone of voice;
- dat automatisch testaccounts van `test2@doorai.nl` tot en met `test50@doorai.nl` werden toegewezen.

Code:

- [`TestOnboardingPopup.tsx`](https://github.com/E-AI-MODEL/door0101/blob/main/src/components/onboarding/TestOnboardingPopup.tsx)
- [`TestInfoModal.tsx`](https://github.com/E-AI-MODEL/door0101/blob/main/src/components/onboarding/TestInfoModal.tsx)

> [!NOTE]
> De openbare repo bewijst de A/B-opzet en variant B. De Replit-variant zelf is niet als openbare repository aan dit project gekoppeld.

## 4. Niet alleen antwoorden verzamelen, maar het proces uit elkaar halen

Na en tijdens de eerste test zijn honderden procesvragen verzameld.

Het doel daarvan was niet om simpelweg zoveel mogelijk teksten in een systeemprompt te stoppen. Ik heb geprobeerd om vragen te ontleden naar terugkerende informatiebehoeften, ontbrekende gegevens en mogelijke vervolgstappen.

Voorbeelden van terugkerende onderdelen zijn:

- onderwijssector;
- vooropleiding;
- gewenste rol;
- bevoegdheidsdoel;
- toelatingseisen;
- duur;
- kosten;
- salaris;
- regio;
- eerstvolgende stap.

De presentatie-repo bevat een vragenset die in februari 2026 is gegenereerd en waarin vraag-ID's tot in de zeshonderd voorkomen. De set bevat daarnaast bron-, route- en meta-items.

Bekijk:

- [`src/data/phase-detector-questions.json`](https://github.com/E-AI-MODEL/presentatie-door010/blob/main/src/data/phase-detector-questions.json)
- [`src/data/route-steps.json`](https://github.com/E-AI-MODEL/presentatie-door010/blob/main/src/data/route-steps.json)

## 5. Zoeken naar bestaande datasets

Bij het verzamelen en ordenen van de vragen is ook gezocht naar bestaande gegevens die niet opnieuw handmatig bedacht hoefden te worden.

Daarbij is onder andere gekeken naar:

- HOVI, Hoger Onderwijs Voorlichtings Informatie;
- route- en opleidingsinformatie uit de Onderwijsin-dataset en API;
- landelijke en regionale vraag-antwoordinformatie;
- bestaande routebeschrijvingen;
- informatie over toelating, duur, bevoegdheden, kosten en vervolgstappen.

In de presentatie-repo is HOVI expliciet als bronitem opgenomen in de vragenset. De routegegevens uit de eerdere omgeving zijn terug te vinden in `route-steps.json`.

Deze bronnen zijn niet automatisch een complete of actuele bron van waarheid. Ze waren materiaal om te onderzoeken wat al gestructureerd beschikbaar was en wat nog ontbrak.

## 6. Doorontwikkeling naar de presentatieversie

De eerste testversie is daarna doorontwikkeld tot een uitgebreidere presentatieversie:

- app: [demo-regio.lovable.app](https://demo-regio.lovable.app/)
- code: [`E-AI-MODEL/presentatie-door010`](https://github.com/E-AI-MODEL/presentatie-door010)

Deze versie is gebruikt voor een presentatie voor Onderwijsregio's Nederland.

De presentatieversie bracht meer onderdelen bij elkaar:

- een algemene en persoonlijke AI-component;
- een deterministische phasedetector;
- een vaste vraag- en slotstructuur;
- testaccounts en rolgebaseerde flows;
- landelijke en regionale inhoud;
- routegegevens;
- logging, validatie en promptbeheer;
- zichtbare onzekerheid en terugvalroutes.

De repo bevat een aparte toelichting op die opzet:

- [`data-talents-ai-doorai-definitief-met-visuals.md`](https://github.com/E-AI-MODEL/presentatie-door010/blob/main/data-talents-ai-doorai-definitief-met-visuals.md)

## 7. Het datamodel zichtbaar proberen te maken

Naast de chat- en routeomgeving ontstond de vraag hoe alle gegevens logisch bij elkaar horen.

Daarom is een aparte datamodelverkenning gemaakt:

- [door-datamodel-explorer.ai.studio](https://door-datamodel-explorer.ai.studio)

Deze explorer is bedoeld om zichtbaar te maken hoe onder andere personen, profielen, vragen, antwoorden, routes, opleidingen, instellingen, regio's en bronnen zich tot elkaar kunnen verhouden.

De explorer staat buiten deze repository. De link is hier opgenomen omdat het datamodel onderdeel is van dezelfde zoektocht, niet omdat de inhoud automatisch gelijkstaat aan het huidige databaseschema.

Het huidige technische datamodel staat in:

- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`migrations/`](migrations/)

## 8. Een aparte zoektocht naar retrieval, bronnen en begrenzing

Door mijn niet-technische achtergrond was ook de technische route zelf een zoektocht.

Een van de aparte experimenten daarin is:

- [`E-AI-MODEL/-rag-eat-starter-kit`](https://github.com/E-AI-MODEL/-rag-eat-starter-kit)

Deze repo onderzoekt een kleine, lokale en controleerbare retrieve-then-answer-route. De starter kit:

- zoekt eerst in documenten;
- geeft bronverwijzingen terug;
- gebruikt toegangsgroepen;
- geeft geen inhoudelijk antwoord wanneer de gevonden bronnen de vraag niet ondersteunen;
- kan standaard zonder externe LLM draaien;
- maakt gedrag en beperkingen controleerbaar via een apart EAT-profiel.

De RAG-EAT-repo is geen eerdere versie van Door010 en de code is niet één-op-één overgenomen. Het is een apart technisch experiment dat dezelfde ontwerpvragen onderzoekt: wat moet hard in data en code staan, wat mag een model doen en wanneer moet het systeem stoppen of teruggeven dat bewijs ontbreekt?

## 9. Waarom niet alles in een systeemprompt?

Mijn uitgangspunt is niet dat een LLM zoveel mogelijk vrijheid moet krijgen.

Mijn uitgangspunt is ook niet dat alle kennis, regels, routes, uitzonderingen en veiligheidsafspraken in één steeds grotere systeemprompt moeten worden gepropt.

Wat vooraf bekend en voorspelbaar is, probeer ik waar mogelijk expliciet vast te leggen in:

- datasets;
- domeinmodellen;
- routes;
- fases;
- profielvelden;
- validatieregels;
- bronhiërarchie;
- autorisatie;
- bevestigingsstappen;
- tests.

Daardoor hoeft een LLM niet iedere keer opnieuw te verzinnen:

- welke route bestaat;
- welke gegevens ontbreken;
- welke gebruiker iets mag wijzigen;
- welke fase geldt;
- welke bron voorrang heeft;
- wanneer een medewerker nodig is.

De LLM kan dan, wanneer die route inhoudelijk is getest, een beperktere taak krijgen: taal begrijpen, informatie helpen ordenen, resultaten formuleren en de finishing touch verzorgen.

Dat is een ontwerpdoel. De huidige LLM-route is nog niet voldoende doorgetest om te beweren dat dit doel al aantoonbaar is behaald.

## 10. Het probleem is niet opgelost door alleen meer of minder AI te gebruiken

Het [Onderzoek gemeentelijke chatbots 2026](https://www.digimonitor.nl/onderzoek/onderzoek-chatbot-2026/gespreksanalyse/) van Digimonitor onderzocht 39 gemeentelijke chatbots met in totaal 312 antwoorden.

Het onderzoek rapporteert onder andere:

- 64% fout beantwoorde vragen;
- 10% goed beantwoorde vragen;
- veel chatbots die vooral als gescripte zoekmachine werken;
- vaste antwoordsets en sleutelwoordherkenning;
- verouderde of dubbel beheerde content;
- foutieve links;
- wisselende resultaten bij chatbots die wel tekst genereren.

Ik lees dit onderzoek niet als bewijs dat één specifieke architectuur automatisch werkt.

Een volledig gescripte chatbot kan vastlopen in verkeerd onderhouden antwoordsets. Een vrij genererend taalmodel kan overtuigend klinken terwijl het antwoord niet klopt. Een grote systeemprompt lost slechte data, onduidelijke routes of ontbrekend contentbeheer niet vanzelf op.

Mijn antwoord op dat probleem is daarom niet simpelweg meer AI of minder AI. Ik probeer voorspelbare gegevens en beslissingen zo veel mogelijk controleerbaar in data en code te zetten, en een taalmodel alleen te gebruiken voor het deel waar taal en flexibiliteit werkelijk nodig zijn.

---

# Openbare projectonderdelen

| Onderdeel | Functie in het project | Link |
| --- | --- | --- |
| Eerste Lovable-testversie | Variant B van de A/B-test | [App](https://door010.lovable.app/) · [Code](https://github.com/E-AI-MODEL/door0101) |
| Replit-variant | Variant A van de A/B-test | Niet openbaar aan deze repo gekoppeld |
| Presentatieversie | Uitgebreide test- en demonstratieomgeving | [App](https://demo-regio.lovable.app/) · [Code](https://github.com/E-AI-MODEL/presentatie-door010) |
| Datamodel explorer | Visuele verkenning van de gegevenssamenhang | [Explorer](https://door-datamodel-explorer.ai.studio) |
| RAG-EAT Starter Kit | Apart experiment met retrieval-first, bronnen en onthouding | [Code](https://github.com/E-AI-MODEL/-rag-eat-starter-kit) |
| Door010 huidige repo | Doorontwikkeling richting losse, testbare onderdelen | [Code](https://github.com/E-AI-MODEL/door010) |

---

# Het uitgangspunt

Het ontwerp vertrekt vanuit de aanname dat een deel van de bezoekersvragen vooraf te voorzien is.

Dat is nog geen bewijs dat de huidige dataset alle echte vragen goed dekt. Het verklaart wel waarom vragen, alternatieve formuleringen, routes en bronnen expliciet in de repo staan.

```mermaid
flowchart LR
    Q["Vraag van bezoeker"]
    K["Bekende vraag, alias of context"]
    R["Kennis, route of vaste flow"]
    A["Antwoord of vervolgvraag"]
    H["Medewerker wanneer nodig"]

    Q --> K
    K --> R
    R --> A
    A --> H
```

## Vragen en alternatieve formuleringen

In [`datasets/faq-seed.json`](datasets/faq-seed.json) staan vragen, aliases, antwoorden, categorieën, tags en bronverwijzingen.

Hierdoor hoeft een bezoeker niet altijd exact dezelfde woorden te gebruiken als in de hoofdvraag.

<details>
<summary><strong>Waar wordt dit gebruikt?</strong></summary>

Begin bij:

- [`datasets/faq-seed.json`](datasets/faq-seed.json)
- [`packages/knowledge/`](packages/knowledge/)
- [`scripts/evaluate-hybrid-retrieval.ts`](scripts/evaluate-hybrid-retrieval.ts)
- [`docs/HYBRID_RETRIEVAL_3_0.md`](docs/HYBRID_RETRIEVAL_3_0.md)

De aanwezigheid van aliases bewijst niet dat iedere bezoekersvraag goed wordt gevonden. Daarvoor zijn onafhankelijke testvragen en gebruikerstests nodig.

</details>

## Routes en fases

Route- en fasekeuzes zijn niet uitsluitend afhankelijk van vrije tekstgeneratie.

De repo bevat aparte domeinonderdelen voor:

- routebepaling;
- fasebepaling;
- profielvelden;
- doelen en acties;
- persoonlijke voortgang.

Begin bij:

- [`packages/domain/`](packages/domain/)
- [`datasets/routes.json`](datasets/routes.json)
- [`packages/chat/src/index.ts`](packages/chat/src/index.ts)
- [`packages/orchestration/`](packages/orchestration/)

Zoek naar:

- `RouteEngine`
- `AdaptivePhaseDetector`
- `JourneyEngine`
- `PersonalJourneyCoach`

---

# Vier ingangen

Een gebruiker kan Door010 op vier manieren gebruiken.

```mermaid
flowchart LR
    U["Gebruiker"]

    U --> W["1. Website en vaste flows"]
    U --> M["2. Menselijke adviseur"]
    U --> G["3. Algemene coach"]
    U --> P["4. Persoonlijke coach"]

    W --> W1["Kennis, route, talent, events en vacatures"]
    M --> M1["Gesprek met een medewerker"]
    G --> G1["Algemene vragen"]
    P --> P1["Profiel- en trajectcontext"]
```

De website is een ingang, maar geen gesprekstype.

In de code bestaan drie gesprekstypen:

- `general-ai`
- `personal-ai`
- `advisor`

## Hoe een antwoord betrouwbaar blijft

Het onderscheidende van Door010 zit niet in "er komt tekst uit", maar in de
grenzen daaromheen: de deterministische engines zijn de bron van waarheid, het
taalmodel verwoordt maar bepaalt niets zelf, de algemene coach weigert netjes
wat buiten het onderwijs valt, en een validator is de laatste grens vóór het
antwoord de deur uit gaat.

```mermaid
flowchart TD
    Q["Vraag van de gebruiker"]

    Q -->|algemene coach| GATE{"Answerability-poort<br/>raakt de vraag het onderwijs?"}
    GATE -->|nee| DEC["Nette weigering + uitnodiging<br/>geen bron, geen verzonnen antwoord"]
    GATE -->|ja| RET["Retrieval<br/>FTS + semantisch + trusted-source web-fallback"]

    Q -->|persoonlijke coach| ENG["Deterministische engines<br/>Phase - Route - Journey<br/>= bron van waarheid"]
    ENG --> LLMP["LLM verwoordt de context<br/>muteert zelf niets"]

    RET --> VAL["Validatie en repair<br/>de laatste grens"]
    LLMP --> VAL
    VAL --> ANS["Antwoord"]

    ORCH["Orchestrator<br/>parallelle plan-only laan<br/>levert intent + plan voor uitleg"] -.->|voegt metadata toe| ANS
```

- **Algemene coach:** stateless en publiek. De poort laat door zodra de vraag
  het onderwijs raakt en weigert anders zonder een least-bad record als bron te
  presenteren.
- **Persoonlijke coach:** de engines beslissen over fase, route en journey; het
  model verwoordt dat en stelt wijzigingen als bevestigbare voorstellen voor.
- **Adviseurchat:** puur menselijk, geen AI-generatie.
- **Orchestrator:** loopt op de chatkanalen plan-only mee voor explainability en
  vervangt het coachantwoord niet.

<details>
<summary><strong>1. Website en vaste flows</strong></summary>

De gebruiker kan zonder chat verschillende onderdelen openen:

- algemene coach;
- persoonlijke coach;
- persoonlijk traject;
- profiel;
- kennisbank;
- routeverkenning;
- talententest;
- evenementen;
- vacatures;
- adviseurschat;
- backoffice;
- account.

**Letterlijk fragment uit [`apps/web/src/main.ts`](apps/web/src/main.ts):**

```ts
type View =
  | "public-chat"
  | "personal-chat"
  | "journey-dashboard"
  | "profile"
  | "knowledge"
  | "route"
  | "talent"
  | "events"
  | "vacancies"
  | "advisor-chat"
  | "backoffice"
  | "account";
```

De verschillende views hebben aparte API-routes en services. De webapp is dus niet alleen een scherm rond één chatbotendpoint.

Code:

- [`apps/web/src/main.ts`](apps/web/src/main.ts)
- [`apps/api/src/parity-flow-routes.ts`](apps/api/src/parity-flow-routes.ts)
- [`packages/parity-flows/`](packages/parity-flows/)
- [`datasets/`](datasets/)

</details>

<details>
<summary><strong>2. Menselijke adviseur</strong></summary>

De adviseurschat is bedoeld voor communicatie tussen een gebruiker en een medewerker.

Dit kanaal staat los van de algemene en persoonlijke coach.

Code:

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `AdvisorChatService`
- [`apps/api/src/server.ts`](apps/api/src/server.ts), zoek naar `/v1/chat/candidate` en `/v1/chat/advisor`
- [`packages/backoffice/`](packages/backoffice/)
- [`packages/realtime/`](packages/realtime/)

De API bevat daarnaast een beveiligde berichtenhistorie en een SSE-stream voor realtimeberichten.

</details>

<details>
<summary><strong>3. Algemene coach</strong></summary>

De algemene coach is bedoeld voor algemene vragen over werken en leren in het onderwijs.

Hij hoort geen persoonlijke journey-state nodig te hebben.

Code:

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `GeneralCoach`
- [`packages/knowledge/`](packages/knowledge/)
- [`packages/response-pipeline/`](packages/response-pipeline/)
- [`apps/api/src/server.ts`](apps/api/src/server.ts), zoek naar `/v1/chat/general`

De antwoordprovider wordt als afhankelijkheid aan de coach meegegeven. Daardoor kan de chatlaag met verschillende antwoordproviders werken.

De kwaliteit van iedere mogelijke provider moet afzonderlijk worden getest.

</details>

<details>
<summary><strong>4. Persoonlijke coach</strong></summary>

De persoonlijke coach gebruikt gegevens van een ingelogde gebruiker.

Dat kan gaan om:

- profielgegevens;
- route-antwoorden;
- fase;
- doelen;
- milestones;
- blockers;
- acties;
- eerder opgeslagen context.

De coach kan een wijziging voorstellen. Gevoelige wijzigingen horen niet stilzwijgend te worden uitgevoerd.

Code:

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `PersonalJourneyCoach`
- [`packages/domain/`](packages/domain/)
- [`packages/orchestration/`](packages/orchestration/)
- [`apps/api/src/graph-execution-routes.ts`](apps/api/src/graph-execution-routes.ts)
- [`apps/api/src/server.ts`](apps/api/src/server.ts), zoek naar `/v1/chat/personal`

</details>

---

# LLM: aanwezig, maar nog niet inhoudelijk doorgetest

De repo bevat meerdere aansluitpunten voor een taalmodel.

De Codespaces-configuratie probeert automatisch een klein lokaal model via Ollama te installeren. Een OpenAI-compatible endpoint kan ook via environmentvariabelen worden aangesloten.

De invloed van die LLM-route is nog niet voldoende doorgetest.

Daarom doet deze README geen uitspraken als:

- antwoorden met LLM zijn beter;
- antwoorden met LLM zijn natuurlijker;
- retrieval met LLM is aantoonbaar nauwkeuriger;
- een model verbetert de gekozen route;
- de modeluitvoer is geschikt voor productie.

Daarvoor is eerst een gecontroleerde vergelijking nodig.

## Wat moet nog worden vergeleken?

Minimaal:

1. dezelfde onafhankelijke testvragen;
2. dezelfde datasets en bronnen;
3. uitvoering zonder LLM;
4. uitvoering met de lokale LLM;
5. eventueel uitvoering met een externe provider;
6. juistheid van het antwoord;
7. ongewenste toevoegingen;
8. brongebruik;
9. latency;
10. kosten;
11. privacy en gegevensdeling.

---

# De route zonder LLM

Door010 kan ook starten wanneer geen LLM beschikbaar is.

In dat geval gebruikt de coach de extractieve en deterministische route uit de code.

**Letterlijk fragment uit [`scripts/demo.mjs`](scripts/demo.mjs):**

```js
if (!hasOllama) {
  console.log(
    "[llm] Ollama niet gevonden - de coach antwoordt " +
    "extractief uit de kennisbank (bash " +
    "scripts/setup-demo-llm.sh installeert de demo-LLM)"
  );
  return {};
}
```

Na deze controle starten de API en webapp nog steeds.

**Letterlijk fragment uit [`scripts/demo.mjs`](scripts/demo.mjs):**

```js
start("api", "npm", ["run", "dev", "--workspace", "@door010/api"], {
  env: {
    DATASETS_DIRECTORY:
      process.env.DATASETS_DIRECTORY ?? resolve(root, "datasets"),
    ...llmEnv
  }
});
start("web", "npm", [
  "run",
  "dev",
  "--workspace",
  "@door010/web",
  "--",
  "--host",
  "127.0.0.1"
]);
```

Zonder actieve LLM blijven onder andere beschikbaar:

- de website;
- route- en fasecode;
- profielvelden;
- journeygegevens;
- lokale kennisretrieval;
- deterministische antwoordopbouw;
- adviseurschat;
- evenementen- en vacatureflows;
- backoffice;
- het persoonlijke dashboard.

Actuele data uit externe event- of vacatureproviders vereist wel een geconfigureerde koppeling.

<details>
<summary><strong>Waar staat de deterministische antwoordprovider?</strong></summary>

Bekijk:

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts)
- zoek naar `DeterministicAnswerDraftProvider`

Deze class bouwt voor de algemene coach een vast antwoord op en gebruikt voor de persoonlijke coach onder andere route-, graph- en fasegegevens.

De volledige class is niet in deze README gekopieerd, omdat een verkorte versie geen letterlijke kopie van het origineel zou zijn.

</details>

<details>
<summary><strong>Hoe krijg je bewust de route zonder LLM?</strong></summary>

De fallback zonder LLM wordt gebruikt wanneer:

- `LLM_BASE_URL` niet is ingesteld;
- Ollama niet beschikbaar is.

De huidige demo heeft nog geen aparte environmentvariabele waarmee de LLM-route expliciet kan worden uitgezet.

Daarom is een toekomstige instelling zoals `DEMO_LLM_ENABLED=false` wenselijk voor zuivere A/B-tests. Die instelling bestaat nu nog niet en wordt hier dus niet als werkend commando gepresenteerd.

</details>

---

# Codespaces

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/E-AI-MODEL/door010?quickstart=1)

De Codespaces-configuratie probeert automatisch een lokaal taalmodel te installeren.

**Letterlijk bestand [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json):**

```json
{
  "name": "Door010 demo",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",
  "containerEnv": {
    "DATASETS_DIRECTORY": "${containerWorkspaceFolder}/datasets"
  },
  "postCreateCommand": "npm ci && npx tsc -b && (bash scripts/setup-demo-llm.sh || true)",
  "forwardPorts": [5173, 4000],
  "portsAttributes": {
    "5173": {
      "label": "Door010 webapp",
      "onAutoForward": "openPreview"
    },
    "4000": {
      "label": "Door010 API",
      "onAutoForward": "silent"
    }
  },
  "postAttachCommand": {
    "demo": "npm run demo"
  }
}
```

Hieruit volgt:

1. de Codespace gebruikt Node.js 22;
2. `npm ci` wordt uitgevoerd;
3. TypeScript wordt gebouwd;
4. `scripts/setup-demo-llm.sh` wordt uitgevoerd;
5. fouten bij de LLM-installatie blokkeren de Codespace niet;
6. poorten `5173` en `4000` worden doorgestuurd;
7. `npm run demo` start automatisch.

## Wat installeert het LLM-script?

`scripts/setup-demo-llm.sh`:

- controleert of Ollama aanwezig is;
- installeert Ollama wanneer dat niet zo is;
- start de Ollama-server;
- haalt het ingestelde demomodel op.

Het standaardmodel is:

```text
hf.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M
```

Wanneer dat lukt, gebruikt de demo een lokaal OpenAI-compatible endpoint.

**Letterlijk fragment uit [`scripts/demo.mjs`](scripts/demo.mjs):**

```js
return {
  LLM_BASE_URL: `${endpoint}/v1`,
  LLM_API_KEY: "ollama-demo",
  LLM_MODEL: model,
  LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS ?? "120000"
};
```

> [!IMPORTANT]
> Een Codespaces-demo is dus niet automatisch een test zonder LLM.
>
> Wanneer Ollama en het model beschikbaar zijn, wordt de lokale LLM-route gebruikt. Wanneer de installatie mislukt of Ollama niet beschikbaar is, valt de demo terug op de route zonder LLM.

Er is voor het lokale Ollama-model geen externe commerciële LLM-provider of externe API-sleutel nodig.

Dat zegt nog niets over de inhoudelijke kwaliteit van het model. Die moet apart worden getest.

---

# Retrieval en antwoordopbouw

De repo bevat een eigen retrieval- en antwoordpipeline.

De huidige retrievallaag kan verschillende zoekresultaten combineren:

- PostgreSQL full-text search;
- fuzzy search;
- lokale semantische representatie;
- optionele externe embeddings;
- reciprocal-rank fusion;
- bronselectie;
- conditionele reranking;
- antwoordopbouw en validatie.

Lees:

- [`packages/knowledge/`](packages/knowledge/)
- [`packages/response-pipeline/`](packages/response-pipeline/)
- [`scripts/evaluate-hybrid-retrieval.ts`](scripts/evaluate-hybrid-retrieval.ts)
- [`docs/HYBRID_RETRIEVAL_3_0.md`](docs/HYBRID_RETRIEVAL_3_0.md)
- [`docs/AI_PARITY_PIPELINE.md`](docs/AI_PARITY_PIPELINE.md)

## Is dit RAG?

Zonder generatief model is dit vooral een retrieval- en antwoordpipeline.

Wanneer een aangesloten taalmodel de opgehaalde informatie gebruikt om een antwoord te genereren, kan deze route als RAG worden gebruikt.

De standaardcode ondersteunt dus een RAG-route, maar de inhoudelijke werking van de LLM-stap is nog niet voldoende getest.

---

## Let op met de retrievalpercentages

De huidige benchmark is bruikbaar als interne regressietest.

Hij kan bijvoorbeeld laten zien of een codewijziging op dezelfde dataset slechter scoort dan de vorige versie.

De percentages zijn geen onafhankelijke productvalidatie.

Een deel van de benchmark gebruikt exacte vragen en aliases uit de brondata. Diezelfde velden worden ook gebruikt om de zoekrepresentatie op te bouwen.

**Letterlijk fragment uit [`scripts/evaluate-hybrid-retrieval.ts`](scripts/evaluate-hybrid-retrieval.ts):**

```ts
const titleEmphasis = 3;
const faqTexts = faqDataset.faqs.map((faq) =>
  [
    ...Array<string>(titleEmphasis).fill(faq.question),
    ...(faq.aliases ?? []),
    faq.answer,
    faq.category ?? "",
    ...(faq.tags ?? [])
  ].join(" ")
);
```

De benchmark bevat tegelijk vragen die expliciet als alias uit de brondata zijn gemarkeerd.

**Letterlijk fragment uit [`datasets/retrieval-benchmark.json`](datasets/retrieval-benchmark.json):**

```json
{
  "id": "alias-004",
  "query": "Wat heb ik nodig voor zij-instroom",
  "queryType": "alias",
  "relevantQuestions": [
    "Wat zijn de toelatingseisen voor het zij-instroomtraject?"
  ],
  "notes": "Alias uit de brondata.",
  "groupId": "aef0c77be3b7"
}
```

Hoge scores bij `exact` en `alias` zijn daardoor niet verrassend.

### De benchmark is wel bruikbaar voor

- regressies tussen codeversies;
- vergelijking van instellingen op dezelfde dataset;
- het vinden van misses;
- het controleren van minimumgrenzen;
- het onderzoeken van fouttypen.

### Voor een sterkere kwaliteitsclaim is nog nodig

- een afgeschermde hold-outset;
- vragen die niet uit de indexvelden zijn afgeleid;
- vragen van echte bezoekers;
- onafhankelijke relevantiebeoordeling;
- aparte tests voor route-, loket- en meerstapsvragen;
- rapportage van twijfelgevallen;
- gescheiden resultaten met en zonder LLM.

---

# Starten

## Lokale demo

Gebruik deze route om de webapp en API zonder PostgreSQL te starten.

Vereisten:

- Node.js 22 of hoger;
- npm;
- Git.

```bash
git clone https://github.com/E-AI-MODEL/door010.git
cd door010
npm ci
npx tsc -b
npm run demo
```

De demo meldt bij het starten:

```text
Webapp: http://127.0.0.1:5173
API: http://127.0.0.1:4000
```

Stop beide processen met <kbd>Ctrl</kbd> + <kbd>C</kbd>.

> [!NOTE]
> `npm run demo` controleert of Ollama beschikbaar is.
>
> Is Ollama beschikbaar, dan probeert de demo het lokale model te gebruiken. Is Ollama niet beschikbaar en is `LLM_BASE_URL` niet ingesteld, dan gebruikt de coach de route zonder LLM.

<details>
<summary><strong>Openbare demoaccounts</strong></summary>

| Rol | E-mailadres | Wachtwoord |
| --- | --- | --- |
| Kandidaat | `test21@doorai.nl` | `admin010` |
| Administrator | `admin@doorai.nl` | `admin010` |

Dit zijn openbare testaccounts.

Gebruik alleen fictieve gegevens. Iedereen met toegang tot de demo kan het administratoraccount gebruiken.

Bij in-memory opslag worden de accounts tijdens het starten aangemaakt of hersteld. De gegevens verdwijnen wanneer de demo stopt.

Een PostgreSQL-testomgeving maakt deze accounts alleen aan wanneer dit expliciet is ingesteld:

```bash
DEMO_ACCOUNTS_ENABLED=true
```

Gebruik deze instelling niet met echte gebruikersgegevens.

Alleen in de demo (in-memory of `DEMO_ACCOUNTS_ENABLED=true`) vervalt de minimale wachtwoordlengte bij registratie. Buiten de demo blijft de volledige eis (minimaal 12 tekens) gelden, zodat de demo-uitzondering echte registraties niet verzwakt.

</details>

<details>
<summary><strong>Een andere OpenAI-compatible provider aansluiten</strong></summary>

Voorbeeld voor bash of zsh:

```bash
export LLM_BASE_URL="https://provider.example/v1"
export LLM_API_KEY="replace-me"
export LLM_MODEL="replace-me"
npm run demo
```

De waarden in dit voorbeeld zijn placeholders.

Een werkende aansluiting bewijst nog niet dat de provider inhoudelijk, juridisch of technisch geschikt is voor productie.

</details>

---

## PostgreSQL-omgeving

Gebruik deze route wanneer je wilt werken aan:

- persistente opslag;
- migraties;
- autorisatie;
- realtimefunctionaliteit;
- providers;
- databasegedrag.

Vereisten:

- Node.js 22 of hoger;
- npm;
- Docker;
- Docker Compose;
- bij voorkeur een PostgreSQL-client voor hersteltests.

Start eerst de ondersteunende diensten:

```bash
git clone https://github.com/E-AI-MODEL/door010.git
cd door010
npm ci
docker compose up -d
```

Docker Compose start:

- PostgreSQL;
- Redis;
- MinIO.

Docker Compose start niet automatisch de lokale Node-API en webapp. Die start je apart.

> [!NOTE]
> `npm run dev` start alleen de API.
>
> `npm run dev:web` start de webapp.

### Bash of zsh

Terminal 1:

```bash
export APP_STORAGE_MODE=postgres
export DATABASE_URL="postgresql://door010:door010@127.0.0.1:5432/door010"
export AUTH_TOKEN_SECRET="$(openssl rand -hex 32)"

npm run migrate
npm run seed
npm run dev
```

Terminal 2:

```bash
npm run dev:web
```

### PowerShell

Terminal 1:

```powershell
$env:APP_STORAGE_MODE = "postgres"
$env:DATABASE_URL = "postgresql://door010:door010@127.0.0.1:5432/door010"
$env:AUTH_TOKEN_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")

npm run migrate
npm run seed
npm run dev
```

Terminal 2:

```powershell
npm run dev:web
```

<details>
<summary><strong>Waarom niet alleen verwijzen naar .env?</strong></summary>

Docker Compose leest automatisch waarden uit een lokaal `.env`-bestand.

De Node-processen in deze repo laden `.env` niet zelfstandig. De benodigde variabelen moeten dus echt beschikbaar zijn in:

- de shell;
- een IDE-runconfiguratie;
- een process manager;
- een deploymentomgeving.

Minimaal nodig voor PostgreSQL:

```text
APP_STORAGE_MODE=postgres
DATABASE_URL=postgresql://...
AUTH_TOKEN_SECRET=...
```

`.env.example` laat zien welke andere instellingen beschikbaar zijn.

Commit nooit echte sleutels, tokens, wachtwoorden of persoonsgegevens.

</details>

<details>
<summary><strong>Stoppen en opnieuw beginnen</strong></summary>

Stop de Node-processen met <kbd>Ctrl</kbd> + <kbd>C</kbd>.

Stop de containers:

```bash
docker compose down
```

Verwijder ook de lokale volumes en testgegevens:

```bash
docker compose down -v
```

Gebruik `-v` alleen wanneer de opgeslagen lokale gegevens echt mogen verdwijnen.

</details>

---

# Eerste wijziging

Begin met iets dat direct zichtbaar is.

1. Start de demo.
2. Open [`apps/web/src/main.ts`](apps/web/src/main.ts).
3. Zoek naar een zichtbare tekst in de webapp.
4. Pas de tekst aan.
5. Controleer de wijziging in de browser.
6. Voer de basiscontroles uit.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Voor wijzigingen aan database, flows of retrieval zijn aanvullende controles nodig. Zie [Controles](#controles).

---

# Waar staat wat?

| Ik wil iets aanpassen aan... | Begin hier | Zoek naar |
| --- | --- | --- |
| Schermen, navigatie of tekst | [`apps/web/`](apps/web/) | `type View`, `renderShell` |
| API-routes en invoervalidatie | [`apps/api/`](apps/api/) | `register...Routes`, Zod-schema's |
| Algemene coach | [`packages/chat/`](packages/chat/) | `GeneralCoach` |
| Persoonlijke coach | [`packages/chat/`](packages/chat/) | `PersonalJourneyCoach` |
| Menselijke adviseurschat | [`packages/chat/`](packages/chat/) | `AdvisorChatService` |
| Deterministische antwoorden | [`packages/chat/`](packages/chat/) | `DeterministicAnswerDraftProvider` |
| Antwoordstructuur | [`packages/response-pipeline/`](packages/response-pipeline/) | `createStructuredResponse` |
| Profiel en authenticatie | [`packages/identity-profile/`](packages/identity-profile/) | profiel- en tokenservices |
| Routebepaling | [`packages/domain/`](packages/domain/) | `RouteEngine` |
| Routegegevens | [`datasets/routes.json`](datasets/routes.json) | route-ID's en stappen |
| Fasebepaling | [`packages/domain/`](packages/domain/) | `AdaptivePhaseDetector` |
| Doelen, blockers en acties | [`packages/domain/`](packages/domain/) | `JourneyEngine` |
| Graphcontext | [`packages/domain/`](packages/domain/) | `GraphMemory` |
| Kenniszoeken en bronnen | [`packages/knowledge/`](packages/knowledge/) | retrieval en ingestion |
| Aansturing van onderdelen | [`packages/orchestration/`](packages/orchestration/) | orchestrator en planner |
| Databasecontracten | [`packages/database/`](packages/database/) | repositoryinterfaces |
| PostgreSQL | [`packages/postgres/`](packages/postgres/) | `PgSqlExecutor` |
| Schemawijzigingen | [`migrations/`](migrations/) | volgend migratienummer |
| Externe koppelingen | [`packages/integrations/`](packages/integrations/) | adapters, retries en circuit breakers |
| Backoffice | [`packages/backoffice/`](packages/backoffice/) | prompts, alerts en kandidaatdetail |
| Realtimeberichten | [`packages/realtime/`](packages/realtime/) | broker en subscriptions |
| Browsertests | [`apps/web/`](apps/web/) | Playwright |
| CI en hersteltests | [`.github/`](.github/) en [`scripts/`](scripts/) | workflows en acceptance |

<details>
<summary><strong>Repositorystructuur</strong></summary>

```text
.github/       GitHub Actions, templates en deploymentcontroles
.devcontainer/ Codespaces-configuratie
apps/api/      API, routes, security en opstartcode
apps/web/      Webapp en browsertests
packages/      Domeinlogica, contracten, opslag en koppelingen
datasets/      Vragen, routes, fases en kennisdata
migrations/    PostgreSQL-migraties
scripts/       Demo, verificatie, benchmarks en hersteltests
docs/          Audits, ontwerpkeuzes en technische uitleg
```

</details>

<details>
<summary><strong>Belangrijkste samenhang</strong></summary>

```mermaid
flowchart TD
    WEB["apps/web"] --> API["apps/api"]

    API --> CHAT["packages/chat"]
    API --> FLOWS["packages/parity-flows"]
    API --> ORCH["packages/orchestration"]

    CHAT --> DOMAIN["packages/domain"]
    CHAT --> KNOW["packages/knowledge"]
    ORCH --> DOMAIN
    ORCH --> KNOW

    API --> DATABASE["databasecontracten en adapters"]
    DATABASE --> POSTGRES[("PostgreSQL")]
```

Dit diagram toont de hoofdroute. Het is geen volledige weergave van iedere TypeScript-import.

</details>

---

# Regels die je niet zomaar moet doorbreken

Lees vóór grotere wijzigingen:

- [`AGENTS.md`](AGENTS.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

<details>
<summary><strong>Houd de kanalen uit elkaar</strong></summary>

De algemene coach, persoonlijke coach en menselijke adviseurschat hebben elk een eigen functie.

Voeg persoonlijke journeycontext niet ongemerkt toe aan de algemene coach.

Presenteer een AI-antwoord niet als bericht van een medewerker.

</details>

<details>
<summary><strong>Laat de domeincode de route bepalen</strong></summary>

De vastgelegde bronnen van waarheid zijn:

| Onderwerp | Bron |
| --- | --- |
| Persistente gegevens | PostgreSQL |
| Routebepaling | Route Engine |
| Fasebepaling | Phase Engine |
| Persoonlijk traject | Journey Engine |
| Graphcontext | Afgeleide projectie |
| Aansturing | Orchestrator |
| LLM-output | Te valideren uitvoer |

Een taalmodel hoort route-, fase- of journey-uitkomsten niet zelfstandig opnieuw te bepalen.

</details>

<details>
<summary><strong>Graph Memory is niet de primaire opslag</strong></summary>

Graph Memory is een projectie van bestaande journeygegevens.

Een projectie kan opnieuw worden opgebouwd of tijdelijk achterlopen. Wijzigingen horen daarom via de Journey Engine en primaire repositories te lopen.

</details>

<details>
<summary><strong>Persoonlijke wijzigingen vragen controle</strong></summary>

Een model, agent of gebruiker kan een wijziging voorstellen.

Gevoelige wijzigingen vragen waar nodig:

1. authenticatie;
2. autorisatie;
3. invoervalidatie;
4. expliciete bevestiging;
5. auditregistratie;
6. foutafhandeling.

Sla deze stappen niet over om een demo sneller te laten werken.

</details>

<details>
<summary><strong>Houd externe providers buiten de domeinlogica</strong></summary>

Plaats code voor een specifieke LLM-, zoek-, event-, vacature- of notificatieprovider achter een adapter.

Hardcode die logica niet in:

- domeinmodellen;
- engines;
- generieke API-contracten;
- generieke orchestrationcontracten.

</details>

<details>
<summary><strong>Wijzig bestaande migraties niet</strong></summary>

Iedere databasewijziging krijgt een nieuwe, oplopende migratie.

Bestaande migraties hebben checksums. Een wijziging aan een al toegepaste migratie veroorzaakt bewust:

```text
Migration checksum mismatch
```

Controleer databasewijzigingen met:

```bash
npm run verify:migrations
npm run verify:seed
```

</details>

<details>
<summary><strong>Persoonlijke coachvragen zijn gevoelige context</strong></summary>

De persoonlijke coach kan profiel-, route-, fase- en journeygegevens gebruiken.

Ruwe persoonlijke coachvragen gaan standaard niet naar de optionele externe webzoekprovider.

Een systeemprompt is geen beveiligingsgrens. Privacy- en kanaalregels moeten ook in code, validatie, autorisatie en tests worden afgedwongen.

</details>

---

# Controles

## Basiscontroles

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Voor een pull request

Het rootproject bevat hiervoor ook:

```bash
npm run ci
```

Dit script voert uit:

- dependency-audit;
- typecheck;
- tests;
- build;
- migratiecontrole;
- seedcontrole.

## Frontend- en flowwijzigingen

```bash
npm run test:e2e
```

## Retrievalwijzigingen

```bash
npm run benchmark:hybrid:check
npm run benchmark:reranker:check
npm run benchmark:shadow-reranker:check
```

Behandel benchmarkresultaten als regressie-evidence binnen de gebruikte dataset. Niet als onafhankelijke gebruikerstest.

<details>
<summary><strong>Wanneer is een wijziging klaar?</strong></summary>

Een wijziging is klaar wanneer:

- het bedoelde gedrag aantoonbaar werkt;
- relevante tests slagen;
- typecheck, lint en build slagen;
- migraties en seedcontrole slagen wanneer die zijn geraakt;
- documentatie is bijgewerkt;
- geen secrets of echte persoonsgegevens zijn toegevoegd;
- security- en privacygevolgen zijn bekeken;
- bekende beperkingen zijn vastgelegd.

</details>

<details>
<summary><strong>Git-werkwijze</strong></summary>

1. Beschrijf het probleem in een issue of pull request.
2. Werk op een korte branch.
3. Houd de wijziging gericht.
4. Voeg tests en documentatie toe.
5. Voer de relevante controles uit.
6. Open een pull request naar `main`.

Aanbevolen branchnamen:

```text
feature/<onderwerp>
fix/<onderwerp>
docs/<onderwerp>
chore/<onderwerp>
```

Zie [`CONTRIBUTING.md`](CONTRIBUTING.md).

</details>

---

# API-startpunten

De API-paden veranderen niet door het besturingssysteem of de hardware.

De basis-URL hangt wel af van:

- de ingestelde host en poort;
- Docker-portmapping;
- Codespaces port forwarding;
- de staging- of productieomgeving.

Bij de standaard lokale demo is de basis-URL:

```text
http://127.0.0.1:4000
```

Veelgebruikte paden:

```text
GET  /health/live
GET  /health/ready
GET  /health
GET  /v1/system/capabilities
POST /v1/chat/general
POST /v1/chat/personal
```

Voorbeelden bij de standaard lokale demo:

```text
http://127.0.0.1:4000/health
http://127.0.0.1:4000/v1/system/capabilities
```

In Codespaces gebruik je de doorgestuurde URL van poort `4000`.

**Letterlijk fragment uit [`apps/api/src/server.ts`](apps/api/src/server.ts):**

```ts
const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);
```

`0.0.0.0` is het adres waarop de server luistert. Het is niet het adres dat je normaal in de browser invoert.

<details>
<summary><strong>Meer API-routes</strong></summary>

De API bevat daarnaast routes voor:

- authenticatie;
- profiel;
- route;
- fase;
- talent;
- kennis;
- journeys;
- adviseurschat;
- backoffice;
- providers;
- orchestration;
- graph;
- bevestigbare wijzigingen;
- metrics.

Begin bij [`apps/api/src/server.ts`](apps/api/src/server.ts) om te zien welke routes tijdens het starten worden geregistreerd.

</details>

---

# Status en bekende grenzen

De rootpackage van deze repository staat op versie `5.0.1`.

De readinessstatus is `CONDITIONAL_GO`.

Dat betekent dat de repo veel technische onderdelen bevat, maar dat de uiteindelijke productieomgeving nog niet volledig is bewezen.

Nog apart te testen of goed te keuren:

- de LLM-route;
- staging in de doelomgeving;
- echte externe providers;
- belasting in de doelomgeving;
- databaseherstel in de doelomgeving;
- privacy en DPIA;
- beheer en monitoring;
- een formeel go-livebesluit.

## Bekende versie-inconsistentie

De rootpackage staat op `5.0.1`.

De API-healthresponses bevatten momenteel nog `4.1.0` en de webfooter bevat nog `Door010 3.0`.

Deze labels moeten vanuit één centrale versiebron gelijk worden getrokken.

Behandel `5.0.1` daarom als repositoryversie, niet als bewijs dat ieder zichtbaar versielabel al is bijgewerkt.

<details>
<summary><strong>Wat betekent CONDITIONAL_GO hier?</strong></summary>

Lokale groene tests laten zien dat de geteste code in de geteste omgeving werkt.

Ze zijn geen automatische productiegoedkeuring.

Schrijf daarom niet dat Door010 productieklaar is wanneer de tests in de uiteindelijke omgeving en de vereiste privacy- en beheerbesluiten nog ontbreken.

Lees:

- [`docs/PRODUCTION_READINESS_4_4.md`](docs/PRODUCTION_READINESS_4_4.md)
- [`docs/CI_LOAD_RESTORE_4_5.md`](docs/CI_LOAD_RESTORE_4_5.md)
- [`CHANGELOG.md`](CHANGELOG.md)

</details>

---

# Verder lezen

| Vraag | Document |
| --- | --- |
| Hoe zit het systeem in elkaar? | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Welke regels gelden voor ontwikkelaars en agents? | [`AGENTS.md`](AGENTS.md) |
| Hoe lever ik een wijziging aan? | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Hoe meld ik een kwetsbaarheid? | [`SECURITY.md`](SECURITY.md) |
| Waar krijg ik ondersteuning? | [`SUPPORT.md`](SUPPORT.md) |
| Hoe ziet het datamodel eruit? | [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) |
| Hoe is het gedrag uit eerdere apps gecontroleerd? | [`docs/FULL_PARITY_AUDIT_1_TO_10.md`](docs/FULL_PARITY_AUDIT_1_TO_10.md) |
| Hoe werkt de orchestrator? | [`docs/AI_ORCHESTRATOR_3_9.md`](docs/AI_ORCHESTRATOR_3_9.md) |
| Hoe werkt de Journey Engine? | [`docs/JOURNEY_ENGINE_2_3_8.md`](docs/JOURNEY_ENGINE_2_3_8.md) |
| Hoe werkt retrieval? | [`docs/HYBRID_RETRIEVAL_3_0.md`](docs/HYBRID_RETRIEVAL_3_0.md) |
| Welke productieblokkades zijn vastgelegd? | [`docs/PRODUCTION_READINESS_4_4.md`](docs/PRODUCTION_READINESS_4_4.md) |
| Wat veranderde per versie? | [`CHANGELOG.md`](CHANGELOG.md) |

---

# Licentie en bijdragen

Door010 gebruikt de Apache License 2.0.

- [`LICENSE`](LICENSE)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`SECURITY.md`](SECURITY.md)
- [`SUPPORT.md`](SUPPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

Issues en pull requests gebruiken templates in [`.github/`](.github/).
