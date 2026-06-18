import { Money } from "@/lib/_shared/money";

// Intl mete espacios especiales (narrow/no-break: U+202F, U+00A0) que difieren
// entre el ICU de Node (server) y el del navegador → mismatch de hidratación al
// hacer SSR. Normalizamos a espacio normal para que server y cliente coincidan.
const normalizeSpaces = (s: string): string => s.replace(/[\u202f\u00a0]/g, " ");

// Dinero: delega en Money (fuente única de conversión céntimos↔soles).
// Mantenido para los imports existentes; en código nuevo usa Money.format.
export const formatMoney = (
  cents: number,
  currency: string = "PEN",
  locale: string = "es-PE",
): string => Money.format(cents, currency, locale);

// Precio de una entrada para mostrar: 0 → "Gratis" (nunca "S/ 0", confunde).
// Usar en cards/listas de entradas; para totales/sumas seguir con formatMoney.
export const formatPrice = (
  cents: number,
  currency: string = "PEN",
  locale: string = "es-PE",
): string => (cents <= 0 ? "Gratis" : Money.format(cents, currency, locale));

export const formatDate = (
  date: Date | string,
  timezone: string = "America/Lima",
  locale: string = "es-PE",
): string =>
  normalizeSpaces(
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(typeof date === "string" ? new Date(date) : date),
  );

export const formatPhone = (e164: string): string => {
  if (!e164.startsWith("+")) return e164;
  return e164.replace(/(\+\d{2})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4");
};
