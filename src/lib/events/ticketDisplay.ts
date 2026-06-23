import type { TicketType, BoxTicketType } from "@/server/events/domain/Event";
import { activePricing } from "./pricing";

/**
 * Sustantivo de la unidad reservable. Default "box" cuando el organizador no
 * eligió uno explícito. Sólo aplica a kind === "box".
 */
export function unitNoun(tt: TicketType): string {
  return (tt.unitNoun?.trim() || "box").toLowerCase();
}

/**
 * Plural castellano simple — sirve para "box → boxes", "mesa → mesas",
 * "lounge → lounges", "espacio → espacios". Para custom sigue regla genérica:
 * termina en vocal → +s, en consonante → +es, en 's' → invariable.
 */
export function unitNounPlural(noun: string): string {
  const n = noun.trim().toLowerCase();
  if (!n) return "boxes";
  if (n.endsWith("s")) return n;
  const last = n[n.length - 1];
  const isVowel = "aeiouáéíóú".includes(last);
  return isVowel ? `${n}s` : `${n}es`;
}

/**
 * Estado de venta de un ticket type — para boxes es binario (alguien lo tomó
 * o no), para entradas convencionales es la cuenta tradicional. Razón: cuando
 * un usuario compra un Box, queda reservado completo y él decide a quién
 * invitar; no se venden plazas sueltas del mismo box a desconocidos.
 */
export type TicketStatus =
  | { kind: "available"; remaining: number }
  | { kind: "soldout" }
  | { kind: "expired" };

export function ticketStatus(tt: TicketType): TicketStatus {
  if (tt.saleStatus === "expired") return { kind: "expired" };
  if (tt.saleStatus === "soldout") return { kind: "soldout" };
  if (tt.kind === "box") return { kind: "available", remaining: 1 };
  const remaining = Math.max(0, tt.stock - tt.sold);
  return { kind: "available", remaining };
}

// ─────────────────────────────────────────────────────────────────────────────
// Semántica box vs entrada — ÚNICA fuente de verdad.
//
// El dominio `TicketType` ya es una unión discriminada (BoxTicketType.seats vs
// AdmissionTicketType.stock), así que el compilador impide confundirlos. Estos
// helpers evitan repetir el `switch (kind)` por las pantallas. Ver AGENTS.md.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Es un espacio reservable (box/mesa/lounge…)? Type guard para estrechar la unión. */
export function isBox(tt: TicketType): tt is BoxTicketType {
  return tt.kind === "box";
}

/** Asientos de un box (personas que entran). 0 si no es box — no tiene asientos. */
export function boxSeats(tt: TicketType): number {
  return tt.kind === "box" ? tt.seats : 0;
}

/** Unidades vendibles totales. Box = 1 (se vende entero). Entrada = su stock. */
export function stockTotal(tt: TicketType): number {
  return tt.kind === "box" ? 1 : tt.stock;
}

/** Unidades tomadas. Box = 1 si alguien lo reservó, si no 0. Entrada = sold. */
export function unitsSold(tt: TicketType): number {
  return tt.kind === "box" ? (tt.sold > 0 ? 1 : 0) : tt.sold;
}

/** Unidades disponibles para vender. Box: 1 o 0. Entrada: stock − vendidas. */
export function unitsRemaining(tt: TicketType): number {
  return Math.max(0, stockTotal(tt) - unitsSold(tt));
}

/**
 * Copy "X de Y vendidas" / "Reservado". Estructural a propósito: el read-model
 * de stats del organizador NO es el dominio `TicketType` — todavía expone la
 * columna cruda `capacity` (asientos en box, stock en entrada). Este helper es
 * el único punto que interpreta ese shape de stats.
 */
export type StatTicketRow = { kind: string; sold: number; capacity: number };
export function soldLine(tt: StatTicketRow): string {
  if (tt.kind === "box") return tt.sold > 0 ? "Reservado" : "Disponible";
  return `${tt.sold} de ${tt.capacity} vendidas`;
}

/**
 * Copy del subtítulo. Para box: cupo + propiedad de grupo, o "Reservado". Para
 * el resto: stock disponible o "Agotado".
 */
