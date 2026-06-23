import type { ReactNode } from "react";

// Sin header global: el detalle del evento monta su propio UserHeader (header de
// usuario), y las páginas de flujo (buy/done/processing/sold-out/pay-error) traen
// su propio top bar. Así se evita el doble header.
export default function EventsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
