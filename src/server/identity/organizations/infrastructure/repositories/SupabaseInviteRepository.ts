import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../../ports/InviteRepository";
import type {
  OrgInvite,
  OrgInviteRole,
  OrgInvitePreview,
  InviteScopeType,
} from "../../domain/Invite";
import { inviteStatus } from "../../domain/Invite";

type Row = {
  id: string;
  invited_by: string;
  email: string | null;
  phone: string | null;
  role: OrgInviteRole;
  scope_type: InviteScopeType;
  scope_id: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

const toDomain = (r: Row): OrgInvite => ({
  id: r.id,
  scope: { type: r.scope_type, id: r.scope_id },
  invitedBy: r.invited_by,
  email: r.email,
  phone: r.phone,
  role: r.role,
  token: r.token,
  expiresAt: r.expires_at,
  acceptedAt: r.accepted_at,
  acceptedBy: r.accepted_by,
  revokedAt: r.revoked_at,
  createdAt: r.created_at,
});

// Resuelve un nombre humano para mostrar el scope al invitado en el preview.
const resolveScopeLabel = async (
  scope: { type: InviteScopeType; id: string },
): Promise<string> => {
  const db = supabaseAdmin();
  if (scope.type === "organization") {
    const { data } = await db
      .from("organizations")
      .select("name")
      .eq("id", scope.id)
      .maybeSingle<{ name: string }>();
    return data?.name ?? "una marca";
  }
  if (scope.type === "legal_entity") {
    const { data } = await db
      .from("legal_entities")
      .select("name")
      .eq("id", scope.id)
      .maybeSingle<{ name: string }>();
    return data?.name ?? "una razón social";
  }
  // portfolio: el nombre del owner
  const { data } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", scope.id)
    .maybeSingle<{ full_name: string | null }>();
  return data?.full_name ? `Portafolio de ${data.full_name}` : "Portafolio";
};

export const supabaseInviteRepository: InviteRepository = {
  async create(input): Promise<Result<OrgInvite>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("invites")
      .insert({
        invited_by: input.invitedBy,
        email: input.email,
        phone: input.phone,
        role: input.role,
        scope_type: input.scope.type,
        scope_id: input.scope.id,
      })
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "invite_create_failed");
    return ok(toDomain(data));
  },

  async findByToken(token): Promise<OrgInvitePreview | null> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("invites")
      .select(
        "id, role, email, expires_at, accepted_at, revoked_at, scope_type, scope_id, invited_by, profiles!invites_invited_by_fkey(full_name)",
      )
      .eq("token", token)
      .maybeSingle();
    if (!data) return null;
    type Joined = {
      id: string;
      role: OrgInviteRole;
      email: string | null;
      expires_at: string;
      accepted_at: string | null;
      revoked_at: string | null;
      scope_type: InviteScopeType;
      scope_id: string;
      profiles: { full_name: string | null } | null;
    };
    const row = data as unknown as Joined;
    const scope = { type: row.scope_type, id: row.scope_id };
    const scopeLabel = await resolveScopeLabel(scope);
    return {
      id: row.id,
      role: row.role,
      expiresAt: row.expires_at,
      status: inviteStatus({
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
        expiresAt: row.expires_at,
      }),
      scope,
      scopeLabel,
      inviteEmail: row.email?.trim().toLowerCase() ?? null,
      invitedBy: {
        fullName: row.profiles?.full_name ?? null,
      },
    };
  },

  async findRowByToken(token): Promise<OrgInvite | null> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("invites")
      .select("*")
      .eq("token", token)
      .maybeSingle<Row>();
    return data ? toDomain(data) : null;
  },

  async findById(id): Promise<OrgInvite | null> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("invites")
      .select("*")
      .eq("id", id)
      .maybeSingle<Row>();
    return data ? toDomain(data) : null;
  },

  async listForOrg(orgId): Promise<OrgInvite[]> {
    const db = supabaseAdmin();
    // Resuelve la razón social y el owner para incluir invites escalados.
    const { data: orgRow } = await db
      .from("organizations")
      .select("id, legal_entity_id, legal_entities!inner(created_by)")
      .eq("id", orgId)
      .maybeSingle();
    if (!orgRow) return [];
    type OrgJoined = { id: string; legal_entity_id: string; legal_entities: { created_by: string } };
    const o = orgRow as unknown as OrgJoined;

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await db
      .from("invites")
      .select("*")
      .or(
        [
          `and(scope_type.eq.organization,scope_id.eq.${o.id})`,
          `and(scope_type.eq.legal_entity,scope_id.eq.${o.legal_entity_id})`,
          `and(scope_type.eq.portfolio,scope_id.eq.${o.legal_entities.created_by})`,
        ].join(","),
      )
      .or(`accepted_at.is.null,accepted_at.gte.${cutoff}`)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => toDomain(r as Row));
  },

  async markAccepted(input): Promise<Result<OrgInvite>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: input.acceptedBy,
      })
      .eq("id", input.id)
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "invite_accept_failed");
    return ok(toDomain(data));
  },

  async revoke(input): Promise<Result<void>> {
    const db = supabaseAdmin();
    const { error } = await db
      .from("invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", input.id);
    if (error) return err(error.message);
    return ok(undefined);
  },
};
