import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  MembershipRepository,
  OrgAccessGrant,
  ScopedMembership,
} from "../../ports/MembershipRepository";
import type { OrgRole } from "../../domain/Organization";
import type { InviteScopeType } from "../../domain/Invite";

type Row = {
  profile_id: string;
  role: OrgRole;
  scope_type: InviteScopeType;
  scope_id: string;
};

export const supabaseMembershipRepository: MembershipRepository = {
  async upsert(input): Promise<Result<ScopedMembership>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("memberships")
      .upsert(
        {
          profile_id: input.profileId,
          role: input.role,
          scope_type: input.scopeType,
          scope_id: input.scopeId,
        },
        { onConflict: "profile_id,scope_type,scope_id" },
      )
      .select("profile_id, role, scope_type, scope_id")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "membership_upsert_failed");
    return ok({
      profileId: data.profile_id,
      role: data.role,
      scopeType: data.scope_type,
      scopeId: data.scope_id,
    });
  },

  async hasAdminOver({ profileId, scopeType, scopeId }): Promise<boolean> {
    const db = supabaseAdmin();

    // owner del portfolio (el profile mismo)
    if (scopeType === "portfolio" && scopeId === profileId) return true;

    // owner de la razón social
    if (scopeType === "legal_entity") {
      const { data } = await db
        .from("legal_entities")
        .select("created_by")
        .eq("id", scopeId)
        .maybeSingle<{ created_by: string }>();
      if (data?.created_by === profileId) return true;
    }

    // Membership directo con rol owner|admin sobre el scope exacto…
    const { data: direct } = await db
      .from("memberships")
      .select("role")
      .eq("profile_id", profileId)
      .eq("scope_type", scopeType)
      .eq("scope_id", scopeId)
      .maybeSingle<{ role: OrgRole }>();
    if (direct && ["owner", "admin"].includes(direct.role)) return true;

    // …o membership en un scope que cubre el target (portfolio del owner,
    // legal_entity para una org, etc.)
    if (scopeType === "organization") {
      const { data: org } = await db
        .from("organizations")
        .select("legal_entity_id, legal_entities!inner(created_by)")
        .eq("id", scopeId)
        .maybeSingle();
      if (org) {
        type J = { legal_entity_id: string; legal_entities: { created_by: string } };
        const o = org as unknown as J;
        const { data: escalated } = await db
          .from("memberships")
          .select("role, scope_type")
          .eq("profile_id", profileId)
          .or(
            [
              `and(scope_type.eq.legal_entity,scope_id.eq.${o.legal_entity_id})`,
              `and(scope_type.eq.portfolio,scope_id.eq.${o.legal_entities.created_by})`,
            ].join(","),
          );
        for (const r of (escalated ?? []) as Array<{ role: OrgRole }>) {
          if (["owner", "admin"].includes(r.role)) return true;
        }
      }
    } else if (scopeType === "legal_entity") {
      const { data: le } = await db
        .from("legal_entities")
        .select("created_by")
        .eq("id", scopeId)
        .maybeSingle<{ created_by: string }>();
      if (le) {
        const { data: portfolio } = await db
          .from("memberships")
          .select("role")
          .eq("profile_id", profileId)
          .eq("scope_type", "portfolio")
          .eq("scope_id", le.created_by)
          .maybeSingle<{ role: OrgRole }>();
        if (portfolio && ["owner", "admin"].includes(portfolio.role)) return true;
      }
    }

    return false;
  },

  async listPeopleWithAccessToOrg(orgId): Promise<Result<OrgAccessGrant[]>> {
    const db = supabaseAdmin();

    // Resolver la org → legal_entity → portfolio_owner
    const { data: org, error: orgErr } = await db
      .from("organizations")
      .select("id, legal_entity_id, legal_entities!inner(id, created_by)")
      .eq("id", orgId)
      .maybeSingle();
    if (orgErr || !org) return err(orgErr?.message ?? "org_not_found");
    type OrgJoin = {
      id: string;
      legal_entity_id: string;
      legal_entities: { id: string; created_by: string };
    };
    const o = org as unknown as OrgJoin;
    const legalEntityId = o.legal_entity_id;
    const portfolioOwnerId = o.legal_entities.created_by;

    // Memberships que conceden acceso por cualquiera de los 3 caminos.
    const { data: rows, error: mErr } = await db
      .from("memberships")
      .select("profile_id, role, scope_type, scope_id")
      .or(
        [
          `and(scope_type.eq.organization,scope_id.eq.${orgId})`,
          `and(scope_type.eq.legal_entity,scope_id.eq.${legalEntityId})`,
          `and(scope_type.eq.portfolio,scope_id.eq.${portfolioOwnerId})`,
        ].join(","),
      );
    if (mErr) return err(mErr.message);

    const memberships = (rows ?? []) as Array<{
      profile_id: string;
      role: OrgRole;
      scope_type: InviteScopeType;
      scope_id: string;
    }>;

    // Owner de la razón social (acceso implícito como owner).
    const ownerGrant: OrgAccessGrant = {
      profileId: portfolioOwnerId,
      fullName: null,
      email: null,
      role: "owner",
      via: "legal_entity_owner",
      scopeId: legalEntityId,
    };

    const grantsByProfile = new Map<string, OrgAccessGrant>();
    grantsByProfile.set(portfolioOwnerId, ownerGrant);

    // Priorizar el scope más específico cuando un profile aparece varias veces.
    // "event" nunca aparece en `memberships` (vive en event_co_organizers) —
    // se excluye del tipo en vez de inventarle una prioridad sin sentido acá.
    const specificity: Record<Exclude<InviteScopeType, "event">, number> = {
      organization: 1,
      legal_entity: 2,
      portfolio: 3,
    };
    for (const r of memberships) {
      const existing = grantsByProfile.get(r.profile_id);
      const incoming: OrgAccessGrant = {
        profileId: r.profile_id,
        fullName: null,
        email: null,
        role: r.role,
        via: r.scope_type,
        scopeId: r.scope_id,
      };
      if (
        !existing ||
        existing.via === "legal_entity_owner" ||
        specificity[r.scope_type as Exclude<InviteScopeType, "event">] <
          specificity[existing.via as Exclude<InviteScopeType, "event">]
      ) {
        // Conservar el "owner" implícito si el profile es el dueño y el row no es mejor.
        if (existing?.via === "legal_entity_owner" && r.profile_id === portfolioOwnerId) {
          continue;
        }
        grantsByProfile.set(r.profile_id, incoming);
      }
    }

    // Hidratar fullName/email.
    const ids = Array.from(grantsByProfile.keys());
    if (ids.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      for (const p of (profiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>) {
        const g = grantsByProfile.get(p.id);
        if (g) {
          g.fullName = p.full_name;
          g.email = p.email;
        }
      }
    }

    return ok(Array.from(grantsByProfile.values()));
  },
};
