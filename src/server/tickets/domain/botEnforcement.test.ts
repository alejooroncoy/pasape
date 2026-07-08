import { describe, it, expect } from "vitest";
import {
  tarpitDelayMs,
  decideCardEnforcement,
  enforceCardDecision,
  CARD_RING_DNI_THRESHOLD,
  CARD_RING_SOFT_DNI_THRESHOLD,
  CARD_RING_SOFT_DEVICE_MIN,
} from "./botEnforcement";
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

// decideCardEnforcement es PURA (mode + señales → decisión), sin env ni estado.
// El caso más importante es que una FAMILIA legítima (varios DNIs, 1 device)
// NUNCA se bloquee en ningún modo salvo el opt-in agresivo 'hard'.
describe("decideCardEnforcement — anti-multicuenta por tarjeta", () => {
  // Familia: papá paga las entradas de sus 3 hijos con su tarjeta, desde su cel.
  const familiaChica = { distinctDnis: 3, distinctDevices: 1 };
  // Familia/grupo grande: 7 DNIs pero TODOS desde el mismo dispositivo.
  const familiaGrande = { distinctDnis: 7, distinctDevices: 1 };
  // Anillo: 9 DNIs desde 5 dispositivos rotados.
  const anillo = { distinctDnis: 9, distinctDevices: 5 };

  it("shadow: jamás bloquea, ni al anillo — solo marca la intención", () => {
    expect(decideCardEnforcement(anillo, "shadow").block).toBe(false);
    expect(decideCardEnforcement(anillo, "shadow").action).toBe("would_block");
    expect(decideCardEnforcement(familiaChica, "shadow").block).toBe(false);
    expect(decideCardEnforcement(familiaChica, "shadow").action).toBe("logged");
  });

  it("familia chica: nunca se bloquea (bajo el umbral en todos los modos)", () => {
    for (const mode of ["shadow", "soft", "hard"] as const) {
      expect(decideCardEnforcement(familiaChica, mode).block).toBe(false);
    }
  });

  it("soft: NO bloquea a la familia grande (muchos DNIs pero 1 solo device)", () => {
    const d = decideCardEnforcement(familiaGrande, "soft");
    expect(d.block).toBe(false);
  });

  it("soft: SÍ bloquea al anillo (umbral alto + multidispositivo)", () => {
    const d = decideCardEnforcement(anillo, "soft");
    expect(d.block).toBe(true);
    expect(d.reason).toBe("card_ring_multidevice");
  });

  it("soft: no basta el conteo alto sin multidispositivo", () => {
    // Justo en el umbral soft de DNIs pero con pocos devices → no bloquea.
    const d = decideCardEnforcement(
      { distinctDnis: CARD_RING_SOFT_DNI_THRESHOLD, distinctDevices: CARD_RING_SOFT_DEVICE_MIN - 1 },
      "soft",
    );
    expect(d.block).toBe(false);
  });

  it("soft: no basta el multidispositivo sin conteo alto", () => {
    const d = decideCardEnforcement(
      { distinctDnis: CARD_RING_SOFT_DNI_THRESHOLD - 1, distinctDevices: CARD_RING_SOFT_DEVICE_MIN + 2 },
      "soft",
    );
    expect(d.block).toBe(false);
  });

  it("hard: bloquea por conteo de DNIs solo (umbral alto, agresivo/opt-in)", () => {
    const d = decideCardEnforcement(
      { distinctDnis: CARD_RING_DNI_THRESHOLD, distinctDevices: 1 },
      "hard",
    );
    expect(d.block).toBe(true);
    expect(d.reason).toBe("card_many_dni");
  });

  it("hard: bajo el umbral no bloquea aunque haya varios devices", () => {
    const d = decideCardEnforcement(
      { distinctDnis: CARD_RING_DNI_THRESHOLD - 1, distinctDevices: 4 },
      "hard",
    );
    expect(d.block).toBe(false);
  });

  it("el umbral soft de DNIs es más alto que el hard (soft es más conservador)", () => {
    expect(CARD_RING_SOFT_DNI_THRESHOLD).toBeGreaterThan(CARD_RING_DNI_THRESHOLD);
  });
});

describe("enforceCardDecision — circuit breaker fail-open", () => {
  it("deja pasar un bloqueo cuando el breaker está cerrado (arranque)", () => {
    // El breaker in-memory arranca vacío (< CIRCUIT_MIN_SAMPLES) → no abre.
    const blocked = enforceCardDecision({ block: true, action: "blocked", reason: "card_ring_multidevice" });
    expect(blocked.block).toBe(true);
  });

  it("no altera una decisión de no-bloqueo", () => {
    const allowed = enforceCardDecision({ block: false, action: "logged", reason: null });
    expect(allowed.block).toBe(false);
    expect(allowed.action).toBe("logged");
  });
});
