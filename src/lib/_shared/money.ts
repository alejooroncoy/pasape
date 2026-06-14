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

export const Money = {
  /** Céntimos (entero, fuente de verdad) → soles (decimal). */
  toSoles(cents: number): number {
    return cents / 100;
  },

  /** Soles (lo que escribe el usuario) → céntimos (entero, para guardar). */
  toCents(soles: number | string): number {
    return Math.round(Number(soles || "0") * 100);
  },

  /** Céntimos → string formateado para mostrar (p. ej. "S/ 600"). */
  format(cents: number, currency: string = "PEN", locale: string = "es-PE"): string {
    return normalizeSpaces(
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Money.toSoles(cents)),
    );
  },

  /** Céntimos → solo el número formateado, sin símbolo de moneda (p. ej. "600"). */
  formatClean(cents: number, locale: string = "es-PE"): string {
    return Money.format(cents, "PEN", locale).replace(/[^\d,.]/g, "").trim();
  },
} as const;
