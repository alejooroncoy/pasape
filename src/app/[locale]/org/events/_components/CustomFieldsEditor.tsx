"use client";

// Editor de "Preguntas de registro" (estilo Luma: Custom Questions), pero
// pensado para que tome MENOS tiempo que Luma, no el mismo. Luma es
// modal-dentro-de-modal: "+ Add Question" abre un picker de tipos, elegís uno,
// se abre un segundo formulario, recién ahí escribís el label y confirmás.
// Acá "+ Agregar pregunta" mete la fila YA lista para escribir — tipo, label,
// requerido y opciones (si aplica) en la MISMA fila, sin navegar a otra
// pantalla. Menos pasos = el organizador termina antes.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  isSelectField,
  type CustomField,
  type CustomFieldType,
} from "@/lib/events/customFields";

const newField = (): CustomField => ({
  id: crypto.randomUUID(),
  label: "",
  type: "text",
  required: false,
  options: undefined,
});

export function CustomFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (next: CustomField[]) => void;
}) {
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const update = (id: string, patch: Partial<CustomField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const remove = (id: string) => onChange(fields.filter((f) => f.id !== id));

  const add = () => {
    const f = newField();
    onChange([...fields, f]);
    setJustAddedId(f.id);
  };

  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Preguntas de registro
        </span>
        <span className="text-[11px] text-cart-ink-3">Además de nombre y correo</span>
      </div>

      {fields.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-cart-ink-3">
          Nada extra por ahora — el comprador solo llena sus datos básicos.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {fields.map((field) => (
              <motion.div
                key={field.id}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <CustomFieldRow
                  field={field}
                  autoFocus={field.id === justAddedId}
                  onChange={(patch) => update(field.id, patch)}
                  onRemove={() => remove(field.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="mt-3 rounded-full border border-dashed border-cart-line-strong px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-accent hover:text-cart-accent"
      >
        + Agregar pregunta
      </button>
    </div>
  );
}

function CustomFieldRow({
  field,
  autoFocus,
  onChange,
  onRemove,
}: {
  field: CustomField;
  autoFocus: boolean;
  onChange: (patch: Partial<CustomField>) => void;
  onRemove: () => void;
}) {
  // Texto libre para las opciones ("UPC, PUCP, UNI") — se parte por coma solo
  // al guardar/perder foco, así el organizador puede escribir con comas y
  // espacios sueltos sin que la lista salte en cada tecla.
  const [optionsText, setOptionsText] = useState((field.options ?? []).join(", "));
  const commitOptions = () => {
    const options = optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    onChange({ options: options.length > 0 ? options : undefined });
  };

  return (
    <div className="rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5">
      <div className="flex items-start gap-2">
        <input
          autoFocus={autoFocus}
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="¿Qué le preguntas al comprador?"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-cart-ink outline-none placeholder:text-cart-ink-4"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Borrar pregunta"
          className="shrink-0 rounded-full p-1 text-cart-ink-3 transition hover:bg-rose-500/10 hover:text-rose-500"
        >
          ×
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TypeSelect value={field.type} onChange={(type) => onChange({ type })} />

        <button
          type="button"
          onClick={() => onChange({ required: !field.required })}
          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
            field.required
              ? "border-cart-accent bg-cart-accent/10 text-cart-accent"
              : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong"
          }`}
        >
          {field.required ? "Obligatoria" : "Opcional"}
        </button>
      </div>

      {isSelectField(field.type) && (
        <input
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          onBlur={commitOptions}
          placeholder="Opciones separadas por coma — UPC, PUCP, UNI"
          className="mt-2 w-full rounded-lg border border-cart-line bg-cart-bg-elev px-2.5 py-1.5 text-[12px] text-cart-ink outline-none placeholder:text-cart-ink-4"
        />
      )}
    </div>
  );
}

// Dropdown propio (no <select> nativo) — mismo pill/card visual que el resto
// del composer, en vez del chrome del sistema operativo del navegador.
function TypeSelect({
  value,
  onChange,
}: {
  value: CustomFieldType;
  onChange: (t: CustomFieldType) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-cart-line bg-cart-bg-elev px-2.5 py-1 text-[11.5px] text-cart-ink-2 transition hover:border-cart-line-strong"
      >
        {CUSTOM_FIELD_TYPE_LABELS[value]}
        <svg
          width="9"
          height="9"
          viewBox="0 0 12 12"
          fill="none"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-cart-line bg-cart-bg-elev-2 py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)]"
          >
          {CUSTOM_FIELD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={t === value}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-[12.5px] transition-colors ${
                t === value
                  ? "bg-cart-accent/10 text-cart-accent"
                  : "text-cart-ink-2 hover:bg-white/5 hover:text-cart-ink"
              }`}
            >
              {CUSTOM_FIELD_TYPE_LABELS[t]}
            </button>
          ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
