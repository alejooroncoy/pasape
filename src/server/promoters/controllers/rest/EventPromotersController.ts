import { z } from "zod";
import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getEventBySlug } from "@/server/events/application/GetEventBySlug";
import { supabaseEventRepository } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import {
  assignOrgPromotersToEvent,
  listAssignmentsForEvent,
  removeAssignment,
  updateAssignmentCommission,
  type EventPromoterAssignment,
} from "../../application/EventPromoterAssignment";
import { listSalesForPromoterLink, type PromoterLinkSale } from "../../application/PromoterDetail";

const repo = supabaseEventRepository;

const ALLOWED_ROLES = ["owner", "admin", "editor"] as const;

type EventCtx = {
  eventId: string;
  organizationId: string;
};

const guard = async (slug: string): Promise<Result<EventCtx>> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err(auth.error);
  const detail = await getEventBySlug({ repo }, slug);
  if (!detail) return err("not_found");
  const db = supabaseAdmin();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("profile_id", auth.value.profileId)
    .eq("scope_type", "organization")
    .eq("scope_id", detail.event.organizationId)
    .maybeSingle<{ role: string }>();
  if (!membership || !ALLOWED_ROLES.includes(membership.role as (typeof ALLOWED_ROLES)[number])) {
    return err("forbidden");
  }
  return ok({ eventId: detail.event.id, organizationId: detail.event.organizationId });
};

const sanitizeHost = (raw: string): string => {
  // Defensa contra hosts que vienen con protocolo (ej: "http://localhost:3001"
  // en dev en vez de "localhost:3001"). Si trae "://" o "http", extrae solo el
  // host:port real para evitar doble-prefijo "http://localhost:3001http://...".
  let h = raw.trim();
  if (h.startsWith("http://")) h = h.slice("http://".length);
  else if (h.startsWith("https://")) h = h.slice("https://".length);
  // Si todavía hay un "/" después de limpiar protocolo, cortar el path.
  const slashAt = h.indexOf("/");
  if (slashAt > -1) h = h.slice(0, slashAt);
  return h || "pasape.lat";
};

const resolveOrigin = async () => {
  // Preferir el env explícito si está, evita ambigüedad con headers de dev.
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = await headers();
  const host = sanitizeHost(h.get("x-forwarded-host") ?? h.get("host") ?? "pasape.lat");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

export const EventPromotersController = {
  async list(slug: string): Promise<Result<EventPromoterAssignment[]>> {
    const g = await guard(slug);
    if (!g.ok) return err(g.error);
    const origin = await resolveOrigin();
    return ok(await listAssignmentsForEvent(g.value.eventId, origin));
  },

  async assign(slug: string, input: unknown): Promise<Result<EventPromoterAssignment[]>> {
    const g = await guard(slug);
    if (!g.ok) return err(g.error);
    const parsed = z
      .object({ orgPromoterIds: z.array(z.string().uuid()).min(1) })
      .safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return assignOrgPromotersToEvent(
      g.value.eventId,
      g.value.organizationId,
      parsed.data.orgPromoterIds,
    );
  },

  async updateCommission(
    slug: string,
    promoterLinkId: string,
    input: unknown,
  ): Promise<Result<true>> {
    const g = await guard(slug);
    if (!g.ok) return err(g.error);
    const parsed = z
      .object({
        commissionPct: z.number().int().min(0).max(100).optional(),
        quota: z.number().int().min(1).nullable().optional(),
      })
      .safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateAssignmentCommission(promoterLinkId, g.value.eventId, parsed.data);
  },

  async remove(slug: string, promoterLinkId: string): Promise<Result<true>> {
    const g = await guard(slug);
    if (!g.ok) return err(g.error);
    return removeAssignment(promoterLinkId, g.value.eventId);
  },

  async sales(slug: string, promoterLinkId: string): Promise<Result<PromoterLinkSale[]>> {
    const g = await guard(slug);
    if (!g.ok) return err(g.error);
    return ok(await listSalesForPromoterLink(promoterLinkId, g.value.eventId));
  },
};
