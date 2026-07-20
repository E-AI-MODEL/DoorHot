import { PRODUCT_VERSION } from "./product-version.js";

const VERSIONED_ROUTES = new Set([
  "/health",
  "/health/live",
  "/health/ready",
  "/v1/system/capabilities"
]);

export function applyProductVersionMetadata(
  route: string,
  payload: unknown
): unknown {
  if (!VERSIONED_ROUTES.has(route) || !payload || typeof payload !== "object") {
    return payload;
  }

  return {
    ...(payload as Record<string, unknown>),
    version: PRODUCT_VERSION
  };
}
