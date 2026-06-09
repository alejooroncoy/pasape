import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { OrganizationRepository } from "@/server/identity/organizations/ports/OrganizationRepository";
import type { Organization, OrgMembership, OrgRole } from "@/server/identity/organizations/domain/Organization";

type Row = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  description: string | null;
  instagram: string | null;
  legal_entity_id: string;
  timezone: string;
  created_by: string;
  created_at: string;
};

const toDomain = (r: Row): Organization => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  logoUrl: r.logo_url,
  brandColor: r.brand_color,
  description: r.description ?? null,
  instagram: r.instagram ?? null,
  legalEntityId: r.legal_entity_id,
  timezone: r.timezone,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

// Prioridad de scope para resolver el rol efectivo cuando un miembro
// tiene acceso por más de uno (más específico gana).
const SCOPE_RANK: Record<string, number> = {
  organization: 1,
  legal_entity: 2,
  portfolio: 3,
};
const moreSpecific = (a: { scopeType: string }, b: { scopeType: string }) =>
  SCOPE_RANK[a.scopeType] - SCOPE_RANK[b.scopeType];

export const supabaseOrganizationRepository: OrganizationRepository = {
  async create(input): Promise<Result<Organization>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("organizations")
      .insert({
        name: input.name,
        slug: input.slug,
        logo_url: input.logoUrl ?? null,
        legal_entity_id: input.legalEntityId,
        created_by: input.createdBy,
      })
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "org_create_failed");

    const membership = await db
      .from("memberships")
      .insert({
        profile_id: input.createdBy,
        role: "owner",
        scope_type: "organization",
        scope_id: data.id,
      });
    if (membership.error) return err(membership.error.message);

    return ok(toDomain(data));
  },

  async findBySlug(slug) {
    const db = supabaseAdmin();
    const { data } = await db.from("organizations").select("*").eq("slug", slug).maybeSingle<Row>();
    return data ? toDomain(data) : null;
  },

  async update(input): Promise<Result<Organization>> {
    const db = supabaseAdmin();
    // Verifica que el caller administre la org (owner|admin|editor) vía el
    // resolvedor de roles efectivos por scope.
    const mine = await this.listByMember(input.callerId);
    const target = mine.find((o) => o.id === input.id);
    if (!target) return err("forbidden");
    if (!["owner", "admin", "editor"].includes(target.role)) return err("forbidden");

    // Solo se incluyen las columnas presentes en el patch (undefined = no tocar).
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
    if (input.brandColor !== undefined) patch.brand_color = input.brandColor;
    if (input.description !== undefined) patch.description = input.description;
    if (input.instagram !== undefined) patch.instagram = input.instagram;
    if (Object.keys(patch).length === 0) {
      const fresh = await this.findBySlug(target.slug);
      return fresh ? ok(fresh) : err("org_not_found");
    }

    const { data, error } = await db
      .from("organizations")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single<Row>();
    if (error || !data) {
      // 23505 = unique_violation (slug duplicado).
      if (error?.code === "23505") return err("slug_taken");
      return err(error?.message ?? "org_update_failed");
    }
    return ok(toDomain(data));
  },

  async listByMember(profileId): Promise<Array<Organization & { role: OrgRole }>> {
    const db = supabaseAdmin();
    const { data: rows } = await db
      .from("memberships")
      .select("scope_type, scope_id, role")
      .eq("profile_id", profileId);
    if (!rows || rows.length === 0) return [];

    const orgIds = new Set<string>();
    const legalEntityIds = new Set<string>();
    const portfolioOwnerIds = new Set<string>();
    type MRow = { scope_type: "organization" | "legal_entity" | "portfolio"; scope_id: string; role: OrgRole };
    const memberships = rows as unknown as MRow[];

    for (const m of memberships) {
      if (m.scope_type === "organization") orgIds.add(m.scope_id);
      else if (m.scope_type === "legal_entity") legalEntityIds.add(m.scope_id);
      else portfolioOwnerIds.add(m.scope_id);
    }

    // Resuelve orgs alcanzadas: directas + por legal_entity + por portfolio (vía legal_entities.created_by).
    const orgsById = new Map<string, Row>();

    if (orgIds.size > 0) {
      const { data } = await db.from("organizations").select("*").in("id", Array.from(orgIds));
      for (const r of (data ?? []) as Row[]) orgsById.set(r.id, r);
    }
    if (legalEntityIds.size > 0) {
      const { data } = await db
        .from("organizations")
        .select("*")
        .in("legal_entity_id", Array.from(legalEntityIds));
      for (const r of (data ?? []) as Row[]) orgsById.set(r.id, r);
    }
    if (portfolioOwnerIds.size > 0) {
      const { data: les } = await db
        .from("legal_entities")
        .select("id")
        .in("created_by", Array.from(portfolioOwnerIds));
      const leIds = (les ?? []).map((r: { id: string }) => r.id);
      if (leIds.length > 0) {
        const { data } = await db.from("organizations").select("*").in("legal_entity_id", leIds);
        for (const r of (data ?? []) as Row[]) orgsById.set(r.id, r);
      }
    }

    // Para asignar el rol efectivo, necesitamos saber qué scopes alcanzan cada org.
    const leOwners = new Map<string, string>(); // legal_entity_id → created_by
    if (orgsById.size > 0) {
      const leIds = Array.from(new Set(Array.from(orgsById.values()).map((o) => o.legal_entity_id)));
      const { data: les } = await db.from("legal_entities").select("id, created_by").in("id", leIds);
      for (const r of (les ?? []) as Array<{ id: string; created_by: string }>) {
        leOwners.set(r.id, r.created_by);
      }
    }

    // Orden determinista por fecha de creación (la marca más antigua primero).
    // Why: el frontend usa `orgs[0]` como default cuando el usuario aún no eligió
    // marca. Sin ORDER BY, `.in()` devuelve filas en orden arbitrario y el default
    // "primera marca" cambiaba entre requests. Ordenar acá lo fija.
    return Array.from(orgsById.values())
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((org) => {
      const candidates: Array<{ scopeType: string; role: OrgRole }> = [];
      for (const m of memberships) {
        if (m.scope_type === "organization" && m.scope_id === org.id) {
          candidates.push({ scopeType: "organization", role: m.role });
        } else if (m.scope_type === "legal_entity" && m.scope_id === org.legal_entity_id) {
          candidates.push({ scopeType: "legal_entity", role: m.role });
        } else if (
          m.scope_type === "portfolio" &&
          m.scope_id === leOwners.get(org.legal_entity_id)
        ) {
          candidates.push({ scopeType: "portfolio", role: m.role });
        }
      }
      candidates.sort(moreSpecific);
      return { ...toDomain(org), role: candidates[0]?.role ?? "reporter" };
    });
  },

  async countOwningMemberships(profileId): Promise<number> {
    // Cuenta orgs únicas alcanzadas con roles que dan operación real.
    const all = await this.listByMember(profileId);
    return all.filter((o) => ["owner", "admin", "editor"].includes(o.role)).length;
  },

  async setLastActiveOrg(profileId, orgId): Promise<void> {
    const db = supabaseAdmin();
    await db
      .from("profiles")
      .update({ last_active_org_id: orgId, last_active_org_at: new Date().toISOString() })
      .eq("id", profileId);
  },

  async getLastActiveOrgId(profileId): Promise<string | null> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("profiles")
      .select("last_active_org_id")
      .eq("id", profileId)
      .maybeSingle<{ last_active_org_id: string | null }>();
    return data?.last_active_org_id ?? null;
  },

  async listMembers(organizationId) {
    const db = supabaseAdmin();
    const { data: orgRow } = await db
      .from("organizations")
      .select("id, legal_entity_id, legal_entities!inner(created_by)")
      .eq("id", organizationId)
      .maybeSingle();
    if (!orgRow) return [];
    type OrgJoined = {
      id: string;
      legal_entity_id: string;
      legal_entities: { created_by: string };
    };
    const o = orgRow as unknown as OrgJoined;

    const { data } = await db
      .from("memberships")
      .select("profile_id, role, scope_type, scope_id, profiles:profiles!inner(id, full_name, email, avatar_url)")
      .or(
        [
          `and(scope_type.eq.organization,scope_id.eq.${o.id})`,
          `and(scope_type.eq.legal_entity,scope_id.eq.${o.legal_entity_id})`,
          `and(scope_type.eq.portfolio,scope_id.eq.${o.legal_entities.created_by})`,
        ].join(","),
      );
    if (!data) return [];

    type Joined = {
      profile_id: string;
      role: OrgRole;
      scope_type: "organization" | "legal_entity" | "portfolio";
      scope_id: string;
      profiles: {
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      };
    };
    const rows = data as unknown as Joined[];

    // Deduplica por profile_id, eligiendo el rol del scope más específico.
    const byProfile = new Map<string, Joined>();
    for (const r of rows) {
      const prev = byProfile.get(r.profile_id);
      if (!prev || SCOPE_RANK[r.scope_type] < SCOPE_RANK[prev.scope_type]) {
        byProfile.set(r.profile_id, r);
      }
    }

    return Array.from(byProfile.values()).map((row) => ({
      profileId: row.profile_id,
      role: row.role,
      fullName: row.profiles.full_name,
      email: row.profiles.email,
      avatarUrl: row.profiles.avatar_url,
      grantedVia: row.scope_type,
    }));
  },

  async addMember(input): Promise<Result<OrgMembership>> {
    const db = supabaseAdmin();
    const { error } = await db
      .from("memberships")
      .upsert(
        {
          profile_id: input.profileId,
          role: input.role,
          scope_type: "organization",
          scope_id: input.organizationId,
        },
        { onConflict: "profile_id,scope_type,scope_id" },
      );
    if (error) return err(error.message);
    return ok({
      organizationId: input.organizationId,
      profileId: input.profileId,
      role: input.role,
    });
  },
};
