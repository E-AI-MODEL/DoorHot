import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { enforceOwnership } from "./security.js";
import type {
  AuthService,
  AuthorizationService,
  ProfileService,
  TokenClaims,
  TokenService
} from "@door010/identity-profile";

type RequestWithAuth = FastifyRequest & {
  auth?: TokenClaims;
};

function bearerToken(request: FastifyRequest): string | undefined {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) return undefined;
  const token = value.slice("Bearer ".length).trim();
  return token || undefined;
}

export async function registerAuthProfileRoutes(
  server: FastifyInstance,
  services: {
    auth: AuthService;
    authorization: AuthorizationService;
    profileService: ProfileService;
    tokenService: TokenService;
    demoLoginEnabled?: boolean;
    // Minimum registration password length. Relaxed to 1 only in the
    // demo (in-memory or DEMO_ACCOUNTS_ENABLED); real environments
    // keep the full policy so the demo exception cannot weaken
    // production registration. Login is never length-checked so
    // existing demo accounts keep working.
    minPasswordLength?: number;
  }
): Promise<void> {
  const minPasswordLength = services.minPasswordLength ?? 12;
  server.addHook("preHandler", async (request, reply) => {
    const publicPaths = [
      "/health",
      "/health/live",
      "/health/ready",
      "/metrics",
      "/v1/auth/register",
      "/v1/auth/login",
      "/v1/auth/demo-login",
      "/v1/chat/general",
      "/v1/system/capabilities",
      "/v1/knowledge/search"
    ];
    if (publicPaths.includes(request.routeOptions.url ?? "")) return;

    const token = bearerToken(request);
    if (!token) {
      return reply.code(401).send({
        error: "authentication_required"
      });
    }

    try {
      (request as RequestWithAuth).auth =
        services.tokenService.verify(token);

      if (!enforceOwnership(request, reply)) {
        return;
      }
    } catch (error) {
      return reply.code(401).send({
        error: error instanceof Error
          ? error.message
          : "invalid_access_token"
      });
    }
  });

  server.post("/v1/auth/register", async (request, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(minPasswordLength).max(200)
    }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    try {
      return await services.auth.register(parsed.data);
    } catch (error) {
      return reply.code(409).send({
        error: error instanceof Error ? error.message : "register_failed"
      });
    }
  });

  server.post("/v1/auth/demo-login", async (_request, reply) => {
    if (!services.demoLoginEnabled) {
      return reply.code(403).send({
        error: "demo_login_disabled"
      });
    }

    try {
      return await services.auth.register({
        email: `demo-${randomUUID().slice(0, 8)}@demo.door010.local`,
        password: `${randomUUID()}${randomUUID()}`
      });
    } catch (error) {
      return reply.code(500).send({
        error: error instanceof Error
          ? error.message
          : "demo_login_failed"
      });
    }
  });

  server.post("/v1/auth/login", async (request, reply) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(1).max(200)
    }).safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      return await services.auth.login(parsed.data);
    } catch {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
  });

  server.get("/v1/auth/me", async (request) => {
    const claims = services.authorization.requireAuthenticated(
      (request as RequestWithAuth).auth
    );
    return {
      id: claims.sub,
      email: claims.email,
      roles: claims.roles
    };
  });

  server.get("/v1/profiles/:userId", async (request, reply) => {
    const parsed = z.object({ userId: z.string().uuid() })
      .safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      parsed.data.userId,
      ["advisor", "administrator", "superuser"]
    );

    try {
      return await services.profileService.get(parsed.data.userId);
    } catch {
      return reply.code(404).send({ error: "profile_not_found" });
    }
  });

  server.patch("/v1/profiles/:userId", async (request, reply) => {
    const params = z.object({ userId: z.string().uuid() })
      .safeParse(request.params);
    const body = z.object({
      firstName: z.string().max(100).nullable().optional(),
      lastName: z.string().max(100).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      bio: z.string().max(5_000).nullable().optional(),
      preferredSector: z.string().max(100).nullable().optional()
    }).safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      params.data.userId,
      ["administrator", "superuser"]
    );
    return services.profileService.update(params.data.userId, body.data);
  });

  server.delete("/v1/profiles/:userId", async (request, reply) => {
    const parsed = z.object({ userId: z.string().uuid() })
      .safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      parsed.data.userId,
      ["administrator", "superuser"]
    );
    await services.profileService.deleteProfile(parsed.data.userId);
    return reply.code(204).send();
  });

  server.post("/v1/profiles/:userId/files/:kind", async (request, reply) => {
    const params = z.object({
      userId: z.string().uuid(),
      kind: z.enum(["avatar", "cv"])
    }).safeParse(request.params);
    const body = z.object({
      originalFilename: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(150),
      contentBase64: z.string().min(1)
    }).safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      params.data.userId,
      ["administrator", "superuser"]
    );

    try {
      return await services.profileService.uploadFile({
        userId: params.data.userId,
        kind: params.data.kind,
        originalFilename: body.data.originalFilename,
        mimeType: body.data.mimeType,
        content: Buffer.from(body.data.contentBase64, "base64")
      });
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "upload_failed"
      });
    }
  });

  server.get("/v1/profiles/:userId/files/:kind/url", async (
    request,
    reply
  ) => {
    const parsed = z.object({
      userId: z.string().uuid(),
      kind: z.enum(["avatar", "cv"])
    }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      parsed.data.userId,
      ["advisor", "administrator", "superuser"]
    );
    try {
      return {
        url: await services.profileService.createFileUrl(
          parsed.data.userId,
          parsed.data.kind
        )
      };
    } catch {
      return reply.code(404).send({ error: "file_not_found" });
    }
  });

  server.get("/v1/profiles/:userId/notes", async (request, reply) => {
    const parsed = z.object({ userId: z.string().uuid() })
      .safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      parsed.data.userId,
      ["administrator", "superuser"]
    );
    return {
      notes: await services.profileService.listNotes(parsed.data.userId)
    };
  });

  server.post("/v1/profiles/:userId/notes", async (request, reply) => {
    const params = z.object({ userId: z.string().uuid() })
      .safeParse(request.params);
    const body = z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(1).max(20_000)
    }).safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      params.data.userId,
      ["administrator", "superuser"]
    );
    return services.profileService.createNote(
      params.data.userId,
      body.data
    );
  });

  server.patch("/v1/profiles/:userId/notes/:noteId", async (
    request,
    reply
  ) => {
    const params = z.object({
      userId: z.string().uuid(),
      noteId: z.string().uuid()
    }).safeParse(request.params);
    const body = z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(1).max(20_000)
    }).safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      params.data.userId,
      ["administrator", "superuser"]
    );
    return services.profileService.updateNote(
      params.data.userId,
      params.data.noteId,
      body.data
    );
  });

  server.delete("/v1/profiles/:userId/notes/:noteId", async (
    request,
    reply
  ) => {
    const parsed = z.object({
      userId: z.string().uuid(),
      noteId: z.string().uuid()
    }).safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });
    services.authorization.requireSelfOrRole(
      (request as RequestWithAuth).auth,
      parsed.data.userId,
      ["administrator", "superuser"]
    );
    await services.profileService.deleteNote(
      parsed.data.userId,
      parsed.data.noteId
    );
    return reply.code(204).send();
  });
}
