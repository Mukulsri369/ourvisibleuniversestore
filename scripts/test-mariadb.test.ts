import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { resolve } from 'node:path';
import { database, closeDatabase } from '../src/backend/db.server';
import { migrate } from '../src/backend/migrations.server';

assert.equal(process.env.DB_HOST,'127.0.0.1');assert.equal(process.env.DB_PORT,'3307');assert.equal(process.env.DB_NAME,'ovu_store');
after(closeDatabase);
test('Store migrations replay without altering completed schema',async()=>{assert.deepEqual(await migrate(resolve('mariadb/migrations')),[]);});
test('Store MariaDB enforces Unicode, UTC, ordered category FKs, editor JSON and same-page publication',async()=>{
  const c=await database().getConnection();
  try {
    await c.beginTransaction();
    const [clock]:any=await c.query('SELECT @@session.time_zone AS zone');assert.equal(clock[0].zone,'+00:00');
    const product=randomUUID(),category=randomUUID(),category2=randomUUID();
    await c.execute('INSERT INTO categories(id,name,slug) VALUES(?,?,?),(?,?,?)',[category,'Stars',category,category2,'Planets',category2]);
    await c.execute('INSERT INTO products(id,name,slug) VALUES(?,?,?)',[product,'तारा 🌌',product]);
    const [rows]:any=await c.execute('SELECT name FROM products WHERE id=?',[product]);assert.equal(rows[0].name,'तारा 🌌');
    await c.execute('INSERT INTO product_categories(product_id,category_id,position) VALUES(?,?,0)',[product,category]);
    await assert.rejects(c.execute('INSERT INTO product_categories(product_id,category_id,position) VALUES(?,?,0)',[product,category2]));
    await assert.rejects(c.execute('INSERT INTO product_categories(product_id,category_id,position) VALUES(?,?,1)',[product,randomUUID()]));
    const page=randomUUID(),other=randomUUID(),version=randomUUID();
    await c.execute('INSERT INTO store_pages(id,page_key,slug,title) VALUES(?,?,?,?),(?,?,?,?)',[page,page,'/'+page,'Synthetic page',other,other,'/'+other,'Other synthetic page']);
    const doc=JSON.stringify({id:'fixture',schemaVersion:'1',root:[]});
    await c.execute('INSERT INTO store_page_versions(id,page_id,version_number,schema_version,document_snapshot,checksum) VALUES(?,?,1,?,?,?)',[version,page,'1',doc,'synthetic-checksum']);
    await assert.rejects(c.execute('UPDATE store_page_versions SET document_snapshot=? WHERE id=?',[JSON.stringify({id:'fixture',schemaVersion:'1',root:{}}),version]));
    await assert.rejects(c.execute('UPDATE store_pages SET published_version_id=? WHERE id=?',[version,other]));
    await c.execute('UPDATE store_pages SET published_version_id=? WHERE id=?',[version,page]);
    await assert.rejects(c.execute('INSERT INTO site_settings(id) VALUES(2)'));
  } finally {await c.rollback();c.release();}
});
