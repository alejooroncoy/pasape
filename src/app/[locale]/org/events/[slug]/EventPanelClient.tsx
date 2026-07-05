"use client";

import { use, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { useRealtimeEventStats } from "@/lib/events/hooks/useRealtimeEventStats";
import { useEventPartners, useAddEventPartner, useRemoveEventPartner } from "@/lib/events/hooks/useEventPartners";
import { formatMoney } from "@/lib/_shared/format";
import { Money } from "@/lib/_shared/money";
import { EventShell } from "./_shell/EventShell";
import { Sheet } from "./_shell/Sheet";
import { SpotlightTour } from "@/components/ui/SpotlightTour";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import {
  useEventPromoters,
  useRemoveAssignment,
  useUpdateAssignmentCommission,
} from "@/lib/promoters/hooks/useEventPromoters";
import { milestoneIcon } from "@/lib/promoters/milestoneDisplay";
import { PersonalizeSheet, type PayPatch } from "./team/page";
import type { EventStatsPayload } from "@/lib/events/hooks/useEventStats";
import type { EventPartner } from "@/server/events/application/EventPartners";
import type { EventPromoterAssignment } from "@/server/promoters/application/EventPromoterAssignment";

type PromoterStat = EventStatsPayload["byPromoter"][number];

type Params = Promise<{ slug: string; locale: string }>;

export function EventPanelClient({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const stats = useEventStats(slug);
  // Refresca KPIs al instante cuando entra/cambia una venta o un scan (Broadcast
  // desde DB, con debounce). Cubre también los scans vía el trigger
  // scan_events_broadcast_stats → ya no hace falta useScanRealtime.
  useRealtimeEventStats(event.data?.event?.id, slug);

  const ev = event.data?.event;
  const status = ev?.status ?? "draft";

  const isFinished = status === "closed" || status === "cancelled";

  return (
    <EventShell slug={slug} active="panel">
      {isFinished ? (
        <FinalReport slug={slug} ev={ev} stats={stats.data} />
      ) : (
        <LivePanel slug={slug} ev={ev} stats={stats.data} />
      )}
    </EventShell>
  );
}

// ============================================================
// Live panel (evento en curso o futuro)
// ============================================================
function LivePanel({
  slug,
  ev,
  stats,
}: {
  slug: string;
  ev: ReturnType<typeof useEvent>["data"] extends { event: infer E } | null | undefined ? E | undefined : never;
  stats: EventStatsPayload | undefined;
}) {
  const sold = stats?.sold ?? 0;
  const reserved = stats?.reserved ?? 0;
  const validated = stats?.validated ?? 0;
  const revenue = stats?.revenueCents ?? 0;
  // Aforo: el evento casi nunca tiene total_capacity (el composer no lo pide);
  // caemos al derivado del backend (suma de capacidades de entradas + asientos
  // de boxes, vía event_stats_rollup) para no mostrar "Sin aforo definido".
  const capacity = ev?.capacity.totalCapacity ?? stats?.capacity ?? 0;
  const soldPct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const validatedPct = sold ? Math.round((validated / sold) * 100) : 0;
  // Reservadas = en proceso de pago (orden pending <30min). No son ventas aún.
  const soldHint = capacity
    ? `${soldPct}% del aforo (${capacity.toLocaleString("es-PE")})`
    : "Sin aforo definido";

  // Promotor abierto en el sheet de detalle — derivado del cache para reflejar
  // actualizaciones en vivo (Realtime) mientras está abierto.
  const [openPromoterId, setOpenPromoterId] = useState<string | null>(null);
  const openPromoter = stats?.byPromoter?.find((p) => p.promoterLinkId === openPromoterId) ?? null;
  const assignments = useEventPromoters(slug);
  const updateCommission = useUpdateAssignmentCommission(slug);
  const removeAssignment = useRemoveAssignment(slug);
  const openAssignment =
    assignments.data?.find((a) => a.promoterLinkId === openPromoterId) ?? null;
  const closePromoterSheet = () => setOpenPromoterId(null);

  return (
    <>
      {/* Banner de honestidad (duplicados offline + puertas sin sincronizar) —
          desactivado por ahora: de momento no sumaba suficiente para el
          espacio que ocupaba. DoorHealthBanner queda definido por si se
          retoma más adelante. */}

      {/* KPIs */}
      <section data-tour="kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        <KpiCard
          label="Vendidas"
          value={sold.toLocaleString("es-PE")}
          hint={
            reserved > 0
              ? `${soldHint} · ${reserved} reservada${reserved === 1 ? "" : "s"}`
              : soldHint
          }
          progress={capacity ? soldPct : null}
          tone="accent"
        />
        <KpiCard
          label="Ingresaron"
          value={validated.toLocaleString("es-PE")}
          hint={sold ? `${validatedPct}% de las vendidas` : "Sin ventas aún"}
          progress={sold ? validatedPct : null}
          tone="green"
        />
        <KpiCard
          label="Recaudado"
          value={formatMoneyClean(revenue, ev?.currency)}
          hint={
            (stats?.serviceFeeCents ?? 0) > 0 ? (
              // "Recibes" es EL número que le importa al organizador — no puede
              // pasar desapercibido como una línea gris.
              <span className="flex flex-col gap-0.5">
                <span className="text-[14px] font-semibold text-white">
                  Recibes {formatMoneyClean(stats?.netCents ?? 0, ev?.currency)}
                </span>
                <span>Servicio Pasape {formatMoneyClean(stats?.serviceFeeCents ?? 0, ev?.currency)}</span>
              </span>
            ) : (
              "acumulado en el evento"
            )
          }
          tone="neutral"
        />
      </section>

      {/* Quick actions (mobile) — cerca de arriba, no al fondo del scroll */}
      <section className="mt-3 grid grid-cols-2 gap-2.5 lg:hidden">
        <Link
          href={`/org/events/${slug}/door-link` as never}
          className="flex items-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 text-[13px] font-medium"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-cart-accent-soft text-cart-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="3" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          Link portero
        </Link>
        <button
          type="button"
          data-tour="download"
          onClick={() => { window.location.href = `/api/events/${slug}/export`; }}
          className="flex items-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-3 text-left text-[13px] font-medium"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-cart-accent-soft text-cart-accent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v8m0 0l-3-3m3 3l3-3M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Excel
        </button>
      </section>

      {/* Body: 2 columnas en desktop, stack en mobile */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-7">
        {/* Ranking de promotores */}
        <section data-tour="promoters" className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          <header className="border-b border-cart-line">
            <div className="flex items-center justify-between px-4 pt-3 pb-3 lg:px-5">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Promotores</h2>
              <Link
                href={`/org/events/${slug}/team` as never}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-cart-ink-2 transition hover:bg-white/5 hover:text-white"
              >
                Ver links →
              </Link>
            </div>
            <div className="grid grid-cols-[32px_1fr_36px_36px_56px] border-t border-cart-line items-center gap-3 px-4 py-1.5 lg:px-5">
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span className="text-right text-[10px] uppercase tracking-[0.04em] text-cart-ink-4">Vend.</span>
              <span className="text-right text-[10px] uppercase tracking-[0.04em] text-cart-ink-4">Val.</span>
              <span className="text-right text-[10px] uppercase tracking-[0.04em] text-cart-ink-4">Ingreso</span>
            </div>
          </header>

          {stats?.byPromoter?.length ? (
            <div className="divide-y divide-cart-line">
              {stats.byPromoter.map((p, i) => (
                <PromoterRow
                  key={p.promoterLinkId}
                  rank={i + 1}
                  promoter={p}
                  onOpen={() => setOpenPromoterId(p.promoterLinkId)}
                />
              ))}
            </div>
          ) : (
            <EmptyRow label="Sin ventas por promotor todavía." />
          )}
        </section>

        {/* Live feed */}
        <section data-tour="live-scans" className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
            <div className="flex items-center gap-2">
              <span className="relative grid size-5 place-items-center">
                <span className="absolute size-3 animate-ping rounded-full bg-cart-accent/40" />
                <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent-glow-strong)]" />
              </span>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Accesos en vivo</h2>
            </div>
            <span className="text-[11.5px] text-cart-ink-4">últimos 10</span>
          </header>

          {stats?.scansRecent.length ? (
            <ul className="divide-y divide-cart-line">
              {stats.scansRecent.slice(0, 10).map((s) => (
                <ScanRow
                  key={s.id}
                  when={s.scannedAt}
                  result={s.result}
                  ticketTypeKind={s.ticketTypeKind}
                  ticketTypeName={s.ticketTypeName}
                  boxLabel={s.boxLabel}
                  unitNoun={s.unitNoun}
                />
              ))}
            </ul>
          ) : (
            <EmptyRow label="Aún no hay accesos registrados." />
          )}

          <div className="border-t border-cart-line p-3 lg:p-4">
            <Link
              href={`/org/events/${slug}/scans` as never}
              className="block rounded-xl border border-dashed border-cart-line-strong px-3.5 py-2.5 text-center text-[12.5px] font-medium text-cart-ink-2 transition hover:border-white/40 hover:text-white"
            >
              Ver historial completo
            </Link>
          </div>
        </section>
      </div>

      {/* Boxes — cómo se van llenando en vivo */}
      <BoxesSection ticketTypes={stats?.ticketTypes ?? []} />

      {/* Partners */}
      <PartnersSection slug={slug} />

      <SpotlightTour
        tourId="event_panel"
        steps={[
          { selector: "[data-tour='kpis']", title: "Lo importante", body: "Estos 3 números son tu noche." },
          { selector: "[data-tour='promoters']", title: "Tu equipo", body: "Tap a un promotor para ver sus ventas." },
          { selector: "[data-tour='live-scans']", title: "En vivo", body: "Cada vez que el portero escanea, aparece aquí." },
          { selector: "[data-tour='download']", title: "Cuando quieras", body: "Bajá el Excel a cualquier hora." },
        ]}
      />

      <AnimatePresence>
        {openPromoter && (
          <Sheet title={openPromoter.name} onClose={closePromoterSheet}>
            <PromoterDetail
              promoter={openPromoter}
              slug={slug}
              currency={ev?.currency}
              assignment={openAssignment}
              commissionSaving={updateCommission.isPending}
              onSetCommission={(patch) =>
                openAssignment &&
                updateCommission.mutate({ linkId: openAssignment.promoterLinkId, ...patch })
              }
              onRemoveAssignment={() => {
                if (!openAssignment) return;
                if (confirm(`¿Quitar a ${openAssignment.name} de este evento?`)) {
                  removeAssignment.mutate(openAssignment.promoterLinkId, {
                    onSuccess: closePromoterSheet,
                  });
                }
              }}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// Reporte final (evento terminado)
// ============================================================
function FinalReport({
  slug,
  ev,
  stats,
}: {
  slug: string;
  ev: ReturnType<typeof useEvent>["data"] extends { event: infer E } | null | undefined ? E | undefined : never;
  stats: EventStatsPayload | undefined;
}) {
  const sold = stats?.sold ?? 0;
  const validated = stats?.validated ?? 0;
  const noShow = Math.max(0, sold - validated);
  const revenue = stats?.revenueCents ?? 0;
  // Mismo fallback de aforo que el panel en vivo (total_capacity casi nunca existe).
  const capacity = ev?.capacity.totalCapacity ?? stats?.capacity ?? 0;
  const soldPct = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const attendancePct = sold ? Math.round((validated / sold) * 100) : 0;

  const [openPromoterId, setOpenPromoterId] = useState<string | null>(null);
  const openPromoter = stats?.byPromoter?.find((p) => p.promoterLinkId === openPromoterId) ?? null;
  const assignments = useEventPromoters(slug);
  const updateCommission = useUpdateAssignmentCommission(slug);
  const removeAssignment = useRemoveAssignment(slug);
  const openAssignment =
    assignments.data?.find((a) => a.promoterLinkId === openPromoterId) ?? null;
  const closePromoterSheet = () => setOpenPromoterId(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera del reporte */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M2 12V5l5-3 5 3v7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <rect x="5" y="8" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-2">
            Reporte final
          </span>
        </div>
        <button
          type="button"
          onClick={() => { window.location.href = `/api/events/${slug}/export`; }}
          className="hidden items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:border-cart-line-strong lg:inline-flex"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v8m0 0l-3-3m3 3l3-3M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Descargar Excel
        </button>
      </div>

      {/* Recaudado — hero */}
      <div
        className="rounded-2xl p-5 lg:p-6"
        style={{
          background: "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.04) 100%)",
          boxShadow: "0 0 0 1px rgba(124,58,237,0.25) inset",
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
          Total recaudado
        </div>
        <div className="mt-2 font-sans text-[48px] font-semibold leading-none tracking-[-0.04em] lg:text-[60px]">
          {formatMoneyClean(revenue, ev?.currency)}
        </div>
        {(stats?.serviceFeeCents ?? 0) > 0 && (
          <div className="mt-2 text-[13px] text-cart-ink-3">
            Recibes{" "}
            <span className="font-semibold text-white">
              {formatMoneyClean(stats?.netCents ?? 0, ev?.currency)}
            </span>{" "}
            · Servicio Pasape {formatMoneyClean(stats?.serviceFeeCents ?? 0, ev?.currency)}
          </div>
        )}

        {/* Trío de stats */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/8 pt-5">
          <div>
            <div className="font-sans text-[26px] font-semibold leading-none tracking-[-0.03em] lg:text-[32px]">
              {sold.toLocaleString("es-PE")}
            </div>
            <div className="mt-1 text-[11.5px] text-cart-ink-3">vendidas</div>
          </div>
          <div>
            <div className="font-sans text-[26px] font-semibold leading-none tracking-[-0.03em] text-[#22D17F] lg:text-[32px]">
              {validated.toLocaleString("es-PE")}
            </div>
            <div className="mt-1 text-[11.5px] text-cart-ink-3">asistieron</div>
          </div>
          <div>
            <div className="font-sans text-[26px] font-semibold leading-none tracking-[-0.03em] text-cart-ink-2 lg:text-[32px]">
              {noShow.toLocaleString("es-PE")}
            </div>
            <div className="mt-1 text-[11.5px] text-cart-ink-3">no shows</div>
          </div>
        </div>

        {/* Barra de asistencia */}
        {sold > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-cart-ink-3">
              <span>Asistencia</span>
              <span className="font-semibold text-[#22D17F]">{attendancePct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[#22D17F] transition-[width] duration-700"
                style={{ width: `${attendancePct}%` }}
              />
            </div>
          </div>
        )}

        {/* Aforo */}
        {capacity > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-cart-ink-3">
              <span>Aforo cubierto</span>
              <span className="font-semibold text-white">{soldPct}% de {capacity.toLocaleString("es-PE")}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-cart-accent transition-[width] duration-700"
                style={{ width: `${soldPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Body: 2 columnas en desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-7">
        {/* Promotores */}
        <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          <header className="flex items-center justify-between border-b border-cart-line px-4 py-3 lg:px-5">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Promotores</h2>
              <p className="text-[11.5px] text-cart-ink-3">vendido · validado · recaudado</p>
            </div>
            <Link
              href={`/org/events/${slug}/team` as never}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-cart-ink-2 transition hover:bg-white/5 hover:text-white"
            >
              Ver detalle →
            </Link>
          </header>
          {stats?.byPromoter?.length ? (
            <div className="divide-y divide-cart-line">
              {stats.byPromoter.map((p, i) => (
                <PromoterRow
                  key={p.promoterLinkId}
                  rank={i + 1}
                  promoter={p}
                  onOpen={() => setOpenPromoterId(p.promoterLinkId)}
                />
              ))}
            </div>
          ) : (
            <EmptyRow label="Sin ventas por promotor." />
          )}
        </section>

        {/* Desglose por nombre de entrada */}
        <section className="rounded-2xl border border-cart-line bg-cart-bg-elev">
          <header className="border-b border-cart-line px-4 py-3 lg:px-5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Por entrada</h2>
            <p className="text-[11.5px] text-cart-ink-3">vendidas · recaudado</p>
          </header>
          {stats?.ticketTypes?.length ? (
            <div className="divide-y divide-cart-line">
              {(() => {
                const nonBox = stats.ticketTypes.filter((t) => t.kind !== "box");
                const boxes = stats.ticketTypes.filter((t) => t.kind === "box");
                const rows: React.ReactNode[] = nonBox.map((t) => {
                  const fillPct = t.capacity > 0 ? Math.round((t.sold / t.capacity) * 100) : 0;
                  return (
                    <div key={t.id} className="px-4 py-3 lg:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold">{t.name}</div>
                          <div className="mt-0.5 text-[11px] text-cart-ink-3">
                            {t.sold} de {t.capacity} vendidas
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-[13px] font-semibold">
                            {formatMoneyClean(t.revenueCents, ev?.currency)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-cart-ink-3">
                            {fillPct}% del cupo
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-cart-accent/60" style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                  );
                });
                if (boxes.length > 0) {
                  const totalBoxes = boxes.length;
                  const soldBoxes = boxes.filter((b) => b.sold > 0).length;
                  const boxRevenue = boxes.reduce((s, b) => s + b.revenueCents, 0);
                  const fillPct = totalBoxes > 0 ? Math.round((soldBoxes / totalBoxes) * 100) : 0;
                  const noun = boxes[0]?.name?.split(" ")[0] ?? "Box";
                  rows.push(
                    <div key="__boxes__" className="px-4 py-3 lg:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold">{noun}s</div>
                          <div className="mt-0.5 text-[11px] text-cart-ink-3">
                            {soldBoxes} de {totalBoxes} reservados
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-[13px] font-semibold">
                            {formatMoneyClean(boxRevenue, ev?.currency)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-cart-ink-3">
                            {fillPct}% ocupados
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-cart-accent/60" style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                  );
                }
                return rows;
              })()}
            </div>
          ) : (
            <EmptyRow label="Sin datos de entradas." />
          )}
        </section>
      </div>

      {/* CTA Excel mobile */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => { window.location.href = `/api/events/${slug}/export`; }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cart-line bg-cart-bg-elev py-3.5 text-[14px] font-semibold transition hover:border-cart-line-strong hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v8m0 0l-3-3m3 3l3-3M2 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Descargar Excel completo
        </button>
      </div>

      <AnimatePresence>
        {openPromoter && (
          <Sheet title={openPromoter.name} onClose={closePromoterSheet}>
            <PromoterDetail
              promoter={openPromoter}
              slug={slug}
              currency={ev?.currency}
              assignment={openAssignment}
              commissionSaving={updateCommission.isPending}
              onSetCommission={(patch) =>
                openAssignment &&
                updateCommission.mutate({ linkId: openAssignment.promoterLinkId, ...patch })
              }
              onRemoveAssignment={() => {
                if (!openAssignment) return;
                if (confirm(`¿Quitar a ${openAssignment.name} de este evento?`)) {
                  removeAssignment.mutate(openAssignment.promoterLinkId, {
                    onSuccess: closePromoterSheet,
                  });
                }
              }}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * `boxLabel` normalmente ya es el nombre completo de la instancia (ej. "Box
 * Platinum A"). Pero si el organizador renombra un box individual con
 * "Editar c/u" en el composer, boxLabel/name quedan en solo lo que escribió
 * (ej. "A"), perdiendo el nombre del grupo. `unitNoun` no se toca al
 * personalizar, así que sirve de red de seguridad para no perder la
 * categoría (Normal/Platinum) en pantalla.
 */
function boxDisplayLabel(b: { name: string; boxLabel: string | null; unitNoun: string | null }): string {
  const raw = b.boxLabel ?? b.name;
  if (!b.unitNoun) return raw;
  const noun = b.unitNoun.charAt(0).toUpperCase() + b.unitNoun.slice(1);
  return raw.toLowerCase().startsWith(b.unitNoun.toLowerCase()) ? raw : `${noun} ${raw}`;
}

// ============================================================
// Boxes — cuántas personas ya entraron por box, en vivo
// ============================================================
function BoxesSection({ ticketTypes }: { ticketTypes: EventStatsPayload["ticketTypes"] }) {
  // Ordena agrupando naturalmente por categoría (ej. "Box Normal" vs "Box
  // Platinum") y dentro de cada una por letra/número.
  const boxes = [...ticketTypes]
    .filter((t) => t.kind === "box")
    .sort((a, b) => boxDisplayLabel(a).localeCompare(boxDisplayLabel(b), "es", { numeric: true }));
  if (!boxes.length) return null;

  return (
    <section className="mt-6 rounded-2xl border border-cart-line bg-cart-bg-elev">
      <header className="border-b border-cart-line px-4 py-3 lg:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Boxes</h2>
        <p className="text-[11.5px] text-cart-ink-3">personas que ya entraron por box</p>
      </header>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5">
        {boxes.map((b) => {
          const label = boxDisplayLabel(b);
          const pct = b.capacity > 0 ? Math.min(100, Math.round((b.validated / b.capacity) * 100)) : 0;
          const full = b.capacity > 0 && b.validated >= b.capacity;
          return (
            <div key={b.id} className="rounded-xl border border-cart-line bg-cart-bg-elev-2 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold">{label}</span>
                {full && (
                  <span className="shrink-0 rounded-full bg-cart-accent-soft px-2 py-0.5 text-[10px] font-semibold text-cart-accent">
                    Lleno
                  </span>
                )}
              </div>
              <div className="mt-1.5 font-mono text-[13px] text-cart-ink-3">
                <span className="font-semibold text-white">{b.validated}</span> / {b.capacity} personas
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-cart-accent transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// KPI Card (live panel)
// ============================================================
function KpiCard({
  label,
  value,
  hint,
  progress,
  tone,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  progress?: number | null;
  tone: "accent" | "green" | "neutral";
}) {
  const barColor =
    tone === "accent" ? "var(--color-cart-accent)" : tone === "green" ? "#22D17F" : "rgba(255,255,255,0.5)";
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 lg:p-5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-ink-3">
        <span
          className="size-1.5 rounded-full"
          style={{ background: barColor, boxShadow: tone === "green" ? "0 0 6px rgba(34,209,127,0.6)" : "none" }}
        />
        {label}
      </div>
      <div className="mt-2 font-sans text-[36px] font-semibold leading-none tracking-[-0.035em] lg:text-[44px]">
        {value}
      </div>
      <div className="mt-2 text-[11.5px] text-cart-ink-3">{hint}</div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%`, background: barColor }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Promoter row (shared entre live y reporte)
// ============================================================
function PromoterRow({
  rank,
  promoter,
  onOpen,
}: {
  rank: number;
  promoter: PromoterStat;
  onOpen: () => void;
}) {
  const flagColor =
    promoter.flag === "suspect" ? "#FF4D5E" : promoter.flag === "watch" ? "#FFCE3B" : "#22D17F";
  const flagLabel =
    promoter.flag === "suspect"
      ? "Revisar — posible autoventa"
      : promoter.flag === "watch"
        ? "Asistencia baja"
        : "Asistencia OK";
  const pct = Math.round((promoter.attendanceRate ?? 0) * 100);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[32px_1fr_36px_36px_56px] items-baseline gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02] lg:px-5"
    >
      <div className="grid size-8 shrink-0 place-items-center self-center rounded-full bg-cart-bg-elev-2 text-[12px] font-semibold text-cart-ink-2">
        {rank}
      </div>
      <div className="min-w-0 self-center">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{promoter.name}</span>
          <span
            title={flagLabel}
            aria-label={flagLabel}
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: flagColor, boxShadow: `0 0 6px ${flagColor}88` }}
          />
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-cart-ink-3">
          {promoter.code} · {pct}% asistencia
        </div>
      </div>
      <span className="text-right font-mono text-[13px] font-semibold">{promoter.ticketsSold}</span>
      <span className="text-right font-mono text-[12.5px] font-semibold text-[#22D17F]">
        {promoter.ticketsValidated}
      </span>
      <span className="text-right font-mono text-[12.5px] text-cart-ink-3">
        {formatMoneyClean(promoter.revenueCents)}
      </span>
    </button>
  );
}

// ============================================================
// Promoter detail (sheet — se abre al tocar una fila del ranking)
// ============================================================
function PromoterDetail({
  promoter,
  slug,
  currency,
  assignment,
  commissionSaving,
  onSetCommission,
  onRemoveAssignment,
}: {
  promoter: PromoterStat;
  slug: string;
  currency?: string;
  assignment: EventPromoterAssignment | null;
  commissionSaving: boolean;
  onSetCommission: (patch: PayPatch) => void;
  onRemoveAssignment: () => void;
}) {
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const pct = Math.round((promoter.attendanceRate ?? 0) * 100);
  const flagCfg =
    promoter.flag === "suspect"
      ? {
          color: "#FF4D5E",
          tint: "rgba(255,77,94,0.1)",
          label: "Revisar — posible autoventa",
          hint: "Menos del 30% de lo vendido por su link entró al evento.",
        }
      : promoter.flag === "watch"
        ? {
            color: "#FFCE3B",
            tint: "rgba(255,206,59,0.1)",
            label: "Asistencia baja",
            hint: "Entre 30% y 70% de lo vendido por su link entró al evento.",
          }
        : {
            color: "#22D17F",
            tint: "rgba(34,209,127,0.1)",
            label: "Asistencia OK",
            hint: "70% o más de lo vendido por su link entró (o aún hay pocas ventas para medir).",
          };

  const commissionLabel =
    `${promoter.commissionPct}% por venta` + (promoter.hasMilestones ? " + metas" : "");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-cart-ink-3">{promoter.code}</span>
          <span
            title={flagCfg.hint}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: flagCfg.tint, color: flagCfg.color }}
          >
            <span className="size-1.5 rounded-full" style={{ background: flagCfg.color }} />
            {flagCfg.label}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 text-[11px] text-cart-ink-4">
          <span>Código de su link para vender este evento</span>
          <span className="text-right">{flagCfg.hint}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-cart-line bg-cart-bg-elev-2 p-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-cart-ink-4">Vendidas</div>
          <div className="mt-1 font-mono text-[18px] font-semibold">{promoter.ticketsSold}</div>
        </div>
        <div className="rounded-xl border border-cart-line bg-cart-bg-elev-2 p-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-cart-ink-4">Validadas</div>
          <div className="mt-1 font-mono text-[18px] font-semibold text-[#22D17F]">
            {promoter.ticketsValidated}
          </div>
        </div>
        <div className="rounded-xl border border-cart-line bg-cart-bg-elev-2 p-3">
          <div className="text-[10px] uppercase tracking-[0.08em] text-cart-ink-4">Recaudado</div>
          <div className="mt-1 font-mono text-[18px] font-semibold">
            {formatMoneyClean(promoter.revenueCents, currency)}
          </div>
        </div>
      </div>

      {/* Asistencia */}
      <div>
        <div className="flex items-center justify-between text-[12px] text-cart-ink-3">
          <span>Asistencia</span>
          <span className="font-semibold text-white">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: flagCfg.color }}
          />
        </div>
      </div>

      {/* Invitados gratis */}
      {promoter.guestsInvited > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-3">
          <div>
            <div className="text-[13px] font-medium">Invitados gratis</div>
            <div className="mt-0.5 text-[11.5px] text-cart-ink-3">Entradas de cortesía por su link</div>
          </div>
          <div className="text-right font-mono text-[13px]">
            {promoter.guestsEntered}
            <span className="text-cart-ink-3"> / {promoter.guestsInvited}</span>
          </div>
        </div>
      )}

      {/* Comisión */}
      <div className="rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium">Comisión</div>
          <div className="text-[12.5px] text-cart-ink-3">{commissionLabel}</div>
        </div>
        <div className="mt-1.5 font-mono text-[20px] font-semibold">
          {formatMoneyClean(promoter.payoutCents, currency)}
        </div>
        {promoter.unlockedRewards.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {promoter.unlockedRewards.map((r) => (
              <span
                key={r.label}
                className="inline-flex items-center gap-1 rounded-full bg-cart-accent-soft px-2.5 py-1 text-[11px] font-medium text-cart-accent"
              >
                🎁 {r.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-2">
        {assignment ? (
          <div className="rounded-xl border border-cart-line">
            <button
              type="button"
              onClick={() => setPersonalizeOpen((v) => !v)}
              aria-expanded={personalizeOpen}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[12.5px] font-medium text-cart-ink-2 transition hover:text-white"
            >
              Personalizar comisión
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                className={
                  "shrink-0 transition-transform duration-200 " +
                  (personalizeOpen ? "rotate-90" : "")
                }
                aria-hidden
              >
                <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <AnimatePresence initial={false}>
              {personalizeOpen && (
                <motion.div
                  key="personalize-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden border-t border-cart-line"
                >
                  <div className="px-3.5 pb-3.5 pt-3">
                    <PersonalizeSheet
                      assignment={assignment}
                      saving={commissionSaving}
                      onSet={onSetCommission}
                      onRemove={onRemoveAssignment}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link
            href={`/org/events/${slug}/team` as never}
            className="block rounded-xl border border-cart-line px-3.5 py-2.5 text-center text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
          >
            Personalizar comisión →
          </Link>
        )}
        {promoter.hasMilestones && (
          <Link
            href={`/org/events/${slug}/promoters/${promoter.promoterLinkId}/tiers` as never}
            className="block rounded-xl border border-cart-line px-3.5 py-2.5 text-center text-[12.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
          >
            Ver hitos →
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Scan row
// ============================================================
export function ScanRow({
  when,
  result,
  ticketTypeKind,
  ticketTypeName,
  boxLabel,
  unitNoun,
}: {
  when: string;
  result: "valid" | "already_used" | "invalid" | "void" | "unknown_event";
  ticketTypeKind?: "general" | "box" | null;
  ticketTypeName?: string | null;
  boxLabel?: string | null;
  unitNoun?: string | null;
}) {
  const meta = {
    valid: { color: "#22D17F", label: "Válido" },
    already_used: { color: "#FFCE3B", label: "Ya usado" },
    invalid: { color: "#FF4D5E", label: "Inválido" },
    void: { color: "#FF4D5E", label: "Anulado" },
    unknown_event: { color: "rgba(255,255,255,0.45)", label: "Otro evento" },
  }[result];
  const typeLabel =
    ticketTypeKind === "box"
      ? boxDisplayLabel({ name: ticketTypeName ?? "Box", boxLabel: boxLabel ?? null, unitNoun: unitNoun ?? null })
      : ticketTypeKind === "general"
        ? "General"
        : null;

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-5">
      <div className="flex items-center gap-2.5">
        <span className="size-1.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}88` }} />
        <span className="text-[13px] font-medium">{meta.label}</span>
        {typeLabel && <span className="text-[11.5px] text-cart-ink-4">· {typeLabel}</span>}
      </div>
      <span className="font-mono text-[11.5px] text-cart-ink-3">
        {new Date(when).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </li>
  );
}

export function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-8 text-center text-[13px] text-cart-ink-3 lg:px-5">{label}</div>;
}

// Banner de honestidad: alerta de doble-ingreso offline y puertas que llevan
// rato sin sincronizar. Solo aparece si hay algo que reportar — silencioso en
// operación normal.
function DoorHealthBanner({
  doors,
  dupOffline,
}: {
  doors: EventStatsPayload["doors"];
  dupOffline: number;
}) {
  // Staleness lo decide el backend (reloj del server) → sin falsos positivos
  // por el reloj del dispositivo.
  const stale = doors
    .filter((d) => d.isStale)
    .map((d) => ({ ...d, mins: d.minutesSinceSync }));

  if (dupOffline === 0 && stale.length === 0) return null;

  const RED = "#FF4D5E";
  const YELLOW = "#FFCE3B";

  return (
    <div className="mb-4 grid gap-2">
      {dupOffline > 0 && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px]"
          style={{ border: `1px solid ${RED}66`, background: `${RED}1a`, color: RED }}
        >
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
            style={{ background: `${RED}33` }}
          >
            !
          </span>
          <span>
            <strong>{dupOffline}</strong>{" "}
            {dupOffline === 1 ? "ingreso duplicado detectado" : "ingresos duplicados detectados"}{" "}
            entre puertas sin sincronizar. Revisa la lista de accesos.
          </span>
        </div>
      )}
      {stale.map((d) => (
        <div
          key={d.deviceId}
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px]"
          style={{ border: `1px solid ${YELLOW}66`, background: `${YELLOW}14`, color: YELLOW }}
        >
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: YELLOW }} />
          <span>
            Puerta {d.zoneName ?? "sin zona"}{" "}
            {d.mins === null
              ? "aún no ha sincronizado"
              : `sin sincronizar hace ${d.mins} min`}
            .
          </span>
        </div>
      ))}
    </div>
  );
}

function formatMoneyClean(cents: number, currency: string = "PEN"): string {
  // Usa el símbolo correcto por moneda (preparado para multi-mercado).
  return Money.format(cents, currency);
}

/* ============================== Partners section ============================== */

const BUCKET = "event-assets";

async function uploadPartnerLogo(file: File, slugHint: string): Promise<string> {
  const db = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `events/${slugHint}/partner-${Date.now()}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function PartnersSection({ slug }: { slug: string }) {
  const partners = useEventPartners(slug);
  const add = useAddEventPartner(slug);
  const remove = useRemoveEventPartner(slug);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = partners.data ?? [];

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setLogoFile(f);
    if (f) setLogoPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setOpen(false);
    setName("");
    setUrl("");
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let logoUrl: string | null = null;
      if (logoFile) logoUrl = await uploadPartnerLogo(logoFile, slug);
      await add.mutateAsync({ name: name.trim(), logoUrl, websiteUrl: url.trim() || null });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-cart-ink-2">Partners</span>
          {list.length > 0 && (
            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-cart-ink-3">
              {list.length}
            </span>
          )}
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-cart-line px-2.5 py-1 text-[11.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
          >
            + Agregar
          </button>
        )}
      </div>

      {/* Lista de partners */}
      {list.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {list.map((p) => (
            <PartnerChip key={p.id} partner={p} onRemove={() => remove.mutate(p.id)} />
          ))}
        </div>
      )}

      {/* Formulario inline */}
      {open && (
        <div className="mt-3 rounded-2xl border border-cart-line bg-cart-bg-elev p-4">
          <div className="flex flex-col gap-3">
            {/* Logo picker */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cart-line bg-cart-bg-elev-2 text-[12.5px] text-cart-ink-3 transition hover:border-cart-line-strong hover:text-white"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="" className="h-10 max-w-[120px] object-contain" />
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Subir logo <span className="text-cart-ink-4">(opcional)</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />

            {/* Nombre */}
            <input
              type="text"
              placeholder="Nombre del partner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-white placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
            />

            {/* URL */}
            <input
              type="url"
              placeholder="URL del sitio (opcional)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[13.5px] text-white placeholder-cart-ink-4 outline-none transition focus:border-cart-accent"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!name.trim() || saving}
                className="flex-1 rounded-full bg-cart-accent py-2 text-[13px] font-semibold text-cart-bg transition hover:brightness-110 disabled:opacity-40"
              >
                {saving ? "Subiendo…" : "Agregar"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-cart-line px-4 py-2 text-[13px] font-medium text-cart-ink-2 transition hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 && !open && (
        <p className="mt-2 text-[12px] text-cart-ink-4">
          Logos de marcas que apoyan el evento — aparecen en la página pública.
        </p>
      )}
    </section>
  );
}

function PartnerChip({ partner, onRemove }: { partner: EventPartner; onRemove: () => void }) {
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-cart-line bg-cart-bg-elev px-2.5 py-1.5 transition hover:border-cart-line-strong">
      {partner.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={partner.logoUrl} alt="" className="h-5 max-w-[60px] object-contain grayscale" />
      )}
      <span className="text-[12.5px] font-medium text-cart-ink-2">{partner.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 grid size-4 place-items-center rounded-full text-cart-ink-4 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
        aria-label={`Quitar ${partner.name}`}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
