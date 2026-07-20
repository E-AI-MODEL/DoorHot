import { describe, expect, it } from "vitest";
import { PRODUCT_VERSION } from "./product-version.js";
import { applyProductVersionMetadata } from "./product-version-metadata.js";

describe("API product version metadata", () => {
  for (const route of [
    "/health",
    "/health/live",
    "/health/ready",
    "/v1/system/capabilities"
  ]) {
    it(`uses the root product version for ${route}`, () => {
      expect(
        applyProductVersionMetadata(route, {
          status: "ok",
          version: "outdated"
        })
      ).toEqual({
        status: "ok",
        version: PRODUCT_VERSION
      });
    });
  }

  it("does not modify unrelated response payloads", () => {
    const payload = { status: "ok" };
    expect(applyProductVersionMetadata("/v1/profile", payload)).toBe(payload);
  });
});
