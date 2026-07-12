import type { ReactNode } from "react";

// Layout del detalle de evento con un slot paralelo `@modal` para rutas
// interceptoras. En soft-nav desde el detalle, `@modal/(.)buy` pinta el pago
// como overlay SOBRE el evento (que sigue montado en `children`), con la URL
// enmascarada en /buy?order=. En hard-nav/refresh el slot cae en `default.tsx`
// (null) y se renderiza la ruta completa /buy.
//
// IMPORTANTE: este layout NO exporta metadata → el SEO del evento (title,
// canonical, hreflang, OG/Twitter, JSON-LD y las rutas de imagen del segmento)
// sigue resolviéndose en page.tsx sin cambios.
export default function EventDetailLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
