# Door010 3.0 v2.7 — verplichte checks en stagingreview

## Branch protection

Uitvoerbaar installatiescript:

```text
scripts/github/apply-main-protection.mjs
```

Dry-run:

```bash
DOOR010_GITHUB_REPOSITORY=E-AI-MODEL/door010 npm run github:protect-main:dry-run
```

Werkelijk toepassen:

```bash
GH_TOKEN=<repository-admin-token> DOOR010_GITHUB_REPOSITORY=E-AI-MODEL/door010 npm run github:protect-main
```

De configuratie beschermt `main` met:

- actuele branch verplicht voor merge;
- Node-workspacecheck verplicht;
- browser-paritycheck verplicht;
- productieacceptatiecheck verplicht;
- minimaal één goedkeuring;
- goedkeuring door CODEOWNERS;
- oude reviews vervallen na nieuwe commits;
- laatste push moet door iemand anders worden goedgekeurd;
- gesprekken moeten opgelost zijn;
- lineaire geschiedenis;
- geen force-push;
- geen branchverwijdering;
- regels gelden ook voor administrators.

De configuratie wordt na toepassing opnieuw via de GitHub API gelezen en
gecontroleerd.

Het script gebruikt de GitHub REST API-versie `2026-03-10`.

## CODEOWNERS

Toegevoegd:

```text
.github/CODEOWNERS
```

De standaard eigenaar is `@E-AI-MODEL`. Controleer voor activering dat dit een
GitHub-gebruiker of organisatie is met schrijftoegang tot de repository.

## Staging security- en privacyreview

Nieuwe workflow:

```text
.github/workflows/staging-security-review.yml
```

De workflow draait:

- handmatig met een staging-URL;
- wekelijks via `secrets.STAGING_URL`;
- alleen tegen HTTPS;
- met een Door010-specifieke header- en privacycontrole;
- met een passieve OWASP ZAP-baselinescan;
- met JSON-, Markdown- en HTML-rapporten;
- met artifactretentie van 30 dagen.

Handmatige lokale controle:

```bash
STAGING_URL=https://staging.example.nl npm run security:review:staging
```

Door010-controles:

- HTTP-status;
- CSP;
- clickjackingbescherming;
- MIME-sniffingbescherming;
- referrerpolicy;
- permissionspolicy;
- HSTS;
- Secure-, HttpOnly- en SameSite-cookieattributen;
- bekende secretpatronen in publieke HTML;
- voorkomen van indexering van staging.

Critical- en high-findings blokkeren de workflow.

## Externe review

De workflow automatiseert technische controles, maar vervangt geen menselijke
AVG-/DPIA- of penetratietest. Voor een formele externe review moeten minimaal
worden aangeleverd:

- staging-URL;
- testaccounts voor kandidaat, adviseur en administrator;
- verwerkers- en gegevensstromenoverzicht;
- bewaartermijnen;
- contactpersoon voor responsible disclosure;
- expliciete toestemming voor actieve securitytests.

De ZAP-baselinescan is passief en voert geen actieve aanval uit.
