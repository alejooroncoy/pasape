// Solo promotor: los incentivos al COMPRADOR se descartaron (no salen en esta
// versión). tickets_bought era la única meta buyer-only, también fuera.
export type IncentiveAudience = "promoter";
export type IncentiveGoalKind = "tickets_sold" | "revenue_cents" | "referrals";

export type Incentive = {
  id: string;
  eventId: string;
  audience: IncentiveAudience;
  name: string;
  goalKind: IncentiveGoalKind;
  goalValue: number;
  reward: string;
  active: boolean;
  createdAt: string;
};
