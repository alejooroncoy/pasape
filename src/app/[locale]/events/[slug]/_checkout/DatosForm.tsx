"use client";

// Form de datos del comprador ("¿Quién va?"), compartido entre la superficie de
// pago (`/buy`) y el bottom-sheet de checkout que sube sobre el evento. Es
// presentacional puro: recibe estado + setters, no crea órdenes ni cotiza. Vive
// acá (y no dentro de buy/page.tsx) para que ambas superficies usen EXACTAMENTE
// el mismo form y sus validaciones — sin duplicar ni derivar.

import type React from "react";
import { PhoneField } from "@/components/design/PhoneField";
import {
  sanitizeDocument,
  sanitizeEmail,
  sanitizePersonNameLive,
} from "@/lib/input/sanitize";

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
  return (
    <div className="flex flex-col gap-8">
      <Section
        title={isLogged ? "Tus datos" : "¿Quién va?"}
        hint={
          isLogged
            ? "De tu cuenta — edítalos si algo cambió"
            : "Para enviarte el QR por WhatsApp"
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
          <Field
            label={isForeigner ? "Número de pasaporte" : "Número de DNI"}
            value={guestDni}
            onChange={(v) => setGuestDni(sanitizeDocument(v, isForeigner))}
            placeholder={isForeigner ? "AB123456" : "71234567"}
            mono
            hint={
              isForeigner
                ? "El documento con el que te identificas en la puerta."
                : "El portero valida tu entrada con este número."
            }
          />
          {/* Caso común = peruano con DNI (default). Ser extranjero es un opt-out
              estilado: al marcarlo el campo de arriba pasa a Pasaporte. */}
          <ForeignerCheck isForeigner={isForeigner} onChange={setIsForeigner} />
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

// Opt-out "soy extranjero": el 95% es peruano con DNI, así que es una excepción,
// no una elección 50/50. Checkbox ESTILADO (no el gris del navegador, que es lo
// que se ve "IA"): caja propia con check, la fila entera es clickeable y al
// marcarla se tiñe de acento suave. Cambia el campo de documento de arriba.
function ForeignerCheck({
  isForeigner,
  onChange,
}: {
  isForeigner: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer select-none items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors " +
        (isForeigner
          ? "border-cart-accent/45 bg-cart-accent-soft"
          : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
      }
    >
      <input
        type="checkbox"
        checked={isForeigner}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={
          "grid size-[19px] shrink-0 place-items-center rounded-md border transition-colors " +
          (isForeigner
            ? "border-cart-accent bg-cart-accent"
            : "border-cart-line-strong bg-cart-bg")
        }
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={"transition-opacity " + (isForeigner ? "opacity-100" : "opacity-0")}
        >
          <path
            d="M2.5 6.3l2.3 2.3L9.5 3.7"
            stroke="#fff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-[13px] font-medium text-cart-ink-2">
        No tengo DNI <span className="text-cart-ink-4">— soy extranjero</span>
      </span>
    </label>
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
