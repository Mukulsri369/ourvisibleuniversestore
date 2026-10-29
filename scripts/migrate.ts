import { resolve } from 'node:path';
import { migrate } from '../src/backend/migrations.server';
import { closeDatabase } from '../src/backend/db.server';
try {
  console.log(JSON.stringify({ applied: await migrate(resolve('mariadb/migrations')) }));
} finally { await closeDatabase(); }
