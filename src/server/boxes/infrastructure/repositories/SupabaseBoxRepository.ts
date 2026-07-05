import crypto from "node:crypto";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { BoxRepository } from "@/server/boxes/ports/BoxRepository";
import type { Box } from "@/server/boxes/domain/Box";

type BoxRow = {
  id: string;
  order_id: string;
  ticket_type_id: string;
  invite_token: string;
  box_number: string | null;
  capacity: number;
  expires_at: string;
  created_at: string;
  ticket_type: {
    id: string;
    name: string;
    event: {
      id: string;
      slug: string;
      title: string;
      starts_at: string;
      venue: string | null;
      timezone: string;
    };
  };
  order: { buyer: { id: string; full_name: string | null } };
};

type MemberRow = {
  profile_id: string;
  ticket_id: string | null;
  joined_at: string;
  profile: { full_name: string | null };
  ticket: { current_holder: string | null; status: string } | null;
};

const slug = () => crypto.randomBytes(6).toString("base64url").toLowerCase().replace(/[_-]/g, "");

const generateQr = () => crypto.randomBytes(24).toString("base64url");

const loadBox = async (id: string): Promise<Box | null> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("boxes")
    .select(
      `*,
       ticket_type:ticket_types!inner(
         id, name,
         event:events!inner(id, slug, title, starts_at, venue, timezone)
       ),
       order:orders!inner(
         buyer:profiles!orders_buyer_id_fkey!inner(id, full_name)
       )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as BoxRow;

  // Traemos current_holder del ticket de cada miembro: si lo sostiene el dueño
  // del box (acompañante sin celular), el host lo lleva en su device.
  const ownerId = row.order.buyer.id;
  const { data: members } = await db
    .from("box_members")
    .select(
      "profile_id, ticket_id, joined_at, profile:profiles!inner(full_name), ticket:tickets(current_holder, status)",
    )
    .eq("box_id", id)
    .order("joined_at", { ascending: true });
  const mems = ((members as unknown as MemberRow[] | null) ?? []).map((m) => ({
    profileId: m.profile_id,
    name: m.profile.full_name ?? "—",
    ticketId: m.ticket_id,
    heldByHost: m.ticket?.current_holder === ownerId,
    used: m.ticket?.status === "used",
    joinedAt: m.joined_at,
  }));

  return {
    id: row.id,
    orderId: row.order_id,
    ticketTypeId: row.ticket_type_id,
    ticketTypeName: row.ticket_type.name,
    inviteToken: row.invite_token,
    boxNumber: row.box_number,
    capacity: row.capacity,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    members: mems,
    event: {
      id: row.ticket_type.event.id,
      slug: row.ticket_type.event.slug,
      title: row.ticket_type.event.title,
      startsAt: row.ticket_type.event.starts_at,
      venue: row.ticket_type.event.venue,
      timezone: row.ticket_type.event.timezone,
    },
    ownerName: row.order.buyer.full_name ?? "—",
  };
};

export const supabaseBoxRepository: BoxRepository = {
  async createForTicket({ ticketId, ownerId, capacity }): Promise<Result<Box>> {
    const db = supabaseAdmin();
    const { data: ticket } = await db
      .from("tickets")
      .select(
        "id, order_id, ticket_type_id, current_holder, order:orders!inner(status), ticket_type:ticket_types!inner(kind, capacity, event:events!inner(id, starts_at))",
      )
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket) return err("ticket_not_found");
    type T = {
      id: string;
      order_id: string;
      ticket_type_id: string;
      current_holder: string;
      order: { status: string };
      ticket_type: { kind: string; capacity: number; event: { id: string; starts_at: string } };
    };
    const t = ticket as unknown as T;
    if (t.current_holder !== ownerId) return err("not_owner");
    // Un box nace solo con el pago del host confirmado. Si la orden está en
    // revisión (in_process) u otro estado no pagado, no se crea ni se puede
    // invitar — así ningún acompañante entra antes de que el host pague.
    // ensureForOrder solo corre en 'paid', así que ahí este check es no-op.
    if (t.order.status !== "paid") return err("order_not_paid");
    // La capacidad REAL del box la define el ticket_type (asientos del espacio),
    // no el cliente. El parámetro `capacity` queda como fallback si faltara.
    const boxCapacity = t.ticket_type.capacity > 0 ? t.ticket_type.capacity : capacity;

    // Idempotencia: si ya existe el box de esta (order, ticket_type) lo devolvemos.
    // Ordenamos por created_at y tomamos el primero — robusto aunque hubiera más de
    // uno (el índice único boxes_order_ticket_type_unique ya lo impide a futuro).
    const { data: existing } = await db
      .from("boxes")
      .select("id")
      .eq("order_id", t.order_id)
      .eq("ticket_type_id", t.ticket_type_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing) {
      const box = await loadBox(existing.id);
      if (box) return ok(box);
    }

    const token = `bx-${slug()}`;
    // Why: human-readable BOX number unique per event. We count existing
    // ticket_types for the event then count boxes attached to those types
    // and add 1. Race condition is acceptable: collisions only mean two
    // boxes share a label briefly; invite_token (unique) stays the source
    // of truth and there is no unique constraint on box_number.
    const { data: typesForEvent } = await db
      .from("ticket_types")
      .select("id")
      .eq("event_id", t.ticket_type.event.id);
    const typeIds = (typesForEvent ?? []).map((r) => (r as { id: string }).id);
    const { count: existingBoxes } = await db
      .from("boxes")
      .select("id", { count: "exact", head: true })
      .in("ticket_type_id", typeIds.length > 0 ? typeIds : [t.ticket_type_id]);
    const boxNumber = `BOX-${(existingBoxes ?? 0) + 1}`;

    const { data: created, error } = await db
      .from("boxes")
      .insert({
        order_id: t.order_id,
        ticket_type_id: t.ticket_type_id,
        invite_token: token,
        box_number: boxNumber,
        capacity: boxCapacity,
        expires_at: t.ticket_type.event.starts_at,
      })
      .select("id")
      .single<{ id: string }>();
    // Carrera: si dos llamadas concurrentes intentan crear el mismo box, el índice
    // único boxes_order_ticket_type_unique rechaza la segunda (23505). En vez de
    // fallar, recuperamos el box que ganó la carrera.
    if (error || !created) {
      if (error?.code === "23505") {
        const { data: winner } = await db
          .from("boxes")
          .select("id")
          .eq("order_id", t.order_id)
          .eq("ticket_type_id", t.ticket_type_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle<{ id: string }>();
        if (winner) {
          const box = await loadBox(winner.id);
          if (box) return ok(box);
        }
      }
      return err(error?.message ?? "box_create_failed");
    }

    // Host como primer miembro. onConflict no-op si ya estaba (re-ejecución).
    await db.from("box_members").upsert(
      { box_id: created.id, profile_id: ownerId, ticket_id: ticketId },
      { onConflict: "box_id,profile_id", ignoreDuplicates: true },
    );

    const box = await loadBox(created.id);
    return box ? ok(box) : err("box_load_failed");
  },

  // Crea (idempotente) el grupo de cada box-host de una orden pagada. Se llama al
  // confirmarse el pago: el box existe desde que pagas, no al abrir el wallet.
  async ensureForOrder(orderId): Promise<void> {
    const db = supabaseAdmin();
    // Hosts del box = tickets con box_label y SIN box_host_ticket_id (no acompañantes).
    const { data: hosts } = await db
      .from("tickets")
      .select("id, current_holder, box_label, box_host_ticket_id")
      .eq("order_id", orderId)
      .not("box_label", "is", null)
      .is("box_host_ticket_id", null);
    for (const h of (hosts ?? []) as Array<{ id: string; current_holder: string | null }>) {
      if (!h.current_holder) continue;
      // capacity real la define el ticket_type dentro de createForTicket; el 6 es
      // solo fallback si faltara. Idempotente vía el índice único.
      await this.createForTicket({ ticketId: h.id, ownerId: h.current_holder, capacity: 6 });
    }
  },

  async getByToken(token) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("boxes")
      .select("id")
      .eq("invite_token", token)
      .maybeSingle<{ id: string }>();
    if (!data) return null;
    return loadBox(data.id);
  },

  async getByTicketId(ticketId, ownerId) {
    const db = supabaseAdmin();
    const { data: ticket } = await db
      .from("tickets")
      .select("order_id, ticket_type_id, current_holder, box_label, box_host_ticket_id")
      .eq("id", ticketId)
      .maybeSingle<{
        order_id: string;
        ticket_type_id: string;
        current_holder: string;
        box_label: string | null;
        box_host_ticket_id: string | null;
      }>();
    if (!ticket || ticket.current_holder !== ownerId) return null;
    const { data: box } = await db
      .from("boxes")
      .select("id")
      .eq("order_id", ticket.order_id)
      .eq("ticket_type_id", ticket.ticket_type_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (box) return loadBox(box.id);
    // Backfill: órdenes que pagaron antes de crear el box al pago. Si este ticket
    // es el host del box (tiene box_label y no es acompañante), lo creamos aquí —
    // server-side e idempotente, sin reintentos del cliente.
    if (ticket.box_label && !ticket.box_host_ticket_id) {
      const created = await this.createForTicket({ ticketId, ownerId, capacity: 6 });
      return created.ok ? created.value : null;
    }
    return null;
  },

  async join({ token, profileId, holderName, holderDni, holderPhone }): Promise<Result<Box>> {
    const db = supabaseAdmin();
    const box = await this.getByToken(token);
    if (!box) return err("invalid_token");
    if (box.members.some((m) => m.profileId === profileId)) return ok(box);
    if (box.members.length >= box.capacity) return err("box_full");

    // Anti-duplicación por DNI dentro del mismo box. Guardamos last2 en tickets
    // por privacidad, así que también comparamos last2 — colisión 1/100 dentro
    // de 12 personas es aceptable y el portero termina de validar en puerta.
    if (holderDni) {
      const last2 = holderDni.slice(-2);
      const ticketIds = box.members.map((m) => m.ticketId).filter(Boolean) as string[];
      if (ticketIds.length) {
        const { data: dup } = await db
          .from("tickets")
          .select("id")
          .in("id", ticketIds)
          .eq("holder_dni_last2", last2)
          .limit(1)
          .maybeSingle<{ id: string }>();
        if (dup) return err("dni_already_in_box");
      }
    }

    // Why: heredamos box_label desde el ticket_type y enlazamos al ticket host
    // (primer miembro del box). Así, al escanear cualquier QR el portero ve
    // "BOX A · Daniela · invitada por José" sin consultas extra.
    const { data: type } = await db
      .from("ticket_types")
      .select("box_label")
      .eq("id", box.ticketTypeId)
      .maybeSingle<{ box_label: string | null }>();
    const hostMember = box.members.find((m) => m.ticketId);
    const hostTicketId = hostMember?.ticketId ?? null;

    const { data: ticket, error: tkErr } = await db
      .from("tickets")
      .insert({
        order_id: box.orderId,
        ticket_type_id: box.ticketTypeId,
        // El integrante no paga: el box completo lo cobró el ticket host. Va en 0
        // para no duplicar el recaudado por tipo.
        price_cents: 0,
        holder_name: holderName,
        holder_dni_last2: holderDni ? holderDni.slice(-2) : null,
        holder_phone: holderPhone,
        qr_code: generateQr(),
        current_holder: profileId,
        box_label: type?.box_label ?? null,
        box_host_ticket_id: hostTicketId,
      })
      .select("id")
      .single<{ id: string }>();
    if (tkErr || !ticket) return err(tkErr?.message ?? "ticket_create_failed");

    await db.from("box_members").insert({
      box_id: box.id,
      profile_id: profileId,
      ticket_id: ticket.id,
    });

    const refreshed = await loadBox(box.id);
    return refreshed ? ok(refreshed) : err("box_load_failed");
  },

  async addCompanion({ token, ownerId, holderName, holderDni }): Promise<Result<Box>> {
    const db = supabaseAdmin();
    const box = await this.getByToken(token);
    if (!box) return err("invalid_token");

    // Solo el dueño del box agrega acompañantes.
    const { data: order } = await db
      .from("orders")
      .select("buyer_id")
      .eq("id", box.orderId)
      .maybeSingle<{ buyer_id: string | null }>();
    if (!order || order.buyer_id !== ownerId) return err("not_owner");
    if (box.members.length >= box.capacity) return err("box_full");

    // Anti-duplicación por DNI dentro del box (igual que join).
    if (holderDni) {
      const last2 = holderDni.slice(-2);
      const ticketIds = box.members.map((m) => m.ticketId).filter(Boolean) as string[];
      if (ticketIds.length) {
        const { data: dup } = await db
          .from("tickets")
          .select("id")
          .in("id", ticketIds)
          .eq("holder_dni_last2", last2)
          .limit(1)
          .maybeSingle<{ id: string }>();
        if (dup) return err("dni_already_in_box");
      }
    }

    // Acompañante sin celular: necesita un profile para ocupar el asiento, pero
    // su QR lo lleva el HOST (current_holder = ownerId). Creamos un profile
    // sintético (sin teléfono) solo para el cupo y el nombre en la lista.
    const synthEmail = `companion-${crypto.randomUUID()}@pasape.app`;
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email: synthEmail,
      email_confirm: true,
      user_metadata: { full_name: holderName },
    });
    if (authErr || !authUser?.user) return err("profile_create_failed");
    const seatProfileId = authUser.user.id;
    await db.from("profiles").update({ full_name: holderName, initial_role: "buyer" }).eq("id", seatProfileId);

    const { data: type } = await db
      .from("ticket_types")
      .select("box_label")
      .eq("id", box.ticketTypeId)
      .maybeSingle<{ box_label: string | null }>();
    const hostTicketId = box.members.find((m) => m.ticketId)?.ticketId ?? null;

    const { data: ticket, error: tkErr } = await db
      .from("tickets")
      .insert({
        order_id: box.orderId,
        ticket_type_id: box.ticketTypeId,
        price_cents: 0,
        holder_name: holderName,
        holder_dni_last2: holderDni ? holderDni.slice(-2) : null,
        qr_code: generateQr(),
        // El QR vive con el HOST (lo muestra en la puerta por el acompañante).
        current_holder: ownerId,
        box_label: type?.box_label ?? null,
        box_host_ticket_id: hostTicketId,
      })
      .select("id")
      .single<{ id: string }>();
    if (tkErr || !ticket) return err(tkErr?.message ?? "ticket_create_failed");

    await db.from("box_members").insert({
      box_id: box.id,
      profile_id: seatProfileId,
      ticket_id: ticket.id,
    });

    const refreshed = await loadBox(box.id);
    return refreshed ? ok(refreshed) : err("box_load_failed");
  },

  async removeMember({ token, ownerId, memberProfileId }): Promise<Result<Box>> {
    const db = supabaseAdmin();
    const box = await this.getByToken(token);
    if (!box) return err("invalid_token");

    // Solo el dueño del box (comprador de la orden) puede quitar gente.
    const { data: order } = await db
      .from("orders")
      .select("buyer_id")
      .eq("id", box.orderId)
      .maybeSingle<{ buyer_id: string | null }>();
    if (!order || order.buyer_id !== ownerId) return err("not_owner");

    // No puede quitarse a sí mismo (el host no se va de su propio box).
    if (memberProfileId === ownerId) return err("cannot_remove_host");

    const member = box.members.find((m) => m.profileId === memberProfileId);
    if (!member) return err("member_not_found");
    // Seguridad extra: nunca quitar al ticket host del box.
    if (member.ticketId) {
      const { data: tk } = await db
        .from("tickets")
        .select("box_host_ticket_id")
        .eq("id", member.ticketId)
        .maybeSingle<{ box_host_ticket_id: string | null }>();
      if (tk && tk.box_host_ticket_id === null) return err("cannot_remove_host");
      // Anula su QR: ya no entra. El asiento queda libre.
      await db.from("tickets").update({ status: "void" }).eq("id", member.ticketId);
    }
    await db
      .from("box_members")
      .delete()
      .eq("box_id", box.id)
      .eq("profile_id", memberProfileId);

    const refreshed = await loadBox(box.id);
    return refreshed ? ok(refreshed) : err("box_load_failed");
  },
};
