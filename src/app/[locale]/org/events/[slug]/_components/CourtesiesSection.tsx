"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useCourtesies, useSendCourtesy } from "@/lib/events/hooks/useCourtesies";
import { formatMoney } from "@/lib/_shared/format";
import { isBox, boxSeats, unitNoun, unitsRemaining } from "@/lib/events/ticketDisplay";
import { Sheet } from "../_shell/Sheet";
import type { TicketType } from "@/server/events/domain/Event";
import type { CourtesySummary } from "@/server/tickets/ports/TicketRepository";

/**
 * Cortesías: el organizador regala una entrada o un box a una persona con
 * nombre (cumpleañeros, prensa, auspiciadores). Se emite una orden de S/0 por
 * la misma tubería de compra — al invitado le llega el link de entrega con su
 * QR por WhatsApp/correo, y si es box invita a su grupo desde su entrada.
 */
export function CourtesiesSection({ slug }: { slug: string }) {
  const event = useEvent(slug);
  const courtesies = useCourtesies(slug);
  const [open, setOpen] = useState(false);

  const list = courtesies.data ?? [];
  const ticketTypes = event.data?.ticketTypes ?? [];

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-cart-ink-2">Cortesías</span>
          {list.length > 0 && (
            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-cart-ink-3">
              {list.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-cart-line px-2.5 py-1 text-[11.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
        >
          + Enviar cortesía
        </button>
      </div>

      {list.length > 0 ? (
        <div className="mt-3 divide-y divide-cart-line rounded-2xl border border-cart-line bg-cart-bg-elev">
          {list.map((c) => (
            <CourtesyRow key={c.orderId} courtesy={c} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-cart-ink-4">
          Regala entradas o un box a invitados especiales — les llega su QR por
          WhatsApp o correo, gratis y con tu registro de quién entró.
        </p>
      )}

      <AnimatePresence>
        {open && (
          <Sheet title="Enviar cortesía" onClose={() => setOpen(false)}>
            <CourtesyForm slug={slug} ticketTypes={ticketTypes} />
          </Sheet>
        )}
      </AnimatePresence>
    </section>
  );
}

function CourtesyRow({ courtesy: c }: { courtesy: CourtesySummary }) {
  const sent = new Date(c.createdAt).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
  });
  const detail =
    c.kind === "box"
      ? `${c.ticketTypeName}${c.boxLabel ? ` · ${c.boxLabel}` : ""}`
      : c.ticketCount > 1
        ? `${c.ticketCount} × ${c.ticketTypeName}`
        : c.ticketTypeName;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{c.guestName ?? "Invitado"}</div>
        <div className="truncate text-[11.5px] text-cart-ink-4">
          {detail} · {sent}
        </div>
      </div>
      {c.usedCount > 0 ? (
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-400">
          {c.usedCount === 1 ? "Ingresó" : `${c.usedCount} ingresaron`}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10.5px] font-semibold text-cart-ink-3">
          Enviada
        </span>
      )}
    </div>
  );
}

function CourtesyForm({ slug, ticketTypes }: { slug: string; ticketTypes: TicketType[] }) {
  const send = useSendCourtesy(slug);
  const [ttId, setTtId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Solo tipos con stock: la cortesía reserva de verdad (un box regalado ya no
  // se vende). Sí se puede regalar aunque la venta del tipo haya cerrado.
  const selectable = ticketTypes.filter((tt) => unitsRemaining(tt) > 0);
  const selected = selectable.find((tt) => tt.id === ttId) ?? null;
  const maxQty = selected ? Math.min(10, unitsRemaining(selected)) : 1;
  const effectiveQty = selected && isBox(selected) ? 1 : Math.min(qty, maxQty);

  const canSend =
    !!selected && fullName.trim().length >= 2 && (!!phone.trim() || !!email.trim());

  const handleSend = async () => {
    if (!selected || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync({
        ticketTypeId: selected.id,
        qty: effectiveQty,
        guest: {
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        },
      });
      setSentTo(fullName.trim());
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg === "sold_out"
          ? "Ya no queda stock de esa entrada."
          : "No se pudo enviar. Revisa los datos e intenta de nuevo.",
      );
    }
  };

  const resetForAnother = () => {
    setSentTo(null);
    setFullName("");
    setPhone("");
    setEmail("");
    setQty(1);
    setError(null);
  };

  if (sentTo) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h4 className="mt-4 text-[16px] font-semibold">Cortesía enviada</h4>
        <p className="mt-1 max-w-[300px] text-[13px] text-cart-ink-3">
          A {sentTo} le llega su entrada con QR por{" "}
          {phone.trim() && email.trim()
            ? "WhatsApp y correo"
            : phone.trim()
              ? "WhatsApp"
              : "correo"}
          . Cuando entre, lo verás aquí.
        </p>
        <button
          type="button"
          onClick={resetForAnother}
          className="mt-6 rounded-full bg-cart-accent px-5 py-2 text-[13px] font-semibold text-cart-bg transition hover:brightness-110"
        >
          Enviar otra
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Paso 1: qué regalas */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-cart-ink-4">
          ¿Qué le regalas?
        </div>
        {selectable.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-cart-ink-4">
            No hay entradas con stock disponible para regalar.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {selectable.map((tt) => {
              const active = tt.id === ttId;
              return (
                <button
                  key={tt.id}
                  type="button"
                  onClick={() => setTtId(tt.id)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                    active
                      ? "border-cart-accent bg-cart-accent-soft"
                      : "border-cart-line bg-cart-bg-elev-2 hover:border-cart-line-strong"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{tt.name}</div>
                    <div className="text-[11.5px] text-cart-ink-4">
                      {isBox(tt)
                        ? `${unitNoun(tt)[0].toUpperCase()}${unitNoun(tt).slice(1)} para ${boxSeats(tt)} personas`
                        : `Quedan ${unitsRemaining(tt)}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {tt.priceCents > 0 && (
                      <div className="text-[11px] text-cart-ink-4 line-through">
                        {formatMoney(tt.priceCents, tt.currency)}
                      </div>
                    )}
                    <div className={`text-[12.5px] font-semibold ${active ? "text-cart-accent" : "text-cart-ink-2"}`}>
                      Gratis
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selected && isBox(selected) && (
          <p className="mt-2 text-[12px] text-cart-ink-4">
            El {unitNoun(selected)} se regala entero: tu invitado recibe su QR y
            desde su entrada invita a su grupo ({boxSeats(selected)} personas).
          </p>
        )}
        {selected && !isBox(selected) && maxQty > 1 && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[12.5px] text-cart-ink-3">Cantidad</span>
            <div className="flex items-center gap-1 rounded-full border border-cart-line">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, effectiveQty - 1))}
                disabled={effectiveQty <= 1}
                className="grid size-8 place-items-center rounded-full text-cart-ink-2 transition hover:text-white disabled:opacity-30"
                aria-label="Menos"
              >
                −
              </button>
              <span className="w-6 text-center text-[13.5px] font-semibold">{effectiveQty}</span>
              <button
                type="button"
                onClick={() => setQty(Math.min(maxQty, effectiveQty + 1))}
                disabled={effectiveQty >= maxQty}
                className="grid size-8 place-items-center rounded-full text-cart-ink-2 transition hover:text-white disabled:opacity-30"
                aria-label="Más"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paso 2: a quién */}
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-cart-ink-4">
          ¿Para quién?
        </div>
        <div className="mt-2 flex flex-col gap-2.5">
          <input
            type="text"
            placeholder="Nombre y apellido"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-white placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
          />
          <input
            type="tel"
            placeholder="WhatsApp (ej. 999 888 777)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-white placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
          />
          <input
            type="email"
            placeholder="Correo (opcional si pones WhatsApp)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-white placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
          />
        </div>
        <p className="mt-2 text-[11.5px] text-cart-ink-4">
          Le llega un link con su QR. Su DNI se completa cuando abre el link —
          no necesitas pedírselo.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[12.5px] text-red-400">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend || send.isPending}
        className="rounded-full bg-cart-accent py-2.5 text-[13.5px] font-semibold text-cart-bg transition hover:brightness-110 disabled:opacity-40"
      >
        {send.isPending ? "Enviando…" : "Enviar cortesía"}
      </button>
    </div>
  );
}
