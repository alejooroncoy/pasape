"use client";

import { useState } from "react";
import { useEvent } from "@/lib/events/hooks/useEvents";
import {
  useZones,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
} from "@/lib/events/hooks/useZones";

// Borrador del editor: con `id` = editando; sin él = creando.
type Draft = { id?: string; name: string; ticketTypeIds: string[] };

// Sección "Puertas" dentro de Ajustes.
// Regla simple por cantidad (no hay "puerta por defecto" especial):
//   - 1 puerta  → valida TODAS las entradas (caso normal, cero config).
//   - 2+ puertas → cada una valida solo sus entradas (caso estadio).
// Para pasar de "una que valida todo" a un esquema específico, el organizador
// pulsa "Quitar": crea la puerta de reemplazo y la anterior se borra sola.
// Invariante: nunca queda sin puertas.
export function DoorsSection({ slug }: { slug: string }) {
  const event = useEvent(slug);
  const zones = useZones(slug);
  const create = useCreateZone(slug);
  const update = useUpdateZone(slug);
  const remove = useDeleteZone(slug);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Quitar la única puerta = crear su reemplazo; al guardarlo, se borra la vieja.
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const ticketTypes = event.data?.ticketTypes ?? [];
  const nameOf = (id: string) =>
    ticketTypes.find((t) => t.id === id)?.name ?? "Entrada";

  const all = zones.data ?? [];
  const single = all.length === 1 ? all[0] : null;
  const saving = create.isPending || update.isPending;

  // Con varias puertas: entradas que no valida ninguna (no se podrían validar).
  const coveredIds = new Set(all.flatMap((z) => z.ticketTypeIds));
  const orphans = single ? [] : ticketTypes.filter((t) => !coveredIds.has(t.id));

  const close = () => {
    setDraft(null);
    setReplacingId(null);
  };

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    if (draft.id) {
      update.mutate(
        { zoneId: draft.id, name: draft.name.trim(), ticketTypeIds: draft.ticketTypeIds },
        { onSuccess: close },
      );
      return;
    }
    const replacing = replacingId;
    create.mutate(
      { name: draft.name.trim(), ticketTypeIds: draft.ticketTypeIds },
      {
        onSuccess: () => {
          // Reemplazo: creada la nueva, se borra la puerta que se quería quitar.
          if (replacing) remove.mutate(replacing, { onSuccess: close });
          else close();
        },
      },
    );
  };

  const toggle = (id: string) =>
    setDraft((d) =>
      !d
        ? d
        : {
            ...d,
            ticketTypeIds: d.ticketTypeIds.includes(id)
              ? d.ticketTypeIds.filter((x) => x !== id)
              : [...d.ticketTypeIds, id],
          });

  // Quitar una puerta. Si es la última, no se borra: se reemplaza (crear otra).
  const removeZone = (zoneId: string) => {
    if (all.length <= 1) {
      setReplacingId(zoneId);
      setDraft({ name: "", ticketTypeIds: [] });
      return;
    }
    if (confirm("¿Quitar esta puerta?")) remove.mutate(zoneId);
  };

  return (
    <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="border-b border-cart-line px-4 py-3 lg:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Puertas</h2>
        <p className="text-[11.5px] text-cart-ink-3">
          Por dónde entra cada entrada. Con una sola puerta, valida todas.
        </p>
      </header>

      <div>
        {/* Aviso de entradas sueltas (solo con varias puertas) */}
        {orphans.length > 0 && (
          <div className="border-b border-cart-line px-4 py-3 lg:px-5">
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-[12px] text-yellow-200">
              Estas entradas no están en ninguna puerta y no se podrán validar:{" "}
              <span className="font-semibold">{orphans.map((t) => t.name).join(", ")}</span>
            </div>
          </div>
        )}

        {/* Puertas */}
        {all.map((z) => (
          <div key={z.id} className="border-b border-cart-line px-4 py-3 lg:px-5">
            <div className="flex items-center gap-3">
              <div
                className={
                  "grid size-9 place-items-center rounded-lg " +
                  (single ? "bg-cart-accent-soft text-cart-accent" : "bg-white/5 text-cart-ink-3")
                }
              >
                <DoorIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{z.name}</div>
                <div className="truncate text-[12px] text-cart-ink-3">
                  {single
                    ? "Valida todas las entradas"
                    : z.ticketTypeIds.length === 0
                      ? "Sin entradas asignadas"
                      : z.ticketTypeIds.map(nameOf).join(" · ")}
                </div>
              </div>
              {single ? (
                <button
                  type="button"
                  onClick={() => removeZone(z.id)}
                  disabled={remove.isPending}
                  className="text-[12.5px] font-medium text-cart-ink-3 hover:text-white"
                >
                  Quitar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDraft({ id: z.id, name: z.name, ticketTypeIds: z.ticketTypeIds })}
                  className="text-[12.5px] font-medium text-cart-ink-3 hover:text-white"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Editor inline (crear / editar) */}
        {draft ? (
          <div className="border-b border-cart-line bg-white/[0.02] px-4 py-4 lg:px-5">
            {replacingId && (
              <div className="mb-3 rounded-xl border border-cart-accent/30 bg-cart-accent-soft px-3 py-2 text-[12px] text-cart-accent">
                Crea la puerta que reemplaza a la actual. Al guardarla, la anterior se quita sola.
              </div>
            )}
            <label className="block text-[12px] text-cart-ink-3">Nombre de la puerta</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ej. Puerta Norte"
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-cart-line bg-cart-bg px-3.5 py-2.5 text-[15px] outline-none focus:border-cart-accent"
            />

            <div className="mt-3 text-[12px] text-cart-ink-3">¿Qué entradas valida?</div>
            {ticketTypes.length === 0 ? (
              <div className="mt-1.5 text-[12.5px] text-cart-ink-3">
                Este evento aún no tiene entradas.
              </div>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ticketTypes.map((tt) => {
                  const on = draft.ticketTypeIds.includes(tt.id);
                  return (
                    <button
                      key={tt.id}
                      type="button"
                      onClick={() => toggle(tt.id)}
                      className={
                        "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition " +
                        (on
                          ? "border-cart-accent bg-cart-accent-soft text-cart-accent"
                          : "border-cart-line text-cart-ink-3 hover:text-white")
                      }
                    >
                      {on ? "✓ " : ""}
                      {tt.name}
                    </button>
                  );
                })}
              </div>
            )}

            {(create.isError || update.isError) && (
              <div className="mt-2.5 text-[12.5px] text-red-300">
                No se pudo guardar. ¿El nombre ya existe?
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={!draft.name.trim() || saving}
                className="rounded-xl bg-cart-accent px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar puerta"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-xl px-3 py-2 text-[13.5px] font-medium text-cart-ink-3 hover:text-white"
              >
                Cancelar
              </button>
              {draft.id && all.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar la puerta "${draft.name}"?`)) {
                      remove.mutate(draft.id!, { onSuccess: close });
                    }
                  }}
                  className="ml-auto text-[12.5px] font-medium text-red-300 hover:text-red-200"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDraft({ name: "", ticketTypeIds: [] })}
            className="flex w-full items-center gap-2 px-4 py-3.5 text-[13.5px] font-medium text-cart-accent lg:px-5"
          >
            <span className="grid size-5 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
              +
            </span>
            Agregar puerta
          </button>
        )}
      </div>
    </section>
  );
}

function DoorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 2h6v12H4zM4 2 2 4v10M10 8h.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
