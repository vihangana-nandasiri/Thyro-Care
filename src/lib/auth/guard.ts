import { getSession } from "./session";
import { ForbiddenError } from "../errors";
import type { Role, SessionPayload } from "./jwt";

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ForbiddenError("Authentication required.");
  if (!roles.includes(session.role)) {
    throw new ForbiddenError("Not allowed for this role.");
  }
  return session;
}
