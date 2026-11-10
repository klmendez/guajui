-- Esquema inicial del censo comunitario Guajui.
-- Ejecutar completo en Supabase > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.census_records (
  id text primary key,
  survey_id text not null default 'censo-interno-guajui',
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.census_requests (
  id text primary key,
  record_id text not null,
  changes jsonb not null default '{}'::jsonb,
  missing_birth_date_access boolean not null default false,
  is_new boolean not null default false,
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Aprobada', 'Rechazada')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists census_records_document_idx
  on public.census_records ((answers ->> 'documentNumber'));
create index if not exists census_requests_record_idx
  on public.census_requests (record_id);

alter table public.census_records enable row level security;
alter table public.census_requests enable row level security;

-- El visitante únicamente puede enviar una solicitud; no puede listar el censo.
drop policy if exists "public can create census requests" on public.census_requests;
create policy "public can create census requests"
  on public.census_requests for insert to anon, authenticated
  with check (status = 'Pendiente' and decided_at is null);

-- Los usuarios autenticados del Consejo administran los datos.
drop policy if exists "authenticated council manages records" on public.census_records;
create policy "authenticated council manages records"
  on public.census_records for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated council manages requests" on public.census_requests;
create policy "authenticated council manages requests"
  on public.census_requests for all to authenticated
  using (true) with check (true);

-- Verificación pública limitada: exige documento y fecha y devuelve solo coincidencia exacta.
create or replace function public.verify_census_identity(document_number text, birth_date text)
returns table (id text, survey_id text, answers jsonb, submitted_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select r.id, r.survey_id, r.answers, r.submitted_at
  from public.census_records r
  where r.answers ->> 'documentNumber' = trim(document_number)
    and (
      r.answers ->> 'birthDate' = birth_date
      or coalesce(r.answers ->> 'birthDate', '') in ('', 'Falta actualizar')
    )
  limit 1;
$$;

revoke all on function public.verify_census_identity(text, text) from public;
grant execute on function public.verify_census_identity(text, text) to anon, authenticated;
grant insert on public.census_requests to anon, authenticated;
grant select, insert, update, delete on public.census_records to authenticated;
grant select, insert, update, delete on public.census_requests to authenticated;

