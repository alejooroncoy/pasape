// Fuente única de verdad para las categorías de evento en la UI del home.
// El id es el contrato con el backend (EventCategory). label/Icon/color/gradient
// son metadata de presentación. Cualquier cambio visual se hace UNA vez aquí.
import type { EventCategory } from "@/server/events/domain/Event";
// Set validado contra Joinnus/Teleticket/Eventbrite/DICE (jun 2026):
// "Conciertos" y "Fiestas" son el vocabulario peruano estándar; DJ/electrónica
// y after-office viven dentro de "Fiestas", no como categorías propias.
import { AfterIcon, ComedyIcon, CultureIcon, DjIcon, MusicIcon, SportIcon, TalkIcon } from "./icons";

export type CategoryDef = {
  id: EventCategory;
  /** Nombre mostrado al usuario (es-PE). */
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  /** Acento sólido de la categoría (texto/borde/glow). */
  color: string;
  /** Gradiente de fondo para cards con imagen/ilustración. */
  gradient: string;
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "conciertos",
    label: "Conciertos",
    Icon: MusicIcon,
    color: "#b87cff",
    gradient: "linear-gradient(150deg,#1a0533 0%,#3b0764 55%,#7c3aed 100%)",
  },
  {
    id: "fiestas",
    label: "Fiestas",
    Icon: DjIcon,
    color: "#3ad6ff",
    gradient: "linear-gradient(150deg,#021726 0%,#053047 55%,#0e9bd6 100%)",
  },
  {
    id: "festivales",
    label: "Festivales",
    Icon: AfterIcon,
    color: "#ffb84d",
    gradient: "linear-gradient(150deg,#2a1603 0%,#4a2c07 55%,#d98a18 100%)",
  },
  {
    id: "comedia",
    label: "Comedia",
    Icon: ComedyIcon,
    color: "#ff6fae",
    gradient: "linear-gradient(150deg,#2a0518 0%,#4a0b2e 55%,#d63d86 100%)",
  },
  {
    id: "cultura",
    label: "Teatro & Cultura",
    Icon: CultureIcon,
    color: "#5fe3a1",
    gradient: "linear-gradient(150deg,#03261a 0%,#074730 55%,#18a86b 100%)",
  },
  {
    id: "deportes",
    label: "Deportes",
    Icon: SportIcon,
    color: "#ff7a59",
    gradient: "linear-gradient(150deg,#2a0d03 0%,#4a1c07 55%,#d65a2e 100%)",
  },
  {
    id: "charlas",
    label: "Charlas & Networking",
    Icon: TalkIcon,
    color: "#7ea6ff",
    gradient: "linear-gradient(150deg,#050b26 0%,#0d1b4a 55%,#3d63d6 100%)",
  },
];

/** Lista de ids válidos — útil para validación. */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as EventCategory[];

/** Lookup rápido por id. */
export const CATEGORY_BY_ID: Record<EventCategory, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<EventCategory, CategoryDef>;
