import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { repairPendingMigration } from '../src/backend/migrations.server';
import { closeDatabase } from '../src/backend/db.server';
try{
  const [name,previousPath]=process.argv.slice(2);
  if(!name||!previousPath)throw new Error('Provide migration name and the preserved previous SQL file');
  console.log(await repairPendingMigration(resolve('mariadb/migrations'),name,await readFile(previousPath,'utf8')));
}finally{await closeDatabase();}
