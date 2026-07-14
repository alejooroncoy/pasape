"use client";

import { useState, type RefObject } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useRequestRefund } from "@/lib/tickets/hooks/useTickets";
import { TicketActionSurface } from "./TicketActionSurface";

// Copy de los códigos de error del backend (ver TicketRepository.requestRefund).
// La UI lee la info del backend y la muestra como toast, no un error genérico.
const REFUND_ERROR_COPY: Record<string, string> = {
  ticket_not_refundable: "Esta entrada ya no admite reembolso.",
  no_payment_found: "No encontramos un pago para reembolsar en esta entrada.",
  not_owner: "Esta entrada no es tuya.",
  ticket_not_found: "No encontramos la entrada.",
};

export function RefundRequestSheet({
  open,
  ticketId,
  online,
  onClose,
  anchorRef,
}: {
  open: boolean;
  ticketId: string;
  online: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const request = useRequestRefund();
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const reasonValid = reason.trim().length > 0;

  const close = () => {
    setReason("");
    setSent(false);
    request.reset();
    onClose();
  };

  return (
    <TicketActionSurface
      open={open}
      onClose={close}
      anchorRef={anchorRef}
      panelClassName="w-[min(380px,calc(100vw-24px))]"
      side="bottom"
      align="end"
    >
      {sent ? (
        <>
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Solicitud enviada</h2>
          <p className="mt-2 text-[13px] leading-normal text-cart-ink-3">
            Nos contactamos contigo apenas la revisemos. Te llega la confirmación al mismo
            correo/WhatsApp con el que compraste.
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={close}
            className="mt-4 flex w-full items-center justify-center rounded-full bg-cart-bg-elev-2 py-3.5 text-[14.5px] font-semibold text-cart-ink transition hover:brightness-110"
          >
            Listo
          </motion.button>
        </>
      ) : (
        <>
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Solicitar reembolso</h2>
          <p className="mt-2 text-[13px] leading-normal text-cart-ink-3">
            Cuéntanos qué pasó. Un miembro del equipo revisa tu caso a mano y te escribe para
            coordinar la devolución.
          </p>

          <label className="mt-5 block">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
              Motivo
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!online}
              autoFocus={online}
              maxLength={500}
              rows={3}
              placeholder="Ej: no puedo asistir al evento, se canceló, compré por error…"
              className="mt-1.5 w-full resize-none rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-3 text-[14px] text-cart-ink placeholder:text-cart-ink-4 outline-none focus:border-cart-ink-3 disabled:opacity-50"
            />
          </label>

          <div className="mt-2 min-h-[20px] text-[12.5px]">
            {!online ? (
              <span className="text-amber-300">Necesitas conexión para enviar.</span>
            ) : null}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              try {
                const outcome = await request.mutateAsync({ ticketId, reason: reason.trim() });
                // El backend detectó una solicitud pendiente para este pago
                // (orden multi-entrada o doble-tap): no duplicó nada. Se lo
                // decimos con un toast y cerramos, sin el flujo de éxito.
                if (outcome.alreadyRequested) {
                  toast("Ya tienes una solicitud en revisión", {
                    id: "refund-dup",
                    description: "El equipo ya la recibió y te va a escribir.",
                  });
                  close();
                  return;
                }
                setSent(true);
              } catch (e) {
                // Leemos el código del backend (api.post lanza Error(payload.error))
                // y lo mostramos como toast con copy claro.
                const code = e instanceof Error ? e.message : "";
                toast.error(REFUND_ERROR_COPY[code] ?? "No pudimos enviar tu solicitud. Intenta de nuevo.", {
                  id: "refund-error",
                });
                // Una entrada que ya no admite reembolso no se arregla
                // reintentando: cerramos para no dejar al fan atascado.
                if (code === "ticket_not_refundable" || code === "not_owner" || code === "ticket_not_found") {
                  close();
                }
              }
            }}
            disabled={!online || request.isPending || !reasonValid}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
          >
            {request.isPending && (
              <motion.span
                aria-hidden
                className="size-4 rounded-full border-2 border-cart-bg/40 border-t-cart-bg"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, ease: "linear", duration: 0.7 }}
              />
            )}
            {request.isPending ? "Enviando…" : "Enviar solicitud"}
          </motion.button>
        </>
      )}
    </TicketActionSurface>
  );
}
