-- Plataforma Guajuí. Aplicar después de 20261016220000_community_forms.sql.
-- Conserva community_forms como entrada compatible; deriva tablas consultables.
-- Ejecutar en una transacción (el instalador lo hace automáticamente).
create extension if not exists btree_gist;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists public.app_schema_versions (
  version text primary key,
  installed_at timestamptz not null default now()
);

create or replace function public.normalized_label(value text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(lower(translate(trim(coalesce(value,'')),
    'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')), '\s+', ' ', 'g');
$$;

create table if not exists public.communities (
  id text primary key,
  name text not null unique,
  census_code text not null unique,
  active boolean not null default true
);
insert into public.communities(id,name,census_code) values
 ('concepcion','Concepción','100'),('santa-rosa','Santa Rosa','200'),
 ('san-antonio','San Antonio','300'),('san-jose','San José','400'),
 ('el-carmelo','El Carmelo','500'),('limones','Limones','600'),
 ('quiroga','Quiroga','700'),('juanico','Juanico','800')
on conflict(id) do nothing;
create table if not exists public.community_localities (
  code text primary key,
  community_id text not null references public.communities(id),
  name text not null,
  unique(code,community_id)
);
insert into public.community_localities(code,community_id,name) values
 ('100','concepcion','Concepción'),('200','santa-rosa','Santa Rosa'),
 ('300','san-antonio','San Antonio'),('400','san-jose','San José'),
 ('4001','san-jose','Las Brisas'),('500','el-carmelo','El Carmelo'),
 ('600','limones','Limones'),('601','limones','El Carmen'),
 ('700','quiroga','Quiroga 1'),('7001','quiroga','Quiroga 2'),
 ('703','quiroga','La Isla'),('800','juanico','Juanico'),('802','juanico','Juanico')
on conflict(code) do nothing;

create or replace function public.resolve_community(value text)
returns text language sql stable set search_path = public as $$
  select id from public.communities
  where public.normalized_label(name) =
    case when split_part(regexp_replace(public.normalized_label(value), '^\d+\s*·\s*', ''), '/', 1) ~ '^(joanico|junico|juanico)\s*$'
    then 'juanico'
    else trim(regexp_replace(split_part(regexp_replace(public.normalized_label(value), '^\d+\s*·\s*', ''), '/', 1), '\s+[12]\s*$', '')) end
    or id = value
  limit 1;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'reviewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists community_id text references public.communities(id);
alter table public.profiles add column if not exists active boolean not null default false;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'superadmin','council','census','enumerator','community_leader','communications',
  'chirimias','youth','women','elders','teacher','reviewer'
));
alter table public.profiles drop constraint if exists leader_requires_community;
alter table public.profiles add constraint leader_requires_community check(role <> 'community_leader' or community_id is not null);
create unique index if not exists one_active_leader_per_community
  on public.profiles(community_id) where role = 'community_leader' and active;

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active;
$$;
create or replace function public.current_app_community()
returns text language sql stable security definer set search_path = public as $$
  select community_id from public.profiles where id = auth.uid() and active;
$$;
create or replace function public.is_guajui_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'superadmin',false);
$$;
create or replace function public.can_read_census(target_community text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('superadmin','council','census')
    or (public.current_app_role() in ('enumerator','community_leader')
      and target_community = public.current_app_community()),false);
$$;
revoke all on function public.current_app_role(), public.current_app_community(),
  public.is_guajui_owner(), public.can_read_census(text) from public;
grant execute on function public.current_app_role(), public.current_app_community(),
  public.is_guajui_owner(), public.can_read_census(text) to anon, authenticated;

-- El correo inicial solo sirve para crear el primer perfil. Después mandan los roles.
insert into public.profiles(id,username,role,active)
select id,'admin-' || id::text,'superadmin',true from auth.users
where lower(email) = 'planetnodesarrolloguapi@gmail.com' and email_confirmed_at is not null
  and not exists(select 1 from public.app_schema_versions where version='20261103160000')
