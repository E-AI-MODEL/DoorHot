import Fastify from "fastify";
import { z } from "zod";
import { createApplicationServices } from "./bootstrap.js";
import { createProductionServices } from "./production-bootstrap.js";
import { registerAuthProfileRoutes } from "./auth-profile-routes.js";
import { createParityFlowServices } from "./parity-flows-bootstrap.js";
import { registerParityFlowRoutes } from "./parity-flow-routes.js";
import { registerKnowledgeRoutes } from "./knowledge-routes.js";
import { registerPromptRoutes } from "./prompt-routes.js";
import { registerAuditTrail } from "./audit-routes.js";
import { registerProviderRoutes } from "./provider-routes.js";
import { registerSecurityControls } from "./security.js";
import { registerJourneyRoutes } from "./journey-routes.js";
import { registerOrchestrationRoutes } from "./orchestration-routes.js";
import { registerGraphExecutionRoutes } from "./graph-execution-routes.js";
import type { TokenClaims } from "@door010/identity-profile";
import {
  MetricsRegistry,
  createStructuredLogRecord
} from "@door010/observability";

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "request.headers.authorization",
        "password",
        "body.password",
        "accessToken"
      ],
      censor: "[REDACTED]"
    }
  },
  requestIdHeader: "x-request-id"
});

registerSecurityControls(server);

type RequestWithAuth = {
  auth?: TokenClaims;
};

function requestClaims(request: unknown): TokenClaims | undefined {
  return (request as RequestWithAuth).auth;
}

function hasPrivilegedRole(claims: TokenClaims): boolean {
  return claims.roles.some((role) =>
    ["advisor", "administrator", "superuser"].includes(role)
  );
}

const metrics = new MetricsRegistry();
const requestStartTimes = new WeakMap<object, bigint>();

async function publishAdvisorMessage(
  conversationId: string,
  message: unknown
): Promise<void> {
  await services.realtime.publish(
    `conversation:${conversationId}`,
    JSON.stringify(message)
  );
}

server.addHook("onRequest", async (request) => {
  metrics.requestStarted();
  requestStartTimes.set(request, process.hrtime.bigint());

  request.log.info(
    createStructuredLogRecord({
      level: "info",
      event: "http.request.started",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url ?? request.url
    })
  );
});

server.addHook("onResponse", async (request, reply) => {
  const startedAt = requestStartTimes.get(request);
  const durationSeconds = startedAt
    ? Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
    : 0;
  const route = request.routeOptions.url ?? "unmatched";

  metrics.requestFinished({
    method: request.method,
    route,
    statusCode: reply.statusCode,
    durationSeconds
  });

  const logRecord = createStructuredLogRecord({
    level: reply.statusCode >= 500 ? "error" : "info",
    event: "http.request.completed",
    requestId: request.id,
    method: request.method,
    route,
    statusCode: reply.statusCode,
    durationMs: durationSeconds * 1000
  });

  if (reply.statusCode >= 500) {
    request.log.error(logRecord);
  } else {
    request.log.info(logRecord);
  }
});

server.setErrorHandler((error: unknown, request, reply) => {
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  const errorName =
    error instanceof Error ? error.name : "UnknownError";
  const message =
    error instanceof Error ? error.message : "Unknown error";

  request.log.error(
    createStructuredLogRecord({
      level: "error",
      event: "http.request.failed",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url ?? request.url,
      statusCode,
      errorName,
      message
    })
  );

  void reply.code(statusCode).send({
    error: "internal_server_error",
    requestId: request.id
  });
});
const storageMode = process.env.APP_STORAGE_MODE ?? "memory";
const services = storageMode === "postgres"
  ? await createProductionServices()
  : await createApplicationServices();

await registerAuditTrail(server, services.audit);

await registerProviderRoutes(
  server,
  "liveIntegrations" in services
    ? services.liveIntegrations.deadLetters
    : {
        async append() {},
        async findById() { return null; },
        async list() { return []; },
        async resolve() { return false; },
        async purgeResolved() { return 0; }
      },
  "liveIntegrations" in services
    ? services.liveIntegrations.providerStatus
    : undefined
);

await registerAuthProfileRoutes(server, {
  auth: services.auth,
  authorization: services.authorization,
  profileService: services.profileService,
  tokenService: services.tokenService
});

const parityFlows = await createParityFlowServices({
  datasetsDirectory: services.datasetsDirectory,
  storageMode: services.storageMode,
  executor: "executor" in services ? services.executor : undefined,
  liveIntegrations: "liveIntegrations" in services
    ? services.liveIntegrations
    : undefined
});
await registerParityFlowRoutes(server, parityFlows);

await registerKnowledgeRoutes(server, {
  search: services.knowledgeSearch,
  ingestion: services.knowledgeIngestion,
  knowledge: services.knowledgeRepository,
  sources: services.trustedSourceRepository,
  pipelineEvents: services.pipelineEvents,
  shadowEvaluations: services.shadowEvaluations,
  labelQueue: services.labelQueue,
  connectors: services.connectors,
  connectorService: services.connectorService,
  connectorHealth: services.connectorHealth,
  connectorScheduler: services.connectorScheduler
});

