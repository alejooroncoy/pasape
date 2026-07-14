import { Money } from "@/lib/_shared/money";

// Nombres en español: fijos nosotros, nunca los generamos con Intl. El texto
// que da Intl (día/mes, y si el reloj es de 12h por defecto) varía entre
// versiones de ICU — no solo el espacio angosto de "p. m.", sino la
// abreviatura del mes o si usa 12h/24h. Esa variación entre el ICU de Node
// (server) y el del navegador del usuario es lo que rompió la hidratación en
// producción (React error #418) en visitas reales.
const WEEKDAYS_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
const WEEKDAYS_ES_LONG = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
] as const;
const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
] as const;
const MONTHS_ES_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;
const EN_WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
const EN_MONTH_TO_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// Partes de la fecha en la zona indicada, extraídas en inglés (abreviaturas
// "Sun"/"Jan" y AM/PM llevan décadas estables entre motores ICU, a diferencia
// de sus equivalentes en español o del reloj 12h/24h por defecto). Server y
// cliente parten siempre del mismo inglés fijo; el español lo armamos nosotros.
function dateParts(iso: string, tz: string, hour12: boolean) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).formatToParts(new Date(iso));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayIdx = EN_WEEKDAY_TO_INDEX[get("weekday")] ?? 0;
  const monthIdx = EN_MONTH_TO_INDEX[get("month")] ?? 0;
  const hour = get("hour").padStart(2, "0");

  return {
    weekday: WEEKDAYS_ES[weekdayIdx],
    weekdayLong: WEEKDAYS_ES_LONG[weekdayIdx],
    month: MONTHS_ES[monthIdx],
    monthLong: MONTHS_ES_LONG[monthIdx],
    day: get("day"),
    hour,
    minute: get("minute"),
    ampm: get("dayPeriod") === "AM" ? "a. m." : "p. m.",
  };
}

// Formato único y canónico para texto de fecha en línea (hero, detalle de
// evento, resumen de checkout, tickets, org, promo, favoritos…):
// "Sábado, 11 de julio, 10:00 P. M."
export const eventDateTime = (iso: string, tz: string = "America/Lima"): string => {
  const p = dateParts(iso, tz, true);
  const weekday = p.weekdayLong.charAt(0).toUpperCase() + p.weekdayLong.slice(1);
  return `${weekday}, ${p.day} de ${p.monthLong}, ${p.hour}:${p.minute} ${p.ampm.toUpperCase()}`;
};

// "sáb, 18 jul" — solo para badges/pills compactos donde el texto completo no
// entra (cards de evento, eyebrows sobre thumbnails). No usar para texto en
// línea: ahí va siempre eventDateTime.
export const shortEventDate = (iso: string, tz: string): string => {
  const p = dateParts(iso, tz, true);
  return `${p.weekday}, ${p.day} ${p.month}`;
};

// "sáb, 18 jul, 10:00 p. m." — como shortEventDate pero con hora; mismo uso
// exclusivo en badges/pills compactos.
export const shortEventDateTime = (iso: string, tz: string): string => {
  const p = dateParts(iso, tz, true);
  return `${p.weekday}, ${p.day} ${p.month}, ${p.hour}:${p.minute} ${p.ampm}`;
};

// Partes sueltas para el pill de fecha del detalle de evento: día, mes en
// mayúsculas, día de semana y hora en 24h — todo sin puntos.
export const eventDatePillParts = (
  iso: string,
  tz: string,
): { day: string; month: string; weekday: string; time: string } => {
  // 12h para casar con el resto del app (eventDateTime también es 12h): "10:00 PM".
  const p = dateParts(iso, tz, true);
  return {
    day: p.day.padStart(2, "0"),
    month: p.month.toUpperCase(),
    weekday: p.weekday,
    time: `${p.hour}:${p.minute} ${p.ampm.replace(/[\s.]/g, "").toUpperCase()}`,
  };
};

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

// Alias histórico de eventDateTime — mantenido para no tocar cada call site.
// Mismo formato único en toda la app: "Sábado, 11 de julio, 10:00 P. M."
export const formatDate = (
  date: Date | string,
  timezone: string = "America/Lima",
): string => eventDateTime(typeof date === "string" ? date : date.toISOString(), timezone);

export const formatPhone = (e164: string): string => {
  if (!e164.startsWith("+")) return e164;
  return e164.replace(/(\+\d{2})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4");
};
