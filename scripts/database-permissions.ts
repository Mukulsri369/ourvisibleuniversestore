import assert from 'node:assert/strict';
import { database, closeDatabase } from '../src/backend/db.server';

try {
  const db = process.env.DB_NAME!;
  assert.ok(['ovu_main', 'ovu_store'].includes(db), 'This check is local-development only');
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_PORT, '3307');
  const [identity]: any = await database().query('SELECT VERSION() AS version, @@port AS port, CURRENT_USER() AS account');
  assert.equal(Number(identity[0].port), 3307);
  const other = db === 'ovu_main' ? 'ovu_store' : 'ovu_main';
  for (const sql of [`SELECT COUNT(*) FROM mysql.user`, `CREATE TABLE ${other}.__ovu_permission_probe (id INT)`]) {
    await assert.rejects(database().query(sql), (error: any) => ['ER_TABLEACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR'].includes(error.code));
  }
  if (process.env.DB_USER!.endsWith('_app')) {
    await assert.rejects(database().query('CREATE TABLE __ovu_permission_probe (id INT)'), (error: any) => error.code === 'ER_TABLEACCESS_DENIED_ERROR');
  }
  const [grants]: any = await database().query('SELECT TABLE_SCHEMA, PRIVILEGE_TYPE FROM information_schema.SCHEMA_PRIVILEGES');
  // Do not print SHOW GRANTS: MariaDB can include password verifiers in its output.
  console.log(JSON.stringify({ ...identity[0], schemaPrivileges: grants }, null, 2));
  console.log('PASS: own-database login; cross-database/system access denied; runtime DDL denied where applicable.');
} finally { await closeDatabase(); }
