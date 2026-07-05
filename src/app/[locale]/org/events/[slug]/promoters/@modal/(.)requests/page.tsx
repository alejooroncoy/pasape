"use client";

import { use } from "react";
import { useRouter } from "@/i18n/navigation";
import { RequestsDrawer } from "../../RequestsDrawer";

type Props = { params: Promise<{ slug: string }> };

// Ruta interceptora: al hacer soft-nav a /promoters/requests (clic en
// "Solicitudes"), Next la intercepta y pinta el drawer SOBRE la lista (que sigue
// montada en el slot `children`), con la URL enmascarada en /requests. Cerrar =
// router.back() (vuelve a /promoters). El look es idéntico al de hard-nav, donde
// la página completa (requests/page.tsx) reproduce lista + drawer.
export default function InterceptedRequestsPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  return <RequestsDrawer slug={slug} onClosed={() => router.back()} />;
}
