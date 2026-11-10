-- El encuestador registra directamente altas y actualizaciones del censo.
-- Las solicitudes históricas se conservan, pero el nuevo flujo no las crea.
drop policy if exists admin_manage on public.census_records;
drop policy if exists community_read on public.census_records;
create policy census_admin_manage on public.census_records for all to authenticated
  using (public.is_guajui_owner()) with check (public.is_guajui_owner());
create policy census_enumerator_insert on public.census_records for insert to authenticated
  with check (public.current_app_role()='enumerator' and community_id=public.current_app_community() and collected_by=auth.uid());
create policy census_enumerator_update on public.census_records for update to authenticated
  using (public.current_app_role()='enumerator' and community_id=public.current_app_community())
  with check (public.current_app_role()='enumerator' and community_id=public.current_app_community());
create policy census_community_read on public.census_records for select to authenticated using (public.can_read_census(community_id));
grant insert, update on public.census_records to authenticated;

create or replace function public.submit_census_batch(items jsonb)
returns table(id text) language plpgsql security invoker set search_path=public as $$
declare item jsonb; record_id text; changes jsonb; is_new boolean; cid text;
begin
  if public.current_app_role() <> 'enumerator' then raise exception 'Solo el personal encuestador puede registrar o actualizar personas del censo.' using errcode='42501'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 200 then raise exception 'Lote inválido.'; end if;
  for item in select value from jsonb_array_elements(items) loop
    record_id := item->>'recordId'; changes := coalesce(item->'changes','{}'::jsonb); is_new := coalesce((item->>'isNew')::boolean,false);
    cid := public.resolve_community(changes->>'community');
    if cid is null or cid <> public.current_app_community() then raise exception 'El registro no pertenece a tu comunidad.' using errcode='42501'; end if;
    if is_new then insert into public.census_records(id,answers,collected_by) values(record_id,changes,auth.uid());
    else update public.census_records set answers=answers || changes, collected_by=auth.uid() where id=record_id and community_id=cid and archived_at is null;
      if not found then raise exception 'La persona censada no existe o no pertenece a tu comunidad.'; end if;
    end if;
    id := record_id; return next;
  end loop;
end;
$$;
revoke all on function public.submit_census_batch(jsonb) from public, anon;
grant execute on function public.submit_census_batch(jsonb) to authenticated;
insert into public.app_schema_versions(version) values('20261104240000') on conflict do nothing;
