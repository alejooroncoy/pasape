import type { Result } from "@/server/_shared/result";
import type { Incentive, IncentiveAudience, IncentiveGoalKind } from "../domain/Incentive";

export type CreateIncentiveInput = {
  eventId: string;
  audience: IncentiveAudience;
  name: string;
  goalKind: IncentiveGoalKind;
  goalValue: number;
  reward: string;
};

export interface IncentiveRepository {
  listForEvent(eventId: string): Promise<Array<Incentive & { unlockedCount: number }>>;
  create(input: CreateIncentiveInput): Promise<Result<Incentive>>;
}