on conflict(id) do update set role='superadmin',active=true;
create or replace function app_private.bootstrap_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null then
    insert into public.profiles(id,username,role,active)
    values(new.id, 'usuario-' || new.id::text,
      case when lower(new.email) = 'planetnodesarrolloguapi@gmail.com' then 'superadmin' else 'reviewer' end,
      lower(new.email) = 'planetnodesarrolloguapi@gmail.com')
    on conflict(id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists guajui_profile_on_confirmation on auth.users;
create trigger guajui_profile_on_confirmation after insert or update of email_confirmed_at
  on auth.users for each row execute function app_private.bootstrap_profile();

create table if not exists public.dwellings (
  id uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities(id),
  locality_code text,
  code text not null check(length(trim(code)) > 0),
  address text,
  created_at timestamptz not null default now(),
  unique(community_id,code),
  unique(id,community_id),
  foreign key(locality_code,community_id) references public.community_localities(code,community_id)
);
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  dwelling_id uuid not null,
  community_id text not null references public.communities(id),
  code text not null check(length(trim(code)) > 0),
  hectares numeric check(hectares >= 0),
  created_at timestamptz not null default now(),
  foreign key(dwelling_id,community_id) references public.dwellings(id,community_id),
  unique(dwelling_id,code), unique(id,community_id)
);
create table if not exists public.census_records (
  id text primary key,
  survey_id text not null default 'censo-interno-guajui',
  answers jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.census_records add column if not exists community_id text references public.communities(id);
alter table public.census_records add column if not exists family_id uuid;
alter table public.census_records add column if not exists collected_by uuid references public.profiles(id);
alter table public.census_records add column if not exists archived_at timestamptz;
do $$ begin
  alter table public.census_records add constraint census_family_community_fk
    foreign key(family_id,community_id) references public.families(id,community_id);
exception when duplicate_object then null; end $$;
create index if not exists census_records_family_idx on public.census_records(family_id);
create index if not exists census_records_community_idx on public.census_records(community_id);
create index if not exists census_records_document_idx on public.census_records((answers->>'documentNumber'));
create table if not exists public.census_requests (
  id text primary key,
  record_id text not null,
  changes jsonb not null default '{}',
  missing_birth_date_access boolean not null default false,
  is_new boolean not null default false,
  status text not null default 'Pendiente' check(status in ('Pendiente','Aprobada','Rechazada')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.census_requests add column if not exists community_id text references public.communities(id);
alter table public.census_requests add column if not exists collected_by uuid references public.profiles(id);
alter table public.census_requests add column if not exists decided_by uuid references public.profiles(id);
alter table public.census_requests add column if not exists decision_notes text;
create index if not exists census_requests_status_community_idx on public.census_requests(status,community_id);
create table if not exists public.community_novelties (
  id uuid primary key default gen_random_uuid(),
  record_id text not null references public.census_records(id),
  community_id text not null references public.communities(id),
  kind text not null check(kind in ('death','birth','move','correction')),
  event_date date not null,
  notes text,
  status text not null default 'Pendiente' check(status in ('Pendiente','Verificado','Rechazado')),
  reported_by uuid not null default auth.uid() references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  verification_code uuid not null unique default gen_random_uuid(),
  record_id text not null references public.census_records(id),
  holder_name text not null,
  masked_document text not null,
  community_id text not null references public.communities(id),
  issued_by uuid not null default auth.uid() references public.profiles(id),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text
);

create table if not exists public.community_groups (
  id text primary key,
  name text not null,
  kind text not null check(kind in ('population','chirimia')),
  community_id text references public.communities(id),
  description text not null default '',
  contact_public text,
  published boolean not null default false
);
insert into public.community_groups(id,name,kind,published) values
 ('chirimias','Chirimías','population',true),('youth','Jóvenes','population',true),
 ('elders','Personas mayores','population',true),('women','Mujeres','population',true),
 ('teachers','Maestros Etnoeducadores','population',true),('others','Otros grupos','population',true)
on conflict(id) do nothing;
create table if not exists public.content_items (
  id text primary key,
  title text not null,
  kind text not null,
  section text not null default '',
  status text not null default 'Borrador',
  data jsonb not null default '{}',
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_items add column if not exists community_id text references public.communities(id);
alter table public.content_items add column if not exists group_id text references public.community_groups(id);
alter table public.content_items add column if not exists published_at timestamptz;
create index if not exists content_items_publication_idx on public.content_items(status,kind,published_at desc);
create table if not exists public.projects (
  content_id text primary key references public.content_items(id) on delete cascade,
  state text not null check(state in ('Formulación','En ejecución','Finalizado','Suspendido')),
  starts_on date, ends_on date,
  objective text, progress numeric not null default 0 check(progress between 0 and 100),
  check(ends_on is null or starts_on is null or ends_on >= starts_on)
);
create table if not exists public.agenda_events (
  content_id text primary key references public.content_items(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz,
  place text not null, check(ends_at is null or ends_at >= starts_at)
);
create table if not exists public.churo_editions (
  content_id text primary key references public.content_items(id) on delete cascade,
  edition_number text not null unique,
  publication_date date not null,
  document_path text not null
);
create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  sections jsonb not null default '[]' check(jsonb_typeof(sections) = 'array'),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_path text not null,
  title text,
  mime_type text,
  byte_size bigint check(byte_size >= 0),
  is_public boolean not null default false,
  uploaded_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(bucket_id,object_path)
);

create table if not exists public.surveys (
  id text primary key,
  title text not null,
  description text not null default '',
  closes_at date,
  status text not null default 'draft' check(status in ('draft','published','closed')),
  questions jsonb not null default '[]' check(jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.survey_responses (
  id text primary key,
  survey_id text not null references public.surveys(id),
  answers jsonb not null default '{}' check(jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default now(),
  submitted_by uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.survey_responses add column if not exists community_id text references public.communities(id);
create index if not exists survey_responses_survey_community_idx on public.survey_responses(survey_id,community_id);
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) > 0),
  contact text not null check(length(trim(contact)) > 0),
  subject text not null,
  message text not null check(length(trim(message)) > 0),
  status text not null default 'Pendiente' check(status in ('Pendiente','En atención','Resuelta')),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  operation text not null,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);
create table if not exists public.migration_issues (
  source_table text not null,
  source_id text not null,
  reason text not null,
  recorded_at timestamptz not null default now(),
  primary key(source_table,source_id)
);
create table if not exists public.app_schema_versions (
  version text primary key,
  installed_at timestamptz not null default now()
);

-- Cada formulario conserva su original y tiene una proyección con tipos y relaciones.
create table if not exists public.participation_notes (
  form_id text primary key references public.community_forms(id) on delete cascade,
  community_id text not null references public.communities(id),
  participant_name text not null check(length(trim(participant_name)) > 0),
  event_date date not null,
  facts text not null check(length(trim(facts)) > 0),
  possible_solution text
);
create table if not exists public.meeting_attendances (
  form_id text primary key references public.community_forms(id) on delete cascade,
  meeting_id text not null references public.community_meetings(id),
  contact_name text not null check(length(trim(contact_name)) > 0),
  contact_phone text not null check(length(trim(contact_phone)) > 0),
  institution text, organization text, position text, email text,
  conclusions text not null check(length(trim(conclusions)) > 0)
);
create index if not exists meeting_attendances_meeting_idx on public.meeting_attendances(meeting_id);
create table if not exists public.meeting_topics (
  attendance_id text not null references public.meeting_attendances(form_id) on delete cascade,
  label text not null check(length(trim(label)) > 0),
  normalized_name text generated always as (public.normalized_label(label)) stored,
  primary key(attendance_id,normalized_name)
);
create table if not exists public.meeting_agreements (
  attendance_id text not null references public.meeting_attendances(form_id) on delete cascade,
  position integer not null check(position > 0),
  description text not null check(length(trim(description)) > 0),
  primary key(attendance_id,position)
);
create table if not exists public.resumes (
  form_id text primary key references public.community_forms(id) on delete cascade,
  full_name text not null check(length(trim(full_name)) > 0),
  community_id text not null references public.communities(id),
  residence text not null, document_number text not null,
  phone text not null, email text not null
);
create index if not exists resumes_document_idx on public.resumes(document_number);
create table if not exists public.resume_education (
  resume_id text not null references public.resumes(form_id) on delete cascade,
  position integer not null,
  level text not null check(level in ('Bachillerato','Técnico','Pregrado','Posgrado','Doctorado')),
  institution text not null check(length(trim(institution)) > 0),
  place text, completion_month date, in_progress boolean not null default false,
  check(in_progress or completion_month is not null),
  primary key(resume_id,position)
);
create table if not exists public.resume_experience (
  resume_id text not null references public.resumes(form_id) on delete cascade,
  position integer not null,
  role text not null, organization text not null, place text,
  starts_on date not null, ends_on date, current_job boolean not null default false,
  check((current_job and ends_on is null) or (not current_job and ends_on >= starts_on)),
  primary key(resume_id,position)
);
create table if not exists public.board_positions (
  name text primary key
);
insert into public.board_positions(name) values ('Representante legal'),('Presidente'),
 ('Vicepresidente'),('Secretaria'),('Tesorero'),('Fiscal 1'),('Fiscal 2'),('Asesor')
on conflict do nothing;
create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(length(trim(full_name)) > 0),
  normalized_name text generated always as (public.normalized_label(full_name)) stored,
  position text not null references public.board_positions(name),
  starts_on date, ends_on date,
  check(ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index if not exists board_members_provisional_identity on public.board_members(normalized_name,position)
  where starts_on is null;
create table if not exists public.board_evaluations (
  form_id text primary key references public.community_forms(id) on delete cascade,
  community_id text not null references public.communities(id),
  member_id uuid not null references public.board_members(id),
  record_date date not null,
  rating smallint not null check(rating between 1 and 5),
  recommendations text
);
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities(id),
  name text not null check(length(trim(name)) > 0),
  normalized_name text generated always as (public.normalized_label(name)) stored,
  unique(community_id,normalized_name), unique(id,community_id)
);
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(length(trim(full_name)) > 0),
  normalized_name text generated always as (public.normalized_label(full_name)) stored,
  registry_community_id text not null references public.communities(id),
  created_at timestamptz not null default now(),
  unique(registry_community_id,normalized_name)
);
create table if not exists public.teacher_aliases (
  teacher_id uuid not null references public.teachers(id),
  alias text not null,
  primary key(teacher_id,alias)
);
create table if not exists public.teacher_criteria (
  id text primary key, label text not null
);
insert into public.teacher_criteria(id,label) values
 ('punctuality','Puntualidad y cumplimiento del horario'),
 ('clarity','Claridad en la enseñanza y explicación de los temas'),
 ('classes','Desarrollo de clases y actividades académicas'),
 ('students','Trato y acompañamiento a los estudiantes'),
 ('communication','Comunicación con familias y comunidad'),
 ('commitment','Compromiso con el proceso educativo')
on conflict do nothing;
create table if not exists public.teacher_evaluations (
  form_id text primary key references public.community_forms(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id),
  school_id uuid not null,
  community_id text not null references public.communities(id),
  grades text,
  period_start date not null, period_end date not null,
  status text not null check(status in ('Pendiente','Verificado')),
  absence_justification text check(absence_justification in ('official','none','unknown')),
  absence_notes text, strengths text, improvements text, observations text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  check(period_end >= period_start and period_end - period_start < 62),
  foreign key(school_id,community_id) references public.schools(id,community_id),
  unique(form_id,teacher_id,school_id),
  exclude using gist(teacher_id with =, school_id with =, daterange(period_start,period_end,'[]') with &&)
);
create table if not exists public.teacher_attendance (
  evaluation_id text not null,
  teacher_id uuid not null,
  school_id uuid not null,
  day date not null,
  scheduled boolean not null,
  status text check(status in ('full','partial','absent')),
  check(scheduled or status is null),
  foreign key(evaluation_id,teacher_id,school_id)
    references public.teacher_evaluations(form_id,teacher_id,school_id) on delete cascade,
  primary key(evaluation_id,day),
  unique(teacher_id,school_id,day)
);
create index if not exists teacher_attendance_day_idx on public.teacher_attendance(day,teacher_id);
create table if not exists public.teacher_scores (
  evaluation_id text not null references public.teacher_evaluations(form_id) on delete cascade,
  criterion_id text not null references public.teacher_criteria(id),
  score smallint check(score between 1 and 5),
  primary key(evaluation_id,criterion_id)
);

create or replace function app_private.project_community_form(form public.community_forms)
returns void language plpgsql security definer set search_path = public as $$
declare
  p jsonb := form.payload;
  a jsonb := coalesce(form.payload->'answers',form.payload);
  cid text;
  tid uuid;
  sid uuid;
  mid uuid;
  first_day date;
  last_day date;
  criteria_count integer;
begin
  cid := public.resolve_community(a->>'community');
  case form.kind
  when 'participation_note' then
    insert into public.participation_notes values(form.id,cid,trim(a->>'participantName'),
      (a->>'eventDate')::date,a->>'facts',a->>'possibleSolution')
    on conflict(form_id) do update set community_id=excluded.community_id,participant_name=excluded.participant_name,
      event_date=excluded.event_date,facts=excluded.facts,possible_solution=excluded.possible_solution;
  when 'meeting_attendance' then
    if jsonb_typeof(a->'topics') is distinct from 'array' or jsonb_typeof(a->'agreements') is distinct from 'array' then
      raise exception 'Los temas y acuerdos deben ser listas.';
    end if;
    if jsonb_array_length(a->'topics')=0 or jsonb_array_length(a->'agreements')=0 then
      raise exception 'Agrega al menos un tema y un acuerdo.';
    end if;
    insert into public.meeting_attendances values(form.id,a->>'meetingId',trim(a->>'contactName'),
      trim(a->>'contactPhone'),a->>'institution',a->>'organization',a->>'position',a->>'contactEmail',a->>'conclusions')
    on conflict(form_id) do update set meeting_id=excluded.meeting_id,contact_name=excluded.contact_name,
      contact_phone=excluded.contact_phone,institution=excluded.institution,organization=excluded.organization,
      position=excluded.position,email=excluded.email,conclusions=excluded.conclusions;
    delete from public.meeting_topics where attendance_id=form.id;
    insert into public.meeting_topics(attendance_id,label)
      select form.id,trim(value) from jsonb_array_elements_text(a->'topics') on conflict do nothing;
    delete from public.meeting_agreements where attendance_id=form.id;
    insert into public.meeting_agreements select form.id,ordinality,value
      from jsonb_array_elements_text(a->'agreements') with ordinality;
  when 'resume' then
    if jsonb_typeof(p->'education') is distinct from 'array' or jsonb_typeof(p->'workExperience') is distinct from 'array' then
      raise exception 'Los estudios y la experiencia deben ser listas.';
    end if;
    if jsonb_array_length(p->'education')=0 then raise exception 'Selecciona al menos un nivel de estudios.'; end if;
    insert into public.resumes values(form.id,trim(p->>'fullName'),cid,p->>'residence',
      p->>'documentNumber',p->>'phone',p->>'email')
    on conflict(form_id) do update set full_name=excluded.full_name,community_id=excluded.community_id,
      residence=excluded.residence,document_number=excluded.document_number,phone=excluded.phone,email=excluded.email;
    delete from public.resume_education where resume_id=form.id;
    insert into public.resume_education select form.id,ordinality,value->>'level',value->>'institution',value->>'place',
      case when nullif(value->>'completionMonth','') is not null then ((value->>'completionMonth') || '-01')::date end,
      coalesce((value->>'inProgress')::boolean,false)
      from jsonb_array_elements(p->'education') with ordinality;
    delete from public.resume_experience where resume_id=form.id;
    insert into public.resume_experience select form.id,ordinality,value->>'role',value->>'organization',value->>'place',
      ((value->>'startMonth') || '-01')::date,
      case when not coalesce((value->>'current')::boolean,false) then ((value->>'endMonth') || '-01')::date end,
      coalesce((value->>'current')::boolean,false)
      from jsonb_array_elements(p->'workExperience') with ordinality;
  when 'board_performance' then
    insert into public.board_members(full_name,position) values(trim(a->>'memberName'),a->>'position')
      on conflict(normalized_name,position) where starts_on is null do update set full_name=excluded.full_name returning id into mid;
    insert into public.board_evaluations values(form.id,cid,mid,(a->>'recordDate')::date,(a->>'rating')::smallint,a->>'recommendations')
      on conflict(form_id) do update set community_id=excluded.community_id,member_id=excluded.member_id,
        record_date=excluded.record_date,rating=excluded.rating,recommendations=excluded.recommendations;
  when 'teacher_evaluation' then
    first_day := (p->>'periodStart')::date;
    last_day := (p->>'periodEnd')::date;
    if not (last_day >= first_day and last_day-first_day < 62) then raise exception 'Período docente inválido.'; end if;
    insert into public.teachers(full_name,registry_community_id) values(trim(p->>'teacherName'),cid)
      on conflict(registry_community_id,normalized_name) do update set full_name=excluded.full_name returning id into tid;
    if nullif(p->>'teacherId','') is not null then
      insert into public.teacher_aliases values(tid,p->>'teacherId') on conflict do nothing;
    end if;
    insert into public.schools(community_id,name) values(cid,trim(p->>'site'))
      on conflict(community_id,normalized_name) do update set name=excluded.name returning id into sid;
    -- Se reconstruyen solo los hijos del formulario corregido, dentro de la misma transacción.
    delete from public.teacher_attendance where evaluation_id=form.id;
    delete from public.teacher_scores where evaluation_id=form.id;
    insert into public.teacher_evaluations(form_id,teacher_id,school_id,community_id,grades,period_start,period_end,
      status,absence_justification,absence_notes,strengths,improvements,observations,reviewed_by,reviewed_at)
    values(form.id,tid,sid,cid,p->>'grades',first_day,last_day,p->>'status',nullif(p->>'absenceJustification',''),
      p->>'absenceNotes',p#>>'{performance,strengths}',p#>>'{performance,improvements}',p#>>'{performance,observations}',
      case when p->>'status' = 'Verificado' then auth.uid() end,
      case when p->>'status' = 'Verificado' then coalesce(nullif(p->>'reviewedAt','')::timestamptz,now()) end)
    on conflict(form_id) do update set teacher_id=excluded.teacher_id,school_id=excluded.school_id,
      community_id=excluded.community_id,grades=excluded.grades,period_start=excluded.period_start,period_end=excluded.period_end,
      status=excluded.status,absence_justification=excluded.absence_justification,absence_notes=excluded.absence_notes,
      strengths=excluded.strengths,improvements=excluded.improvements,observations=excluded.observations,
      reviewed_by=case when excluded.status='Verificado' then coalesce(excluded.reviewed_by,teacher_evaluations.reviewed_by) end,
      reviewed_at=case when excluded.status='Verificado' and auth.uid() is not null then now()
        when excluded.status='Verificado' then coalesce(teacher_evaluations.reviewed_at,excluded.reviewed_at) end;
    insert into public.teacher_attendance
      select form.id,tid,sid,(value->>'date')::date,(value->>'scheduled')::boolean,
        case when (value->>'scheduled')::boolean then nullif(value->>'status','') end
      from jsonb_array_elements(p->'attendance');
    if (select count(*) from public.teacher_attendance where evaluation_id=form.id) <> last_day-first_day+1
      or exists(select 1 from public.teacher_attendance where evaluation_id=form.id and day not between first_day and last_day)
      or not exists(select 1 from public.teacher_attendance where evaluation_id=form.id and scheduled)
    then raise exception 'Las jornadas deben cubrir el período completo e incluir una fecha programada.'; end if;
    insert into public.teacher_scores
      select form.id,id,case when p#>>array['performance','ratings',id] = 'NO' then null
        else (p#>>array['performance','ratings',id])::smallint end
      from public.teacher_criteria
      where p#>>array['performance','ratings',id] is not null;
    select count(*) into criteria_count from public.teacher_scores where evaluation_id=form.id;
    if criteria_count <> 6 then raise exception 'Completa los seis criterios o marca N/O.'; end if;
    if p->>'status' = 'Verificado' and exists(select 1 from public.teacher_attendance
      where evaluation_id=form.id and scheduled and status is null)
    then raise exception 'Completa las fechas pendientes antes de verificar.'; end if;
  else raise exception 'Tipo de formulario no admitido.';
  end case;
end;
$$;

create or replace function app_private.sync_community_form()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (old.id <> new.id or old.kind <> new.kind) then
    raise exception 'El identificador y tipo del formulario no se pueden cambiar.';
  end if;
  perform app_private.project_community_form(new);
  delete from public.migration_issues where source_table='community_forms' and source_id=new.id;
  return new;
end;
$$;
drop trigger if exists teacher_evaluation_overlap on public.community_forms;
drop trigger if exists community_forms_projection on public.community_forms;
create trigger community_forms_projection after insert or update on public.community_forms
  for each row execute function app_private.sync_community_form();

-- Los originales incompatibles se conservan y se señalan para revisión.
do $$ declare form public.community_forms; begin
  for form in select * from public.community_forms order by submitted_at,id loop
    begin
      perform app_private.project_community_form(form);
      delete from public.migration_issues where source_table='community_forms' and source_id=form.id;
    exception when others then
      insert into public.migration_issues(source_table,source_id,reason)
      values('community_forms',form.id,sqlerrm) on conflict(source_table,source_id)
      do update set reason=excluded.reason,recorded_at=now();
    end;
  end loop;
end $$;

-- Vincula cada persona a su vivienda y familia sin limitar el número de familias.
create or replace function app_private.link_census_household()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid text; dwelling uuid; family uuid;
begin
  cid := public.resolve_community(new.answers->>'community');
  if cid is null then raise exception 'Comunidad censal desconocida.'; end if;
  new.community_id := cid;
  if nullif(trim(new.answers->>'householdCode'),'') is not null
    and new.answers->>'householdCode' <> 'Falta actualizar' then
    insert into public.dwellings(community_id,code) values(cid,trim(new.answers->>'householdCode'))
      on conflict(community_id,code) do update set code=excluded.code returning id into dwelling;
    if nullif(trim(new.answers->>'familyCode'),'') is not null
      and new.answers->>'familyCode' <> 'Falta actualizar' then
      insert into public.families(dwelling_id,community_id,code) values(dwelling,cid,trim(new.answers->>'familyCode'))
        on conflict(dwelling_id,code) do update set code=excluded.code returning id into family;
    end if;
  end if;
  new.family_id := family;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists census_household_link on public.census_records;
create trigger census_household_link before insert or update of answers on public.census_records
  for each row execute function app_private.link_census_household();
do $$ declare row_id text; begin
  for row_id in select id from public.census_records loop
    begin
      update public.census_records set answers=answers where id=row_id;
    exception when others then
      insert into public.migration_issues(source_table,source_id,reason)
      values('census_records',row_id,sqlerrm) on conflict(source_table,source_id)
      do update set reason=excluded.reason,recorded_at=now();
    end;
  end loop;
end $$;

create or replace function app_private.prepare_census_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare previous_community text;
begin
  if new.is_new then
    new.community_id := public.resolve_community(new.changes->>'community');
  else
    select community_id into previous_community from public.census_records where id=new.record_id;
    if previous_community is null then raise exception 'No se puede relacionar la solicitud con una persona censada.'; end if;
    new.community_id := previous_community;
    if new.changes ? 'community' and public.resolve_community(new.changes->>'community') is distinct from previous_community
      and coalesce(public.current_app_role(),'') not in ('superadmin','council','census') then
      raise exception 'El traslado de comunidad debe solicitarse al administrador.' using errcode='42501';
    end if;
  end if;
  new.collected_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists census_request_scope on public.census_requests;
create trigger census_request_scope before insert on public.census_requests
  for each row execute function app_private.prepare_census_request();

create or replace function public.decide_census_request(request_id text, decision text, notes text default '')
returns void language plpgsql security definer set search_path = public as $$
declare request public.census_requests;
begin
  if coalesce(public.current_app_role(),'') not in ('superadmin','council','census') then raise exception 'Sin autorización.' using errcode='42501'; end if;
  if decision not in ('Aprobada','Rechazada') then raise exception 'Decisión inválida.'; end if;
  select * into strict request from public.census_requests where id=request_id for update;
  if request.status <> 'Pendiente' then raise exception 'La solicitud ya fue resuelta.'; end if;
  if decision = 'Aprobada' then
    if request.is_new then
      insert into public.census_records(id,answers,collected_by) values(request.record_id,request.changes,request.collected_by);
    else
      update public.census_records set answers=answers || request.changes where id=request.record_id;
      if not found then raise exception 'La persona censada no existe.'; end if;
    end if;
  end if;
  update public.census_requests set status=decision,decided_at=now(),decided_by=auth.uid(),decision_notes=notes where id=request_id;
end;
$$;
revoke all on function public.decide_census_request(text,text,text) from public;
grant execute on function public.decide_census_request(text,text,text) to authenticated;

create or replace function public.verify_community_certificate(code uuid)
returns table(holder_name text,masked_document text,community text,issued_at timestamptz,valid boolean)
language sql stable security definer set search_path = public as $$
  select c.holder_name,c.masked_document,cm.name,c.issued_at,
    c.revoked_at is null and r.archived_at is null
  from public.certificates c join public.communities cm on cm.id=c.community_id
  join public.census_records r on r.id=c.record_id where c.verification_code=code;
$$;
revoke all on function public.verify_community_certificate(uuid) from public;
grant execute on function public.verify_community_certificate(uuid) to anon,authenticated;
-- La función antigua devolvía todas las respuestas censales. Se retira su acceso público.
do $$ begin
  if to_regprocedure('public.verify_census_identity(text,text)') is not null then
    revoke all on function public.verify_census_identity(text,text) from public,anon,authenticated;
  end if;
end $$;

create or replace function app_private.prepare_certificate()
returns trigger language plpgsql security definer set search_path = public as $$
declare person public.census_records; doc text;
begin
  select * into strict person from public.census_records where id=new.record_id and archived_at is null;
  new.community_id := person.community_id;
  new.holder_name := concat_ws(' ',nullif(person.answers->>'firstName','Falta actualizar'),
    nullif(person.answers->>'middleName','Falta actualizar'),nullif(person.answers->>'lastName1','Falta actualizar'),
    nullif(person.answers->>'lastName2','Falta actualizar'),nullif(person.answers->>'lastName3','Falta actualizar'),
    nullif(person.answers->>'lastName4','Falta actualizar'));
  doc := coalesce(person.answers->>'documentNumber','');
  new.masked_document := case when length(doc) > 4 then left(doc,2) || repeat('•',length(doc)-4) || right(doc,2) else '••••' end;
  new.issued_by := auth.uid();
  new.issued_at := now();
  return new;
end;
$$;
drop trigger if exists certificate_snapshot on public.certificates;
create trigger certificate_snapshot before insert on public.certificates for each row execute function app_private.prepare_certificate();

create or replace function app_private.audit_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare item jsonb := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log(table_name,record_id,operation,actor_id)
  values(tg_table_name,coalesce(item->>'id',item->>'form_id',item->>'slug',''),tg_op,auth.uid());
  return coalesce(new,old);
end;
$$;

-- Reemplazar políticas antiguas de estos módulos; no dejar permisos amplios acumulados.
do $$ declare tab text; policy_row record; begin
  foreach tab in array array['communities','community_localities','profiles','dwellings','families',
    'census_records','census_requests','community_novelties','certificates','community_groups','content_items',
    'projects','agenda_events','churo_editions','site_pages','media_assets','surveys','survey_responses',
    'contact_requests','audit_log','migration_issues','app_schema_versions','community_forms','community_meetings',
    'participation_notes','meeting_attendances','meeting_topics','meeting_agreements','resumes','resume_education',
    'resume_experience','board_positions','board_members','board_evaluations','schools','teachers','teacher_aliases',
    'teacher_criteria','teacher_evaluations','teacher_attendance','teacher_scores'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from anon, authenticated',tab);
    for policy_row in select policyname from pg_policies where schemaname='public' and tablename=tab loop
      execute format('drop policy %I on public.%I',policy_row.policyname,tab);
    end loop;
  end loop;
end $$;
revoke create on schema public from public,anon,authenticated;

do $$ declare tab text; begin
  foreach tab in array array['communities','community_localities','board_positions','teacher_criteria'] loop
    execute format('grant select on public.%I to anon,authenticated',tab);
    execute format('grant insert,update,delete on public.%I to authenticated',tab);
    execute format('create policy catalog_read on public.%I for select to anon,authenticated using(true)',tab);
    execute format('create policy catalog_manage on public.%I for all to authenticated using(public.is_guajui_owner()) with check(public.is_guajui_owner())',tab);
  end loop;
  foreach tab in array array['participation_notes','meeting_attendances','meeting_topics','meeting_agreements',
    'resumes','resume_education','resume_experience','board_members','board_evaluations','schools',
    'teachers','teacher_aliases','teacher_evaluations','teacher_attendance','teacher_scores',
    'audit_log','migration_issues','app_schema_versions'] loop
    execute format('grant select on public.%I to authenticated',tab);
    execute format('create policy private_read on public.%I for select to authenticated using(public.is_guajui_owner())',tab);
  end loop;
end $$;
grant select,insert,update,delete on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_guajui_owner());
create policy profiles_manage on public.profiles for all to authenticated using(public.is_guajui_owner()) with check(public.is_guajui_owner());

grant insert on public.community_forms to anon,authenticated;
grant select,update on public.community_forms to authenticated;
create policy community_submit on public.community_forms for insert to anon,authenticated
  with check(kind <> 'teacher_evaluation' or payload->>'status'='Pendiente');
create policy community_manage on public.community_forms for all to authenticated
  using(public.is_guajui_owner()) with check(public.is_guajui_owner());
grant select on public.community_meetings to anon,authenticated;
grant insert,update on public.community_meetings to authenticated;
create policy meeting_public_read on public.community_meetings for select to anon,authenticated using(true);
create policy meeting_manage on public.community_meetings for all to authenticated using(public.is_guajui_owner()) with check(public.is_guajui_owner());

do $$ declare tab text; begin
  foreach tab in array array['dwellings','families','census_records','certificates'] loop
    execute format('grant select,insert,update on public.%I to authenticated',tab);
    execute format('create policy census_read on public.%I for select to authenticated using(public.can_read_census(community_id))',tab);
    execute format('create policy census_manage on public.%I for all to authenticated using(public.current_app_role() in (''superadmin'',''council'',''census'')) with check(public.current_app_role() in (''superadmin'',''council'',''census''))',tab);
  end loop;
end $$;
grant insert on public.census_requests to anon,authenticated;
grant select on public.census_requests to authenticated;
create policy census_request_read on public.census_requests for select to authenticated using(public.can_read_census(community_id));
create policy census_request_submit on public.census_requests for insert to anon,authenticated with check(
  status='Pendiente' and decided_at is null and decided_by is null and community_id is not null
  and (collected_by is null or collected_by=auth.uid())
  and (auth.uid() is null or public.can_read_census(community_id))
);
grant select,insert,update on public.community_novelties to authenticated;
create policy novelty_read on public.community_novelties for select to authenticated using(public.can_read_census(community_id));
create policy novelty_submit on public.community_novelties for insert to authenticated with check(
  public.can_read_census(community_id) and reported_by=auth.uid() and status='Pendiente'
  and reviewed_by is null and event_date <= current_date
  and exists(select 1 from public.census_records r where r.id=record_id and r.community_id=community_novelties.community_id)
);
create policy novelty_review on public.community_novelties for update to authenticated
  using(public.current_app_role() in ('superadmin','council','census'))
  with check(public.current_app_role() in ('superadmin','council','census'));

grant select on public.surveys to anon,authenticated;
grant insert,update,delete on public.surveys to authenticated;
create policy surveys_read on public.surveys for select to anon,authenticated using(status='published' or public.current_app_role() in ('superadmin','council'));
create policy surveys_manage on public.surveys for all to authenticated
  using(public.current_app_role() in ('superadmin','council')) with check(public.current_app_role() in ('superadmin','council'));
grant insert on public.survey_responses to anon,authenticated;
grant select on public.survey_responses to authenticated;
create policy survey_answer_submit on public.survey_responses for insert to anon,authenticated with check(
  (submitted_by is null or submitted_by=auth.uid())
  and exists(select 1 from public.surveys where id=survey_id and status='published' and (closes_at is null or closes_at >= current_date))
);
create policy survey_answer_read on public.survey_responses for select to authenticated using(public.can_read_census(community_id));

create or replace function public.can_write_content(author uuid, community text, group_key text, item_kind text, item_status text)
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() in ('superadmin','council','communications','reviewer')
    or (author=auth.uid() and public.current_app_role()='community_leader'
      and community=public.current_app_community() and item_kind='Noticia' and item_status in ('Borrador','Aprobada','En revisión'))
    or (author=auth.uid() and item_status in ('Borrador','En revisión') and (
      (public.current_app_role()='chirimias' and group_key='chirimias')
      or (public.current_app_role()='youth' and group_key='youth')
      or (public.current_app_role()='women' and group_key='women')
      or (public.current_app_role()='elders' and group_key='elders')
      or (public.current_app_role()='teacher' and group_key='teachers'))),false);
$$;
grant select on public.content_items to anon,authenticated;
grant insert,update,delete on public.content_items to authenticated;
create policy content_read on public.content_items for select to anon,authenticated
  using(status='Aprobada' or author_id=auth.uid() or public.current_app_role() in ('superadmin','council','communications','reviewer'));
create policy content_insert on public.content_items for insert to authenticated with check(
  author_id=auth.uid() and public.can_write_content(author_id,community_id,group_id,kind,status));
create policy content_update on public.content_items for update to authenticated
  using(public.can_write_content(author_id,community_id,group_id,kind,status))
  with check(public.can_write_content(author_id,community_id,group_id,kind,status));
create policy content_delete on public.content_items for delete to authenticated using(public.current_app_role() in ('superadmin','council'));

do $$ declare tab text; begin
  foreach tab in array array['projects','agenda_events','churo_editions'] loop
    execute format('grant select on public.%I to anon,authenticated',tab);
    execute format('grant insert,update,delete on public.%I to authenticated',tab);
    execute format('create policy detail_read on public.%I for select to anon,authenticated using(exists(select 1 from public.content_items c where c.id=content_id))',tab);
    execute format('create policy detail_manage on public.%I for all to authenticated using(exists(select 1 from public.content_items c where c.id=content_id and public.can_write_content(c.author_id,c.community_id,c.group_id,c.kind,c.status))) with check(exists(select 1 from public.content_items c where c.id=content_id and public.can_write_content(c.author_id,c.community_id,c.group_id,c.kind,c.status)))',tab);
  end loop;
  foreach tab in array array['community_groups','site_pages'] loop
    execute format('grant select on public.%I to anon,authenticated',tab);
    execute format('grant insert,update,delete on public.%I to authenticated',tab);
    execute format('create policy page_read on public.%I for select to anon,authenticated using(published or public.current_app_role() in (''superadmin'',''council'',''communications''))',tab);
    execute format('create policy page_manage on public.%I for all to authenticated using(public.current_app_role() in (''superadmin'',''council'',''communications'')) with check(public.current_app_role() in (''superadmin'',''council'',''communications''))',tab);
  end loop;
end $$;
grant select on public.media_assets to anon,authenticated;
grant insert,update,delete on public.media_assets to authenticated;
create policy media_read on public.media_assets for select to anon,authenticated using(is_public or public.is_guajui_owner());
create policy media_manage on public.media_assets for all to authenticated
  using(public.current_app_role() in ('superadmin','communications')) with check(public.current_app_role() in ('superadmin','communications'));
grant insert on public.contact_requests to anon,authenticated;
grant select,update on public.contact_requests to authenticated;
create policy contact_submit on public.contact_requests for insert to anon,authenticated with check(status='Pendiente' and assigned_to is null and resolved_at is null);
create policy contact_manage on public.contact_requests for all to authenticated
  using(public.current_app_role() in ('superadmin','council')) with check(public.current_app_role() in ('superadmin','council'));

do $$ declare tab text; begin
  foreach tab in array array['profiles','census_records','census_requests','community_novelties','certificates',
    'content_items','surveys','community_forms','community_meetings','contact_requests'] loop
    execute format('drop trigger if exists platform_audit on public.%I',tab);
    execute format('create trigger platform_audit after insert or update or delete on public.%I for each row execute function app_private.audit_change()',tab);
  end loop;
end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;

-- Las vistas respetan las mismas políticas de las tablas que consultan.
create or replace view public.teacher_daily_summary with (security_invoker=true) as
select e.teacher_id,e.community_id,a.day,
  case when bool_or(a.status='absent') then 'absent'
    when bool_and(a.status='full') then 'full' else 'partial' end as status
from public.teacher_attendance a join public.teacher_evaluations e on e.form_id=a.evaluation_id
where e.status='Verificado' and a.scheduled
group by e.teacher_id,e.community_id,a.day;

create or replace view public.teacher_monthly_metrics with (security_invoker=true) as
with days as (
  select teacher_id,community_id,date_trunc('month',day)::date as month,
    count(*) as scheduled_days,
    count(*) filter(where status='full') as full_days,
    count(*) filter(where status='partial') as partial_days,
    count(*) filter(where status='absent') as absence_days
  from public.teacher_daily_summary group by teacher_id,community_id,date_trunc('month',day)::date
), periods as (
  select distinct e.form_id,e.teacher_id,e.community_id,date_trunc('month',a.day)::date as month
  from public.teacher_evaluations e join public.teacher_attendance a on a.evaluation_id=e.form_id
  where e.status='Verificado' and a.scheduled
), scores as (
  select p.teacher_id,p.community_id,p.month,avg(s.score) as average_score,count(s.score) as observed_criteria
  from periods p join public.teacher_scores s on s.evaluation_id=p.form_id
  group by p.teacher_id,p.community_id,p.month
)
select d.*,t.full_name,s.average_score,s.observed_criteria,
  round(100.0*d.full_days/nullif(d.scheduled_days,0),2) as full_attendance_percentage
from days d join public.teachers t on t.id=d.teacher_id
left join scores s using(teacher_id,community_id,month);

create or replace view public.teacher_annual_metrics with (security_invoker=true) as
with days as (
  select teacher_id,community_id,extract(year from day)::integer as year,
    count(*) as scheduled_days,
    count(*) filter(where status='full') as full_days,
    count(*) filter(where status='partial') as partial_days,
    count(*) filter(where status='absent') as absence_days
  from public.teacher_daily_summary group by teacher_id,community_id,extract(year from day)::integer
), periods as (
  select distinct e.form_id,e.teacher_id,e.community_id,extract(year from a.day)::integer as year
  from public.teacher_evaluations e join public.teacher_attendance a on a.evaluation_id=e.form_id
  where e.status='Verificado' and a.scheduled
), scores as (
  select p.teacher_id,p.community_id,p.year,avg(s.score) as average_score,count(s.score) as observed_criteria
  from periods p join public.teacher_scores s on s.evaluation_id=p.form_id
  group by p.teacher_id,p.community_id,p.year
)
select d.*,t.full_name,s.average_score,s.observed_criteria,
  round(100.0*d.full_days/nullif(d.scheduled_days,0),2) as full_attendance_percentage
from days d join public.teachers t on t.id=d.teacher_id
left join scores s using(teacher_id,community_id,year);

create or replace view public.teacher_monthly_ranking with (security_invoker=true) as
select m.*,
  dense_rank() over(partition by month,community_id order by average_score desc,absence_days) as community_rank,
  dense_rank() over(partition by month order by average_score desc,absence_days) as council_rank
from public.teacher_monthly_metrics m where average_score is not null;
create or replace view public.teacher_annual_ranking with (security_invoker=true) as
select m.*,
  dense_rank() over(partition by year,community_id order by average_score desc,absence_days) as community_rank,
  dense_rank() over(partition by year order by average_score desc,absence_days) as council_rank
from public.teacher_annual_metrics m where average_score is not null;
create or replace view public.census_duplicate_documents with (security_invoker=true) as
select answers->>'documentNumber' as document_number,count(*) as record_count
from public.census_records where archived_at is null
  and nullif(trim(answers->>'documentNumber'),'') is not null
  and answers->>'documentNumber' <> 'Falta actualizar'
group by answers->>'documentNumber' having count(*)>1;
grant select on public.teacher_daily_summary,public.teacher_monthly_metrics,public.teacher_annual_metrics,
  public.teacher_monthly_ranking,public.teacher_annual_ranking,public.census_duplicate_documents to authenticated;
revoke all on public.teacher_daily_summary,public.teacher_monthly_metrics,public.teacher_annual_metrics,
  public.teacher_monthly_ranking,public.teacher_annual_ranking,public.census_duplicate_documents from anon;

-- Storage se configura solo si existe el esquema de Supabase.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public) values
      ('guajui-public','guajui-public',true),('guajui-private','guajui-private',false)
    on conflict(id) do nothing;
    drop policy if exists guajui_public_files on storage.objects;
    create policy guajui_public_files on storage.objects for select to anon,authenticated
      using(bucket_id='guajui-public');
    drop policy if exists guajui_private_files on storage.objects;
    create policy guajui_private_files on storage.objects for select to authenticated
      using(bucket_id='guajui-private' and public.is_guajui_owner());
    drop policy if exists guajui_file_insert on storage.objects;
    create policy guajui_file_insert on storage.objects for insert to authenticated with check(
      (bucket_id='guajui-public' and public.current_app_role() in ('superadmin','communications'))
      or (bucket_id='guajui-private' and public.is_guajui_owner()));
    drop policy if exists guajui_file_update on storage.objects;
    create policy guajui_file_update on storage.objects for update to authenticated using(
      (bucket_id='guajui-public' and public.current_app_role() in ('superadmin','communications'))
      or (bucket_id='guajui-private' and public.is_guajui_owner()))
      with check((bucket_id='guajui-public' and public.current_app_role() in ('superadmin','communications'))
      or (bucket_id='guajui-private' and public.is_guajui_owner()));
    drop policy if exists guajui_file_delete on storage.objects;
    create policy guajui_file_delete on storage.objects for delete to authenticated
      using(bucket_id in ('guajui-public','guajui-private') and public.is_guajui_owner());
  end if;
end $$;

insert into public.app_schema_versions(version) values('20261103160000') on conflict do nothing;
