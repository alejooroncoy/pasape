import { err, ok, type Result } from "@/server/_shared/result";
import type { PromoterClaimRepository } from "../ports/PromoterClaimRepository";
import { supabaseOrgPromoterRepository } from "@/server/promoters/infrastructure/repositories/SupabaseOrgPromoterRepository";
import { supabaseMembershipRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseMembershipRepository";
import { promoterInviteWhatsAppSender } from "@/server/notifications/infrastructure/PromoterInviteWhatsAppSender";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

type Deps = { claims: PromoterClaimRepository };

export type SendPromoterInviteInput = {
  callerProfileId: string;
  orgPromoterId: string;
};

export type SendPromoterInviteOutput = {
  delivered: boolean;
  expiresAt: string;
  whatsapp: string;
};

const getPrimaryEventTitle = async (
  orgPromoterId: string,
): Promise<string> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("promoter_links")
    .select("events:event_id(title)")
    .eq("org_promoter_id", orgPromoterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ events: { title: string } | null }>();
  return data?.events?.title ?? "tu próximo evento";
};

const getOrgName = async (orgId: string): Promise<string> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle<{ name: string }>();
  return data?.name ?? "Tu marca";
};

export const sendPromoterInvite = async (
  { claims }: Deps,
  input: SendPromoterInviteInput,
): Promise<Result<SendPromoterInviteOutput>> => {
  const promoter = await supabaseOrgPromoterRepository.findById(input.orgPromoterId);
  if (!promoter) return err("not_found");
  if (promoter.profileId) return err("already_claimed");
  const whatsapp = promoter.whatsapp ?? "";
  if (whatsapp.replace(/\D/g, "").length < 9) {
    return err("missing_whatsapp");
  }

  // Auth: el caller debe ser owner/admin/editor de la org del promotor.
  const allowed = await supabaseMembershipRepository.hasAdminOver({
    profileId: input.callerProfileId,
    scopeType: "organization",
    scopeId: promoter.organizationId,
  });
  if (!allowed) return err("forbidden");

  const tokenResult = await claims.getOrRefreshToken(
    promoter.id,
    promoter.organizationId,
  );
  if (!tokenResult.ok) return err(tokenResult.error);

  const orgName = await getOrgName(promoter.organizationId);
  const eventTitle = await getPrimaryEventTitle(promoter.id);

  const delivered = await promoterInviteWhatsAppSender.send({
    to: whatsapp,
    promoterName: promoter.name,
    orgName,
    eventTitle,
    claimToken: tokenResult.value.token,
  });

  return ok({
    delivered,
    expiresAt: tokenResult.value.expiresAt,
    whatsapp,
  });
};
