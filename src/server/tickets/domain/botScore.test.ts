import { describe, it, expect } from "vitest";
import {
  botScore,
  SOFT_THRESHOLD,
  HARD_THRESHOLD,
  type BotSignalInput,
} from "./botScore";

// Base = intento perfectamente humano. Cada test parte de aquí y cambia solo lo
// que quiere probar, para que quede claro qué señal mueve el score.
const human = (over: Partial<BotSignalInput> = {}): BotSignalInput => ({
  phase: "buy",
  checkoutTokenOk: true,
  msSinceMount: 9_000, // tardó 9 s en el checkout (humano)
  tokenReplay: false,
  buyWithoutQuote: false,
  automationHints: [],
  serverHints: [],
  qty: 2,
  stockRemaining: 200,
  deviceAttemptsShort: 1,
  deviceContactsDay: 1,
  deviceDnisDay: 1,
  dniDevicesDay: 1,
  ipAttemptsShort: 1,
  contactAttemptsShort: 1,
  ipFailedPaymentsHour: 0,
  deviceFailedPaymentsHour: 0,
  ...over,
});

describe("botScore — humanos NO se bloquean (protección contra falsos positivos)", () => {
  it("humano típico: score ~0, muy por debajo de SOFT", () => {
    const { score } = botScore(human());
    expect(score).toBeLessThan(SOFT_THRESHOLD);
    expect(score).toBe(0);
  });

  it("humano comprando para su grupo (6 entradas, 1 contacto): no se bloquea", () => {
    const { score } = botScore(human({ qty: 6, stockRemaining: 200 }));
    expect(score).toBeLessThan(SOFT_THRESHOLD);
  });

  it("humano rápido pero razonable (3 s): no cruza SOFT", () => {
    const { score } = botScore(human({ msSinceMount: 3_000 }));
    expect(score).toBeLessThan(SOFT_THRESHOLD);
  });

  it("humano con red mala (falló el fetch del token) SOLO: nunca llega a HARD", () => {
    // Caso crítico: no debemos bloquear a un humano por un token perdido.
    const { score } = botScore(human({ checkoutTokenOk: false, msSinceMount: null }));
    expect(score).toBeLessThan(HARD_THRESHOLD);
  });

  it("muchos humanos tras el mismo WiFi/NAT (IP compartida): no se bloquea", () => {
    // Universidad/oficina: ráfaga por IP pero cada quien su device y contacto.
    const { score } = botScore(human({ ipAttemptsShort: 10 }));
    expect(score).toBeLessThan(SOFT_THRESHOLD);
  });

  it("humano reintentando pago 1 vez (tarjeta sin fondos): no se bloquea", () => {
    const { score } = botScore(human({ deviceFailedPaymentsHour: 1, ipFailedPaymentsHour: 1 }));
    expect(score).toBeLessThan(SOFT_THRESHOLD);
  });
});

describe("botScore — bots de scalping SÍ escalan (prioridad #1)", () => {
  it("bot headless: sin token + velocidad sobrehumana + ráfaga → HARD", () => {
    const { score, reasons } = botScore(
      human({
        checkoutTokenOk: false,
        msSinceMount: null,
        deviceAttemptsShort: 12,
      }),
    );
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
    expect(reasons).toContain("no_checkout_token");
    expect(reasons).toContain("device_burst");
  });

  it("granja de identidades: 1 device, muchos contactos distintos en el día → al menos SOFT", () => {
    const { score, reasons } = botScore(human({ deviceContactsDay: 7 }));
    expect(score).toBeGreaterThanOrEqual(SOFT_THRESHOLD);
    expect(reasons).toContain("device_many_identities");
  });

  it("bot con token robado pero corriendo a 200 ms y vaciando stock → HARD", () => {
    const { score } = botScore(
      human({
        msSinceMount: 200,
        deviceContactsDay: 6,
        qty: 10,
        stockRemaining: 12,
      }),
    );
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });
});

describe("botScore — automatización de navegador (agente que maneja Chrome)", () => {
  it("navigator.webdriver + velocidad rápida → HARD (no puede ni reservar)", () => {
    const { score, reasons } = botScore(
      human({ automationHints: ["webdriver"], msSinceMount: 600 }),
    );
    expect(reasons).toContain("webdriver");
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });

  it("HeadlessChrome UA + renderer por software → HARD aunque vaya 'lento'", () => {
    const { score } = botScore(
      human({ automationHints: ["headless_ua", "software_renderer"], msSinceMount: 5_000 }),
    );
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });

  it("una sola señal débil (no_plugins) NO basta para molestar a un humano", () => {
    const { score } = botScore(human({ automationHints: ["no_plugins"] }));
    expect(score).toBeLessThan(SOFT_THRESHOLD);
  });

  it("las contribuciones de automatización tienen tope (no explota el score)", () => {
    const { score } = botScore(
      human({
        automationHints: [
          "webdriver",
          "headless_ua",
          "software_renderer",
          "no_chrome_object",
          "no_plugins",
          "no_languages",
        ],
        checkoutTokenOk: true,
        msSinceMount: 9_000,
      }),
    );
    // 6 señales sumarían >170 sin tope; el cap de 60 lo mantiene acotado.
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });
});

