import type { Result } from "@/server/_shared/result";
import type { LegalEntity } from "../domain/LegalEntity";

export interface LegalEntityRepository {
  create(input: {
    name: string;
    taxId?: string | null;
    country?: string;
    createdBy: string;
  }): Promise<Result<LegalEntity>>;
  findById(id: string): Promise<LegalEntity | null>;
  findBySlug(slug: string): Promise<LegalEntity | null>;
  listByOwner(profileId: string): Promise<LegalEntity[]>;
  update(input: {
    id: string;
    callerId: string;
    name?: string;
    taxId?: string | null;
    country?: string;
    slug?: string | null;
    displayName?: string | null;
    logoUrl?: string | null;
    coverUrl?: string | null;
    bio?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankCci?: string | null;
  }): Promise<Result<LegalEntity>>;
}
