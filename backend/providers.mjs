// Adapted from o7digital/crm-suites-o7: marketing/buffer.adapter.ts and tenant.service.ts.
// Provider credentials belong only to this workspace and are never returned to a browser.
import nodemailer from 'nodemailer';
import { createHmac } from 'node:crypto';

export class ServiceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publicUrl(value, required = false) {
  if (!value && !required) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || u.hostname.includes(':')) throw new Error();
    return u.toString();
  } catch { throw new ServiceError(400, 'Usa una URL pública con HTTPS.'); }
}
export function renderMail(campaign, contact = {}, unsubscribe = '') {
  const merge = value => String(value || '').replace(/\{\{\s*(firstName|fullName|email)\s*\}\}/g, (_, key) => ({ firstName: contact.first_name || '', fullName: [contact.first_name, contact.last_name].filter(Boolean).join(' '), email: contact.email || '' }[key]));
  const text = merge(campaign.body);
  const title = escapeHtml(merge(campaign.headline || campaign.subject));
  const body = text.split(/\n{2,}/).map(p => `<p style="line-height:1.7;margin:0 0 18px">${escapeHtml(p).replaceAll('\n','<br>')}</p>`).join('');
  const image = publicUrl(campaign.heroImage);
  const ctaUrl = publicUrl(campaign.ctaUrl);
  const html = `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#f3e9e8;color:#402b35;font:16px Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(campaign.preheader)}</div><table role="presentation" width="100%" style="padding:24px 12px"><tr><td align="center"><table role="presentation" width="640" style="width:100%;max-width:640px;background:#fffdf9;border-radius:16px;overflow:hidden"><tr><td style="background:#402b35;color:#fff;padding:28px 32px;font:26px Georgia,serif">Neuro Diversa</td></tr>${image ? `<tr><td><img src="${escapeHtml(image)}" alt="" width="640" style="width:100%;height:auto;display:block"></td></tr>` : ''}<tr><td style="padding:32px"><h1 style="font:34px Georgia,serif;color:#722f3b">${title}</h1>${body}${ctaUrl ? `<p><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#722f3b;color:white;border-radius:8px;padding:14px 20px;text-decoration:none">${escapeHtml(campaign.cta || 'Conocer más')}</a></p>` : ''}</td></tr><tr><td style="padding:24px 32px;background:#eee5ed;font-size:13px;line-height:1.7">Neuro Diversa · Cracovia 72, Torre A, Oficina 216, San Ángel, CDMX.<br>Información general; no sustituye una valoración profesional.${unsubscribe ? `<br><a href="${escapeHtml(unsubscribe)}" style="color:#722f3b">Cancelar suscripción</a>` : ''}</td></tr></table></td></tr></table></body></html>`;
  return { subject: merge(campaign.subject), html, text: `${text}${ctaUrl ? `\n\n${campaign.cta || 'Conocer más'}: ${ctaUrl}` : ''}${unsubscribe ? `\n\nCancelar suscripción: ${unsubscribe}` : ''}` };
}
export function createProviders(env, fetcher = fetch, transport = nodemailer.createTransport) {
  let token, expires = 0;
  const coreUrl = env.OLIVIA_API_URL || 'http://core:8093';
  async function core(path, body, retry = true) {
    if (expires < Date.now()) {
      const response = await fetcher(`${coreUrl}/v1/auth/login`, { method:'POST', headers:{'Content-Type':'application/json','X-Tenant-ID':'neurodiversa'}, body: JSON.stringify({email:env.OLIVIA_EMAIL,password:env.OLIVIA_PASSWORD}), signal:AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok || typeof data.access_token !== 'string') throw new ServiceError(503, 'Olivia no está disponible en este momento.');
      token = data.access_token; expires = Date.now()+3000000;
    }
    const response = await fetcher(`${coreUrl}${path}`, { method:body === undefined ? 'GET':'POST', headers:{'Content-Type':'application/json','X-Tenant-ID':'neurodiversa',Authorization:`Bearer ${token}`}, ...(body === undefined ? {}:{body:JSON.stringify(body)}), signal:AbortSignal.timeout(55000) });
    if (response.status === 401 && retry) { expires = 0; return core(path,body,false); }
    if (!response.ok) throw new ServiceError(503, 'Olivia no está disponible en este momento.');
    return response.json();
  }
  async function buffer(config, query) {
    if (!config?.apiKey) throw new ServiceError(409, 'Conecta tu cuenta de Buffer en Conexiones.');
    let response;
    try { response = await fetcher('https://api.buffer.com', { method:'POST', headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'}, body:JSON.stringify({query}), signal:AbortSignal.timeout(20000) }); }
    catch { throw new ServiceError(503, 'Buffer no responde. Revisa Buffer antes de reintentar una publicación.'); }
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.errors?.length || !body?.data) throw new ServiceError(502, 'Buffer rechazó la solicitud. Revisa la conexión y sus permisos.');
    return body.data;
  }
  return {
    async health() { const response = await fetcher(`${coreUrl}/health`,{signal:AbortSignal.timeout(5000)}); const data = await response.json(); if (!response.ok || !/^3\.6\./.test(data.version)) throw new ServiceError(503,'Olivia 3.6 no está disponible.'); return data.version; },
    async chat(message, conversationId) { await this.health(); const data = await core('/v1/chat',{message, ...(conversationId ? {conversation_id:conversationId}:{}), routing:'FAST'}); if (!data.answer || !/^[a-f0-9]{24}$/.test(data.conversation_id)) throw new ServiceError(502,'Respuesta incompleta de Olivia.'); return data; },
    async bufferChannels(config) {
      const account = await buffer(config,'query { account { organizations { id name } } }');
      const organizations = account.account?.organizations || [];
      const organization = config.organizationId ? organizations.find(o=>o.id===config.organizationId) : organizations.length===1 ? organizations[0] : null;
      if (!organization) throw new ServiceError(400,'Selecciona el identificador de tu organización Buffer.');
      const data = await buffer(config,`query { channels(input:{organizationId:${JSON.stringify(organization.id)}}) { id name displayName service } }`);
      return { organization, channels:data.channels || [] };
    },
    async bufferPost(config, channel, campaign) {
      const media = publicUrl(campaign.mediaUrl);
      if (['instagram','pinterest'].includes(channel.service.toLowerCase()) && !media) throw new ServiceError(400,'Este canal requiere una imagen.');
      if (['tiktok','youtube'].includes(channel.service.toLowerCase())) throw new ServiceError(400,'Este editor admite imágenes. Prepara los vídeos directamente en Buffer.');
      const scheduled = campaign.mode === 'scheduled';
      if (scheduled && (!campaign.dueAt || new Date(campaign.dueAt).getTime() < Date.now()+60000)) throw new ServiceError(400,'Elige una fecha futura.');
      const mode = scheduled ? `customScheduled,dueAt:${JSON.stringify(new Date(campaign.dueAt).toISOString())}` : 'addToQueue';
      const query = `mutation { createPost(input:{channelId:${JSON.stringify(channel.id)},text:${JSON.stringify(campaign.body)},schedulingType:automatic,mode:${mode},saveToDraft:${campaign.mode==='draft'},assets:[${media ? `{image:{url:${JSON.stringify(media)}}}`:''}]}) { ... on PostActionSuccess { post { id channelId text status dueAt } } ... on MutationError { message } } }`;
      const data = await buffer(config, query);
      if (!data.createPost?.post?.id) throw new ServiceError(502,'Buffer no confirmó la publicación. Revisa Buffer antes de reintentar.');
      return data.createPost.post;
    },
    async sendMail(config, campaign, contact, unsubscribe) {
      if (!config?.host || !config?.password || !config?.fromEmail) throw new ServiceError(409,'Configura el remitente SMTP en Conexiones.');
      const mail = renderMail(campaign,contact,unsubscribe);
      const sender = transport({host:config.host,port:config.port,secure:config.port===465,requireTLS:config.port!==465,auth:{user:config.username,pass:config.password},connectionTimeout:10000,socketTimeout:20000});
      try { return await sender.sendMail({from:{name:config.fromName || 'Neuro Diversa',address:config.fromEmail},to:contact.email,...mail, ...(unsubscribe ? {headers:{'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})}); }
      finally { sender.close(); }
    },
    unsubscribe(id) { return `${id}.${createHmac('sha256',env.VAULT_KEY).update(`unsubscribe:${id}`).digest('base64url')}`; },
  };
}
