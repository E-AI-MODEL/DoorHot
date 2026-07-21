import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import type { TokenClaims } from "@door010/identity-profile";

type AuthenticatedRequest = FastifyRequest & {
  auth?: TokenClaims;
};

const PRIVILEGED_ROLES = new Set([
  "advisor",
  "administrator",
  "superuser"
]);

function objectValue(
  value: unknown,
  key: string
): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : undefined;
}

export function isPrivileged(claims: TokenClaims): boolean {
  return claims.roles.some((role) => PRIVILEGED_ROLES.has(role));
}

export function enforceOwnership(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  const claims = (request as AuthenticatedRequest).auth;
  if (!claims || isPrivileged(claims)) return Boolean(claims);

  const route = request.routeOptions.url ?? "";
  const userId =
    objectValue(request.params, "userId") ??
    objectValue(request.params, "candidateUserId") ??
    objectValue(request.body, "userId") ??
    objectValue(request.body, "candidateUserId") ??
    objectValue(request.query, "userId");

  if (userId && userId !== claims.sub) {
    void reply.code(403).send({ error: "forbidden" });
    return false;
  }

  const advisorUserId = objectValue(
    request.body,
    "advisorUserId"
  );
  if (advisorUserId && advisorUserId !== claims.sub) {
    void reply.code(403).send({ error: "forbidden" });
    return false;
  }

  if (
    route.startsWith("/v1/backoffice/") &&
    !isPrivileged(claims)
  ) {
    void reply.code(403).send({ error: "forbidden" });
    return false;
  }

  return true;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function registerSecurityControls(
  server: FastifyInstance
): void {
  // In-memory buckets are per API instance, so the effective limit scales
  // with the number of instances. For a single instance (demo, small
  // deploy) this is exact; a multi-instance deployment that needs a global
  // limit should back this with a shared store. request.ip only reflects
  // the real client when the server is created with trustProxy enabled
  // (see TRUST_PROXY in server.ts).
  const buckets = new Map<string, RateBucket>();
  const windowMs = Number(
    process.env.RATE_LIMIT_WINDOW_MS ?? 60_000
  );
  const defaultLimit = Number(
    process.env.RATE_LIMIT_DEFAULT ?? 180
  );
  const authLimit = Number(
    process.env.RATE_LIMIT_AUTH ?? 20
  );

  server.addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );

    const route = request.routeOptions.url ?? request.url;
    const limit = route.startsWith("/v1/auth/")
      ? authLimit
      : defaultLimit;
    const key = `${request.ip}:${route}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return;
    }

    current.count += 1;
    if (current.count > limit) {
      reply.header(
        "Retry-After",
        Math.ceil((current.resetAt - now) / 1000)
      );
      return reply.code(429).send({
        error: "rate_limit_exceeded"
      });
    }
  });

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(windowMs, 30_000));
  cleanup.unref();
}
