"use client";

import { useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRequestRefund } from "@/lib/tickets/hooks/useTickets";
import { TicketActionSurface } from "./TicketActionSurface";

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
                await request.mutateAsync({ ticketId, reason: reason.trim() });
                setSent(true);
              } catch {
                /* error abajo */
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
          <AnimatePresence>
            {request.error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-center text-[12px] text-rose-300"
              >
                No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos directo.
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}
    </TicketActionSurface>
  );
}
