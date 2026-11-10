import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {accountAction,createAuthHandler,recoveryMessage} from '../server/platform-auth.mjs';

const grants=new Map([
  ['admin',{email:'planetnodesarrolloguapi@gmail.com',login_username:'admin',role:'superadmin',active:true,community_id:null}],
  ['encuestador',{email:'encuestador@login.guajui.invalid',login_username:'encuestador',role:'enumerator',active:true,community_id:'limones'}],
]);
const users=new Map([
  ['owner',{id:'owner',email:'planetnodesarrolloguapi@gmail.com',password:'Fixture password 2026'}],
  ['survey',{id:'survey',email:'encuestador@login.guajui.invalid',password:'Fixture password 2026'}],
]);
const profiles=new Map([
  ['owner',{id:'owner',username:'admin',role:'superadmin',active:true}],
  ['survey',{id:'survey',username:'encuestador',role:'enumerator',active:true}],
]);
let created=0;
const admin={
  auth:{
    getUser:async token=>({data:{user:users.get(token)},error:users.has(token)?null:{message:'invalid'}}),
    admin:{
      createUser:async({email,password})=>{
        if([...users.values()].some(user=>user.email===email))return {error:{message:'exists'}};
        const user={id:'new-'+ ++created,email,password};users.set(user.id,user);
        profiles.set(user.id,{id:user.id,username:email,role:null,active:false});
        return {data:{user}};
      },
      updateUserById:async(id,{password})=>{users.get(id).password=password;return {data:{user:users.get(id)}};},
      deleteUser:async id=>{users.delete(id);profiles.delete(id);return {data:{}};},
    },
  },
  from:table=>{
    const filters=[];
    const query={
      select(){return this;},eq(field,value){filters.push([field,value]);return this;},
      async maybeSingle(){
        const values=table==='access_grants'?[...grants.values()]:[...profiles.values()];
        return {data:values.find(item=>filters.every(([field,value])=>item[field]===value)) || null};
      },
    };
    return query;
  },
  rpc:async(name,input)=>{
    assert.equal(name,'configure_platform_user');
    const grant={email:input.account_email,login_username:input.account_username,role:input.account_role,active:input.account_active,community_id:input.account_community};
    grants.set(grant.login_username,grant);
    for(const user of users.values())if(user.email===grant.email)profiles.set(user.id,{id:user.id,username:grant.login_username,role:grant.role,active:grant.active});
    return {data:null};
  },
};
const recoveries=[];
let recoveryError=null;
const clients={admin,passwordClient:()=>({auth:{resetPasswordForEmail:async(email,options)=>{
  recoveries.push({email,...options});return {data:{},error:recoveryError};
},signInWithPassword:async({email,password})=>{
  const user=[...users.values()].find(item=>item.email===email && item.password===password);
  return user?{data:{user,session:{access_token:user.id,refresh_token:'refresh'}},error:null}:{data:{session:null},error:{message:'bad'}};
}}})};
const login=body=>accountAction(clients,{path:'/login',method:'POST',body});
const create=(body,token='owner')=>accountAction(clients,{path:'/accounts',method:'POST',body,token});
assert.deepEqual(await login({username:' ADMIN ',password:'Fixture password 2026'}),{access_token:'owner',refresh_token:'refresh'});
await assert.rejects(login({username:'admin',password:'incorrecta'}),/Usuario o contraseña incorrectos/);
await assert.rejects(login({username:'desconocido',password:'incorrecta'}),/Usuario o contraseña incorrectos/);
const body={username:'responsable',password:'New fixture password',role:'community_leader',communityId:'limones',active:true};
await assert.rejects(create(body,'survey'),/Solo el superadministrador/);
await assert.rejects(create(body,''),/Inicia sesión/);
await create(body);
assert.equal((await login({username:'responsable',password:body.password})).refresh_token,'refresh');
await assert.rejects(create({...body,username:'communications',role:'communications'}),/Perfil no permitido/);
await assert.rejects(create({...body,username:'admin'}),/reservado/);
await accountAction(clients,{path:'/accounts/responsable',method:'PATCH',token:'owner',body:{...body,password:'Changed fixture password'}});
await assert.rejects(login({username:'responsable',password:body.password}),/incorrectos/);
await login({username:'responsable',password:'Changed fixture password'});
await accountAction(clients,{path:'/accounts/responsable',method:'PATCH',token:'owner',body:{...body,password:'',active:false}});
await assert.rejects(login({username:'responsable',password:'Changed fixture password'}),/incorrectos/);
await assert.rejects(accountAction(clients,{path:'/accounts/admin',method:'PATCH',token:'owner',body:{role:'superadmin',active:false}}),/propio acceso/);
users.set('preexisting',{id:'preexisting',email:'ocupado@login.guajui.invalid',password:'Attacker fixture'});
await assert.rejects(create({...body,username:'ocupado'}),/No se pudo crear/);
assert.equal(grants.has('ocupado'),false);
await assert.rejects(create({...body,username:'correo_invalido',email:'invalido'}),/correo válido/);
await assert.rejects(create({...body,username:'owner_alias',email:'planetnodesarrolloguapi@gmail.com'}),/No se pudo crear/);
assert.equal(grants.has('owner_alias'),false);
await create({...body,username:'con_correo',email:'PERSONA@example.com'});
assert.equal(grants.get('con_correo').email,'persona@example.com');
await login({username:'con_correo',password:body.password});
const recover=identifier=>accountAction(clients,{path:'/recover',method:'POST',body:{identifier,redirectTo:'https://foreign.example'},origin:'http://127.0.0.1:5173'});
for(const identifier of [' ADMIN ','planetnodesarrolloguapi@gmail.com','con_correo'])assert.deepEqual(await recover(identifier),{message:recoveryMessage});
assert.equal(recoveries.length,3);
assert.equal(recoveries[2].email,'persona@example.com');
assert(recoveries.every(item=>item.redirectTo==='http://127.0.0.1:5173/admin?recuperar=1'));
for(const identifier of ['desconocido','nadie@example.com','encuestador','responsable'])assert.deepEqual(await recover(identifier),{message:recoveryMessage});
assert.equal(recoveries.length,3,'No se envía a cuentas desconocidas, internas sin correo o inactivas.');
recoveryError={status:429};await assert.rejects(recover('admin'),/límite de correos/);
recoveryError={code:'email_address_not_authorized'};await assert.rejects(recover('admin'),/configuración de envío/);
recoveryError=null;

