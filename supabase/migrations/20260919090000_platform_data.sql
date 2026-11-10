-- Persistencia de la plataforma Guajui y permisos por rol.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'reviewer' check (role in (
    'superadmin', 'council', 'census', 'enumerator', 'communications',
    'chirimias', 'youth', 'women', 'elders', 'teacher', 'reviewer'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.surveys (
  id text primary key,
  title text not null,
  description text not null default '',
  closes_at date,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id text primary key,
  survey_id text not null references public.surveys(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null
);

create table if not exists public.content_items (
  id text primary key,
  title text not null,
  kind text not null,
  section text not null,
  status text not null default 'Borrador',
  data jsonb not null default '{}'::jsonb,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists survey_responses_survey_idx on public.survey_responses(survey_id);
create index if not exists content_items_section_idx on public.content_items(section);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
alter table public.content_items enable row level security;

create policy "users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.current_app_role() = 'superadmin');
create policy "superadmin manages profiles" on public.profiles
  for all to authenticated using (public.current_app_role() = 'superadmin')
  with check (public.current_app_role() = 'superadmin');

create policy "everyone reads published surveys" on public.surveys
  for select to anon, authenticated using (
    status = 'published' or public.current_app_role() in ('superadmin', 'council')
  );
create policy "council manages surveys" on public.surveys
  for all to authenticated using (public.current_app_role() in ('superadmin', 'council'))
  with check (public.current_app_role() in ('superadmin', 'council'));

create policy "participants submit survey responses" on public.survey_responses
  for insert to anon, authenticated with check (true);
create policy "council reads survey responses" on public.survey_responses
  for select to authenticated using (public.current_app_role() in ('superadmin', 'council'));

create policy "authorized users read content" on public.content_items
  for select to authenticated using (true);
create policy "content roles create content" on public.content_items
  for insert to authenticated with check (public.current_app_role() in (
    'superadmin', 'council', 'communications', 'chirimias', 'youth',
    'women', 'elders', 'teacher'
  ));
create policy "authors and managers update content" on public.content_items
  for update to authenticated using (
    author_id = auth.uid() or public.current_app_role() in ('superadmin', 'council', 'communications', 'reviewer')
  ) with check (
    author_id = auth.uid() or public.current_app_role() in ('superadmin', 'council', 'communications', 'reviewer')
  );
create policy "authors and managers delete content" on public.content_items
  for delete to authenticated using (
    author_id = auth.uid() or public.current_app_role() in ('superadmin', 'council')
  );

-- Los censistas y administradores gestionan registros y solicitudes.
drop policy if exists "authenticated council manages records" on public.census_records;
create policy "authorized roles manage census records" on public.census_records
  for all to authenticated using (
    public.current_app_role() in ('superadmin', 'council', 'census', 'enumerator')
  ) with check (
    public.current_app_role() in ('superadmin', 'council', 'census', 'enumerator')
  );

drop policy if exists "authenticated council manages requests" on public.census_requests;
create policy "authorized roles manage census requests" on public.census_requests
  for all to authenticated using (
    public.current_app_role() in ('superadmin', 'council', 'census', 'enumerator')
  ) with check (
    public.current_app_role() in ('superadmin', 'council', 'census', 'enumerator')
  );
