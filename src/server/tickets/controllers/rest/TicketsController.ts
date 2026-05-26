import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseTicketRepository as repo } from "../../infrastructure/repositories/SupabaseTicketRepository";
import { buyTickets } from "../../application/BuyTickets";
import { getMyTicketById, getMyTickets } from "../../application/GetMyTickets";
import { transferTicket } from "../../application/TransferTicket";
import type { Ticket, WalletTicket } from "../../domain/Ticket";
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
});

const transferSchema = z.object({
  ticketId: z.string().uuid(),
  toIdentifier: z.string().min(3),
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
      return buyTickets({ repo }, { ...parsed.data, guest: parsed.data.guest });
    }
    return buyTickets({ repo }, { buyerId: auth.value.profileId, ...parsed.data });
  },

  async mine(): Promise<Result<WalletTicket[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return { ok: true, value: await getMyTickets({ repo }, auth.value.profileId) };
  },

  async one(id: string): Promise<Result<WalletTicket>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const t = await getMyTicketById({ repo }, id, auth.value.profileId);
    if (!t) return err("not_found");
    return { ok: true, value: t };
  },

  async transfer(input: unknown): Promise<Result<Ticket>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return transferTicket(
      { repo },
      {
        ticketId: parsed.data.ticketId,
        fromProfile: auth.value.profileId,
        toIdentifier: parsed.data.toIdentifier,
      },
    );
  },
};
