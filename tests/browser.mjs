// Run against tests/preview-fixture.mjs + the Astro dev proxy, never production.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {firefox}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await firefox.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base='http://127.0.0.1:4328';
mkdirSync('/tmp/neurodiversa-qa',{recursive:true});
try {
 await page.goto(base+'/programas/habilidades-sociales/');
 await page.getByRole('button',{name:'Me interesa el grupo',exact:true}).click();
 const widget=page.locator('#neurodiversa-olivia');
 await widget.locator('input[name=firstName]').fill('Paciente');await widget.locator('input[name=lastName]').fill('Prueba QA');
 await widget.locator('input[name=email]').fill('patient-qa@example.test');await widget.locator('input[name=phone]').fill('+52 5550000000');
 await widget.locator('textarea[name=message]').fill('Quisiera conocer los horarios del grupo.');await widget.locator('input[name=consent]').check();
 await widget.getByRole('button',{name:'Enviar solicitud',exact:true}).click();await widget.getByText('Tu solicitud ya está',{exact:false}).waitFor();
 await widget.locator('input[name=chatConsent]').check();await widget.locator('.olivia-composer input[name=message]').fill('¿Para qué edades es el grupo?');await widget.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
 await widget.getByText('El grupo de habilidades sociales es para jóvenes adultos',{exact:false}).waitFor();
 await page.screenshot({path:'/tmp/neurodiversa-qa/widget-desktop.png'});
 const admin=await context.newPage();admin.on('pageerror',error=>errors.push(error.message));await admin.goto(base+'/admin/');
 await admin.locator('#login-form input[name=email]').fill('reviewer@example.test');await admin.locator('#login-form input[name=password]').fill('Neurodiversa-QA-only-2026!');await admin.getByRole('button',{name:'Entrar al espacio',exact:true}).click();
 await admin.locator('#admin-app:not([hidden])').waitFor();await admin.getByRole('button',{name:/Paciente Prueba QA/}).click();
 await admin.locator('#lead-update textarea[name=note]').fill('Contactar para confirmar horarios.');await admin.locator('#lead-update select').selectOption('contacted');await admin.getByRole('button',{name:'Guardar seguimiento',exact:true}).click();
 await admin.getByRole('button',{name:'Abrir conversación',exact:true}).click();await admin.locator('#reply-form textarea').fill('Hola, el equipo revisará los horarios contigo.');await admin.getByRole('button',{name:'Enviar al chat del visitante',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Abrir Olivia AI',exact:true}).click();await page.getByText('Hola, el equipo revisará los horarios contigo.',{exact:true}).waitFor();
 await admin.screenshot({path:'/tmp/neurodiversa-qa/inbox-desktop.png'});
 await admin.getByRole('button',{name:'Artículos del sitio',exact:true}).click();await admin.locator('#post-form input[name=title]').fill('Conectar a nuestro ritmo · QA');await admin.locator('#post-form textarea[name=body]').fill('Una publicación compartida desde el backend de Neuro Diversa.');await admin.getByRole('button',{name:'Publicar en el blog',exact:true}).click();await admin.getByText('Artículo publicado en el blog.',{exact:true}).waitFor();
 const blog=await context.newPage();await blog.goto(base+'/blog/');await blog.getByRole('heading',{name:'Conectar a nuestro ritmo · QA',exact:true}).waitFor();
 await admin.getByRole('button',{name:'Programa grupal',exact:true}).click();await admin.locator('#program-form input[name=start]').fill('Febrero 2027 · QA');await admin.getByRole('button',{name:'Guardar en el sitio',exact:true}).click();await admin.getByText('Programa actualizado en el sitio.',{exact:true}).waitFor();await blog.goto(base+'/programas/habilidades-sociales/');await blog.getByText('Febrero 2027 · QA',{exact:true}).waitFor();
 await admin.getByRole('button',{name:'Mailing y newsletters',exact:true}).click();await admin.locator('#email-form input[name=subject]').fill('Novedades Neuro Diversa · QA');await admin.locator('#email-form input[name=headline]').fill('Un espacio para conectar');await admin.locator('#email-form textarea[name=body]').fill('Hola {{firstName}},\n\nEstas son las novedades del equipo.');await admin.getByRole('button',{name:'Guardar newsletter',exact:true}).click();await admin.frameLocator('#email-preview').getByRole('heading',{name:'Un espacio para conectar',exact:true}).waitFor();
 await admin.getByRole('button',{name:'Conexiones y accesos',exact:true}).click();await admin.locator('#buffer-form input[name=apiKey]').fill('qa-buffer-no-real-account');await admin.locator('#buffer-form input[name=organizationId]').fill('qa');await admin.getByRole('button',{name:'Guardar conexión Buffer',exact:true}).click();await admin.getByText('Conexión Buffer guardada.',{exact:false}).waitFor();
 await admin.getByRole('button',{name:'Redes con Buffer',exact:true}).click();await admin.getByRole('button',{name:'Consultar canales Buffer',exact:true}).click();await admin.locator('#buffer-channels input').check();await admin.locator('#social-form input[name=subject]').fill('Publicación QA');await admin.locator('#social-form textarea').fill('Texto de prueba aislado.');
 admin.once('dialog',dialog=>dialog.accept());await admin.getByRole('button',{name:'Enviar a Buffer',exact:true}).click();await admin.getByText('qa-facebook: en cola de envío',{exact:false}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#neurodiversa-olivia')?.classList.contains('olivia-online'),{},{timeout:50000});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/neurodiversa-qa/widget-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Public mobile overflow');
 await admin.setViewportSize({width:390,height:844});await admin.locator('[data-panel=inbox]').click();await admin.screenshot({path:'/tmp/neurodiversa-qa/inbox-mobile.png'});assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Admin mobile overflow');
 assert.deepEqual(errors,[]);
 console.log('Firefox QA passed: group lead → private inbox → operator reply → visitor, published article, shared program, newsletter preview, Buffer queue, idle indicator, desktop/mobile.');
} catch(error) {for(const [index,p] of context.pages().entries())await p.screenshot({path:`/tmp/neurodiversa-qa/failure-${index}.png`}).catch(()=>{});throw error;}
finally {await browser.close();}
