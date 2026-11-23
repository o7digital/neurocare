import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../server.mjs';
import { createProviders,renderMail } from '../providers.mjs';

const environment=()=>({SITE_URL:'http://localhost:4321',GATEWAY_KEY:'gateway-key-'.repeat(4),AUTH_SECRET:'auth-secret-'.repeat(4),VAULT_KEY:'vault-secret-'.repeat(4),DB_PATH:':memory:'});
function fixtures(){let calls={chat:0,email:0,buffer:0};return {calls,health:async()=> '3.6.0',chat:async()=>{calls.chat++;return {answer:'Información del grupo. Usa el formulario para recibir seguimiento.',conversation_id:'a'.repeat(24)};},bufferChannels:async()=>({organization:{id:'org',name:'Neuro Diversa'},channels:[{id:'channel',name:'Neuro Diversa',service:'facebook'}]}),bufferPost:async()=>{calls.buffer++;return {id:'buffer-post'};},sendMail:async()=>{calls.email++;return {messageId:'message'};},unsubscribe:id=>`${id}.signed-test-token`};}
async function harness(custom={}){
 const env={...environment(),...custom},providers=fixtures(),app=await createApplication(env,{providers,disableWorker:true});
 async function request(path,{method='GET',body,cookie='',key=env.GATEWAY_KEY,origin=env.SITE_URL}={}){
  const response=await app.handle(new Request(env.SITE_URL+path,{method,headers:{'Content-Type':'application/json','x-neurodiversa-key':key,origin,cookie,'x-visitor-ip':'127.0.0.1'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}
  const cookies=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');return {status:response.status,data,cookie:cookies};
 }
 async function actor(role='owner',email=`${randomUUID()}@example.test`){const invitation=new URL(app.invite(email,role)).searchParams.get('invite');const accepted=await request('/api/invitations/accept',{method:'POST',body:{token:invitation,name:'Prueba del equipo',password:'A-private-test-password-921!'}});assert.equal(accepted.status,200,JSON.stringify(accepted.data));const login=await request('/api/auth/sign-in/email',{method:'POST',body:{email,password:'A-private-test-password-921!'}});assert.equal(login.status,200,JSON.stringify(login.data));assert.ok(login.cookie);return {cookie:login.cookie,invitation};}
 return {app,providers,env,request,actor};
}

test('private workspace rejects missing gateway, anonymous access, cross-origin writes and public signup',async t=>{
 const h=await harness();t.after(()=>h.app.close());
 assert.equal((await h.request('/api/admin/inbox',{key:'invalid'})).status,401);
 assert.equal((await h.request('/api/admin/inbox')).status,401);
 assert.equal((await h.request('/api/widget/session',{method:'POST',body:{},origin:'https://unrelated.example'})).status,403);
 assert.equal((await h.request('/api/auth/sign-up/email',{method:'POST',body:{email:'outsider@example.test',password:'irrelevant'}})).status,404);
 const a=await h.actor();assert.equal((await h.request('/api/admin/inbox',{cookie:a.cookie})).status,200);
 assert.equal((await h.request('/api/invitations/accept',{method:'POST',body:{token:a.invitation,name:'Replay',password:'A-private-test-password-921!'}})).status,400);
});

test('Olivia captures group lead directly, isolates visitor conversations and supports operator takeover',async t=>{
 const h=await harness();t.after(()=>h.app.close());const {cookie:admin}=await h.actor();
 const session=await h.request('/api/widget/session',{method:'POST',body:{}});assert.match(session.cookie,/nd_visitor=/);
 const message={message:'Quiero información del grupo',language:'es',consent:true,requestId:randomUUID(),page:'/programas/habilidades-sociales/'};
 assert.equal((await h.request('/api/widget/chat',{method:'POST',cookie:session.cookie,body:message})).status,200);
 await h.request('/api/widget/chat',{method:'POST',cookie:session.cookie,body:message});assert.equal(h.providers.calls.chat,1);
 const lead={firstName:'Paciente',lastName:'Prueba',email:'patient@example.test',phone:'+52 555 000 0000',interest:'group',message:'Información sobre horarios',consent:true,marketingConsent:false,page:'/programas/habilidades-sociales/'};
 assert.equal((await h.request('/api/widget/leads',{method:'POST',cookie:session.cookie,body:{...lead,consent:false}})).status,400);
 await h.request('/api/widget/leads',{method:'POST',cookie:session.cookie,body:lead});
 await h.request('/api/widget/leads',{method:'POST',cookie:session.cookie,body:lead});
 const inbox=await h.request('/api/admin/inbox',{cookie:admin});assert.equal(inbox.data.leads.length,1);assert.equal(inbox.data.leads[0].interest,'group');
 assert.equal((await h.request('/api/admin/contacts',{cookie:admin})).data.contacts.length,0);
 const visitor=inbox.data.leads[0].visitor_id;
 await h.request(`/api/admin/conversations/${visitor}`,{method:'POST',cookie:admin,body:{content:'Hola, el equipo te acompaña.'}});
 const response=await h.request('/api/widget/messages',{cookie:session.cookie});assert.equal(response.data.mode,'manual');assert.deepEqual(response.data.messages.map(m=>m.role),['visitor','assistant','operator']);
 await h.request('/api/widget/chat',{method:'POST',cookie:session.cookie,body:{...message,requestId:randomUUID(),message:'Gracias'}});assert.equal(h.providers.calls.chat,1);
 const other=await h.request('/api/widget/session',{method:'POST',body:{}});assert.deepEqual((await h.request('/api/widget/messages',{cookie:other.cookie})).data.messages,[]);
});

test('published content is shared; drafts are private; concurrent edits are rejected',async t=>{
 const h=await harness();t.after(()=>h.app.close());const {cookie}=await h.actor();
 const post={title:'Un artículo',author:'Cindy',category:'Psicología',body:'Contenido del equipo',language:'es',status:'draft'};
 const saved=await h.request('/api/admin/posts',{method:'POST',cookie,body:post});assert.equal(saved.status,200);
 assert.equal((await h.request('/api/public/content')).data.posts.length,0);
 assert.equal((await h.request('/api/admin/posts',{method:'POST',cookie,body:{...post,id:saved.data.id,version:1,status:'published'}})).status,200);
 assert.equal((await h.request('/api/public/content')).data.posts.length,1);
 assert.equal((await h.request('/api/public/content?language=en')).data.posts.length,0);
 assert.equal((await h.request('/api/admin/posts',{method:'POST',cookie,body:{...post,id:saved.data.id,version:1}})).status,409);
 await h.request('/api/admin/program',{method:'PUT',cookie,body:{title:'Grupo',start:'Enero 2027',weeks:16,minutes:90}});
 assert.equal((await h.request('/api/public/content')).data.program.weeks,16);
});

test('mailing requires opt-in, respects unsubscribe, queues persistently and never repeats a dispatch',async t=>{
 const h=await harness();t.after(()=>h.app.close());const {cookie}=await h.actor();
 await h.request('/api/admin/connections',{method:'PATCH',cookie,body:{smtp:{host:'smtp.example.test',port:587,username:'test',password:'private-smtp-password',fromEmail:'team@example.test',fromName:'Neuro Diversa'}}});
 const config=(await h.request('/api/admin/workspace',{cookie})).data.connections;assert.equal(config.smtp.password,undefined);assert.equal(config.smtp.configured,true);assert.ok(!h.app.store.db.prepare('SELECT value FROM settings').all()[0].value.includes('private-smtp-password'));
 assert.equal((await h.request('/api/admin/contacts',{method:'POST',cookie,body:{email:'consent@example.test',firstName:'Prueba',consent:false,consentSource:'Formulario de prueba'}})).status,400);
 await h.request('/api/admin/contacts',{method:'POST',cookie,body:{email:'consent@example.test',firstName:'Prueba',consent:true,consentSource:'Formulario de prueba, 23 noviembre'}});
 const contact=(await h.request('/api/admin/contacts',{cookie})).data.contacts[0];
 const campaign={kind:'email',subject:'Newsletter',body:'Hola {{firstName}}'};
 const saved=(await h.request('/api/admin/campaigns',{method:'POST',cookie,body:campaign})).data;
 const dispatch=()=>h.request(`/api/admin/campaigns/${saved.id}/send`,{method:'POST',cookie,body:{version:1,confirmed:true,recipientIds:[contact.id]}});
 assert.equal((await dispatch()).data.results[0].status,'queued');assert.equal(h.providers.calls.email,0);
 await h.app.processJobs();assert.equal(h.providers.calls.email,1);assert.equal((await dispatch()).data.results[0].status,'already_recorded');await h.app.processJobs();assert.equal(h.providers.calls.email,1);
 await h.request('/api/admin/campaigns',{method:'POST',cookie,body:{...campaign,id:saved.id,version:1}});assert.equal((await h.request('/api/admin/workspace',{cookie})).data.campaigns[0].version,1);
 const token=h.providers.unsubscribe(contact.id);
 await h.request(`/api/unsubscribe?token=${token}`,{method:'POST'});
 const next=(await h.request('/api/admin/campaigns',{method:'POST',cookie,body:{...campaign,subject:'Otra campaña'}})).data;
 assert.equal((await h.request(`/api/admin/campaigns/${next.id}/send`,{method:'POST',cookie,body:{version:1,confirmed:true,recipientIds:[contact.id]}})).status,400);
 assert.ok(!JSON.stringify((await h.request('/api/admin/workspace',{cookie})).data).includes('private-smtp-password'));
});

test('editor cannot change provider credentials or invite accounts',async t=>{
 const h=await harness();t.after(()=>h.app.close());const {cookie}=await h.actor('editor');
 assert.equal((await h.request('/api/admin/connections',{method:'PATCH',cookie,body:{buffer:{apiKey:'not-allowed',organizationId:'org'}}})).status,403);
 assert.equal((await h.request('/api/admin/invitations',{method:'POST',cookie,body:{email:'other@example.test'}})).status,403);
});

test('database survives restart; queued writes retain their snapshot and provider connection',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'neurodiversa-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const env={...environment(),DB_PATH:join(dir,'private.sqlite')};let h=await harness(env);const {cookie}=await h.actor();
 await h.request('/api/admin/connections',{method:'PATCH',cookie,body:{buffer:{apiKey:'private-buffer-key',organizationId:'org'}}});
 const saved=(await h.request('/api/admin/campaigns',{method:'POST',cookie,body:{kind:'social',subject:'Publicación',body:'Texto',channelIds:['channel'],mode:'draft'}})).data;
 await h.request(`/api/admin/campaigns/${saved.id}/buffer`,{method:'POST',cookie,body:{version:1,confirmed:true}});h.app.close();
 h=await harness(env);t.after(()=>h.app.close());assert.equal((await h.request('/api/admin/workspace',{cookie})).data.campaigns.length,1);await h.app.processJobs();assert.equal(h.providers.calls.buffer,1);
});

test('provider adapter fixes tenant identity, verifies Olivia 3.6 and uses Buffer scheduling contract',async()=>{
 const calls=[];const env={VAULT_KEY:'vault',OLIVIA_API_URL:'http://core',OLIVIA_EMAIL:'service',OLIVIA_PASSWORD:'private'};
 const fake=async(url,options={})=>{calls.push({url,...options});if(url.endsWith('/health'))return Response.json({version:'3.6.0'});if(url.endsWith('/login'))return Response.json({access_token:'service-token'});if(url.endsWith('/chat'))return Response.json({answer:'Respuesta',conversation_id:'a'.repeat(24)});return Response.json({data:{createPost:{post:{id:'post'}}}});};
 const provider=createProviders(env,fake);await provider.chat('Hola');assert.equal(calls.at(-1).headers['X-Tenant-ID'],'neurodiversa');
 await provider.bufferPost({apiKey:'private'},{id:'channel',service:'facebook'},{body:'Texto',mode:'scheduled',dueAt:new Date(Date.now()+3600000).toISOString()});
 const query=JSON.parse(calls.at(-1).body).query;assert.match(query,/mode:customScheduled/);assert.match(query,/saveToDraft:false/);
 const bad=createProviders(env,async()=>Response.json({version:'3.5.0'}));await assert.rejects(()=>bad.chat('Hola'));
 const html=renderMail({subject:'Subject',body:'Hola {{firstName}} <script>bad</script>'},{first_name:'<img onerror=bad>'}).html;assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);
});
