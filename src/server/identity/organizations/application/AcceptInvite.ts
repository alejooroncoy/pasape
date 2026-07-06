import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";
import type { OrganizationRepository } from "../ports/OrganizationRepository";
import type { Organization } from "../domain/Organization";
import { inviteStatus } from "../domain/Invite";

type Deps = {
  invites: InviteRepository;
  memberships: MembershipRepository;
  orgs: OrganizationRepository;
};

type Input = { token: string; profileId: string; profileEmail: string | null };

const normEmail = (raw: string | null | undefined): string | null => {
  const e = raw?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
};

export const acceptInvite = async (
  { invites, memberships, orgs }: Deps,
  input: Input,
): Promise<Result<{ org: Organization | null }>> => {
  const invite = await invites.findRowByToken(input.token);
  if (!invite) return err("invite_not_found");

  const status = inviteStatus(invite);
  if (status !== "pending") return err(`invite_${status}`);

  if (invite.role === "door") return err("invite_role_deprecated");

  const invitedEmail = normEmail(invite.email);
  if (invitedEmail) {
    // Invite por email: la cuenta de Google que acepta debe ser la invitada.
    const accepterEmail =
      normEmail(input.profileEmail) ??
      normEmail(
        (
          await supabaseAdmin()
            .from("profiles")
            .select("email")
            .eq("id", input.profileId)
            .maybeSingle<{ email: string | null }>()
        ).data?.email,
      );

    if (!accepterEmail) return err("invite_sign_in_with_email");
    if (accepterEmail !== invitedEmail) return err("invite_wrong_account");
  } else if (invite.phone) {
    // Invite por WhatsApp (sin email): no hay cuenta con la que hacer match,
    // así que la prueba de posesión del canal es el OTP del teléfono en vez
    // del email. Hoy la creación de invites por WhatsApp está apagada por
    // TEAM_INVITE_WHATSAPP_ENABLED — este branch queda listo para cuando se
    // reactive (y cubre invites legacy que ya existan con solo teléfono).
    if (!invite.phoneVerifiedAt) return err("phone_verification_required");
  } else {
    // No debería pasar (constraint DB: email o phone requerido), pero por
    // las dudas no dejamos aceptar un invite sin ninguna prueba de posesión.
    return err("invite_email_required");
  }

  const upserted = await memberships.upsert({
    profileId: input.profileId,
    role: invite.role,
    scopeType: invite.scope.type,
    scopeId: invite.scope.id,
  });
  if (!upserted.ok) return err(upserted.error);

  const accepted = await invites.markAccepted({
    id: invite.id,
    acceptedBy: input.profileId,
  });
  if (!accepted.ok) return err(accepted.error);

  const reachable = await orgs.listByMember(input.profileId);
  let target: Organization | null = null;
  if (invite.scope.type === "organization") {
    target = reachable.find((o) => o.id === invite.scope.id) ?? null;
  } else if (invite.scope.type === "legal_entity") {
    target = reachable.find((o) => o.legalEntityId === invite.scope.id) ?? reachable[0] ?? null;
  } else {
    target = reachable[0] ?? null;
  }

  return ok({ org: target });
};
