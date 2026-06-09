import { Skeleton, KpiGridSkeleton } from "@/components/ui/Skeleton";

// Skeleton de primera carga para las pantallas del panel del organizador.
// Replica la silueta del OrgShell (sidebar desktop + área de contenido) para que
// la transición no salte cuando entra el contenido real. Lo usan los loading.tsx.
export function OrgScreenSkeleton() {
  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      <div className="relative z-10 mx-auto flex w-full max-w-[1440px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-[240px] flex-shrink-0 flex-col gap-5 border-r border-cart-line px-3 py-5 lg:flex">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="mt-2 flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-7 lg:px-10 lg:py-8">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-9 w-2/3 max-w-[340px]" />
          <div className="mt-6">
            <KpiGridSkeleton />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-[200px] w-full rounded-2xl" />
            <Skeleton className="h-[140px] w-full rounded-2xl" />
          </div>
        </main>
      </div>
    </div>
  );
}
