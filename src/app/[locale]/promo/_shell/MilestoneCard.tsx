import type { MilestoneRewardKind } from "@/server/promoters/domain/OrgPromoter";

/** Icono line-style del premio según su tipo (nada de emojis). */
export function RewardIcon({ kind }: { kind: MilestoneRewardKind }) {
  if (kind === "cash") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2.5" y="6" width="19" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.5 9v6M18.5 9v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="8.5" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 8.5v12" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.5S10.5 4.5 8 4.5a2 2 0 000 4h4zM12 8.5s1.5-4 4-4a2 2 0 010 4h-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Card de un hito: premio, estado y progreso. `unlocked` se deriva al vuelo
 * (progress >= threshold), no se persiste — reversible por diseño.
 */
export function MilestoneCard({
  kind,
  label,
  unlocked,
  progress,
  threshold,
  unitOne = "venta",
  unitMany = "ventas",
  progressVerb = "vendidas",
}: {
  kind: MilestoneRewardKind;
  label: string;
  unlocked: boolean;
  progress: number;
  threshold: number;
  /** Unidad del progreso según el basis de la meta: venta(s) o asistencia(s). */
  unitOne?: string;
  unitMany?: string;
  /** Verbo para el conteo bajo la barra: "vendidas" o "entraron". */
  progressVerb?: string;
}) {
  const pct = threshold > 0 ? Math.min(100, Math.round((progress / threshold) * 100)) : 100;
  const remaining = Math.max(0, threshold - progress);
  return (
    <div
      className={
        "flex flex-col gap-3.5 rounded-2xl border p-5 transition " +
        (unlocked ? "border-cart-accent/50 bg-cart-accent-soft" : "border-cart-line bg-cart-bg-elev")
      }
    >
      <div className="flex items-center gap-3.5">
        <span
          className={
            "grid size-12 flex-shrink-0 place-items-center rounded-xl " +
            (unlocked ? "bg-cart-accent/20 text-cart-accent" : "bg-cart-bg-elev-2 text-cart-ink-2")
          }
        >
          <RewardIcon kind={kind} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-cart-ink">{label}</div>
          <div
            className={
              "mt-0.5 flex items-center gap-1 text-[12.5px] " +
              (unlocked ? "text-cart-accent" : "text-cart-ink-3")
            }
          >
            {unlocked ? (
              <>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.2 3L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Conseguido
              </>
            ) : (
              `Faltan ${remaining} ${remaining === 1 ? unitOne : unitMany}`
            )}
          </div>
        </div>
      </div>
      {!unlocked && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-cart-line-strong">
            <div
              className="h-full rounded-full bg-cart-accent transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-cart-ink-4">
            <span>{progress} {progressVerb}</span>
            <span>Meta {threshold}</span>
          </div>
        </div>
      )}
    </div>
  );
}
