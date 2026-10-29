import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { database } from './db.server';

/** Split reviewed SQL files without splitting quoted data or comments. No stored-program delimiters. */
export function splitSql(sql: string): string[] {
  const result: string[] = [];
  let statement = '', quote = '', lineComment = false, blockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i], next = sql[i + 1];
    if (lineComment) { if (ch === '\n') { lineComment = false; statement += '\n'; } continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; statement += ' '; } continue; }
    if (quote) {
      statement += ch;
      if (ch === '\\') { if (next) statement += sql[++i]; }
      else if (ch === quote) { if (next === quote) statement += sql[++i]; else quote = ''; }
      continue;
    }
    if (ch === '-' && next === '-' && /\s/.test(sql[i + 2] ?? ' ')) { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; statement += ch; continue; }
    if (ch === ';') { if (statement.trim()) result.push(statement.trim()); statement = ''; }
    else statement += ch;
  }
  if (quote || blockComment) throw new Error('Unterminated SQL literal/comment');
  if (statement.trim()) result.push(statement.trim());
  return result;
}

export async function migrate(directory: string) {
  if (!process.env.DB_USER?.endsWith('_migrator')) throw new Error('Use a dedicated schema migration account');
  const connection = await database().getConnection();
  const lockName = `ovu:${process.env.DB_NAME}:migrations`;
  let locked = false;
  try {
    await connection.query("SET time_zone = '+00:00'");
    const [lock]: any = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (Number(lock[0].acquired) !== 1) throw new Error('Another migration is running');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(191) PRIMARY KEY, checksum CHAR(64) NOT NULL, completed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migration_steps (
      name VARCHAR(191) NOT NULL, step_index INT NOT NULL, checksum CHAR(64) NOT NULL,
      PRIMARY KEY (name, step_index)
    ) ENGINE=InnoDB`);
    const applied: string[] = [];
    for (const name of (await readdir(directory)).filter(p => /^\d{4}_[\w-]+\.sql$/.test(p)).sort()) {
      const sql = await readFile(join(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [prior]: any = await connection.execute('SELECT checksum FROM schema_migrations WHERE name=?', [name]);
      if (prior.length) {
        if (prior[0].checksum !== checksum) throw new Error(`Applied migration checksum drift: ${name}`);
        continue;
      }
      const [steps]: any = await connection.execute('SELECT step_index,checksum FROM schema_migration_steps WHERE name=?', [name]);
      if (steps.some((s: any) => s.checksum !== checksum)) throw new Error(`Partial migration checksum drift: ${name}`);
      const done = new Set(steps.map((s: any) => Number(s.step_index)));
      const statements = splitSql(sql);
      for (let index = 0; index < statements.length; index++) {
        if (done.has(index)) continue;
        // MariaDB DDL commits implicitly. Every checked-in DDL statement must support replay.
        await connection.query(statements[index]);
        await connection.execute('INSERT INTO schema_migration_steps(name,step_index,checksum) VALUES(?,?,?)', [name,index,checksum]);
      }
      await connection.execute('INSERT INTO schema_migrations(name,checksum) VALUES(?,?)', [name,checksum]);
      applied.push(name);
    }
    return applied;
  } finally {
    if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    connection.release();
  }
}

/** Repair an uncommitted, incomplete migration only when every completed statement is identical. */
export async function repairPendingMigration(directory:string,name:string,previousSql:string){
  if(!process.env.DB_USER?.endsWith('_migrator')||!/^\d{4}_[\w-]+\.sql$/.test(name))throw new Error('Invalid pending migration repair');
  const nextSql=await readFile(join(directory,name),'utf8');
  const oldHash=createHash('sha256').update(previousSql).digest('hex');
  const newHash=createHash('sha256').update(nextSql).digest('hex');
  const oldStatements=splitSql(previousSql),newStatements=splitSql(nextSql);
  const c=await database().getConnection();let locked=false;
  const key=`ovu:${process.env.DB_NAME}:migrations`;
  try{
    const [lock]:any=await c.execute('SELECT GET_LOCK(?,10) AS acquired',[key]);
    if(Number(lock[0].acquired)!==1)throw new Error('Another migration is running');locked=true;
    const [complete]:any=await c.execute('SELECT name FROM schema_migrations WHERE name=?',[name]);
    if(complete.length)throw new Error('Completed migrations are immutable');
    const [steps]:any=await c.execute('SELECT step_index,checksum FROM schema_migration_steps WHERE name=?',[name]);
    if(!steps.length||steps.some((s:any)=>s.checksum!==oldHash||oldStatements[Number(s.step_index)]!==newStatements[Number(s.step_index)]))throw new Error('Repair would change a completed statement');
    await c.query(`CREATE TABLE IF NOT EXISTS schema_migration_repairs (
      id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(191) NOT NULL,previous_checksum CHAR(64) NOT NULL,
      new_checksum CHAR(64) NOT NULL,completed_steps INT NOT NULL,repaired_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB`);
    await c.beginTransaction();
    await c.execute('UPDATE schema_migration_steps SET checksum=? WHERE name=? AND checksum=?',[newHash,name,oldHash]);
    await c.execute('INSERT INTO schema_migration_repairs(name,previous_checksum,new_checksum,completed_steps) VALUES(?,?,?,?)',[name,oldHash,newHash,steps.length]);
    await c.commit();
    return {name,completedStatementsUnchanged:steps.length};
  }catch(error){await c.rollback();throw error;}finally{if(locked)await c.execute('SELECT RELEASE_LOCK(?)',[key]);c.release();}
}
