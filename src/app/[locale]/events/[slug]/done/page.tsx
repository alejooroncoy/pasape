"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

export default function PurchaseDonePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

// 987654321 → "987•••321"
const maskPhone = (digits: string): string => {
  const d = digits.replace(/\D/g, "");
  if (d.length < 6) return d;
  return `${d.slice(0, 3)}•••${d.slice(-3)}`;
};

function Inner() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = search.get("order");
  const tickets = useMyTickets();

  // Las entradas se crean al pagar; refrescamos un par de veces por si el
  // wallet aún no las tiene al aterrizar.
  useEffect(() => {
    if (tickets.data && tickets.data.some((t) => t.orderId === orderId)) return;
    const id = setInterval(() => void tickets.refetch(), 1500);
    return () => clearInterval(id);
  }, [tickets, orderId]);

  const mine = useMemo(
    () => (tickets.data ?? []).filter((t) => t.orderId === orderId),
    [tickets.data, orderId],
  );

  const n = mine.length;
  const [first, ...rest] = mine;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 pb-10 pt-8">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-400/15"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-emerald-300">
          <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>

      <h1 className="mt-5 text-center text-[24px] font-bold tracking-[-0.02em] text-white">
        {n > 0 ? `¡Listo! Tienes ${n} ${n === 1 ? "entrada" : "entradas"}` : "¡Listo! Pago confirmado"}
      </h1>
      <p className="mx-auto mt-1.5 max-w-[320px] text-center text-[13.5px] text-cart-ink-2">
        {n > 1
          ? "Una es tuya. ¿Las otras para quién? Mándaselas y le llega su QR — la entrada sigue siendo tuya hasta que la reclame."
          : "Tu entrada ya está en tu wallet, lista para mostrar en la puerta."}
      </p>

      {/* Lista de entradas de esta compra */}
      <div className="mt-7 flex flex-col gap-2.5">
        {first && (
          <div className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-accent text-cart-bg">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M4 9.5l3 3 7-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight">Tu entrada</p>
              <p className="mt-0.5 truncate text-[12px] text-cart-ink-3">{first.ticketType.name} · lista en tu cel</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/tickets/${first.id}` as never)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/15"
            >
              Ver QR
            </button>
          </div>
        )}

        {rest.map((t, i) => (
          <SendRow key={t.id} ticket={t} index={i + 2} onSend={() => router.push(`/tickets/${t.id}` as never)} />
        ))}
      </div>

      {/* CTA principal */}
      <div className="mt-auto pt-8">
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => router.push(`/tickets/${rest[0].id}` as never)}
            className="w-full rounded-full bg-cart-accent py-3.5 text-[15px] font-semibold text-cart-bg shadow-[0_10px_30px_-10px_var(--color-cart-accent-glow-strong)] transition active:scale-[0.98]"
          >
            Enviar la de tu amigo
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push("/tickets" as never)}
          className="mt-2 w-full rounded-full py-3 text-[13.5px] font-medium text-cart-ink-3 transition hover:text-white"
        >
          {rest.length > 0 ? "Las muestro yo desde mi cel" : "Ir a mis entradas"}
        </button>
        {rest.length > 0 && (
          <p className="mt-3 text-center text-[11px] text-cart-ink-4">
            Puedes enviarlas cuando quieras desde “Mis entradas”, antes del evento.
          </p>
        )}
      </div>
    </main>
  );
}

function SendRow({
  ticket,
  index,
  onSend,
}: {
  ticket: WalletTicket;
  index: number;
  onSend: () => void;
}) {
  const pending = ticket.pendingTransferTo;
  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl border bg-cart-bg-elev px-4 py-3.5 transition " +
        (pending ? "border-amber-400/40" : "border-cart-accent/40")
      }
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8 text-cart-ink-2">
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 15c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-tight">{index}ª entrada</p>
        <p className="mt-0.5 truncate text-[12px] text-cart-ink-3">
          {pending ? `Enviada al ${maskPhone(pending)} · esperando` : "Aún sin enviar"}
        </p>
      </div>
      {!pending && (
        <button
          type="button"
          onClick={onSend}
          className="rounded-full bg-cart-accent px-3.5 py-1.5 text-[12px] font-semibold text-cart-bg transition active:scale-95"
        >
          Enviar
        </button>
      )}
    </div>
  );
}
