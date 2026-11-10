import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const browser=await chromium.launch({headless:true});
const base='http://127.0.0.1:5173';
const ref='iibbavjuqescenbwonfp';
const owner='10000000-0000-0000-0000-000000000001';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
let posts=[];
async function fixture(role,active=true,loggedIn=true,path='/admin'){
  const context=await browser.newContext();
  const id=role==='superadmin'?owner:'10000000-0000-0000-0000-000000000002';
  const email=role==='superadmin'?'planetnodesarrolloguapi@gmail.com':role+'@example.com';
  const username=role==='superadmin'?'admin':role;
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.fixture';
  const user={id,email,email_confirmed_at:'2026-01-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
  await context.addInitScript(({ref,token,user,loggedIn})=>{
    if(loggedIn)localStorage.setItem('sb-'+ref+'-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));
    localStorage.setItem('guajui_admin_users_v1',JSON.stringify([{id:'local-admin',username:'admin',password:'guajui2026',role:'superadmin'}]));
    sessionStorage.setItem('guajui_admin_session_v1','local-admin');
    localStorage.setItem('guajui_census_additions_v1',JSON.stringify([{id:'old-local-person',answers:{firstName:'DATO ANTERIOR'}}]));
  },{ref,user,token,loggedIn});
  await context.route('**/api/platform/**',async route=>{
    const req=route.request(),body=req.postDataJSON(),path=new URL(req.url()).pathname;
    posts.push({path,body});
    if(path.endsWith('/login')){
      const valid=body.username==='admin' && body.password==='Fixture password 2026';
      return route.fulfill({status:valid?200:401,contentType:'application/json',body:JSON.stringify(valid?{access_token:token,refresh_token:'fixture'}:{error:'Usuario o contraseña incorrectos.'})});
    }
    if(path.endsWith('/recover'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({message:'Si el acceso está autorizado y tiene un correo asociado, recibirás un enlace para cambiar la contraseña. Revisa también la carpeta de spam.'})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({username:body.username,created:true})});
  });
  await context.route('https://'+ref+'.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    let body=[];
    if(request.method()==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(['POST','PATCH','PUT'].includes(request.method()))posts.push({path:url.pathname,body:request.postDataJSON()});
    if(url.pathname==='/auth/v1/user')body=user;
    else if(url.pathname==='/auth/v1/logout')body={};
    else if(url.pathname.endsWith('/rpc/platform_access_ready'))body=true;
    else if(url.pathname.endsWith('/rpc/can_request_platform_access'))body=active;
    else if(url.pathname.endsWith('/profiles'))body=[{id,username,role,active,community_id:role==='superadmin'?null:'limones'}];
    else if(url.pathname.endsWith('/access_grants'))body=[{email,login_username:username,role,active,community_id:role==='superadmin'?null:'limones'}];
    else if(url.pathname.endsWith('/surveys'))body=[{id:'survey-ui',title:'Encuesta nueva',description:'Prueba',status:'published',closes_at:'2099-01-01',created_at:'2026-11-03',questions:[{id:'topics',label:'Temas observados',type:'checkbox',required:true,options:['Agua','Educación']}]}];
    else if(url.pathname.endsWith('/site_pages'))body=[{slug:'consejo',title:'Consejo editable',published:true,sections:[{heading:'Primero',body:'Texto original'},{heading:'Segundo',body:'Conservar segundo bloque'}]}];
    else if(url.pathname.includes('/rpc/'))body=null;
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+path);
  return {page,context,errors};
}
try{
  for(const role of ['superadmin','enumerator','community_leader']){
    const {page,context,errors}=await fixture(role);
    await page.getByRole('heading',{name:/Bienvenido/}).waitFor();
    const names=await page.locator('aside nav button span').allTextContents();
    if(role==='enumerator')assert.deepEqual(names,['Resumen','Censo','Encuestas']);
    if(role==='community_leader'){assert(names.includes('Novedades'));assert(!names.includes('Accesos'));assert(!names.includes('Hojas de vida'));}
    for(const tab of names){
      await page.locator('aside nav').getByRole('button',{name:tab,exact:true}).click();
      await page.waitForTimeout(120);
    }
    assert.deepEqual(errors,[],role+' runtime errors');
    assert(!(await page.content()).includes('DATO ANTERIOR'));
    assert(!posts.some(post=>JSON.stringify(post).includes('DATO ANTERIOR')));
    if(role==='superadmin'){
      await page.locator('aside nav').getByRole('button',{name:'Páginas',exact:true}).click();
      await page.locator('input[name="title"]').waitFor();
      await page.waitForFunction(()=>document.querySelector('input[name="title"]')?.value==='Consejo editable');
      assert.equal(await page.locator('textarea[name="body-1"]').inputValue(),'Conservar segundo bloque');
      await page.locator('textarea[name="body-0"]').fill('Texto corregido');
      await page.getByRole('button',{name:'Guardar página',exact:true}).click();
      await page.getByText('Página guardada.',{exact:true}).waitFor();
      assert(posts.some(post=>post.path.endsWith('/site_pages')&&post.body.sections[0].body==='Texto corregido'&&post.body.sections[1].body==='Conservar segundo bloque'));
      await page.locator('aside nav').getByRole('button',{name:'Accesos',exact:true}).click();
      await page.getByLabel('Usuario',{exact:true}).fill('nuevo');
      await page.getByLabel('Contraseña',{exact:true}).fill('New fixture password');
      await page.getByLabel('Correo para recuperar contraseña (opcional)').fill('nuevo@example.com');
      await page.getByLabel('Perfil').selectOption('enumerator');
      await page.getByLabel('Comunidad asignada').selectOption('limones');
      await page.getByRole('button',{name:'Crear usuario',exact:true}).click();
      await page.getByText('Usuario creado.',{exact:false}).waitFor();
      assert(posts.some(post=>post.path.endsWith('/accounts')&&post.body.username==='nuevo'&&post.body.email==='nuevo@example.com'&&post.body.role==='enumerator'&&post.body.communityId==='limones'));
      await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('aside').scrollTop=0;});
      await page.screenshot({path:'tests/admin-access-preview.png',fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
      await page.locator('aside nav').getByRole('button',{name:'Accesos',exact:true}).click();
      assert.equal(await page.locator('.mobile-menu-open').count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    }
    await context.close();
  }
  const {page,context}=await fixture('reviewer',false);
  await page.getByRole('heading',{name:'Acceso a la plataforma',exact:true}).waitFor();
  assert.equal(await page.locator('aside nav').count(),0);
  await context.close();
  const loginFixture=await fixture('superadmin',true,false);
  const loginPage=loginFixture.page;
  await loginPage.getByRole('button',{name:'Entrar',exact:true}).waitFor();
  await loginPage.getByLabel('Usuario',{exact:true}).fill('admin');
  await loginPage.locator('input[name=password]').fill('Incorrecta');
  await loginPage.getByRole('button',{name:'Entrar',exact:true}).click();
  await loginPage.getByText('Usuario o contraseña incorrectos.',{exact:true}).waitFor();
  await loginPage.locator('input[name=password]').fill('Fixture password 2026');
  await loginPage.getByRole('button',{name:'Mostrar contraseña'}).click();
  assert.equal(await loginPage.locator('input[name=password]').getAttribute('type'),'text');
  await loginPage.getByRole('button',{name:'Entrar',exact:true}).click();
  await loginPage.getByRole('heading',{name:'Bienvenido, admin'}).waitFor();
  assert(!posts.some(post=>post.path.endsWith('/otp')));
  await loginFixture.context.close();
  const recoveryRequest=await fixture('superadmin',true,false);
  await recoveryRequest.page.getByLabel('Usuario',{exact:true}).fill('admin');
  await recoveryRequest.page.getByRole('button',{name:'Olvidé mi contraseña',exact:true}).click();
  assert.equal(await recoveryRequest.page.getByLabel('Usuario o correo',{exact:true}).inputValue(),'admin');
  await recoveryRequest.page.getByRole('button',{name:'Enviar enlace de recuperación',exact:true}).click();
  await recoveryRequest.page.getByRole('status').filter({hasText:'recibirás un enlace'}).waitFor();
  assert(posts.some(post=>post.path.endsWith('/recover') && post.body.identifier==='admin'));
  assert.equal(await recoveryRequest.page.getByRole('button',{name:'Enviar enlace de recuperación',exact:true}).count(),0);
  await recoveryRequest.context.close();
  const expired=await fixture('superadmin',true,false,'/admin?recuperar=1#error=access_denied&error_code=otp_expired');
  await expired.page.getByRole('alert').filter({hasText:'El enlace no es válido o ha vencido'}).waitFor();
  assert.equal(await expired.page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).count(),0);
  await expired.page.getByRole('button',{name:'Volver a iniciar sesión',exact:true}).click();
  await expired.page.getByRole('heading',{name:'Acceso a la plataforma',exact:true}).waitFor();
  await expired.context.close();
  const recovery=await fixture('superadmin',true,true,'/admin?recuperar=1');
  await recovery.page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).waitFor();
  assert.equal(await recovery.page.locator('aside nav').count(),0,'La sesión de recuperación muestra el cambio de contraseña antes del panel.');
  await recovery.page.locator('input[name=password]').fill('Recovered fixture password');
  await recovery.page.getByLabel('Repite la nueva contraseña',{exact:true}).fill('Mismatched confirmation');
  const changesBefore=posts.filter(post=>post.path==='/auth/v1/user'&&post.body.password).length;
  await recovery.page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();
  await recovery.page.getByRole('alert').filter({hasText:'Las contraseñas no coinciden.'}).waitFor();
  assert.equal(posts.filter(post=>post.path==='/auth/v1/user'&&post.body.password).length,changesBefore);
  await recovery.page.getByLabel('Repite la nueva contraseña',{exact:true}).fill('Recovered fixture password');
  await recovery.page.getByRole('button',{name:'Guardar nueva contraseña',exact:true}).click();
  await recovery.page.getByRole('status').filter({hasText:'Contraseña actualizada.'}).waitFor();
  assert(posts.some(post=>post.path==='/auth/v1/user'&&post.body.password==='Recovered fixture password'));
  assert(!recovery.page.url().includes('recuperar'));
  assert.equal(await recovery.page.locator('aside nav').count(),0);
  assert.deepEqual(recovery.errors,[]);
  await recovery.context.close();
  const publicContext=await browser.newContext();
  let sent=null;
  await publicContext.route('https://'+ref+'.supabase.co/**',route=>{
    const req=route.request();
    if(req.method()==='POST')sent=req.postDataJSON();
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(req.url().includes('/surveys')?[{id:'public-survey',title:'Encuesta pública',description:'Nueva encuesta',status:'published',closes_at:'2099-01-01',questions:[{id:'customMulti',label:'Opciones',type:'checkbox',required:true,options:['Una','Dos']}]}]:null)});
  });
  const publicPage=await publicContext.newPage();await publicPage.goto(base+'/encuestas');
  await publicPage.getByRole('button',{name:'Responder encuesta'}).click();
  await publicPage.getByLabel('Comunidad').selectOption({label:'Limones'});
  await publicPage.getByLabel('Una',{exact:true}).check();
  await publicPage.getByRole('button',{name:'Enviar respuesta'}).click();
  await publicPage.getByRole('heading',{name:'Respuesta registrada'}).waitFor();
  assert.deepEqual(sent.answers.customMulti,['Una']);
  assert.equal(sent.community_id,'limones');
  await publicContext.close();
  console.log('OK: usuario/contraseña, recuperación por correo, enlace vencido, tres perfiles, alta autorizada y encuesta remota.');
}finally{await browser.close();}
