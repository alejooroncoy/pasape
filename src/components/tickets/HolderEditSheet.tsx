"use client";

import { useEffect, useState, type RefObject } from "react";
import { useSetHolder } from "@/lib/tickets/hooks/useTickets";
import { isValidDocument } from "@/lib/identity/document";
import { TicketActionSurface } from "./TicketActionSurface";

export function HolderEditSheet({
  open,
  ticketId,
  currentName,
  currentDniLast2,
  ticketTypeName,
  online,
  onClose,
  anchorRef,
}: {
  open: boolean;
  ticketId: string;
  currentName: string | null;
  currentDniLast2: string | null;
  ticketTypeName: string;
  online: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const setHolder = useSetHolder();
  const [name, setName] = useState(currentName ?? "");
  const [dni, setDni] = useState("");
  const [isForeigner, setIsForeigner] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentName ?? "");
      setDni("");
      setIsForeigner(false);
      setHolder.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId]);

  const dniValid = dni === "" || isValidDocument(dni, isForeigner);
  const canSave =
    online && !setHolder.isPending && dniValid && (name.trim() !== (currentName ?? "") || dni !== "");

  const save = () => {
    if (!canSave) return;
    setHolder.mutate(
      { ticketId, holderName: name.trim() || null, dni: dni || undefined, isForeigner },
      { onSuccess: onClose },
    );
  };

  return (
    <TicketActionSurface open={open} onClose={onClose} anchorRef={anchorRef}>
      <p className="text-[15px] font-bold text-white">Poner datos</p>
      <p className="text-[12px] text-cart-ink-3">{ticketTypeName} · su nombre aparece en la puerta.</p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cart-ink-3">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. María García"
            autoFocus
            className="mt-1 w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cart-accent/60"
          />
        </div>
        <div>
          <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-[12px] text-cart-ink-2">
            <input
              type="checkbox"
              checked={isForeigner}
              onChange={(e) => setIsForeigner(e.target.checked)}
              className="h-4 w-4 accent-cart-accent"
            />
            Es extranjero (no tiene DNI)
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cart-ink-3">
            {isForeigner ? "Pasaporte / documento" : "DNI"} <span className="text-white/25">(opcional)</span>
          </label>
          <input
            value={dni}
            onChange={(e) =>
              setDni(
                isForeigner
                  ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)
                  : e.target.value.replace(/\D/g, "").slice(0, 8),
              )
            }
            inputMode={isForeigner ? "text" : "numeric"}
            placeholder={isForeigner ? "AB123456" : currentDniLast2 ? `•••••• ${currentDniLast2}` : "8 dígitos"}
            className="mt-1 w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cart-accent/60"
          />
          {!dniValid && (
            <p className="mt-1 text-[11px] text-red-400">
              {isForeigner ? "Documento inválido." : "El DNI debe tener 8 dígitos."}
            </p>
          )}
        </div>
      </div>

      {setHolder.isError && (
        <p className="mt-3 text-[12px] text-red-400">No se pudo guardar. Reintenta.</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="mt-4 w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {setHolder.isPending ? "Guardando…" : "Guardar"}
      </button>
    </TicketActionSurface>
  );
}
