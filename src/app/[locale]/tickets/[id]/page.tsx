"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "@/i18n/navigation";
import { QrSquare } from "@/components/design";
import { useTicket, useTransferTicket } from "@/lib/tickets/hooks/useTickets";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useLocalRotatingQr } from "@/lib/tickets/hooks/useLocalRotatingQr";
import { useBoxForTicket } from "@/lib/boxes/hooks/useBoxes";
import { formatDate } from "@/lib/_shared/format";

type Props = { params: Promise<{ id: string }> };

export default function TicketDetailPage({ params }: Props) {
  const { id } = use(params);
  const me = useCurrentUser();
  const { data, isLoading, error } = useTicket(id);
  const transfer = useTransferTicket();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  // QR firmado (ECDSA): clave no-extraíble en el device + cert del evento.
  // Genera el QR rotativo 100% offline tras la primera carga. Si el ticket está
  // used/void, null evita carga.
  const activeTicketId = data && data.status === "active" ? id : null;
  const rotating = useLocalRotatingQr(activeTicketId);
  const isBoxTicket = !!data?.boxLabel;
  const isHost = isBoxTicket && !data?.boxHostTicketId;
  const boxQuery = useBoxForTicket(isHost ? id : "");
  const box = boxQuery.data ?? null;

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cart-bg text-cart-ink-3">
        <span className="text-[13px]">Cargando…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cart-bg px-6 text-center text-cart-ink-2">
        <div>
          <p className="text-[15px]">No pudimos cargar tu entrada.</p>
          <button
            type="button"
            onClick={() => router.push("/tickets" as never)}
            className="mt-3 text-[13px] text-cart-accent underline"
          >
            Ver mis entradas
          </button>
        </div>
      </div>
    );
  }

  const holderName = data.holderName ?? me.data?.user?.fullName ?? "Tu pase";
  const eventDate = formatDate(data.event.startsAt, data.event.timezone);

  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3.5">
          <Link
            href="/tickets"
            aria-label="Mis entradas"
            className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="text-[12.5px] font-medium text-cart-ink-3">Tu entrada</span>
          <span className="size-9" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-6 lg:max-w-[440px]">
        {/* QR card */}
        <div
          className="overflow-hidden rounded-[28px] border border-cart-accent/40"
          style={{
            background:
              "linear-gradient(180deg, rgba(124,58,237,0.28), rgba(20,12,40,0.6))",
            boxShadow:
              "0 30px 60px -20px rgba(124,58,237,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {/* Card header */}
          <div className="px-6 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-cart-accent">
                Muestra en puerta
              </span>
              <span className="font-mono text-[11px] text-cart-ink-3">
                #{data.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {isBoxTicket && (
              <div className="mt-4">
                <div className="text-[28px] font-bold leading-none tracking-[-0.02em]">
                  BOX {data.boxLabel}
                </div>
                <div className="mt-1 text-[13.5px] text-cart-ink-2">{holderName}</div>
              </div>
            )}

            <h1 className="mt-3 text-[22px] font-bold leading-[1.15] tracking-[-0.02em]">
              {data.event.title}
            </h1>
            <p className="mt-1 text-[12.5px] text-cart-ink-3">
              {eventDate}
              {data.event.venue ? ` · ${data.event.venue}` : ""}
            </p>
          </div>

          {/* QR slot — white bg, padding tight, rotating ring overlay */}
          <div className="mx-6 mt-5 rounded-2xl bg-white p-5">
            <div className="relative mx-auto grid size-[240px] place-items-center">
              {rotating.payload ? (
                <QrSquare code={rotating.payload} size={240} />
              ) : (
                <div className="grid size-[240px] place-items-center text-[13px] text-cart-ink-3">
                  {rotating.error ? "Error generando QR" : "Generando QR…"}
                </div>
              )}
              {rotating.payload && <CountdownRing seconds={rotating.secondsLeft} />}
            </div>
          </div>

          {/* Below QR row */}
          <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-4">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">
                Titular
              </div>
              <div className="mt-0.5 truncate text-[14px] font-semibold">
                {holderName}
              </div>
              <div className="text-[11.5px] text-cart-ink-3">{data.ticketType.name}</div>
            </div>
            {data.status === "active" && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15"
              >
                Transferir
              </button>
            )}
            {data.status === "used" && (
              <span className="rounded-full bg-rose-500/20 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-rose-300">
                Ya usada
              </span>
            )}
            {data.status === "void" && (
              <span className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cart-ink-3">
                Anulada
              </span>
            )}
          </div>
        </div>

        {/* Box info + invite (only host) */}
        {isBoxTicket && box && (
          <div className="mt-4 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
                  Tu box
                </div>
                <div className="mt-0.5 text-[14px] font-semibold">
                  {box.members.length} de {box.capacity} personas adentro
                </div>
              </div>
              {isHost && data.status === "active" && (
                <Link
                  href={`/tickets/${id}/box`}
                  className="rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-semibold text-cart-bg transition hover:brightness-110"
                >
                  Invitar al box →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Security note */}
        {data.status === "active" && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cart-accent/30 bg-cart-accent-soft px-4 py-3">
            <span className="mt-0.5 text-cart-accent">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <path
                  d="M11 2L3 5v5c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V5l-8-3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M7.5 11l2.5 2.5L14.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="text-[13px] leading-[1.45]">
              <div className="font-semibold text-white">Tu QR cambia cada 10 segundos</div>
              <div className="mt-0.5 text-[11.5px] text-cart-ink-3">
                Las capturas no sirven. Mantén esta página abierta al entrar.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Transfer sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[460px] rounded-t-[24px] border-t border-cart-line-strong bg-cart-bg-elev p-6 lg:rounded-3xl lg:border"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
          >
            <div className="mb-4 flex justify-center lg:hidden">
              <span className="h-1 w-9 rounded-full bg-white/15" />
            </div>
            <h2 className="text-[22px] font-bold tracking-[-0.02em]">
              Transferir entrada
            </h2>
            <p className="mt-2 text-[13px] leading-[1.5] text-cart-ink-3">
              La entrada deja de ser tuya. El receptor recibe su propio QR.
            </p>

            <label className="mt-5 block">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
                Email o celular del receptor
              </span>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="alguien@gmail.com o 987 654 321"
                className="mt-1.5 block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 text-[15px] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
              />
            </label>

            <button
              type="button"
              onClick={async () => {
                await transfer.mutateAsync({ ticketId: data.id, toIdentifier: recipient });
                setOpen(false);
                setRecipient("");
              }}
              disabled={transfer.isPending || !recipient}
              className="mt-5 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
            >
              {transfer.isPending ? "Transfiriendo…" : "Confirmar transferencia"}
            </button>
            {transfer.error && (
              <p className="mt-3 text-center text-[12px] text-rose-300">
                {transferErrorCopy((transfer.error as Error).message)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountdownRing({ seconds }: { seconds: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, (10 - seconds) / 10));
  const offset = circumference * progress;
  return (
    <div className="absolute -right-[12px] -top-[12px] grid size-12 place-items-center rounded-full bg-cart-bg shadow-[0_0_0_2px_var(--color-cart-bg-elev),0_8px_20px_rgba(0,0,0,0.4)]">
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        className="absolute inset-0 -rotate-90"
      >
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-cart-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: "drop-shadow(0 0 6px var(--color-cart-accent-glow))",
            transition: "stroke-dashoffset 1s linear",
          }}
        />
      </svg>
      <span className="text-[13px] font-bold tracking-[-0.02em] text-cart-accent">
        {seconds}s
      </span>
    </div>
  );
}

function transferErrorCopy(raw: string): string {
  switch (raw) {
    case "transfer_window_closed":
      return "Ya no se puede transferir — la ventana cerró cerca del evento.";
    case "transfers_disabled":
      return "Este evento no permite transferencias.";
    case "transfer_limit_reached":
      return "Esta entrada alcanzó el máximo de transferencias.";
    case "not_owner":
      return "No eres el dueño actual de esta entrada.";
    case "ticket_not_active":
      return "Esta entrada ya no está activa (usada o anulada).";
    case "recipient_required":
      return "Necesitamos a quién transferir.";
    default:
      return raw;
  }
}
