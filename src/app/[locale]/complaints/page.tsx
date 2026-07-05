import type { Metadata } from "next";
import { LibroReclamacionesClient } from "./LibroReclamacionesClient";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones | Pasape",
  description:
    "Registra tu reclamo o queja. Cumplimos con el Código de Protección y Defensa del Consumidor (Ley 29571). Te respondemos en un máximo de 15 días hábiles.",
  robots: { index: true, follow: true },
};

export default function LibroDeReclamacionesPage() {
  return <LibroReclamacionesClient />;
}
