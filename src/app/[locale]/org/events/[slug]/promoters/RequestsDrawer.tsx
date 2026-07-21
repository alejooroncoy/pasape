"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { OrgSheet as Sheet } from "@/components/domain/org/OrgSheet";
import { RequestsSheet } from "../team/page";

// Drawer de Solicitudes compartido por la ruta interceptora (soft-nav) y la
// página completa (hard-nav / deep-link).
//
// CLIENT-ONLY: el Sheet usa `motion` + `matchMedia`, cuyo render difiere entre
// server y cliente. Si se SSR-eara, el árbol hidrataría distinto y React lo
// reporta como mismatch (incluso lejos, en el shell). Por eso montamos el drawer
// sólo tras `mounted` — el HTML del server no lo incluye y coincide con el primer
// render del cliente. El drawer entra deslizando igual (su animación corre al montar).
//
// Cerrar: bajamos `open` para que el Sheet corra su exit dentro del
// AnimatePresence, y sólo en `onExitComplete` ejecutamos `onClosed`
// (router.back / replace) — así el cierre desliza en vez de cortarse de golpe.
export function RequestsDrawer({ slug, onClosed }: { slug: string; onClosed: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <AnimatePresence onExitComplete={onClosed}>
      {open && (
        <Sheet key="requests" title="Solicitudes" onClose={() => setOpen(false)}>
          <RequestsSheet slug={slug} />
        </Sheet>
      )}
    </AnimatePresence>
  );
}
