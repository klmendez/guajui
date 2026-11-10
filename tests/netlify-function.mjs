import assert from 'node:assert/strict';
import {createNetlifyHandler} from '../netlify/functions/platform.mjs';

const recoveries=[];
const clients={admin:{from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:{active:true,role:'superadmin',email:'admin@example.com'}};}})},passwordClient:()=>({auth:{async resetPasswordForEmail(email,options){recoveries.push({email,...options});return {};}}})};
const handler=createNetlifyHandler({getClients:async()=>clients});
const request=(overrides={})=>handler({rawUrl:'https://guajui.netlify.app/api/platform/recover',path:'/api/platform/recover',httpMethod:'POST',headers:{host:'guajui.netlify.app',origin:'https://guajui.netlify.app','content-type':'application/json','x-nf-client-connection-ip':'192.0.2.1'},body:JSON.stringify({identifier:'admin'}),...overrides});
assert.equal((await request()).statusCode,200);
assert.equal(recoveries[0].redirectTo,'https://guajui.netlify.app/admin?recuperar=1');
assert.equal((await request({rawUrl:'https://guajui.netlify.app/.netlify/functions/platform/recover',isBase64Encoded:true,body:Buffer.from('{"identifier":"admin"}').toString('base64')})).statusCode,200);
assert.equal((await request({httpMethod:'GET'})).statusCode,405);
assert.equal((await request({body:'invalid'})).statusCode,400);
assert.equal((await request({headers:{host:'guajui.netlify.app',origin:'https://other.example','content-type':'application/json'}})).statusCode,403);
assert.equal((await request()).statusCode,429);
console.log('OK: Netlify routing, recovery HTTPS, base64, validation, origin and rate limit.');
