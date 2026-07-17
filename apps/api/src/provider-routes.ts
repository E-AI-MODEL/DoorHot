import type {
  FastifyInstance,
  FastifyRequest
} from "fastify";
import { z } from "zod";
import {
  DeadLetterRetryService,
  type DeadLetterRepository,
  type ProviderStatusRegistry
} from "@door010/integrations";
import type { TokenClaims } from "@door010/identity-profile";

type AuthenticatedRequest = FastifyRequest & {
  auth?: TokenClaims;
};

export async function registerProviderRoutes(
  server: FastifyInstance,
  deadLetters: DeadLetterRepository,
  providerStatus?: ProviderStatusRegistry
): Promise<void> {

  const retryService = new DeadLetterRetryService(deadLetters);

  server.post(
    "/v1/backoffice/provider-dead-letters/:deadLetterId/retry",
    async (request, reply) => {
      const claims = (request as AuthenticatedRequest).auth;
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
        deadLetterId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      try {
        return {
          result: await retryService.retry(parsed.data.deadLetterId)
        };
      } catch (error) {
        return reply.code(409).send({
          error:
            error instanceof Error
              ? error.message
              : "dead_letter_retry_failed"
        });
      }
    }
  );

  server.post(
    "/v1/backoffice/provider-dead-letters/:deadLetterId/resolve",
    async (request, reply) => {
      const claims = (request as AuthenticatedRequest).auth;
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
        deadLetterId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const resolved = await deadLetters.resolve(
        parsed.data.deadLetterId
      );

      return resolved
        ? { resolved: true }
        : reply.code(404).send({
            error: "dead_letter_not_found"
          });
    }
  );

  server.delete(
    "/v1/backoffice/provider-dead-letters/resolved",
    async (request, reply) => {
      const claims = (request as AuthenticatedRequest).auth;
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
        olderThan: z.string().datetime().optional()
      }).safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "invalid_request"
        });
      }

      return {
        purged: await deadLetters.purgeResolved(
          parsed.data.olderThan
        )
      };
    }
  );

  server.get("/v1/backoffice/provider-status", async (
    request,
    reply
  ) => {
    const claims = (request as AuthenticatedRequest).auth;

    if (
      !claims?.roles.some((role) =>
        ["administrator", "superuser"].includes(role)
      )
    ) {
      return reply.code(claims ? 403 : 401).send({
        error: claims ? "forbidden" : "authentication_required"
      });
    }

    return {
      providers: providerStatus?.list() ?? []
    };
  });

  server.get("/v1/backoffice/provider-dead-letters", async (
    request,
    reply
  ) => {
    const claims = (request as AuthenticatedRequest).auth;

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
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request"
      });
    }

    return {
      deadLetters: await deadLetters.list(parsed.data.limit ?? 100)
    };
  });
}
