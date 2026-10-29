import type { PoolConnection } from 'mysql2/promise';
import { database } from './db.server';

export type Principal = { id: string; email: string; emailVerified: boolean };

export async function requireAdmin(principal: Principal | null, connection?: PoolConnection) {
  if (!principal || !principal.emailVerified) throw new Error('Administrator access required');
  const [rows]: any = await (connection ?? database()).execute(
    'SELECT role FROM app_roles WHERE user_id=? AND role IN (?,?)'+(connection?' FOR UPDATE':''), [principal.id, 'owner', 'admin'],
  );
  if (!rows.length) throw new Error('Administrator access required');
  return principal;
}

export function requireOwner(principal: Principal | null, targetUserId: string) {
  if (!principal || principal.id !== targetUserId) throw new Error('User access required');
  return principal;
}
