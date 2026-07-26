import type { EventCard } from "@/server/events/domain/Event";

/** Tope de eventos que rota el banner destacado con catálogo grande. */
export const FEATURED_COUNT = 3;

/**
 * Con catálogo chico el banner y la grilla mostraban el MISMO evento dos veces
 * seguidas — las dos primeras pantallas del home eran el mismo flyer repetido.
 *
 * Reparto (presentación, no regla de negocio): el banner se queda con los
 * primeros y la grilla muestra el resto, sin solaparse nunca. Cuántos destaca
 * depende de cuánto hay:
 *
 * - 1 evento  → sin banner. Un "destacado" arriba de una lista vacía no es una
 *               portada, es el mismo evento dos veces.
 * - 2 o 3     → destaca 1. Se conserva la portada (el flyer ES el producto) y
 *               la grilla mantiene algo que mostrar.
 * - 4 o más   → destaca `FEATURED_COUNT` y rota entre ellos.
 *
 * El orden de entrada lo decide el backend; acá solo se parte.
 */
export function splitFeatured(list: EventCard[]): {
  featured: EventCard[];
  rest: EventCard[];
} {
  const count = list.length <= 1 ? 0 : list.length <= FEATURED_COUNT ? 1 : FEATURED_COUNT;
  return { featured: list.slice(0, count), rest: list.slice(count) };
}
