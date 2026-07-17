import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  JourneyGraphMemoryService,
  MemoryGraphRepository
} from "@door010/domain";
import type {
  ExecutionRepository,
  NotificationDeliveryWorker,
  SafeExecutionService
} from "@door010/orchestration";

type RequestWithAuth = {
  auth?: {
    sub: string;
    roles: readonly string[];
  };
};

function canAccessUser(request: unknown, userId: string): boolean {
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

function isAdmin(request: unknown): boolean {
  const auth = (request as RequestWithAuth).auth;
  return Boolean(
    auth?.roles.some((role) =>
      ["administrator", "superuser"].includes(role)
    )
  );
}

export async function registerGraphExecutionRoutes(
  server: FastifyInstance,
  graphMemory: JourneyGraphMemoryService,
  graphRepository: MemoryGraphRepository,
  executionService: SafeExecutionService,
  executionRepository: ExecutionRepository,
  deliveryWorker: NotificationDeliveryWorker
): Promise<void> {
  server.post(
    "/v1/memory-graph/:userId/synchronize",
    async (request, reply) => {
      const parsed = z.object({
        userId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccessUser(request, parsed.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      try {
        return {
          graph: await graphMemory.synchronize(parsed.data.userId)
        };
      } catch (error) {
        return reply.code(404).send({
          error:
            error instanceof Error
              ? error.message
              : "journey_not_found"
        });
      }
    }
  );

  server.get(
    "/v1/memory-graph/:userId",
    async (request, reply) => {
      const parsed = z.object({
        userId: z.string().uuid()
      }).safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccessUser(request, parsed.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return graphMemory.context(parsed.data.userId);
    }
  );

  server.get(
    "/v1/memory-graph/:userId/nodes/:nodeId/neighbors",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid(),
        nodeId: z.string().uuid()
      }).safeParse(request.params);
      const query = z.object({
        depth: z.coerce.number().int().min(1).max(4).optional()
      }).safeParse(request.query);

      if (!params.success || !query.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccessUser(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return graphRepository.neighbors(
        params.data.userId,
        params.data.nodeId,
        query.data.depth ?? 1
      );
    }
  );

  server.post(
    "/v1/execution-requests",
    async (request, reply) => {
      const body = z.object({
        userId: z.string().uuid(),
        toolKey: z.enum([
          "reminder.schedule",
          "notification.queue"
        ]),
        payload: z.record(z.string(), z.unknown())
      }).safeParse(request.body);

      if (!body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccessUser(request, body.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return reply.code(202).send(
        await executionService.propose(body.data)
      );
    }
  );

  server.post(
    "/v1/execution-requests/:requestId/confirm",
    async (request, reply) => {
      const params = z.object({
        requestId: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        userId: z.string().uuid(),
        token: z.string().min(20).max(200),
        decision: z.enum(["approve", "reject"])
      }).safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccessUser(request, body.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      try {
        return {
          request: await executionService.confirm({
            requestId: params.data.requestId,
            ...body.data
          })
        };
      } catch (error) {
        return reply.code(409).send({
          error:
            error instanceof Error
              ? error.message
              : "execution_confirmation_failed"
        });
      }
    }
  );


  server.get(
    "/v1/notifications/:userId",
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid()
      }).safeParse(request.params);

      if (!params.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!canAccessUser(request, params.data.userId)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const delivered = await executionRepository.listOutbox(
        "delivered",
        200
      );
      return {
        items: delivered.filter(
          (item) =>
            item.userId === params.data.userId &&
            item.channel === "in_app"
        )
      };
    }
  );

  server.post(
    "/v1/backoffice/notification-outbox/process",
    async (request, reply) => {
      if (!isAdmin(request)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      return {
        result: await deliveryWorker.processDue()
      };
    }
  );

  server.get(
    "/v1/backoffice/execution-requests",
    async (request, reply) => {
      if (!isAdmin(request)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const query = z.object({
        userId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(500).optional()
      }).safeParse(request.query);

      if (!query.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      return {
        requests: await executionRepository.listRequests(
          query.data.userId,
          query.data.limit ?? 100
        )
      };
    }
  );

  server.get(
    "/v1/backoffice/notification-outbox",
    async (request, reply) => {
      if (!isAdmin(request)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const query = z.object({
        status: z.enum([
          "queued",
          "delivered",
          "failed",
          "cancelled"
        ]).optional(),
        limit: z.coerce.number().int().min(1).max(500).optional()
      }).safeParse(request.query);

      if (!query.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      return {
        items: await executionRepository.listOutbox(
          query.data.status,
          query.data.limit ?? 100
        )
      };
    }
  );
}
