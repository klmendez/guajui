-- Solo tres perfiles administrativos. No importa datos del navegador.
create table if not exists public.access_grants (
  email text primary key check(email=lower(trim(email)) and email like '%@%'),
  role text not null check(role in ('superadmin','enumerator','community_leader')),
  community_id text references public.communities(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check(role='superadmin' or community_id is not null)
);
create unique index if not exists one_responsible_email on public.access_grants(community_id)
  where role='community_leader' and active;
alter table public.access_grants enable row level security;
revoke all on public.access_grants from anon,authenticated;
grant select on public.access_grants to authenticated;
drop policy if exists access_admin on public.access_grants;
create policy access_admin on public.access_grants for select to authenticated using(public.is_guajui_owner());

-- Conservar autorías históricas, retirando los permisos de perfiles eliminados.
alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role drop default;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists leader_requires_community;
update public.profiles set role=null,active=false
  where role not in ('superadmin','enumerator','community_leader')
    or (role in ('enumerator','community_leader') and community_id is null);
alter table public.profiles add constraint profiles_role_check
  check(role is null or role in ('superadmin','enumerator','community_leader'));
alter table public.profiles add constraint active_profile_requires_role check(not active or role is not null);
alter table public.profiles add constraint scoped_profile_requires_community check(
  role not in ('enumerator','community_leader') or community_id is not null);
insert into public.access_grants(email,role,community_id,active)
  select lower(u.email),p.role,p.community_id,p.active from public.profiles p join auth.users u on u.id=p.id
  where p.role is not null and u.email is not null
on conflict(email) do nothing;
insert into public.access_grants(email,role)
  select 'planetnodesarrolloguapi@gmail.com','superadmin'
  where not exists(select 1 from public.access_grants where role='superadmin' and active)
on conflict do nothing;

create or replace function app_private.bootstrap_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare access public.access_grants;
begin
  select * into access from public.access_grants where email=lower(new.email) and active;
  if new.email_confirmed_at is not null then
    insert into public.profiles(id,username,role,community_id,active)
    values(new.id,coalesce(new.email,'usuario-' || new.id::text),access.role,access.community_id,coalesce(access.active,false))
    on conflict(id) do update set role=excluded.role,community_id=excluded.community_id,active=excluded.active,updated_at=now();
  end if;
  return new;
end;
$$;
drop trigger if exists guajui_profile_on_confirmation on auth.users;
create trigger guajui_profile_on_confirmation after insert or update of email,email_confirmed_at
  on auth.users for each row execute function app_private.bootstrap_profile();
create or replace function public.set_platform_access(target_email text,target_role text,target_community text,enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare email_key text := lower(trim(target_email));
begin
  if not public.is_guajui_owner() then raise exception 'Solo el superadministrador administra accesos.' using errcode='42501'; end if;
  if exists(select 1 from auth.users where id=auth.uid() and lower(email)=email_key) then
    raise exception 'Tu propio acceso debe ser administrado por otro superadministrador.';
  end if;
  insert into public.access_grants(email,role,community_id,active)
  values(email_key,target_role,case when target_role='superadmin' then null else target_community end,enabled)
  on conflict(email) do update set role=excluded.role,community_id=excluded.community_id,active=excluded.active;
  update public.profiles p set role=target_role,active=enabled,
    community_id=case when target_role='superadmin' then null else target_community end,updated_at=now()
  from auth.users u where p.id=u.id and lower(u.email)=email_key and u.email_confirmed_at is not null;
end;
$$;
revoke all on function public.set_platform_access(text,text,text,boolean) from public;
grant execute on function public.set_platform_access(text,text,text,boolean) to authenticated;
revoke insert,update,delete on public.profiles from authenticated;
drop policy if exists profiles_manage on public.profiles;

create or replace function public.can_read_census(target_community text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_app_role()='superadmin' or
    (public.current_app_role() in ('enumerator','community_leader') and target_community=public.current_app_community()),false);
$$;
create or replace function public.can_write_content(author uuid,community text,group_key text,item_kind text,item_status text)
returns boolean language sql stable set search_path=public as $$
  select coalesce(public.is_guajui_owner() or
    (public.current_app_role()='community_leader' and author=auth.uid()
      and community=public.current_app_community() and item_status in ('Borrador','En revisión')),false);
$$;

-- Sustituir todas las políticas que dependían de perfiles retirados.
do $$ declare tab text; pol record; begin
  foreach tab in array array['dwellings','families','census_records','certificates','census_requests',
    'community_novelties','surveys','survey_responses','content_items','community_groups','site_pages',
    'media_assets','contact_requests'] loop
    for pol in select policyname from pg_policies where schemaname='public' and tablename=tab loop
      execute format('drop policy %I on public.%I',pol.policyname,tab);
    end loop;
    execute format('create policy admin_manage on public.%I for all to authenticated using(public.is_guajui_owner()) with check(public.is_guajui_owner())',tab);
  end loop;
  foreach tab in array array['dwellings','families','census_records','certificates','census_requests','community_novelties'] loop
    execute format('create policy community_read on public.%I for select to authenticated using(public.can_read_census(community_id))',tab);
  end loop;
end $$;
revoke insert on public.census_requests from anon;
create policy scoped_census_submit on public.census_requests for insert to authenticated with check(
  public.can_read_census(community_id) and collected_by=auth.uid()
  and status='Pendiente' and decided_at is null and decided_by is null);
create policy scoped_novelty_submit on public.community_novelties for insert to authenticated with check(
  public.current_app_role()='community_leader' and community_id=public.current_app_community()
  and reported_by=auth.uid() and status='Pendiente' and reviewed_by is null and event_date<=current_date
  and exists(select 1 from public.census_records r where r.id=record_id and r.community_id=community_novelties.community_id));
create policy surveys_public on public.surveys for select to anon,authenticated using(status='published');
create policy responses_submit on public.survey_responses for insert to anon,authenticated with check(
  (submitted_by is null or submitted_by=auth.uid())
  and (auth.uid() is null or public.is_guajui_owner() or
    (public.current_app_role() in ('enumerator','community_leader') and community_id=public.current_app_community()))
  and exists(select 1 from public.surveys s where s.id=survey_id and s.status='published' and (s.closes_at is null or s.closes_at>=current_date)));
create policy responses_scoped_read on public.survey_responses for select to authenticated using(
  (public.current_app_role()='community_leader' and community_id=public.current_app_community())
  or (public.current_app_role()='enumerator' and submitted_by=auth.uid() and community_id=public.current_app_community()));
create policy content_public on public.content_items for select to anon,authenticated using(status='Aprobada');
create policy content_community_read on public.content_items for select to authenticated using(
  public.current_app_role()='community_leader' and community_id=public.current_app_community());
create policy content_propose on public.content_items for insert to authenticated with check(
  author_id=auth.uid() and public.can_write_content(author_id,community_id,group_id,kind,status));
create policy content_edit on public.content_items for update to authenticated using(
  public.can_write_content(author_id,community_id,group_id,kind,status))
  with check(public.can_write_content(author_id,community_id,group_id,kind,status));
create policy groups_public on public.community_groups for select to anon,authenticated using(published);
create policy pages_public on public.site_pages for select to anon,authenticated using(published);
create policy media_public on public.media_assets for select to anon,authenticated using(is_public);
create policy contact_public_submit on public.contact_requests for insert to anon,authenticated
  with check(status='Pendiente' and assigned_to is null and resolved_at is null);
-- La decisión administrativa es atómica y solo corresponde al superadministrador.
create or replace function public.decide_census_request(request_id text,decision text,notes text default '')
returns void language plpgsql security definer set search_path=public as $$
declare request public.census_requests;
begin
  if not public.is_guajui_owner() then raise exception 'Solo el superadministrador puede aprobar.' using errcode='42501'; end if;
  if decision not in ('Aprobada','Rechazada') then raise exception 'Decisión inválida.'; end if;
  select * into strict request from public.census_requests where id=request_id for update;
  if request.status<>'Pendiente' then raise exception 'La solicitud ya fue resuelta.'; end if;
  if decision='Aprobada' then
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
create or replace function public.submit_census_batch(items jsonb)
returns table(id text) language plpgsql security invoker set search_path=public as $$
begin
  if coalesce(public.current_app_role(),'') not in ('superadmin','enumerator','community_leader') then
    raise exception 'Se necesita acceso autorizado.' using errcode='42501';
  end if;
  if jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 200 then raise exception 'Lote inválido.'; end if;
  return query insert into public.census_requests(id,record_id,changes,is_new,missing_birth_date_access)
    select value->>'id',value->>'recordId',value->'changes',coalesce((value->>'isNew')::boolean,false),
      coalesce((value->>'missingBirthDateAccess')::boolean,false)
    from jsonb_array_elements(items)
    returning census_requests.id;
end;
$$;
revoke all on function public.submit_census_batch(jsonb) from public;
grant execute on function public.submit_census_batch(jsonb) to authenticated;
create or replace function public.review_novelty(novelty_id uuid,decision text)
returns void language plpgsql security definer set search_path=public as $$
declare item public.community_novelties;
begin
  if not public.is_guajui_owner() then raise exception 'Acceso denegado.' using errcode='42501'; end if;
  if decision not in ('Verificado','Rechazado') then raise exception 'Estado inválido.'; end if;
  select * into strict item from public.community_novelties where id=novelty_id for update;
  if item.status<>'Pendiente' then raise exception 'La novedad ya fue revisada.'; end if;
  if decision='Verificado' and item.kind='death' then
    update public.census_records set answers=answers || jsonb_build_object('deceased',true,'deathDate',item.event_date)
      where id=item.record_id;
  end if;
  update public.community_novelties set status=decision,reviewed_by=auth.uid() where id=novelty_id;
end;
$$;
revoke all on function public.review_novelty(uuid,text) from public;
grant execute on function public.review_novelty(uuid,text) to authenticated;
-- Storage: todas las funciones de publicación quedan en el superadministrador.
create table if not exists public.event_registrations(
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.agenda_events(content_id),
  name text not null check(length(trim(name))>0),
  phone text not null check(length(trim(phone))>0),
  document_number text not null check(length(trim(document_number))>0),
  created_at timestamptz not null default now()
);
alter table public.event_registrations enable row level security;
grant insert on public.event_registrations to anon,authenticated;
grant select on public.event_registrations to authenticated;
create policy event_registration_submit on public.event_registrations for insert to anon,authenticated with check(
  exists(select 1 from public.content_items c join public.agenda_events a on a.content_id=c.id
    where c.id=event_id and c.status='Aprobada' and a.starts_at>=now()));
create policy event_registration_read on public.event_registrations for select to authenticated using(public.is_guajui_owner());

alter table public.survey_responses add column if not exists questions_snapshot jsonb;
create or replace function app_private.prepare_survey_response()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.community_id:=public.resolve_community(new.answers->>'community');
  if new.community_id is null then raise exception 'Selecciona una comunidad válida.'; end if;
  new.submitted_by:=auth.uid();
  select questions into new.questions_snapshot from public.surveys where id=new.survey_id;
  return new;
end;
$$;
drop trigger if exists survey_response_identity on public.survey_responses;
create trigger survey_response_identity before insert on public.survey_responses
  for each row execute function app_private.prepare_survey_response();

create or replace function app_private.prepare_census_request()
returns trigger language plpgsql security definer set search_path=public as $$
declare previous_community text;
begin
  if new.is_new then
    new.community_id:=public.resolve_community(new.changes->>'community');
  else
    select community_id into previous_community from public.census_records where id=new.record_id and archived_at is null;
    if previous_community is null then raise exception 'La persona censada no está activa.'; end if;
    new.community_id:=previous_community;
    if new.changes ? 'community' and public.resolve_community(new.changes->>'community') is distinct from previous_community
      and not public.is_guajui_owner() then raise exception 'El traslado de comunidad requiere al superadministrador.'; end if;
  end if;
  new.collected_by:=auth.uid();
  return new;
end;
$$;
create or replace function public.suggest_teachers(search_name text,target_community text)
returns table(id uuid,full_name text,registry_community_id text)
language sql stable security definer set search_path=public as $$
  select id,full_name,registry_community_id from public.teachers
  where length(trim(search_name)) between 3 and 150 and registry_community_id=target_community
    and (normalized_name like '%' || public.normalized_label(search_name) || '%'
      or split_part(normalized_name,' ',1)=split_part(public.normalized_label(search_name),' ',1))
  order by (normalized_name=public.normalized_label(search_name)) desc,full_name limit 6;
$$;
revoke all on function public.suggest_teachers(text,text) from public;
grant execute on function public.suggest_teachers(text,text) to anon,authenticated;
create or replace function public.save_publication(item jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare previous public.content_items; target_id text:=item->>'id'; author uuid; target_community text:=nullif(item->>'communityId',''); target_status text:=item->>'status';
begin
  if coalesce(public.current_app_role(),'') not in ('superadmin','community_leader') then raise exception 'Acceso denegado.' using errcode='42501'; end if;
  select * into previous from public.content_items where id=target_id for update;
  author:=coalesce(previous.author_id,auth.uid());
  if previous.id is not null and not public.can_write_content(previous.author_id,previous.community_id,previous.group_id,previous.kind,previous.status)
    then raise exception 'No puedes modificar esta publicación.' using errcode='42501'; end if;
  if not public.can_write_content(author,target_community,null,item->>'kind',target_status)
    then raise exception 'No puedes publicar fuera de tu comunidad ni aprobar publicaciones.' using errcode='42501'; end if;
  if length(trim(item->>'title'))=0 or item->>'kind' not in ('Noticia','Evento','Convocatoria','Proyecto','El Churo','Seguimiento')
    or target_status not in ('Borrador','En revisión','Aprobada','Rechazada') then raise exception 'Publicación inválida.'; end if;
  insert into public.content_items(id,title,kind,section,status,data,author_id,community_id,published_at)
  values(target_id,trim(item->>'title'),item->>'kind',coalesce(item->>'section','Consejo'),target_status,item,author,target_community,
    case when target_status='Aprobada' then now() end)
  on conflict(id) do update set title=excluded.title,kind=excluded.kind,section=excluded.section,status=excluded.status,
    data=excluded.data,community_id=excluded.community_id,published_at=excluded.published_at,updated_at=now();
  if exists(select 1 from public.event_registrations where event_id=target_id) and item->>'kind'<>'Evento'
    then raise exception 'El evento ya tiene inscripciones; conserva su tipo.'; end if;
  if item->>'kind'<>'Proyecto' then delete from public.projects where content_id=target_id; end if;
  if item->>'kind'<>'Evento' then delete from public.agenda_events where content_id=target_id; end if;
  if item->>'kind'<>'El Churo' then delete from public.churo_editions where content_id=target_id; end if;
  if item->>'kind'='Proyecto' then
    insert into public.projects values(target_id,item->>'state',nullif(item->>'startsOn','')::date,nullif(item->>'endsOn','')::date,
      item->>'body',coalesce((item->>'progress')::numeric,0))
    on conflict(content_id) do update set state=excluded.state,starts_on=excluded.starts_on,ends_on=excluded.ends_on,objective=excluded.objective,progress=excluded.progress;
  elsif item->>'kind'='Evento' then
    insert into public.agenda_events values(target_id,(item->>'startsAt')::timestamptz,nullif(item->>'endsAt','')::timestamptz,item->>'place')
    on conflict(content_id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,place=excluded.place;
  elsif item->>'kind'='El Churo' then
    insert into public.churo_editions values(target_id,item->>'edition',(item->>'publicationDate')::date,item->>'document')
    on conflict(content_id) do update set edition_number=excluded.edition_number,publication_date=excluded.publication_date,document_path=excluded.document_path;
  end if;
  return target_id;
end;
$$;
revoke all on function public.save_publication(jsonb) from public;
grant execute on function public.save_publication(jsonb) to authenticated;
do $$ begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists guajui_file_insert on storage.objects;
    drop policy if exists guajui_file_update on storage.objects;
    create policy guajui_file_insert on storage.objects for insert to authenticated
      with check(bucket_id in ('guajui-public','guajui-private') and public.is_guajui_owner());
    create policy guajui_file_update on storage.objects for update to authenticated
      using(bucket_id in ('guajui-public','guajui-private') and public.is_guajui_owner())
      with check(bucket_id in ('guajui-public','guajui-private') and public.is_guajui_owner());
  end if;
end $$;
create or replace function public.platform_access_ready()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.app_schema_versions where version='20261103190000');
$$;
revoke all on function public.platform_access_ready() from public;
grant execute on function public.platform_access_ready() to anon,authenticated;
create or replace function public.can_request_platform_access(target_email text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.access_grants where email=lower(trim(target_email)) and active);
$$;
revoke all on function public.can_request_platform_access(text) from public;
grant execute on function public.can_request_platform_access(text) to anon,authenticated;
drop trigger if exists platform_access_audit on public.access_grants;
create trigger platform_access_audit after insert or update or delete on public.access_grants
  for each row execute function app_private.audit_change();
insert into public.app_schema_versions(version) values('20261103190000') on conflict do nothing;
revoke all on all functions in schema app_private from public,anon,authenticated;
