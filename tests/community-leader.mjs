// Contratos del frontend: solo datos remotos y tres perfiles autorizados.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
  export * from './src/data/communities.js';
  export * from './src/data/teacherEvaluationStore.js';
  export * from './src/data/platformStore.js';
  export * from './src/data/censusStore.js';
  export * from './src/data/adminUserStore.js';
  export * from './src/data/resumeStore.js';
  export * from './src/data/surveyStore.js';
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
// Write beside the project so external imports resolve; never read localStorage.
const {writeFile,unlink}=await import('node:fs/promises');
const temp=new URL('../.frontend-contract-test.mjs',import.meta.url);
await writeFile(temp,bundle.outputFiles[0].text);
try{
 const api=await import(temp.href+'?'+Date.now());
 assert.deepEqual(Object.keys(api.roles),['superadmin','enumerator','community_leader']);
 assert.equal(api.getAdminSession(),null);
 assert.equal(api.getCensusRecords().length,0);
 assert.equal(api.getSurveys().length,0);
 assert.equal(api.getResumes().length,0);
 assert(api.sameCommunity('7001 · Quiroga 2','Quiroga'));
 assert.equal(api.communityId('600 · Limones / El Carmen'),'limones');
 assert.equal(api.communityId('Joanico'),'juanico');
 const days=api.generateSchoolDays('2026-10-05','2026-10-09');
 assert.equal(api.attendanceSummary(days).pending,5);
 days.forEach((day,index)=>{day.status=index===4?'absent':'full';});
 assert.equal(api.attendanceSummary(days).percentage,80);
 assert.throws(()=>api.generateSchoolDays('2026-10-05','2027-01-01'));
 assert.equal(api.workDurationMonths('2025-01','2025-06'),6);
 console.log('OK: tres perfiles, inicio sin datos locales, comunidades y cálculos.');
}finally{await unlink(temp);}
