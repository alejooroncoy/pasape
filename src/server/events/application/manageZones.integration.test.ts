import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Integración de la gestión de puertas (zones) contra el Supabase remoto.
// Ejercita ManageZones real (sin mocks: estas funciones no usan next/headers ni
// auth — el controller ya autoriza). Reutiliza un evento de dev y limpia.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const EVENT_ID = "d994149d-39d9-45e7-b10e-0251d0fb3e56"; // reverb-x-la-selva-kx39
const NAME_A = "ZTEST_Puerta_Norte";
const NAME_B = "ZTEST_Puerta_Renombrada";

const { listZones, createZone, updateZone, deleteZone } = await import(
  "./ManageZones"
);
const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

let ticketTypeId = "";

beforeAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  const { data } = await db
    .from("ticket_types")
    .select("id")
    .eq("event_id", EVENT_ID)
    .order("position")
    .limit(1)
    .maybeSingle<{ id: string }>();
  ticketTypeId = data?.id ?? "";
});

afterAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  await db
    .from("zones")
    .delete()
    .eq("event_id", EVENT_ID)
    .in("name", [NAME_A, NAME_B]);
  // Dejar el evento sano: siempre con al menos una puerta "Principal".
  const { count } = await db
    .from("zones")
    .select("*", { count: "exact", head: true })
    .eq("event_id", EVENT_ID);
  if ((count ?? 0) === 0) {
    await db
      .from("zones")
      .insert({ event_id: EVENT_ID, name: "Principal", is_default: true });
  }
});

describe.skipIf(!hasCreds)("gestión de puertas (integración)", () => {
  it("la puerta principal existe, es default y no fija entradas", async () => {
    const zones = await listZones(EVENT_ID);
    const principal = zones.find((z) => z.isDefault);
    expect(principal).toBeTruthy();
    expect(principal?.ticketTypeIds).toEqual([]);
  });

  it("crea una puerta custom con las entradas que valida", async () => {
    const res = await createZone(EVENT_ID, {
      name: NAME_A,
      ticketTypeIds: [ticketTypeId],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.isDefault).toBe(false);
    expect(res.value.ticketTypeIds).toEqual([ticketTypeId]);

    const zones = await listZones(EVENT_ID);
    expect(zones.some((z) => z.name === NAME_A)).toBe(true);
  });

  it("rechaza un nombre de puerta duplicado", async () => {
    const res = await createZone(EVENT_ID, { name: NAME_A, ticketTypeIds: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("name_taken");
  });

  it("renombra y reemplaza las entradas de una puerta", async () => {
    const before = (await listZones(EVENT_ID)).find((z) => z.name === NAME_A);
    expect(before).toBeTruthy();

    const res = await updateZone(EVENT_ID, before!.id, {
      name: NAME_B,
      ticketTypeIds: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.name).toBe(NAME_B);
    expect(res.value.ticketTypeIds).toEqual([]);
  });

  it("ignora ticket_types ajenos al evento", async () => {
    const res = await createZone(EVENT_ID, {
      name: NAME_A,
      ticketTypeIds: ["00000000-0000-0000-0000-000000000000"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.ticketTypeIds).toEqual([]); // el id falso se descarta
  });

  it("ya no hay puerta inmutable: la inicial también se puede renombrar", async () => {
    const initial = (await listZones(EVENT_ID)).find((z) => z.isDefault);
    if (!initial) return;
    // Renombrar a su mismo nombre: basta con que NO devuelva cannot_edit_default.
    const res = await updateZone(EVENT_ID, initial.id, { name: initial.name });
    expect(res.ok).toBe(true);
  });

  it("borra una puerta custom y arrastra su relación de entradas", async () => {
    const zones = await listZones(EVENT_ID);
    const custom = zones.find((z) => z.name === NAME_A || z.name === NAME_B)!;
    const res = await deleteZone(EVENT_ID, custom.id);
    expect(res.ok).toBe(true);

    const db = supabaseAdmin();
    const { count } = await db
      .from("zone_ticket_types")
      .select("*", { count: "exact", head: true })
      .eq("zone_id", custom.id);
    expect(count).toBe(0);
  });

  it("nunca deja el evento sin puertas (last_zone)", async () => {
    // Reducir a una sola puerta y verificar que esa última no se puede borrar.
    let zs = await listZones(EVENT_ID);
    while (zs.length > 1) {
      await deleteZone(EVENT_ID, zs[0].id);
      zs = await listZones(EVENT_ID);
    }
    const del = await deleteZone(EVENT_ID, zs[0].id);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error).toBe("last_zone");
  });
});
