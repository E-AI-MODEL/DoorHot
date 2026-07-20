# Door010

<p>
  <img alt="Versie 5.0.1" src="https://img.shields.io/badge/version-5.0.1-2f6f5e">
  <img alt="Node.js 22+" src="https://img.shields.io/badge/Node.js-22%2B-339933">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-workspaces-3178c6">
  <img alt="Licentie Apache 2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="Readiness conditional go" src="https://img.shields.io/badge/readiness-CONDITIONAL__GO-c88719">
</p>

**Door010 helpt mensen hun weg te vinden naar werk en opleiding in het onderwijs.**

De gebruiker kan zelf informatie en routes bekijken, algemene vragen stellen aan een coach, persoonlijk worden begeleid of rechtstreeks contact hebben met een menselijke adviseur. Deze repository bevat de doorontwikkeling van de oorspronkelijke Lovable-app tot een testbare, overdraagbare en providerneutrale foundation.

[![Open Door010 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/E-AI-MODEL/door010?quickstart=1)

> [!IMPORTANT]
> Deze README is de eerste werkdag in de repository. Volg hem van boven naar beneden wanneer je Door010 nog niet kent. Verdiepende informatie staat in uitklapbare delen, zodat de hoofdroute leesbaar blijft.

## Kies je route

| Ik wil... | Begin hier |
| --- | --- |
| Door010 direct bekijken | [Open de demo in Codespaces](https://codespaces.new/E-AI-MODEL/door010?quickstart=1) |
| Begrijpen wat het platform doet | [Eén gebruiker, vier kanalen](#één-gebruiker-vier-kanalen) |
| Lokaal ontwikkelen zonder infrastructuur | [Lokale demo](#lokale-demo-zonder-database-of-llm) |
| Met PostgreSQL ontwikkelen | [Volledige ontwikkelomgeving](#volledige-ontwikkelomgeving-met-postgresql) |
| Een eerste wijziging maken | [Je eerste kleine wijziging](#je-eerste-kleine-wijziging) |
| De juiste code vinden | [Waar moet ik zijn?](#waar-moet-ik-zijn) |
| Een pull request voorbereiden | [Controleer je werk](#controleer-je-werk) |

## Door010 in gewone taal

Stel dat Sam wil werken in het onderwijs, maar nog niet weet als wat, in welke sector of via welke opleiding.

Door010 kan Sam op vier manieren helpen:

1. Sam bekijkt zelf informatie, routes, vacatures en evenementen.
2. Sam praat met een menselijke adviseur.
3. Sam stelt een algemene vraag aan de algemene coach.
4. Sam werkt met een persoonlijke coach die rekening houdt met het eigen profiel en traject.

Door010 is daarom niet alleen een chatbot. Het is een platform met vaste routes, gecontroleerde kennis, persoonlijke voortgang en menselijke begeleiding. AI kan onderdelen ondersteunen, maar is niet de bron van waarheid voor routes, fasen of trajectbeslissingen.

<details>
<summary><strong>Hoe is Door010 ontstaan?</strong></summary>

Door010 begon als een applicatie die met Lovable is ontwikkeld. Die toepassing maakte snel zichtbaar welke schermen, vragen, routes en gebruikersstromen nodig waren.

Deze repository is de technische doorontwikkeling daarvan. De waardevolle productlogica is behouden, maar de nieuwe foundation brengt verantwoordelijkheden onder in afzonderlijke applicaties, packages, datasets en adapters.

In de documentatie heet dit vaak <em>parity</em>: aantonen dat belangrijk gedrag uit de eerdere applicatie ook in de nieuwe foundation aanwezig is.

<details>
<summary><strong>Wat is wel en niet overgenomen?</strong></summary>

Wel als functioneel vertrekpunt:

- gebruikersstromen en schermpatronen;
- vragen, routegegevens en scoring;
- gegevensmodellen;
- bronlijsten;
- bestaand gedrag dat behouden moest blijven.

Niet als vaste technische afhankelijkheid:

- één specifieke databaseleverancier;
- één authenticatieleverancier;
- één LLM-provider;
- één zoekprovider;
- één frontendplatform.

**Beslissende documentatie**

- [`docs/FULL_PARITY_AUDIT_1_TO_10.md`](docs/FULL_PARITY_AUDIT_1_TO_10.md)
- [`docs/PARITY_RESTORATION_1_TO_4.md`](docs/PARITY_RESTORATION_1_TO_4.md)
- [`docs/CLICKABLE_PARITY_FLOWS.md`](docs/CLICKABLE_PARITY_FLOWS.md)

</details>
</details>

## Eén gebruiker, vier kanalen

```mermaid
flowchart LR
    U["Gebruiker"] --> W["1. Website en vaste flows"]
    U --> H["2. Menselijke adviseur"]
    U --> G["3. Algemene AI-coach"]
    U --> P["4. Persoonlijke AI-coach"]

    W --> C["Informatie, route, talent, events en vacatures"]
    H --> A["Gesprek gebruiker en medewerker"]
    G --> K["Algemene kennis, zonder persoonlijk traject"]
    P --> J["Profiel, route, fase, doelen en vervolgstappen"]
```

De vier productkanalen zijn niet hetzelfde als de drie gesprekstypen in de code. De website en vaste flows vormen een productkanaal, maar geen chatgesprek. Gesprekken worden technisch opgeslagen als `general-ai`, `personal-ai` of `advisor`.

<details>
<summary><strong>1. Website en vaste flows</strong></summary>

De gebruiker kan onderdelen zelfstandig doorlopen. Denk aan de kennisbank, routeverkenning, talententest, evenementen en vacatures.

Dit kanaal is geschikt wanneer iemand gericht wil zoeken of een vaste reeks vragen wil doorlopen, zonder eerst een gesprek te beginnen.

<details>
<summary><strong>Hoe werkt dit technisch?</strong></summary>

De webapp heeft afzonderlijke views voor de verschillende onderdelen:

```ts
type View =
  | "knowledge"
  | "route"
  | "talent"
  | "events"
  | "vacancies"
  | "journey-dashboard"
  | "advisor-chat";
```

De API registreert hiervoor aparte route-, fase-, talent-, event-, vacature- en backofficeflows. Daardoor is de websitekant geen dunne schil rond een chatbot.

**Beslissende code**

- [`apps/web/src/main.ts`](apps/web/src/main.ts), zoek naar `type View`
- [`apps/api/src/parity-flow-routes.ts`](apps/api/src/parity-flow-routes.ts)
- [`packages/parity-flows/`](packages/parity-flows/)
- [`datasets/`](datasets/)

**Waarom dit overdraagbaar is**

De flows communiceren via contracten en services. Een andere frontend kan dezelfde API en domeinlogica gebruiken. Routevragen en inhoud staan bovendien niet hard in één scherm ingebakken, maar worden voor een belangrijk deel uit datasets geladen.

</details>
</details>

<details>
<summary><strong>2. Menselijke adviseur</strong></summary>

Een gebruiker kan rechtstreeks met een medewerker of adviseur praten. Dit is een echt menselijk gesprek. Door010 doet niet alsof een AI-antwoord door een medewerker is geschreven.

<details>
<summary><strong>Hoe werkt dit technisch?</strong></summary>

Het adviseurskanaal gebruikt een eigen service, berichtrollen, autorisatie en gesprekstype.

```ts
type: "general-ai" | "personal-ai" | "advisor";
```

Een bericht van de kandidaat binnen dit kanaal krijgt expliciet mee:

```ts
metadata: {
  candidateUserId: input.candidateUserId,
  channel: "human-advisor"
}
```

**Beslissende code**

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `AdvisorChatService`
- [`apps/api/src/server.ts`](apps/api/src/server.ts), zoek naar advisor routes
- [`packages/backoffice/`](packages/backoffice/)
- [`packages/realtime/`](packages/realtime/)

**Waarom dit overdraagbaar is**

De menselijke chat staat los van beide AI-coaches. Een organisatie kan daarom een andere berichteninterface, realtimebroker of backoffice aansluiten zonder de coachlogica te herschrijven.

</details>
</details>

<details>
<summary><strong>3. Algemene AI-coach</strong></summary>

De algemene coach beantwoordt algemene vragen over werken en leren in het onderwijs. De gebruiker hoeft daarvoor geen persoonlijk traject te hebben.

Voorbeeld:

> Welke routes zijn er om docent in het voortgezet onderwijs te worden?

De algemene coach gebruikt gecontroleerde kennis, maar geen persoonlijke journey-state.

<details>
<summary><strong>Hoe werkt dit technisch?</strong></summary>

`GeneralCoach` begint bewust met een lege persoonlijke context:

```ts
const context: ChatContext = { slots: [] };
```

Het gesprek wordt opgeslagen als:

```ts
type: "general-ai"
```

De coach kan een deterministische antwoordprovider of een aangesloten LLM-provider gebruiken.

**Beslissende code**

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `GeneralCoach`
- [`packages/knowledge/`](packages/knowledge/)
- [`packages/response-pipeline/`](packages/response-pipeline/)
- [`apps/api/src/server.ts`](apps/api/src/server.ts), endpoint `/v1/chat/general`

**Waarom dit overdraagbaar is**

De antwoordprovider wordt geïnjecteerd. De algemene coach kan daardoor zonder LLM werken, met een lokale provider werken of een OpenAI-compatible endpoint gebruiken.

</details>
</details>

<details>
<summary><strong>4. Persoonlijke AI-coach</strong></summary>

De persoonlijke coach kijkt naar waar de gebruiker in het traject staat. Deze coach kan rekening houden met profielgegevens, route-antwoorden, doelen, blokkades en eerdere stappen.

De coach kan een volgende vraag of wijziging voorstellen, maar mag persoonlijke gegevens of trajectstatus niet stilzwijgend aanpassen.

<details>
<summary><strong>Hoe werkt dit technisch?</strong></summary>

De persoonlijke coach vereist een ingelogde gebruiker:

```ts
if (!request.userId) {
  throw new Error(
    "PersonalJourneyCoach requires an authenticated user."
  );
}
```

Daarna worden context en deterministische uitkomsten verzameld:

```ts
const phase = await this.detector.evaluate(detectorInput);

const route = this.routeEngine.evaluate({
  selectedAnswerIds: context.routeAnswerIds ?? []
});
```

Een mogelijke faseovergang wordt alleen als voorstel teruggegeven:

```ts
{
  type: "phase-transition",
  requiresConfirmation: true,
  payload: { from, to }
}
```

**Beslissende code**

- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `PersonalJourneyCoach`
- [`packages/domain/`](packages/domain/)
- [`packages/orchestration/`](packages/orchestration/)
- [`apps/api/src/graph-execution-routes.ts`](apps/api/src/graph-execution-routes.ts)
- [`apps/api/src/server.ts`](apps/api/src/server.ts), endpoint `/v1/chat/personal`

**Waarom dit overdraagbaar is**

Profielcontext, fasesystemen, routebepaling, graphprojectie en antwoordgeneratie zijn afzonderlijke verantwoordelijkheden. Een organisatie kan eigen routes, fasen, datasets en providers gebruiken zonder het volledige platform opnieuw te bouwen.

</details>
</details>

## Effectief zonder LLM

Door010 heeft geen LLM nodig om zijn belangrijkste domeinfuncties uit te voeren.

Zonder LLM kan het platform al:

- routevragen verwerken en routes bepalen;
- een fase evalueren;
- profielvelden en confidence bijhouden;
- doelen, milestones, blockers en acties beheren;
- lokale kennis doorzoeken;
- gecontroleerde bronresultaten teruggeven;
- persoonlijke vervolgstappen bepalen;
- mutaties als bevestigbaar voorstel aanbieden;
- gesprekken met menselijke adviseurs opslaan;
- de website, backoffice en dashboards laten werken.

Een LLM kan de interactie natuurlijker maken, intent helpen herkennen, resultaten herschikken of een antwoord formuleren. Het taalmodel mag de deterministische route-, fase- en journeylogica niet vervangen.

```mermaid
flowchart LR
    Q["Vraag of gebruikersactie"] --> V["Validatie en autorisatie"]
    V --> D{"Benodigde capability"}

    D --> R["Route, Phase en Journey Engines"]
    D --> K["Lokale kennisretrieval"]
    D --> H["Menselijke adviseursflow"]

    R --> S["Gestructureerd resultaat"]
    K --> S
    H --> S

    S -. "optioneel" .-> L["LLM voor formulering, intent of reranking"]
    L --> O["Gevalideerd antwoord"]
    S --> O
```

<details>
<summary><strong>Bewijs in de uitvoerroute</strong></summary>

De demoscript controleert of Ollama beschikbaar is. Is dat niet zo, dan stopt de demo niet:

```js
if (!hasOllama) {
  console.log(
    "[llm] Ollama niet gevonden - de coach antwoordt " +
    "extractief uit de kennisbank"
  );
  return {};
}
```

Vervolgens worden API en webapp gewoon gestart:

```js
start("api", "npm", [
  "run", "dev", "--workspace", "@door010/api"
]);

start("web", "npm", [
  "run", "dev", "--workspace", "@door010/web"
]);
```

De standaard antwoordprovider bevat daarnaast een deterministische implementatie:

```ts
export class DeterministicAnswerDraftProvider
  implements AnswerDraftProvider {
  // Maakt een antwoord zonder externe LLM-call.
}
```

**Beslissende code**

- [`scripts/demo.mjs`](scripts/demo.mjs)
- [`packages/chat/src/index.ts`](packages/chat/src/index.ts), zoek naar `DeterministicAnswerDraftProvider`
- [`packages/domain/`](packages/domain/)
- [`packages/knowledge/`](packages/knowledge/)
- [`packages/orchestration/`](packages/orchestration/)

</details>

<details>
<summary><strong>Wat verandert er wanneer je wel een LLM aansluit?</strong></summary>

| Onderdeel | Zonder LLM | Met LLM |
| --- | --- | --- |
| Routebepaling | Deterministische Route Engine | Dezelfde Route Engine |
| Fasebepaling | Deterministische Phase Engine | Dezelfde Phase Engine |
| Journey-state | Journey Engine | Dezelfde Journey Engine |
| Kenniszoeken | FTS, fuzzy en lokale semantische fallback | Optioneel embeddings, intent en reranking |
| Antwoord | Extractief of deterministisch | Natuurlijker geformuleerd |
| Mutaties | Voorstel plus bevestiging | Nog steeds voorstel plus bevestiging |
| Menselijke chat | Volledig beschikbaar | Ongewijzigd |
| Broncontrole | Verplicht | Blijft verplicht |

De LLM-laag voegt dus vooral taal- en rangschikkingsmogelijkheden toe. De beslissende domeinlogica blijft buiten het model.

</details>

<details>
<summary><strong>Hoe moeten de retrievalpercentages worden gelezen?</strong></summary>

De retrievalbenchmark in deze repository is nuttig als **interne regressietest**. Hij laat zien of een codewijziging op dezelfde dataset slechter of beter scoort.

De cijfers zijn geen onafhankelijke productvalidatie.

Een deel van de benchmark bestaat uit exacte FAQ-vragen en aliases uit de brondata. Diezelfde vragen, aliases en tags worden ook gebruikt om de zoekindex en lokale embeddings op te bouwen. Hoge scores op de categorieën `exact` en `alias` zijn daardoor te verwachten.

Vereenvoudigd ziet de overlap er zo uit:

```ts
const faqTexts = [
  faq.question,
  ...(faq.aliases ?? []),
  faq.answer,
  ...(faq.tags ?? [])
].join(" ");
```

Terwijl benchmarkcases bijvoorbeeld zijn gemarkeerd als:

```json
{
  "query": "Wat heb ik nodig voor zij-instroom",
  "queryType": "alias",
  "notes": "Alias uit de brondata."
}
```

Gebruik de percentages daarom niet als bewijs dat echte gebruikers in een onafhankelijke praktijktest hetzelfde resultaat behalen.

**Wel geschikt voor**

- regressies tussen twee codeversies;
- vergelijking van retrievalconfiguraties op dezelfde set;
- het vinden van concrete misses;
- het bewaken van afgesproken minimumgrenzen.

**Nog nodig voor een sterke kwaliteitsclaim**

- een afgeschermde hold-outset die niet uit indexvelden is afgeleid;
- vragen van echte gebruikers;
- onafhankelijke relevantiebeoordeling;
- aparte beoordeling van route-, loket- en meerstapsvragen;
- rapportage van onzekerheid en fouttypen.

Zie ook:

- [`datasets/retrieval-benchmark.json`](datasets/retrieval-benchmark.json)
- [`datasets/faq-seed.json`](datasets/faq-seed.json)
- [`scripts/evaluate-hybrid-retrieval.ts`](scripts/evaluate-hybrid-retrieval.ts)
- [`docs/HYBRID_RETRIEVAL_3_0.md`](docs/HYBRID_RETRIEVAL_3_0.md)

</details>

## Probeer Door010

### Codespaces

1. Open [Door010 in Codespaces](https://codespaces.new/E-AI-MODEL/door010?quickstart=1).
2. Maak een codespace op `main`.
3. De dependencies, TypeScript-build en optionele lokale demo-LLM worden voorbereid.
4. `npm run demo` start bij het koppelen automatisch.
5. Open de doorgestuurde poort `5173`.

De API draait op poort `4000`.

<details>
<summary><strong>Wat gebeurt er in Codespaces?</strong></summary>

De configuratie staat in [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json).

Bij het aanmaken wordt uitgevoerd:

```bash
npm ci
npx tsc -b
bash scripts/setup-demo-llm.sh || true
```

Bij het koppelen start:

```bash
npm run demo
```

De lokale LLM is optioneel. Mislukt de installatie of is Ollama niet beschikbaar, dan blijft de demo werken met extractieve en deterministische antwoorden.

</details>

### Lokale demo zonder database of LLM

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

Open daarna:

- webapp: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:4000`

Stop beide processen met <kbd>Ctrl</kbd> + <kbd>C</kbd>.

<details>
<summary><strong>Openbare demoaccounts</strong></summary>

| Rol | E-mailadres | Wachtwoord |
| --- | --- | --- |
| Kandidaat | `test21@doorai.nl` | `admin010` |
| Administrator | `admin@doorai.nl` | `admin010` |

Dit zijn openbare testfixtures, geen secrets.

Gebruik uitsluitend fictieve gegevens. Iedereen met toegang tot de demo kan het administratoraccount gebruiken. Hergebruik het wachtwoord nergens anders.

Bij in-memory opslag worden de accounts bij het starten aangemaakt of hersteld. De gegevens verdwijnen wanneer de demo stopt.

Een PostgreSQL-testomgeving maakt deze accounts alleen aan als:

```bash
DEMO_ACCOUNTS_ENABLED=true
```

Gebruik dit nooit in een omgeving met echte gebruikersgegevens.

</details>

<details>
<summary><strong>De demo optioneel met een lokale LLM uitvoeren</strong></summary>

De demoscript gebruikt Ollama wanneer dat beschikbaar is.

Handmatig voorbereiden:

```bash
bash scripts/setup-demo-llm.sh
npm run demo
```

Standaardmodel:

```text
hf.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M
```

Een andere OpenAI-compatible provider kan via environmentvariabelen worden aangesloten:

```bash
export LLM_BASE_URL="https://provider.example/v1"
export LLM_API_KEY="replace-me"
export LLM_MODEL="replace-me"
npm run demo
```

Een LLM is niet nodig om de demo te starten.

</details>

### Volledige ontwikkelomgeving met PostgreSQL

Gebruik deze route wanneer je persistence, migraties, realtimefunctionaliteit of provideradapters wilt ontwikkelen.

Vereisten:

- Node.js 22 of hoger;
- npm;
- Docker en Docker Compose;
- bij voorkeur een PostgreSQL-client voor herstel- en acceptancechecks.

```bash
git clone https://github.com/E-AI-MODEL/door010.git
cd door010
npm ci
docker compose up -d
```

De lokale Docker-configuratie start PostgreSQL, Redis en MinIO.

> [!NOTE]
> `npm run dev` start in deze repository alleen de API. Start de webapp in een tweede terminal met `npm run dev:web`.

<details>
<summary><strong>Bash of zsh</strong></summary>

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

</details>

<details>
<summary><strong>PowerShell</strong></summary>

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

</details>

<details>
<summary><strong>Waarom wordt niet alleen naar <code>.env</code> verwezen?</strong></summary>

Docker Compose gebruikt automatisch waarden uit een lokaal `.env`-bestand. De Node-processen in deze repository laden `.env` niet zelfstandig in.

Zorg er daarom voor dat de benodigde waarden werkelijk als environmentvariabelen beschikbaar zijn. Dat kan via de shell, een IDE-runconfiguratie, een process manager of een deploymentplatform.

De minimale PostgreSQL-ontwikkeling gebruikt:

```text
APP_STORAGE_MODE=postgres
DATABASE_URL=postgresql://...
AUTH_TOKEN_SECRET=...
```

Kopieer `.env.example` gerust als inventarisatie van beschikbare instellingen, maar commit lokale secrets nooit.

</details>

<details>
<summary><strong>Stoppen en opnieuw beginnen</strong></summary>

Stop de ontwikkelservers met <kbd>Ctrl</kbd> + <kbd>C</kbd>.

Stop de containers:

```bash
docker compose down
```

Verwijder ook de lokale volumes en alle testgegevens:

```bash
docker compose down -v
```

Gebruik `-v` alleen wanneer de lokale gegevens echt mogen verdwijnen.

</details>

## Je eerste kleine wijziging

Begin met iets dat direct zichtbaar is.

1. Start de lokale demo.
2. Open [`apps/web/src/main.ts`](apps/web/src/main.ts).
3. Zoek naar `Waarmee kan ik je helpen?`.
4. Pas de tekst aan.
5. Sla het bestand op.
6. Controleer de wijziging in de browser.
7. Voer de snelle kwaliteitscontroles uit.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

<details>
<summary><strong>Waarom is dit een goede eerste wijziging?</strong></summary>

Je doorloopt meteen de hele ontwikkellus:

```mermaid
flowchart LR
    C["Code vinden"] --> W["Wijzigen"]
    W --> B["In browser bekijken"]
    B --> T["Typecheck en tests"]
    T --> D["Diff beoordelen"]
```

Je raakt nog niet aan database-, autorisatie- of journeylogica. Daardoor kun je eerst leren hoe workspaces, hot reload en controles samenwerken.

</details>

## Waar moet ik zijn?

| Ik wil iets wijzigen aan... | Begin hier | Zoek naar |
| --- | --- | --- |
| Schermen, navigatie of zichtbare tekst | [`apps/web/`](apps/web/) | `type View`, `renderShell`, `render` |
| API-routes en invoervalidatie | [`apps/api/`](apps/api/) | `register...Routes`, Zod-schema's |
| Algemene coach | [`packages/chat/`](packages/chat/) | `GeneralCoach` |
| Persoonlijke coach | [`packages/chat/`](packages/chat/) | `PersonalJourneyCoach` |
| Menselijke adviseurschat | [`packages/chat/`](packages/chat/) | `AdvisorChatService` |
| Antwoordstructuur | [`packages/response-pipeline/`](packages/response-pipeline/) | `createStructuredResponse` |
| Profielvelden en identiteit | [`packages/identity-profile/`](packages/identity-profile/) | profile services en token services |
| Routebepaling | [`packages/domain/`](packages/domain/) en [`datasets/routes.json`](datasets/routes.json) | `RouteEngine` |
| Fasebepaling | [`packages/domain/`](packages/domain/) | `AdaptivePhaseDetector` |
| Doelen, acties en voortgang | [`packages/domain/`](packages/domain/) | `JourneyEngine` |
| Graphcontext | [`packages/domain/`](packages/domain/) | `GraphMemory` |
| Kenniszoeken en bronnen | [`packages/knowledge/`](packages/knowledge/) | retrieval en ingestion |
| Capabilities combineren | [`packages/orchestration/`](packages/orchestration/) | orchestrator en planner |
| Databasecontracten | [`packages/database/`](packages/database/) | repositories en interfaces |
| PostgreSQL-adapters | [`packages/postgres/`](packages/postgres/) | `PgSqlExecutor` |
| Schemawijzigingen | [`migrations/`](migrations/) | eerstvolgend migratienummer |
| Providers en externe koppelingen | [`packages/integrations/`](packages/integrations/) | adapters en resilience |
| Backoffice | [`packages/backoffice/`](packages/backoffice/) | prompts, alerts en kandidaatdetail |
| Realtimeberichten | [`packages/realtime/`](packages/realtime/) | broker en subscriptions |
| Browsertests | [`apps/web/`](apps/web/) | Playwright |
| CI, load en recovery | [`.github/`](.github/) en [`scripts/`](scripts/) | workflows en acceptance |

<details>
<summary><strong>Repositorystructuur</strong></summary>

```text
.github/       CI, deploymentgates en GitHub-templates
.devcontainer/ Codespaces-configuratie
apps/api/      HTTP API, security en bootstrapping
apps/web/      Browserapp en Playwrighttests
packages/      Domein, contracten, persistence en orchestration
datasets/      Route-, fase- en kennisdata
migrations/    Append-only PostgreSQL-migraties
scripts/       Demo, verificatie, benchmarks, load en recovery
docs/          Ontwerpbesluiten, audits en runbooks
```

<details>
<summary><strong>Hoe lopen de belangrijkste afhankelijkheden?</strong></summary>

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

    API --> DBI["packages/database"]
    DBI --> PG["packages/postgres"]
    PG --> DB[("PostgreSQL")]

    INTEGRATIONS["packages/integrations"] --> KNOW
    INTEGRATIONS --> ORCH
```

De pijlen geven de belangrijkste samenwerkingsrichting weer, niet iedere TypeScript-import.

</details>
</details>

## Architectuurregels

Lees vóór grotere wijzigingen:

- [`AGENTS.md`](AGENTS.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

<details>
<summary><strong>1. Houd de kanalen gescheiden</strong></summary>

De algemene coach, persoonlijke coach en menselijke adviseurschat zijn afzonderlijke gesprekstypen. De website en vaste flows vormen daarnaast een zelfstandig productkanaal.

Voeg persoonlijke journeycontext nooit ongemerkt toe aan de algemene coach. Presenteer een AI-antwoord nooit als bericht van een adviseur.

</details>

<details>
<summary><strong>2. Respecteer de bronnen van waarheid</strong></summary>

| Onderwerp | Bron van waarheid |
| --- | --- |
| Persistente gegevens | PostgreSQL |
| Routebepaling | Route Engine |
| Fasebepaling | Phase Engine |
| Persoonlijk traject | Journey Engine |
| Graphcontext | Afgeleide projectie |
| Coördinatie | Orchestrator, niet de domeinbeslisser |
| LLM-output | Advies dat gevalideerd moet worden |

<details>
<summary><strong>Waarom is Graph Memory niet leidend?</strong></summary>

Graph Memory projecteert bestaande journeygegevens naar nodes en relaties. Dat is nuttig voor context en toekomstige graph retrieval, maar een projectie kan achterlopen of opnieuw worden opgebouwd.

Mutaties horen daarom via de Journey Engine en primaire repositories te lopen, niet rechtstreeks via de graph.

</details>
</details>

<details>
<summary><strong>3. Schrijfacties vragen bevestiging en audit</strong></summary>

Een model, agent of gebruiker kan een actie voorstellen. Gevoelige wijzigingen worden pas uitgevoerd na de vereiste authenticatie, autorisatie, validatie en expliciete bevestiging.

De basisroute is:

```mermaid
flowchart LR
    P["Voorstel"] --> C["Bevestigingstoken"]
    C --> D{"Goedkeuren?"}
    D -->|Ja| E["Uitvoeren"]
    D -->|Nee| R["Afwijzen"]
    E --> A["Audit en outbox"]
```

Sla deze stappen niet over om een demo sneller te laten werken.

</details>

<details>
<summary><strong>4. Houd providers vervangbaar</strong></summary>

Plaats provider-specifieke logica achter een bestaand contract of een nieuwe adapter.

Niet hardcoderen in:

- domeinmodellen;
- engines;
- generieke orchestrationcontracten;
- generieke API-contracten.

Een provider moet uitschakelbaar en vervangbaar blijven.

</details>

<details>
<summary><strong>5. Behandel persoonlijke coachvragen als gevoelige context</strong></summary>

De persoonlijke coach gebruikt profiel-, route-, fase- en journeycontext. Ruwe persoonlijke vragen gaan standaard niet naar een optionele externe webzoekprovider.

Een systeemprompt is geen beveiligingsgrens. Dwing privacy- en kanaalregels af in compositie, providerinput, validatie, autorisatie en tests.

</details>

<details>
<summary><strong>6. Wijzig bestaande migraties nooit</strong></summary>

Iedere schemawijziging krijgt een nieuwe, oplopende migratie.

Bestaande migraties hebben checksums. Een wijziging aan een al toegepaste migratie veroorzaakt bewust een fout:

```text
Migration checksum mismatch
```

Voer na databasewijzigingen altijd uit:

```bash
npm run verify:migrations
npm run verify:seed
```

</details>

## Controleer je werk

### Snelle ontwikkellus

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Voor iedere pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:migrations
npm run verify:seed
npm audit --audit-level=moderate
```

### Voor frontend- en flowwijzigingen

```bash
npm run test:e2e
```

### Voor retrieval- en rerankingwijzigingen

```bash
npm run benchmark:reranker:check
npm run benchmark:shadow-reranker:check
```

Behandel benchmarkuitkomsten als regressie-evidence binnen de bekende dataset, niet als onafhankelijke gebruikersvalidatie.

<details>
<summary><strong>Definition of Done</strong></summary>

Een wijziging is klaar wanneer:

- het gevraagde gedrag aantoonbaar werkt;
- relevante tests groen zijn;
- typecheck, lint en build slagen;
- migraties en seedcontrole slagen wanneer die geraakt zijn;
- documentatie is bijgewerkt;
- geen secrets of echte persoonsgegevens zijn toegevoegd;
- architectuur-, security- en privacyimpact zijn beoordeeld;
- resterende beperkingen expliciet zijn vastgelegd.

</details>

<details>
<summary><strong>Veilige Git-werkwijze</strong></summary>

1. Beschrijf het probleem in een issue of pull request.
2. Werk op een korte branch.
3. Houd de wijziging klein en gericht.
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

Zie [`CONTRIBUTING.md`](CONTRIBUTING.md) voor de volledige werkwijze.

</details>

## Status en productiegrens

Door010 Foundation staat op versie `5.0.1`.

De readinessstatus is `CONDITIONAL_GO`. De repository bevat productiegerichte architectuur, securitymaatregelen, CI, browsertests, loadchecks en herstelprocedures. Dat betekent niet dat iedere externe staging- of go-livevoorwaarde al is bewezen.

Nog buiten de codebase te bevestigen zijn onder andere:

- staging-evidence;
- live provideracceptatie;
- load- en herstelbewijs in de doelomgeving;
- privacy- en DPIA-goedkeuring;
- operationele go-livebeslissing.

<details>
<summary><strong>Wat betekent dit voor een ontwikkelaar?</strong></summary>

Je mag lokaal ontwikkelen en de beschikbare controles uitvoeren. Schrijf in documentatie of pull requests niet dat de toepassing productieklaar is wanneer de vereiste externe evidence niet is verzameld.

Lokale groene tests zijn bewijs voor de geteste code en omgeving. Ze zijn geen automatische productiegoedkeuring.

</details>

## API-startpunten

<details>
<summary><strong>Veelgebruikte endpoints</strong></summary>

```text
GET  http://localhost:4000/health
GET  http://localhost:4000/v1/system/capabilities
POST http://localhost:4000/v1/chat/general
POST http://localhost:4000/v1/chat/personal
```

De API bevat daarnaast routes voor authenticatie, profiel, route, fase, talent, kennis, journeys, adviseurschat, backoffice, providers, orchestration, graph en gecontroleerde uitvoering.

Begin bij [`apps/api/src/server.ts`](apps/api/src/server.ts) om te zien welke routes tijdens het opstarten worden geregistreerd.

</details>

## Verder lezen

| Vraag | Document |
| --- | --- |
| Hoe zit het hele systeem in elkaar? | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Welke regels gelden voor mens en AI-agent? | [`AGENTS.md`](AGENTS.md) |
| Hoe lever ik een wijziging aan? | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Hoe meld ik een kwetsbaarheid? | [`SECURITY.md`](SECURITY.md) |
| Waar krijg ik ondersteuning? | [`SUPPORT.md`](SUPPORT.md) |
| Hoe ziet het datamodel eruit? | [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) |
| Hoe is parity met de eerdere app gecontroleerd? | [`docs/FULL_PARITY_AUDIT_1_TO_10.md`](docs/FULL_PARITY_AUDIT_1_TO_10.md) |
| Hoe werkt de AI-orchestrator? | [`docs/AI_ORCHESTRATOR_3_9.md`](docs/AI_ORCHESTRATOR_3_9.md) |
| Hoe werkt de Journey Engine? | [`docs/JOURNEY_ENGINE_2_3_8.md`](docs/JOURNEY_ENGINE_2_3_8.md) |
| Hoe werkt retrieval? | [`docs/HYBRID_RETRIEVAL_3_0.md`](docs/HYBRID_RETRIEVAL_3_0.md) |
| Welke productieblokkades zijn er? | [`docs/PRODUCTION_READINESS_4_4.md`](docs/PRODUCTION_READINESS_4_4.md) |
| Wat veranderde per versie? | [`CHANGELOG.md`](CHANGELOG.md) |

<details>
<summary><strong>Open-source governance</strong></summary>

Door010 gebruikt de Apache License 2.0.

- [`LICENSE`](LICENSE)
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- [`SECURITY.md`](SECURITY.md)
- [`SUPPORT.md`](SUPPORT.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

Issues en pull requests gebruiken templates in [`.github/`](.github/).

</details>
