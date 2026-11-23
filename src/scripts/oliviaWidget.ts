const root=document.querySelector<HTMLElement>('#neurodiversa-olivia');
if(root) {
  const en=root.dataset.language==='en';
  const copy=en?{welcome:'Hello, I’m Olivia, Neuro Diversa’s assistant. I can help with the team, psychological support and the social skills group. What would you like to know?',online:'Online',sleep:'At rest',offline:'Reconnecting',sent:'Thank you. Your request is in the team’s inbox. They will contact you to confirm details; this is not a confirmed registration.',consent:'Please accept the privacy notice to use the chat.',error:'We could not complete this request. Please try again.',waiting:'Olivia is thinking…'}:{welcome:'Hola, soy Olivia, asistente de Neuro Diversa. Puedo orientarte sobre el equipo, la atención psicológica y el grupo de habilidades sociales. ¿Qué te gustaría saber?',online:'En línea',sleep:'En descanso',offline:'Reconectando',sent:'Gracias. Tu solicitud ya está en la bandeja del equipo. Te contactarán para confirmar los detalles; esto no confirma una inscripción.',consent:'Acepta el aviso de privacidad para usar el chat.',error:'No pudimos completar la solicitud. Intenta de nuevo.',waiting:'Olivia está escribiendo…'};
  const el=<T extends Element=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const panel=el<HTMLElement>('.olivia-panel'),launcher=el<HTMLButtonElement>('.olivia-launcher'),leadForm=el<HTMLFormElement>('.olivia-lead'),composer=el<HTMLFormElement>('.olivia-composer'),feedback=el<HTMLElement>('.olivia-feedback');
  let open=false,busy=false,available=false,active=true,session:Promise<unknown>|null=null,polling=false;
  let activityTimer:ReturnType<typeof setTimeout>;
  async function api(path:string,body?:unknown) {
    const response=await fetch(`/api/widget/${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error || copy.error);return data;
  }
  function presence() {root.classList.toggle('olivia-online',available && active);root.querySelectorAll('[data-presence]').forEach(n=>n.textContent=available?(active?copy.online:copy.sleep):copy.offline);}
  function activity() {active=true;clearTimeout(activityTimer);presence();activityTimer=setTimeout(()=>{active=false;presence();},45000);}
  ['pointerdown','keydown','scroll','touchstart'].forEach(event=>window.addEventListener(event,activity,{passive:true}));activity();
  function bubble(role:string,content:string) {const div=document.createElement('div');div.className=`olivia-bubble ${role}`;div.textContent=content;return div;}
  function render(messages:Array<{role:string;content:string}>) {el('.olivia-messages').replaceChildren(bubble('assistant',copy.welcome),...messages.map(m=>bubble(m.role,m.content)));}
  function ensureSession() {if(!session)session=api('session',{}).catch(error=>{session=null;throw error;});return session;}
  async function status() {try{available=(await api('status')).available;}catch{available=false;}presence();}
  async function poll() {if(!open || polling)return;polling=true;try {await ensureSession();const data=await api('messages');render(data.messages || []);}catch {}finally{polling=false;}}
  function show(value:boolean) {open=value;panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));activity();if(open){ensureSession().then(poll).catch(()=>{feedback.textContent=copy.error;});status();el<HTMLInputElement>('.olivia-composer input[name="message"]').focus();}}
  launcher.addEventListener('click',()=>show(!open));el('[data-close]').addEventListener('click',()=>show(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && open){show(false);launcher.focus();}});
  function interest(value:string) {show(true);leadForm.hidden=false;(leadForm.elements.namedItem('interest') as HTMLSelectElement).value=value;leadForm.scrollIntoView({block:'nearest',behavior:'smooth'});}
  root.querySelectorAll<HTMLElement>('[data-interest]').forEach(button=>button.addEventListener('click',()=>interest(button.dataset.interest || 'general')));
  window.addEventListener('neurodiversa:contact',((event:CustomEvent)=>interest(event.detail?.interest || 'group')) as EventListener);
  document.querySelectorAll<HTMLElement>('[data-olivia-contact]').forEach(button=>button.addEventListener('click',()=>interest(button.dataset.oliviaContact || 'group')));
  leadForm.addEventListener('submit',async(event)=>{
    event.preventDefault();if(busy || !leadForm.reportValidity())return;
    const data=new FormData(leadForm),button=leadForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;busy=true;button.disabled=true;feedback.textContent='';
    try {await ensureSession();await api('leads',{firstName:data.get('firstName'),lastName:data.get('lastName'),email:data.get('email'),phone:data.get('phone'),interest:data.get('interest'),message:data.get('message'),consent:data.get('consent')==='on',marketingConsent:data.get('marketingConsent')==='on',language:en?'en':'es',page:location.pathname});leadForm.hidden=true;leadForm.reset();feedback.textContent=copy.sent;}
    catch(error){feedback.textContent=error instanceof Error?error.message:copy.error;}finally{busy=false;button.disabled=false;}
  });
  composer.addEventListener('submit',async(event)=>{
    event.preventDefault();if(busy)return;const input=composer.elements.namedItem('message') as HTMLInputElement;
    if(!(composer.elements.namedItem('chatConsent') as HTMLInputElement).checked){feedback.textContent=copy.consent;return;}
    const message=input.value.trim();if(!message)return;
    busy=true;const button=composer.querySelector<HTMLButtonElement>('button')!;button.disabled=true;feedback.textContent=copy.waiting;
    el('.olivia-messages').append(bubble('visitor',message));const scroll=el<HTMLElement>('.olivia-scroll');scroll.scrollTop=scroll.scrollHeight;
    try{await ensureSession();await api('chat',{message,language:en?'en':'es',consent:true,requestId:crypto.randomUUID(),page:location.pathname});input.value='';feedback.textContent='';await poll();scroll.scrollTop=scroll.scrollHeight;}
    catch(error){feedback.textContent=error instanceof Error?error.message:copy.error;}finally{busy=false;button.disabled=false;input.focus();}
  });
  render([]);status();setInterval(()=>{if(!document.hidden){poll();status();}},10000);
}
export {};
