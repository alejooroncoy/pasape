import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

// Prueba de la resolución del CONFLICTO DEL TOKEN SINGLE-USE en el step-up:
// cuando el buy responde challenge_required, el checkout-token NO se quema; solo
// se quema cuando la compra procede. Por eso el reintento con la solución NO se
// cuenta como replay. Aquí lo verificamos con el score/enforcement REALES y la
// infraestructura (Redis/repo/telemetría) mockeada.

vi.mock("../infrastructure/PurchaseSignalsRepo", () => ({
  purchaseSignalsRepo: {
    aggregates: vi.fn(async () => ({
      deviceAttemptsShort: 0,
      deviceContactsDay: 0,
      deviceDnisDay: 0,
      dniDevicesDay: 0,
      deviceIpsHour: 0,
      deviceQuotesShort: 0, // buy sin quote previo → buyWithoutQuote
      ipAttemptsShort: 0,
      contactAttemptsShort: 0,
      ipFailedPaymentsHour: 0,
      deviceFailedPaymentsHour: 0,
    })),
    record: vi.fn(async () => "sig-1"),
    attachOrder: vi.fn(async () => {}),
  },
}));

vi.mock("../infrastructure/checkoutNonce", () => ({
  // Peek NO destructivo: el token nunca aparece como replay en este flujo.
  peekCheckoutToken: vi.fn(async () => "fresh"),
  consumeCheckoutToken: vi.fn(async () => "fresh"),
  consumeChallenge: vi.fn(async () => "fresh"),
}));

vi.mock("../domain/CheckoutToken", () => ({
  // Token válido, montado hace 5 s (sin penalización de velocidad).
  verifyCheckoutToken: vi.fn(() => ({ ok: true, ageMs: 5000 })),
}));

vi.mock("@/lib/analytics/serverEvents", () => ({
  serverEvents: { botSignal: vi.fn() },
}));

import { assessCheckout } from "./CheckoutGuard";
import { consumeCheckoutToken, consumeChallenge } from "../infrastructure/checkoutNonce";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE = "devhash123";

const solve = (salt: string, target: string, maxnumber: number): number => {
  for (let i = 0; i <= maxnumber; i++) {
    if (createHash("sha256").update(salt + i).digest("hex") === target) return i;
  }
  throw new Error("unsolvable challenge");
};

const makeReq = (extra: Record<string, string> = {}): NextRequest =>
  new NextRequest("http://localhost/api/tickets/buy", {
    method: "POST",
    headers: {
      "x-device-hash": DEVICE,
      "x-checkout-token": "tok-1",
      "x-cx-signals": "webdriver", // 45 pts → zona sospechosa junto a buy_without_quote (22) = 67
      "user-agent": "curl/8.0", // no-Chromium: sin server hints extra
      "accept-language": "es-PE",
      ...extra,
    },
  });

const baseInput = {
  phase: "buy" as const,
  eventId: EVENT_ID,
  ticketTypeIds: ["t1"],
  qty: 2,
  stockRemaining: null,
  contact: "a@b.com",
  dni: "12345678",
};

beforeAll(() => {
  process.env.TICKET_LINK_SECRET = "test-secret-stepup";
  process.env.BOT_ENFORCEMENT = "soft";
});
beforeEach(() => {
  vi.clearAllMocks();
});

