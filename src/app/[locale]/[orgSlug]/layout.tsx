import type { ReactNode } from "react";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";

// Vitrina pública de una productora: es de cara al asistente, así que lleva el
// header de usuario (con menú/cuenta), no el mini público.
export default function OrgVitrineLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UserHeader />
      {children}
    </>
  );
}
