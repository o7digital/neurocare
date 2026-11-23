// The browser never receives the private backend credential or provider keys.
export default async function handler(req,res) {
  const site='https://neurodiversa.mx';
  const json=(status,error)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error}));};
  if(!process.env.NEURODIVERSA_BACKEND_URL || !process.env.NEURODIVERSA_GATEWAY_KEY) return json(503,'El espacio no está disponible en este momento.');
  const input=new URL(req.url,site),route=input.searchParams.get('route') || req.query?.route || input.pathname.replace(/^\/api\//,'');
  if(!/^(auth|invitations|public|widget|admin|unsubscribe)(\/[-a-zA-Z0-9]+)*$/.test(route)) return json(404,'Ruta no disponible.');
  if(req.headers.origin && req.headers.origin!==site && req.headers.origin!==`https://${req.headers.host}`) return json(403,'Origen no permitido.');
  if(!['GET','POST','PATCH','PUT','DELETE'].includes(req.method)) return json(405,'Método no permitido.');
  const query=new URLSearchParams(input.searchParams);query.delete('route');
  for(const [name,value] of Object.entries(req.query || {}))if(name!=='route'&&!query.has(name)&&typeof value==='string')query.set(name,value);
  const destination=`${process.env.NEURODIVERSA_BACKEND_URL.replace(/\/$/,'')}/api/${route}${query.size?'?'+query:''}`;
  try {
    const headers={'x-neurodiversa-key':process.env.NEURODIVERSA_GATEWAY_KEY,origin:site,'x-visitor-ip':req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown'};
    if(req.headers.cookie) headers.cookie=req.headers.cookie;
    if(req.headers['content-type']) headers['content-type']=req.headers['content-type'];
    const body=['GET','HEAD'].includes(req.method)?undefined:typeof req.body==='string' || Buffer.isBuffer(req.body)?req.body:JSON.stringify(req.body || {});
    if(body && Buffer.byteLength(body)>100000) return json(413,'Solicitud demasiado grande.');
    const response=await fetch(destination,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(65000)});
    res.statusCode=response.status;
    for(const key of ['content-type','content-security-policy']) if(response.headers.get(key))res.setHeader(key,response.headers.get(key));
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {return json(503,'No se pudo conectar. Intenta de nuevo.');}
}
