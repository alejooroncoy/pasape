"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// Diálogo de "compartir evento" reutilizable.
// Patrón Mobbin/Patreon: modal centrado con preview del flyer + URL copiable
// + acciones (Copy link, WhatsApp). Mismo flujo en desktop y mobile.
// Reusa la lógica que estaba inline en /events/new/success/page.tsx.

type Props = {
  open: boolean;
  onClose: () => void;
  eventSlug: string;
  eventTitle: string;
  flyerUrl?: string | null;
  /** Mensaje custom para el share — default: "Consigue tu entrada aquí". */
  whatsappMessage?: (url: string) => string;
};

export function ShareEventDialog({
  open,
  onClose,
  eventSlug,
  eventTitle,
  flyerUrl,
  whatsappMessage,
}: Props) {
  const [origin, setOrigin] = useState("pasape.lat");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.host);
  }, []);

  const shareUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/events/${eventSlug}`
        : `https://${origin}/events/${eventSlug}`,
    [eventSlug, origin],
  );
  const shareLabel = useMemo(() => `${origin}/events/${eventSlug}`, [origin, eventSlug]);

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop — algún browser sin permiso de clipboard
    }
  };

  const sendWhatsapp = () => {
    const text = encodeURIComponent(
      whatsappMessage
        ? whatsappMessage(shareUrl)
        : `Consigue tu entrada aquí: ${shareUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Esc cierra
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-90 app-scrim"
          />
          <motion.div
            key="dlg"
            role="dialog"
            aria-modal="true"
            aria-label={`Compartir ${eventTitle}`}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="home-light fixed left-1/2 top-1/2 z-91 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cart-line-strong bg-cart-bg-elev shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cart-line px-5 py-4">
              <h3 className="font-sans text-[17px] font-semibold tracking-[-0.01em] text-cart-ink">
                Compartir evento
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="grid size-8 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-cart-ink"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M3 3l7 7M10 3l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-5">
              {/* Preview del flyer + título */}
              <div className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev-2/60 p-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-cart-accent/30 to-purple-900/40">
                  {flyerUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={flyerUrl}
                      alt={eventTitle}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-[18px] font-bold text-white/80">
                      {eventTitle.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-cart-ink">
                    {eventTitle}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11.5px] text-cart-ink-3">
                    {shareLabel}
                  </div>
                </div>
              </div>

              {/* URL copy box */}
              <button
                type="button"
                onClick={copy}
                className="group flex w-full items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg px-4 py-3 text-left transition hover:border-cart-line-strong"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="shrink-0 text-cart-ink-3 group-hover:text-cart-ink"
                >
                  <path
                    d="M6.5 9.5l3-3M5 11.5l-1 1a2.5 2.5 0 11-3.5-3.5l1-1M11 4.5l1-1a2.5 2.5 0 113.5 3.5l-1 1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="flex-1 truncate font-mono text-[12.5px] text-cart-ink-2">
                  {shareLabel}
                </span>
                <span
                  className={
                    "shrink-0 text-[12px] font-semibold transition " +
                    (copied ? "text-emerald-400" : "text-cart-accent")
                  }
                >
                  {copied ? "Copiado ✓" : "Copiar"}
                </span>
              </button>

              {/* Acciones grandes */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={sendWhatsapp}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-[#062315] transition active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(180deg, #2EE584 0%, #25D366 100%)",
                    boxShadow:
                      "0 12px 24px -10px rgba(37,211,102,0.5), 0 0 0 1px rgba(255,255,255,0.18) inset",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-3.9-3.5-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5-.1-.1-.7-1.5-.9-2.1-.2-.5-.5-.4-.7-.4-.2 0-.4 0-.6 0-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2 3.1 5 4.3.7.3 1.2.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.8-1.5C8.3 21.5 10.1 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.7 0-3.4-.5-4.8-1.4l-.3-.2-3.5 1.1 1.1-3.4-.2-.4C3.3 14.5 2.8 13.3 2.8 12c0-5.1 4.1-9.2 9.2-9.2s9.2 4.1 9.2 9.2-4.1 9.2-9.2 9.2z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev-2/60 text-[14px] font-semibold text-cart-ink transition hover:bg-cart-bg-elev-2 active:scale-[0.98]"
                >
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2.5 7.2l3 3 6-6"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect
                          x="4"
                          y="4"
                          width="8"
                          height="8"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M10 4V2.5A1 1 0 009 1.5H2.5a1 1 0 00-1 1V9a1 1 0 001 1H4"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>
                      Copiar link
                    </>
                  )}
                </button>
              </div>

              {/* Ver página pública */}
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-cart-line py-2.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
              >
                Abrir página del evento
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path
                    d="M3 3h5v5M3 8l5-5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
