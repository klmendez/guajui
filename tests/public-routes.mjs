import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
const result=await build({stdin:{contents:`
 import React from 'react';
 import {renderToString} from 'react-dom/server';
 import {MemoryRouter} from 'react-router-dom';
 import App from './src/App.jsx';
 export function render(path){return renderToString(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(App)));}
`,resolveDir:process.cwd()},bundle:true,write:false,packages:'external',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'}});
const temp=new URL('../.public-routes-test.mjs',import.meta.url);
await writeFile(temp,result.outputFiles[0].text);
try{
 const {render}=await import(temp.href+'?'+Date.now());
 for(const path of ['/','/consejo','/grupos','/chirimias','/noticias','/proyectos','/agenda','/encuestas','/apuntes','/reuniones','/hojas-de-vida','/seguimiento-maestros','/seguimiento-junta','/censo','/certificado','/contacto','/admin']){
  const html=render(path);
  assert(html.length>100,path);
  if(path==='/admin'){assert(html.includes('Usuario'));assert(html.includes('Contraseña'));assert(html.includes('Entrar'));assert(html.includes('Olvidé mi contraseña'));}
 }
 console.log('OK: las 17 rutas renderizan sin acceso local ni errores de referencia.');
}finally{await unlink(temp);}
