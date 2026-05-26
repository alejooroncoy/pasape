import { err, type Result } from "@/server/_shared/result";
import type { LegalEntityRepository } from "../ports/LegalEntityRepository";
import type { LegalEntity } from "../domain/LegalEntity";

type Deps = { repo: LegalEntityRepository };
type Input = {
  name: string;
  taxId?: string | null;
  country?: string;
  createdBy: string;
};

export const createLegalEntity = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<LegalEntity>> => {
  const name = input.name.trim();
  if (!name) return err("name_required");
  return repo.create({
    name,
    taxId: input.taxId?.trim() || null,
    country: input.country?.trim() || "PE",
    createdBy: input.createdBy,
  });
};
