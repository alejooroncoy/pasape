import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { Zone } from "../domain/Zone";

// Gestión de puertas (zones) + su relación N:M con tipos de entrada
// (zone_ticket_types). Acceso directo a supabaseAdmin como el resto de servicios
// de scanning/zonas; los controllers ya verifican que el caller es miembro de la
// org del evento antes de llamar aquí, así que `eventId` llega autorizado.

type ZoneRow = {
  id: string;
  event_id: string;
  name: string;
  is_default: boolean;
  zone_ticket_types: { ticket_type_id: string }[] | null;
};

const toZone = (r: ZoneRow): Zone => ({
  id: r.id,
  eventId: r.event_id,
  name: r.name,
  isDefault: r.is_default,
  // La principal valida todas: su lista explícita no se usa.
  ticketTypeIds: r.is_default
    ? []
    : (r.zone_ticket_types ?? []).map((t) => t.ticket_type_id),
});

const SELECT = "id, event_id, name, is_default, zone_ticket_types(ticket_type_id)";

export async function listZones(eventId: string): Promise<Zone[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("zones")
    .select(SELECT)
    .eq("event_id", eventId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return ((data as ZoneRow[] | null) ?? []).map(toZone);
}

/** ticket_type_ids válidos del evento entre los pedidos (filtra ajenos). */
async function validTicketTypeIds(
  eventId: string,
  ids: string[],
): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const db = supabaseAdmin();
  const { data } = await db
    .from("ticket_types")
    .select("id")
    .eq("event_id", eventId)
    .in("id", unique);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
}

async function setZoneTicketTypes(
  zoneId: string,
  ticketTypeIds: string[],
): Promise<void> {
  const db = supabaseAdmin();
  await db.from("zone_ticket_types").delete().eq("zone_id", zoneId);
  if (ticketTypeIds.length > 0) {
    await db
      .from("zone_ticket_types")
      .insert(ticketTypeIds.map((id) => ({ zone_id: zoneId, ticket_type_id: id })));
  }
}

export async function createZone(
  eventId: string,
  input: { name: string; ticketTypeIds: string[]; isDefault?: boolean },
): Promise<Result<Zone>> {
  const name = input.name.trim();
  if (!name) return err("name_required");
  const isDefault = input.isDefault ?? false;

  const db = supabaseAdmin();
  // Solo puede existir UNA puerta principal por evento (la que valida todas).
  if (isDefault) {
    const { data: existing } = await db
      .from("zones")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_default", true)
      .maybeSingle();
    if (existing) return err("default_exists");
  }

  const { data, error } = await db
    .from("zones")
    .insert({ event_id: eventId, name, is_default: isDefault })
    .select("id")
    .single<{ id: string }>();
  // 23505 = choca con unique(event_id, name).
  if (error?.code === "23505") return err("name_taken");
  if (error || !data) return err(error?.message ?? "zone_create_failed");

  // La principal valida todas: no fija entradas. Las custom sí.
  const ids = isDefault ? [] : await validTicketTypeIds(eventId, input.ticketTypeIds);
  if (!isDefault) await setZoneTicketTypes(data.id, ids);

  return ok({ id: data.id, eventId, name, isDefault, ticketTypeIds: ids });
}

export async function updateZone(
  eventId: string,
  zoneId: string,
  input: { name?: string; ticketTypeIds?: string[] },
): Promise<Result<Zone>> {
  const db = supabaseAdmin();
  const { data: current } = await db
    .from("zones")
    .select("is_default")
    .eq("id", zoneId)
    .eq("event_id", eventId)
    .maybeSingle<{ is_default: boolean }>();
  if (!current) return err("not_found");

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return err("name_required");
    const { error } = await db
      .from("zones")
      .update({ name })
      .eq("id", zoneId)
      .eq("event_id", eventId);
    if (error?.code === "23505") return err("name_taken");
    if (error) return err(error.message);
  }

  if (input.ticketTypeIds !== undefined) {
    const ids = await validTicketTypeIds(eventId, input.ticketTypeIds);
    await setZoneTicketTypes(zoneId, ids);
  }

  const { data } = await db
    .from("zones")
    .select(SELECT)
    .eq("id", zoneId)
    .single<ZoneRow>();
  return data ? ok(toZone(data)) : err("not_found");
}

export async function deleteZone(
  eventId: string,
  zoneId: string,
): Promise<Result<{ id: string }>> {
  const db = supabaseAdmin();
  const { data: current } = await db
    .from("zones")
    .select("is_default")
    .eq("id", zoneId)
    .eq("event_id", eventId)
    .maybeSingle<{ is_default: boolean }>();
  if (!current) return err("not_found");

  // Invariante: el evento nunca queda sin puertas. Se puede quitar la principal
  // (caso estadio: solo puertas específicas) pero NO la última que quede.
  const { count } = await db
    .from("zones")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((count ?? 0) <= 1) return err("last_zone");

  // zone_ticket_types y scanner_sessions.zone_id caen por FK (cascade / set null).
  const { error } = await db
    .from("zones")
    .delete()
    .eq("id", zoneId)
    .eq("event_id", eventId);
  if (error) return err(error.message);
  return ok({ id: zoneId });
}
