"use client";

import { use } from "react";
import { useRouter } from "@/i18n/navigation";
import { EventShell } from "../../_shell/EventShell";
import { PromotersSection } from "../../team/page";
import { RequestsDrawer } from "../RequestsDrawer";

type Props = { params: Promise<{ slug: string }> };

// Página de Solicitudes en hard-nav / refresh / deep-link directo. Reproduce el
// MISMO look que la soft-nav interceptada: la lista de promotores de fondo con
// el drawer de Solicitudes abierto encima (no una pantalla suelta). Cerrar el
// drawer navega a /promoters (deja la lista sin overlay).
export default function OrgPendingRequestsPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  return (
    <EventShell slug={slug} active="promoters">
      <div className="mt-6">
        <PromotersSection slug={slug} />
      </div>
      <RequestsDrawer
        slug={slug}
        onClosed={() => router.replace(`/org/events/${slug}/promoters` as never)}
      />
    </EventShell>
  );
}
