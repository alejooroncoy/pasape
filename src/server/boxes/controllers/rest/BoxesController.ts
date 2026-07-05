import { z } from "zod";
import { isValidDocument } from "@/lib/identity/document";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { signTicketLink, verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { supabaseBoxRepository as repo } from "../../infrastructure/repositories/SupabaseBoxRepository";
import {
  createBoxForTicket,
  getBoxByTicket,
  getBoxByToken,
  joinBox,
  removeBoxMember,
  addBoxCompanion,
} from "../../application/BoxServices";
import type { Box } from "../../domain/Box";

// Resuelve el current_holder del ticket cuando el caller solo tiene el link
// público (`k`). Sin esto, comprar como guest y abrir el QR sin sesión no
// puede generar/ver el box de invitaciones.
async function resolveOrCreateGuestProfile(input: {
  phone: string;
  fullName: string;
}): Promise<string | null> {
  const db = supabaseAdmin();
  // Normalizamos a solo dígitos para que `+51987654321` y `987654321` matcheen
  // al mismo profile y no dupliquen.
  const phoneNorm = input.phone.replace(/\D/g, "");
  if (!phoneNorm) return null;

  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("phone", phoneNorm)
    .maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  // profiles.id es FK a auth.users(id) — no podemos insertar directo. Creamos
  // auth user (el trigger handle_new_user crea la row de profiles) y luego
  // hidratamos phone + initial_role. Sintetizamos email para satisfacer
  // createUser (Supabase exige email o phone con verificación).
  const synthEmail = `guest+${phoneNorm}@pasape.app`;
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: synthEmail,
    phone: phoneNorm,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (authErr || !authUser?.user) return null;
  await db
    .from("profiles")
    .update({ phone: phoneNorm, initial_role: "buyer" })
    .eq("id", authUser.user.id);
  return authUser.user.id;
}

async function resolveTicketHolderViaLink(
  ticketId: string,
  k: string | null,
): Promise<string | null> {
  if (!k || !verifyTicketLink(ticketId, k)) return null;
  const { data } = await supabaseAdmin()
    .from("tickets")
    .select("current_holder")
    .eq("id", ticketId)
    .maybeSingle<{ current_holder: string | null }>();
  return data?.current_holder ?? null;
}

const createSchema = z.object({
  ticketId: z.string().uuid(),
  capacity: z.number().int().min(2).max(20).default(6),
});

const joinSchema = z
  .object({
    token: z.string().min(1),
    holderName: z.string().min(1),
    holderDni: z.string().trim().min(1).max(20).nullable().optional(),
    holderPhone: z.string().nullable().optional(),
    isForeigner: z.boolean().optional(),
  })
  // DNI estricto (8 díg) para el peruano; documento laxo (5-20) para el extranjero.
  .refine((j) => j.holderDni == null || isValidDocument(j.holderDni, !!j.isForeigner), {
    message: "invalid_document",
    path: ["holderDni"],
  });

const removeMemberSchema = z.object({
  token: z.string().min(1),
  memberProfileId: z.string().uuid(),
});

const addCompanionSchema = z.object({
  token: z.string().min(1),
  holderName: z.string().trim().min(2).max(120),
  holderDni: z.string().regex(/^\d{8}$/).nullable().optional(),
});

export const BoxesController = {
  async create(input: unknown, linkToken: string | null = null): Promise<Result<Box>> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    // Camino auth normal (panel logueado)…
    const auth = await getAuthContext();
    let ownerId: string | null = auth.ok ? auth.value.profileId : null;
    // …o vía link público del ticket (compra guest sin sesión).
    if (!ownerId) ownerId = await resolveTicketHolderViaLink(parsed.data.ticketId, linkToken);
    if (!ownerId) return err(auth.ok ? "no_owner" : auth.error);
    return createBoxForTicket(
      { repo },
      { ticketId: parsed.data.ticketId, ownerId, capacity: parsed.data.capacity },
    );
  },

  async byToken(token: string): Promise<Result<Box>> {
    const box = await getBoxByToken({ repo }, token);
    if (!box) return err("not_found");
    return { ok: true, value: box };
  },

  async forTicket(ticketId: string, linkToken: string | null = null): Promise<Result<Box | null>> {
    const auth = await getAuthContext();
    let ownerId: string | null = auth.ok ? auth.value.profileId : null;
    if (!ownerId) ownerId = await resolveTicketHolderViaLink(ticketId, linkToken);
    if (!ownerId) return err(auth.ok ? "no_owner" : auth.error);
    return { ok: true, value: await getBoxByTicket({ repo }, ticketId, ownerId) };
  },

  async join(input: unknown): Promise<Result<Box & { joinedTicket: { id: string; k: string } | null }>> {
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");

    const auth = await getAuthContext();
    let profileId: string | null = auth.ok ? auth.value.profileId : null;

    // Guest path: aceptar invitación sin login. Resolvemos profile por phone
    // (clave primaria de contacto en Pasape) y, si no existe, lo creamos.
    if (!profileId) {
      const phone = parsed.data.holderPhone?.trim();
      if (!phone) return err("phone_required");
      profileId = await resolveOrCreateGuestProfile({
        phone,
        fullName: parsed.data.holderName,
      });
      if (!profileId) return err("profile_create_failed");
    }

    const result = await joinBox(
      { repo },
      {
        token: parsed.data.token,
        profileId,
        holderName: parsed.data.holderName,
        holderDni: parsed.data.holderDni ?? null,
        holderPhone: parsed.data.holderPhone ?? null,
      },
    );
    if (!result.ok) return result;

    // Devolvemos el link público del ticket recién emitido. Crítico para
    // guests sin sesión, que no pueden abrir `/tickets/[id]` (RLS por
    // current_holder = auth.uid()). El link `/t/[id]?k=...` usa HMAC.
    const mine = result.value.members.find((m) => m.profileId === profileId);
    const joinedTicket = mine?.ticketId
      ? { id: mine.ticketId, k: signTicketLink(mine.ticketId) }
      : null;
    return { ok: true, value: { ...result.value, joinedTicket } };
  },

  async removeMember(input: unknown): Promise<Result<Box>> {
    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return removeBoxMember(
      { repo },
      {
        token: parsed.data.token,
        ownerId: auth.value.profileId,
        memberProfileId: parsed.data.memberProfileId,
      },
    );
  },

  async addCompanion(input: unknown): Promise<Result<Box>> {
    const parsed = addCompanionSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return addBoxCompanion(
      { repo },
      {
        token: parsed.data.token,
        ownerId: auth.value.profileId,
        holderName: parsed.data.holderName,
        holderDni: parsed.data.holderDni ?? null,
      },
    );
  },
};
