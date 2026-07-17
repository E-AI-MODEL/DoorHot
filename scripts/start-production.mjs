import { runMigrations } from "./migrate-postgres.mjs";

await runMigrations();
await import("../apps/api/dist/server.js");
