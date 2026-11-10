import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabaseClient';
import { roles, communityNames, rpc } from './platformStore';

const recoveryLocation=()=>typeof window!=='undefined' && (new URLSearchParams(window.location.search).get('recuperar')==='1' || new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery');
let state = { loading:true, user:null, error:'', recovery:recoveryLocation(), notice:'' };
const listeners = new Set();
let startPromise;
let revision = 0;
const emit = (next) => { state = next; listeners.forEach(listener => listener()); };
export const getPlatformSession = () => state.user;
export async function refreshSession() {
  const ticket = ++revision;
  emit({...state,loading:true,error:''});
  try {
    if (!supabase) throw new Error('Falta configurar Supabase.');
    const ready = await rpc('platform_access_ready');
    if (!ready) throw new Error('Falta instalar la actualización de accesos. Ejecuta npm run db:apply.');
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    let user = null;
    if (data.user) {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id',data.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.active || !roles[profile.role]) throw new Error('Este usuario no tiene acceso autorizado. Solicita al superadministrador que lo habilite.');
      user = { ...profile, email:data.user.email, community:communityNames[profile.community_id] || '' };
    }
    if (ticket === revision) emit({...state,loading:false,user,error:''});
  } catch (error) {
    if (ticket === revision) emit({...state,loading:false,user:null,error:error.message.includes('platform_access_ready') ? 'Instala la actualización de accesos con npm run db:apply.' : error.message});
  }
}
export function startSession() {
  if (!startPromise) {
    startPromise = refreshSession();
    supabase?.auth.onAuthStateChange(event => {
      if(event==='PASSWORD_RECOVERY')emit({...state,recovery:true});
      setTimeout(refreshSession,0);
    });
  }
  return startPromise;
}
export function usePlatformSession() {
  useEffect(() => { startSession(); const check=()=>{ if (document.visibilityState==='visible') refreshSession(); }; document.addEventListener('visibilitychange',check); return ()=>document.removeEventListener('visibilitychange',check); },[]);
  return useSyncExternalStore(listener => { listeners.add(listener); return ()=>listeners.delete(listener); },()=>state,()=>state);
}
export async function logout() {
  revision++;
  emit({loading:false,user:null,error:'',recovery:false,notice:''});
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
export async function platformAccountRequest(path,body,method='POST'){
  const {data:{session}}=await supabase.auth.getSession();
  const response=await fetch('/api/platform'+path,{
    method,headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},
    body:JSON.stringify(body),
  });
  let result;try{result=await response.json();}catch{throw new Error('El servicio de acceso no está disponible.');}
  if(!response.ok)throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}
export async function loginWithPassword(username,password){
  const tokens=await platformAccountRequest('/login',{username,password});
  const {error}=await supabase.auth.setSession(tokens);
  if(error)throw error;
  await refreshSession();
}
export const requestPasswordRecovery=identifier=>platformAccountRequest('/recover',{identifier});
function clearRecoveryLocation(){
  if(typeof window==='undefined')return;
  const url=new URL(window.location.href);
  url.searchParams.delete('recuperar');url.searchParams.delete('code');url.hash='';
  window.history.replaceState(null,'',url.pathname+url.search);
}
export async function saveRecoveredPassword(password,confirmation){
  if(!state.recovery || !state.user)throw new Error('El enlace no es válido o ha vencido. Solicita uno nuevo.');
  if(password.length<10 || password.length>128)throw new Error('La contraseña debe tener entre 10 y 128 caracteres.');
  if(password!==confirmation)throw new Error('Las contraseñas no coinciden.');
  const {error}=await supabase.auth.updateUser({password});
  if(error)throw new Error(error.code==='same_password'?'Elige una contraseña diferente a la anterior.':'No se pudo guardar la contraseña. Solicita otro enlace e inténtalo de nuevo.');
  clearRecoveryLocation();
  await logout();
  emit({...state,notice:'Contraseña actualizada. Ya puedes entrar con tu usuario y la nueva contraseña.'});
}
export async function cancelPasswordRecovery(){
  clearRecoveryLocation();
  await logout();
}
