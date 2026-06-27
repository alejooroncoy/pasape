import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { supabaseTicketRepository as repo } from "../../infrastructure/repositories/SupabaseTicketRepository";
import { buyTickets } from "../../application/BuyTickets";
import { getMyTicketById, getMyTickets } from "../../application/GetMyTickets";
import { transferTicket } from "../../application/TransferTicket";
import { claimTransfer } from "../../application/ClaimTransfer";
import type { Ticket, TransferOutcome, WalletTicket } from "../../domain/Ticket";
import type { BuyOutput } from "../../ports/TicketRepository";

// Why: el QR llega por WhatsApp o email — exigimos al menos uno. DNI es
// obligatorio (lo verifica el portero en puerta).
const guestSchema = z
  .object({
    email: z.string().email().nullable().optional(),
    phone: z.string().min(6).nullable().optional(),
    fullName: z.string().min(2),
    dni: z.string().min(8).max(8),
  })
  .refine((g) => !!g.email || !!g.phone, {
    message: "guest_contact_required",
    path: ["phone"],
  });

const buySchema = z.object({
  eventId: z.string().uuid(),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().uuid(),
        qty: z.number().int().min(1).max(10),
        holderName: z.string().nullable().optional(),
      }),
    )
    .min(1),
  promoCode: z.string().min(1).max(64).nullable().optional(),
  guest: guestSchema.optional(),
  // Datos del comprador logueado — mismos campos que guest; se persisten en
  // su perfil/kyc para autorrellenar la próxima compra.
  buyer: guestSchema.optional(),
});

const transferSchema = z.object({
  ticketId: z.string().uuid(),
  // Solo por WhatsApp: la transferencia siempre queda en espera de reclamo y
  // el link viaja al número del receptor.
  toPhone: z.string().min(6),
});

const claimSchema = z.object({
  token: z.string().min(10),
  // Identidad del holder real: se captura al reclamar (autorrellenada desde el
  // perfil del receptor si ya la tiene). Opcionales para no romper claims viejos.
  fullName: z.string().trim().min(2).max(120).nullable().optional(),
  dni: z
    .string()
    .regex(/^\d{8}$/)
    .nullable()
    .optional(),
});

// Reparto post-compra: el dueño nombra al titular de su entrada. Nombre opcional
// (puede limpiarlo) y DNI de 8 dígitos (el DNI completo se cifra server-side; el
// portero valida por los últimos dígitos).
const setHolderSchema = z.object({
  ticketId: z.string().uuid(),
  holderName: z.string().trim().min(1).max(120).nullable(),
  dni: z
    .string()
    .regex(/^\d{8}$/)
    .nullable()
    .optional(),
});

export const TicketsController = {
  async buy(input: unknown): Promise<Result<BuyOutput>> {
    const parsed = buySchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    const auth = await getAuthContext();
    // Why: compra como invitado es first-class — el comprador es commodity y
    // no debe registrarse para comprar. Si no hay sesión, exigimos guest.
    if (!auth.ok) {
      if (!parsed.data.guest) return err("guest_required");
      // Sin sesión no hay perfil que actualizar — buyer no aplica.
      return buyTickets({ repo }, { ...parsed.data, guest: parsed.data.guest, buyer: undefined });
    }
    return buyTickets({ repo }, { buyerId: auth.value.profileId, ...parsed.data });
  },

  async mine(): Promise<Result<WalletTicket[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return { ok: true, value: await getMyTickets({ repo }, auth.value.profileId) };
  },

  async one(id: string, linkToken: string | null = null): Promise<Result<WalletTicket>> {
    const auth = await getAuthContext();
    // Camino auth normal — buyer logueado pidiendo su propio ticket.
    let holderId: string | null = auth.ok ? auth.value.profileId : null;
    // Camino guest — link público con HMAC. Resolvemos el current_holder
    // desde la tabla y delegamos al mismo path (getMyTicketById filtra por
    // current_holder, así que el resultado es el mismo).
    if (!holderId && linkToken && verifyTicketLink(id, linkToken)) {
      const { data } = await supabaseAdmin()
        .from("tickets")
        .select("current_holder")
        .eq("id", id)
        .maybeSingle<{ current_holder: string | null }>();
      holderId = data?.current_holder ?? null;
    }
    if (!holderId) return err(auth.ok ? "not_found" : auth.error);
    const t = await getMyTicketById({ repo }, id, holderId);
    if (!t) return err("not_found");
    return { ok: true, value: t };
  },

  async transfer(input: unknown): Promise<Result<TransferOutcome>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    // Nombre del emisor para el mensaje de WhatsApp ("Juan te envió una entrada").
    const { data: prof } = await supabaseAdmin()
      .from("profiles")
      .select("full_name")
      .eq("id", auth.value.profileId)
      .maybeSingle<{ full_name: string | null }>();
    return transferTicket(
      { repo },
      {
        ticketId: parsed.data.ticketId,
        fromProfile: auth.value.profileId,
        fromName: prof?.full_name ?? null,
        toPhone: parsed.data.toPhone,
      },
    );
  },

  async setHolder(input: unknown): Promise<Result<Ticket>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = setHolderSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return repo.setHolder({
      ticketId: parsed.data.ticketId,
      ownerId: auth.value.profileId,
      holderName: parsed.data.holderName,
      // dni omitido (undefined) → no tocar; null → limpiar; 8 dígitos → DNI completo.
      dni: parsed.data.dni,
    });
  },

  async claim(input: unknown): Promise<Result<{ ticketId: string; eventSlug: string }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err("unauthenticated");
    const parsed = claimSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    const res = await claimTransfer(
      { repo },
      {
        token: parsed.data.token,
        toProfile: auth.value.profileId,
        fullName: parsed.data.fullName,
        dni: parsed.data.dni,
      },
    );
    if (!res.ok) return res;
    return { ok: true, value: { ticketId: res.value.ticket.id, eventSlug: res.value.eventSlug } };
  },

  async carouselScope(ticketId: string): Promise<Result<{ ids: string[]; currentIndex: number; eventTicketCount: number }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return repo.getCarouselScope(ticketId, auth.value.profileId);
  },

  async cancelTransfer(input: unknown): Promise<Result<{ ok: true }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = z.object({ ticketId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return repo.cancelPendingTransfer({
      ticketId: parsed.data.ticketId,
      fromProfile: auth.value.profileId,
    });
  },
};
