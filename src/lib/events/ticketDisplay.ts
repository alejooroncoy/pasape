import type { TicketType } from "@/server/events/domain/Event";
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
  const remaining = Math.max(0, tt.capacity - tt.sold);
  return { kind: "available", remaining };
}

/**
 * Copy del subtítulo. Para box: cupo + propiedad de grupo, o "Reservado". Para
 * el resto: stock disponible o "Agotado".
 */
export function ticketSubtitle(tt: TicketType): string {
  const status = ticketStatus(tt);
  if (status.kind === "expired") return "Preventa cerrada";
  if (tt.kind === "box") {
    return status.kind === "soldout"
      ? "Reservado"
      : `Para ${tt.capacity} personas · Tú invitas`;
  }
  return status.kind === "soldout"
    ? "Agotado"
    : `${status.remaining} disponibles`;
}

/** Capitaliza la primera letra (ej. "box" → "Box"). */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

export type TicketGroup = { zone: string | null; items: TicketType[] };

export function groupTicketTypesByZone(items: TicketType[]): TicketGroup[] {
  const map = new Map<string, TicketGroup>();
  for (const tt of items) {
    const key = tt.zone ?? "__ungrouped__";
    let group = map.get(key);
    if (!group) {
      group = { zone: tt.zone, items: [] };
      map.set(key, group);
    }
    group.items.push(tt);
  }
  const ordered: TicketGroup[] = [];
  for (const [key, group] of map) {
    if (key !== "__ungrouped__") ordered.push(group);
  }
  const ungrouped = map.get("__ungrouped__");
  if (ungrouped) ordered.push(ungrouped);
  return ordered;
}

export type ZoneSummary = {
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

export function summarizeZone(group: TicketGroup): ZoneSummary {
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
      totalSeats += tt.capacity;
      freeSeats += Math.max(0, tt.capacity - tt.sold);
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
      freeSeats += Math.max(0, tt.capacity - tt.sold);
    }
  }
  return { freeBoxes, freeSeats, total: freeBoxes + freeSeats };
}
