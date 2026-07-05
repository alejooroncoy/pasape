import { describe, expect, it } from "vitest";
import {
  coerceCommissionConfig,
  computePromoterPayout,
  describePromoterMilestones,
  resolveCommissionScheme,
} from "./CommissionResolver";
import type { CommissionConfig } from "../domain/OrgPromoter";

describe("coerceCommissionConfig", () => {
  it("lee el shape v3 con basis + milestones (cash + perk)", () => {
    const raw = {
      basis: "attended",
      milestones: [
        { threshold: 1, rewardKind: "cash", amountCents: 3000, label: "" },
        { threshold: 5, rewardKind: "perk", amountCents: null, label: "Botella" },
      ],
    };
    expect(coerceCommissionConfig(raw)).toEqual({
      basis: "attended",
      milestones: [
        { threshold: 1, rewardKind: "cash", amountCents: 3000, label: "" },
        { threshold: 5, rewardKind: "perk", amountCents: null, label: "Botella" },
      ],
    });
  });

  it("basis por defecto es sold; rewardKind no-cash cae a perk", () => {
    expect(coerceCommissionConfig({ milestones: [{ threshold: 2, rewardKind: "bottle", label: "x" }] })).toEqual({
      basis: "sold",
      milestones: [{ threshold: 2, rewardKind: "perk", amountCents: null, label: "x" }],
    });
  });

  it("migra el shape v2 (salesCount + bottle/custom) → threshold + perk", () => {
    const raw = {
      milestones: [
        { salesCount: 5, rewardKind: "bottle", amountCents: null, label: "Botella" },
        { salesCount: 15, rewardKind: "custom", amountCents: null, label: "VIP" },
        { salesCount: 3, rewardKind: "cash", amountCents: 10000, label: "" },
      ],
    };
    expect(coerceCommissionConfig(raw)).toEqual({
      basis: "sold",
      milestones: [
        { threshold: 5, rewardKind: "perk", amountCents: null, label: "Botella" },
        { threshold: 15, rewardKind: "perk", amountCents: null, label: "VIP" },
        { threshold: 3, rewardKind: "cash", amountCents: 10000, label: "" },
      ],
    });
  });

  it("migra el shape v1 (tiers/rewards)", () => {
    expect(coerceCommissionConfig({ tiers: [{ salesCount: 10, payoutCents: 10000 }] })).toEqual({
      basis: "sold",
      milestones: [{ threshold: 10, rewardKind: "cash", amountCents: 10000, label: "" }],
    });
    expect(coerceCommissionConfig({ rewards: [{ salesCount: 40, label: "Botella", icon: "🍾" }] })).toEqual({
      basis: "sold",
      milestones: [{ threshold: 40, rewardKind: "perk", amountCents: null, label: "Botella" }],
    });
  });
});

describe("computePromoterPayout — dos ejes combinables", () => {
  it("solo %: round(gross * pct / 100), sin metas", () => {
    expect(
      computePromoterPayout({ pct: 20, config: null, soldUnits: 3, attendedUnits: 2, grossCents: 10000 }),
    ).toEqual({ payoutCents: 2000, rewards: [] });
  });

  it("% + hitos cash JUNTOS (el caso que antes era imposible)", () => {
    const config: CommissionConfig = {
      basis: "sold",
      milestones: [{ threshold: 3, rewardKind: "cash", amountCents: 10000, label: "" }],
    };
    // 20% de S/100 = S/20  +  bono S/100 al llegar a 3 ventas = S/120
    expect(
      computePromoterPayout({ pct: 20, config, soldUnits: 3, attendedUnits: 3, grossCents: 10000 }),
    ).toEqual({ payoutCents: 12000, rewards: [] });
  });

  it("basis sold vs attended cambia el conteo del hito", () => {
    const config: CommissionConfig = {
      basis: "attended",
      milestones: [{ threshold: 3, rewardKind: "cash", amountCents: 5000, label: "" }],
    };
    // vendió 5 pero solo asistieron 2 → NO desbloquea (basis attended)
    expect(
      computePromoterPayout({ pct: 0, config, soldUnits: 5, attendedUnits: 2, grossCents: 0 }),
    ).toEqual({ payoutCents: 0, rewards: [] });
    // asistieron 3 → desbloquea
    expect(
      computePromoterPayout({ pct: 0, config, soldUnits: 5, attendedUnits: 3, grossCents: 0 }),
    ).toEqual({ payoutCents: 5000, rewards: [] });
  });

  it("mezcla cash + perk: cash suma, perk devuelve la lista conseguida", () => {
    const config: CommissionConfig = {
      basis: "sold",
      milestones: [
        { threshold: 1, rewardKind: "cash", amountCents: 3000, label: "" },
        { threshold: 5, rewardKind: "perk", amountCents: null, label: "Botella" },
      ],
    };
    expect(
      computePromoterPayout({ pct: 0, config, soldUnits: 5, attendedUnits: 5, grossCents: 0 }),
    ).toEqual({ payoutCents: 3000, rewards: [{ label: "Botella" }] });
  });
});

