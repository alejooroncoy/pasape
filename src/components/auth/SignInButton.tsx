"use client";

import { useState, type ReactNode } from "react";
import { SignInDrawer } from "@/app/[locale]/_home/SignInDrawer";

/**
 * Botón de inicio de sesión reutilizable. Centraliza la lógica de "abrir el
 * login" en un solo lugar: muestra el `SignInDrawer` (bottom-sheet en móvil,
 * modal centrado en desktop). Úsalo en cualquier superficie del asistente para
 * no duplicar estado ni el diálogo.
 *
 * - `redirectTo`: a dónde volver tras el login con Google (default: URL actual).
 * - `className` / `children`: estilo y label del trigger (default "Iniciar sesión").
 */
export function SignInButton({
  redirectTo,
  className,
  children,
}: {
  redirectTo?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? "Iniciar sesión"}
      </button>
      <SignInDrawer open={open} onClose={() => setOpen(false)} redirectTo={redirectTo} />
    </>
  );
}
