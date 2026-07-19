import { afterAll, describe, expect, it, vi } from "vitest";

// `import "server-only"` solo resuelve dentro del bundler de Next; en vitest
// no existe como paquete instalado. Lo mockeamos como no-op SOLO para poder
// importar SupabaseTicketRepository (que lo trae transitivamente).
vi.mock("server-only", () => ({}));

// Integración de buy() contra la RPC atómica `create_pending_order_with_tickets`
// (migración 20260719090000_create_pending_order_atomic.sql). Sin mocks: ejercita
// la RPC real contra Supabase de dev. Cubre lo que el review de /review señaló
// como brecha (P2): nada probaba el contrato TS↔RPC ni la promesa central de la
// migración — "o nacen orden + tickets juntos, o no nace nada".
//
// Reusa el evento publicado del propio fundador (alejo-we6n) como fixture base
// para no tener que crear organización/legal_entity/evento desde cero; solo
// agrega los ticket_types y el promoter_link específicos que cada caso necesita
// y los borra al terminar. Usa siempre un ticket_type de pago (price_cents > 0)
// para el camino feliz: así la orden queda 'pending' y buy() nunca llega a los
// after() de notificación (que revientan fuera de un request real de Next).

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const EVENT_ID = "8ebe021c-9d9a-424b-ba8a-11e0c08db8ad"; // alejo-we6n, published
const PAID_TICKET_TYPE_ID = "6a46f901-b00b-4a45-9a2a-a5431571ea1f"; // General 2, S/30, cap 100

const { supabaseTicketRepository: repo } = await import("./SupabaseTicketRepository");
const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

const RUN = Date.now();
const dni = (tag: string) => `9${RUN.toString().slice(-6)}${tag}`.padEnd(8, "0").slice(0, 8);

const orderIds: string[] = [];
const ticketTypeIds: string[] = [];
const promoterLinkIds: string[] = [];
const profileIds: string[] = [];

const createProfile = async (tag: string): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db.auth.admin.createUser({
    email: `vitest-buyatomic-${tag}-${RUN}@example.com`,
    email_confirm: true,
    user_metadata: { full_name: `Vitest ${tag}` },
  });
  if (error || !data?.user) throw new Error(`fixture auth user failed: ${error?.message}`);
  profileIds.push(data.user.id);
  return data.user.id;
};

const createTicketType = async (
  overrides: Partial<{
    name: string;
    capacity: number | null;
    price_cents: number;
    requires_approval: boolean;
  }>,
): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ticket_types")
    .insert({
      event_id: EVENT_ID,
      name: overrides.name ?? "Vitest RPC fixture",
      kind: "general",
      price_cents: overrides.price_cents ?? 0,
      capacity: overrides.capacity ?? null,
      requires_approval: overrides.requires_approval ?? false,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`fixture ticket_type failed: ${error?.message}`);
  ticketTypeIds.push(data.id);
  return data.id;
};

afterAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  // orders → tickets es ON DELETE CASCADE: borrar la orden basta.
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  if (ticketTypeIds.length) await db.from("ticket_types").delete().in("id", ticketTypeIds);
  if (promoterLinkIds.length) await db.from("promoter_links").delete().in("id", promoterLinkIds);
  for (const id of profileIds) {
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe.skipIf(!hasCreds)("SupabaseTicketRepository.buy — RPC atómica (integración)", () => {
  it("crea orden pending + ticket en una sola transacción", async () => {
    const email = `vitest-rpc-happy-${RUN}@example.com`;
    const res = await repo.buy({
      eventId: EVENT_ID,
      items: [{ ticketTypeId: PAID_TICKET_TYPE_ID, qty: 1 }],
      guest: { email, phone: null, fullName: "Vitest Happy Path", dni: dni("1") },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    orderIds.push(res.value.order.id);

    expect(res.value.order.status).toBe("pending");
    expect(res.value.tickets).toHaveLength(1);
    expect(res.value.tickets[0].orderId).toBe(res.value.order.id);
    expect(res.value.tickets[0].status).toBe("active");

    const db = supabaseAdmin();
    const { data: orderRow } = await db
      .from("orders")
      .select("status, guest_email")
      .eq("id", res.value.order.id)
      .maybeSingle<{ status: string; guest_email: string | null }>();
    expect(orderRow?.status).toBe("pending");
    expect(orderRow?.guest_email).toBe(email);

    const { data: ticketRows } = await db
      .from("tickets")
      .select("id, order_id, ticket_type_id")
      .eq("order_id", res.value.order.id)
      .returns<Array<{ id: string; order_id: string; ticket_type_id: string }>>();
    expect(ticketRows).toHaveLength(1);
    expect(ticketRows?.[0]?.ticket_type_id).toBe(PAID_TICKET_TYPE_ID);
  }, 15_000);

  it("si el stock no alcanza, no queda orden huérfana (rollback atómico)", async () => {
    const soldOutTypeId = await createTicketType({
      name: "Vitest RPC stock=1",
      capacity: 1,
      price_cents: 500,
    });

    const emailA = `vitest-rpc-stock-a-${RUN}@example.com`;
    const first = await repo.buy({
      eventId: EVENT_ID,
      items: [{ ticketTypeId: soldOutTypeId, qty: 1 }],
      guest: { email: emailA, phone: null, fullName: "Vitest Stock A", dni: dni("2") },
    });
    expect(first.ok).toBe(true);
    if (first.ok) orderIds.push(first.value.order.id);

    const emailB = `vitest-rpc-stock-b-${RUN}@example.com`;
    const second = await repo.buy({
      eventId: EVENT_ID,
      items: [{ ticketTypeId: soldOutTypeId, qty: 1 }],
      guest: { email: emailB, phone: null, fullName: "Vitest Stock B", dni: dni("3") },
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("sold_out");

    // La promesa central de la migración: el fallo del INSERT de tickets
    // (constraint ticket_types_sold_le_capacity) revierte también el INSERT de
    // la orden — no debe quedar una fila 'pending' huérfana para el intento B.
    const db = supabaseAdmin();
    const { data: orphan } = await db
      .from("orders")
      .select("id")
      .eq("guest_email", emailB)
      .maybeSingle<{ id: string }>();
    expect(orphan).toBeNull();
  }, 15_000);

  it("si la cuota de promotor se excede, no queda orden huérfana (rollback atómico)", async () => {
    const promoterId = await createProfile("promoter-quota");
    const promoTypeId = await createTicketType({ name: "Vitest RPC promo quota", capacity: 50, price_cents: 100 });
    const code = `vitest-rpc-quota-${RUN}`;
    const db = supabaseAdmin();
    const { data: link, error: linkErr } = await db
      .from("promoter_links")
      .insert({ event_id: EVENT_ID, promoter_id: promoterId, code, quota: 1, active: true })
      .select("id")
      .single<{ id: string }>();
    if (linkErr || !link) throw new Error(`fixture promoter_link failed: ${linkErr?.message}`);
    promoterLinkIds.push(link.id);

    const emailA = `vitest-rpc-quota-a-${RUN}@example.com`;
    const first = await repo.buy({
      eventId: EVENT_ID,
      items: [{ ticketTypeId: promoTypeId, qty: 1 }],
      promoCode: code,
      guest: { email: emailA, phone: null, fullName: "Vitest Quota A", dni: dni("4") },
    });
    expect(first.ok).toBe(true);
    if (first.ok) orderIds.push(first.value.order.id);

    const emailB = `vitest-rpc-quota-b-${RUN}@example.com`;
    const second = await repo.buy({
      eventId: EVENT_ID,
      items: [{ ticketTypeId: promoTypeId, qty: 1 }],
      promoCode: code,
      guest: { email: emailB, phone: null, fullName: "Vitest Quota B", dni: dni("5") },
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("promoter_quota_exceeded");

    const { data: orphan } = await db
      .from("orders")
      .select("id")
      .eq("guest_email", emailB)
      .maybeSingle<{ id: string }>();
    expect(orphan).toBeNull();
  }, 15_000);

  it("RSVP con aprobación queda pending_approval desde el primer commit", async () => {
    const approvalTypeId = await createTicketType({
      name: "Vitest RPC approval",
      capacity: 50,
      price_cents: 0,
      requires_approval: true,
    });

    const email = `vitest-rpc-approval-${RUN}@example.com`;
    const res = await repo.buy({
      eventId: EVENT_ID,
      items: [{ ticketTypeId: approvalTypeId, qty: 1 }],
      guest: { email, phone: null, fullName: "Vitest Approval", dni: dni("6") },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    orderIds.push(res.value.order.id);

    expect(res.value.order.status).toBe("pending_approval");
    expect(res.value.tickets[0]?.status).toBe("pending_approval");

    const db = supabaseAdmin();
    const { data: orderRow } = await db
      .from("orders")
      .select("status")
      .eq("id", res.value.order.id)
      .maybeSingle<{ status: string }>();
    expect(orderRow?.status).toBe("pending_approval");
  }, 15_000);
});
