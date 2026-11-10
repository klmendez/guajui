import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const child=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'5189'},stdio:['ignore','pipe','pipe'],windowsHide:true});
try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('El servidor no arrancó.');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Tiempo de arranque agotado.')),10000);timer.unref();})]);
  const base='http://127.0.0.1:5189';
  const page=await fetch(base+'/admin');
  assert.equal(page.status,200);
  const html=await page.text();
  const asset=html.match(/src="([^"]+\.js)"/)?.[1];
  assert(asset);
  assert.equal((await fetch(base+asset)).status,200);
  const denied=await fetch(base+'/api/platform/login');
  assert.equal(denied.status,405);
  const outside=await fetch(base+'/%2e%2e%2f.env.local');
  assert.equal(outside.status,403);
  console.log('OK: servidor de producción, rutas, archivos compilados y protección de archivos fuera de dist.');
}finally{child.kill();await once(child,'exit').catch(()=>{});}
