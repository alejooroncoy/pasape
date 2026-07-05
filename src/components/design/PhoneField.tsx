"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { focusOnDesktop } from "@/lib/_shared/focusOnDesktop";
import { byCode, COUNTRIES, DEFAULT_COUNTRY, parseE164 } from "@/lib/phone/countries";
import { C, FONT_MONO } from "./tokens";

type Props = {
  /** Teléfono en formato E.164 ("+51987654321") o "" si está vacío. */
  value: string;
  /** Emite el E.164 completo (país + número), o "" si no hay número. */
  onChange: (next: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
};

// Quita tildes y baja a minúsculas para buscar "peru" y encontrar "Perú".
const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Selector de país (buscable) + número. El comprador puede ser extranjero aunque
// el evento sea en Perú, así que el país es elegible (default Perú). Guarda
// SIEMPRE en E.164 para que el origen del teléfono/venta quede explícito.
export const PhoneField = ({ value, onChange, autoFocus, disabled }: Props) => {
  const parsed = parseE164(value);
  // El país es estado propio: si borran el número, no perdemos el país elegido
  // (el E.164 vacío ya no lo lleva).
  const [countryCode, setCountryCode] = useState(parsed.country?.code ?? DEFAULT_COUNTRY);
  const country = byCode(countryCode) ?? byCode(DEFAULT_COUNTRY)!;
  const national = parsed.national;
  const active = national.length > 0 || !!autoFocus;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const emit = (nationalDigits: string, dial: string) =>
    onChange(nationalDigits ? `+${dial}${nationalDigits}` : "");

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return COUNTRIES;
    const qn = norm(q);
    const qDigits = q.replace(/\D/g, ""); // "+57" / "57" → "57"
    return COUNTRIES.filter(
      (c) =>
        norm(c.label).includes(qn) ||
        c.code.toLowerCase().includes(qn) ||
        (qDigits.length > 0 && c.dial.startsWith(qDigits)),
    );
  }, [query]);

  const select = (code: string) => {
    const next = byCode(code) ?? country;
    setCountryCode(code);
    emit(national, next.dial);
    setOpen(false);
    setQuery("");
  };

  return (
    <div
      style={{
        height: 64,
        borderRadius: 18,
        padding: "0 14px 0 8px",
        background: active ? "rgba(124,58,237,0.10)" : "rgba(255,255,255,0.04)",
        boxShadow: active
          ? `0 0 0 1.5px ${C.purple} inset, 0 0 24px -8px rgba(124,58,237,0.35)`
          : `0 0 0 1px ${C.line} inset`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "all .2s",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div ref={pickerRef} style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingRight: 10,
            borderRight: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            fontFamily: FONT_MONO,
            fontSize: 15,
            color: C.dim,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{country.flag}</span>
          <span>+{country.dial}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </button>

        <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              zIndex: 50,
              width: 288,
              maxWidth: "80vw",
              borderRadius: 14,
              overflow: "hidden",
              transformOrigin: "top left",
              background: "#15121c",
              boxShadow: `0 0 0 1px ${C.line} inset, 0 20px 40px -12px rgba(0,0,0,0.7)`,
            }}
          >
            <input
              autoFocus
              placeholder="Buscar país o código (ej. 51, Perú)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  select(results[0].code);
                }
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.04)",
                border: 0,
                borderBottom: `1px solid ${C.line}`,
                outline: "none",
                color: "#fff",
                fontSize: 14,
              }}
            />
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {results.length === 0 ? (
                <div style={{ padding: "14px", color: C.dim, fontSize: 13 }}>Sin resultados</div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    // preventDefault para que el input de búsqueda no pierda foco
                    // antes de registrar el click.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(c.code)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 14px",
                      background: c.code === countryCode ? "rgba(124,58,237,0.14)" : "transparent",
                      border: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "#fff",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{c.flag}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.label}
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.dim }}>+{c.dial}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <input
        // autoFocus nativo en iOS enfoca sin abrir teclado ("doble tap"): en su
        // lugar enfocamos solo en desktop.
        ref={autoFocus ? focusOnDesktop : undefined}
        type="tel"
        inputMode="tel"
        placeholder="987 654 321"
        disabled={disabled}
        value={national}
        onChange={(e) => emit(e.target.value.replace(/\D/g, ""), country.dial)}
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: 0,
          outline: "none",
          fontFamily: FONT_MONO,
          fontSize: 18,
          letterSpacing: "0.08em",
          color: "#fff",
          padding: 0,
        }}
      />
    </div>
  );
};
