# Door010 3.0 v0.5.1 — compile readiness

Gerepareerd:

- canonieke negen detector-slots;
- foutieve oude slotnamen in golden tests;
- gelijke workspaceversies;
- package exports naar `dist`;
- TypeScript projectreferences;
- root build via `tsc -b`;
- interne TypeScript path mappings;
- compile-readiness verificatiescript.

Uitvoeren op een machine met dependencies:

```bash
npm install
npm run verify:compile-readiness
npm run typecheck
npm test
npm run build
```
