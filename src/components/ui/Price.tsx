import { formatPrice } from "@/lib/_shared/format";

/**
 * Precio de venta para mostrar. Hace la conversión (céntimos → soles) y la regla
 * de negocio de display adentro: **0 → "Gratis"** (nunca "S/ 0", confunde).
 * Reutilizable en cualquier card/lista de entradas.
 *
 * Para totales/sumas con comisión seguir usando formatMoney (un total de 0 con
 * fee no es "gratis").
 */
export function Price({
  cents,
  currency = "PEN",
  locale = "es-PE",
  className,
}: {
  cents: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  return <span className={className}>{formatPrice(cents, currency, locale)}</span>;
}
