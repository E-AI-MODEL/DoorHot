import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireBackofficeRole } from "./backoffice-guard.js";
import type {
  ConnectorHealthService,
  ConnectorRepository,
  FaqIngestionService,
  KnowledgeConnectorService,
  KnowledgeRepository,
  KnowledgeSearch,
  PipelineEventRepository,
  RetrievalLabelQueueRepository,
  ShadowEvaluationRepository,
  TrustedSourceRepository
} from "@door010/knowledge";

export async function registerKnowledgeRoutes(
  server: FastifyInstance,
  services: {
    search: KnowledgeSearch;
    ingestion: FaqIngestionService;
    knowledge: KnowledgeRepository;
    sources: TrustedSourceRepository;
    pipelineEvents?: PipelineEventRepository;
    shadowEvaluations?: ShadowEvaluationRepository;
    labelQueue?: RetrievalLabelQueueRepository;
    connectors?: ConnectorRepository;
    connectorService?: KnowledgeConnectorService;
    connectorHealth?: ConnectorHealthService;
    connectorScheduler?: { readonly activeScheduleCount: number };
  }
): Promise<void> {
  server.get("/v1/backoffice/ai-pipeline-events", async (
    request,
    reply
  ) => {
    if (!requireBackofficeRole(request, reply)) return;

    const parsed = z.object({
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request"
      });
    }

    return {
      events: await services.pipelineEvents?.list(
        parsed.data.limit ?? 100
      ) ?? []
    };
  });

  server.get("/v1/backoffice/connectors", async (request, reply) => {
    if (!requireBackofficeRole(request, reply)) return;

    return { connectors: await services.connectors?.list() ?? [] };
  });

  server.get(
    "/v1/backoffice/connectors/health",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      return {
        health: await services.connectorHealth?.summarize() ?? [],
        activeScheduleCount:
          services.connectorScheduler?.activeScheduleCount ?? 0
      };
    }
  );

  server.get("/v1/backoffice/connectors/runs", async (
    request,
    reply
  ) => {
    if (!requireBackofficeRole(request, reply)) return;

    const parsed = z.object({
      connectorId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      runs: await services.connectors?.listRuns(
        parsed.data.connectorId,
        parsed.data.limit ?? 100
      ) ?? []
    };
  });

  server.post("/v1/backoffice/connectors", async (
    request,
    reply
  ) => {
    if (!requireBackofficeRole(request, reply)) return;

    const parsed = z.object({
      connectorKey: z.string().trim().min(2).max(150),
      connectorType: z.enum(["json", "csv", "http-json"]),
      label: z.string().trim().min(2).max(200),
      enabled: z.boolean().default(true),
      scheduleCron: z.string().trim().max(100).optional(),
      snapshotMode: z.boolean().default(false),
      configuration: z.record(z.string(), z.unknown()).default({})
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    const now = new Date().toISOString();
    const existing = await services.connectors?.findByKey(
      parsed.data.connectorKey
    );
    const definition = {
      id: existing?.id ?? crypto.randomUUID(),
      ...parsed.data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await services.connectors?.upsert(definition);
    return reply.code(existing ? 200 : 201).send({ connector: definition });
  });

  server.post(
    "/v1/backoffice/connectors/:connectorKey/sync",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      const parsed = z.object({
        connectorKey: z.string().trim().min(2).max(150)
      }).safeParse(request.params);

      if (!parsed.success || !services.connectorService) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      try {
        const run = await services.connectorService.synchronize(
          parsed.data.connectorKey
        );
        return reply.code(run.status === "failed" ? 502 : 202).send({
          run
        });
      } catch (error) {
        return reply.code(404).send({
          error:
            error instanceof Error
              ? error.message
              : "connector_sync_failed"
        });
      }
    }
  );

  server.get("/v1/backoffice/reranker-shadow", async (
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
      evaluations: await services.shadowEvaluations?.list(
        parsed.data.limit ?? 100
      ) ?? []
    };
  });

  server.get("/v1/backoffice/retrieval-label-queue", async (
    request,
    reply
  ) => {
    if (!requireBackofficeRole(request, reply)) return;

    const parsed = z.object({
      status: z.enum([
        "pending",
        "claimed",
        "labeled",
        "discarded"
      ]).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    return {
      items: await services.labelQueue?.list(
        parsed.data.status,
        parsed.data.limit ?? 100
      ) ?? []
    };
  });

  server.post(
    "/v1/backoffice/retrieval-label-queue/:id/claim",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      const parsed = z.object({
        id: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        userId: z.string().uuid()
      }).safeParse(request.body);

      if (!parsed.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const item = await services.labelQueue?.claim(
        parsed.data.id,
        body.data.userId
      );
      if (!item) {
        return reply.code(409).send({
          error: "queue_item_not_claimable"
        });
      }

      return { item };
    }
  );

  server.post(
    "/v1/backoffice/retrieval-label-queue/:id/label",
    async (request, reply) => {
      if (!requireBackofficeRole(request, reply)) return;

      const parsed = z.object({
        id: z.string().uuid()
      }).safeParse(request.params);
      const body = z.object({
        userId: z.string().uuid(),
        relevantIds: z.array(z.string().uuid()).min(1),
        irrelevantIds: z.array(z.string().uuid()).default([]),
        notes: z.string().trim().max(2_000).optional()
      }).safeParse(request.body);

      if (!parsed.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" });
      }

      const item = await services.labelQueue?.label({
        id: parsed.data.id,
        ...body.data
      });
      if (!item) {
        return reply.code(409).send({
          error: "queue_item_not_labelable"
        });
      }

      return { item };
    }
  );

  server.get("/v1/knowledge/search", async (request, reply) => {
    const parsed = z.object({
      query: z.string().trim().min(2).max(500),
      category: z.string().trim().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(20).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return {
      results: await services.search.search(parsed.data.query, {
        category: parsed.data.category,
        limit: parsed.data.limit,
        approvedOnly: true
      })
    };
  });

  server.get("/v1/knowledge/items", async (request, reply) => {
    const parsed = z.object({
      reviewStatus: z.enum([
        "draft",
        "approved",
        "rejected",
        "archived"
      ]).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return {
      items: await services.knowledge.list(parsed.data)
    };
  });

  server.get("/v1/trusted-sources", async (request, reply) => {
    const parsed = z.object({
      activeOnly: z.coerce.boolean().optional()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return {
      sources: await services.sources.list(
        parsed.data.activeOnly ?? false
      )
    };
  });

  server.post("/v1/trusted-sources", async (request, reply) => {
    const parsed = z.object({
      sourceKey: z.string().trim().min(2).max(150),
      label: z.string().trim().min(2).max(200),
      baseUrl: z.string().url().optional(),
      authority: z.number().min(0).max(1),
      active: z.boolean().default(true),
      allowedDomains: z.array(z.string().min(1)).default([]),
      notes: z.string().max(5_000).optional()
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    const now = new Date().toISOString();
    const source = {
      id: globalThis.crypto.randomUUID(),
      ...parsed.data,
      createdAt: now,
      updatedAt: now
    };

    await services.sources.upsert(source);
    return reply.code(201).send({ source });
  });

  server.post("/v1/knowledge/ingest/faqs", async (
    request,
    reply
  ) => {
    const parsed = z.object({
      faqs: z.array(z.object({
        question: z.string().trim().min(2),
        answer: z.string().trim().min(2),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source_url: z.string().url().nullable().optional(),
        peildatum: z.string().regex(/^\d{4}-\d{2}$/).optional()
      })).min(1).max(2_000)
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    return reply.code(202).send(
      await services.ingestion.ingest(parsed.data)
    );
  });
}
