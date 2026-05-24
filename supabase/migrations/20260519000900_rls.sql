-- Helper: resolve profile id from Firebase JWT (sub claim = firebase_uid)
create or replace function auth_profile_id() returns uuid
language sql stable security definer as $$
  select id from profiles
  where firebase_uid = coalesce(auth.jwt() ->> 'sub', '')
  limit 1
$$;

create or replace function is_org_member(target_org uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from org_memberships
    where organization_id = target_org and profile_id = auth_profile_id()
  )
$$;

create or replace function org_role_of(target_org uuid) returns text
language sql stable security definer as $$
  select role from org_memberships
  where organization_id = target_org and profile_id = auth_profile_id()
  limit 1
$$;

-- Enable RLS
alter table profiles            enable row level security;
alter table kyc_documents       enable row level security;
alter table notifications       enable row level security;
alter table organizations       enable row level security;
alter table org_memberships     enable row level security;
alter table org_invites         enable row level security;
alter table follows             enable row level security;
alter table events              enable row level security;
alter table event_co_organizers enable row level security;
alter table event_staff         enable row level security;
alter table ticket_types        enable row level security;
alter table orders              enable row level security;
alter table tickets             enable row level security;
alter table ticket_transfers    enable row level security;
alter table holds               enable row level security;
alter table payments            enable row level security;
alter table refunds             enable row level security;
alter table promoter_links      enable row level security;
alter table promoter_applications enable row level security;
alter table payouts             enable row level security;
alter table incentives          enable row level security;
alter table incentive_unlocks   enable row level security;
alter table boxes               enable row level security;
alter table box_members         enable row level security;
alter table scan_events         enable row level security;

-- profiles: dueño puede leer/escribir lo suyo
create policy profiles_self on profiles
  for all using (id = auth_profile_id()) with check (id = auth_profile_id());

create policy kyc_self on kyc_documents
  for all using (profile_id = auth_profile_id()) with check (profile_id = auth_profile_id());

create policy notifications_self on notifications
  for all using (profile_id = auth_profile_id()) with check (profile_id = auth_profile_id());

-- organizations: miembros leen; cualquier autenticado puede crear (set creator)
create policy organizations_member_read on organizations
  for select using (is_org_member(id));
create policy organizations_insert on organizations
  for insert with check (created_by = auth_profile_id());
create policy organizations_owner_update on organizations
  for update using (org_role_of(id) in ('owner','admin'));

create policy org_memberships_self_or_admin_read on org_memberships
  for select using (
    profile_id = auth_profile_id()
    or org_role_of(organization_id) in ('owner','admin')
  );
create policy org_memberships_admin_write on org_memberships
  for all using (org_role_of(organization_id) in ('owner','admin'))
  with check (org_role_of(organization_id) in ('owner','admin'));

create policy org_invites_admin on org_invites
  for all using (org_role_of(organization_id) in ('owner','admin'))
  with check (org_role_of(organization_id) in ('owner','admin'));

create policy follows_self on follows
  for all using (follower_id = auth_profile_id())
  with check (follower_id = auth_profile_id());

-- events: público lee published; miembros de la org tienen acceso completo a sus eventos
create policy events_public_read on events
  for select using (status = 'published' or is_org_member(organization_id));
create policy events_member_write on events
  for all using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create policy event_co_organizers_member on event_co_organizers
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy event_staff_member on event_staff
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
    or profile_id = auth_profile_id()
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy ticket_types_public_read on ticket_types
  for select using (
    exists(select 1 from events e where e.id = event_id and (e.status='published' or is_org_member(e.organization_id)))
  );
create policy ticket_types_member_write on ticket_types
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

-- orders / tickets: comprador ve los suyos; org ve los de sus eventos
create policy orders_buyer_or_org on orders
  for select using (
    buyer_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
create policy orders_buyer_insert on orders
  for insert with check (buyer_id = auth_profile_id());

create policy tickets_holder_or_org on tickets
  for select using (
    current_holder = auth_profile_id()
    or exists(
      select 1 from orders o join events e on e.id = o.event_id
      where o.id = order_id and is_org_member(e.organization_id)
    )
  );
create policy tickets_holder_update on tickets
  for update using (current_holder = auth_profile_id())
  with check (current_holder = auth_profile_id());

create policy ticket_transfers_party on ticket_transfers
  for select using (from_profile = auth_profile_id() or to_profile = auth_profile_id());
create policy ticket_transfers_initiate on ticket_transfers
  for insert with check (from_profile = auth_profile_id());

create policy holds_buyer on holds
  for all using (buyer_id = auth_profile_id())
  with check (buyer_id = auth_profile_id());

create policy payments_party on payments
  for select using (
    exists(select 1 from orders o where o.id = order_id and (
      o.buyer_id = auth_profile_id()
      or exists(select 1 from events e where e.id = o.event_id and is_org_member(e.organization_id))
    ))
  );

create policy refunds_party on refunds
  for select using (
    exists(select 1 from payments p join orders o on o.id = p.order_id
      where p.id = payment_id and (
        o.buyer_id = auth_profile_id()
        or exists(select 1 from events e where e.id = o.event_id and is_org_member(e.organization_id))
      ))
  );

-- promoters
create policy promoter_links_party on promoter_links
  for select using (
    promoter_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
create policy promoter_links_member_write on promoter_links
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy promoter_apps_party on promoter_applications
  for select using (
    applicant_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
create policy promoter_apps_insert on promoter_applications
  for insert with check (applicant_id = auth_profile_id());
create policy promoter_apps_decide on promoter_applications
  for update using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy payouts_party on payouts
  for select using (
    promoter_id = auth_profile_id()
    or exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

-- incentives: lectura pública (para mostrar metas a los promotores/compradores)
create policy incentives_read on incentives for select using (true);
create policy incentives_member_write on incentives
  for all using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  ) with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy incentive_unlocks_self_or_org on incentive_unlocks
  for select using (
    profile_id = auth_profile_id()
    or exists(
      select 1 from incentives i join events e on e.id = i.event_id
      where i.id = incentive_id and is_org_member(e.organization_id)
    )
  );

-- boxes: dueño y miembros leen
create policy boxes_party on boxes
  for select using (
    exists(select 1 from orders o where o.id = order_id and o.buyer_id = auth_profile_id())
    or exists(select 1 from box_members bm where bm.box_id = id and bm.profile_id = auth_profile_id())
  );
create policy box_members_self on box_members
  for select using (
    profile_id = auth_profile_id()
    or exists(select 1 from boxes b join orders o on o.id = b.order_id
      where b.id = box_id and o.buyer_id = auth_profile_id())
  );

-- scanning
create policy scan_events_org on scan_events
  for select using (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
create policy scan_events_insert on scan_events
  for insert with check (
    exists(select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );
