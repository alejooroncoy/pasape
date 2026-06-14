// Fuente única de verdad para dinero.
//
// Regla del proyecto: la base de datos, el backend y la API SIEMPRE trabajan en
// céntimos (enteros). La conversión a soles ocurre en UN solo lugar — aquí — y
// nunca a mano con `/100` o `*100` regados por el código (de ahí venían los
// montos 100× descalibrados).
//
// - Mostrar al usuario        → Money.format(cents)
// - Pasar a una API externa   → Money.toSoles(cents)   (decimal, p. ej. Mercado Pago)
// - Leer input del usuario     → Money.toCents(soles)   (al guardar)
//
// Intl mete espacios especiales (narrow/no-break: U+202F, U+00A0) que difieren
// entre el ICU de Node (server) y el del navegador → mismatch de hidratación al
// hacer SSR. Por eso normalizamos a espacio normal.
const normalizeSpaces = (s: string): string =>
  s.replace(/[\u202f\u00a0]/g, " ");

// Locale por moneda: dejamos que Intl localice el s\u00edmbolo y la agrupaci\u00f3n seg\u00fan
// el mercado (PEN\u2192es-PE, USD\u2192en-US, COP\u2192es-CO\u2026). Multi-mercado a futuro: agregar
// una entrada aqu\u00ed basta. Default es-PE.
const LOCALE_BY_CURRENCY: Record<string, string> = {
  PEN: "es-PE",
  USD: "en-US",
  COP: "es-CO",
  CLP: "es-CL",
  MXN: "es-MX",
  ARS: "es-AR",
  EUR: "es-ES",
  BRL: "pt-BR",
};

const localeFor = (currency: string): string => LOCALE_BY_CURRENCY[currency] ?? "es-PE";

export const Money = {
  /** Céntimos (entero, fuente de verdad) → soles (decimal). */
  toSoles(cents: number): number {
    return cents / 100;
  },

  /** Soles (lo que escribe el usuario) → céntimos (entero, para guardar). */
  toCents(soles: number | string): number {
    return Math.round(Number(soles || "0") * 100);
  },

  /**
   * Céntimos → string formateado para mostrar (p. ej. "S/ 600", "$600").
   * El locale se deriva de la moneda (Intl localiza símbolo y agrupación); se
   * puede forzar uno con el 3er parámetro.
   */
  format(cents: number, currency: string = "PEN", locale: string = localeFor(currency)): string {
    return normalizeSpaces(
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Money.toSoles(cents)),
    );
  },

  /** Céntimos → solo el número formateado, sin símbolo de moneda (p. ej. "600"). */
  formatClean(cents: number, currency: string = "PEN"): string {
    return Money.format(cents, currency).replace(/[^\d,.]/g, "").trim();
  },
} as const;
