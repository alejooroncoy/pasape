import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

/**
 * Persona invitada como co-organizadora puntual de un evento.
 * NO confundir con membresías de la marca/razón social (memberships): esas viven en
 * la BC `identity/organizations` y dan acceso transversal. Los co-org de evento
 * solo aplican a un slug.
 */
export type EventCoOrganizer = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
};

/**
 * Lista los co-organizadores asignados solo a este evento (tabla
 * `event_co_organizers`). No incluye gente con acceso heredado desde la marca,
 * razón social o portafolio.
 */
export const listEventCoOrganizers = async (
  eventId: string,
): Promise<EventCoOrganizer[]> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("event_co_organizers")
    .select(
      "profile_id, created_at, profiles:profiles!inner(id, full_name, email, avatar_url)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (!data) return [];
  type Row = {
    profile_id: string;
    created_at: string;
    profiles: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    };
  };
  return (data as unknown as Row[]).map((r) => ({
    profileId: r.profile_id,
    fullName: r.profiles.full_name,
    email: r.profiles.email,
    avatarUrl: r.profiles.avatar_url,
    addedAt: r.created_at,
  }));
};

export const addEventCoOrganizer = async (
  eventId: string,
  profileId: string,
): Promise<Result<{ profileId: string }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("event_co_organizers")
    .upsert({ event_id: eventId, profile_id: profileId }, { onConflict: "event_id,profile_id" });
  if (error) return err(error.message);
  return ok({ profileId });
};

/**
 * Invita a alguien por email como co-organizador de UN evento puntual, sin
 * volverlo miembro de la marca (a diferencia del invite de equipo normal, que
 * vive en el BC identity/organizations). Reusa el MISMO mecanismo de invites
 * (token, email, aceptar) con scope_type="event" — ver AcceptInvite.ts, que
 * al aceptar inserta en `event_co_organizers` en vez de `memberships`.
 */
export const inviteEventCoOrganizer = async (
  deps: {
    invites: import("@/server/identity/organizations/ports/InviteRepository").InviteRepository;
    memberships: import("@/server/identity/organizations/ports/MembershipRepository").MembershipRepository;
  },
  input: { eventId: string; organizationId: string; callerProfileId: string; email: string },
): Promise<Result<{ inviteId: string; token: string; expiresAt: string; email: string }>> => {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return err("invalid_email");
  const allowed = await deps.memberships.hasAdminOver({
    profileId: input.callerProfileId,
    scopeType: "organization",
    scopeId: input.organizationId,
  });
  if (!allowed) return err("forbidden");
  const created = await deps.invites.create({
    scope: { type: "event", id: input.eventId },
    invitedBy: input.callerProfileId,
    email,
    phone: null,
    role: "editor",
  });
  if (!created.ok) return err(created.error);
  return ok({
    inviteId: created.value.id,
    token: created.value.token,
    expiresAt: created.value.expiresAt,
    email,
  });
};

export const removeEventCoOrganizer = async (
  eventId: string,
  profileId: string,
): Promise<Result<{ profileId: string }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("event_co_organizers")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error) return err(error.message);
  return ok({ profileId });
};
