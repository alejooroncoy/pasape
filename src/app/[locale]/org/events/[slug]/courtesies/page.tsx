"use client";

import { use, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useCourtesies, useSendCourtesy } from "@/lib/events/hooks/useCourtesies";
import { formatMoney } from "@/lib/_shared/format";
import { isBox, boxSeats, unitNoun, unitsRemaining } from "@/lib/events/ticketDisplay";
import { PhoneField } from "@/components/design/PhoneField";
import { EventShell } from "../_shell/EventShell";
import { OrgSheet as Sheet } from "@/components/domain/org/OrgSheet";
import type { TicketType } from "@/server/events/domain/Event";
import type { CourtesySummary } from "@/server/tickets/ports/TicketRepository";

type Params = Promise<{ slug: string; locale: string }>;

/**
 * Cortesías: el organizador regala una entrada o un box a una persona con
 * nombre (cumpleañeros, prensa, auspiciadores). Se emite una orden de S/0 por
 * la misma tubería de compra — al invitado le llega el link de entrega con su
 * QR por WhatsApp/correo, y si es box invita a su grupo desde su entrada.
 */
export default function CourtesiesPage({ params }: { params: Params }) {
  const { slug } = use(params);
  return (
    <EventShell slug={slug} active="courtesies">
      <CourtesiesContent slug={slug} />
    </EventShell>
  );
}

function CourtesiesContent({ slug }: { slug: string }) {
  const event = useEvent(slug);
  const courtesies = useCourtesies(slug);
  const [open, setOpen] = useState(false);

  const list = courtesies.data ?? [];
  const ticketTypes = event.data?.ticketTypes ?? [];
  const entered = list.reduce((acc, c) => acc + c.usedCount, 0);

  return (
    <>
      {/* Header de la sección: qué es + acción principal */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Cortesías</h2>
          <p className="mt-1 max-w-[440px] text-[12.5px] text-cart-ink-3">
            Regala entradas o un box a invitados especiales — les llega su QR
            por WhatsApp o correo, y aquí ves quién entró.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-cart-accent px-4 py-2 text-[13px] font-semibold text-cart-bg transition hover:brightness-110"
        >
          + Enviar cortesía
        </button>
      </div>

      {/* Resumen */}
      {list.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-[380px]">
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.06em] text-cart-ink-4">Enviadas</div>
            <div className="mt-0.5 text-[22px] font-semibold">{list.length}</div>
          </div>
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.06em] text-cart-ink-4">Ingresaron</div>
            <div className="mt-0.5 text-[22px] font-semibold text-emerald-400">{entered}</div>
          </div>
        </div>
      )}

      {/* Lista */}
      {list.length > 0 ? (
        <div className="mt-5 divide-y divide-cart-line rounded-2xl border border-cart-line bg-cart-bg-elev">
          {list.map((c) => (
            <CourtesyRow key={c.orderId} courtesy={c} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-cart-line px-5 py-10 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="8" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 11h14M10 8v9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 8C10 8 8.5 4.5 6.5 4.5A1.75 1.75 0 006.5 8H10zm0 0c0 0 1.5-3.5 3.5-3.5A1.75 1.75 0 0113.5 8H10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-3 text-[14px] font-medium">Aún no envías cortesías</p>
          <p className="mx-auto mt-1 max-w-[340px] text-[12.5px] text-cart-ink-4">
            Perfectas para cumpleañeros, prensa o auspiciadores: eliges la
            entrada o el box, pones su nombre y contacto, y le llega gratis.
          </p>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <Sheet title="Enviar cortesía" onClose={() => setOpen(false)}>
            <CourtesyForm slug={slug} ticketTypes={ticketTypes} />
          </Sheet>
        )}
      </AnimatePresence>
    </>
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
  const contact = c.guestPhone || c.guestEmail || "—";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-medium">{c.guestName ?? "Invitado"}</div>
        <div className="truncate text-[11.5px] text-cart-ink-4">
          {detail} · {contact} · {sent}
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
  // `unitsRemaining === null` = sin límite → siempre seleccionable.
  const selectable = ticketTypes.filter((tt) => {
    const remaining = unitsRemaining(tt);
    return remaining === null || remaining > 0;
  });
  const selected = selectable.find((tt) => tt.id === ttId) ?? null;
  const selectedRemaining = selected ? unitsRemaining(selected) : null;
  const maxQty = selected ? (selectedRemaining === null ? 10 : Math.min(10, selectedRemaining)) : 1;
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
          phone: phone || null, // E.164 con país (del PhoneField).
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
                className="grid size-8 place-items-center rounded-full text-cart-ink-2 transition hover:text-cart-ink disabled:opacity-30"
                aria-label="Menos"
              >
                −
              </button>
              <span className="w-6 text-center text-[13.5px] font-semibold">{effectiveQty}</span>
              <button
                type="button"
                onClick={() => setQty(Math.min(maxQty, effectiveQty + 1))}
                disabled={effectiveQty >= maxQty}
                className="grid size-8 place-items-center rounded-full text-cart-ink-2 transition hover:text-cart-ink disabled:opacity-30"
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
            className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-cart-ink placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
          />
          <PhoneField value={phone} onChange={setPhone} />
          <input
            type="email"
            placeholder="Correo (opcional si pones WhatsApp)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-cart-ink placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
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
