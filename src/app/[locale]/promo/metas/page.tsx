"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PromoterShell } from "../_shell/PromoterShell";
import { MilestoneCard } from "../_shell/MilestoneCard";
import { useMyPromoterLinks, usePromoterHome } from "@/lib/promoters/hooks/usePromoter";

export default function PromoGoalsPage() {
  const search = useSearchParams();
  const links = useMyPromoterLinks();
  const items = useMemo(() => links.data ?? [], [links.data]);
  // Evento preseleccionado por ?event= (ej. al venir desde Ganancias).
  const [activeSlug, setActiveSlug] = useState<string | null>(search.get("event"));

  // Próximos primero, pasados después (mismo criterio que el Inicio).
  const ordered = useMemo(() => {
    const up = items.filter((l) => l.eventStatus !== "closed");
    const pa = items.filter((l) => l.eventStatus === "closed");
    up.sort((a, b) => new Date(a.eventStartsAt).getTime() - new Date(b.eventStartsAt).getTime());
    pa.sort((a, b) => new Date(b.eventStartsAt).getTime() - new Date(a.eventStartsAt).getTime());
    return [...up, ...pa];
  }, [items]);

  useEffect(() => {
    if (!activeSlug && ordered.length > 0) setActiveSlug(ordered[0].eventSlug);
  }, [activeSlug, ordered]);

  const currentSlug = activeSlug ?? ordered[0]?.eventSlug ?? "";
  const home = usePromoterHome(currentSlug);

  // El organizador elige la BASE de las metas: ventas (sold) o asistencia
  // (attended = su gente validada en puerta). El progreso se cuenta con la unidad
  // correcta, y el copy lo dice explícito para no confundir al promotor.
  const cfg = home.data?.commissionConfig ?? null;
  const basis = cfg?.basis ?? "sold";
  const byAttendance = basis === "attended";
  const progress = byAttendance ? (home.data?.attendedCount ?? 0) : (home.data?.soldCount ?? 0);
  const unit = byAttendance
    ? { one: "asistencia", many: "asistencias", progressVerb: "entraron" }
    : { one: "venta", many: "ventas", progressVerb: "vendidas" };
  // Hitos del esquema efectivo (herencia link→evento→marca). El desbloqueo se
  // deriva al vuelo: progreso >= umbral. Ordenados por umbral.
  const milestones = useMemo(() => {
    const list = cfg && "milestones" in cfg ? cfg.milestones : [];
    return [...list].sort((a, b) => a.threshold - b.threshold);
  }, [cfg]);
  const unlockedCount = milestones.filter((m) => progress >= m.threshold).length;

  if (links.isLoading) {
    return (
      <PromoterShell active="goals">
        <div className="h-40 animate-pulse rounded-2xl bg-cart-bg-elev" />
      </PromoterShell>
    );
  }

  if (items.length === 0) {
    return (
      <PromoterShell active="goals">
        <div className="grid min-h-[50vh] place-items-center text-center">
          <div>
            <h1 className="text-[22px] font-semibold">Aún no tienes metas</h1>
            <p className="mt-1 text-[13.5px] text-cart-ink-3">
              Cuando un organizador te active para un evento, tus hitos aparecen aquí.
            </p>
          </div>
        </div>
      </PromoterShell>
    );
  }

  return (
    <PromoterShell active="goals">
      {/* Cabecera compacta estilo dashboard (una línea, no hero de móvil) */}
      <header className="mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-sans text-[24px] font-semibold leading-tight tracking-[-0.025em] lg:text-[30px]">
            Tus metas
          </h1>
          <p className="mt-1 text-[13.5px] text-cart-ink-3 lg:text-[14px]">
            {byAttendance ? (
              <>
                Ya entraron{" "}
                <strong className="text-cart-ink">
                  {progress} {progress === 1 ? "persona" : "personas"} de las tuyas
                </strong>{" "}
                <span className="text-cart-ink-4">(cuentan las que asisten, no las ventas)</span>
              </>
            ) : (
              <>
                Vendiste{" "}
                <strong className="text-cart-ink">
                  {progress} {progress === 1 ? "entrada" : "entradas"}
                </strong>
              </>
            )}
            {milestones.length > 0 && (
              <> · {unlockedCount} de {milestones.length} hitos conseguidos</>
            )}
          </p>
        </div>
        {milestones.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-1.5">
            <span className="grid size-6 place-items-center rounded-full bg-cart-accent/15 text-cart-accent">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <path d="M6 3h8v2.5a4 4 0 01-8 0V3zM10 9.5V13m-2.5 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-cart-ink">
              {unlockedCount}/{milestones.length}
            </span>
            <span className="text-[12px] text-cart-ink-3">conseguidos</span>
          </div>
        )}
      </header>

      {/* Selector de evento (cambia entre tus eventos) */}
      {ordered.length > 1 && (
        <div className="mb-7 flex flex-wrap gap-2">
          {ordered.map((l) => {
            const on = l.eventSlug === currentSlug;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setActiveSlug(l.eventSlug)}
                className={
                  "rounded-xl border px-3.5 py-2 text-left transition " +
                  (on
                    ? "border-cart-accent/50 bg-cart-accent-soft text-cart-ink"
                    : "border-cart-line bg-cart-bg-elev text-cart-ink-2 hover:border-cart-line-strong")
                }
              >
                <span className="block text-[13px] font-semibold leading-tight">{l.eventTitle}</span>
                <span className="mt-0.5 block text-[11px] text-cart-ink-4">
                  {new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" })
                    .format(new Date(l.eventStartsAt))
                    .replace(/\./g, "")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hitos del evento seleccionado */}
      {home.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-cart-bg-elev" />
          ))}
        </div>
      ) : milestones.length === 0 ? (
        <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-5 py-10 text-center">
          {home.data?.schemeConfigured === false ? (
            <>
              <p className="text-[14px] font-medium text-cart-ink">
                El organizador aún está configurando este evento
              </p>
              <p className="mt-1 text-[12.5px] text-cart-ink-3">
                Todavía no definió tus metas. Apenas las arme, aparecen acá.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-medium text-cart-ink">Este evento no tiene metas</p>
              <p className="mt-1 text-[12.5px] text-cart-ink-3">
                El organizador puede configurar bonos y premios por cantidad de entradas vendidas o
                de asistentes que entran.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {milestones.map((m, i) => (
            <MilestoneCard
              key={i}
              kind={m.rewardKind}
              label={m.rewardKind === "cash" ? `S/ ${((m.amountCents ?? 0) / 100).toLocaleString("es-PE")}` : m.label}
              unlocked={progress >= m.threshold}
              progress={progress}
              threshold={m.threshold}
              unitOne={unit.one}
              unitMany={unit.many}
              progressVerb={unit.progressVerb}
            />
          ))}
        </div>
      )}
    </PromoterShell>
  );
}
