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

  // These knowledge routes are not /v1/backoffice/-prefixed, so they were
  // reachable by any authenticated candidate before the guard was added.
  // A candidate could add a trusted domain (which feeds the web-fallback)
  // or ingest arbitrary FAQs into the knowledge base.
  it("forbids a candidate from adding a trusted source", async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: "POST",
      url: "/v1/trusted-sources",
      headers: { "x-test-roles": "candidate" },
      payload: {
        sourceKey: "attacker-source",
        label: "Attacker",
        authority: 0.9,
        allowedDomains: ["evil.example"]
      }
    });
    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("forbids a candidate from ingesting FAQs", async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: "POST",
      url: "/v1/knowledge/ingest/faqs",
      headers: { "x-test-roles": "candidate" },
      payload: {
        faqs: [{ question: "Geïnjecteerd?", answer: "Geïnjecteerd." }]
      }
    });
    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("forbids a candidate from listing knowledge items or sources", async () => {
    const server = await buildServer();
    const items = await server.inject({
      method: "GET",
      url: "/v1/knowledge/items",
      headers: { "x-test-roles": "candidate" }
    });
    const sources = await server.inject({
      method: "GET",
      url: "/v1/trusted-sources",
      headers: { "x-test-roles": "candidate" }
    });
    expect(items.statusCode).toBe(403);
    expect(sources.statusCode).toBe(403);
    await server.close();
  });

  it("allows an administrator to add a trusted source and ingest FAQs", async () => {
    const server = await buildServer();
    const source = await server.inject({
      method: "POST",
      url: "/v1/trusted-sources",
      headers: { "x-test-roles": "administrator" },
      payload: {
        sourceKey: "official-source",
        label: "Official",
        authority: 0.9,
        allowedDomains: ["rijksoverheid.nl"]
      }
    });
    expect(source.statusCode).toBe(201);

    const ingest = await server.inject({
      method: "POST",
      url: "/v1/knowledge/ingest/faqs",
      headers: { "x-test-roles": "administrator" },
      payload: {
        faqs: [{ question: "Wat is de pabo?", answer: "Een opleiding." }]
      }
    });
    expect(ingest.statusCode).toBe(202);
    await server.close();
  });
});
