import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
process.on('uncaughtException', (error) => {
  console.error(error.message, error.query || '', error.where || '', error.actual ?? '', error.expected ?? '');
  process.exit(1);
});

const db = new PGlite({ extensions: { btree_gist } });
const owner = '10000000-0000-0000-0000-000000000001';
const leader = '10000000-0000-0000-0000-000000000002';
const outsider = '10000000-0000-0000-0000-000000000003';
const schema = await readFile(new URL('../supabase/migrations/20261103160000_complete_platform.sql', import.meta.url), 'utf8');
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon,authenticated;
  grant select,insert,update,delete on storage.objects to anon,authenticated;
`);
await db.query('insert into auth.users values($1,$2,now())', [owner, 'planetnodesarrolloguapi@gmail.com']);
await db.exec(await readFile(new URL('../supabase/migrations/20261016220000_community_forms.sql', import.meta.url), 'utf8'));
// Existing valid and incomplete records must both survive the migration.
await db.query("insert into community_forms(id,kind,payload) values('legacy-good','board_performance',$1),('legacy-incomplete','resume','{}')", [JSON.stringify({
  answers: { community: 'Limones', memberName: 'María', position: 'Fiscal 1', recordDate: '2026-10-10', rating: '4' },
})]);
try { await db.exec(schema); }
catch (error) { console.error('Migration failed:', error.message, error.position, error.query?.slice(-800)); await db.close(); process.exit(1); }

const as = async (role, uid, work) => {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid || '']);
    const result = await work();
    await db.exec('commit');
    return result;
  } catch (error) { await db.exec('rollback'); throw error; }
};
const count = async (table) => Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
const insertForm = (id, kind, payload) => db.query('insert into community_forms(id,kind,payload) values($1,$2,$3)', [id,kind,JSON.stringify(payload)]);
assert.equal(await count('community_forms'),2);
assert.equal(await count('board_evaluations'),1);
assert.equal(await count('migration_issues'),1);
assert.equal((await db.query('select active,role from profiles where id=$1',[owner])).rows[0].role,'superadmin');
await db.query("insert into auth.users values($1,'leader@example.com',now()),($2,'other@example.com',now())",[leader,outsider]);
await db.query("update profiles set role='community_leader',community_id='limones',active=true where id=$1",[leader]);
await assert.rejects(db.query("update profiles set role='community_leader',community_id='limones',active=true where id=$1",[outsider]), /one_active_leader/);
await as('anon',null,async () => {
  assert.equal(await count('communities'),8);
});
await assert.rejects(as('anon',null,()=>count('community_forms')),/permission denied/);
await assert.rejects(as('anon',null,()=>db.query('select * from profiles')),/permission denied/);
await as('authenticated',leader,async () => {
  assert.equal(await count('community_forms'),0);
  const result = await db.query("update profiles set role='superadmin' where id=$1 returning id",[leader]);
  assert.equal(result.rows.length,0);
});
await assert.rejects(as('anon',null,() => insertForm('bad-board','board_performance',{ answers: {
  community:'Limones',memberName:'Ana',position:'Fiscal 1',recordDate:'2026-11-01',rating:'8'
}})));
await as('anon',null,() => insertForm('public-note','participation_note',{answers:{
  community:'600 · Limones',participantName:'Persona',eventDate:'2026-11-01',facts:'Prueba'
}}));
assert.equal(await count('participation_notes'),1);
await assert.rejects(as('anon',null,()=>count('community_forms')),/permission denied/);
await as('authenticated',owner,async () => assert.equal(await count('community_forms'),3));

// Four families share one dwelling; an identical dwelling code in another community is separate.
for (let index=1;index<=4;index++) {
  await as('authenticated',owner,() => db.query('insert into census_records(id,answers) values($1,$2)',[
    'person-'+index,JSON.stringify({community:'Limones',householdCode:'1',familyCode:'1.'+index,firstName:'Persona',documentNumber:'123'+index}),
  ]));
}
await as('authenticated',owner,() => db.query("insert into census_records(id,answers) values('other-person',$1)",[
  JSON.stringify({community:'Santa Rosa',householdCode:'1',familyCode:'1.1',firstName:'Otra'}),
]));
assert.equal(await count('dwellings'),2);
assert.equal(await count('families'),5);
await as('authenticated',leader,async () => assert.equal(await count('census_records'),4));
await assert.rejects(as('authenticated',leader,() => db.query("update census_records set answers=answers || '{\"firstName\":\"Cambio\"}' where id='person-1' returning id").then((result) => { assert.equal(result.rows.length,1); })));

const makeTeacher = (name,statuses=['full','full','absent','full','full']) => ({
  teacherName:name,teacherId:'local-'+name,community:'Limones',site:'Sede Central',grades:'1',
  periodStart:'2026-10-05',periodEnd:'2026-10-09',status:'Pendiente',
  attendance:statuses.map((status,index)=>({date:'2026-10-0'+(index+5),scheduled:true,status})),
  performance:{ratings:{punctuality:'5',clarity:'NO',classes:'5',students:'5',communication:'5',commitment:'5'}}
});
const ana=makeTeacher('Ana');
await as('anon',null,()=>insertForm('teacher-a','teacher_evaluation',ana));
await as('anon',null,()=>insertForm('teacher-b','teacher_evaluation',makeTeacher('Beto',['full','full','full','full','full'])));
assert.equal(await count('teacher_attendance'),10);
await assert.rejects(as('anon',null,()=>insertForm('duplicate-teacher','teacher_evaluation',{...ana,teacherName:' ÁNA '})),/exclusion|conflict|duplicate/i);
await assert.rejects(as('anon',null,()=>insertForm('verified-by-public','teacher_evaluation',{...ana,teacherName:'Otra',status:'Verificado'})),/row-level security/i);
await as('authenticated',owner,async()=>assert.equal(await count('teacher_monthly_ranking'),0));
await as('authenticated',owner,()=>db.query("update community_forms set payload=jsonb_set(payload,'{status}','\"Verificado\"') where id in ('teacher-a','teacher-b')"));
await as('authenticated',owner,async()=>{
  const rows=(await db.query('select * from teacher_monthly_ranking order by council_rank')).rows;
  assert.equal(rows[0].full_name,'Beto');
  assert.equal(Number(rows[1].average_score),5);
  assert.equal(Number(rows[1].absence_days),1);
  assert.equal(Number(rows[1].full_attendance_percentage),80);
  assert.equal(await count('teacher_annual_ranking'),2);
});
const reviewedBefore = (await db.query("select reviewed_by,reviewed_at from teacher_evaluations where form_id='teacher-a'")).rows[0];
await assert.rejects(as('authenticated',owner,()=>db.query('update community_forms set payload=$1 where id=$2',[
  JSON.stringify({...makeTeacher('Ana',['','','','','']),status:'Verificado'}),'teacher-a'
])),/pendientes/);
assert.equal(await count('teacher_attendance'),10);
await as('authenticated',leader,async()=>assert.equal(await count('teacher_monthly_metrics'),0));
await as('anon',null,()=>db.query("insert into contact_requests(name,contact,subject,message) values('Prueba','correo@example.com','Consulta','Mensaje')"));
await assert.rejects(as('anon',null,()=>db.query('select * from contact_requests')));
await as('authenticated',owner,()=>db.query("insert into storage.objects(bucket_id,name) values('guajui-private','documento.pdf')"));
await as('anon',null,async()=>assert.equal(await count('storage.objects'),0));
assert((await count('audit_log'))>0);

await as('authenticated',owner,()=>db.query("insert into community_meetings values('meeting-1','Asamblea','2026-11-01','Revisar avances','Limones',now())"));
await as('anon',null,()=>insertForm('attendance-1','meeting_attendance',{answers:{
  meetingId:'meeting-1',contactName:'Asistente',contactPhone:'3000000000',conclusions:'Continuar',
  topics:['Agua','agua','Educación'],agreements:['Primero','Segundo']
}}));
assert.equal(await count('meeting_topics'),2);
assert.equal(await count('meeting_agreements'),2);
await as('anon',null,()=>insertForm('resume-valid','resume',{
  fullName:'Persona',community:'Juanico',residence:'Guapi',documentNumber:'12345',phone:'3000000000',email:'persona@example.com',
  education:[{level:'Técnico',institution:'Instituto',completionMonth:'2025-06',inProgress:false}],
  workExperience:[{role:'Auxiliar',organization:'Consejo',place:'Guapi',startMonth:'2026-01',current:true}]
}));
assert.equal(await count('resume_education'),1);
assert.equal(await count('resume_experience'),1);
await as('authenticated',owner,()=>db.query("insert into surveys(id,title,status) values('open','Encuesta abierta','published'),('draft','Borrador','draft')"));
await as('anon',null,()=>db.query("insert into survey_responses(id,survey_id,answers) values('response-open','open','{}')"));
await assert.rejects(as('anon',null,()=>db.query("insert into survey_responses(id,survey_id,answers) values('response-draft','draft','{}')")),/row-level security/);
await as('authenticated',leader,()=>db.query("insert into content_items(id,title,kind,community_id,status) values('leader-news','Noticia','Noticia','limones','Aprobada')"));
await assert.rejects(as('authenticated',leader,()=>db.query("insert into content_items(id,title,kind,community_id,status) values('wrong-news','Noticia','Noticia','santa-rosa','Aprobada')")),/row-level security/);
await as('authenticated',owner,()=>db.query("insert into content_items(id,title,kind,status) values('draft-news','Borrador','Noticia','Borrador')"));
await as('anon',null,async()=>assert.equal(await count('content_items'),1));
await as('authenticated',leader,()=>db.query("insert into census_requests(id,record_id,is_new,changes) values('request-1','new-person',true,$1)",[
  JSON.stringify({community:'Limones',householdCode:'1',familyCode:'1.5',firstName:'Nueva'}),
]));
await assert.rejects(as('authenticated',leader,()=>db.query("insert into census_requests(id,record_id,is_new,community_id,changes) values('forged-request','wrong-person',true,'limones',$1)",[
  JSON.stringify({community:'Santa Rosa',firstName:'Otra'}),
])),/row-level security/);
await assert.rejects(as('authenticated',leader,()=>db.query("select decide_census_request('request-1','Aprobada')")),/autorización/);
await as('authenticated',owner,()=>db.query("select decide_census_request('request-1','Aprobada')"));
await assert.rejects(as('authenticated',owner,()=>db.query("select decide_census_request('request-1','Aprobada')")),/resuelta/);
assert.equal(await count('families'),6);
const certificate = await as('authenticated',owner,()=>db.query("insert into certificates(record_id,holder_name,masked_document,community_id) values('person-1','Falso','123456','santa-rosa') returning verification_code"));
await as('anon',null,async()=>{
  const result = await db.query('select * from verify_community_certificate($1)',[certificate.rows[0].verification_code]);
  assert.equal(result.rows[0].holder_name,'Persona');
  assert.equal(result.rows[0].community,'Limones');
  assert(!result.rows[0].masked_document.includes('1231'));
});

// Re-running the migration must preserve records and not duplicate projections.
await db.exec(schema);
assert.equal(await count('teacher_attendance'),10);
assert.deepEqual((await db.query("select reviewed_by,reviewed_at from teacher_evaluations where form_id='teacher-a'")).rows[0], reviewedBefore);
assert.equal(await count('board_evaluations'),1);
assert.equal(await count('migration_issues'),1);
// An installation with the old census/platform migrations must also upgrade.
const legacyDb = new PGlite({ extensions: { btree_gist } });
await legacyDb.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
`);
for (const filename of ['20260910173000_initial_census.sql','20260919090000_platform_data.sql','20261016220000_community_forms.sql']) {
  const sql = await readFile(new URL('../supabase/migrations/'+filename,import.meta.url),'utf8');
  await legacyDb.exec(sql.replace('create extension if not exists pgcrypto;',''));
}
await legacyDb.query('insert into auth.users values($1,$2,now())',[owner,'planetnodesarrolloguapi@gmail.com']);
await legacyDb.query("insert into profiles(id,username,role) values($1,'legacy-admin','superadmin')",[owner]);
await legacyDb.exec(schema);
assert.equal((await legacyDb.query('select active from profiles where id=$1',[owner])).rows[0].active,true);
await legacyDb.close();
// Restringir la plataforma a los tres perfiles y probar el alta por correo.
const threeRoles=await readFile(new URL('../supabase/migrations/20261103190000_three_roles.sql',import.meta.url),'utf8');
await db.exec(threeRoles);
await as('anon',null,async()=>assert.equal((await db.query('select platform_access_ready() as ready')).rows[0].ready,true));
await assert.rejects(as('authenticated',leader,()=>db.query("select set_platform_access('intruso@example.com','superadmin',null,true)")),/superadministrador/);
await as('authenticated',owner,()=>db.query("select set_platform_access('nuevo-encuestador@example.com','enumerator','limones',true)"));
const enumerator='10000000-0000-0000-0000-000000000004';
await db.query("insert into auth.users values($1,'nuevo-encuestador@example.com',now())",[enumerator]);
assert.equal((await db.query('select role,active from profiles where id=$1',[enumerator])).rows[0].role,'enumerator');
await as('authenticated',enumerator,async()=>{
  assert.equal(await count('census_records'),5);
  assert.equal((await db.query("select count(*) as n from census_records where community_id='santa-rosa'")).rows[0].n,0);
});
await assert.rejects(as('authenticated',owner,()=>db.query("select set_platform_access('otro-lider@example.com','community_leader','limones',true)")),/one_responsible_email/);
await assert.rejects(as('authenticated',owner,()=>db.query("select set_platform_access('otro-rol@example.com','communications',null,true)")),/check constraint/);
await assert.rejects(as('authenticated',enumerator,()=>db.query("update profiles set role='superadmin' where id=$1",[enumerator])),/permission denied/);
await assert.rejects(as('anon',null,()=>db.query("insert into census_requests(id,record_id,is_new,changes) values('public-census','public-person',true,'{}')")),/permission denied/);
const beforeBatch=await count('census_requests');
await assert.rejects(as('authenticated',enumerator,()=>db.query('select * from submit_census_batch($1)',[JSON.stringify([
  {id:'valid-in-batch',recordId:'new-valid',isNew:true,changes:{community:'Limones'}},
  {id:'forged-in-batch',recordId:'new-forged',isNew:true,changes:{community:'Santa Rosa'}}
])])),/row-level security/);
assert.equal(await count('census_requests'),beforeBatch);
await as('authenticated',enumerator,()=>db.query('select * from submit_census_batch($1)',[JSON.stringify([
  {id:'enumerator-request',recordId:'fresh-person',isNew:true,changes:{community:'Limones',householdCode:'2',familyCode:'2.1',firstName:'Nueva'}}
])]));
await assert.rejects(as('authenticated',enumerator,()=>db.query("select decide_census_request('enumerator-request','Aprobada')")),/superadministrador/);
await as('authenticated',owner,()=>db.query("select decide_census_request('enumerator-request','Aprobada')"));
const publication={id:'proposal-new',title:'Propuesta local',kind:'Noticia',status:'En revisión',communityId:'limones',section:'Limones',body:'Texto'};
await as('authenticated',leader,()=>db.query('select save_publication($1)',[JSON.stringify(publication)]));
await assert.rejects(as('authenticated',leader,()=>db.query('select save_publication($1)',[JSON.stringify({...publication,status:'Aprobada'})])),/aprobar/);
await as('authenticated',owner,()=>db.query('select save_publication($1)',[JSON.stringify({...publication,status:'Aprobada'})]));
await assert.rejects(as('authenticated',leader,()=>db.query('select save_publication($1)',[JSON.stringify({...publication,body:'Cambiar publicación aprobada'})])),/modificar/);
await as('authenticated',owner,()=>db.query("select set_platform_access('nuevo-encuestador@example.com','enumerator','limones',false)"));
await as('authenticated',enumerator,async()=>assert.equal(await count('census_records'),0));
const uninvited='10000000-0000-0000-0000-000000000005';
await db.query("insert into auth.users values($1,'sin-acceso@example.com',now())",[uninvited]);
assert.equal((await db.query('select active from profiles where id=$1',[uninvited])).rows[0].active,false);
await as('authenticated',uninvited,async()=>assert.equal(await count('census_records'),0));
await assert.rejects(as('authenticated',uninvited,()=>db.query('select save_publication($1)',[JSON.stringify(publication)])),/denegado/);
await assert.rejects(as('authenticated',owner,()=>db.query("select set_platform_access('planetnodesarrolloguapi@gmail.com','superadmin',null,false)")),/propio acceso/);
await as('authenticated',owner,()=>db.query("insert into surveys(id,title,status) values('scoped-survey','Encuesta','published')"));
await assert.rejects(as('authenticated',leader,()=>db.query("insert into survey_responses(id,survey_id,community_id,answers) values('forged-survey','scoped-survey','limones',$1)",[JSON.stringify({community:'Santa Rosa'})])),/row-level security/);
await as('authenticated',owner,()=>db.query('select save_publication($1)',[JSON.stringify({id:'future-event',title:'Evento',kind:'Evento',status:'Aprobada',startsAt:'2099-01-01T12:00:00Z',place:'Limones'})]));
await as('anon',null,()=>db.query("insert into event_registrations(event_id,name,phone,document_number) values('future-event','Asistente','3000000000','123')"));
await assert.rejects(as('anon',null,()=>db.query('select * from event_registrations')),/permission denied/);
await db.exec(await readFile(new URL('../supabase/migrations/20261104120000_username_password.sql',import.meta.url),'utf8'));
assert.equal((await db.query('select username from profiles where id=$1',[owner])).rows[0].username,'admin');
await assert.rejects(as('authenticated',owner,()=>db.query("select configure_platform_user('otro@example.com','otro','superadmin',null,true)")),/permission denied/);
await assert.rejects(as('anon',null,()=>db.query("select configure_platform_user('otro@example.com','otro','superadmin',null,true)")),/permission denied/);
await as('service_role',null,()=>db.query("select configure_platform_user('nuevo@login.guajui.invalid','nuevo','enumerator','limones',true)"));
await assert.rejects(as('service_role',null,()=>db.query("select configure_platform_user('otra@login.guajui.invalid','nuevo','enumerator','limones',true)")),/platform_login_username_unique/);
await assert.rejects(as('service_role',null,()=>db.query("select configure_platform_user('intruso@example.com','admin','superadmin',null,true)")),/reservado/);
await assert.rejects(as('service_role',null,()=>db.query("select configure_platform_user('espacios@example.com','usuario espacios','enumerator','limones',true)")),/inválido/);
const passwordColumns=await db.query("select column_name from information_schema.columns where table_schema='public' and table_name in ('profiles','access_grants') and column_name like '%password%'");
assert.equal(passwordColumns.rows.length,0);
console.log('OK: esquema completo, tres roles, usuarios únicos, operaciones de credenciales reservadas al servidor y permisos de datos.');
await db.exec(await readFile(new URL('../supabase/migrations/20261104130000_enumerator_only_public_census_lookup.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261104230000_census_insert_permissions.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261104240000_direct_enumerator_census.sql',import.meta.url),'utf8'));
await assert.rejects(as('authenticated',owner,()=>db.query("insert into census_requests(id,record_id,changes,is_new) values('admin-direct','admin-person','{}',true)")),/row-level security/);
for (const uid of [owner,leader]) {
  await assert.rejects(as('authenticated',uid,()=>db.query('select * from submit_census_batch($1)',[JSON.stringify([{id:'denied',isNew:true,recordId:'denied',changes:{community:'Limones'}}])])),/encuestador/);
}
await as('service_role',null,()=>db.query("select configure_platform_user('nuevo-encuestador@example.com','encuestador-prueba','enumerator','limones',true)"));
await as('authenticated',enumerator,()=>db.query('select * from submit_census_batch($1)',[JSON.stringify([{id:'direct-person',recordId:'direct-person',isNew:true,changes:{community:'Limones',householdCode:'direct-home',familyCode:'direct-family',firstName:'Prueba',documentNumber:'99887766'}}])]));
assert.equal((await db.query("select community_id from census_records where id='direct-person'")).rows[0].community_id,'limones');
await as('anon',null,async()=>{
  assert.equal((await db.query("select * from lookup_census_presence('99887766','limones')")).rows[0].in_census,true);
  assert.equal((await db.query("select * from lookup_census_presence('99887766','concepcion')")).rows[0].in_census,false);
});
console.log('OK: últimas migraciones, altas exclusivas del encuestador, aprobación y consulta pública por comunidad.');
await db.close();
