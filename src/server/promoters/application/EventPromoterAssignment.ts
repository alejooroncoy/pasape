import crypto from "node:crypto";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

export type EventPromoterAssignment = {
  promoterLinkId: string;
  orgPromoterId: string;
  name: string;
  whatsapp: string | null;
  profileId: string | null;
  defaultCommissionPct: number;
  eventCommissionPct: number;
  code: string;
  url: string;
  active: boolean;
};

const slugCode = (full: string) =>
  full
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 30) || crypto.randomBytes(4).toString("hex");

export const listAssignmentsForEvent = async (
  eventId: string,
  origin: string,
): Promise<EventPromoterAssignment[]> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("promoter_links")
    .select(
      "id, code, commission_pct, active, org_promoter_id, promoter_id, org_promoter:org_promoters(id, name, whatsapp, default_commission_pct, profile_id)",
    )
    .eq("event_id", eventId)
    .not("org_promoter_id", "is", null);

  type Row = {
    id: string;
    code: string;
    commission_pct: number;
    active: boolean;
    org_promoter_id: string;
    promoter_id: string | null;
    org_promoter: {
      id: string;
      name: string;
      whatsapp: string | null;
      default_commission_pct: number;
      profile_id: string | null;
    } | null;
  };

  return ((data as unknown as Row[] | null) ?? [])
    .filter((r) => r.org_promoter !== null)
    .map((r) => ({
      promoterLinkId: r.id,
      orgPromoterId: r.org_promoter_id,
      name: r.org_promoter!.name,
      whatsapp: r.org_promoter!.whatsapp,
      profileId: r.promoter_id ?? r.org_promoter!.profile_id,
      defaultCommissionPct: r.org_promoter!.default_commission_pct,
      eventCommissionPct: r.commission_pct,
      code: r.code,
      url: `${origin.replace(/\/$/, "")}/r/${r.code}`,
      active: r.active,
    }));
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
    .select("id, name, default_commission_pct, profile_id, organization_id")
    .in("id", orgPromoterIds)
    .is("deleted_at", null);
  const pooled =
    (pool as Array<{
      id: string;
      name: string;
      default_commission_pct: number;
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
    commission_pct: p.default_commission_pct,
    active: true,
  }));
  const { data, error } = await db
    .from("promoter_links")
    .insert(rows)
    .select(
      "id, code, commission_pct, active, org_promoter_id, promoter_id, org_promoter:org_promoters(id, name, whatsapp, default_commission_pct, profile_id)",
    );
  if (error || !data) return err(error?.message ?? "assignment_failed");

  type Row = {
    id: string;
    code: string;
    commission_pct: number;
    active: boolean;
    org_promoter_id: string;
    promoter_id: string | null;
    org_promoter: {
      id: string;
      name: string;
      whatsapp: string | null;
      default_commission_pct: number;
      profile_id: string | null;
    } | null;
  };
  return ok(
    (data as unknown as Row[])
      .filter((r) => r.org_promoter !== null)
      .map((r) => ({
        promoterLinkId: r.id,
        orgPromoterId: r.org_promoter_id,
        name: r.org_promoter!.name,
        whatsapp: r.org_promoter!.whatsapp,
        profileId: r.promoter_id ?? r.org_promoter!.profile_id,
        defaultCommissionPct: r.org_promoter!.default_commission_pct,
        eventCommissionPct: r.commission_pct,
        code: r.code,
        url: `/r/${r.code}`,
        active: r.active,
      })),
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
  commissionPct: number,
): Promise<Result<true>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("promoter_links")
    .update({ commission_pct: commissionPct })
    .eq("id", promoterLinkId)
    .eq("event_id", eventId);
  if (error) return err(error.message);
  return ok(true);
};
