-- Why: las pantallas de "esperando aprobación" (promotor) y de "BOX X/Y" hacían
-- polling cada 5s / 8s contra la API → carga constante a la DB aunque no pase
-- nada. Estos datos cambian de golpe (te aprueban, alguien se une) pero NO todo
-- el tiempo. Igual que los KPIs del panel, usamos Broadcast desde la DB: un
-- trigger emite un "ping" liviano al topic correspondiente y el cliente
-- refetchea por la API autenticada (con RLS). El payload no lleva datos
-- sensibles, así que el topic público no filtra nada.

-- ── Promotores: aprobación / rechazo de solicitudes ───────────────────────────
-- El topic se llavea por slug del evento (que tanto el postulante como el
-- organizador conocen). El trigger resuelve el slug desde event_id.
create or replace function broadcast_promoter_app_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  select e.slug into v_slug
    from public.events e
   where e.id = coalesce(new.event_id, old.event_id);
  if v_slug is not null then
    perform realtime.send(
      jsonb_build_object('event_slug', v_slug),
      'application_changed',
      'promoter-app:' || v_slug,
      false  -- topic público: ping sin datos, solo dispara refetch
    );
  end if;
  return null; -- AFTER trigger: el retorno se ignora
end;
$$;

-- insert = nueva solicitud (el organizador la ve aparecer en vivo)
-- update of status = aprobada/rechazada/cancelada (el postulante lo ve al toque)
drop trigger if exists promoter_app_broadcast on promoter_applications;
create trigger promoter_app_broadcast
  after insert or update of status on promoter_applications
  for each row execute function broadcast_promoter_app_change();

-- ── Boxes: contador de integrantes en vivo ────────────────────────────────────
-- El topic se llavea por invite_token del box (que es lo que comparte el host y
-- por donde se unen los invitados). El trigger lo resuelve desde box_id.
create or replace function broadcast_box_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select b.invite_token into v_token
    from public.boxes b
   where b.id = coalesce(new.box_id, old.box_id);
  if v_token is not null then
    perform realtime.send(
      jsonb_build_object('token', v_token),
      'box_changed',
      'box:' || v_token,
      false  -- topic público: ping sin datos, solo dispara refetch
    );
  end if;
  return null;
end;
$$;

-- Cada vez que alguien se une o sale, se mueve el "X/Y".
drop trigger if exists box_members_broadcast on box_members;
create trigger box_members_broadcast
  after insert or delete on box_members
  for each row execute function broadcast_box_change();

-- Endurecimiento (igual que broadcast_event_stats_change): no callable como RPC.
revoke execute on function broadcast_promoter_app_change() from public, anon, authenticated;
revoke execute on function broadcast_box_change() from public, anon, authenticated;
