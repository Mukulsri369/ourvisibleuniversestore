import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicAddress,retailerUrl,fetchRetailer } from '../src/backend/retailer-fetch.server';

test('rejects local, private, reserved, metadata, multicast and mapped IPv4/IPv6 destinations',()=>{
  for(const address of ['127.0.0.1','0.0.0.0','10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','224.0.0.1','::1','::','fe80::1','fc00::1','ff02::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});

test('allowlist matching respects domain boundaries, credentials, ports and HTTPS',()=>{
  for(const url of ['http://amazon.in/','https://amazon.in.evil.example/','https://evilamazon.in/','https://amazon.in@localhost/','https://user:password@amazon.in/','https://amazon.in:444/','https://127.1/','file:///etc/passwd','https://[::1]/','https://localhost/'])assert.throws(()=>retailerUrl(url));
  assert.equal(retailerUrl('https://www.amazon.in/dp/example?tag=unchanged').search,'?tag=unchanged');
  assert.equal(retailerUrl('https://www.flipkart.com/').hostname,'www.flipkart.com');
});

test('mixed public/private DNS and shortener rebinding are rejected before any request',async()=>{
  for(const host of ['https://www.amazon.in/','https://amzn.to/test']){
    await assert.rejects(fetchRetailer(host,{resolve:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]}),/non-public/);
  }
});

test('aborted requests, unbounded options and invalid protocol fail closed',async()=>{
  await assert.rejects(fetchRetailer('https://amazon.in/',{signal:AbortSignal.abort()}),/cancelled/);
  await assert.rejects(fetchRetailer('https://amazon.in/',{maxBytes:100*1024*1024}),/limits/);
  await assert.rejects(fetchRetailer('file:///etc/passwd'),/HTTPS/);
});