describe("describePromoterMilestones — desglose para el reporte", () => {
  it("sin config: vacío", () => {
    expect(describePromoterMilestones(null, 5, 3)).toEqual({
      basis: null,
      count: 0,
      milestones: [],
      cashUnlockedCents: 0,
    });
  });

  it("ordena por umbral, marca desbloqueados y suma cash conseguido (base sold)", () => {
    const config: CommissionConfig = {
      basis: "sold",
      milestones: [
        { threshold: 10, rewardKind: "perk", amountCents: null, label: "Botella" },
        { threshold: 3, rewardKind: "cash", amountCents: 5000, label: "" },
      ],
    };
    // vendió 5: alcanza el de 3 (cash), no el de 10 (perk).
    expect(describePromoterMilestones(config, 5, 2)).toEqual({
      basis: "sold",
      count: 5,
      cashUnlockedCents: 5000,
      milestones: [
        { threshold: 3, rewardKind: "cash", amountCents: 5000, label: "", unlocked: true },
        { threshold: 10, rewardKind: "perk", amountCents: null, label: "Botella", unlocked: false },
      ],
    });
  });

  it("base attended: cuenta la asistencia, no la venta", () => {
    const config: CommissionConfig = {
      basis: "attended",
      milestones: [{ threshold: 3, rewardKind: "cash", amountCents: 5000, label: "" }],
    };
    // vendió 5 pero solo asistieron 2 → conteo 2, nada desbloqueado.
    const view = describePromoterMilestones(config, 5, 2);
    expect(view.count).toBe(2);
    expect(view.cashUnlockedCents).toBe(0);
    expect(view.milestones[0]?.unlocked).toBe(false);
  });
});

describe("resolveCommissionScheme — herencia link → promotor → evento → marca", () => {
  const EMPTY = {
    linkPct: null,
    linkConfigOverride: null,
    promoterPct: null,
    promoterConfig: null,
    eventPct: null,
    eventConfig: null,
    brandPct: null,
    brandConfig: null,
  };

  it("pct y config se heredan por separado", () => {
    const scheme = resolveCommissionScheme({
      ...EMPTY,
      linkPct: 25, // % propio del link
      linkConfigOverride: null, // sin metas propias → hereda (promotor→evento→marca)
      eventConfig: { basis: "attended", milestones: [{ threshold: 10, rewardKind: "perk", amountCents: null, label: "VIP" }] },
      eventPct: 20,
      promoterPct: 10,
    });
    expect(scheme.pct).toBe(25);
    expect(scheme.config).toEqual({
      basis: "attended",
      milestones: [{ threshold: 10, rewardKind: "perk", amountCents: null, label: "VIP" }],
    });
  });

  it("la tarifa del PROMOTOR gana sobre el default del EVENTO", () => {
    // Promotor negoció 20% general; el evento en general paga 15%. Gana el 20%.
    const scheme = resolveCommissionScheme({
      ...EMPTY,
      promoterPct: 20,
      eventPct: 15,
      brandPct: 10,
    });
    expect(scheme.pct).toBe(20);
  });

  it("el evento aplica a quien NO tiene tarifa propia; sino cae a la marca", () => {
    // Sin promotor ni link: gana el evento sobre la marca.
    expect(resolveCommissionScheme({ ...EMPTY, eventPct: 15, brandPct: 10 }).pct).toBe(15);
    // Sin promotor, sin evento: cae a la marca (base universal).
    expect(resolveCommissionScheme({ ...EMPTY, brandPct: 10 }).pct).toBe(10);
  });

  it("el link (caso especial) gana sobre todo", () => {
    const scheme = resolveCommissionScheme({
      ...EMPTY,
      linkPct: 30,
      promoterPct: 20,
      eventPct: 15,
      brandPct: 10,
    });
    expect(scheme.pct).toBe(30);
  });

  it("metas de la marca se heredan cuando nadie más las define", () => {
    const scheme = resolveCommissionScheme({
      ...EMPTY,
      brandConfig: { basis: "sold", milestones: [{ threshold: 50, rewardKind: "cash", amountCents: 10000, label: "" }] },
    });
    expect(scheme.config?.milestones[0]?.threshold).toBe(50);
  });

  it("sin nada configurado: pct 0, sin metas, configured=false", () => {
    expect(resolveCommissionScheme({ ...EMPTY })).toEqual({
      pct: 0,
      config: null,
      configured: false,
    });
  });

  it("configured=true si CUALQUIER nivel puso algo (incluso 0% a propósito)", () => {
    // 0% explícito del evento = decisión → configured true (no es "pendiente").
    expect(resolveCommissionScheme({ ...EMPTY, eventPct: 0 }).configured).toBe(true);
    // solo metas de la marca → configured true.
    expect(
      resolveCommissionScheme({
        ...EMPTY,
        brandConfig: { basis: "sold", milestones: [{ threshold: 5, rewardKind: "perk", amountCents: null, label: "x" }] },
      }).configured,
    ).toBe(true);
  });
});
