# Knowledge aliases

## Doel

Kennisrecords dragen naast hun canonieke vraag (`title`) een lijst
`aliases`: alternatieve formuleringen waarmee gebruikers dezelfde vraag
stellen. Retrieval vindt het record via elke formulering; het antwoord,
de bron en de metadata blijven één canoniek record.

## Datamodel

- `datasets/faq-seed.json`: optioneel veld `aliases: string[]` per FAQ.
- `knowledge_items.aliases text[]` (migratie
  `0026_knowledge_aliases.sql`, append-only).
- Aliassen wegen mee in alle drie retrievalkanalen:
  - FTS: opgenomen in de trigger-onderhouden `search_vector` op
    titelgewicht (A), naast de bestaande tags op gewicht B (0017);
  - fuzzy: opgenomen in `normalized_search_text` en `search_trigrams`
    (0018);
  - embeddings: opgenomen in `recordText` naast de titelnadruk.

## Richtlijnen voor aliassen

- Schrijf natuurlijke herformuleringen zoals gebruikers ze stellen
  (synoniemen, spreektaal, afkortingen), geen kopieën van
  benchmarkvragen — de benchmark meet generalisatie en mag niet in de
  index lekken.
- Houd aliassen kort en enkelvoudig van intentie; nieuwe intenties
  krijgen een eigen record.
- Aliassen zijn redactionele content: onderhoud ze samen met vraag en
  antwoord.

## Gemeten effect

Retrievalbenchmark v2.0.0 (333 vragen), hybride pipeline:

| Metric | zonder aliases | met aliases |
|---|---:|---:|
| Recall@5 | 0.9039 | 0.97 |
| MRR@5 | 0.7794 | 0.8707 |
| Missers bij k=5 | 28 | 7 |

De FTS-baseline zonder aliassen blijft ongewijzigd (0.3844), waarmee de
migratie aantoonbaar gedragsbehoudend is voor bestaande data. Alle
kwaliteitsgates (hybride, learned reranker, shadow reranker) blijven
groen.
