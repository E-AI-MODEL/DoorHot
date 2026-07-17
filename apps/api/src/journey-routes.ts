import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  JourneyEngine,
  ActionStatus,
  MilestoneStatus
} from "@door010/domain";

type RequestWithAuth = {
  auth?: {
    sub: string;
    roles: readonly string[];
  };
};

function canAccess(
  request: unknown,
  userId: string
): boolean {
  const claims = (request as RequestWithAuth).auth;
  return Boolean(
    claims &&
    (
      claims.sub === userId ||
      claims.roles.some((role) =>
        ["advisor", "administrator", "superuser"].includes(role)
      )
    )
  );
}

export async function registerJourneyRoutes(
  server: FastifyInstance,
  engine: JourneyEngine
): Promise<void> {
  server.post("/v1/journeys", async (request, reply) => {
    const parsed = z.object({
      userId: z.string().uuid(),
      phaseKey: z.string().trim().min(1).max(100),
      routeKey: z.string().trim().min(1).max(150).optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!canAccess(request, parsed.data.userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return engine.ensureJourney(parsed.data);
  });

  server.post(
    "/v1/journeys/:userId/context",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        phaseKey: z.string().trim().min(1).max(100),
        routeKey: z.string().trim().min(1).max(150).optional(),
        phaseConfidence: z.number().min(0).max(1).optional(),
        routeReason: z.string().trim().max(2_000).optional()
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccess(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return engine.synchronizeContext({
        userId: params.data.userId,
        ...body.data
      });
    }
  );

  server.get("/v1/journeys/:userId", async (request, reply) => {
    const parsed = z.object({
      userId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!canAccess(request, parsed.data.userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    try {
      return await engine.dashboard(parsed.data.userId);
    } catch (error) {
      return reply.code(404).send({
        error:
          error instanceof Error ? error.message : "journey_not_found"
      });
    }
  });

  server.post("/v1/journeys/:userId/goals", async (request, reply) => {
    const params = z.object({
      userId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      title: z.string().trim().min(2).max(250),
      description: z.string().trim().max(2_000).optional(),
      priority: z.number().int().min(0).max(100).optional(),
      targetAt: z.string().datetime().optional()
    }).safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!canAccess(request, params.data.userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      goal: await engine.addGoal({
        userId: params.data.userId,
        ...body.data
      })
    };
  });

  server.post(
    "/v1/journeys/:userId/milestones",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        goalId: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(250),
        weight: z.number().positive().max(100).optional(),
        sortOrder: z.number().int().min(0).optional()
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccess(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return {
        milestone: await engine.addMilestone({
          userId: params.data.userId,
          ...body.data
        })
      };
    }
  );

  server.post("/v1/journeys/:userId/blockers", async (request, reply) => {
    const params = z.object({
      userId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      blockerKey: z.string().trim().min(2).max(150),
      title: z.string().trim().min(2).max(250),
      severity: z.enum(["low", "medium", "high", "critical"]),
      confidence: z.number().min(0).max(1),
      evidenceIds: z.array(z.string().uuid()).optional()
    }).safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!canAccess(request, params.data.userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      blocker: await engine.upsertBlocker({
        userId: params.data.userId,
        ...body.data
      })
    };
  });

  server.post("/v1/journeys/:userId/actions", async (request, reply) => {
    const params = z.object({
      userId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      actionKey: z.string().trim().min(2).max(150),
      title: z.string().trim().min(2).max(250),
      description: z.string().trim().max(2_000).optional(),
      goalId: z.string().uuid().optional(),
      blockerId: z.string().uuid().optional(),
      priority: z.number().int().min(0).max(100).optional(),
      dueAt: z.string().datetime().optional(),
      metadata: z.record(z.string(), z.unknown()).optional()
    }).safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!canAccess(request, params.data.userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      action: await engine.addAction({
        userId: params.data.userId,
        ...body.data
      })
    };
  });

  server.patch(
    "/v1/journeys/:userId/actions/:actionId",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid(),
        actionId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        status: z.enum([
          "pending",
          "doing",
          "done",
          "cancelled",
          "expired"
        ])
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccess(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return {
        action: await engine.updateActionStatus(
          params.data.userId,
          params.data.actionId,
          body.data.status as ActionStatus
        )
      };
    }
  );

  server.patch(
    "/v1/journeys/:userId/milestones/:milestoneId",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid(),
        milestoneId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        status: z.enum(["pending", "completed", "skipped"])
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccess(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return {
        milestone: await engine.updateMilestoneStatus(
          params.data.userId,
          params.data.milestoneId,
          body.data.status as MilestoneStatus
        )
      };
    }
  );

  server.post(
    "/v1/journeys/:userId/blockers/:blockerId/resolve",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid(),
        blockerId: z.string().uuid()
      }).safeParse(request.params);

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccess(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return {
        blocker: await engine.resolveBlocker(
          params.data.userId,
          params.data.blockerId
        )
      };
    }
  );
}
