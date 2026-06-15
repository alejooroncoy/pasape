"use client";

import { useMemo } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" })
    .format(new Date(iso))
    .replace(/^./, (c) => c.toUpperCase());

const whenLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-PE", { timeZone: tz, weekday: "short", day: "numeric", month: "short" })
    .format(new Date(iso))
    .replace(/\./g, "")
    .replace(/^./, (c) => c.toUpperCase());

export default function BuyerTicketsPastPage() {
  const tickets = useMyTickets();
  const router = useRouter();

  const { past, upcomingCount, boxesCount, ingresadas, grouped } = useMemo(() => {
    const all = tickets.data ?? [];
    const past: WalletTicket[] = [];
    let upcoming = 0;
    for (const t of all) {
      const isPast = t.event.status === "closed" || t.event.status === "cancelled" || t.status === "used";
      if (isPast) past.push(t);
      else upcoming++;
    }
    past.sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime());
    const grouped = new Map<string, WalletTicket[]>();
    for (const t of past) {
      const key = monthLabel(t.event.startsAt);
      const arr = grouped.get(key) ?? [];
      arr.push(t);
      grouped.set(key, arr);
    }
    return {
      past,
      upcomingCount: upcoming,
      boxesCount: past.filter((t) => t.ticketType.kind === "box").length,
      ingresadas: past.filter((t) => t.status === "used").length,
      grouped,
    };
  }, [tickets.data]);

  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[520px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(184,124,255,0.16), transparent 70%)" }}
      />
      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-3 sm:px-6">
        <header className="py-3">
          <p className="text-[12px] font-medium text-white/50">Mis entradas</p>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">Pasadas</h1>
        </header>

        {/* Tabs */}
        <div className="mt-1 flex gap-1 rounded-2xl bg-white/[0.04] p-1 shadow-[0_0_0_1px_var(--color-cart-line)_inset]">
          <button
            type="button"
            onClick={() => router.push("/tickets" as never)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13.5px] font-semibold text-white/55 transition hover:text-white"
          >
            Próximas
            <span className="rounded-full bg-white/8 px-1.5 py-px text-[10.5px] font-bold text-white/50">{upcomingCount}</span>
          </button>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cart-accent py-2 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-12px_var(--color-cart-accent-glow)]">
            Pasadas
            <span className="rounded-full bg-white/20 px-1.5 py-px text-[10.5px] font-bold">{past.length}</span>
          </span>
        </div>

        {/* Tus noches */}
        <div
          className="mt-4 rounded-2xl border border-cart-accent/25 p-4"
          style={{ background: "linear-gradient(180deg, rgba(124,58,237,0.18), rgba(124,58,237,0.02))" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cart-accent">◆ Tus noches</p>
          <div className="mt-2.5 flex gap-8">
            <Stat n={String(past.length)} k="eventos" />
            <Stat n={String(boxesCount)} k="boxes" />
            <Stat n={String(ingresadas)} k="ingresaste" />
          </div>
        </div>

        {tickets.isLoading && (
          <div className="flex flex-col gap-2.5 pt-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        )}

        {!tickets.isLoading && past.length === 0 && (
          <p className="py-12 text-center text-[13.5px] text-white/40">Todavía no tienes entradas pasadas.</p>
        )}

        {Array.from(grouped.entries()).map(([month, items]) => (
          <div key={month} className="pt-5">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{month}</p>
            <div className="flex flex-col gap-2.5">
              {items.map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.id}` as never}
                  className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 opacity-80 transition hover:opacity-100"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/5 text-[15px] font-bold text-white/70">
                    {t.event.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold leading-tight">{t.event.title}</p>
                    <p className="mt-0.5 text-[12px] text-white/50">{whenLabel(t.event.startsAt, t.event.timezone)}</p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.04em] " +
                      (t.status === "used" ? "bg-[#22D17F]/12 text-[#22D17F]" : "bg-white/5 text-white/45")
                    }
                  >
                    {t.status === "used" ? "✓ INGRESASTE" : "NO FUISTE"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ n, k }: { n: string; k: string }) {
  return (
    <div>
      <div className="text-[24px] font-bold leading-none tracking-[-0.03em]">{n}</div>
      <div className="mt-1 text-[11px] text-white/50">{k}</div>
    </div>
  );
}
