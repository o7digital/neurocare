import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { z } from 'zod';
import { openStore, hash } from './store.mjs';
import { createProviders, ServiceError, renderMail, escapeHtml, publicUrl } from './providers.mjs';

const now = () => new Date().toISOString();
const same = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const text = (min=1,max=200) => z.string().trim().min(min).max(max);
const interest = z.enum(['group','psychology','psychiatry','general']);
const postSchema = z.object({id:z.string().uuid().optional(),version:z.number().int().positive().optional(),title:text(1,150),author:text(1,150),category:text(1,100),body:text(1,30000),language:z.enum(['es','en']),status:z.enum(['draft','published'])});
const campaignSchema = z.object({id:z.string().uuid().optional(),version:z.number().int().positive().optional(),kind:z.enum(['email','social']),subject:text(1,180),body:text(1,15000),headline:text(0,200).default(''),preheader:text(0,200).default(''),heroImage:text(0,2000).default(''),cta:text(0,100).default(''),ctaUrl:text(0,2000).default(''),mediaUrl:text(0,2000).default(''),channelIds:z.array(text(1,200)).max(20).default([]),mode:z.enum(['draft','queue','scheduled']).default('draft'),dueAt:z.string().max(50).default('')});

export async function createApplication(env=process.env, dependencies={}) {
  const site = env.SITE_URL || 'https://neurodiversa.mx';
  if (!env.GATEWAY_KEY || env.GATEWAY_KEY.length<32 || !env.AUTH_SECRET || env.AUTH_SECRET.length<32) throw new Error('Private gateway and auth keys required');
  const store = openStore(env.DB_PATH || '/data/neurodiversa.sqlite',env.VAULT_KEY), {db} = store;
  const providers = dependencies.providers || createProviders(env);
  const activeChats = new Set();
  const auth = betterAuth({
    database:db,secret:env.AUTH_SECRET,baseURL:site,basePath:'/api/auth',trustedOrigins:[site],
    emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128},
    session:{expiresIn:28800,updateAge:3600},
    advanced:{useSecureCookies:site.startsWith('https:'),cookiePrefix:'neurodiversa',defaultCookieAttributes:{sameSite:'strict',httpOnly:true,secure:site.startsWith('https:')}},
    rateLimit:{enabled:true,storage:'database',window:60,max:15},
    logger:{level:'error'},
  });
  await (await getMigrations(auth.options)).runMigrations();
  const admin = async request => {
    const session = await auth.api.getSession({headers:request.headers});
    if (!session) throw new ServiceError(401,'Inicia sesión para abrir este espacio.');
    const member = db.prepare('SELECT role FROM members WHERE user_id=?').get(session.user.id);
    if (!member) throw new ServiceError(403,'Este acceso no pertenece a Neuro Diversa.');
    return {...session.user,role:member.role};
  };
  const visitor = request => {
    const token = request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('nd_visitor='))?.slice(11);
    const row = token && db.prepare('SELECT * FROM visitors WHERE token_hash=? AND expires>?').get(hash(token),Date.now());
    if (!row) throw new ServiceError(401,'Vuelve a abrir el chat.');
    return row;
  };
  const addMessage = (id,role,content,requestId=null) => {
    const message={id:randomUUID(),visitor_id:id,role,content,created:now()};
    db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run(message.id,id,role,content,message.created,requestId);
    return message;
  };
  const loadCampaign = id => {
    const row = db.prepare('SELECT * FROM campaigns WHERE id=?').get(id);
    if (!row) throw new ServiceError(404,'Campaña no encontrada.');
    return {...JSON.parse(row.data),id:row.id,version:row.version,updated:row.updated};
  };
  const saveVersioned = (table,data,extra=[]) => {
    const id = data.id || randomUUID();
    const existing = db.prepare(`SELECT version,data FROM ${table} WHERE id=?`).get(id);
    if (existing && existing.version!==data.version) throw new ServiceError(409,'El contenido cambió. Recarga antes de guardarlo.');
    const {id:unusedId,version:unusedVersion,...document}=data;
    if(existing && existing.data===JSON.stringify(document)) return id;
    if (table==='posts') db.prepare('INSERT INTO posts VALUES (?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status=excluded.status,language=excluded.language,version=posts.version+1,updated=excluded.updated').run(id,JSON.stringify(document),...extra,now());
    else db.prepare('INSERT INTO campaigns VALUES (?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,data=excluded.data,version=campaigns.version+1,updated=excluded.updated').run(id,data.kind,JSON.stringify(document),now());
    return id;
  };
  const publicContent = language => ({
    posts:db.prepare('SELECT * FROM posts WHERE status=? AND language=? ORDER BY updated DESC').all('published',language==='en'?'en':'es').map(p=>({...JSON.parse(p.data),id:p.id,updated:p.updated})),
    program:store.get('program',null),
  });
  function invite(email,role='editor') {
    const token=randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO invitations VALUES (?,?,?,?,0)').run(hash(token),z.email().parse(email.trim().toLowerCase()),role,Date.now()+7*86400000);
    return `${site}/admin/?invite=${token}`;
  }
  // Persistent outbox. A process interruption leaves an unconfirmed delivery for review;
  // provider writes are never retried automatically, which prevents duplicate messages/posts.
  if (!dependencies.disableWorker) db.prepare("UPDATE deliveries SET status='unconfirmed' WHERE status='running'").run();
  let working=false;
  async function processJobs() {
    if(working)return;working=true;
    try {
      const jobs=db.prepare("SELECT * FROM deliveries WHERE status='queued' ORDER BY created LIMIT 5").all();
      await Promise.all(jobs.map(async job=>{
        if(!db.prepare("UPDATE deliveries SET status='running' WHERE id=? AND status='queued'").run(job.id).changes)return;
        try {
          const payload=JSON.parse(job.payload),connections=store.get('connections',{});
          const config=job.provider==='buffer'?connections.buffer:connections.smtp;
          if(hash(JSON.stringify(config))!==payload.connectionHash)throw new Error('Connection changed');
          let remote;
          if(job.provider==='buffer') remote=await providers.bufferPost(config,payload.target,payload.campaign);
          else {
            if(job.provider==='smtp') {
              const current=db.prepare('SELECT * FROM contacts WHERE id=? AND opted_in=1 AND opted_out=0').get(payload.target.id);
              if(!current){db.prepare("UPDATE deliveries SET status='excluded' WHERE id=?").run(job.id);return;}
            }
            remote=await providers.sendMail(config,payload.campaign,payload.target,job.provider==='smtp'?`${site}/api/unsubscribe?token=${providers.unsubscribe(payload.target.id)}`:'');
          }
          db.prepare("UPDATE deliveries SET status='accepted',remote_id=?,payload='{}' WHERE id=?").run(remote.messageId || remote.id || '',job.id);
        } catch {db.prepare("UPDATE deliveries SET status='unconfirmed' WHERE id=?").run(job.id);}
      }));
    } finally {working=false;}
  }
  const jobTimer=dependencies.disableWorker ? null : setInterval(()=>{processJobs().catch(()=>{});},2000).unref();
  const json = (data,status=200,headers={}) => Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
  async function handle(request) {
    const url = new URL(request.url), path=url.pathname.replace(/\/$/,'');
    if (path==='/health') {
      try {return json({status:'ok',tenant:'neurodiversa',version:await providers.health()});}
      catch {return json({status:'degraded',tenant:'neurodiversa'},503);}
    }
    if (!same(request.headers.get('x-neurodiversa-key'),env.GATEWAY_KEY)) return json({error:'Unauthorized'},401);
    try {
      if (!['GET','HEAD'].includes(request.method)) {
        const origin=request.headers.get('origin');
        // The same-origin Vercel bridge validates the browser origin before normalizing it.
        if (origin && origin!==site) throw new ServiceError(403,'Origen no permitido.');
      }
      const ip=request.headers.get('x-visitor-ip') || 'unknown';
      if (!store.limit(`api:${ip}`,180)) throw new ServiceError(429,'Demasiadas solicitudes. Intenta en un minuto.');
      if (path.startsWith('/api/auth/')) {
        const allowed={'/api/auth/sign-in/email':'POST','/api/auth/sign-out':'POST','/api/auth/get-session':'GET','/api/auth/ok':'GET'};
        if (allowed[path]!==request.method) throw new ServiceError(404,'Ruta no disponible.');
        return auth.handler(request);
      }
      const body = async () => { try { return await request.json(); } catch {throw new ServiceError(400,'Solicitud inválida.');} };
      if (path==='/api/invitations/accept' && request.method==='POST') {
        if (!store.limit(`invite:${ip}`,8)) throw new ServiceError(429,'Intenta de nuevo más tarde.');
        const data=z.object({token:text(40,100),name:text(2,140),password:z.string().min(12).max(128)}).parse(await body());
        const invitation=db.prepare('SELECT * FROM invitations WHERE token_hash=? AND used=0 AND expires>?').get(hash(data.token),Date.now());
        if (!invitation) throw new ServiceError(400,'La invitación ha caducado o ya fue utilizada.');
        if (!db.prepare('UPDATE invitations SET used=1 WHERE token_hash=? AND used=0').run(hash(data.token)).changes) throw new ServiceError(409,'Esta invitación ya fue utilizada.');
        try {
          const result=await auth.api.signUpEmail({body:{email:invitation.email,password:data.password,name:data.name}});
          db.prepare('INSERT INTO members VALUES (?,?)').run(result.user.id,invitation.role);
          store.audit(result.user.id,'invitation.accept',invitation.email);
          return json({ok:true,email:invitation.email});
        } catch(error) {db.prepare('UPDATE invitations SET used=0 WHERE token_hash=?').run(hash(data.token)); throw error;}
      }
      if (path==='/api/public/content' && request.method==='GET') return json(publicContent(url.searchParams.get('language')));
      if (path==='/api/unsubscribe') {
        const token=url.searchParams.get('token') || '', id=token.split('.')[0];
        if (!id || !same(token,providers.unsubscribe(id))) throw new ServiceError(400,'Enlace inválido.');
        if (request.method==='POST') {db.prepare('UPDATE contacts SET opted_out=1 WHERE id=?').run(id);return new Response('Tu suscripción ha sido cancelada.',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
        return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancelar suscripción · Neuro Diversa</title><body style="font:18px Arial;padding:40px;max-width:600px;margin:auto"><h1>Neuro Diversa</h1><p>¿Quieres dejar de recibir nuestros boletines?</p><form method="post"><button style="font:inherit;padding:14px">Cancelar mi suscripción</button></form></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      }
      if (path==='/api/widget/session' && request.method==='POST') {
        let row;try {row=visitor(request);} catch {}
        if (row) return json({ok:true});
        if (!store.limit(`visitors:${ip}`,15,3600)) throw new ServiceError(429,'Intenta de nuevo más tarde.');
        const token=randomBytes(32).toString('base64url');
        db.prepare('INSERT INTO visitors(id,token_hash,expires) VALUES (?,?,?)').run(randomUUID(),hash(token),Date.now()+12*3600000);
        return json({ok:true},200,{'Set-Cookie':`nd_visitor=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${site.startsWith('https:')?'; Secure':''}`});
      }
      if (path==='/api/widget/status' && request.method==='GET') {
        try {return json({available:true,version:await providers.health()});} catch {return json({available:false});}
      }
      if (path.startsWith('/api/widget/')) {
        const v=visitor(request);
        if (path==='/api/widget/messages' && request.method==='GET') return json({mode:v.mode,messages:db.prepare('SELECT id,role,content,created FROM messages WHERE visitor_id=? ORDER BY rowid').all(v.id),lead:!!db.prepare('SELECT id FROM leads WHERE visitor_id=?').get(v.id)});
        if (path==='/api/widget/chat' && request.method==='POST') {
          const data=z.object({message:text(1,2500),language:z.enum(['es','en']),consent:z.literal(true),requestId:z.string().uuid(),page:text(0,1000).default('')}).parse(await body());
          if (!store.limit(`chat:${v.id}`,12)) throw new ServiceError(429,'Espera un momento antes de enviar otro mensaje.');
          const duplicate=db.prepare('SELECT id FROM messages WHERE request_id=?').get(data.requestId);
          if (duplicate) return json({ok:true,duplicate:true});
          if (activeChats.has(v.id)) throw new ServiceError(429,'Olivia está preparando una respuesta. Espera un momento.');
          if (db.prepare('SELECT count(*) AS total FROM messages WHERE visitor_id=?').get(v.id).total>=500) throw new ServiceError(429,'Esta conversación alcanzó su límite. Contacta al equipo por los medios publicados en el sitio.');
          db.prepare('UPDATE visitors SET language=?,page=?,consent_at=COALESCE(consent_at,?) WHERE id=?').run(data.language,data.page,now(),v.id);
          addMessage(v.id,'visitor',data.message,data.requestId);
          if (v.mode!=='ai') return json({ok:true,mode:v.mode});
          activeChats.add(v.id);
          let result;
          try {result=await providers.chat(data.message,v.core_id);}
          finally {activeChats.delete(v.id);}
          // An operator can take over while a model request is in flight.
          if (db.prepare('SELECT mode FROM visitors WHERE id=?').get(v.id).mode==='ai') addMessage(v.id,'assistant',result.answer);
          db.prepare('UPDATE visitors SET core_id=? WHERE id=?').run(result.conversation_id,v.id);
          return json({ok:true,version:'3.6.0'});
        }
        if (path==='/api/widget/leads' && request.method==='POST') {
          const data=z.object({firstName:text(1,100),lastName:text(1,100),email:z.email().max(240),phone:text(6,40).regex(/^[+\d\s().-]+$/),interest,message:text(1,3000),consent:z.literal(true),marketingConsent:z.boolean().default(false),language:z.enum(['es','en']).default('es'),page:text(0,1000).default('')}).parse(await body());
          if (!store.limit(`lead:${v.id}`,5,3600)) throw new ServiceError(429,'Tu solicitud ya está registrada.');
          const email=data.email.toLowerCase(),stamp=now();
          const previous=db.prepare('SELECT id FROM leads WHERE visitor_id=?').get(v.id);
          const id=previous?.id || randomUUID();
          db.transaction(()=>{
            db.prepare('INSERT INTO leads(id,visitor_id,first_name,last_name,email,phone,interest,message,consent_at,marketing_consent,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,interest=excluded.interest,message=excluded.message,marketing_consent=excluded.marketing_consent,updated=excluded.updated').run(id,v.id,data.firstName,data.lastName,email,data.phone,data.interest,data.message,stamp,Number(data.marketingConsent),stamp,stamp);
            db.prepare('UPDATE visitors SET language=?,page=?,consent_at=COALESCE(consent_at,?) WHERE id=?').run(data.language,data.page,stamp,v.id);
            if (data.marketingConsent) db.prepare('INSERT INTO contacts VALUES (?,?,?,?,?,1,0,?) ON CONFLICT(email) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,consent_source=excluded.consent_source,opted_in=1').run(randomUUID(),email,data.firstName,data.lastName,`Formulario Olivia · ${stamp}`,stamp);
            store.audit('visitor','lead.capture',id);
          })();
          return json({ok:true,id});
        }
        throw new ServiceError(404,'Ruta no disponible.');
      }
      if (!path.startsWith('/api/admin/')) throw new ServiceError(404,'Ruta no disponible.');
      const user=await admin(request);
      if (path==='/api/admin/workspace' && request.method==='GET') {
        const settings=store.get('connections',{});
        return json({user:{name:user.name,email:user.email,role:user.role},
          posts:db.prepare('SELECT * FROM posts ORDER BY updated DESC').all().map(p=>({...JSON.parse(p.data),id:p.id,version:p.version,updated:p.updated})),
          campaigns:db.prepare('SELECT id FROM campaigns ORDER BY updated DESC').all().map(c=>loadCampaign(c.id)),
          program:store.get('program',null),
          connections:{buffer:{configured:!!settings.buffer?.apiKey,organizationId:settings.buffer?.organizationId || ''},smtp:{configured:!!settings.smtp?.password,...Object.fromEntries(Object.entries(settings.smtp||{}).filter(([key])=>key!=='password'))}},
          deliveries:db.prepare('SELECT id,campaign_id,version,target,provider,status,remote_id,created FROM deliveries ORDER BY created DESC LIMIT 100').all(),
        });
      }
      if (path==='/api/admin/inbox' && request.method==='GET') {
        const leads=db.prepare('SELECT leads.*,visitors.mode,visitors.language,visitors.page FROM leads JOIN visitors ON visitors.id=leads.visitor_id ORDER BY leads.updated DESC LIMIT 500').all();
        const conversations=db.prepare("SELECT visitors.id,visitors.mode,visitors.language,visitors.page,(SELECT content FROM messages WHERE visitor_id=visitors.id ORDER BY rowid DESC LIMIT 1) AS last_message,(SELECT created FROM messages WHERE visitor_id=visitors.id ORDER BY rowid DESC LIMIT 1) AS updated FROM visitors WHERE EXISTS(SELECT 1 FROM messages WHERE visitor_id=visitors.id) ORDER BY updated DESC LIMIT 500").all();
        return json({leads,conversations});
      }
      const conversation=path.match(/^\/api\/admin\/conversations\/([a-f0-9-]+)$/);
      if (conversation) {
        if (!db.prepare('SELECT id FROM visitors WHERE id=?').get(conversation[1])) throw new ServiceError(404,'Conversación no encontrada.');
        if (request.method==='GET') return json({messages:db.prepare('SELECT id,role,content,created FROM messages WHERE visitor_id=? ORDER BY rowid').all(conversation[1])});
        if (request.method==='POST') {
          const data=z.object({content:text(1,4000)}).parse(await body());
          db.transaction(()=>{db.prepare("UPDATE visitors SET mode='manual' WHERE id=?").run(conversation[1]);addMessage(conversation[1],'operator',data.content);store.audit(user.id,'conversation.reply',conversation[1]);})();
          return json({ok:true});
        }
        if (request.method==='PATCH') {
          const data=z.object({mode:z.enum(['ai','manual','closed'])}).parse(await body());
          db.prepare('UPDATE visitors SET mode=? WHERE id=?').run(data.mode,conversation[1]);store.audit(user.id,'conversation.mode',conversation[1]);return json({ok:true});
        }
      }
      const leadMatch=path.match(/^\/api\/admin\/leads\/([a-f0-9-]+)$/);
      if (leadMatch && request.method==='PATCH') {
        const data=z.object({status:z.enum(['new','contacted','enrolled','closed']),note:text(0,4000)}).parse(await body());
        if (!db.prepare('UPDATE leads SET status=?,note=?,updated=? WHERE id=?').run(data.status,data.note,now(),leadMatch[1]).changes) throw new ServiceError(404,'Solicitud no encontrada.');
        store.audit(user.id,'lead.update',leadMatch[1]);return json({ok:true});
      }
      if (path==='/api/admin/posts' && request.method==='POST') {
        const data=postSchema.parse(await body()),id=saveVersioned('posts',data,[data.status,data.language]);
        store.audit(user.id,'post.save',id);return json({ok:true,id});
      }
      const postMatch=path.match(/^\/api\/admin\/posts\/([a-f0-9-]+)$/);
      if (postMatch && request.method==='DELETE') {db.prepare('DELETE FROM posts WHERE id=?').run(postMatch[1]);store.audit(user.id,'post.delete',postMatch[1]);return json({ok:true});}
      if (path==='/api/admin/program' && request.method==='PUT') {
        const data=z.object({title:text(1,150),start:text(1,100),weeks:z.number().int().min(1).max(52),minutes:z.number().int().min(15).max(240)}).parse(await body());
        store.set('program',data);store.audit(user.id,'program.update','group');return json({ok:true});
      }
      if (path==='/api/admin/campaigns' && request.method==='POST') {
        const data=campaignSchema.parse(await body());
        for (const key of ['heroImage','mediaUrl','ctaUrl']) if(data[key]) publicUrl(data[key]);
        const id=saveVersioned('campaigns',data);store.audit(user.id,'campaign.save',id);return json({ok:true,id});
      }
      if (path==='/api/admin/contacts' && request.method==='GET') return json({contacts:db.prepare('SELECT * FROM contacts ORDER BY created DESC LIMIT 1000').all()});
      if (path==='/api/admin/deliveries' && request.method==='GET') return json({deliveries:db.prepare('SELECT id,campaign_id,version,target,provider,status,remote_id,created FROM deliveries ORDER BY created DESC LIMIT 100').all()});
      if (path==='/api/admin/contacts' && request.method==='POST') {
        const data=z.object({email:z.email(),firstName:text(1,100),lastName:text(0,100).default(''),consentSource:text(5,500),consent:z.literal(true)}).parse(await body());
        const email=data.email.toLowerCase();
        // An existing unsubscribe is preserved until a new subscriber-controlled opt-in is implemented.
        db.prepare('INSERT INTO contacts VALUES (?,?,?,?,?,1,0,?) ON CONFLICT(email) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,consent_source=excluded.consent_source,opted_in=1').run(randomUUID(),email,data.firstName,data.lastName,data.consentSource,now());
        store.audit(user.id,'contact.add',hash(email));return json({ok:true});
      }
      if (path==='/api/admin/connections' && request.method==='PATCH') {
        if (user.role!=='owner') throw new ServiceError(403,'Solo la administración puede cambiar las conexiones.');
        const data=z.object({buffer:z.object({apiKey:z.string().max(2000).optional(),organizationId:text(0,180)}).optional(),smtp:z.object({host:text(1,253).regex(/^[a-z0-9.-]+$/i),port:z.union([z.literal(465),z.literal(587)]),username:text(1,240),password:z.string().max(2000).optional(),fromEmail:z.email(),fromName:text(1,140)}).optional()}).parse(await body());
        const current=store.get('connections',{});
        for(const key of ['buffer','smtp']) if (data[key]) {const secret=key==='buffer'?'apiKey':'password';const next={...current[key],...data[key]};if (!data[key][secret]) next[secret]=current[key]?.[secret] || '';current[key]=next;}
        store.set('connections',current);store.audit(user.id,'connections.update','workspace');return json({ok:true});
      }
      if (path==='/api/admin/buffer/channels' && request.method==='GET') return json(await providers.bufferChannels(store.get('connections',{}).buffer));
      if (path==='/api/admin/invitations' && request.method==='POST') {
        if(user.role!=='owner') throw new ServiceError(403,'Solo la administración puede invitar.');
        const data=z.object({email:z.email(),role:z.enum(['owner','editor']).default('editor')}).parse(await body());
        const link=invite(data.email,data.role);store.audit(user.id,'invitation.create',data.email);return json({link});
      }
      const campaignMatch=path.match(/^\/api\/admin\/campaigns\/([a-f0-9-]+)\/(preview|send|buffer)$/);
      if (campaignMatch) {
        const campaign=loadCampaign(campaignMatch[1]),action=campaignMatch[2];
        if (action==='preview' && request.method==='GET') return new Response(renderMail(campaign).html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}});
        if(request.method!=='POST') throw new ServiceError(405,'Método no permitido.');
        const data=z.object({version:z.number().int(),testEmail:z.email().optional(),recipientIds:z.array(z.string().uuid()).max(100).optional(),confirmed:z.literal(true)}).parse(await body());
        if(data.version!==campaign.version) throw new ServiceError(409,'Recarga la versión actual de la campaña.');
        const connections=store.get('connections',{});
        let targets;
        if(action==='send') {
          if(campaign.kind!=='email') throw new ServiceError(400,'Esta campaña no es un correo.');
          if(!connections.smtp?.password) throw new ServiceError(409,'Conecta tu expeditor SMTP antes de enviar.');
          targets=data.testEmail ? [{id:'test',email:data.testEmail,first_name:'Prueba'}] : (data.recipientIds || []).map(id=>db.prepare('SELECT * FROM contacts WHERE id=? AND opted_in=1 AND opted_out=0').get(id)).filter(Boolean);
        } else {
          if(campaign.kind!=='social') throw new ServiceError(400,'Esta campaña no es social.');
          const {channels}=await providers.bufferChannels(connections.buffer);
          targets=campaign.channelIds.map(id=>channels.find(c=>c.id===id));
          if(targets.some(c=>!c)) throw new ServiceError(400,'Un canal ya no pertenece a tu cuenta Buffer.');
        }
        if(!targets.length) throw new ServiceError(400,'Selecciona destinatarios autorizados o canales.');
        const results=[];
        for(const target of targets) {
          const targetKey=action==='send'?target.email:target.id;
          const provider=action==='send'?(data.testEmail?'smtp-test':'smtp'):'buffer';
          const deliveryId=randomUUID();
          const config=action==='send'?connections.smtp:connections.buffer;
          const payload=JSON.stringify({campaign,target,connectionHash:hash(JSON.stringify(config))});
          const inserted=db.prepare('INSERT OR IGNORE INTO deliveries(id,campaign_id,version,target,provider,status,created,payload) VALUES (?,?,?,?,?,?,?,?)').run(deliveryId,campaign.id,campaign.version,targetKey,provider,'queued',now(),payload);
          if(!inserted.changes) {results.push({target:targetKey,status:'already_recorded'});continue;}
          results.push({target:targetKey,status:'queued'});
        }
        store.audit(user.id,`campaign.${action}`,campaign.id);return json({ok:results.every(r=>r.status!=='unconfirmed'),results});
      }
      throw new ServiceError(404,'Ruta no disponible.');
    } catch(error) {
      if(error instanceof z.ZodError) return json({error:'Revisa los campos del formulario.',fields:error.issues.map(i=>i.path.join('.'))},400);
      if(error instanceof ServiceError) return json({error:error.message},error.status);
      // Never echo provider messages, payloads or authentication data to visitors or logs.
      console.error('Neuro Diversa request failed',error.name);
      return json({error:'No se pudo completar la solicitud. Intenta de nuevo.'},500);
    }
  }
  const server=http.createServer(async(req,res)=>{
    try {
      const chunks=[];let size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>100000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request(`${site}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks),duplex:'half'})});
      const response=await handle(request);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
      res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>k!=='set-cookie')));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {if(!res.headersSent)res.writeHead(500);res.end();}
  });
  return {server,handle,store,auth,invite,processJobs,close:()=>{if(jobTimer)clearInterval(jobTimer);server.close();db.close();}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const app=await createApplication();
  app.server.listen(Number(process.env.PORT || 8080),'0.0.0.0',()=>console.log('Neuro Diversa backend listening'));
}
