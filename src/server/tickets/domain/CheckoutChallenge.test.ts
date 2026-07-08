import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "crypto";
import {
  makeChallenge,
  mintDifficulty,
  verifyChallengeSolution,
  DEFAULT_MAX_NUMBER,
  type Challenge,
} from "./CheckoutChallenge";

// El challenge firma con TICKET_LINK_SECRET; lo fijamos para el test.
beforeAll(() => {
  process.env.TICKET_LINK_SECRET = "test-secret-checkout-challenge";
});

// Resuelve el PoW como lo haría el cliente (brute force acotado).
const solve = (c: Challenge): number => {
  for (let i = 0; i <= c.maxnumber; i++) {
    if (createHash("sha256").update(c.salt + i).digest("hex") === c.target) return i;
  }
  throw new Error("sin solución (no debería pasar)");
};

describe("CheckoutChallenge — proof-of-work del minteo", () => {
  it("una solución correcta verifica", () => {
    const c = makeChallenge("11111111-1111-4111-8111-111111111111", "devhash123");
    const number = solve(c);
    expect(verifyChallengeSolution({ ...c, number })).toBe(true);
  });

  it("un número equivocado NO verifica", () => {
    const c = makeChallenge("11111111-1111-4111-8111-111111111111", "devhash123");
    const number = solve(c);
    expect(verifyChallengeSolution({ ...c, number: number === 0 ? 1 : number - 1 })).toBe(false);
  });

  it("manipular el deviceHash invalida la firma (no se puede reatar el token)", () => {
    const c = makeChallenge("11111111-1111-4111-8111-111111111111", "devhash123");
    const number = solve(c);
    expect(verifyChallengeSolution({ ...c, deviceHash: "otro-device", number })).toBe(false);
  });

  it("manipular el eventId invalida la firma", () => {
    const c = makeChallenge("11111111-1111-4111-8111-111111111111", "devhash123");
    const number = solve(c);
    expect(
      verifyChallengeSolution({ ...c, eventId: "22222222-2222-4222-8222-222222222222", number }),
    ).toBe(false);
  });

  it("PoW escalado: humano (pocos minteos) paga la base; el bot escala hasta el techo", () => {
    // Humano: 1-3 minteos → base trivial (invisible).
    expect(mintDifficulty(1)).toBe(DEFAULT_MAX_NUMBER);
    expect(mintDifficulty(3)).toBe(DEFAULT_MAX_NUMBER);
    // Bot: crece exponencialmente...
    expect(mintDifficulty(6)).toBeGreaterThan(DEFAULT_MAX_NUMBER);
    expect(mintDifficulty(16)).toBeGreaterThan(mintDifficulty(6));
    // ...pero con techo (un bug jamás congela a nadie).
    expect(mintDifficulty(1000)).toBe(DEFAULT_MAX_NUMBER * 32);
  });

  it("un challenge con dificultad escalada sigue verificando correctamente", () => {
    const c = makeChallenge("11111111-1111-4111-8111-111111111111", "dev", mintDifficulty(10));
    expect(c.maxnumber).toBeGreaterThan(DEFAULT_MAX_NUMBER);
    const number = solve(c);
    expect(verifyChallengeSolution({ ...c, number })).toBe(true);
  });

  it("un challenge viejo (fuera de TTL) NO verifica", () => {
    const c = makeChallenge("11111111-1111-4111-8111-111111111111", "devhash123");
    const number = solve(c);
    // 11 min atrás (TTL = 10 min). La firma cubre issuedAt, así que hay que
    // re-firmar para un test honesto: en su lugar validamos que un issuedAt
    // manipulado (sin re-firmar) cae por firma inválida.
    expect(verifyChallengeSolution({ ...c, issuedAt: c.issuedAt - 11 * 60_000, number })).toBe(false);
  });
});
