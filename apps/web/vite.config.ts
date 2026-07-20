import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

type PackageManifest = {
  version?: unknown;
};

const manifest = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as PackageManifest;

if (
  typeof manifest.version !== "string" ||
  !/^\d+\.\d+\.\d+$/.test(manifest.version)
) {
  throw new Error(
    "Root package.json must contain a semantic product version."
  );
}

const productVersion = manifest.version;

export default defineConfig({
  define: {
    __DOOR010_VERSION__: JSON.stringify(productVersion)
  },
  plugins: [
    {
      name: "door010-product-version",
      transform(code, id) {
        if (!id.endsWith("/src/main.ts")) return null;

        return code.replace(
          "Door010 3.0",
          `Door010 ${productVersion}`
        );
      }
    }
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // GitHub Codespaces stuurt poorten door via *.app.github.dev;
    // zonder allowedHosts blokkeert Vite die verzoeken.
    allowedHosts: [".app.github.dev"],
    proxy: {
      "/v1": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000",
      "/metrics": "http://127.0.0.1:4000"
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
