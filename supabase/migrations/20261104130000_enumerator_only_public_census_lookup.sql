-- El censo público permite consultar estado, pero no crear ni cambiar registros.
-- Solo los encuestadores pueden enviar altas o actualizaciones censales.

drop policy if exists scoped_census_submit on public.census_requests;
revoke insert on public.census_requests from anon;
create policy scoped_census_submit on public.census_requests
  for insert to authenticated
  with check (
    public.current_app_role() = 'enumerator'
    and community_id = public.current_app_community()
    and collected_by = auth.uid()
    and status = 'Pendiente'
    and decided_at is null
    and decided_by is null
  );

create or replace function public.submit_census_batch(items jsonb)
returns table(id text) language plpgsql security invoker set search_path=public as $$
begin
  if coalesce(public.current_app_role(), '') <> 'enumerator' then
    raise exception 'Solo el personal encuestador puede registrar o actualizar personas del censo.'
      using errcode='42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 200 then
    raise exception 'Lote inválido.';
  end if;
  return query insert into public.census_requests(id,record_id,changes,is_new,missing_birth_date_access)
    select value->>'id',value->>'recordId',value->'changes',coalesce((value->>'isNew')::boolean,false),
      coalesce((value->>'missingBirthDateAccess')::boolean,false)
    from jsonb_array_elements(items)
    returning census_requests.id;
end;
$$;
revoke all on function public.submit_census_batch(jsonb) from public, anon;
grant execute on function public.submit_census_batch(jsonb) to authenticated;

-- Los registros definitivos solo se insertan al aprobar una solicitud mediante
-- decide_census_request, que valida que quien decide sea el superadministrador.
revoke insert on public.census_records from anon, authenticated;

create or replace function public.lookup_census_presence(identity_document text, target_community text)
returns table(in_census boolean, certificate_available boolean)
language plpgsql stable security definer set search_path=public as $$
declare normalized_document text := lower(regexp_replace(coalesce(identity_document, ''), '[^[:alnum:]]', '', 'g'));
begin
  if length(normalized_document) not between 4 and 30
    or not exists(select 1 from public.communities c where c.id=target_community) then
    return query select false, false;
    return;
  end if;

  return query
  select exists (
    select 1 from public.census_records r
    where r.community_id=target_community
      and r.archived_at is null
      and lower(regexp_replace(coalesce(r.answers->>'documentNumber', ''), '[^[:alnum:]]', '', 'g'))=normalized_document
  ), exists (
    select 1 from public.certificates cert
    join public.census_records r on r.id=cert.record_id
    where cert.community_id=target_community
      and cert.revoked_at is null
      and r.community_id=target_community
      and r.archived_at is null
      and lower(regexp_replace(coalesce(r.answers->>'documentNumber', ''), '[^[:alnum:]]', '', 'g'))=normalized_document
  );
end;
$$;
revoke all on function public.lookup_census_presence(text,text) from public;
grant execute on function public.lookup_census_presence(text,text) to anon, authenticated;

insert into public.app_schema_versions(version) values('20261104130000') on conflict do nothing;
