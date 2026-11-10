import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/rest/v1/content_items*',route=>route.fulfill({json:['Noticia','Convocatoria','Seguimiento'].map((kind,i)=>({id:String(i),kind,title:kind+' de prueba',status:'Aprobada',data:{publicationDate:'2026-11-04',description:'Resumen '+kind,body:'Contenido completo '+kind}}))}));
  await page.goto('http://127.0.0.1:5173/noticias');
  await page.getByRole('heading',{name:'Convocatoria de prueba'}).waitFor();
  await page.getByLabel('Tipo de publicación').selectOption('Convocatoria');
  assert.equal(await page.locator('.editorial-grid article').count(),1);
  await page.getByText('Leer publicación',{exact:true}).click();
  assert(await page.getByText('Contenido completo Convocatoria',{exact:true}).isVisible());
  await page.getByLabel('Tipo de publicación').selectOption('Seguimiento');
  await page.getByRole('heading',{name:'Seguimiento de prueba'}).waitFor();
  assert.deepEqual(errors,[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log('OK: publicaciones completas, convocatorias, seguimientos y ancho móvil.');
} finally {await browser.close();}
