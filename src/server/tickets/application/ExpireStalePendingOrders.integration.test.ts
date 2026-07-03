import { afterAll, describe, expect, it } from "vitest";

// Integración de la expiración de órdenes pending contra el Supabase remoto.
// La lógica vive 100% en Postgres (función `expire_stale_pending_orders()`,
// migración 20260608110000_event_stats_and_order_expiry.sql) agendada por
// pg_cron cada minuto — pero la función SÍ es invocable directamente vía RPC,
// no solo desde el cron, así que la ejercitamos igual que el job lo haría.
// No hay contraparte en TypeScript: nada que testear ahí además de esto.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const EVENT_ID = "d994149d-39d9-45e7-b10e-0251d0fb3e56"; // reverb-x-la-selva-kx39

const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

const RUN = Date.now();

type OrderRow = { id: string };
type TicketTypeRow = { id: string };

const profileIds: string[] = [];
const orderIds: string[] = [];
const ticketTypeIds: string[] = [];

// Crea un ticket_type descartable propio del test en vez de reusar uno de la
// data de dev: el rollup de `sold` en un ticket_type real puede moverse en
// cualquier momento por el pg_cron real (corre cada minuto sobre TODAS las
// órdenes pending viejas del evento), lo que vuelve flaky comparar `sold`
// antes/después contra un valor absoluto compartido.
const createTicketType = async (): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ticket_types")
    .insert({
      event_id: EVENT_ID,
      name: `ZTEST_expire_${RUN}`,
      kind: "general",
      price_cents: 3000,
      capacity: 100,
      sold: 0,
    })
    .select("id")
    .single<TicketTypeRow>();
  if (error || !data) throw new Error(`fixture ticket_type failed: ${error?.message}`);
  ticketTypeIds.push(data.id);
  return data.id;
};

// profiles.id es FK a auth.users(id) (migración a Supabase Auth) — no se puede
// insertar un profile directo. Creamos un auth user; el trigger
// handle_new_user inserta la row de profile automáticamente.
const createProfile = async (tag: string): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db.auth.admin.createUser({
    email: `vitest-expire-order-${tag}-${RUN}@example.com`,
    email_confirm: true,
    user_metadata: { full_name: `Vitest ${tag}` },
  });
  if (error || !data?.user) throw new Error(`fixture auth user failed: ${error?.message}`);
  profileIds.push(data.user.id);
  return data.user.id;
};

afterAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  if (orderIds.length) await db.from("tickets").delete().in("order_id", orderIds);
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  if (ticketTypeIds.length) await db.from("ticket_types").delete().in("id", ticketTypeIds);
  // Borrar el auth user cascadea al profile (FK on delete cascade).
  for (const id of profileIds) {
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe.skipIf(!hasCreds)("expire_stale_pending_orders (integración, RPC de Postgres)", () => {
  it("expira órdenes pending viejas, anula sus tickets y devuelve el stock", async () => {
    const db = supabaseAdmin();
    const buyerId = await createProfile("old");
    const ticketTypeId = await createTicketType(); // sold=0, aislado de la data de dev

    // Orden pending "fresca" primero (created_at = now, default), y recién
    // luego se "envejece" a propósito. pg_cron corre este mismo job cada
    // minuto en real: si backdatáramos created_at desde el insert, hay una
    // ventana en la que la orden ya calificaría como vieja pero el ticket
    // (creado en el siguiente round-trip) todavía no existe — el cron podría
    // expirarla sin nada que anular, y el `sold` que seteamos después quedaría
    // huérfano. Insertando el ticket ANTES de envejecer la orden se elimina
    // esa ventana de carrera.
    const { data: order, error: oErr } = await db
      .from("orders")
      .insert({
        buyer_id: buyerId,
        event_id: EVENT_ID,
        status: "pending",
        total_cents: 3000,
      })
      .select("id")
      .single<OrderRow>();
    if (oErr || !order) throw new Error(`fixture order failed: ${oErr?.message}`);
    orderIds.push(order.id);

    const { error: tErr } = await db.from("tickets").insert({
      order_id: order.id,
      ticket_type_id: ticketTypeId,
      qr_code: `vitest-expire-order-${RUN}`,
      current_holder: buyerId,
      status: "active",
    });
    if (tErr) throw new Error(`fixture ticket failed: ${tErr.message}`);

    // Ahora sí: envejecer la orden (fuera de la ventana de 30 min) y reflejar
    // lo que hace crear una orden pending real (incrementa el stock
    // reservado), justo antes de invocar la expiración.
    const oldCreatedAt = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    await db.from("orders").update({ created_at: oldCreatedAt }).eq("id", order.id);
    await db.from("ticket_types").update({ sold: 1 }).eq("id", ticketTypeId);

    const { error: rpcErr } = await db.rpc("expire_stale_pending_orders");
    expect(rpcErr).toBeNull();

    const { data: orderAfter } = await db
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .maybeSingle<{ status: string }>();
    expect(orderAfter?.status).toBe("expired");

    const { data: ticketAfter } = await db
      .from("tickets")
      .select("status")
      .eq("order_id", order.id)
      .maybeSingle<{ status: string }>();
    expect(ticketAfter?.status).toBe("void");

    const { data: ttAfter } = await db
      .from("ticket_types")
      .select("sold")
      .eq("id", ticketTypeId)
      .single<{ sold: number }>();
    expect(ttAfter?.sold).toBe(0);
  }, 15_000); // crea auth user + ticket_type + varios round-trips; 5s a veces no alcanza

  it("no toca órdenes pending recientes (dentro de la ventana de 30 min)", async () => {
    const db = supabaseAdmin();
    const buyerId = await createProfile("fresh");

    const { data: order, error: oErr } = await db
      .from("orders")
      .insert({
        buyer_id: buyerId,
        event_id: EVENT_ID,
        status: "pending",
        total_cents: 3000,
        // created_at reciente (default now())
      })
      .select("id")
      .single<OrderRow>();
    if (oErr || !order) throw new Error(`fixture order failed: ${oErr?.message}`);
    orderIds.push(order.id);

    const { error: rpcErr } = await db.rpc("expire_stale_pending_orders");
    expect(rpcErr).toBeNull();

    const { data: orderAfter } = await db
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .maybeSingle<{ status: string }>();
    expect(orderAfter?.status).toBe("pending");
  });
});
