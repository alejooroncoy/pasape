import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { LegalEntityRepository } from "../../ports/LegalEntityRepository";
import type { LegalEntity } from "../../domain/LegalEntity";

type Row = {
  id: string;
  name: string;
  tax_id: string | null;
  country: string;
  slug: string | null;
  display_name: string | null;
  logo_url: string | null;
  cover_url: string | null;
  bio: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_cci: string | null;
  created_by: string;
  created_at: string;
};

const toDomain = (r: Row): LegalEntity => ({
  id: r.id,
  name: r.name,
  taxId: r.tax_id,
  country: r.country,
  slug: r.slug,
  displayName: r.display_name,
  logoUrl: r.logo_url,
  coverUrl: r.cover_url,
  bio: r.bio,
  bankName: r.bank_name,
  bankAccountNumber: r.bank_account_number,
  bankCci: r.bank_cci,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export const supabaseLegalEntityRepository: LegalEntityRepository = {
  async create(input): Promise<Result<LegalEntity>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("legal_entities")
      .insert({
        name: input.name,
        tax_id: input.taxId ?? null,
        country: input.country ?? "PE",
        created_by: input.createdBy,
      })
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "legal_entity_create_failed");
    return ok(toDomain(data));
  },

  async findById(id) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("legal_entities")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle<Row>();
    return data ? toDomain(data) : null;
  },

  async findBySlug(slug) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("legal_entities")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle<Row>();
    return data ? toDomain(data) : null;
  },

  async listByOwner(profileId) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("legal_entities")
      .select("*")
      .eq("created_by", profileId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    return (data ?? []).map((r) => toDomain(r as Row));
  },

  async update(input): Promise<Result<LegalEntity>> {
    const db = supabaseAdmin();
    const existing = await db
      .from("legal_entities")
      .select("created_by")
      .eq("id", input.id)
      .maybeSingle<{ created_by: string }>();
    if (!existing.data) return err("legal_entity_not_found");
    if (existing.data.created_by !== input.callerId) return err("forbidden");

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.taxId !== undefined) patch.tax_id = input.taxId;
    if (input.country !== undefined) patch.country = input.country;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
    if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl;
    if (input.bio !== undefined) patch.bio = input.bio;
    if (input.bankName !== undefined) patch.bank_name = input.bankName;
    if (input.bankAccountNumber !== undefined) patch.bank_account_number = input.bankAccountNumber;
    if (input.bankCci !== undefined) patch.bank_cci = input.bankCci;

    const { data, error } = await db
      .from("legal_entities")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "legal_entity_update_failed");
    return ok(toDomain(data));
  },
};
