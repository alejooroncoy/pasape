import type { Result } from "@/server/_shared/result";
import type {
  CreateOrgPromoterInput,
  OrgPromoter,
  UpdateOrgPromoterInput,
} from "../domain/OrgPromoter";

export type OrgPromoterRepository = {
  listByOrg(organizationId: string): Promise<OrgPromoter[]>;
  findById(id: string): Promise<OrgPromoter | null>;
  create(input: CreateOrgPromoterInput): Promise<Result<OrgPromoter>>;
  update(id: string, organizationId: string, input: UpdateOrgPromoterInput): Promise<Result<OrgPromoter>>;
  softDelete(id: string, organizationId: string): Promise<Result<true>>;
};
