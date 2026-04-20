import { Pool, type PoolClient } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres@localhost:5432/switchboard";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function dbQuery<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function dbOne<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const [row] = await dbQuery<T>(text, params);
  return row ?? null;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function findUserIdByEmail(email: string): Promise<string> {
  const row = await dbOne<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (!row) throw new Error(`User not found by email: ${email}`);
  return row.id;
}

export async function findAppIdByName(name: string): Promise<string> {
  const row = await dbOne<{ id: string }>(
    `SELECT id FROM apps WHERE name = $1`,
    [name]
  );
  if (!row) throw new Error(`App not found by name: ${name}`);
  return row.id;
}

export async function findFlagIdByName(
  appId: string,
  flagName: string
): Promise<string> {
  const row = await dbOne<{ id: string }>(
    `SELECT id FROM feature_flags WHERE app_id = $1 AND name = $2`,
    [appId, flagName]
  );
  if (!row)
    throw new Error(`Flag not found: app=${appId} name=${flagName}`);
  return row.id;
}

export async function findEnvIdByName(
  appId: string,
  envName: string
): Promise<string> {
  const row = await dbOne<{ id: string }>(
    `SELECT id FROM app_environments WHERE app_id = $1 AND name = $2`,
    [appId, envName]
  );
  if (!row)
    throw new Error(`Env not found: app=${appId} name=${envName}`);
  return row.id;
}

export async function getFlagEnvValue(
  appId: string,
  flagName: string,
  envName: string
): Promise<unknown | null> {
  const row = await dbOne<{ value: unknown }>(
    `SELECT v.value
       FROM flag_environment_values v
       JOIN feature_flags f ON f.id = v.flag_id
       JOIN app_environments e ON e.id = v.environment_id
      WHERE v.app_id = $1 AND f.name = $2 AND e.name = $3`,
    [appId, flagName, envName]
  );
  return row?.value ?? null;
}

export async function countFlagAuditEntries(
  appId: string,
  flagName: string
): Promise<number> {
  const row = await dbOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM flag_audit_log
      WHERE app_id = $1 AND flag_name = $2`,
    [appId, flagName]
  );
  return row ? Number(row.count) : 0;
}
