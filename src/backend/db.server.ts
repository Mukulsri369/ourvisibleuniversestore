import { createPool, type Pool, type PoolConnection } from 'mysql2/promise';

let pool: Pool | undefined;

export function databaseConfig() {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;
  for (const key of required) if (!process.env[key]) throw new Error(`Missing server configuration: ${key}`);
  const port = Number(process.env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DB_PORT');
  return {
    host: process.env.DB_HOST!, port, database: process.env.DB_NAME!,
    user: process.env.DB_USER!, password: process.env.DB_PASSWORD!,
    charset: 'utf8mb4', timezone: 'Z', connectionLimit: 8,
    multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true,
    enableKeepAlive: true, connectTimeout: 5000,
  };
}

export function database(): Pool {
  if (!pool) {
    pool = createPool(databaseConfig());
    // Queue this on every physical connection before its first application query.
    // Driver date conversion alone does not change SQL CURRENT_TIMESTAMP values.
    pool.pool.on('connection', connection => {
      connection.query("SET time_zone = '+00:00'", error => {
        if (error) connection.destroy();
      });
    });
  }
  return pool;
}

export async function closeDatabase() {
  const current = pool; pool = undefined;
  if (current) await current.end();
}

export async function transaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await database().getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
