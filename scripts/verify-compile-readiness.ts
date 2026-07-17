import { readFile } from "node:fs/promises";

const rootPackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
) as { version: string; scripts: Record<string, string> };

const domainSource = await readFile(
  new URL("../packages/domain/src/index.ts", import.meta.url),
  "utf8"
);

const requiredSlots = [
  "school_type",
  "role_interest",
  "credential_goal",
  "admission_requirements",
  "duration_info",
  "costs_info",
  "salary_info",
  "region_preference",
  "next_step"
];

const missingSlots = requiredSlots.filter(
  (slot) => !domainSource.includes(`"${slot}"`)
);

if (!/^\d+\.\d+\.\d+$/.test(rootPackage.version)) {
  throw new Error("Root package version is not a valid semver version.");
}

if (!rootPackage.scripts.build.startsWith("tsc -b")) {
  throw new Error("Root build does not use TypeScript project references.");
}

if (missingSlots.length > 0) {
  throw new Error(`Missing canonical slots: ${missingSlots.join(", ")}`);
}

console.log({
  status: "ok",
  version: rootPackage.version,
  canonicalSlots: requiredSlots.length
});
