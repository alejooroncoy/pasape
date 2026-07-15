import type { ReactNode } from "react";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";

// Vitrina pública de una productora: es de cara al asistente, así que lleva el
// header de usuario (con menú/cuenta), no el mini público. Paleta CLARA (misma
// que home/tickets/perfil): el scope .home-light vive acá, en el layout, para
// que header y contenido queden dentro del mismo árbol y no haya que
// reimportar UserHeader ni repetir las clases en cada page.tsx de esta ruta.
export default function OrgVitrineLayout({ children }: { children: ReactNode }) {
  return (
    <div className="home-light home-wash cart-grain relative min-h-[100dvh] bg-cart-bg text-cart-ink">
      <UserHeader />
      {children}
    </div>
  );
}
