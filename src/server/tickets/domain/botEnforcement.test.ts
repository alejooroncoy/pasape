import { describe, it, expect, afterEach } from "vitest";
import { tarpitDelayMs, decideEnforcement } from "./botEnforcement";
import { SOFT_THRESHOLD, HARD_THRESHOLD } from "./botScore";

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

// decideEnforcement lee BOT_ENFORCEMENT del env y alimenta el circuit breaker
// (estado de módulo). Mantenemos < 20 muestras totales para no abrir el breaker.
describe("decideEnforcement — step-up challenge por modo", () => {
  const prev = process.env.BOT_ENFORCEMENT;
  afterEach(() => {
    if (prev === undefined) delete process.env.BOT_ENFORCEMENT;
    else process.env.BOT_ENFORCEMENT = prev;
  });
  const mid = SOFT_THRESHOLD + 5; // zona sospechosa [SOFT, HARD)
  const high = HARD_THRESHOLD + 10; // flagrante

  it("shadow: nunca desafía ni bloquea; solo registra would_*", () => {
    process.env.BOT_ENFORCEMENT = "shadow";
    const lo = decideEnforcement(10);
    expect(lo).toMatchObject({ allowed: true, challengeRequired: false, action: "logged" });
    const susp = decideEnforcement(mid);
    expect(susp).toMatchObject({ allowed: true, challengeRequired: false, action: "would_challenge" });
    const flag = decideEnforcement(high);
    expect(flag).toMatchObject({ allowed: true, challengeRequired: false, action: "would_block" });
  });

  it("soft: [SOFT,HARD) y >=HARD → challenge; nunca bloquea (nunca 429)", () => {
    process.env.BOT_ENFORCEMENT = "soft";
    const susp = decideEnforcement(mid);
    expect(susp).toMatchObject({ allowed: true, challengeRequired: true, action: "challenge" });
    const flag = decideEnforcement(high);
    expect(flag).toMatchObject({ allowed: true, challengeRequired: true, action: "challenge" });
    expect(decideEnforcement(10)).toMatchObject({ allowed: true, challengeRequired: false });
  });

  it("hard: [SOFT,HARD) → challenge; >=HARD → block", () => {
    process.env.BOT_ENFORCEMENT = "hard";
    const susp = decideEnforcement(mid);
    expect(susp).toMatchObject({ allowed: true, challengeRequired: true, action: "challenge" });
    const flag = decideEnforcement(high);
    expect(flag).toMatchObject({ allowed: false, challengeRequired: false, action: "blocked" });
  });

  it("un challenge no lleva tarpit: delayMs es 0 (el PoW es la fricción)", () => {
    process.env.BOT_ENFORCEMENT = "soft";
    expect(decideEnforcement(mid).delayMs).toBe(0);
  });
});
