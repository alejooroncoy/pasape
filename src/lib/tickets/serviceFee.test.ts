import { describe, expect, it } from "vitest";
import {
  buyerUnitPriceCents,
  computeServiceFeeCents,
  computeUnitFeeCents,
  resolveOrderFee,
  SERVICE_FEE_FLOOR_CENTS,
} from "./serviceFee";

const line = (unitPriceCents: number, chargedQty: number) => ({ unitPriceCents, chargedQty });

describe("computeUnitFeeCents — comisión / cobrado-al-comprador / display", () => {
  it("S/1: comisión con piso S/3, la paga el comprador, oculta", () => {
    expect(computeUnitFeeCents(100, "buyer_pays_extra")).toEqual({
      commissionCents: SERVICE_FEE_FLOOR_CENTS,
      chargedToBuyerCents: SERVICE_FEE_FLOOR_CENTS,
      showFeeLine: false,
    });
  });

  it("banda barata: aparte-oculta sin importar el modo del organizador", () => {
    expect(computeUnitFeeCents(100, "included_in_price")).toEqual({
      commissionCents: 300,
      chargedToBuyerCents: 300,
      showFeeLine: false,
    });
  });

  it("gratis: sin comisión ni cargo", () => {
    expect(computeUnitFeeCents(0, "buyer_pays_extra")).toEqual({
      commissionCents: 0,
      chargedToBuyerCents: 0,
      showFeeLine: false,
    });
  });

  it("S/50 aparte: 10% limpio (S/5), la paga el comprador y se muestra", () => {
    expect(computeUnitFeeCents(5000, "buyer_pays_extra")).toEqual({
      commissionCents: 500,
      chargedToBuyerCents: 500,
      showFeeLine: true,
    });
  });

  it("S/50 incluida: Pasape IGUAL gana su comisión, pero 0 extra al comprador", () => {
    expect(computeUnitFeeCents(5000, "included_in_price")).toEqual({
      commissionCents: 500, // se le descuenta al organizador en liquidación
      chargedToBuyerCents: 0, // el comprador solo paga el precio de cara
      showFeeLine: false,
    });
  });

  it("piso S/3 aplica siempre: a S/20 el 10% (S/2) sube al piso S/3", () => {
    expect(computeUnitFeeCents(2000, "buyer_pays_extra").commissionCents).toBe(300);
  });
});

describe("buyerUnitPriceCents — precio 'todo incluido' del comprador", () => {
  it("S/1 → S/4 (comisión encima, oculta)", () => {
    expect(buyerUnitPriceCents(100, "buyer_pays_extra")).toBe(400);
  });
  it("S/50 aparte → S/55 (comisión encima, mostrada)", () => {
    expect(buyerUnitPriceCents(5000, "buyer_pays_extra")).toBe(5500);
  });
  it("S/50 incluida → S/50 (el organizador la absorbe)", () => {
    expect(buyerUnitPriceCents(5000, "included_in_price")).toBe(5000);
  });
  it("gratis → 0", () => {
    expect(buyerUnitPriceCents(0, "buyer_pays_extra")).toBe(0);
  });
});

describe("computeServiceFeeCents — comisión de Pasape (siempre, ambos modos)", () => {
  it("incluida: la comisión existe aunque no se cobre al comprador", () => {
    expect(computeServiceFeeCents([line(5000, 1)], "included_in_price")).toBe(500);
  });
});

describe("resolveOrderFee — piso por entrada + separación de modos", () => {
  it("1×S/1 → comisión S/3, cobrado S/3, total S/4, oculto", () => {
    expect(resolveOrderFee(100, "buyer_pays_extra", [line(100, 1)])).toEqual({
      commissionCents: 300,
      chargedToBuyerCents: 300,
      showFeeLine: false,
    });
  });

  it("2×S/1 → comisión S/6 (piso por entrada), total S/8", () => {
    const r = resolveOrderFee(200, "buyer_pays_extra", [line(100, 2)]);
    expect(r.chargedToBuyerCents).toBe(600);
    expect(200 + r.chargedToBuyerCents).toBe(800);
  });

  it("3×S/1 → comisión S/9, total S/12", () => {
    const r = resolveOrderFee(300, "buyer_pays_extra", [line(100, 3)]);
    expect(r.chargedToBuyerCents).toBe(900);
    expect(300 + r.chargedToBuyerCents).toBe(1200);
  });

  it("incluida (S/50): comisión registrada, 0 al comprador, total = subtotal", () => {
    const r = resolveOrderFee(5000, "included_in_price", [line(5000, 1)]);
    expect(r.commissionCents).toBe(500); // Pasape gana igual
    expect(r.chargedToBuyerCents).toBe(0); // el comprador no paga extra
    expect(5000 + r.chargedToBuyerCents).toBe(5000); // total = subtotal
    expect(r.showFeeLine).toBe(false);
  });

  it("aparte (S/50): muestra la línea de servicio", () => {
    const r = resolveOrderFee(5000, "buyer_pays_extra", [line(5000, 1)]);
    expect(r.chargedToBuyerCents).toBe(500);
    expect(r.showFeeLine).toBe(true);
  });

  it("entrada barata NO se muestra aunque el subtotal pase de S/15", () => {
    const r = resolveOrderFee(2000, "buyer_pays_extra", [line(100, 20)]);
    expect(r.chargedToBuyerCents).toBe(20 * 300);
    expect(r.showFeeLine).toBe(false);
  });

  it("orden gratis: sin comisión ni cargo", () => {
    expect(resolveOrderFee(0, "buyer_pays_extra", [line(0, 2)])).toEqual({
      commissionCents: 0,
      chargedToBuyerCents: 0,
      showFeeLine: false,
    });
  });

  it("liquidación uniforme: ingreso organizador = total − comisión (ambos modos)", () => {
    const aparte = resolveOrderFee(5000, "buyer_pays_extra", [line(5000, 1)]);
    const totalAparte = 5000 + aparte.chargedToBuyerCents;
    expect(totalAparte - aparte.commissionCents).toBe(5000); // organizador recibe el face

    const incl = resolveOrderFee(5000, "included_in_price", [line(5000, 1)]);
    const totalIncl = 5000 + incl.chargedToBuyerCents;
    expect(totalIncl - incl.commissionCents).toBe(4500); // face − comisión absorbida
  });
});
