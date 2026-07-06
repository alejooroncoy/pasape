-- M9 + grants complementarios (auditoría v2, jul 2026).
--
-- Cierra lectura del roster vía PostgREST para roles operativos (door/reporter).
-- La app legítima usa supabaseAdmin (service-role) en /api/* — esto NO afecta UI.
--
-- Requiere is_org_staff_write / is_org_staff_read de audit_v2_rls_hardening.

-- ── memberships: roster solo owner/admin/editor ─────────────────────────────
drop policy if exists memberships_owner_select on memberships;

create policy memberships_roster_select on memberships
  for select using (
    (scope_type = 'portfolio' and scope_id = auth_profile_id())
    or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
    or (
      scope_type = 'organization'
      and org_role_of(scope_id) in ('owner', 'admin', 'editor')
    )
  );
-- memberships_self_select sigue permitiendo ver la propia fila (door/reporter).

-- ── event_co_organizers: mutaciones solo staff editor+ ──────────────────────
drop policy if exists event_co_organizers_member on event_co_organizers;

create policy event_co_organizers_staff_read on event_co_organizers
  for select using (
    profile_id = auth_profile_id()
    or exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_read(e.organization_id)
    )
  );

create policy event_co_organizers_staff_write on event_co_organizers
  for insert with check (
    exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_write(e.organization_id)
    )
  );

create policy event_co_organizers_staff_delete on event_co_organizers
  for delete using (
    exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_write(e.organization_id)
    )
  );

-- ── event_staff: lectura propia o staff editor+; escritura solo editor+ ─────
drop policy if exists event_staff_member on event_staff;

create policy event_staff_self_or_staff_read on event_staff
  for select using (
    profile_id = auth_profile_id()
    or exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_read(e.organization_id)
    )
  );

create policy event_staff_staff_insert on event_staff
  for insert with check (
    exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_write(e.organization_id)
    )
  );

create policy event_staff_staff_update on event_staff
  for update using (
    exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_write(e.organization_id)
    )
  ) with check (
    exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_write(e.organization_id)
    )
  );

create policy event_staff_staff_delete on event_staff
  for delete using (
    exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_write(e.organization_id)
    )
  );
