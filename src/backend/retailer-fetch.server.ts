import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

const DEFAULT_HOSTS=['amazon.in','amazon.com','amazon.co.uk','amazon.ca','amazon.de','amazon.fr','amazon.it','amazon.es','amazon.com.au','amazon.co.jp','amazon.ae','amazon.sa','amazon.com.br','amazon.com.mx','amazon.sg','flipkart.com','amzn.to','amzn.eu','amzn.asia'];

export function publicAddress(value:string){
  if(!isIP(value))return false;
  let address=ipaddr.parse(value);
  if(address.kind()==='ipv6'&&(address as ipaddr.IPv6).isIPv4MappedAddress())address=(address as ipaddr.IPv6).toIPv4Address();
  return address.range()==='unicast';
}

export function retailerUrl(input:string,hosts:readonly string[]=DEFAULT_HOSTS){
  const url=new URL(input);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Retailer links must use HTTPS without credentials or custom ports');
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(isIP(host.replace(/^\[|\]$/g,''))||!hosts.some(allowed=>host===allowed||host.endsWith('.'+allowed)))throw new Error('Retailer host is not approved');
  url.hostname=host;
  return url;
}

export interface FetchOptions{
  signal?:AbortSignal;
  headers?:HeadersInit;
  hosts?:readonly string[];
  maxBytes?:number;
  timeoutMs?:number;
  resolve?:(host:string)=>Promise<Array<{address:string;family:number}>>;
}

/** GET-only, bounded, DNS-pinned HTTPS. Revalidates every redirect before opening a socket. */
export async function fetchRetailer(input:string,options:FetchOptions={}):Promise<Response>{
  const hosts=options.hosts??(process.env.RETAILER_HOST_ALLOWLIST?.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)??DEFAULT_HOSTS);
  const maxBytes=options.maxBytes??8*1024*1024;
  const timeoutMs=options.timeoutMs??15000;
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16*1024*1024||timeoutMs<1||timeoutMs>30000)throw new Error('Invalid outbound fetch limits');
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
  let current=input;
  for(let redirects=0;redirects<=4;redirects++){
    if(signal.aborted)throw new Error('Retailer fetch timed out or was cancelled');
    const url=retailerUrl(current,hosts);
    const resolve=options.resolve??((host:string)=>lookup(host,{all:true,verbatim:true}));
    const addresses=await Promise.race([
      resolve(url.hostname),
      new Promise<never>((_,reject)=>{signal.addEventListener('abort',()=>reject(new Error('Retailer DNS lookup timed out')),{once:true});}),
    ]);
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)||![4,6].includes(a.family)))throw new Error('Retailer DNS resolved to a non-public address');
    const selected=addresses[0];
    const headers=new Headers(options.headers);
    for(const name of ['authorization','cookie','host','proxy-authorization','connection','transfer-encoding','content-length'])headers.delete(name);
    headers.set('accept-encoding','identity');
    const response=await new Promise<{status:number;headers:Headers;body:Buffer}>((resolve,reject)=>{
      const req=request(url,{
        method:'GET',signal,headers:Object.fromEntries(headers),servername:url.hostname,
        // Keep TLS validation against the original hostname while using only the checked IP.
        lookup:(_hostname,_options,callback)=>callback(null,selected.address,selected.family),
      },res=>{
        const responseHeaders=new Headers();
        for(const [name,value]of Object.entries(res.headers))if(value!==undefined)responseHeaders.set(name,Array.isArray(value)?value.join(', '):value);
        if(Number(responseHeaders.get('content-length'))>maxBytes){res.destroy();reject(new Error('Retailer response exceeds size limit'));return;}
        const chunks:Buffer[]=[];let size=0;
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){res.destroy(new Error('Retailer response exceeds size limit'));}else chunks.push(chunk);});
        res.on('error',reject);
        res.on('end',()=>resolve({status:res.statusCode??502,headers:responseHeaders,body:Buffer.concat(chunks)}));
      });
      req.on('error',reject);req.end();
    });
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('location');if(!location)throw new Error('Retailer redirect has no destination');
      current=new URL(location,url).href;continue;
    }
    const result=new Response(Uint8Array.from(response.body),{status:response.status,headers:response.headers});
    Object.defineProperty(result,'url',{value:url.href});
    return result;
  }
  throw new Error('Too many retailer redirects');
}
