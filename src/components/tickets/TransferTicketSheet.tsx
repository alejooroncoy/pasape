"use client";

import { useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTransferTicket } from "@/lib/tickets/hooks/useTickets";
import { useProfileLookup } from "@/lib/identity/hooks/useProfileLookup";
import { formatPhone, transferErrorCopy } from "@/lib/tickets/phoneFormat";
import { PhoneField } from "@/components/design/PhoneField";
import { parseE164 } from "@/lib/phone/countries";
import { TicketActionSurface } from "./TicketActionSurface";

export function TransferTicketSheet({
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
  const transfer = useTransferTicket();
  // recipient en E.164 (país + número) del PhoneField.
  const [recipient, setRecipient] = useState("");
  const parsedRecipient = parseE164(recipient);
  const recipientDigits = parsedRecipient.national;
  const recipientIsPeru = (parsedRecipient.country?.code ?? "PE") === "PE";
  const recipientValid = recipientIsPeru ? recipientDigits.length === 9 : recipientDigits.length >= 6;
  const recipientLookup = useProfileLookup(recipientDigits);

  const close = () => {
    setRecipient("");
    transfer.reset();
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
      <h2 className="text-[20px] font-bold tracking-[-0.02em]">Enviar entrada</h2>
      <p className="mt-2 text-[13px] leading-normal text-cart-ink-3">
        Le llega por WhatsApp. La entrada <span className="font-semibold text-white">sigue siendo tuya</span> hasta
        que la abra y la reclame.
      </p>

      <label className="mt-5 block">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
          WhatsApp del receptor
        </span>
        <div className="mt-1.5">
          <PhoneField
            value={recipient}
            onChange={setRecipient}
            autoFocus={online}
            disabled={!online}
          />
        </div>
      </label>

      <div className="mt-2 min-h-[20px] text-[12.5px]">
        {!online ? (
          <span className="text-amber-300">Necesitas conexión para enviar.</span>
        ) : recipientIsPeru && recipientDigits.length > 0 && recipientDigits.length < 9 ? (
          <span className="text-cart-ink-4">Faltan {9 - recipientDigits.length} dígitos</span>
        ) : recipientDigits.length === 9 && recipientLookup.loading ? (
          <span className="text-cart-ink-3">Buscando…</span>
        ) : recipientDigits.length === 9 && recipientLookup.result?.found ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Le envías a <strong className="text-white">{recipientLookup.result.displayName}</strong>
          </span>
        ) : recipientDigits.length === 9 ? (
          <span className="text-cart-ink-3">
            Le llegará al <strong className="text-white">{formatPhone(recipientDigits)}</strong> por WhatsApp.
          </span>
        ) : null}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={async () => {
          try {
            await transfer.mutateAsync({ ticketId, toPhone: recipient });
            close();
          } catch {
            /* error abajo */
          }
        }}
        disabled={!online || transfer.isPending || !recipientValid}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
      >
        {transfer.isPending && (
          <motion.span
            aria-hidden
            className="size-4 rounded-full border-2 border-cart-bg/40 border-t-cart-bg"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: "linear", duration: 0.7 }}
          />
        )}
        {transfer.isPending
          ? "Enviando…"
          : recipientDigits.length === 9
            ? `Enviar al ${formatPhone(recipientDigits)}`
            : "Enviar entrada"}
      </motion.button>
      <AnimatePresence>
        {transfer.error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-[12px] text-rose-300"
          >
            {transferErrorCopy((transfer.error as Error).message)}
          </motion.p>
        )}
      </AnimatePresence>
    </TicketActionSurface>
  );
}
