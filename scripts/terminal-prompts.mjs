import {createInterface} from 'node:readline';
import {stdin,stdout} from 'node:process';
export function prompts(){
  let rl=createInterface({input:stdin,output:stdout,terminal:true});
  return {
    ask:prompt=>new Promise(resolve=>rl.question(prompt,resolve)),
    hidden:(prompt,{mask=false}={})=>new Promise((resolve,reject)=>{
      if(!stdin.isTTY || !stdin.setRawMode){reject(new Error('Usa la terminal interactiva de VS Code.'));return;}
      rl.close();stdout.write(prompt);stdin.resume();let value='';
      const finish=(error)=>{
        stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n');
        rl=createInterface({input:stdin,output:stdout,terminal:true});
        error?reject(error):resolve(value);
      };
      const onData=chunk=>{
        for(const char of String(chunk)){
          if(char==='\r' || char==='\n'){finish();return;}
          if(char==='\u0003'){finish(new Error('Operación cancelada.'));return;}
          if(char==='\u007f' || char==='\b'){
            if(value){value=Array.from(value).slice(0,-1).join('');if(mask)stdout.write('\b \b');}
          }else{
            value+=char;
            if(mask)stdout.write('*');
          }
        }
      };
      stdin.setRawMode(true);stdin.on('data',onData);
    }),
    close:()=>rl.close(),
  };
}