const server=createServer(createAuthHandler({getClients:async()=>clients}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
try{
 const request=(path,body,headers={})=>fetch(base+'/api/platform'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const result=await request('/login',{username:'admin',password:'Fixture password 2026'});
 assert.equal(result.status,200);
 assert.deepEqual(Object.keys(await result.json()).sort(),['access_token','refresh_token']);
 const denied=await request('/accounts',body,{Authorization:'Bearer survey'});assert.equal(denied.status,403);
 const forged=await request('/login',{username:'admin',password:'Fixture password 2026'},{Origin:'https://foreign.example'});assert.equal(forged.status,403);
 const forgedRecovery=await request('/recover',{identifier:'admin'},{Origin:'https://foreign.example'});assert.equal(forgedRecovery.status,403);
 for(let i=0;i<3;i++){
  const response=await request('/recover',{identifier:i?'desconocido':'admin'});assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{message:recoveryMessage});
 }
 assert.equal(recoveries.at(-1).redirectTo,base+'/admin?recuperar=1');
 assert.equal((await request('/recover',{identifier:'admin'})).status,429);
 for(let i=0;i<20;i++)await request('/login',{username:'admin',password:'incorrecta'});
 assert.equal((await request('/login',{username:'admin',password:'incorrecta'})).status,429);
}finally{await new Promise(resolve=>server.close(resolve));}
console.log('OK: usuario/contraseña, recuperación por correo, altas y cambios protegidos, errores genéricos y límites de intentos.');
