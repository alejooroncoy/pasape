import { afterAll, describe, expect, it, vi } from "vitest";

// `import "server-only"` solo resuelve dentro del bundler de Next; en vitest
// no existe como paquete instalado. Lo mockeamos como no-op SOLO para poder
// importar SupabaseTicketRepository (que lo trae transitivamente vía
// CreatePreference) — no afecta el comportamiento que estamos probando.
vi.mock("server-only", () => ({}));

// Integración de claimOrder contra el Supabase remoto (sin mocks: no usa
// next/headers ni auth — la posesión del link ya se validó en el controller).
// Cubre el camino hoy sin tests: un link de reclamo no se puede usar dos veces,
// y un link fuera de la ventana de 72h se rechaza. Crea su propia data
// (profiles/orders/tickets) porque necesita estados específicos (paid_at
// viejo, orden ya reclamada) que no existen en la data de dev. Limpia todo.

const hasCreds =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const EVENT_ID = "d994149d-39d9-45e7-b10e-0251d0fb3e56"; // reverb-x-la-selva-kx39
const TICKET_TYPE_ID = "02c9daeb-3a7a-4341-b4df-8ac51fc9c322"; // general, evento fixture

const { claimOrder } = await import("./ClaimOrder");
const { supabaseTicketRepository } = await import(
  "../infrastructure/repositories/SupabaseTicketRepository"
);
const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");

const RUN = Date.now();

type OrderRow = { id: string };

const profileIds: string[] = [];
const orderIds: string[] = [];

// profiles.id es FK a auth.users(id) (migración a Supabase Auth) — no se puede
// insertar un profile directo. Igual que hace SupabaseTicketRepository con los
// guests, creamos un auth user; el trigger handle_new_user inserta la row de
// profile automáticamente.
const createProfile = async (tag: string, email?: string): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db.auth.admin.createUser({
    email: email ?? `vitest-claimorder-${tag}-${RUN}@example.com`,
    email_confirm: true,
    user_metadata: { full_name: `Vitest ${tag}` },
  });
  if (error || !data?.user) throw new Error(`fixture auth user failed: ${error?.message}`);
  profileIds.push(data.user.id);
  return data.user.id;
};

const createPaidGuestOrder = async (params: {
  guestProfileId: string;
  guestEmail: string;
  paidAt: Date;
}): Promise<string> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("orders")
    .insert({
      buyer_id: params.guestProfileId,
      event_id: EVENT_ID,
      status: "paid",
      total_cents: 0,
      guest_email: params.guestEmail,
      paid_at: params.paidAt.toISOString(),
    })
    .select("id")
    .single<OrderRow>();
  if (error || !data) throw new Error(`fixture order failed: ${error?.message}`);
  orderIds.push(data.id);

  const { error: tErr } = await db.from("tickets").insert({
    order_id: data.id,
    ticket_type_id: TICKET_TYPE_ID,
    qr_code: `vitest-claimorder-${params.guestProfileId}-${RUN}`,
    current_holder: params.guestProfileId,
    status: "active",
  });
  if (tErr) throw new Error(`fixture ticket failed: ${tErr.message}`);

  return data.id;
};

afterAll(async () => {
  if (!hasCreds) return;
  const db = supabaseAdmin();
  if (orderIds.length) await db.from("tickets").delete().in("order_id", orderIds);
  if (orderIds.length) await db.from("orders").delete().in("id", orderIds);
  // Borrar el auth user cascadea al profile (FK on delete cascade).
  for (const id of profileIds) {
    await db.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe.skipIf(!hasCreds)("claimOrder (integración)", () => {
  // Cada test crea 2-3 auth users reales (round-trip a Supabase Auth); el
  // timeout default de 5s a veces no alcanza.
  it("reclama la compra de invitado y mueve las entradas al nuevo dueño", async () => {
    const guestEmail = `vitest-guest-a-${RUN}@example.com`;
    const guest = await createProfile("guest-a", guestEmail);
    const claimer = await createProfile("claimer-a");
    const orderId = await createPaidGuestOrder({
      guestProfileId: guest,
      guestEmail,
      paidAt: new Date(),
    });

    const res = await claimOrder(
      { repo: supabaseTicketRepository },
      { orderId, toProfile: claimer },
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.ticketsClaimed).toBe(1);

    const db = supabaseAdmin();
    const { data: order } = await db
      .from("orders")
      .select("claimed_at, claimed_by, buyer_id")
      .eq("id", orderId)
      .maybeSingle<{ claimed_at: string | null; claimed_by: string | null; buyer_id: string }>();
    expect(order?.claimed_at).toBeTruthy();
    expect(order?.claimed_by).toBe(claimer);
    expect(order?.buyer_id).toBe(claimer);

    const { data: ticket } = await db
      .from("tickets")
      .select("current_holder")
      .eq("order_id", orderId)
      .maybeSingle<{ current_holder: string }>();
    expect(ticket?.current_holder).toBe(claimer);
  }, 15_000);

  it("el mismo link de reclamo no se puede usar dos veces", async () => {
    const guestEmail = `vitest-guest-b-${RUN}@example.com`;
    const guest = await createProfile("guest-b", guestEmail);
    const claimerOne = await createProfile("claimer-b1");
    const claimerTwo = await createProfile("claimer-b2");
    const orderId = await createPaidGuestOrder({
      guestProfileId: guest,
      guestEmail,
      paidAt: new Date(),
    });

    const first = await claimOrder(
      { repo: supabaseTicketRepository },
      { orderId, toProfile: claimerOne },
    );
    expect(first.ok).toBe(true);

    const second = await claimOrder(
      { repo: supabaseTicketRepository },
      { orderId, toProfile: claimerTwo },
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("order_already_claimed");
  }, 15_000);

  it("un link fuera de la ventana de 72h se rechaza", async () => {
    const guestEmail = `vitest-guest-c-${RUN}@example.com`;
    const guest = await createProfile("guest-c", guestEmail);
    const claimer = await createProfile("claimer-c");
    const paidAt = new Date(Date.now() - 73 * 60 * 60 * 1000); // 73h atrás > ventana de 72h
    const orderId = await createPaidGuestOrder({
      guestProfileId: guest,
      guestEmail,
      paidAt,
    });

    const res = await claimOrder(
      { repo: supabaseTicketRepository },
      { orderId, toProfile: claimer },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("order_claim_expired");
  }, 15_000);
});
