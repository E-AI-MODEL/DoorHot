import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import { z } from "zod";
import type { TokenClaims } from "@door010/identity-profile";
import type { PromptManagementService } from "@door010/backoffice";

type RequestWithAuth = FastifyRequest & {
  auth?: TokenClaims;
};

function requireAdministrator(
  request: FastifyRequest,
  reply: FastifyReply
): TokenClaims | undefined {
  const claims = (request as RequestWithAuth).auth;
  const allowed = claims?.roles.some((role) =>
    ["administrator", "superuser"].includes(role)
  );

  if (!claims) {
    void reply.code(401).send({
      error: "authentication_required"
    });
    return undefined;
  }

  if (!allowed) {
    void reply.code(403).send({ error: "forbidden" });
    return undefined;
  }

  return claims;
}

export async function registerPromptRoutes(
  server: FastifyInstance,
  service: PromptManagementService
): Promise<void> {
  server.get("/v1/backoffice/prompts", async (request, reply) => {
    if (!requireAdministrator(request, reply)) return;
    return { prompts: await service.list() };
  });

  server.post("/v1/backoffice/prompts", async (request, reply) => {
    const claims = requireAdministrator(request, reply);
    if (!claims) return;

    const parsed = z.object({
      chatbotKey: z.enum([
        "general-coach",
        "personal-journey-coach"
      ]),
      configKey: z.string().trim().min(2).max(100),
      title: z.string().trim().min(2).max(200),
      systemPrompt: z.string().trim().min(20).max(50_000),
      notes: z.string().trim().max(10_000).optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    try {
      const prompt = await service.create({
        ...parsed.data,
        createdByUserId: claims.sub
      });
      return reply.code(201).send({ prompt });
    } catch (error) {
      return reply.code(409).send({
        error:
          error instanceof Error
            ? error.message
            : "prompt_create_failed"
      });
    }
  });

  server.post(
    "/v1/backoffice/prompts/:promptConfigId/versions",
    async (request, reply) => {
      const claims = requireAdministrator(request, reply);
      if (!claims) return;

      const params = z.object({
        promptConfigId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        systemPrompt: z.string().trim().min(20).max(50_000),
        notes: z.string().trim().max(10_000).optional()
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({
          error: "invalid_request"
        });
      }

      try {
        return {
          version: await service.createVersion({
            promptConfigId: params.data.promptConfigId,
            ...body.data,
            createdByUserId: claims.sub
          })
        };
      } catch (error) {
        return reply.code(404).send({
          error:
            error instanceof Error
              ? error.message
              : "prompt_version_create_failed"
        });
      }
    }
  );

  server.post(
    "/v1/backoffice/prompts/:promptConfigId/activate",
    async (request, reply) => {
      if (!requireAdministrator(request, reply)) return;

      const params = z.object({
        promptConfigId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        version: z.number().int().min(1)
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({
          error: "invalid_request"
        });
      }

      try {
        return {
          prompt: await service.activateVersion({
            promptConfigId: params.data.promptConfigId,
            version: body.data.version
          })
        };
      } catch (error) {
        return reply.code(404).send({
          error:
            error instanceof Error
              ? error.message
              : "prompt_activate_failed"
        });
      }
    }
  );
}
