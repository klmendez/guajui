import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import pg from 'pg';

const projectRef = 'iibbavjuqescenbwonfp';
const fullPlatform = process.argv.includes('--platform');
const dryRun = process.argv.includes('--dry-run');
const baseMigration = new URL('../supabase/migrations/20261016220000_community_forms.sql', import.meta.url);
const platformMigration = new URL('../supabase/migrations/20261103160000_complete_platform.sql', import.meta.url);
const accessMigration = new URL('../supabase/migrations/20261103190000_three_roles.sql', import.meta.url);
const passwordMigration = new URL('../supabase/migrations/20261104120000_username_password.sql', import.meta.url);
const censusLookupMigration = new URL('../supabase/migrations/20261104130000_enumerator_only_public_census_lookup.sql', import.meta.url);
const directEnumeratorCensusMigration = new URL('../supabase/migrations/20261104240000_direct_enumerator_census.sql', import.meta.url);
const rl = createInterface({ input: stdin, output: stdout, terminal: true });

const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
const askHidden = (prompt) => new Promise((resolve, reject) => {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    reject(new Error('Abre una terminal interactiva de VS Code para introducir la contraseña.'));
    return;
  }
  rl.close();
  stdout.write(prompt);
  stdin.resume();
  let value = '';
  const finish = () => {
    stdin.off('data', onData);
    stdin.setRawMode(false);
    stdin.pause();
    stdout.write('\n');
    resolve(value);
  };
  const onData = (chunk) => {
    for (const character of String(chunk)) {
      if (character === '\r' || character === '\n') { finish(); return; }
      if (character === '\u0003') { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); reject(new Error('Operación cancelada.')); return; }
      if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
      else value += character;
    }
  };
  stdin.setRawMode(true);
  stdin.on('data', onData);
});

let client;
try {
  console.log(fullPlatform ? 'Instalación: estructura completa de la plataforma.' : 'Instalación: formularios comunitarios.');
  if (dryRun) console.log('Ensayo: se comprobará el SQL y se revertirán los cambios al finalizar.');
  console.log('Supabase → Connect → Session pooler → copia la cadena de conexión.');
  console.log('Pega la plantilla con [YOUR-PASSWORD]; la contraseña se pedirá aparte.');
  const template = (await ask('Cadena de conexión: ')).trim();
  const url = new URL(template);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname.endsWith('.pooler.supabase.com') ||
      url.username !== `postgres.${projectRef}` ||
      url.port !== '5432' ||
      url.pathname !== '/postgres') {
    throw new Error('La cadena debe ser la de Session pooler (puerto 5432) del proyecto iibbavjuqescenbwonfp.');
  }
  const password = await askHidden('Contraseña de la base de datos (oculta): ');
  if (!password) throw new Error('No se recibió la contraseña.');
  url.password = password;
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set('uselibpqcompat', 'true');
  rl.close();

  client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
  await client.connect();
  await client.query('begin');
  let pendingIssues = 0;
  try {
    await client.query("set local lock_timeout = '10s'");
    await client.query("set local statement_timeout = '120s'");
    await client.query("select pg_advisory_xact_lock(hashtext('guajui_schema_install'))");
    const base = await client.query("select to_regclass('public.community_forms') as forms, to_regclass('public.community_meetings') as meetings");
    if (!base.rows[0].forms || !base.rows[0].meetings) {
      await client.query(await readFile(baseMigration, 'utf8'));
    }
    if (fullPlatform) {
      const versionTable = await client.query("select to_regclass('public.app_schema_versions') as name");
      const installed = versionTable.rows[0].name
        ? (await client.query("select 1 from public.app_schema_versions where version='20261103160000'")).rowCount > 0
        : false;
      if (!installed) await client.query(await readFile(platformMigration, 'utf8'));
      else console.log('La ampliación ya está instalada; se comprobará su estructura.');
      const accessInstalled=(await client.query("select 1 from public.app_schema_versions where version='20261103190000'")).rowCount>0;
      if (!accessInstalled) {
        console.log('Aplicando los tres perfiles autorizados y las funciones de la plataforma.');
        await client.query(await readFile(accessMigration,'utf8'));
      }
      const passwordInstalled=(await client.query("select 1 from public.app_schema_versions where version='20261104120000'")).rowCount>0;
      if(!passwordInstalled){
        console.log('Aplicando el ingreso con usuario y contraseña.');
        await client.query(await readFile(passwordMigration,'utf8'));
      }
      const censusLookupInstalled=(await client.query("select 1 from public.app_schema_versions where version='20261104130000'")).rowCount>0;
      if(!censusLookupInstalled){
        console.log('Aplicando permisos de censo y consulta pública de certificados.');
        await client.query(await readFile(censusLookupMigration,'utf8'));
      }
      if (!(await client.query("select 1 from public.app_schema_versions where version='20261104230000'")).rowCount) {
        console.log('Aplicando restricción de altas censales al encuestador.');
        await client.query(await readFile(new URL('../supabase/migrations/20261104230000_census_insert_permissions.sql', import.meta.url), 'utf8'));
      }
      if (!(await client.query("select 1 from public.app_schema_versions where version='20261104240000'")).rowCount) {
        console.log('Aplicando registro directo del censo para encuestadores.');
        await client.query(await readFile(directEnumeratorCensusMigration, 'utf8'));
      }
      const expected = ['communities','profiles','dwellings','families','census_records','census_requests',
        'certificates','content_items','surveys','survey_responses','contact_requests','teacher_evaluations',
        'teacher_attendance','teacher_scores','resumes','board_evaluations','audit_log','migration_issues','access_grants','event_registrations'];
      const structure = await client.query(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[]) and c.relrowsecurity",
        [expected],
      );
      if (structure.rowCount !== expected.length) throw new Error('Faltan tablas o políticas RLS; se revertirá la instalación.');
      pendingIssues = (await client.query("select count(*) as pending from public.migration_issues")).rows[0].pending;
    }
    const verified = await client.query("select to_regclass('public.community_forms') as forms, to_regclass('public.community_meetings') as meetings");
    if (!verified.rows[0].forms || !verified.rows[0].meetings) throw new Error('No se encontraron las tablas después de ejecutar el SQL.');
    await client.query(dryRun ? 'rollback' : 'commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
  console.log(dryRun ? 'Ensayo correcto. No se guardaron los cambios.' : 'Listo: tablas verificadas en el proyecto correcto.');
  if (fullPlatform && !dryRun) {
    console.log('Estructura completa instalada. Registros antiguos pendientes de revisión:', pendingIssues);
    console.log('Accesos habilitados: superadministrador, encuestador y un responsable por comunidad.');
    console.log('No se importaron registros anteriores del navegador.');
    console.log('Si todavía no has definido la contraseña de admin, ejecuta npm run admin:setup.');
  }
} catch (error) {
  console.error('No se pudo aplicar el esquema:', error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  if (client) await client.end().catch(() => {});
}
