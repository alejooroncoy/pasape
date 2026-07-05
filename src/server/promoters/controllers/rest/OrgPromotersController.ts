import { z } from "zod";
import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseOrgPromoterRepository as repo } from "../../infrastructure/repositories/SupabaseOrgPromoterRepository";
import type { CommissionConfig, OrgPromoter } from "../../domain/OrgPromoter";
import { getOrgPromoterDetail, type PromoterDetail } from "../../application/PromoterDetail";
import { coerceCommissionConfig } from "../../application/CommissionResolver";
import { commissionConfigSchema } from "./commissionConfigSchema";

/** Regla base de la marca (organization): el 4º nivel de la cascada de comisión. */
export type OrgScheme = {
  commissionPct: number | null;
  commissionConfig: CommissionConfig | null;
};

const commissionConfigInputSchema = commissionConfigSchema.optional();

// Las metas (config) son un eje INDEPENDIENTE del %. Si viene un config, debe
// tener al menos un hito; null = sin metas (perfectamente válido).
const normalizeCommission = (
  config: CommissionConfig | undefined,
): Result<CommissionConfig> => {
  if (config == null) return ok(null);
  if (config.milestones.length === 0) return err("commission_config_required");
  return ok(config);
};

const sanitizeHost = (raw: string): string => {
  let h = raw.trim();
  if (h.startsWith("http://")) h = h.slice("http://".length);
  else if (h.startsWith("https://")) h = h.slice("https://".length);
  const slashAt = h.indexOf("/");
  if (slashAt > -1) h = h.slice(0, slashAt);
  return h || "pasape.lat";
};

const resolveOrigin = async () => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = await headers();
  const host = sanitizeHost(h.get("x-forwarded-host") ?? h.get("host") ?? "pasape.lat");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

type Ctx = { profileId: string; orgId: string };

// `allowedRoles` (opcional): las escrituras (crear/editar/borrar promotores,
// enviar invitaciones por WhatsApp con costo) DEBEN exigir rol; ser miembro no
// basta. Las lecturas (list/detail) lo omiten.
const ORG_WRITE_ROLES = ["owner", "admin", "editor"];

const resolveOrgCtx = async (allowedRoles?: string[]): Promise<Result<Ctx>> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err(auth.error);
  const slug = await resolveActiveOrgSlug(auth.value.profileId);
  if (!slug) return err("no_active_org");
  const org = await supabaseOrganizationRepository.findBySlug(slug);
  if (!org) return err("no_active_org");
  if (allowedRoles) {
    const { data: membership } = await supabaseAdmin()
      .from("memberships")
      .select("role")
      .eq("scope_type", "organization")
      .eq("scope_id", org.id)
      .eq("profile_id", auth.value.profileId)
      .maybeSingle<{ role: string }>();
    if (!membership || !allowedRoles.includes(membership.role)) return err("forbidden");
  }
  return ok({ profileId: auth.value.profileId, orgId: org.id });
};

const createSchema = z.object({
  name: z.string().min(1).max(80),
  whatsapp: z.string().min(6).max(32).nullable().optional(),
  // null = hereda de la marca (default de un promotor nuevo). Sin default 15.
  defaultCommissionPct: z.number().int().min(0).max(100).nullable().default(null),
  commissionConfig: commissionConfigInputSchema,
  notes: z.string().max(500).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  whatsapp: z.string().min(6).max(32).nullable().optional(),
  defaultCommissionPct: z.number().int().min(0).max(100).nullable().optional(),
  commissionConfig: commissionConfigInputSchema,
  notes: z.string().max(500).nullable().optional(),
});

const sanitizeWhatsapp = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "");
  return cleaned.length === 0 ? null : cleaned;
};

const guardPromoterInOrg = async (
  id: string,
  allowedRoles?: string[],
): Promise<Result<{ ctx: Ctx; promoter: OrgPromoter }>> => {
  const ctx = await resolveOrgCtx(allowedRoles);
  if (!ctx.ok) return err(ctx.error);
  const promoter = await repo.findById(id);
  if (!promoter) return err("not_found");
  if (promoter.organizationId !== ctx.value.orgId) return err("forbidden");
  return ok({ ctx: ctx.value, promoter });
};

