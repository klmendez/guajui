import {Readable} from 'node:stream';
import {createAuthHandler} from '../../server/platform-auth.mjs';

// Keep the same authorization and validation in Node and Netlify.
export function createNetlifyHandler(options){
  const handle=createAuthHandler(options);
  return async event=>{
    const headers=Object.fromEntries(Object.entries(event.headers || {}).map(([key,value])=>[key.toLowerCase(),value]));
    const url=new URL(event.rawUrl || `https://${headers.host}${event.path}`);
    headers.host=url.host;
    const path=url.pathname.replace(/^\/\.netlify\/functions\/platform(?=\/|$)/,'/api/platform');
    const body=Buffer.from(event.body || '',event.isBase64Encoded?'base64':'utf8');
    const req=Readable.from([body]);
    req.url=path;
    req.method=event.httpMethod;
    req.headers=headers;
    // Netlify supplies this header; do not use a client-provided forwarded IP.
    req.socket={remoteAddress:headers['x-nf-client-connection-ip'] || 'unknown',encrypted:true};
    const responseHeaders={};
    let responseBody='';
    const res={statusCode:200,setHeader(name,value){responseHeaders[name]=value;},end(value){responseBody=value || '';}};
    await handle(req,res);
    return {statusCode:res.statusCode,headers:responseHeaders,body:responseBody};
  };
}

export const handler=createNetlifyHandler();
