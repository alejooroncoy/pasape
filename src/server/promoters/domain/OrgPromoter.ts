/**
 * Tipo de premio de un hito. `cash` paga dinero (`amountCents`); `perk` es en
 * especie (sin monto — el label describe el premio: botella, mesa VIP, etc.).
 */
export type MilestoneRewardKind = "cash" | "perk";

/**
 * Base sobre la que se cuenta el avance de los hitos, a elección del organizador:
 *  - `sold`     → entradas vendidas de pago (por vender).
 *  - `attended` → gente que efectivamente entró (validada en puerta), gratis +
 *                 pago (por meter gente que asiste; anti-fraude: no cuenta invitar
 *                 fantasmas que no aparecen).
 */
export type MilestoneBasis = "sold" | "attended";

/**
 * Un hito: al llegar a `threshold` (según `basis` del config), el promotor
 * consigue el premio. El desbloqueo NO se persiste: se deriva al vuelo del
 * conteo, lo que hace el payout naturalmente reversible.
 */
export type CommissionMilestone = {
  threshold: number;
  rewardKind: MilestoneRewardKind;
  /** Solo para `cash`; null en especie. */
  amountCents: number | null;
  label: string;
};

/**
 * Shape del jsonb `commission_config`. Es el eje de METAS, INDEPENDIENTE del %:
 * un promotor puede tener comisión % (por venta) Y metas (por umbral) a la vez.
 * null = sin metas.
 */
export type CommissionConfig = null | {
  basis: MilestoneBasis;
  milestones: CommissionMilestone[];
};

export type OrgPromoter = {
  id: string;
  organizationId: string;
  name: string;
  whatsapp: string | null;
  /** % sobre lo vendido de pago. null = HEREDA de la marca; 0 = sin comisión. */
  defaultCommissionPct: number | null;
  /** Metas (efectivo/especie por umbral). null = sin metas. */
  commissionConfig: CommissionConfig;
  profileId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
};

export type CreateOrgPromoterInput = {
  organizationId: string;
  createdBy: string;
  name: string;
  whatsapp: string | null;
  /** null = hereda de la marca (default de un promotor nuevo). */
  defaultCommissionPct: number | null;
  commissionConfig: CommissionConfig;
  notes?: string | null;
};

export type UpdateOrgPromoterInput = {
  name?: string;
  whatsapp?: string | null;
  defaultCommissionPct?: number | null;
  commissionConfig?: CommissionConfig;
  notes?: string | null;
};
