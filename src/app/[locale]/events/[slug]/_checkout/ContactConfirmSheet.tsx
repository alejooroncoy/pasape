"use client";

// Última revisión de contacto antes de confirmar/pagar. Es el "validador de
// datos": el invitado ve su WhatsApp y correo tal como quedaron, porque por ahí
// le llega el QR — un typo aquí y no recibe la entrada. Solo tiene sentido para
// invitados (el logueado ya tiene un canal confiable por su cuenta).
//
// Montado sobre el primitivo `Sheet` (Radix): hereda la paleta clara, el scrim
// central y el drag — no reimplementa portal/motion/escape.

import { Sheet } from "@/components/ui/Sheet";
import { parseE164 } from "@/lib/phone/countries";

/** Botonera del validador — reutilizable como footer de hoja o de paso inline. */
export function ContactConfirmActions({
  onConfirm,
  onEdit,
}: {
  onConfirm: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onConfirm}
        className="w-full rounded-full bg-cart-accent py-3 text-[14.5px] font-semibold text-cart-bg transition hover:brightness-110"
      >
        Sí, es correcto →
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="mt-2 w-full rounded-full py-2.5 text-[13.5px] font-medium text-cart-ink-3 transition hover:text-cart-ink"
      >
        Corregir datos
      </button>
    </>
  );
}

/**
 * Cuerpo de la revisión de contacto (icono + título + tarjeta WhatsApp/correo).
 * Presentacional puro — se usa suelto como PASO dentro del CheckoutSheet (misma
 * hoja, sin apilar → sin efecto de doble tarjeta) y envuelto en `Sheet` sobre la
 * PÁGINA de pago (`/buy`), donde sí es una hoja porque atrás hay página.
 */
export function ContactReview({ phone, email }: { phone: string; email: string }) {
  const { country, national } = parseE164(phone);
  return (
    <>
      <div className="grid size-12 place-items-center rounded-2xl bg-cart-accent-soft text-cart-accent">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
          <circle cx="9" cy="10.3" r="2.1" />
          <path d="M5.8 16.2c.5-1.7 1.9-2.6 3.2-2.6s2.7.9 3.2 2.6" />
          <path d="M14.5 9.5h4M14.5 12.5h4" />
        </svg>
      </div>
      <h2 className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-cart-ink">
        Revisa tus datos de contacto
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-cart-ink-2">
        Aquí te llega el QR de tu entrada apenas se confirme el pago.
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-cart-line-strong bg-cart-bg-elev-2">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[rgba(52,211,153,0.16)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3a9 9 0 0 0-7.75 13.5L3 21l4.65-1.22A9 9 0 1 0 12 3Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-cart-ink-4">
              WhatsApp
            </div>
            <div className="truncate text-[14.5px] font-bold tabular-nums text-cart-ink">
              {country ? `${country.flag} +${country.dial} ` : ""}
              {national || "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-t border-cart-line px-4 py-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-cart-accent-soft">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-cart-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-cart-ink-4">
              Correo
            </div>
            <div className="truncate text-[14.5px] font-bold text-cart-ink">{email || "—"}</div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Validador de contacto como hoja apilada. Se usa sobre la PÁGINA de pago
 * (`/buy`) — atrás hay página, no otra hoja, así que no hay redundancia. En el
 * CheckoutSheet NO se usa esto: ahí la revisión es un paso dentro de la misma
 * hoja (ver `ContactReview` + `ContactConfirmActions`).
 */
export function ContactConfirmSheet({
  open,
  onOpenChange,
  phone,
  email,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  email: string;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Revisa tus datos de contacto"
      description="Aquí te llega el QR de tu entrada apenas se confirme."
      maxWidth={400}
      footer={<ContactConfirmActions onConfirm={onConfirm} onEdit={() => onOpenChange(false)} />}
    >
      <ContactReview phone={phone} email={email} />
    </Sheet>
  );
}
