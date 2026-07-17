export interface RequestObservation {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}

interface HistogramBucket {
  upperBound: number;
  count: number;
}

interface RouteMetrics {
  requests: number;
  errors: number;
  durationSum: number;
  buckets: HistogramBucket[];
}

const DEFAULT_BUCKETS = [
  0.005,
  0.01,
  0.025,
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2.5,
  5,
  10
] as const;

function escapeLabel(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll('"', '\\"');
}

export class MetricsRegistry {
  private readonly startedAt = Date.now();
  private readonly routes = new Map<string, RouteMetrics>();
  private activeRequests = 0;

  requestStarted(): void {
    this.activeRequests += 1;
  }

  requestFinished(observation: RequestObservation): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    const method = observation.method.toUpperCase();
    const route = observation.route || "unmatched";
    const key = `${method} ${route}`;
    const current = this.routes.get(key) ?? {
      requests: 0,
      errors: 0,
      durationSum: 0,
      buckets: DEFAULT_BUCKETS.map((upperBound) => ({
        upperBound,
        count: 0
      }))
    };

    current.requests += 1;
    current.durationSum += observation.durationSeconds;

    if (observation.statusCode >= 500) {
      current.errors += 1;
    }

    for (const bucket of current.buckets) {
      if (observation.durationSeconds <= bucket.upperBound) {
        bucket.count += 1;
      }
    }

    this.routes.set(key, current);
  }

  renderPrometheus(serviceName = "door010_api"): string {
    const lines = [
      "# HELP process_uptime_seconds Process uptime in seconds.",
      "# TYPE process_uptime_seconds gauge",
      `process_uptime_seconds ${Math.max(0, (Date.now() - this.startedAt) / 1000)}`,
      "# HELP door010_active_requests Current active HTTP requests.",
      "# TYPE door010_active_requests gauge",
      `door010_active_requests ${this.activeRequests}`,
      "# HELP door010_http_requests_total Total HTTP requests.",
      "# TYPE door010_http_requests_total counter",
      "# HELP door010_http_errors_total Total HTTP 5xx responses.",
      "# TYPE door010_http_errors_total counter",
      "# HELP door010_http_request_duration_seconds HTTP request duration.",
      "# TYPE door010_http_request_duration_seconds histogram"
    ];

    for (const [key, metrics] of [...this.routes.entries()].sort()) {
      const firstSpace = key.indexOf(" ");
      const method = key.slice(0, firstSpace);
      const route = key.slice(firstSpace + 1);
      const labels =
        `service="${escapeLabel(serviceName)}",` +
        `method="${escapeLabel(method)}",` +
        `route="${escapeLabel(route)}"`;

      lines.push(
        `door010_http_requests_total{${labels}} ${metrics.requests}`,
        `door010_http_errors_total{${labels}} ${metrics.errors}`
      );

      for (const bucket of metrics.buckets) {
        lines.push(
          `door010_http_request_duration_seconds_bucket{${labels},le="${bucket.upperBound}"} ${bucket.count}`
        );
      }

      lines.push(
        `door010_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${metrics.requests}`,
        `door010_http_request_duration_seconds_sum{${labels}} ${metrics.durationSum}`,
        `door010_http_request_duration_seconds_count{${labels}} ${metrics.requests}`
      );
    }

    return `${lines.join("\n")}\n`;
  }
}

export interface StructuredLogRecord {
  level: "info" | "warn" | "error";
  event: string;
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  errorName?: string;
  message?: string;
}

export function createStructuredLogRecord(
  record: StructuredLogRecord
): StructuredLogRecord & { timestamp: string }
{
  return {
    ...record,
    timestamp: new Date().toISOString()
  };
}
