import type { ReactNode } from "react";

// Layout de la pestaña Promotores con un slot paralelo `@modal` para las rutas
// interceptoras (drawer de Solicitudes). En soft-nav, `@modal/(.)requests`
// pinta el drawer sobre la lista sin cambiar `children`; en hard-nav/refresh el
// slot cae en `default.tsx` (null) y `children` renderiza la página completa.
export default function PromotersLayout({
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
