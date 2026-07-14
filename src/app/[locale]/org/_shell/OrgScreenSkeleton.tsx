import { Skeleton, KpiGridSkeleton } from "@/components/ui/Skeleton";

// Skeleton de contenido para las pantallas del panel del organizador, usado
// por los loading.tsx de cada ruta. Ya NO clona el sidebar: OrgShell vive en
// org/layout.tsx (persistente), así que este skeleton solo ocupa el <main>
// de adentro — el sidebar real nunca se desmonta durante la navegación.
export function OrgScreenSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-2 h-9 w-2/3 max-w-[340px]" />
      <div className="mt-6">
        <KpiGridSkeleton />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-[140px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
