import { z } from "zod";
import { fail, ok } from "@/server/_shared/http";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";
import { joinBox } from "@/server/boxes/application/BoxServices";

const bodySchema = z.object({
  holderName: z.string().trim().min(1),
  holderPhone: z.string().trim().min(7),
  holderDni: z.string().nullable().optional(),
});

// POST /api/tickets/invite-box/[token]/accept
// Requiere sesión: el teléfono del invitado debe coincidir con el del usuario
// logueado (evita registrar a otro solo con su email).
export const POST = async (
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) => {
  const auth = await getAuthContext();
  if (!auth.ok) return fail("unauthorized");

  const { token } = await params;
  if (!token) return fail("invalid_input");
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return fail("invalid_input");

  const phoneNorm = parsed.data.holderPhone.replace(/\D/g, "");
  const db = supabaseAdmin();
  const { data: profile } = await db
    .from("profiles")
    .select("phone")
    .eq("id", auth.value.profileId)
    .maybeSingle<{ phone: string | null }>();
  const userPhone = profile?.phone?.replace(/\D/g, "") ?? "";
  if (!userPhone || userPhone !== phoneNorm) return fail("phone_mismatch");

  const result = await joinBox(
    { repo: supabaseBoxRepository },
    {
      token,
      profileId: auth.value.profileId,
      holderName: parsed.data.holderName,
      holderDni: parsed.data.holderDni ?? null,
      holderPhone: parsed.data.holderPhone,
    },
  );
  if (!result.ok) return fail(result.error);

  const member = result.value.members.find((m) => m.profileId === auth.value.profileId);
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
