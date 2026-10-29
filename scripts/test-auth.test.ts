import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createIndependentAuth, authOptions } from '../src/backend/auth.server';
import { database, closeDatabase } from '../src/backend/db.server';
import { requireAdmin, requireOwner } from '../src/backend/authorization.server';

assert.equal(process.env.DB_HOST,'127.0.0.1');
assert.equal(process.env.DB_PORT,'3307');
assert.equal(process.env.DB_NAME,'ovu_store');
const messages: Array<{to:string;subject:string;url:string}>=[];
const auth=createIndependentAuth({send: async message=>{messages.push(message);}});
const base=process.env.BETTER_AUTH_URL!;
const email=`auth-test-${randomUUID()}@example.test`;
const password='Local-Only-Authentication-Check!-'+randomUUID();
let userId='';
const headers={origin:base,'content-type':'application/json'};

test('HTTP authentication is limited to explicit loopback development and HTTPS always uses secure cookies',()=>{
  const flag=process.env.OVU_LOCAL_DEVELOPMENT;
  try {
    process.env.BETTER_AUTH_URL='http://public.example';process.env.OVU_LOCAL_DEVELOPMENT='true';
    assert.throws(()=>authOptions(),/requires HTTPS/);
    process.env.BETTER_AUTH_URL=base;process.env.OVU_LOCAL_DEVELOPMENT='false';
    assert.throws(()=>authOptions(),/requires HTTPS/);
    process.env.BETTER_AUTH_URL='https://public.example';
    assert.equal(authOptions().advanced?.useSecureCookies,true);
  } finally {process.env.BETTER_AUTH_URL=base;process.env.OVU_LOCAL_DEVELOPMENT=flag;}
});
async function call(path:string,body?:unknown,cookie?:string,origin=base){
  return auth.handler(new Request(base+'/api/auth'+path,{
    method:body===undefined?'GET':'POST',headers:{...headers,origin,...(cookie?{cookie}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  }));
}
function cookies(response:Response){return response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}

after(async()=>{
  if(userId)await database().execute('DELETE FROM auth_user WHERE id=?',[userId]);
  await closeDatabase();
});

test('independent signup, verification, login, authorization and logout persist in MariaDB',async()=>{
  const signup=await call('/sign-up/email',{name:'Synthetic Migration Test',email,password});
  assert.equal(signup.status,200);
  const result=await signup.json();userId=result.user.id;
  assert.match(userId,/^[0-9a-f-]{36}$/);
  assert.equal(result.token,null);
  assert.equal((await call('/sign-in/email',{email,password})).status,403);
  assert.equal(messages.length,1);
  const verification=await auth.handler(new Request(messages[0].url,{headers:{origin:base}}));
  assert.ok([200,302].includes(verification.status));
  const login=await call('/sign-in/email',{email,password});
  assert.equal(login.status,200);
  assert.ok(login.headers.getSetCookie().some(c=>/HttpOnly/i.test(c)));
  const cookie=cookies(login);assert.ok(cookie.length>20);
  const session=await (await call('/get-session',undefined,cookie)).json();
  assert.equal(session.user.id,userId);
  assert.equal(session.user.emailVerified,true);
  assert.throws(()=>requireOwner(session.user,randomUUID()));
  await assert.rejects(requireAdmin({...session.user,role:'admin'}),/Administrator/);
  await database().execute('INSERT INTO app_roles(user_id,role) VALUES(?,?)',[userId,'admin']);
  assert.equal((await requireAdmin(session.user)).id,userId);
  await assert.rejects(requireAdmin({...session.user,emailVerified:false}),/Administrator/);
  await database().execute('DELETE FROM app_roles WHERE user_id=?',[userId]);
  await assert.rejects(requireAdmin(session.user),/Administrator/);
  assert.equal((await call('/sign-in/email',{email,password:'a-wrong-password-value'})).status,401);
  const crossSite=await call('/sign-out',{},cookie,'https://untrusted.example');
  assert.equal(crossSite.status,403);
  assert.equal((await call('/sign-out',{},cookie)).status,200);
  assert.equal(await (await call('/get-session',undefined,cookie)).json(),null);
  const [accounts]:any=await database().execute('SELECT password FROM auth_account WHERE userId=?',[userId]);
  assert.ok(accounts[0].password.length>32);
  assert.notEqual(accounts[0].password,password);
});

test('reset tokens are single-use and existing sessions are revoked after reset',async()=>{
  // Exercise the real endpoint limits; allow the library's login burst window to expire.
  await delay(11000);
  assert.ok(userId,'signup test must have completed');
  const login=await call('/sign-in/email',{email,password});
  const cookie=cookies(login);
  const reset=await call('/request-password-reset',{email,redirectTo:base+'/auth'});
  assert.equal(reset.status,200);
  const message=messages.findLast(m=>m.subject.startsWith('Reset'))!;
  assert.ok(message);
  const token=new URL(message.url).pathname.split('/').at(-1)!;
  const nextPassword='Local-Only-New-Password!-'+randomUUID();
  assert.equal((await call('/reset-password',{token,newPassword:nextPassword})).status,200);
  assert.equal((await call('/reset-password',{token,newPassword:nextPassword})).status,400);
  assert.equal(await (await call('/get-session',undefined,cookie)).json(),null);
  assert.equal((await call('/sign-in/email',{email,password})).status,401);
  assert.equal((await call('/sign-in/email',{email,password:nextPassword})).status,200);
});

