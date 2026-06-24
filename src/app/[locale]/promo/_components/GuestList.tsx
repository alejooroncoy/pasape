"use client";

import { useState } from "react";
import type { PromoterGuest } from "@/server/promoters/domain/Promoter";

// Lista de invitados reutilizable.
//  - withControls: buscador + chips de estado con conteo (pantalla completa).
//  - limit: corta la lista (resumen en Inicio).
export function GuestList({
  guests,
  loading,
  withControls = false,
  limit,
}: {
  guests: PromoterGuest[];
  loading?: boolean;
  withControls?: boolean;
  limit?: number;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "entered">("all");

  const entered = guests.filter((g) => g.status === "used").length;
  const sent = guests.length - entered;

  const q = query.trim().toLowerCase();
  let rows = guests.filter((g) => {
    const byStatus =
      filter === "all" || (filter === "entered" ? g.status === "used" : g.status !== "used");
    const byQuery =
      !q ||
      (g.name ?? "").toLowerCase().includes(q) ||
      (g.phone ?? "").toLowerCase().includes(q) ||
      (g.email ?? "").toLowerCase().includes(q);
    return byStatus && byQuery;
  });
  if (limit) rows = rows.slice(0, limit);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-cart-line bg-cart-bg-elev/50" />
        ))}
      </div>
    );
  }

  if (guests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-8 text-center text-[13px] text-cart-ink-3">
        Todavía no invitaste a nadie. Agrega tu primer invitado y le llega su entrada al toque.
      </div>
    );
  }

  return (
    <div>
      {withControls && (
        <>
          <div className="mb-3 flex h-11 items-center gap-2.5 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 focus-within:border-cart-accent">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="shrink-0 text-cart-ink-4">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="m14 14 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar invitado…"
              className="w-full bg-transparent text-[13.5px] text-white outline-none placeholder:text-cart-ink-4"
            />
          </div>
          <div className="mb-3 flex gap-2">
            <StatusChip label="Todos" count={guests.length} active={filter === "all"} onClick={() => setFilter("all")} />
            <StatusChip label="Enviados" count={sent} active={filter === "sent"} onClick={() => setFilter("sent")} />
            <StatusChip
              label="Entraron"
              count={entered}
              active={filter === "entered"}
              onClick={() => setFilter("entered")}
              tone="green"
            />
          </div>
        </>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev px-4 py-8 text-center text-[13px] text-cart-ink-3">
          No hay invitados que coincidan.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((g) => {
            const inside = g.status === "used";
            return (
              <li
                key={g.ticketId}
                className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cart-accent-soft font-sans text-[14px] font-semibold uppercase text-cart-accent">
                  {(g.name ?? "?").trim().charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">{g.name ?? "Invitado"}</div>
                  <div className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{g.phone ?? g.email ?? ""}</div>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] " +
                    (inside ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.05] text-cart-ink-3")
                  }
                >
                  {inside ? "Entró" : "Enviado"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusChip({
  label,
  count,
  active,
  onClick,
  tone = "accent",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "accent" | "green";
}) {
  const activeCls =
    tone === "green"
      ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-300"
      : "border-cart-accent/50 bg-cart-accent-soft text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition " +
        (active ? activeCls : "border-cart-line bg-white/[0.03] text-cart-ink-2 hover:text-white")
      }
    >
      {label}
      <span className={active ? "font-semibold" : "text-cart-ink-3"}>{count}</span>
    </button>
  );
}