export function ticketSubtitle(tt: TicketType): string {
  const status = ticketStatus(tt);
  if (status.kind === "expired") return "Preventa cerrada";
  if (isBox(tt)) {
    return status.kind === "soldout"
      ? "Reservado"
      : `Para ${boxSeats(tt)} personas · Tú invitas`;
  }
  return status.kind === "soldout"
    ? "Agotado"
    : `${status.remaining} disponibles`;
}

/** Capitaliza la primera letra (ej. "box" → "Box"). */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// `label` = etiqueta de agrupación de la card (ya NO es "zona" de venue —
// concepto eliminado). Para boxes es el unit_noun en plural ("Boxes", "Mesas");
// para entradas normales es null (cada tipo es su propia card).
export type TicketGroup = { label: string | null; items: TicketType[] };

// Agrupa SOLO boxes por su unit_noun (espacios del mismo tipo en una grilla).
// Las entradas normales no se agrupan: cada tipo es su card (su nombre ya las
// diferencia — VIP, General). Reemplaza la vieja agrupación por zona.
export function groupBoxesByNoun(boxes: TicketType[]): TicketGroup[] {
  const map = new Map<string, TicketGroup>();
  for (const tt of boxes) {
    const noun = unitNoun(tt);
    let group = map.get(noun);
    if (!group) {
      group = { label: capitalize(unitNounPlural(noun)), items: [] };
      map.set(noun, group);
    }
    group.items.push(tt);
  }
  return [...map.values()];
}

export type GroupSummary = {
  totalBoxes: number;
  freeBoxes: number;
  totalSeats: number;
  freeSeats: number;
  isAllBoxes: boolean;
  isAllSoldOut: boolean;
  minPriceCents: number | null;
  currency: string;
  /** Noun más común entre los boxes de la zona (default "box"). */
  noun: string;
};

export function summarizeGroup(group: TicketGroup): GroupSummary {
  let totalBoxes = 0;
  let freeBoxes = 0;
  let totalSeats = 0;
  let freeSeats = 0;
  let nonBoxCount = 0;
  let minPriceCents: number | null = null;
  let currency = "PEN";
  let anyAvailable = false;
  const nounCounts = new Map<string, number>();
  for (const tt of group.items) {
    currency = tt.currency;
    if (tt.kind === "box") {
      totalBoxes += 1;
      if (tt.sold === 0) freeBoxes += 1;
      const n = unitNoun(tt);
      nounCounts.set(n, (nounCounts.get(n) ?? 0) + 1);
    } else {
      nonBoxCount += 1;
      totalSeats += tt.stock;
      freeSeats += Math.max(0, tt.stock - tt.sold);
    }
    const status = ticketStatus(tt);
    if (status.kind === "available") {
      anyAvailable = true;
      // Precio activo (preventa vigente o normal) para el "desde S/…".
      const price = activePricing(tt).priceCents;
      minPriceCents = minPriceCents == null ? price : Math.min(minPriceCents, price);
    }
  }
  // Noun más frecuente; si nadie es box, default "box".
  let dominantNoun = "box";
  let maxCount = 0;
  for (const [n, c] of nounCounts) {
    if (c > maxCount) {
      dominantNoun = n;
      maxCount = c;
    }
  }
  return {
    totalBoxes,
    freeBoxes,
    totalSeats,
    freeSeats,
    isAllBoxes: nonBoxCount === 0 && totalBoxes > 0,
    isAllSoldOut: !anyAvailable,
    minPriceCents,
    currency,
    noun: dominantNoun,
  };
}

/**
 * Conteo global para el header del evento. Cuenta boxes como 1 unidad (no como
 * capacity) para evitar inflar el número con plazas que en realidad están bajo
 * propiedad de un grupo.
 */
export function eventAvailability(items: TicketType[]): {
  freeBoxes: number;
  freeSeats: number;
  total: number;
} {
  let freeBoxes = 0;
  let freeSeats = 0;
  for (const tt of items) {
    if (tt.kind === "box") {
      if (tt.sold === 0) freeBoxes += 1;
    } else {
      freeSeats += Math.max(0, tt.stock - tt.sold);
    }
  }
  return { freeBoxes, freeSeats, total: freeBoxes + freeSeats };
}
