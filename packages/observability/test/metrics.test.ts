import { describe, expect, it } from "vitest";
import { MetricsRegistry } from "../src/index.js";

describe("MetricsRegistry", () => {
  it("records requests, errors and histogram buckets", () => {
    const registry = new MetricsRegistry();

    registry.requestStarted();
    registry.requestFinished({
      method: "GET",
      route: "/health",
      statusCode: 200,
      durationSeconds: 0.02
    });

    registry.requestStarted();
    registry.requestFinished({
      method: "POST",
      route: "/v1/chat/personal",
      statusCode: 500,
      durationSeconds: 0.3
    });

    const output = registry.renderPrometheus();

    expect(output).toContain(
      'door010_http_requests_total{service="door010_api",method="GET",route="/health"} 1'
    );
    expect(output).toContain(
      'door010_http_errors_total{service="door010_api",method="POST",route="/v1/chat/personal"} 1'
    );
    expect(output).toContain(
      'door010_http_request_duration_seconds_count{service="door010_api",method="POST",route="/v1/chat/personal"} 1'
    );
  });
});
