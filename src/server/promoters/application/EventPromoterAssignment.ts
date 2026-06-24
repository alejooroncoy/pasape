import crypto from "node:crypto";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { CommissionConfig, CommissionType } from "../domain/OrgPromoter";
import { coerceCommissionConfig } from "./CommissionResolver";

export type EventPromoterAssignment = {
  promoterLinkId: string;
  orgPromoterId: string;
  name: string;
  whatsapp: string | null;
  profileId: string | null;
  code: string;
  url: string;
  active: boolean;
  // ── Valores EFECTIVOS (lo que realmente aplica tras heredar evento/marca) ──
  /** Tipo de comisión efectivo: % simple, hitos en efectivo o especie. */
  commissionType: CommissionType;
  /** % efectivo (solo relevante si commissionType === "percentage"). */
  effectiveCommissionPct: number;
  /** Cupo de ventas efectivo. null = sin tope. */
  effectiveQuota: number | null;
  /** Cupo de invitados efectivo. null = sin tope. */
  effectiveGuestQuota: number | null;
  // ── Marcas de personalización (el promotor tiene valor propio, no hereda) ──
  commissionCustom: boolean;
  quotaCustom: boolean;
  guestQuotaCustom: boolean;
  // ── Valores propios del link (para el detalle: editar/limpiar a heredar) ──
  /** Tipo de comisión propio del promotor (null = hereda). */
  ownCommissionType: CommissionType | null;
  ownCommissionPct: number | null;
  /** Config de hitos/especie propia del promotor (override). null = hereda. */
  ownCommissionConfig: CommissionConfig | null;
  ownQuota: number | null;
  ownGuestQuota: number | null;
};

const slugCode = (full: string) =>
  full
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 30) || crypto.randomBytes(4).toString("hex");

const LINK_SELECT =
  "id, code, commission_pct, commission_type, commission_config_override, quota, guest_list_quota, active, org_promoter_id, promoter_id, org_promoter:org_promoters(id, name, whatsapp, default_commission_pct, commission_type, profile_id)";

type LinkRow = {
  id: string;
  code: string;
  commission_pct: number | null;
  commission_type: CommissionType | null;
  commission_config_override: unknown;
  quota: number | null;
  guest_list_quota: number | null;
  active: boolean;
  org_promoter_id: string;
  promoter_id: string | null;
  org_promoter: {
    id: string;
    name: string;
    whatsapp: string | null;
    default_commission_pct: number;
    commission_type: CommissionType;
    profile_id: string | null;
  } | null;
};

type EventScheme = {
  commissionType: CommissionType | null;
  commissionPct: number | null;
  defaultQuota: number | null;
  defaultGuestQuota: number | null;
};

const fetchEventScheme = async (
  db: ReturnType<typeof supabaseAdmin>,
  eventId: string,
): Promise<EventScheme> => {
  const { data } = await db
    .from("events")
    .select(
      "promoter_commission_type, promoter_commission_pct, promoter_default_quota, promoter_default_guest_list_quota",
    )
    .eq("id", eventId)
    .maybeSingle<{
      promoter_commission_type: CommissionType | null;
      promoter_commission_pct: number | null;
      promoter_default_quota: number | null;
      promoter_default_guest_list_quota: number | null;
    }>();
  return {
    commissionType: data?.promoter_commission_type ?? null,
    commissionPct: data?.promoter_commission_pct ?? null,
    defaultQuota: data?.promoter_default_quota ?? null,
    defaultGuestQuota: data?.promoter_default_guest_list_quota ?? null,
  };
};

// Construye el assignment resolviendo la herencia link → evento → marca.
const buildAssignment = (
  r: LinkRow,
  scheme: EventScheme,
  origin: string,
): EventPromoterAssignment => {
  const op = r.org_promoter!;
  // Tipo efectivo: propio del promotor → esquema del evento → marca.
  const effectiveType = r.commission_type ?? scheme.commissionType ?? op.commission_type;
  return {
    promoterLinkId: r.id,
    orgPromoterId: r.org_promoter_id,
    name: op.name,
    whatsapp: op.whatsapp,
    profileId: r.promoter_id ?? op.profile_id,
    code: r.code,
    url: `${origin.replace(/\/$/, "")}/r/${r.code}`,
    active: r.active,
    commissionType: effectiveType,
    effectiveCommissionPct: r.commission_pct ?? scheme.commissionPct ?? op.default_commission_pct,
    // -1 = personalizado a "sin tope" (no hereda el default); null = hereda.
    effectiveQuota: r.quota === -1 ? null : r.quota ?? scheme.defaultQuota,
    effectiveGuestQuota:
      r.guest_list_quota === -1 ? null : r.guest_list_quota ?? scheme.defaultGuestQuota,
    commissionCustom:
      r.commission_pct != null || r.commission_config_override != null || r.commission_type != null,
    quotaCustom: r.quota != null,
    guestQuotaCustom: r.guest_list_quota != null,
    ownCommissionType: r.commission_type,
    ownCommissionPct: r.commission_pct,
    ownCommissionConfig: coerceCommissionConfig(
      r.commission_type ?? effectiveType,
      r.commission_config_override,
    ),
    ownQuota: r.quota,
    ownGuestQuota: r.guest_list_quota,
  };
};