export const OrgPromotersController = {
  async list(): Promise<Result<OrgPromoter[]>> {
    const ctx = await resolveOrgCtx();
    if (!ctx.ok) return err(ctx.error);
    return ok(await repo.listByOrg(ctx.value.orgId));
  },

  async create(input: unknown): Promise<Result<OrgPromoter>> {
    const ctx = await resolveOrgCtx(ORG_WRITE_ROLES);
    if (!ctx.ok) return err(ctx.error);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    const cfg = normalizeCommission(parsed.data.commissionConfig);
    if (!cfg.ok) return err(cfg.error);
    return repo.create({
      organizationId: ctx.value.orgId,
      createdBy: ctx.value.profileId,
      name: parsed.data.name.trim(),
      whatsapp: sanitizeWhatsapp(parsed.data.whatsapp ?? null),
      defaultCommissionPct: parsed.data.defaultCommissionPct,
      commissionConfig: cfg.value,
      notes: parsed.data.notes ?? null,
    });
  },

  async update(id: string, input: unknown): Promise<Result<OrgPromoter>> {
    const guard = await guardPromoterInOrg(id, ORG_WRITE_ROLES);
    if (!guard.ok) return err(guard.error);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");

    // Metas (config) es un eje independiente: si viene, validá su forma.
    let commissionConfig: CommissionConfig | undefined = parsed.data.commissionConfig;
    if (parsed.data.commissionConfig !== undefined) {
      const cfg = normalizeCommission(parsed.data.commissionConfig);
      if (!cfg.ok) return err(cfg.error);
      commissionConfig = cfg.value;
    }

    return repo.update(id, guard.value.ctx.orgId, {
      name: parsed.data.name,
      defaultCommissionPct: parsed.data.defaultCommissionPct,
      commissionConfig,
      notes: parsed.data.notes,
      whatsapp:
        parsed.data.whatsapp === undefined
          ? undefined
          : sanitizeWhatsapp(parsed.data.whatsapp),
    });
  },

  async remove(id: string): Promise<Result<true>> {
    const guard = await guardPromoterInOrg(id, ORG_WRITE_ROLES);
    if (!guard.ok) return err(guard.error);
    return repo.softDelete(id, guard.value.ctx.orgId);
  },

  async detail(id: string): Promise<Result<PromoterDetail>> {
    const guard = await guardPromoterInOrg(id);
    if (!guard.ok) return err(guard.error);
    const origin = await resolveOrigin();
    return ok(await getOrgPromoterDetail(guard.value.promoter, origin));
  },

  // Regla base de la marca (para todos los promotores y eventos). La leen todas
  // las lecturas de comisión vía el resolver; aquí se ve/edita en un solo lugar.
  async getScheme(): Promise<Result<OrgScheme>> {
    const ctx = await resolveOrgCtx();
    if (!ctx.ok) return err(ctx.error);
    const { data } = await supabaseAdmin()
      .from("organizations")
      .select("promoter_commission_pct, promoter_commission_config")
      .eq("id", ctx.value.orgId)
      .maybeSingle<{ promoter_commission_pct: number | null; promoter_commission_config: unknown }>();
    return ok({
      commissionPct: data?.promoter_commission_pct ?? null,
      commissionConfig: coerceCommissionConfig(data?.promoter_commission_config),
    });
  },

  async updateScheme(input: unknown): Promise<Result<true>> {
    const ctx = await resolveOrgCtx(ORG_WRITE_ROLES);
    if (!ctx.ok) return err(ctx.error);
    const parsed = z
      .object({
        commissionPct: z.number().int().min(0).max(100).nullable().optional(),
        commissionConfig: commissionConfigSchema.optional(),
      })
      .safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    const row: Record<string, unknown> = {};
    if ("commissionPct" in parsed.data) row.promoter_commission_pct = parsed.data.commissionPct;
    if ("commissionConfig" in parsed.data) row.promoter_commission_config = parsed.data.commissionConfig;
    if (Object.keys(row).length === 0) return ok(true);
    const { error } = await supabaseAdmin()
      .from("organizations")
      .update(row)
      .eq("id", ctx.value.orgId);
    if (error) return err(error.message);
    return ok(true);
  },
};