await registerPromptRoutes(
  server,
  services.promptManagement
);
await registerJourneyRoutes(server, services.journeyEngine);
await registerOrchestrationRoutes(
  server,
  services.orchestrator,
  services.orchestrationRepository,
  services.plannerShadowRepository
);
await registerGraphExecutionRoutes(
  server,
  services.graphMemory,
  services.graphRepository,
  services.executionService,
  services.executionRepository,
  services.deliveryWorker
);

const phaseSystemKeySchema = z.enum([
  "phase-4",
  "phase-5",
  "phase-9"
]);

const phaseSystemScopeSchema = z.enum([
  "organization",
  "user",
  "conversation"
]);

const phaseSystemPreferenceSchema = z.object({
  scope: phaseSystemScopeSchema,
  scopeId: z.string().min(1),
  phaseSystemKey: phaseSystemKeySchema,
  enabled: z.boolean().optional()
});

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  conversationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional()
});


const advisorChatSchema = z.object({
  conversationId: z.string().uuid(),
  advisorUserId: z.string().uuid(),
  candidateUserId: z.string().uuid(),
  message: z.string().trim().min(1).max(8_000)
});

const mutationConfirmationSchema = z.object({
  mutationId: z.string().uuid(),
  decision: z.enum(["accept", "reject"]),
  userId: z.string().uuid(),
  reason: z.string().trim().max(2_000).optional()
});


server.get("/health/live", async () => ({
  status: "ok",
  service: "door010-api",
  version: "4.1.0"
}));

server.get("/health/ready", async (_request, reply) => {
  try {
    const databaseHealthy =
      "executor" in services
        ? await services.executor.healthCheck()
        : true;

    return databaseHealthy
      ? {
          status: "ready",
          service: "door010-api",
          version: "4.1.0",
          storageMode: services.storageMode
        }
      : reply.code(503).send({
          status: "not_ready",
          service: "door010-api",
          version: "4.1.0"
        });
  } catch (error) {
    server.log.error(error);
    return reply.code(503).send({
      status: "not_ready",
      service: "door010-api",
      version: "4.1.0"
    });
  }
});

server.get("/metrics", async (request, reply) => {
  const configuredToken = process.env.METRICS_TOKEN;

  if (configuredToken) {
    const authorization = request.headers.authorization;
    const suppliedToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;

    if (suppliedToken !== configuredToken) {
      return reply.code(401).send({
        error: "metrics_authentication_required"
      });
    }
  }

  return reply
    .type("text/plain; version=0.0.4; charset=utf-8")
    .send(metrics.renderPrometheus());
});

server.get("/health", async (_request, reply) => {
  try {
    const databaseHealthy =
      "executor" in services
        ? await services.executor.healthCheck()
        : true;

    if (!databaseHealthy) {
      return reply.code(503).send({
        status: "unhealthy",
        service: "door010-api",
        version: "4.1.0",
        storageMode: services.storageMode
      });
    }

    return {
      status: "ok",
      service: "door010-api",
      version: "4.1.0",
      storageMode: services.storageMode,
      datasetsDirectory: services.datasetsDirectory
    };
  } catch (error) {
    server.log.error(error);
    return reply.code(503).send({
      status: "unhealthy",
      service: "door010-api",
      version: "4.1.0",
      storageMode: services.storageMode
    });
  }
});

server.get("/v1/system/capabilities", async () => ({
  chatbots: ["general-coach", "personal-journey-coach"],
  phaseSystems: ["phase-4", "phase-5", "phase-9"],
  mutationConfirmation: true,
  humanChannels: ["advisor-messaging"],
  retrievalModes: ["lexical", "hybrid"],
  providers: {
    manualImport: true,
    llm: Boolean(process.env.LLM_BASE_URL),
    vacancies: Boolean(process.env.VACANCY_API_URL),
    events: Boolean(process.env.EVENT_API_URL),
    notifications: Boolean(process.env.NOTIFICATION_WEBHOOK_URL)
  },
  auditTrail: true
}));

server.post("/v1/settings/phase-system", async (request, reply) => {
  const parsed = phaseSystemPreferenceSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  const preference = {
    scope: parsed.data.scope,
    scopeId: parsed.data.scopeId,
    phaseSystemKey: parsed.data.phaseSystemKey,
    enabled: parsed.data.enabled ?? true,
    updatedAt: new Date().toISOString()
  } as const;

  services.phasePreferenceRepository.save(preference);
  return { preference };
});

server.get("/v1/settings/phase-system", async (request, reply) => {
  const parsed = z.object({
    organizationId: z.string().optional(),
    userId: z.string().optional(),
    conversationId: z.string().optional()
  }).safeParse(request.query);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  return services.phasePreferenceResolver.resolve(parsed.data);
});

