import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createAuthHandler} from './platform-auth.mjs';
const dist=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const api=createAuthHandler();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  if(new URL(req.url,'http://localhost').pathname.startsWith('/api/platform/'))return api(req,res);
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const filename=path.resolve(dist,'.'+pathname);
    if(filename!==dist && !filename.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
    let content;let extension=path.extname(filename);
    try{content=await readFile(filename);}catch(error){
      if(extension && !['.html'].includes(extension)){res.writeHead(404);res.end();return;}
      content=await readFile(path.join(dist,'index.html'));extension='.html';
    }
    res.setHeader('Content-Type',types[extension] || 'application/octet-stream');
    res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(500);res.end('No se pudo abrir la página.');}
});
const port=Number(process.env.PORT || 5173);
server.listen(port,process.env.HOST || '127.0.0.1',()=>console.log('Plataforma disponible en http://127.0.0.1:'+port));
