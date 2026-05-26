export type IncentiveAudience = "promoter" | "buyer";
export type IncentiveGoalKind =
  | "tickets_sold"
  | "revenue_cents"
  | "tickets_bought"
  | "referrals";

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
