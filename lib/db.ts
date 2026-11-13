import { Pool, type QueryResultRow } from "pg";

// One pool per server instance. On Vercel each serverless instance gets its own,
// so keep it small and use Neon's pooled connection string.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
}

export function getPool(): Pool {
  if (!globalForPg.pgPool) globalForPg.pgPool = createPool();
  return globalForPg.pgPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
