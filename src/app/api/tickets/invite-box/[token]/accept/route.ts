import { z } from "zod";
import { fail, ok } from "@/server/_shared/http";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";
import { joinBox } from "@/server/boxes/application/BoxServices";

const bodySchema = z.object({
  holderName: z.string().trim().min(1),
  holderEmail: z.string().trim().email(),
  holderDni: z.string().nullable().optional(),
});

// POST /api/tickets/invite-box/[token]/accept
// Acepta una invitación al box: crea (o reusa) un profile por email, le suma
// un asiento al box y emite un ticket con box_label heredado + box_host_ticket_id
// apuntando al ticket del host. No requiere sesión iniciada — funciona como
// guest checkout, igual que /api/tickets/buy.
export const POST = async (
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params;
  if (!token) return fail("invalid_input");
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  const db = supabaseAdmin();
  const emailNorm = parsed.data.holderEmail.toLowerCase();
  let profileId: string | null = null;

  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .ilike("email", emailNorm)
    .maybeSingle<{ id: string }>();
  if (existing) {
    profileId = existing.id;
  } else {
    const { data: created, error } = await db
      .from("profiles")
      .insert({
        email: emailNorm,
        full_name: parsed.data.holderName,
        initial_role: "buyer",
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return fail(error?.message ?? "profile_create_failed");
    profileId = created.id;
  }

  const result = await joinBox(
    { repo: supabaseBoxRepository },
    {
      token,
      profileId,
      holderName: parsed.data.holderName,
      holderDni: parsed.data.holderDni ?? null,
      holderPhone: null,
    },
  );
  if (!result.ok) return fail(result.error);

  // Recuperamos el ticket recién emitido para este profile en este box.
  const member = result.value.members.find((m) => m.profileId === profileId);
  return ok({
    ticketId: member?.ticketId ?? null,
    box: {
      label: result.value.boxNumber,
      capacity: result.value.capacity,
      filled: result.value.members.length,
      remainingSlots: Math.max(0, result.value.capacity - result.value.members.length),
    },
  });
};
