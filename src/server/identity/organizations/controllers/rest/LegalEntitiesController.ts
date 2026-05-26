import { z } from "zod";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { createLegalEntity } from "../../application/CreateLegalEntity";
import { listMyLegalEntities } from "../../application/ListMyLegalEntities";
import { supabaseLegalEntityRepository } from "../../infrastructure/repositories/SupabaseLegalEntityRepository";
import type { LegalEntity } from "../../domain/LegalEntity";

const repo = supabaseLegalEntityRepository;

const createSchema = z.object({
  name: z.string().min(1),
  taxId: z.string().nullable().optional(),
  country: z.string().length(2).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  taxId: z.string().nullable().optional(),
  country: z.string().length(2).optional(),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "slug_invalid")
    .nullable()
    .optional(),
  displayName: z.string().min(1).max(80).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  bio: z.string().max(280).nullable().optional(),
  bankName: z.string().min(1).max(40).nullable().optional(),
  bankAccountNumber: z.string().min(4).max(40).nullable().optional(),
  bankCci: z
    .string()
    .regex(/^\d{20}$/, "El CCI debe tener exactamente 20 dígitos.")
    .nullable()
    .optional(),
});

export const LegalEntitiesController = {
  async list(): Promise<Result<LegalEntity[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return ok(await listMyLegalEntities({ repo }, auth.value.profileId));
  },

  async create(input: unknown): Promise<Result<LegalEntity>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return createLegalEntity({ repo }, { ...parsed.data, createdBy: auth.value.profileId });
  },

  async update(id: string, input: unknown): Promise<Result<LegalEntity>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return repo.update({ id, callerId: auth.value.profileId, ...parsed.data });
  },
};
