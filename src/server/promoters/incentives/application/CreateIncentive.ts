import type { Result } from "@/server/_shared/result";
import type { Incentive } from "../domain/Incentive";
import type { CreateIncentiveInput, IncentiveRepository } from "../ports/IncentiveRepository";

type Deps = { repo: IncentiveRepository };

export const createIncentive = (
  { repo }: Deps,
  input: CreateIncentiveInput,
): Promise<Result<Incentive>> => repo.create(input);
