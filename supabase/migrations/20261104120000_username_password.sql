-- Identificadores de ingreso; las contraseñas las administra Supabase Auth.
alter table public.access_grants add column if not exists login_username text;
update public.access_grants set login_username='admin'
where email='planetnodesarrolloguapi@gmail.com' and login_username is null;
create unique index if not exists platform_login_username_unique
  on public.access_grants(login_username) where login_username is not null;
alter table public.access_grants add constraint platform_login_username_format
  check(login_username is null or login_username ~ '^[a-z][a-z0-9._-]{2,39}$');
update public.profiles p set username=g.login_username
from public.access_grants g join auth.users u on lower(u.email)=g.email
where p.id=u.id and g.login_username is not null;

create or replace function app_private.bootstrap_profile()
returns trigger language plpgsql security definer set search_path=public as $$
declare access public.access_grants;
begin
  select * into access from public.access_grants where email=lower(new.email) and active;
  if new.email_confirmed_at is not null then
    insert into public.profiles(id,username,role,community_id,active)
    values(new.id,coalesce(access.login_username,new.email,'usuario-' || new.id::text),
      access.role,access.community_id,coalesce(access.active,false))
    on conflict(id) do update set username=excluded.username,role=excluded.role,
      community_id=excluded.community_id,active=excluded.active,updated_at=now();
  end if;
  return new;
end;
$$;

-- Solo el servicio del servidor puede configurar identidades de ingreso.
-- El servidor valida primero el token y el rol del solicitante.
create or replace function public.configure_platform_user(
  account_email text,account_username text,account_role text,
  account_community text,account_active boolean)
returns void language plpgsql security definer set search_path=public as $$
declare email_key text:=lower(trim(account_email)); login text:=lower(trim(account_username));
begin
  if login is null or login !~ '^[a-z][a-z0-9._-]{2,39}$' then raise exception 'Usuario inválido.'; end if;
  if login='admin' and email_key<>'planetnodesarrolloguapi@gmail.com' then
    raise exception 'El usuario admin está reservado al superadministrador inicial.';
  end if;
  insert into public.access_grants(email,login_username,role,community_id,active)
    values(email_key,login,account_role,case when account_role='superadmin' then null else account_community end,account_active)
    on conflict(email) do update set login_username=excluded.login_username,role=excluded.role,
      community_id=excluded.community_id,active=excluded.active;
  update public.profiles p set username=login,role=account_role,active=account_active,
    community_id=case when account_role='superadmin' then null else account_community end,updated_at=now()
  from auth.users u where u.id=p.id and lower(u.email)=email_key;
end;
$$;
revoke all on function public.configure_platform_user(text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.configure_platform_user(text,text,text,text,boolean) to service_role;
revoke all on function public.can_request_platform_access(text) from anon,authenticated;
create or replace function public.platform_access_ready()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.app_schema_versions where version='20261104120000');
$$;
revoke all on all functions in schema app_private from public,anon,authenticated;
insert into public.app_schema_versions(version) values('20261104120000') on conflict do nothing;
