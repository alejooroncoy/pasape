"use client";

import { useEffect } from "react";

// Next.js reusa el scroll del layout compartido al navegar entre dos slugs de
// esta misma ruta ([orgSlug] → [orgSlug]) porque el layout no se remonta —
// solo cambia `page.tsx`. Sin esto, entrar a la vitrina de otra marca desde
// una posición scrolleada (ej. desde el link "Organiza X" en un evento) deja
// la página nueva a mitad de camino en vez de arriba.
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return null;
}