async function registerMutations(input: {
  response: Awaited<
    ReturnType<typeof services.generalCoach.respond>
  >;
  conversationId?: string;
  userId?: string;
}): Promise<unknown> {
  const context = await services.contextProvider.getContext({
    message: "",
    conversationId: input.conversationId,
    userId: input.userId
  });

  const pendingMutations = await Promise.all(
    input.response.mutations.map((mutation) =>
      services.mutationStore.create({
        conversationId: input.conversationId,
        userId: input.userId,
        profileId: context.profileId,
        mutation
      })
    )
  );

  return {
    ...input.response,
    pendingMutations
  };
}

server.post("/v1/chat/general", async (request, reply) => {
  const parsed = chatRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  const [response, orchestration] = await Promise.all([
    services.generalCoach.respond(parsed.data),
    services.orchestrator.execute({
      requestId: request.id,
      ...parsed.data
    })
  ]);
  const result = await registerMutations({
    response,
    conversationId: parsed.data.conversationId,
    userId: parsed.data.userId
  });
  return {
    ...(result as Record<string, unknown>),
    orchestration: {
      runId: orchestration.id,
      intent: orchestration.intent,
      status: orchestration.status,
      plan: orchestration.plan
    }
  };
});

server.post("/v1/chat/personal", async (request, reply) => {
  const parsed = chatRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }
  if (!parsed.data.userId) {
    return reply.code(401).send({
      error: "authentication_required"
    });
  }

  const [response, orchestration] = await Promise.all([
    services.personalCoach.respond(parsed.data),
    services.orchestrator.execute({
      requestId: request.id,
      ...parsed.data
    })
  ]);
  const result = await registerMutations({
    response,
    conversationId: parsed.data.conversationId,
    userId: parsed.data.userId
  });
  return {
    ...(result as Record<string, unknown>),
    orchestration: {
      runId: orchestration.id,
      intent: orchestration.intent,
      status: orchestration.status,
      plan: orchestration.plan
    }
  };
});


server.post("/v1/chat/candidate", async (request, reply) => {
  const parsed = z.object({
    conversationId: z.string().uuid(),
    candidateUserId: z.string().uuid(),
    message: z.string().trim().min(1).max(10_000)
  }).safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  const message = await services.advisorChat.sendCandidate(
    parsed.data
  );
  await publishAdvisorMessage(
    parsed.data.conversationId,
    message
  );

  return { message };
});

server.post("/v1/chat/advisor", async (request, reply) => {
  const parsed = advisorChatSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  const message = await services.advisorChat.send(parsed.data);
  await publishAdvisorMessage(
    parsed.data.conversationId,
    message
  );

  return { message };
});

server.get(
  "/v1/conversations/:conversationId/stream",
  async (request, reply) => {
    const parsed = z.object({
      conversationId: z.string().uuid()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request"
      });
    }

    const claims = requestClaims(request);
    if (
      !claims ||
      !(await services.advisorChat.canAccess(
        parsed.data.conversationId,
        claims.sub,
        hasPrivilegedRole(claims)
      ))
    ) {
      return reply.code(403).send({ error: "forbidden" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const eventName =
      `conversation:${parsed.data.conversationId}`;
    const send = (payload: string): void => {
      reply.raw.write(`event: message\ndata: ${payload}\n\n`);
    };
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 15_000);

    const unsubscribe = await services.realtime.subscribe(
      eventName,
      send
    );

    request.raw.once("close", () => {
      clearInterval(heartbeat);
      void unsubscribe().finally(() => {
        reply.raw.end();
      });
    });
  }
);

server.get("/v1/conversations/:conversationId/messages", async (
  request,
  reply
) => {
  const parsed = z.object({
    conversationId: z.string().uuid()
  }).safeParse(request.params);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  const claims = requestClaims(request);
  if (
    !claims ||
    !(await services.advisorChat.canAccess(
      parsed.data.conversationId,
      claims.sub,
      hasPrivilegedRole(claims)
    ))
  ) {
    return reply.code(403).send({ error: "forbidden" });
  }

  return {
    messages: await services.advisorChat.history(
      parsed.data.conversationId
    )
  };
});

server.get("/v1/mutations/pending", async (request, reply) => {
  const parsed = z.object({
    conversationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional()
  }).safeParse(request.query);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  return {
    mutations: await services.mutationStore.listPending(parsed.data)
  };
});

server.post("/v1/mutations/confirm", async (request, reply) => {
  const parsed = mutationConfirmationSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  try {
    const mutation = await services.mutationService.resolve(parsed.data);
    return { mutation };
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "mutation_failed";
    const status =
      code === "mutation_not_found"
        ? 404
        : code === "mutation_forbidden"
          ? 403
          : code === "mutation_already_resolved" ||
              code === "phase_transition_conflict"
            ? 409
            : 400;

    return reply.code(status).send({ error: code });
  }
});

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);

async function shutdown(signal: string): Promise<void> {
  server.log.info({ signal }, "Shutting down Door010 API");

  try {
    await server.close();

    if ("executor" in services) {
      await services.executor.close();
    }
  } catch (error) {
    server.log.error(error);
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

server.listen({ host, port }).catch((error: unknown) => {
  server.log.error(error);
  process.exit(1);
});