describe("botScore — agujeros que cerramos tras el red-team", () => {
  it("token reusado (single-use quemado) + velocidad → HARD", () => {
    const { score, reasons } = botScore(human({ tokenReplay: true, msSinceMount: 600 }));
    expect(reasons).toContain("token_replay");
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });

  it("compra sin cotizar antes (flujo saltado) suma pero no molesta sola a un humano lento", () => {
    const soloFlow = botScore(human({ buyWithoutQuote: true }));
    expect(soloFlow.reasons).toContain("buy_without_quote");
    expect(soloFlow.score).toBeLessThan(SOFT_THRESHOLD); // sola no bloquea
  });

  it("cliente HTTP directo fingiendo Chrome (sin sec-ch-ua) + sin quote + rápido → escala", () => {
    const { score, reasons } = botScore(
      human({
        serverHints: ["chromium_no_client_hints", "no_accept_language"],
        buyWithoutQuote: true,
        msSinceMount: 500,
      }),
    );
    expect(reasons).toContain("chromium_no_client_hints");
    expect(score).toBeGreaterThanOrEqual(SOFT_THRESHOLD);
  });
});

describe("botScore — multicuenta (N DNIs desde un device / DNI farmeado)", () => {
  it("un padre comprando para su familia (3 DNIs desde su device) NO se bloquea", () => {
    const { score } = botScore(human({ deviceDnisDay: 3 }));
    expect(score).toBeLessThan(SOFT_THRESHOLD);
  });

  it("device operando 8 DNIs distintos (multicuenta) → al menos SOFT", () => {
    const { score, reasons } = botScore(human({ deviceDnisDay: 8 }));
    expect(reasons).toContain("device_many_dni");
    expect(score).toBeGreaterThanOrEqual(SOFT_THRESHOLD);
  });

  it("multicuenta con rotación de device: mismo DNI desde 6 devices marca (conservador: no bloquea solo)", () => {
    const solo = botScore(human({ dniDevicesDay: 6 }));
    expect(solo.reasons).toContain("dni_many_devices");
    expect(solo.score).toBeGreaterThan(25); // suma, pero necesita corroboración
    // Con un corroborador (velocidad) cruza SOFT.
    const withSpeed = botScore(human({ dniDevicesDay: 6, msSinceMount: 600 }));
    expect(withSpeed.score).toBeGreaterThanOrEqual(SOFT_THRESHOLD);
  });

  it("multicuenta rápida (8 DNIs + velocidad) → HARD", () => {
    const { score } = botScore(human({ deviceDnisDay: 8, msSinceMount: 600 }));
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });
});

describe("botScore — carding escala (prioridad #2)", () => {
  it("carder típico: sin token + ráfaga de pagos rechazados desde el device → HARD", () => {
    const { score, reasons } = botScore(
      human({
        phase: "webhook_failed",
        checkoutTokenOk: false,
        msSinceMount: null,
        deviceFailedPaymentsHour: 6,
      }),
    );
    expect(reasons).toContain("device_failed_payments");
    expect(score).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });
});

describe("botScore — la nube humana y la nube bot no se solapan", () => {
  it("todo perfil humano < SOFT <= todo perfil bot fuerte", () => {
    const humans = [
      human(),
      human({ qty: 6 }),
      human({ msSinceMount: 2_500 }),
      human({ ipAttemptsShort: 11 }),
      human({ deviceFailedPaymentsHour: 1 }),
      human({ checkoutTokenOk: false, msSinceMount: null }), // token perdido solo
    ].map((h) => botScore(h).score);

    const bots = [
      human({ checkoutTokenOk: false, msSinceMount: null, deviceAttemptsShort: 12 }),
      human({ msSinceMount: 200, deviceContactsDay: 6, qty: 10, stockRemaining: 12 }),
      human({ phase: "webhook_failed", checkoutTokenOk: false, msSinceMount: null, deviceFailedPaymentsHour: 6 }),
    ].map((b) => botScore(b).score);

    expect(Math.max(...humans)).toBeLessThan(SOFT_THRESHOLD);
    expect(Math.min(...bots)).toBeGreaterThanOrEqual(HARD_THRESHOLD);
  });
});
