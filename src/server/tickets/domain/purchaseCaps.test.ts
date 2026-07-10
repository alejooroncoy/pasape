import { describe, it, expect } from "vitest";
import {
  DEFAULT_MAX_TICKETS_PER_PERSON,
  CARD_CAP_MULTIPLIER,
  effectiveMaxPerPerson,
  effectiveMaxPerCard,
} from "./purchaseCaps";

describe("purchaseCaps", () => {
  describe("effectiveMaxPerPerson (NO opt-in)", () => {
    it("usa el default cuando el organizador no configuró tope", () => {
      expect(effectiveMaxPerPerson(null)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
      expect(effectiveMaxPerPerson(undefined)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
    });

    it("respeta el tope configurado por el organizador", () => {
      expect(effectiveMaxPerPerson(4)).toBe(4);
      expect(effectiveMaxPerPerson(20)).toBe(20);
    });

    it("cae al default ante un valor no positivo (nunca deja la compra sin techo)", () => {
      expect(effectiveMaxPerPerson(0)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
      expect(effectiveMaxPerPerson(-3)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON);
    });
  });

  describe("effectiveMaxPerCard (más alto que el de persona)", () => {
    it("es el tope por persona × multiplicador", () => {
      expect(effectiveMaxPerCard(null)).toBe(DEFAULT_MAX_TICKETS_PER_PERSON * CARD_CAP_MULTIPLIER);
      expect(effectiveMaxPerCard(5)).toBe(5 * CARD_CAP_MULTIPLIER);
    });

    it("siempre deja más margen a la tarjeta que a la persona (familia con 1 tarjeta)", () => {
      for (const cfg of [null, 4, 6, 10]) {
        expect(effectiveMaxPerCard(cfg)).toBeGreaterThan(effectiveMaxPerPerson(cfg));
      }
    });
  });
});