describe("CheckoutGuard step-up — no-replay en el reintento", () => {
  it("un intento sospechoso pide challenge SIN quemar el token", async () => {
    const res = await assessCheckout({ req: makeReq(), ...baseInput });

    expect(res.score).toBeGreaterThanOrEqual(45);
    expect(res.score).toBeLessThan(70);
    expect(res.allowed).toBe(true); // soft nunca bloquea (nunca 429)
    expect(res.challengeRequired).toBe(true);
    expect(res.challenge).not.toBeNull();
    expect(res.challenge!.eventId).toBe(EVENT_ID);
    // CLAVE: al responder challenge_required NO se quema el checkout-token.
    expect(consumeCheckoutToken).not.toHaveBeenCalled();
  });

  it("el reintento con la solución procede y NO cuenta como token_replay", async () => {
    // 1) Primer intento → obtiene el challenge.
    const first = await assessCheckout({ req: makeReq(), ...baseInput });
    expect(first.challengeRequired).toBe(true);
    const chal = first.challenge!;

    // 2) El cliente resuelve el PoW y reintenta con el MISMO token + la solución.
    const number = solve(chal.salt, chal.target, chal.maxnumber);
    const stepup = JSON.stringify({ ...chal, number });
    const second = await assessCheckout({
      req: makeReq({ "x-cx-stepup": stepup }),
      ...baseInput,
    });

    // Procede (ya no se le vuelve a desafiar) y el reintento NO es replay.
    expect(second.challengeRequired).toBe(false);
    expect(second.allowed).toBe(true);
    expect(second.action).toBe("challenge");
    expect(second.reasons).not.toContain("token_replay");
    // El challenge resuelto se consume single-use...
    expect(consumeChallenge).toHaveBeenCalledTimes(1);
    // ...y AHORA sí se quema el checkout-token (la compra procede).
    expect(consumeCheckoutToken).toHaveBeenCalledTimes(1);
  });

  it("una solución de step-up inválida sigue exigiendo challenge", async () => {
    const first = await assessCheckout({ req: makeReq(), ...baseInput });
    const chal = first.challenge!;
    // number incorrecto → verifyChallengeSolution falla → no satisface el step-up.
    const stepup = JSON.stringify({ ...chal, number: chal.maxnumber + 999 });
    const res = await assessCheckout({
      req: makeReq({ "x-cx-stepup": stepup }),
      ...baseInput,
    });
    expect(res.challengeRequired).toBe(true);
    expect(consumeCheckoutToken).not.toHaveBeenCalled();
  });
});

describe("CheckoutGuard — barrera atómica del checkout-token", () => {
  const cleanReq = (extra: Record<string, string> = {}): NextRequest =>
    new NextRequest("http://localhost/api/tickets/buy", {
      method: "POST",
      headers: {
        "x-device-hash": DEVICE,
        "x-checkout-token": "tok-1",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="120"',
        "accept-language": "es-PE",
        ...extra,
      },
    });

  const lowRiskInput = {
    phase: "buy" as const,
    eventId: EVENT_ID,
    ticketTypeIds: ["t1"],
    qty: 1,
    stockRemaining: null,
    contact: "a@b.com",
    dni: "12345678",
  };

  beforeEach(() => {
    process.env.BOT_ENFORCEMENT = "shadow";
    vi.mocked(consumeCheckoutToken).mockResolvedValue("fresh");
  });

  it("en shadow NO bloquea replay: registra would_block y deja pasar", async () => {
    vi.mocked(consumeCheckoutToken).mockResolvedValueOnce("replay");

    const res = await assessCheckout({ req: cleanReq(), ...lowRiskInput });

    expect(res.allowed).toBe(true);
    expect(res.action).toBe("would_block");
    expect(res.reasons).toContain("token_replay");
    expect(consumeCheckoutToken).toHaveBeenCalledTimes(1);
  });

  it("procede y quema el token cuando consume devuelve fresh", async () => {
    const res = await assessCheckout({ req: cleanReq(), ...lowRiskInput });

    expect(res.allowed).toBe(true);
    expect(res.challengeRequired).toBe(false);
    expect(consumeCheckoutToken).toHaveBeenCalledTimes(1);
  });

  it("en soft sí bloquea replay para evitar doble envío paralelo", async () => {
    process.env.BOT_ENFORCEMENT = "soft";
    vi.mocked(consumeCheckoutToken).mockResolvedValueOnce("replay");

    const res = await assessCheckout({ req: cleanReq(), ...lowRiskInput });

    expect(res.allowed).toBe(false);
    expect(res.action).toBe("blocked");
    expect(res.reasons).toContain("token_replay");
  });
});
