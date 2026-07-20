import type { FastifyReply, FastifyRequest } from "fastify";

type RequestWithAuth = {
  auth?: {
    sub: string;
    roles: readonly string[];
  };
};

// Roles allowed to reach backoffice/operations endpoints by default.
export const BACKOFFICE_ROLES = [
  "administrator",
  "superuser"
] as const;

// Centralized backoffice authorization. Global authentication is
// enforced by the auth preHandler; this guard adds the role check so
// every backoffice route restricts access consistently instead of
// relying on per-route ad-hoc checks. Returns true when the caller is
// authorized; otherwise it sends 403 and returns false so the handler
// can stop.
export function requireBackofficeRole(
  request: FastifyRequest,
  reply: FastifyReply,
  roles: readonly string[] = BACKOFFICE_ROLES
): boolean {
  const auth = (request as RequestWithAuth).auth;
  if (!auth || !auth.roles.some((role) => roles.includes(role))) {
    reply.code(403).send({ error: "forbidden" });
    return false;
  }
  return true;
}
