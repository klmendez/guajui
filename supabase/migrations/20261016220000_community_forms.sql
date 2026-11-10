-- Formularios comunitarios: envío público, lectura privada del administrador.
-- Migración histórica. Para instalar actualizaciones usa npm run db:apply.
-- Ejecutar en SQL Editor del proyecto iibbavjuqescenbwonfp.

create or replace function public.is_guajui_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and lower(email) = 'planetnodesarrolloguapi@gmail.com'
      and email_confirmed_at is not null
  );
$$;
revoke all on function public.is_guajui_owner() from public;
grant execute on function public.is_guajui_owner() to authenticated;

create table if not exists public.community_forms (
  id text primary key,
  kind text not null check (kind in (
    'participation_note', 'meeting_attendance', 'board_performance',
    'resume', 'teacher_evaluation'
  )),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  submitted_at timestamptz not null default now()
);
create index if not exists community_forms_kind_date_idx
  on public.community_forms (kind, submitted_at desc);
alter table public.community_forms enable row level security;
grant insert on public.community_forms to anon;
grant select, insert, update on public.community_forms to authenticated;

drop policy if exists "Visitors submit community forms" on public.community_forms;
create policy "Visitors submit community forms" on public.community_forms
  for insert to anon with check (
    kind <> 'teacher_evaluation'
    or payload ->> 'status' = 'Pendiente'
  );

drop policy if exists "Owner manages community forms" on public.community_forms;
create policy "Owner manages community forms" on public.community_forms
  for all to authenticated
  using (public.is_guajui_owner())
  with check (public.is_guajui_owner());

create table if not exists public.community_meetings (
  id text primary key,
  name text not null,
  meeting_date date not null,
  objective text not null,
  place text not null,
  updated_at timestamptz not null default now()
);
alter table public.community_meetings enable row level security;
grant select on public.community_meetings to anon, authenticated;
grant insert, update on public.community_meetings to authenticated;

drop policy if exists "Visitors read community meetings" on public.community_meetings;
create policy "Visitors read community meetings" on public.community_meetings
  for select to anon, authenticated using (true);

drop policy if exists "Owner manages community meetings" on public.community_meetings;
create policy "Owner manages community meetings" on public.community_meetings
  for all to authenticated
  using (public.is_guajui_owner())
  with check (public.is_guajui_owner());

-- Evita registrar dos períodos superpuestos para el mismo docente y sede.
create or replace function public.reject_overlapping_teacher_evaluations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'teacher_evaluation' and exists (
    select 1 from public.community_forms previous
    where previous.kind = 'teacher_evaluation'
      and previous.id <> new.id
      and lower(trim(previous.payload ->> 'teacherName')) = lower(trim(new.payload ->> 'teacherName'))
      and lower(trim(previous.payload ->> 'community')) = lower(trim(new.payload ->> 'community'))
      and lower(trim(previous.payload ->> 'site')) = lower(trim(new.payload ->> 'site'))
      and (previous.payload ->> 'periodStart')::date <= (new.payload ->> 'periodEnd')::date
      and (new.payload ->> 'periodStart')::date <= (previous.payload ->> 'periodEnd')::date
  ) then
    raise exception 'Ya existe un seguimiento de este docente, sede y período.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;
drop trigger if exists teacher_evaluation_overlap on public.community_forms;
create trigger teacher_evaluation_overlap
  before insert or update on public.community_forms
  for each row execute function public.reject_overlapping_teacher_evaluations();
