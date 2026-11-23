import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bridge from '../api/backend.mjs';
import { createApplication } from '../backend/server.mjs';

test('Vercel bridge forwards same-origin widget cookies and preserves backend authentication boundaries',async t=>{
 const key='bridge-secret-'.repeat(4);
 const app=await createApplication({SITE_URL:'https://neurodiversa.mx',GATEWAY_KEY:key,AUTH_SECRET:'auth-key-'.repeat(6),VAULT_KEY:'vault-key-'.repeat(6),DB_PATH:':memory:'},{providers:{health:async()=> '3.6.0'},disableWorker:true});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 process.env.NEURODIVERSA_BACKEND_URL=`http://127.0.0.1:${app.server.address().port}`;
 process.env.NEURODIVERSA_GATEWAY_KEY=key;
 const server=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);req.body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):undefined;await bridge(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.closeAllConnections();server.close();app.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 let response=await fetch(base+'/api/backend?route=widget/session',{method:'POST',headers:{Origin:'https://neurodiversa.mx','Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);
 response=await fetch(base+'/api/widget/messages',{headers:{Cookie:cookie.split(';')[0]}});assert.equal(response.status,200);assert.deepEqual((await response.json()).messages,[]);
 response=await fetch(base+'/api/admin/inbox');assert.equal(response.status,401);
 response=await fetch(base+'/api/backend?route=widget/session',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 response=await fetch(base+'/api/backend?route=..%2Fhealth');assert.equal(response.status,404);
 response=await fetch(base+'/api/widget/status');const body=await response.text();assert.equal(response.status,200);assert.ok(!body.includes(key));assert.match(response.headers.get('cache-control'),/no-store/);
});
