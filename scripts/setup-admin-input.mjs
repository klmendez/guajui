import {validatePassword} from '../server/platform-auth.mjs';

export async function readAdminPassword(terminal,report=console.log){
  report('Elige una contraseña de 10 a 128 caracteres. Verás asteriscos al escribir; pulsa Enter para confirmar.');
  while(true){
    const password=await terminal.hidden('Nueva contraseña para el usuario admin: ',{mask:true});
    try{validatePassword(password);}
    catch(error){
      report(`Se recibieron ${password.length} caracteres. ${error.message} Inténtalo de nuevo.`);
      continue;
    }
    if(password!==await terminal.hidden('Repite la contraseña: ',{mask:true})){
      report('Las contraseñas no coinciden. Vuelve a definirlas.');
      continue;
    }
    return password;
  }
}
