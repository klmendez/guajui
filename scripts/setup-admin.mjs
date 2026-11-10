import {writeFile} from 'node:fs/promises';
import {authClients,readServerConfig,ownerEmail} from '../server/platform-auth.mjs';
import {prompts} from './terminal-prompts.mjs';
import {readAdminPassword} from './setup-admin-input.mjs';
const terminal=prompts();
const checked=result=>{if(result.error)throw result.error;return result.data;};
try{
  const config=await readServerConfig();
  console.log('Configuración inicial del superadministrador.');
  console.log('La clave secreta se obtiene en Supabase → Settings → API Keys → Secret keys.');
  config.secretKey=config.secretKey || (await terminal.hidden('Clave sb_secret_ de Supabase (oculta): ')).trim();
  if(!config.secretKey.startsWith('sb_secret_') || /\s/.test(config.secretKey))throw new Error('Introduce la Secret key de Supabase que comienza por sb_secret_.');
  const password=await readAdminPassword(terminal);
  const {admin}=authClients(config);
  const ready=await admin.rpc('configure_platform_user',{
    account_email:ownerEmail,account_username:'admin',account_role:'superadmin',account_community:null,account_active:true,
  });
  if(ready.error){
    if(['PGRST202','42883'].includes(ready.error.code))throw new Error('Primero instala la actualización con npm run db:apply.');
    throw new Error('No se pudo configurar el usuario. Comprueba que la Secret key pertenezca a este proyecto y tenga acceso administrativo.');
  }
  let existing;
  for(let page=1;!existing;page++){
    const {users}=checked(await admin.auth.admin.listUsers({page,perPage:100}));
    existing=users.find(user=>user.email?.toLowerCase()===ownerEmail);
    if(users.length<100)break;
  }
  if(existing)checked(await admin.auth.admin.updateUserById(existing.id,{password,email_confirm:true}));
  else checked(await admin.auth.admin.createUser({email:ownerEmail,password,email_confirm:true}));
  await writeFile(new URL('../.env.server.local',import.meta.url),
    'SUPABASE_URL='+config.url+'\nSUPABASE_SECRET_KEY='+config.secretKey+'\n',{mode:0o600});
  console.log('Listo. Usuario: admin');
  console.log('Contraseña: la que acabas de definir.');
  console.log('Abre /admin e ingresa con usuario y contraseña.');
}catch(error){
  console.error(error.message || 'No se pudo configurar el usuario.');
  process.exitCode=1;
}finally{terminal.close();}
