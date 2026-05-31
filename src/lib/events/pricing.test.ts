import { describe, expect, it } from "vitest";
import type { Promo, TicketType } from "@/server/events/domain/Event";
import { activePricing, applyPromos, chargedUnits } from "./pricing";

const NOW = new Date("2026-06-01T12:00:00.000Z");

const tt = (over: Partial<TicketType>): TicketType => ({
  id: "tt",
  eventId: "ev",
  name: "General",
  kind: "general",
  priceCents: 3000,
  currency: "PEN",
  capacity: 100,
  sold: 0,
  position: 0,
  boxLabel: null,
  zone: null,
  unitNoun: null,
  saleEndsAt: null,
  presalePriceCents: null,
  presaleQty: null,
  presaleEndsAt: null,
  ...over,
});

describe("activePricing", () => {
  it("sin preventa → precio normal", () => {
    const r = activePricing(tt({}), NOW);
    expect(r.priceCents).toBe(3000);
    expect(r.isPresale).toBe(false);
  });

  it("preventa sin límites → vigente", () => {
    const r = activePricing(tt({ presalePriceCents: 2000 }), NOW);
    expect(r.priceCents).toBe(2000);
    expect(r.isPresale).toBe(true);
    expect(r.basePriceCents).toBe(3000);
    expect(r.presaleRemaining).toBeNull();
  });

  it("preventa por stock: quedan cupos → vigente", () => {
    const r = activePricing(tt({ presalePriceCents: 2000, presaleQty: 50, sold: 30 }), NOW);
    expect(r.priceCents).toBe(2000);
    expect(r.isPresale).toBe(true);
    expect(r.presaleRemaining).toBe(20);
  });

  it("preventa por stock: agotada → precio normal", () => {
    const r = activePricing(tt({ presalePriceCents: 2000, presaleQty: 50, sold: 50 }), NOW);
    expect(r.priceCents).toBe(3000);
    expect(r.isPresale).toBe(false);
    expect(r.presaleRemaining).toBe(0);
  });

  it("preventa por fecha: futura → vigente; pasada → normal", () => {
    const future = activePricing(
      tt({ presalePriceCents: 2000, presaleEndsAt: "2026-06-02T00:00:00.000Z" }),
      NOW,
    );
    expect(future.isPresale).toBe(true);
    const past = activePricing(
      tt({ presalePriceCents: 2000, presaleEndsAt: "2026-05-30T00:00:00.000Z" }),
      NOW,
    );
    expect(past.isPresale).toBe(false);
    expect(past.priceCents).toBe(3000);
  });

  it("stock y fecha: lo que falle primero corta la preventa", () => {
    // stock OK pero fecha pasada
    const r = activePricing(
      tt({ presalePriceCents: 2000, presaleQty: 50, sold: 10, presaleEndsAt: "2026-05-30T00:00:00.000Z" }),
      NOW,
    );
    expect(r.isPresale).toBe(false);
  });
});

describe("chargedUnits", () => {
  it("2x1", () => {
    expect(chargedUnits(1, "2x1")).toBe(1);
    expect(chargedUnits(2, "2x1")).toBe(1);
    expect(chargedUnits(3, "2x1")).toBe(2);
    expect(chargedUnits(4, "2x1")).toBe(2);
  });
  it("3x2", () => {
    expect(chargedUnits(2, "3x2")).toBe(2);
    expect(chargedUnits(3, "3x2")).toBe(2);
    expect(chargedUnits(6, "3x2")).toBe(4);
  });
  it("sin promo", () => {
    expect(chargedUnits(5, null)).toBe(5);
  });
});

describe("applyPromos", () => {
  const promo = (over: Partial<Promo>): Promo => ({
    id: "p",
    eventId: "ev",
    ticketTypeId: "gen",
    kind: "2x1",
    endsAt: null,
    ...over,
  });

  it("2x1 reduce el total de la entrada con promo", () => {
    const r = applyPromos(
      [{ ticketTypeId: "gen", qty: 4, unitPriceCents: 2000 }],
      [promo({})],
      NOW,
    );
    expect(r.totalCents).toBe(4000); // cobra 2 de 4
    expect(r.lines[0].chargedQty).toBe(2);
    expect(r.lines[0].promo).toBe("2x1");
  });

  it("promo vencida no aplica", () => {
    const r = applyPromos(
      [{ ticketTypeId: "gen", qty: 2, unitPriceCents: 2000 }],
      [promo({ endsAt: "2026-05-30T00:00:00.000Z" })],
      NOW,
    );
    expect(r.totalCents).toBe(4000);
    expect(r.lines[0].promo).toBeNull();
  });

  it("entrada sin promo cobra normal", () => {
    const r = applyPromos(
      [{ ticketTypeId: "vip", qty: 3, unitPriceCents: 8000 }],
      [promo({ ticketTypeId: "gen" })],
      NOW,
    );
    expect(r.totalCents).toBe(24000);
  });
});
