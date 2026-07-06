-- Endurecimiento RLS (auditoría v2, jul 2026).
-- Restringe mutaciones PostgREST a owner/admin/editor; oculta PII operativa
-- a reporter/door; impide que admin se auto-promueva a owner.

create or replace function is_org_staff_write(target_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select org_role_of(target_org) in ('owner', 'admin', 'editor')
$$;

create or replace function is_org_staff_read(target_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select org_role_of(target_org) in ('owner', 'admin', 'editor', 'reporter')
$$;

-- events
drop policy if exists events_member_write on events;
create policy events_staff_write on events
  for all using (is_org_staff_write(organization_id))
  with check (is_org_staff_write(organization_id));

-- ticket_types
drop policy if exists ticket_types_member_write on ticket_types;
create policy ticket_types_staff_write on ticket_types
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  );

-- orders: org staff con rol editor+ ve órdenes; door/reporter no vía PostgREST
drop policy if exists orders_buyer_or_org on orders;
create policy orders_buyer_or_staff on orders
  for select using (
    buyer_id = auth_profile_id()
    or exists(
      select 1 from events e
      where e.id = event_id and is_org_staff_read(e.organization_id)
    )
  );

-- tickets: holder o staff editor+ (reporter sin PII masiva vía API server)
drop policy if exists tickets_holder_or_org on tickets;
create policy tickets_holder_or_staff on tickets
  for select using (
    current_holder = auth_profile_id()
    or exists(
      select 1 from orders o join events e on e.id = o.event_id
      where o.id = order_id and is_org_staff_read(e.organization_id)
    )
  );

-- scan_events: insert solo staff editor+ (portero usa service-role + sesión)
drop policy if exists scan_events_insert on scan_events;
create policy scan_events_staff_insert on scan_events
  for insert with check (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  );

-- event_access_codes: solo staff editor+ (secretos de puerta)
drop policy if exists event_access_codes_member on event_access_codes;
create policy event_access_codes_staff on event_access_codes
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  );

-- promoter_applications: aprobar solo owner/admin/editor
drop policy if exists promoter_apps_decide on promoter_applications;
create policy promoter_apps_staff_decide on promoter_applications
  for update using (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  );

-- promoter_links write
drop policy if exists promoter_links_member_write on promoter_links;
create policy promoter_links_staff_write on promoter_links
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_staff_write(e.organization_id))
  );

-- memberships: solo owner puede otorgar rol owner
drop policy if exists memberships_owner_insert on memberships;
create policy memberships_owner_insert on memberships
  for insert with check (
    (
      (scope_type = 'portfolio' and scope_id = auth_profile_id())
      or (scope_type = 'legal_entity' and owns_legal_entity(scope_id))
      or (scope_type = 'organization' and org_role_of(scope_id) in ('owner','admin'))
    )
    and (
      role <> 'owner'
      or (scope_type = 'organization' and org_role_of(scope_id) = 'owner')
      or scope_type <> 'organization'
    )
  );

-- org_promoters UPDATE: solo owner/admin (claim_token vive en filas del pool)
drop policy if exists org_promoters_admin_update on org_promoters;
create policy org_promoters_owner_admin_update on org_promoters
  for update using (org_role_of(organization_id) in ('owner', 'admin'))
  with check (org_role_of(organization_id) in ('owner', 'admin'));
