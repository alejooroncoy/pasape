import { z } from "zod";

/**
 * Zod compartido para validar el `commission_config` (metas) al escribir
 * esquema/override desde los controllers REST. Es el eje de METAS, independiente
 * del %. Un mismo esquema mezcla hitos cash y en especie; `cash` exige
 * `amountCents`, especie (`perk`) lo deja en null. `basis` = sobre qué se cuenta
 * el avance: ventas (`sold`) o asistencia (`attended`).
 */
export const milestoneSchema = z
  .object({
    threshold: z.number().int().min(0),
    rewardKind: z.enum(["cash", "perk"]),
    amountCents: z.number().int().min(0).nullable(),
    label: z.string(),
  })
  .refine((m) => (m.rewardKind === "cash" ? m.amountCents != null : true), {
    message: "cash_milestone_needs_amount",
  });

export const commissionConfigSchema = z
  .object({
    basis: z.enum(["sold", "attended"]),
    milestones: z.array(milestoneSchema),
  })
  .nullable();
