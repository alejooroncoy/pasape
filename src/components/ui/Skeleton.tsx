import type { CSSProperties } from "react";

// Bloque de carga reutilizable (shimmer). Reemplaza los skeletons inline que se
// reimplementaban por página. Usa los tokens Pasape (bg-cart-bg-elev) + pulse.
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={"animate-pulse rounded-lg bg-cart-bg-elev " + className}
      style={style}
    />
  );
}

// Grilla de KPIs (4 tarjetas) — reutilizable por el panel/reportes mientras
// cargan las stats.
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[112px] rounded-2xl sm:h-[124px]" />
      ))}
    </div>
  );
}
