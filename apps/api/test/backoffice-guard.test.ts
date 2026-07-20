import Fastify from "fastify";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { registerKnowledgeRoutes } from "../src/knowledge-routes.js";
import { createApplicationServices } from "../src/bootstrap.js";

// The global auth preHandler enforces authentication; these tests
// verify the backoffice role guard on knowledge-backoffice routes: a
// plain authenticated user is forbidden, an administrator is allowed.
async function buildServer() {
  const services = await createApplicationServices(
    resolve(process.cwd(), "../../datasets")
  );
  const server = Fastify();
  server.addHook("preHandler", async (request) => {
    const roles = String(
      request.headers["x-test-roles"] ?? ""
    )
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
    (request as { auth?: unknown }).auth = roles.length
      ? { sub: "11111111-1111-4111-8111-111111111111", roles }
      : undefined;
  });
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
  return server;
}

describe("knowledge backoffice authorization", () => {
  it("forbids a plain authenticated candidate", async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/backoffice/reranker-shadow",
      headers: { "x-test-roles": "candidate" }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    await server.close();
  });

  it("forbids a request without any role", async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/backoffice/connectors"
    });
    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("allows an administrator", async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/backoffice/connectors",
      headers: { "x-test-roles": "administrator" }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("connectors");
    await server.close();
  });
});