export const listAssignmentsForEvent = async (
  eventId: string,
  origin: string,
): Promise<EventPromoterAssignment[]> => {
  const db = supabaseAdmin();
  const scheme = await fetchEventScheme(db, eventId);
  const { data } = await db
    .from("promoter_links")
    .select(LINK_SELECT)
    .eq("event_id", eventId)
    .not("org_promoter_id", "is", null);

  return ((data as unknown as LinkRow[] | null) ?? [])
    .filter((r) => r.org_promoter !== null)
    .map((r) => buildAssignment(r, scheme, origin));
};

export const assignOrgPromotersToEvent = async (
  eventId: string,
  organizationId: string,
  orgPromoterIds: string[],
): Promise<Result<EventPromoterAssignment[]>> => {
  if (orgPromoterIds.length === 0) return ok([]);
  const db = supabaseAdmin();

  // Cargo los promoters del pool para validar que sean de la org y obtener metadata.
  const { data: pool } = await db
    .from("org_promoters")
    .select("id, name, default_commission_pct, commission_type, profile_id, organization_id")
    .in("id", orgPromoterIds)
    .is("deleted_at", null);
  const pooled =
    (pool as Array<{
      id: string;
      name: string;
      default_commission_pct: number;
      commission_type: CommissionType;
      profile_id: string | null;
      organization_id: string;
    }> | null) ?? [];
  const valid = pooled.filter((p) => p.organization_id === organizationId);
  if (valid.length === 0) return err("no_valid_promoters");

  // Cargo asignaciones existentes para este evento, así no duplico.
  const { data: existing } = await db
    .from("promoter_links")
    .select("id, org_promoter_id")
    .eq("event_id", eventId)
    .in("org_promoter_id", valid.map((p) => p.id));
  const existingIds = new Set(
    ((existing as Array<{ org_promoter_id: string }> | null) ?? []).map((r) => r.org_promoter_id),
  );

  // Inserto solo los nuevos.
  const toInsert = valid.filter((p) => !existingIds.has(p.id));
  if (toInsert.length === 0) return ok([]);
  const rows = toInsert.map((p) => ({
    event_id: eventId,
    promoter_id: p.profile_id, // null si todavía no firmó cuenta
    org_promoter_id: p.id,
    code: `${slugCode(p.name)}-${crypto.randomBytes(2).toString("hex")}`,
    // null = sin comisión propia: hereda del esquema del evento (y este de la
    // marca). Solo se setea un valor si el organizador personaliza a este promotor.
    commission_pct: null,
    active: true,
  }));
  const { data, error } = await db
    .from("promoter_links")
    .insert(rows)
    .select(LINK_SELECT);
  if (error || !data) return err(error?.message ?? "assignment_failed");

  const scheme = await fetchEventScheme(db, eventId);
  return ok(
    (data as unknown as LinkRow[])
      .filter((r) => r.org_promoter !== null)
      .map((r) => buildAssignment(r, scheme, "")),
  );
};

export const removeAssignment = async (
  promoterLinkId: string,
  eventId: string,
): Promise<Result<true>> => {
  const db = supabaseAdmin();
  // Si el link tiene órdenes pagadas, no lo borramos: lo deshabilitamos.
  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("promoter_link_id", promoterLinkId)
    .eq("status", "paid");
  if ((count ?? 0) > 0) {
    const { error } = await db
      .from("promoter_links")
      .update({ active: false })
      .eq("id", promoterLinkId)
      .eq("event_id", eventId);
    if (error) return err(error.message);
    return ok(true);
  }
  const { error } = await db
    .from("promoter_links")
    .delete()
    .eq("id", promoterLinkId)
    .eq("event_id", eventId);
  if (error) return err(error.message);
  return ok(true);
};

export const updateAssignmentCommission = async (
  promoterLinkId: string,
  eventId: string,
  fields: {
    commissionPct?: number | null;
    commissionType?: CommissionType | null;
    commissionConfig?: CommissionConfig | null;
    quota?: number | null;
    guestListQuota?: number | null;
  },
): Promise<Result<true>> => {
  const db = supabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (fields.commissionPct !== undefined) patch.commission_pct = fields.commissionPct;
  if (fields.commissionType !== undefined) patch.commission_type = fields.commissionType;
  if (fields.commissionConfig !== undefined)
    patch.commission_config_override = fields.commissionConfig;
  if (fields.quota !== undefined) patch.quota = fields.quota;
  if (fields.guestListQuota !== undefined) patch.guest_list_quota = fields.guestListQuota;
  if (Object.keys(patch).length === 0) return ok(true);
  const { error } = await db
    .from("promoter_links")
    .update(patch)
    .eq("id", promoterLinkId)
    .eq("event_id", eventId);
  if (error) return err(error.message);
  return ok(true);
};
