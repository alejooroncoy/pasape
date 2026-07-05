import type { MilestoneRewardKind } from "@/server/promoters/domain/OrgPromoter";

/**
 * Display de un hito por su `rewardKind`. Un solo lugar para el emoji/etiqueta,
 * así el pitch del promotor, el editor del organizador y la vista de metas se
 * ven iguales.
 */
export const milestoneIcon = (kind: MilestoneRewardKind): string =>
  kind === "cash" ? "💵" : "🎁";

export const milestoneKindLabel = (kind: MilestoneRewardKind): string =>
  kind === "cash" ? "Efectivo" : "Premio";
