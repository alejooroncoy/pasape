import crypto from "node:crypto";
import type { Result } from "@/server/_shared/result";
import { err, ok } from "@/server/_shared/result";
import type { TicketRepository } from "../ports/TicketRepository";
import type { TransferOutcome } from "../domain/Ticket";
import { WhatsAppNotificationSender } from "@/server/notifications/infrastructure/WhatsAppNotificationSender";

type Deps = { repo: TicketRepository };

type Input = {
  ticketId: string;
  fromProfile: string;
  fromName: string | null;
  toPhone: string;
};

const normalizePhone = (raw: string): string => raw.replace(/\D/g, "");

const claimUrl = (token: string): string => {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/es/claim/${token}`;
};

// Modelo único: TODA transferencia queda en espera de reclamo. La entrada NO
// cambia de dueño hasta que el receptor abre el link que le llega por WhatsApp
// y la reclama. Hasta entonces el emisor la conserva — si se equivocó de
// número, reenvía al correcto (el anterior se cancela) y nunca pierde acceso.
export const transferTicket = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<TransferOutcome>> => {
  const phone = normalizePhone(input.toPhone);
  if (phone.length < 9) return err("invalid_phone");

  const token = crypto.randomBytes(24).toString("base64url");
  const pending = await repo.createPendingTransfer({
    ticketId: input.ticketId,
    fromProfile: input.fromProfile,
    toContact: phone,
    token,
  });
  if (!pending.ok) return pending;

  // Le llega el link por WhatsApp con el template dedicado de transferencia
  // (ticket_claim_invite). Si el proveedor no está configurado o el template aún
  // no está aprobado, degrada a no-op: el envío queda pendiente y el emisor puede
  // reenviarlo o cancelarlo.
  await new WhatsAppNotificationSender()
    .sendTransferClaim({
      phone,
      senderName: input.fromName ?? "Un amigo",
      eventTitle: pending.value.event.title,
      eventStartsAt: pending.value.event.startsAt,
      claimUrl: claimUrl(token),
    })
    .catch(() => undefined);

  return ok({ kind: "pending", toContact: phone });
};
