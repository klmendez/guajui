import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const root=process.cwd();
const allowedRoles=new Set(['superadmin','enumerator','community_leader']);
export const ownerEmail='planetnodesarrolloguapi@gmail.com';
export const validUsername=value=>/^[a-z][a-z0-9._-]{2,39}$/.test(value);
export const validatePassword=value=>{
  if(typeof value!=='string' || value.length<10 || value.length>128) throw new HttpError(400,'La contraseña debe tener entre 10 y 128 caracteres.');
};
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const checked=result=>{if(result.error)throw result.error;return result.data;};
export async function readServerConfig(){
  const values={};
  for(const file of ['.env.local','.env.server.local']){
    try{
      for(const line of (await readFile(path.join(root,file),'utf8')).split(/\r?\n/)){
        const match=line.trim().match(/^([A-Z_]+)=(.*)$/);
        if(match)values[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
      }
    }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return {url:process.env.SUPABASE_URL || values.SUPABASE_URL || process.env.VITE_SUPABASE_URL || values.VITE_SUPABASE_URL,
    publishableKey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_PUBLISHABLE_KEY,
    secretKey:process.env.SUPABASE_SECRET_KEY || values.SUPABASE_SECRET_KEY};
}
export function authClients(config){
  if(!config.url || !config.publishableKey || !config.secretKey) throw new HttpError(503,'El acceso está pendiente de configuración por el administrador.');
  const auth={persistSession:false,autoRefreshToken:false,detectSessionInUrl:false};
  return {admin:createClient(config.url,config.secretKey,{auth}),
    passwordClient:()=>createClient(config.url,config.publishableKey,{auth})};
}
async function authorizedAdmin(admin,token){
  if(!token)throw new HttpError(401,'Inicia sesión.');
  let user;
  try{user=checked(await admin.auth.getUser(token)).user;}catch{throw new HttpError(401,'La sesión no es válida.');}
  const profile=checked(await admin.from('profiles').select('id,role,active,username').eq('id',user.id).maybeSingle());
  if(!profile?.active || profile.role!=='superadmin')throw new HttpError(403,'Solo el superadministrador puede administrar usuarios.');
  return {...user,username:profile.username};
}
async function grantByUsername(admin,username){
  return checked(await admin.from('access_grants').select('*').eq('login_username',username).maybeSingle());
}
const validEmail=value=>typeof value==='string' && value.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith('.invalid');
export const recoveryMessage='Si el acceso está autorizado y tiene un correo asociado, recibirás un enlace para cambiar la contraseña. Revisa también la carpeta de spam.';
async function configure(admin,grant){
  checked(await admin.rpc('configure_platform_user',{
    account_email:grant.email,account_username:grant.login_username,account_role:grant.role,
    account_community:grant.role==='superadmin'?null:grant.community_id,account_active:grant.active,
  }));
}
function roleFields(body){
  if(!allowedRoles.has(body.role))throw new HttpError(400,'Perfil no permitido.');
  if(body.role!=='superadmin' && !body.communityId)throw new HttpError(400,'Selecciona la comunidad asignada.');
  if(typeof body.active!=='boolean')throw new HttpError(400,'Estado de acceso inválido.');
}
export async function accountAction(clients,{path,method,body={},token,origin}){
  const {admin,passwordClient}=clients;
  if(path==='/recover' && method==='POST'){
    const identifier=String(body.identifier || '').trim().toLowerCase();
    if(!validUsername(identifier) && !validEmail(identifier))throw new HttpError(400,'Escribe tu usuario o tu correo electrónico.');
    const grant=identifier.includes('@')
      ?checked(await admin.from('access_grants').select('*').eq('email',identifier).maybeSingle())
      :await grantByUsername(admin,identifier);
    if(grant?.active && allowedRoles.has(grant.role) && validEmail(grant.email)){
      const redirectTo=new URL('/admin?recuperar=1',origin).href;
      const {error}=await passwordClient().auth.resetPasswordForEmail(grant.email,{redirectTo});
      if(error){
        if(error.status===429 || ['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code))
          throw new HttpError(429,'Se alcanzó el límite de correos. Espera antes de solicitar otro enlace.');
        throw new HttpError(503,'No se pudo enviar el correo. El administrador debe revisar la configuración de envío de Supabase.');
      }
    }
    return {message:recoveryMessage};
  }
  if(path==='/login' && method==='POST'){
    const username=String(body.username || '').trim().toLowerCase();
    if(!validUsername(username) || typeof body.password!=='string')throw new HttpError(401,'Usuario o contraseña incorrectos.');
    const grant=await grantByUsername(admin,username);
    if(!grant?.active)throw new HttpError(401,'Usuario o contraseña incorrectos.');
    const result=await passwordClient().auth.signInWithPassword({email:grant.email,password:body.password});
    if(result.error || !result.data.session)throw new HttpError(401,'Usuario o contraseña incorrectos.');
    const profile=checked(await admin.from('profiles').select('role,active,username').eq('id',result.data.user.id).maybeSingle());
    if(!profile?.active || !allowedRoles.has(profile.role) || profile.username!==username)throw new HttpError(401,'Usuario o contraseña incorrectos.');
    const session=result.data.session;
    return {access_token:session.access_token,refresh_token:session.refresh_token};
  }
  const actor=await authorizedAdmin(admin,token);
  if(path==='/accounts' && method==='POST'){
    const username=String(body.username || '').trim().toLowerCase();
    if(!validUsername(username))throw new HttpError(400,'Usa de 3 a 40 caracteres: letras, números, punto, guion o guion bajo; comienza con una letra.');
    if(username==='admin')throw new HttpError(409,'El usuario admin ya está reservado.');
    validatePassword(body.password);roleFields(body);
    if(await grantByUsername(admin,username))throw new HttpError(409,'Ese usuario ya existe.');
    const email=String(body.email || '').trim().toLowerCase();
    if(email && !validEmail(email))throw new HttpError(400,'Escribe un correo válido para recuperar la contraseña.');
    const grant={email:email || username+'@login.guajui.invalid',login_username:username,role:body.role,community_id:body.communityId,active:body.active};
    const result=await admin.auth.admin.createUser({email:grant.email,password:body.password,email_confirm:true});
    if(result.error){
      throw new HttpError(400,'No se pudo crear la cuenta. Ese usuario puede estar ocupado; elige otro nombre.');
    }
    try{await configure(admin,grant);}catch(error){
      await configure(admin,{...grant,active:false}).catch(()=>{});
      await admin.auth.admin.deleteUser(result.data.user.id).catch(()=>{});
      throw error;
    }
    return {username,created:true};
  }
  if(path.startsWith('/accounts/') && method==='PATCH'){
    const username=decodeURIComponent(path.slice('/accounts/'.length));
    const grant=await grantByUsername(admin,username);
    if(!grant)throw new HttpError(404,'Usuario no encontrado.');
    roleFields(body);
    if(body.password)validatePassword(body.password);
    const self=grant.email.toLowerCase()===actor.email.toLowerCase();
    if(self && (body.role!==grant.role || body.active!==grant.active || (body.communityId || null)!==(grant.community_id || null)))
      throw new HttpError(400,'Tu propio acceso debe ser administrado por otro superadministrador.');
    await configure(admin,{...grant,role:body.role,community_id:body.communityId,active:body.active});
    if(body.password){
      const profile=checked(await admin.from('profiles').select('id').eq('username',username).maybeSingle());
      if(!profile)throw new HttpError(400,'El usuario no tiene una cuenta creada. Configura sus credenciales antes de activarlo.');
      checked(await admin.auth.admin.updateUserById(profile.id,{password:body.password}));
    }
    return {username,updated:true};
  }
  throw new HttpError(404,'Ruta no encontrada.');
}
export function createAuthHandler({getClients=async()=>authClients(await readServerConfig())}={}){
  const attempts=new Map();
  return async function handler(req,res){
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    try{
      if(!['POST','PATCH'].includes(req.method))throw new HttpError(405,'Método no permitido.');
      const origin=req.headers.origin;
      if(origin && new URL(origin).host!==req.headers.host)throw new HttpError(403,'Origen no permitido.');
      if(!(req.headers['content-type'] || '').startsWith('application/json'))throw new HttpError(415,'Se requiere JSON.');
      const path=new URL(req.url,'http://localhost').pathname.replace(/^\/api\/platform/,'');
      if(path==='/login' || path==='/recover'){
        const key=path+':'+(req.socket.remoteAddress || 'local');
        const now=Date.now();const recent=(attempts.get(key)||[]).filter(value=>now-value<15*60*1000);
        if(recent.length>=(path==='/recover'?3:20))throw new HttpError(429,'Demasiados intentos. Espera 15 minutos e inténtalo nuevamente.');
        attempts.set(key,[...recent,now]);
        for(const [ip,times] of attempts)if(times.every(time=>now-time>15*60*1000))attempts.delete(ip);
      }
      let text='';for await(const chunk of req){text+=chunk;if(text.length>8192)throw new HttpError(413,'Solicitud demasiado grande.');}
      let body;try{body=JSON.parse(text);}catch{throw new HttpError(400,'Solicitud inválida.');}
      if(!body || typeof body!=='object' || Array.isArray(body))throw new HttpError(400,'Solicitud inválida.');
      const requestOrigin=origin || (req.socket.encrypted?'https://':'http://')+req.headers.host;
      const result=await accountAction(await getClients(),{path,method:req.method,body,origin:requestOrigin,token:(req.headers.authorization || '').replace(/^Bearer /,'')});
      res.statusCode=200;res.end(JSON.stringify(result));
    }catch(error){
      res.statusCode=error.status || 400;
      const message=error.code==='23505'?'Ya existe ese usuario o un responsable activo para esa comunidad.':
        error.code==='PGRST202'?'Falta actualizar la configuración de acceso.':error.status?error.message:'No se pudo completar la operación.';
      res.end(JSON.stringify({error:message}));
    }
  };
}
