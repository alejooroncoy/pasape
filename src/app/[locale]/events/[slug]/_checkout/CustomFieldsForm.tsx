"use client";

// Preguntas extra de registro definidas por el organizador (estilo Luma). Se
// renderiza junto a DatosForm en el mismo paso de "¿Quién va?" — mismo patrón:
// presentacional puro, recibe estado + setter, no valida negocio ni calcula
// nada. La definición (label/type/required/options) viene de
// event.customFields; el shape es @/lib/events/customFields (módulo único).
//
// Reusa el MISMO `Field` (input) y el MISMO patrón de dropdown propio
// (DocTypeSelect) que ya usa DatosForm — nada de <select> nativo ni estilos
// aparte: debe verse como una pregunta más del form, no un widget pegado.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { isSelectField, type CustomField } from "@/lib/events/customFields";
import { Field } from "./DatosForm";

export type CustomFieldAnswers = Record<string, string | string[] | boolean>;

export function CustomFieldsForm({
  fields,
  answers,
  setAnswers,
}: {
  fields: CustomField[];
  answers: CustomFieldAnswers;
  setAnswers: (next: CustomFieldAnswers) => void;
}) {
  if (fields.length === 0) return null;

  const setAnswer = (id: string, value: string | string[] | boolean) =>
    setAnswers({ ...answers, [id]: value });

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={answers[field.id]}
          onChange={(v) => setAnswer(field.id, v)}
        />
      ))}
    </div>
  );
}

/** true si toda pregunta marcada `required` tiene respuesta — usarlo para
 *  habilitar/deshabilitar el botón de continuar, igual que `guestValid`. */
export const customFieldsValid = (fields: CustomField[], answers: CustomFieldAnswers): boolean =>
  fields.every((f) => {
    if (!f.required) return true;
    const v = answers[f.id];
    if (typeof v === "boolean") return v;
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  });

const fieldLabel = (field: CustomField) => (field.required ? `${field.label} *` : field.label);

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string | string[] | boolean | undefined;
  onChange: (v: string | string[] | boolean) => void;
}) {
  if (field.type === "checkbox") {
    return <Checkbox checked={value === true} onChange={onChange} label={fieldLabel(field)} />;
  }

  if (field.type === "long_text") {
    return (
      <label className="block">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
          {fieldLabel(field)}
        </span>
        <textarea
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 block w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] text-cart-ink outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
        />
      </label>
    );
  }

  if (isSelectField(field.type)) {
    const options = field.options ?? [];
    if (field.type === "single_select") {
      return (
        <OptionSelect
          label={fieldLabel(field)}
          value={(value as string) ?? null}
          options={options}
          onChange={onChange}
        />
      );
    }
    // multiple_select — mismo look de pill que el resto de toggles del checkout.
    const selected = Array.isArray(value) ? value : [];
    const toggle = (opt: string) =>
      onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
    return (
      <div>
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
          {fieldLabel(field)}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={
                  "rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors " +
                  (active
                    ? "border-cart-accent bg-cart-accent-soft text-cart-accent"
                    : "border-cart-line text-cart-ink-2 hover:border-cart-line-strong")
                }
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const inputType = field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text";
  return (
    <Field
      label={fieldLabel(field)}
      type={inputType}
      value={(value as string) ?? ""}
      onChange={onChange}
    />
  );
}

// Checkbox propio (no <input type="checkbox"> nativo) — mismo trazo/animación
// que el resto de controles a medida del checkout: casilla redondeada que se
// llena de cart-accent y el check se dibuja con un pop al marcar.
function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 py-1 text-left text-[14px] text-cart-ink"
    >
      <span
        className={
          "grid size-[19px] shrink-0 place-items-center rounded-[7px] border transition-colors " +
          (checked
            ? "border-cart-accent bg-cart-accent"
            : "border-cart-line bg-cart-bg-elev")
        }
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            >
              <path d="M2.5 6.3l2.3 2.3L9.5 3.7" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      {label}
    </button>
  );
}

// Dropdown propio para single_select — calco de DocTypeSelect en DatosForm
// (mismo trigger/estilo) para que una pregunta del organizador no se sienta
// como un widget aparte pegado al form.
//
// La lista se monta en un PORTAL con position:fixed en vez de
// absolute-dentro-del-trigger: el sheet de checkout scrollea su contenido
// (overflow-y-auto) y cualquier hijo absolute queda recortado por ese
// overflow apenas el trigger está cerca del borde — con 4+ opciones la
// última quedaba tapada, no solo "hay que scrollear". Fixed + coords propias
// (medidas del trigger) esquiva el recorte sin importar dónde esté el campo.
//
// El portal NO va a document.body a secas: los tokens --color-cart-* se
// redeclaran dentro de .home-light (ver globals.css), así que un hijo directo
// del body cae fuera de ese scope y hereda los valores oscuros por defecto
// (fondo negro). Se monta como hermano del trigger dentro del ancestro
// .home-light más cercano para heredar los mismos tokens que el resto del
// form — position:fixed no depende del padre en el DOM para posicionarse.
function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const trigger = triggerRef.current;
    const r = trigger?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    setMountEl(trigger?.closest<HTMLElement>(".home-light") ?? document.body);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // El sheet scrollea su contenido: si el usuario scrollea con el menú
    // abierto, las coords quedan obsoletas — más simple y predecible cerrarlo
    // que perseguir la posición en cada frame.
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="relative">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex w-full items-center justify-between rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] text-cart-ink outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
      >
        <span className={value ? "" : "text-cart-ink-4"}>{value ?? "Selecciona una opción"}</span>
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
      {rect &&
        mountEl &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={listRef}
                data-sheet-portal-content
                role="listbox"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  transformOrigin: "top",
                }}
                className="pointer-events-auto z-[999] max-h-60 overflow-y-auto rounded-2xl border border-cart-line bg-cart-bg shadow-[0_16px_40px_-12px_rgba(20,10,60,0.28)]"
              >
                {options.map((opt) => {
                  const active = opt === value;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                      className={
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[14px] transition-colors hover:bg-cart-bg-elev " +
                        (active ? "font-semibold text-cart-accent" : "text-cart-ink-2")
                      }
                    >
                      {opt}
                      {active && (
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="shrink-0">
                          <path d="M2.5 6.3l2.3 2.3L9.5 3.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          mountEl,
        )}
    </div>
  );
}
