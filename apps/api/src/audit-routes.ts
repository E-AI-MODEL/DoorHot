import type {
  FastifyInstance,
  FastifyRequest
} from "fastify";
import { z } from "zod";
import type { AuditService } from "@door010/audit";
import type { TokenClaims } from "@door010/identity-profile";

type RequestWithAuth = FastifyRequest & {
  auth?: TokenClaims;
};

interface AuditedRoute {
  action: string;
  targetType: string;
  targetParam?: string;
}

const auditedRoutes = new Map<string, AuditedRoute>([
  ["PATCH /v1/profiles/:userId", {
    action: "profile.updated",
    targetType: "profile",
    targetParam: "userId"
  }],
  ["DELETE /v1/profiles/:userId", {
    action: "profile.deleted",
    targetType: "profile",
    targetParam: "userId"
  }],
  ["POST /v1/profiles/:userId/files/:kind", {
    action: "profile.file_uploaded",
    targetType: "profile",
    targetParam: "userId"
  }],
  ["POST /v1/profiles/:userId/notes", {
    action: "profile.note_created",
    targetType: "profile",
    targetParam: "userId"
  }],
  ["PATCH /v1/profiles/:userId/notes/:noteId", {
    action: "profile.note_updated",
    targetType: "profile",
    targetParam: "userId"
  }],
  ["DELETE /v1/profiles/:userId/notes/:noteId", {
    action: "profile.note_deleted",
    targetType: "profile",
    targetParam: "userId"
  }],
  ["POST /v1/backoffice/prompts", {
    action: "prompt.created",
    targetType: "prompt"
  }],
  ["POST /v1/backoffice/prompts/:promptConfigId/versions", {
    action: "prompt.version_created",
    targetType: "prompt",
    targetParam: "promptConfigId"
  }],
  ["POST /v1/backoffice/prompts/:promptConfigId/activate", {
    action: "prompt.activated",
    targetType: "prompt",
    targetParam: "promptConfigId"
  }],
  ["POST /v1/backoffice/candidates/:candidateUserId/notes", {
    action: "backoffice.note_created",
    targetType: "candidate",
    targetParam: "candidateUserId"
  }],
  ["POST /v1/backoffice/appointments", {
    action: "backoffice.appointment_created",
    targetType: "appointment"
  }],
  ["POST /v1/backoffice/provider-dead-letters/:deadLetterId/retry", {
    action: "provider.dead_letter_retried",
    targetType: "provider_dead_letter",
    targetParam: "deadLetterId"
  }],
  ["POST /v1/backoffice/provider-dead-letters/:deadLetterId/resolve", {
    action: "provider.dead_letter_resolved",
    targetType: "provider_dead_letter",
    targetParam: "deadLetterId"
  }],
  ["DELETE /v1/backoffice/provider-dead-letters/resolved", {
    action: "provider.dead_letters_purged",
    targetType: "provider_dead_letter"
  }]
]);

function sanitizeMetadata(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source)) {
    if (/password|token|authorization|contentBase64/i.test(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof item === "string" && item.length > 2_000) {
      result[key] = `${item.slice(0, 2_000)}…`;
    } else {
      result[key] = item;
    }
  }

  return result;
}

export async function registerAuditTrail(
  server: FastifyInstance,
  audit: AuditService
): Promise<void> {
  server.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode >= 400) return;

    const route = request.routeOptions.url;
    if (!route) return;

    const definition = auditedRoutes.get(
      `${request.method.toUpperCase()} ${route}`
    );
    if (!definition) return;

    const params =
      request.params && typeof request.params === "object"
        ? request.params as Record<string, unknown>
        : {};
    const claims = (request as RequestWithAuth).auth;
    const userAgent = request.headers["user-agent"];

    await audit.record({
      actorUserId: claims?.sub,
      action: definition.action,
      targetType: definition.targetType,
      targetId: definition.targetParam
        ? String(params[definition.targetParam] ?? "") || undefined
        : undefined,
      requestId: request.id,
      ipAddress: request.ip,
      userAgent:
        typeof userAgent === "string" ? userAgent : undefined,
      metadata: {
        method: request.method,
        route,
        body: sanitizeMetadata(request.body)
      }
    });
  });

  server.get("/v1/backoffice/audit-events", async (request, reply) => {
    const claims = (request as RequestWithAuth).auth;
    if (
      !claims?.roles.some((role) =>
        ["administrator", "superuser"].includes(role)
      )
    ) {
      return reply.code(claims ? 403 : 401).send({
        error: claims ? "forbidden" : "authentication_required"
      });
    }

    const parsed = z.object({
      actorUserId: z.string().uuid().optional(),
      action: z.string().max(150).optional(),
      targetType: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return {
      events: await audit.list(parsed.data)
    };
  });
}
