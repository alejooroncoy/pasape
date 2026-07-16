import { describe, it, expect, beforeAll } from "vitest";

// Secret determinista para las aserciones (el módulo lo lee lazy en cada firma).
beforeAll(() => {
  process.env.TICKET_LINK_SECRET = "test-ticket-link-secret";
});

import { signTicketLink, verifyTicketLink } from "./TicketLinkToken";
import { LINK_TOKEN_HEX_LENGTH } from "./linkTokenConfig";

const TICKET = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("TicketLinkToken", () => {
  it("firma un token hex de la longitud configurada", () => {
    const t = signTicketLink(TICKET);
    expect(t).toHaveLength(LINK_TOKEN_HEX_LENGTH);
    expect(t).toMatch(/^[0-9a-f]+$/);
  });

  it("valida el token que acaba de firmar (count 0)", () => {
    expect(verifyTicketLink(TICKET, signTicketLink(TICKET))).toBe(true);
  });

  it("compat legacy: count 0 y count omitido producen el MISMO token (los ?k= ya emitidos siguen válidos)", () => {
    expect(signTicketLink(TICKET)).toBe(signTicketLink(TICKET, 0));
    // El token legacy (firmado sin contador) valida contra count 0.
    expect(verifyTicketLink(TICKET, signTicketLink(TICKET, 0))).toBe(true);
  });

  it("rota en cada transferencia: el token de un contador NO vale para otro", () => {
    const k0 = signTicketLink(TICKET, 0);
    const k1 = signTicketLink(TICKET, 1);
    const k2 = signTicketLink(TICKET, 2);

    expect(k0).not.toBe(k1);
    expect(k1).not.toBe(k2);

    // El link del titular anterior (count 0) deja de validar tras la 1ª transferencia.
    expect(verifyTicketLink(TICKET, k0, 1)).toBe(false);
    // El link emitido al nuevo titular (count 1) valida contra count 1.
    expect(verifyTicketLink(TICKET, k1, 1)).toBe(true);
    // Y ese mismo deja de valer tras otra transferencia (count 2).
    expect(verifyTicketLink(TICKET, k1, 2)).toBe(false);
    expect(verifyTicketLink(TICKET, k2, 2)).toBe(true);
  });

  it("rechaza el token de otro ticket", () => {
    expect(verifyTicketLink(TICKET, signTicketLink(OTHER))).toBe(false);
  });

  it("rechaza tokens vacíos o de longitud inválida", () => {
    expect(verifyTicketLink(TICKET, "")).toBe(false);
    expect(verifyTicketLink(TICKET, "abc")).toBe(false);
    expect(verifyTicketLink(TICKET, signTicketLink(TICKET) + "00")).toBe(false);
  });
});
