import { describe, it, expect } from "vitest";
import { tarpitDelayMs } from "./botEnforcement";
import { SOFT_THRESHOLD } from "./botScore";

// tarpitDelayMs es puro y determinista (no lee env ni estado). decideEnforcement
// depende de BOT_ENFORCEMENT + estado del circuit breaker, así que se valida en
// integración; aquí fijamos la curva de latencia.

describe("tarpitDelayMs — latencia progresiva", () => {
  it("nunca baja del piso (600ms) aun en el límite inferior de la zona sospechosa", () => {
    expect(tarpitDelayMs(SOFT_THRESHOLD, 0)).toBeGreaterThanOrEqual(600);
  });

  it("nunca supera el techo (8s) — no es vector de auto-DoS", () => {
    expect(tarpitDelayMs(100, 100)).toBeLessThanOrEqual(8_000);
    expect(tarpitDelayMs(999, 999)).toBeLessThanOrEqual(8_000);
  });

  it("crece con el score", () => {
    expect(tarpitDelayMs(90, 0)).toBeGreaterThan(tarpitDelayMs(50, 0));
  });

  it("crece con la reincidencia del device", () => {
    expect(tarpitDelayMs(60, 10)).toBeGreaterThan(tarpitDelayMs(60, 0));
  });

  it("un bot flagrante y reincidente satura cerca del techo", () => {
    expect(tarpitDelayMs(95, 12)).toBeGreaterThanOrEqual(7_000);
  });
});
