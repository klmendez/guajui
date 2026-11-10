-- Solo los encuestadores insertan solicitudes; el administrador las revisa.
drop policy if exists admin_manage on public.census_requests;
drop policy if exists admin_read_requests on public.census_requests;
create policy admin_read_requests on public.census_requests for select to authenticated
  using (public.is_guajui_owner());
drop policy if exists admin_update_requests on public.census_requests;
create policy admin_update_requests on public.census_requests for update to authenticated
  using (public.is_guajui_owner()) with check (public.is_guajui_owner());
drop policy if exists admin_delete_requests on public.census_requests;
create policy admin_delete_requests on public.census_requests for delete to authenticated
  using (public.is_guajui_owner());
insert into public.app_schema_versions(version) values('20261104230000') on conflict do nothing;
