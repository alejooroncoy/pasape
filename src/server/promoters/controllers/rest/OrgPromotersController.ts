import { z } from "zod";
import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseOrgPromoterRepository as repo } from "../../infrastructure/repositories/SupabaseOrgPromoterRepository";
import type {
  CommissionConfig,
  CommissionType,
  OrgPromoter,
} from "../../domain/OrgPromoter";
import { getOrgPromoterDetail, type PromoterDetail } from "../../application/PromoterDetail";

const tierSchema = z.object({
  salesCount: z.number().int().min(1),
  payoutCents: z.number().int().min(0),
});
const rewardSchema = z.object({
  salesCount: z.number().int().min(1),
  label: z.string().min(1).max(40),
  icon: z.string().min(1).max(8),
});
// Raw commission_config wire shape. The discriminator (`commissionType`) lives
// on the parent payload so the JSON sent to the DB matches the column shape.
const commissionConfigInputSchema = z
  .union([
    z.null(),
    z.object({ tiers: z.array(tierSchema).min(1) }),
    z.object({ rewards: z.array(rewardSchema).min(1) }),
  ])
  .optional();
const commissionTypeSchema = z.enum(["percentage", "tiered", "inkind"]);

// Cross-field check: `commissionType` must agree with the shape of `commissionConfig`.
const normalizeCommission = (
  type: CommissionType,
  config: CommissionConfig | undefined,
): Result<CommissionConfig> => {
  if (type === "percentage") return ok(null);
  if (config == null) return err("commission_config_required");
  if (type === "tiered") {
    if (!("tiers" in config)) return err("tiers_required");
    return ok(config);
  }
  if (!("rewards" in config)) return err("rewards_required");
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
  defaultCommissionPct: z.number().int().min(0).max(100).default(15),
  commissionType: commissionTypeSchema.default("percentage"),
  commissionConfig: commissionConfigInputSchema,
  notes: z.string().max(500).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  whatsapp: z.string().min(6).max(32).nullable().optional(),
  defaultCommissionPct: z.number().int().min(0).max(100).optional(),
  commissionType: commissionTypeSchema.optional(),
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
    const cfg = normalizeCommission(parsed.data.commissionType, parsed.data.commissionConfig);
    if (!cfg.ok) return err(cfg.error);
    return repo.create({
      organizationId: ctx.value.orgId,
      createdBy: ctx.value.profileId,
      name: parsed.data.name.trim(),
      whatsapp: sanitizeWhatsapp(parsed.data.whatsapp ?? null),
      defaultCommissionPct: parsed.data.defaultCommissionPct,
      commissionType: parsed.data.commissionType,
      commissionConfig: cfg.value,
      notes: parsed.data.notes ?? null,
    });
  },

  async update(id: string, input: unknown): Promise<Result<OrgPromoter>> {
    const guard = await guardPromoterInOrg(id, ORG_WRITE_ROLES);
    if (!guard.ok) return err(guard.error);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");

    // If commissionType is being changed, validate alignment with the config —
    // either the one sent in this payload or the current persisted value.
    let commissionConfig: CommissionConfig | undefined = parsed.data.commissionConfig;
    if (parsed.data.commissionType !== undefined) {
      const effectiveConfig =
        parsed.data.commissionConfig === undefined
          ? guard.value.promoter.commissionConfig
          : parsed.data.commissionConfig;
      const cfg = normalizeCommission(parsed.data.commissionType, effectiveConfig);
      if (!cfg.ok) return err(cfg.error);
      commissionConfig = cfg.value;
    }

    return repo.update(id, guard.value.ctx.orgId, {
      name: parsed.data.name,
      defaultCommissionPct: parsed.data.defaultCommissionPct,
      commissionType: parsed.data.commissionType,
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
};
