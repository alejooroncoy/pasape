// Intl mete espacios especiales (narrow/no-break: U+202F, U+00A0) que difieren
// entre el ICU de Node (server) y el del navegador → mismatch de hidratación al
// hacer SSR. Normalizamos a espacio normal para que server y cliente coincidan.
const normalizeSpaces = (s: string): string => s.replace(/[\u202f\u00a0]/g, " ");

export const formatMoney = (
  cents: number,
  currency: string = "PEN",
  locale: string = "es-PE",
): string =>
  normalizeSpaces(
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100),
  );

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
