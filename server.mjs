import http from 'node:http';
import https from 'node:https';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from './public-config.js';

const folder = path.dirname(fileURLToPath(import.meta.url));
const agent = new https.Agent({keepAlive:true, maxSockets:32, maxFreeSockets:8, timeout:20000});
const rpcNames = new Set(['join_world','move_player','leave_world','game_action','request_job','submit_job']);
function permitted(p, method) {
  if (p === '/rest/v1/players') return method === 'GET';
  if (p.startsWith('/rest/v1/rpc/')) return method === 'POST' && rpcNames.has(p.slice('/rest/v1/rpc/'.length));
  return (method === 'POST' && ['/auth/v1/signup','/auth/v1/token','/auth/v1/logout','/auth/v1/recover','/auth/v1/verify'].includes(p)) ||
    (method === 'GET' && ['/auth/v1/user','/auth/v1/settings'].includes(p));
}
function json(res, code, body) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(body));
}
// HTTP/1.1 with certificate verification; never retry a mutation after a reset.
export function upstreamRequest(target, {method, headers, body, timeout=10000, ca}) {
  return new Promise((resolve,reject) => {
    const req = https.request(target, {method, headers, agent, ca, ALPNProtocols:['http/1.1']}, incoming => {
      const chunks=[]; let size=0;
      incoming.on('data', chunk => { size+=chunk.length; if(size>4*1024*1024) req.destroy(new Error('Response too large')); else chunks.push(chunk); });
      incoming.on('aborted',()=>req.destroy(new Error('Incomplete response')));
      incoming.on('error', reject);
      incoming.on('end',()=>resolve({status:incoming.statusCode, headers:incoming.headers, body:Buffer.concat(chunks)}));
    });
    const timer=setTimeout(()=>req.destroy(Object.assign(new Error('Upstream timeout'),{code:'ETIMEDOUT'})),timeout);
    req.on('error',reject);
    req.on('close',()=>clearTimeout(timer));
    req.end(body);
  });
}
export function createApp({upstream=config.url, publicKey=config.key, dist=path.join(folder,'dist'), request=upstreamRequest, timeout=10000}={}) {
  const origin=new URL(upstream);
  if(origin.protocol!=='https:' || origin.username || origin.password || origin.pathname!=='/') throw Error('SUPABASE_URL must be an HTTPS origin');
  if(!publicKey.startsWith('sb_publishable_')) throw Error('Use a public sb_publishable_ key, never a secret key');
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/healthz') return json(res,200,{ok:true,version:'3.0.0'});
      if(url.pathname==='/api/connection-check' && req.method==='GET') {
        const start=performance.now();
        try {
          const result=await request(new URL('/auth/v1/health',origin),{method:'GET',headers:{apikey:publicKey,'Accept-Encoding':'identity'},body:Buffer.alloc(0),timeout});
          return json(res,result.status===200?200:502,{ok:result.status===200,serverToDatabaseMs:Math.round(performance.now()-start),upstreamStatus:result.status,transport:'HTTP/1.1'});
        }catch {return json(res,502,{ok:false,serverToDatabaseMs:Math.round(performance.now()-start),transport:'HTTP/1.1'});}
      }
      if(url.pathname==='/runtime-config.js') {
        if(req.method!=='GET' && req.method!=='HEAD') return json(res,405,{message:'Method not allowed'});
        res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
        return res.end(req.method==='HEAD'?'':'window.DEV_DISTRICT_RUNTIME='+JSON.stringify({url:'/supabase',key:publicKey,version:'3.0.0'}).replace(/</g,'\\u003c')+';');
      }
      if(url.pathname.startsWith('/supabase/')) {
        const upstreamPath=url.pathname.slice('/supabase'.length);
        if(!permitted(upstreamPath,req.method)) return json(res,404,{message:'Endpoint not available'});
        // Credentials stay on this fixed origin; arbitrary proxy targets are impossible.
        if(req.headers.origin) {
          try { if(new URL(req.headers.origin).host!==req.headers.host) return json(res,403,{message:'Origin not allowed'}); }
          catch { return json(res,403,{message:'Origin not allowed'}); }
        }
        let size=0; const chunks=[];
        for await(const chunk of req) {size+=chunk.length; if(size>65536) return json(res,413,{message:'Request too large'}); chunks.push(chunk);}
        const body=Buffer.concat(chunks);
        const headers={apikey:publicKey,'Accept':'application/json','Accept-Encoding':'identity','Content-Type':'application/json','Content-Length':String(body.length)};
        for(const name of ['authorization','prefer','range','range-unit','x-supabase-api-version','x-client-info']) if(req.headers[name]) headers[name]=req.headers[name];
        const start=performance.now();
        try {
          const answer=await request(new URL(upstreamPath+url.search,origin),{method:req.method,headers,body,timeout});
          if(res.destroyed) return;
          const out={'Content-Type':answer.headers['content-type'] || 'application/json','Cache-Control':'no-store','Server-Timing':`upstream;dur=${Math.round(performance.now()-start)}`};
          for(const name of ['content-range','retry-after']) if(answer.headers[name]) out[name]=answer.headers[name];
          res.writeHead(answer.status,out); res.end(answer.body);
        } catch(error) {
          // No tokens, passwords, request bodies, or upstream URLs in logs.
          console.warn('upstream_failure',req.method,upstreamPath,error.code || 'CONNECTION_ERROR');
          json(res,error.code==='ETIMEDOUT'?504:502,{code:'UPSTREAM_UNAVAILABLE',message:'Сервер временно не получил ответ базы. Действие могло выполниться; обновите состояние перед повтором.'});
        }
        return;
      }
      if(req.method!=='GET' && req.method!=='HEAD') return json(res,405,{message:'Method not allowed'});
      const root=await realpath(dist);
      const name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const candidate=await realpath(path.resolve(root,name));
      if(!candidate.startsWith(root+path.sep) || !(await stat(candidate)).isFile()) return json(res,404,{message:'Not found'});
      const data=await readFile(candidate);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
      res.writeHead(200,{'Content-Type':types[path.extname(candidate)] || 'application/octet-stream','Content-Length':data.length,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'});
      res.end(req.method==='HEAD'?undefined:data);
    } catch(error) {json(res, error.code==='ENOENT'?404:400,{message:'Request unavailable'});}
  });
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3000);
  const server=createApp({upstream:process.env.SUPABASE_URL || config.url,publicKey:process.env.SUPABASE_PUBLIC_KEY || config.key});
  server.listen(port,'0.0.0.0',()=>console.log(`DevDistrict 3 ready on port ${port}`));
  const shutdown=()=>{server.close();setTimeout(()=>process.exit(0),10000).unref();};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
