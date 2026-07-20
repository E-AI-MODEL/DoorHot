import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireBackofficeRole } from "./backoffice-guard.js";
import {
  explainOrchestrationRun,
  type AiOrchestrator,
  type OrchestrationRepository,
  type PlannerShadowRepository
} from "@door010/orchestration";

type RequestWithAuth = {
  auth?: {
    sub: string;
    roles: readonly string[];
  };
};

function canAccessUser(
  request: unknown,
  userId?: string
): boolean {
  if (!userId) return true;
  const auth = (request as RequestWithAuth).auth;
  return Boolean(
    auth &&
    (
      auth.sub === userId ||
      auth.roles.some((role) =>
        ["advisor", "administrator", "superuser"].includes(role)
      )
    )
  );
}

export async function registerOrchestrationRoutes(
  server: FastifyInstance,
  orchestrator: AiOrchestrator,
  repository: OrchestrationRepository,
  plannerShadowRepository: PlannerShadowRepository
): Promise<void> {
  server.post("/v1/orchestrate", async (request, reply) => {
    const parsed = z.object({
      message: z.string().trim().min(1).max(8_000),
      userId: z.string().uuid().optional(),
      conversationId: z.string().uuid().optional(),
      phaseKey: z.string().trim().min(1).max(100).optional(),
      routeKey: z.string().trim().min(1).max(150).optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }
    if (!canAccessUser(request, parsed.data.userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return orchestrator.execute({
      requestId: request.id,
      ...parsed.data
    });
  });

  server.get("/v1/backoffice/orchestration-runs", async (
    request,
    reply
  ) => {
    if (!requireBackofficeRole(request, reply)) return;

    const parsed = z.object({
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      runs: await repository.list(parsed.data.limit ?? 100)
    };
  });

  server.get(
    "/v1/backoffice/orchestration-runs/:runId",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      const parsed = z.object({
        runId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const run = await repository.findById(parsed.data.runId);
      if (!run) {
        return reply.code(404).send({
          error: "orchestration_run_not_found"
        });
      }

      return { run };
    }
  );

  server.get(
    "/v1/backoffice/orchestration-runs/:runId/explanation",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      const parsed = z.object({
        runId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const explanation = await explainOrchestrationRun({
        runId: parsed.data.runId,
        runs: repository,
        shadow: plannerShadowRepository
      });
      if (!explanation) {
        return reply.code(404).send({
          error: "orchestration_run_not_found"
        });
      }

      return { explanation };
    }
  );

  server.get(
    "/v1/backoffice/planner-shadow",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      const parsed = z.object({
        limit: z.coerce.number().int().min(1).max(500).optional()
      }).safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      return {
        evaluations: await plannerShadowRepository.list(
          parsed.data.limit ?? 100
        )
      };
    }
  );

}
