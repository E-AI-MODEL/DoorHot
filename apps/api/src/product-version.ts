import { readFileSync } from "node:fs";

type PackageManifest = {
  version?: unknown;
};

function readProductVersion(): string {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../../../package.json", import.meta.url),
      "utf8"
    )
  ) as PackageManifest;

  if (
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version)
  ) {
    throw new Error(
      "Root package.json must contain a semantic product version."
    );
  }

  return manifest.version;
}

export const PRODUCT_VERSION = readProductVersion();
