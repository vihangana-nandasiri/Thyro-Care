import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Reuse the pool across development hot reloads instead of leaking connections.
const globalForDb = globalThis as unknown as {
  thyrocareSql?: ReturnType<typeof postgres>;
};
const client =
  globalForDb.thyrocareSql ??
  postgres(process.env.DATABASE_URL_POOLED!, {
    prepare: false,
    max: 5,
    connect_timeout: 15,
    // Keep connections open: opening one to the us-east-2 Neon database takes
    // ~3.7 s (TLS + auth over a long round trip), so closing them after 20 s
    // idle made nearly every page after a pause wait that long. Dropped
    // connections (e.g. Neon auto-suspend) are replaced on the next query.
    idle_timeout: 0,
  });
if (process.env.NODE_ENV !== "production") globalForDb.thyrocareSql = client;

export const db = drizzle(client, { schema });
