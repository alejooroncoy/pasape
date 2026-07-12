"use client";

// Form de datos del comprador ("¿Quién va?"), compartido entre la superficie de
// pago (`/buy`) y el bottom-sheet de checkout que sube sobre el evento. Es
// presentacional puro: recibe estado + setters, no crea órdenes ni cotiza. Vive
// acá (y no dentro de buy/page.tsx) para que ambas superficies usen EXACTAMENTE
// el mismo form y sus validaciones — sin duplicar ni derivar.

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { PhoneField } from "@/components/design/PhoneField";
import {
  sanitizeDocument,
  sanitizeEmail,
  sanitizePersonNameLive,
} from "@/lib/input/sanitize";

// Tipo de documento — patrón de selector (DNI por defecto), no un checkbox
// "no tengo DNI" (que le queda redundante al peruano que ya puso su DNI). Es lo
// que hacen las ticketeras peruanas y los flujos KYC (Binance/Wise/Airbnb):
// muestra SOLO la opción elegida, sin peso 50/50 ni enunciados en negativo.
type DocType = "dni" | "ce" | "passport";
const DOC_TYPES: Record<
  DocType,
  { short: string; label: string; placeholder: string; hint: string }
> = {
  dni: {
    short: "DNI",
    label: "Número de DNI",
    placeholder: "71234567",
    hint: "El portero valida tu entrada con este número.",
  },
  ce: {
    short: "Carné de extranjería",
    label: "Número de C.E.",
    placeholder: "001234567",
    hint: "Tu carné de extranjería (residentes en Perú).",
  },
  passport: {
    short: "Pasaporte",
    label: "Número de pasaporte",
    placeholder: "AB123456",
    hint: "El documento con el que te identificas en la puerta.",
  },
};

export function DatosForm({
  isLogged,
  userIdent,
  isForeigner,
  setIsForeigner,
  guestDni,
  setGuestDni,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  guestEmail,
  setGuestEmail,
}: {
  isLogged: boolean;
  userIdent: string | null;
  isForeigner: boolean;
  setIsForeigner: (v: boolean) => void;
  guestDni: string;
  setGuestDni: (v: string) => void;
  guestName: string;
  setGuestName: (v: string) => void;
  guestPhone: string;
  setGuestPhone: (v: string) => void;
  guestEmail: string;
  setGuestEmail: (v: string) => void;
}) {
  // El backend solo distingue DNI (peruano) vs extranjero; el sub-tipo (C.E. vs
  // pasaporte) es solo para el label/placeholder correcto. `isForeigner` sigue
  // siendo la fuente de verdad para la validación.
  const [docType, setDocType] = useState<DocType>(isForeigner ? "passport" : "dni");
  const doc = DOC_TYPES[docType];
  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Tus datos"
        hint={
          isLogged
            ? "De tu cuenta — edítalos si algo cambió"
            : "Con esto armamos tu entrada y te enviamos el QR"
        }
      >
        <div className="flex flex-col gap-3">
          {isLogged && userIdent && (
            <div className="flex items-center gap-2 rounded-xl bg-cart-accent-soft px-3.5 py-2.5 text-[12px] text-cart-accent ring-1 ring-cart-accent/30">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="truncate">
                Conectado como <span className="font-semibold">{userIdent}</span>
              </span>
            </div>
          )}
          {/* Tipo primero (DNI por defecto), número después — orden estándar. */}
          <DocTypeSelect
            value={docType}
            onChange={(t) => {
              setDocType(t);
              setIsForeigner(t !== "dni");
            }}
          />
          <Field
            label={doc.label}
            value={guestDni}
            onChange={(v) => setGuestDni(sanitizeDocument(v, docType !== "dni"))}
            placeholder={doc.placeholder}
            mono
            hint={doc.hint}
          />
          <Field
            label="Nombre completo"
            value={guestName}
            onChange={(v) => setGuestName(sanitizePersonNameLive(v))}
            placeholder="Juan Pérez García"
          />
          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
              WhatsApp
            </span>
            <div className="mt-1.5">
              {/* Selector de país (default Perú): el comprador puede ser
                  extranjero aunque el evento sea en Perú. Guarda E.164. */}
              <PhoneField value={guestPhone} onChange={setGuestPhone} />
            </div>
            <span className="mt-1.5 block text-[11.5px] text-cart-ink-4">
              Tu QR llega por aquí.
            </span>
          </label>
          <Field
            label={isLogged ? "Email (opcional)" : "Email"}
            type="email"
            value={guestEmail}
            onChange={(v) => setGuestEmail(sanitizeEmail(v))}
            placeholder="juan@gmail.com"
            hint={isLogged ? "Solo si pagas con tarjeta." : "Respaldo si no te llega el WhatsApp."}
          />
        </div>
      </Section>
    </div>
  );
}

// Dropdown de tipo de documento. Muestra solo la opción elegida (DNI por
// defecto); al abrir, la lista con las tres. Neutro, sin peso 50/50 ni el "no
// tengo DNI" que le sobraba al peruano. Cierra con click fuera / Escape.
function DocTypeSelect({
  value,
  onChange,
}: {
  value: DocType;
  onChange: (t: DocType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        Tipo de documento
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex w-full items-center justify-between rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] text-cart-ink outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
      >
        <span>{DOC_TYPES[value].short}</span>
        <svg
          className={"shrink-0 text-cart-ink-3 transition-transform " + (open ? "rotate-180" : "")}
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl border border-cart-line bg-cart-bg shadow-[0_16px_40px_-12px_rgba(20,10,60,0.28)]"
        >
          {(Object.keys(DOC_TYPES) as DocType[]).map((t) => {
            const active = t === value;
            return (
              <button
                key={t}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[14px] transition-colors hover:bg-cart-bg-elev " +
                  (active ? "font-semibold text-cart-accent" : "text-cart-ink-2")
                }
              >
                {DOC_TYPES[t].short}
                {active && (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="shrink-0">
                    <path d="M2.5 6.3l2.3 2.3L9.5 3.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold tracking-[-0.01em]">{title}</h2>
        {hint && <span className="text-[11.5px] text-cart-ink-3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
  type,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={
          "mt-1.5 block w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] text-cart-ink outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60 " +
          (mono ? "font-mono tracking-[0.04em]" : "")
        }
      />
      {hint && (
        <span className="mt-1.5 block text-[11.5px] text-cart-ink-4">{hint}</span>
      )}
    </label>
  );
}
