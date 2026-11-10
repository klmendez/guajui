import assert from 'node:assert/strict';
import {readAdminPassword} from '../scripts/setup-admin-input.mjs';

const password='Fixture password for setup';
const answers=['','corta','x'.repeat(129),password,'Different confirmation',password,password];
const messages=[];
const questions=[];
const result=await readAdminPassword({hidden:async(prompt,options)=>{
  assert.equal(options.mask,true);
  questions.push(prompt);
  assert.ok(answers.length,'No debe pedir más respuestas después de confirmar.');
  return answers.shift();
}},message=>messages.push(message));
assert.equal(result,password);
assert.equal(answers.length,0);
assert.equal(questions.length,7);
assert.ok(messages.some(message=>message.includes('0 caracteres')));
assert.ok(messages.some(message=>message.includes('5 caracteres')));
assert.ok(messages.some(message=>message.includes('129 caracteres')));
assert.ok(messages.some(message=>message.includes('no coinciden')));
assert.ok(messages.every(message=>!message.includes(password) && !message.includes('Different confirmation')));
await assert.rejects(readAdminPassword({hidden:async()=>{throw new Error('Operación cancelada.');}},()=>{}),/Operación cancelada/);
console.log('OK: la configuración permite corregir contraseñas vacías, cortas, largas o distintas sin salir ni mostrar su contenido.');
