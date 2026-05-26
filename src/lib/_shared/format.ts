export const formatMoney = (
  cents: number,
  currency: string = "PEN",
  locale: string = "es-PE",
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

export const formatDate = (
  date: Date | string,
  timezone: string = "America/Lima",
  locale: string = "es-PE",
): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof date === "string" ? new Date(date) : date);

export const formatPhone = (e164: string): string => {
  if (!e164.startsWith("+")) return e164;
  return e164.replace(/(\+\d{2})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4");
};
